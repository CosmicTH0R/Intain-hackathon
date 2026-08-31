import { Router, Response } from 'express';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { hashCanonicalData, verifyHash } from '../services/hashing';
import { logAudit } from '../services/auditLogger';
import prisma from '../prisma/client';

const router = Router();

// POST /verified-loans — create verified record (immutable after creation)
router.post(
  '/',
  authenticate,
  requireRole('reviewer'),
  async (req: AuthRequest, res: Response) => {
    const { loanRecordId, reviewerDecision, aiRecommendationRef, comment } = req.body;
    if (!loanRecordId || !reviewerDecision) {
      return res.status(400).json({ error: 'loanRecordId and reviewerDecision required' });
    }

    const loan = await prisma.loanRecord.findUnique({ where: { id: loanRecordId } });
    if (!loan) return res.status(404).json({ error: 'Loan record not found' });

    // Check if already verified
    const existing = await prisma.verifiedLoanRecord.findUnique({ where: { loanRecordId } });
    if (existing) {
      return res.status(409).json({ error: 'Loan already has a verified record. Create a new version by correcting fields first.' });
    }

    // Get exception summary for validation result
    const exceptions = await prisma.exception.findMany({
      where: { loanRecordId },
      include: { rule: true },
    });

    const validationResult = {
      totalExceptions: exceptions.length,
      openExceptions: exceptions.filter((e) => e.status === 'open').length,
      approvedExceptions: exceptions.filter((e) => e.status === 'approved').length,
      rejectedExceptions: exceptions.filter((e) => e.status === 'rejected').length,
      severities: exceptions.reduce((acc, e) => {
        acc[e.severity] = (acc[e.severity] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // Build canonical data (deterministic for hashing)
    const canonicalData = {
      loanId: loan.loanId,
      borrowerId: loan.borrowerId,
      loanType: loan.loanType,
      originationDate: loan.originationDate,
      maturityDate: loan.maturityDate,
      originalPrincipal: loan.originalPrincipal,
      currentBalance: loan.currentBalance,
      interestRate: loan.interestRate,
      termMonths: loan.termMonths,
      borrowerState: loan.borrowerState,
      loanPurpose: loan.loanPurpose,
      creditGrade: loan.creditGrade,
      paymentStatus: loan.paymentStatus,
      daysPastDue: loan.daysPastDue,
      documentStatus: loan.documentStatus,
      sourceSystem: loan.sourceSystem,
      verifiedAt: new Date().toISOString(),
      verifiedBy: req.user!.userId,
    };

    const recordHash = hashCanonicalData(canonicalData as Record<string, unknown>);

    const verified = await prisma.verifiedLoanRecord.create({
      data: {
        loanId: loan.loanId,
        loanRecordId,
        canonicalDataJson: JSON.stringify(canonicalData),
        sourceFileReference: loan.sourceFileId,
        validationResult: JSON.stringify(validationResult),
        reviewerDecision,
        aiRecommendationRef: aiRecommendationRef || null,
        verifiedBy: req.user!.userId,
        recordHash,
      },
    });

    await logAudit({
      eventType: 'verified_record_created',
      entityType: 'VerifiedLoanRecord',
      entityId: loanRecordId,
      actor: req.user!.userId,
      details: { verifiedId: verified.id, loanId: loan.loanId, decision: reviewerDecision, hash: recordHash, comment },
    });

    res.status(201).json(verified);
  }
);

// GET /verified-loans
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const pageSize = parseInt(limit as string, 10);

  const [total, records] = await Promise.all([
    prisma.verifiedLoanRecord.count(),
    prisma.verifiedLoanRecord.findMany({
      include: {
        loanRecord: { select: { loanType: true, originalPrincipal: true, paymentStatus: true, borrowerState: true } },
        verifiedUser: { select: { name: true, email: true } },
      },
      orderBy: { verificationTimestamp: 'desc' },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    data: records.map((r) => ({
      ...r,
      canonicalData: JSON.parse(r.canonicalDataJson),
      validationResult: JSON.parse(r.validationResult),
    })),
    pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
  });
});

// GET /verified-loans/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const record = await prisma.verifiedLoanRecord.findUnique({
    where: { id: req.params.id },
    include: {
      loanRecord: true,
      verifiedUser: { select: { name: true, email: true, role: true } },
    },
  });

  if (!record) return res.status(404).json({ error: 'Verified loan record not found' });

  res.json({
    ...record,
    canonicalData: JSON.parse(record.canonicalDataJson),
    validationResult: JSON.parse(record.validationResult),
  });
});

// GET /verified-loans/:id/verify-hash — re-compute and compare hash
router.get('/:id/verify-hash', authenticate, async (req: AuthRequest, res: Response) => {
  const record = await prisma.verifiedLoanRecord.findUnique({ where: { id: req.params.id } });
  if (!record) return res.status(404).json({ error: 'Record not found' });

  const canonicalData = JSON.parse(record.canonicalDataJson);
  const recomputedHash = hashCanonicalData(canonicalData);
  const isValid = recomputedHash === record.recordHash;

  res.json({
    storedHash: record.recordHash,
    recomputedHash,
    isValid,
    message: isValid ? '✅ Hash verified — data has not been tampered with' : '❌ Hash mismatch — data may have been modified',
  });
});

// POST /verified-loans/:id/export — export and log
router.post('/:id/export', authenticate, async (req: AuthRequest, res: Response) => {
  const record = await prisma.verifiedLoanRecord.findUnique({
    where: { id: req.params.id },
    include: { loanRecord: true, verifiedUser: { select: { name: true } } },
  });
  if (!record) return res.status(404).json({ error: 'Record not found' });

  await logAudit({
    eventType: 'verified_record_exported',
    entityType: 'VerifiedLoanRecord',
    entityId: record.loanRecordId,
    actor: req.user!.userId,
    details: { verifiedId: record.id, loanId: record.loanId, format: req.body.format || 'json' },
  });

  res.json({
    ...record,
    canonicalData: JSON.parse(record.canonicalDataJson),
    validationResult: JSON.parse(record.validationResult),
  });
});

export default router;
