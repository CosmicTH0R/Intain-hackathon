import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logAudit } from '../services/auditLogger';
import prisma from '../prisma/client';

const router = Router();

// GET /exceptions — list with filters
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { status, severity, type, loanId, borrowerId, page = '1', limit = '20' } = req.query;

  const where: Record<string, unknown> = {};
  if (status) where['status'] = status;
  if (severity) where['severity'] = severity;
  if (loanId) where['loanId'] = { contains: loanId as string };

  if (borrowerId) {
    // Join through loanRecord to find by borrowerId
    const loans = await prisma.loanRecord.findMany({
      where: { borrowerId: { contains: borrowerId as string } },
      select: { id: true },
    });
    where['loanRecordId'] = { in: loans.map((l) => l.id) };
  }

  if (type) {
    const rules = await prisma.validationRule.findMany({
      where: { type: type as string },
      select: { id: true },
    });
    where['ruleId'] = { in: rules.map((r) => r.id) };
  }

  const pageNum = parseInt(page as string, 10);
  const pageSize = parseInt(limit as string, 10);

  const [total, exceptions] = await Promise.all([
    prisma.exception.count({ where }),
    prisma.exception.findMany({
      where,
      include: {
        rule: true,
        loanRecord: { select: { loanId: true, borrowerId: true, loanType: true, originalPrincipal: true, paymentStatus: true } },
        reviewActions: { orderBy: { timestamp: 'desc' }, take: 1 },
      },
      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    data: exceptions.map((ex) => ({
      ...ex,
      details: JSON.parse(ex.detailsJson),
    })),
    pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
  });
});

// GET /exceptions/:id — single exception with full context
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const ex = await prisma.exception.findUnique({
    where: { id: req.params.id },
    include: {
      rule: true,
      loanRecord: true,
      reviewActions: {
        include: { reviewer: { select: { name: true, email: true, role: true } } },
        orderBy: { timestamp: 'asc' },
      },
      aiRecommendations: { orderBy: { timestamp: 'desc' } },
    },
  });

  if (!ex) return res.status(404).json({ error: 'Exception not found' });

  // Fetch servicer update for diff
  const servicerUpdate = await prisma.servicerUpdate.findFirst({
    where: { loanId: ex.loanId },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    ...ex,
    details: JSON.parse(ex.detailsJson),
    loanRecord: { ...ex.loanRecord, rawRow: JSON.parse(ex.loanRecord.rawRowJson) },
    servicerUpdate: servicerUpdate ? JSON.parse(servicerUpdate.rawRowJson) : null,
    aiRecommendations: ex.aiRecommendations.map((r) => ({ ...r })),
  });
});

// POST /exceptions/:id/review — approve, reject, request_correction
router.post('/:id/review', authenticate, async (req: AuthRequest, res: Response) => {
  const { action, comment } = req.body;
  const validActions = ['approve', 'reject', 'request_correction'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
  }

  const ex = await prisma.exception.findUnique({ where: { id: req.params.id } });
  if (!ex) return res.status(404).json({ error: 'Exception not found' });

  const statusMap: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    request_correction: 'open',
  };

  const [reviewAction] = await Promise.all([
    prisma.reviewAction.create({
      data: {
        exceptionId: req.params.id,
        reviewerId: req.user!.userId,
        action,
        comment: comment || null,
        timestamp: new Date(),
      },
    }),
    prisma.exception.update({
      where: { id: req.params.id },
      data: { status: statusMap[action] },
    }),
  ]);

  const auditEvent = action === 'approve' ? 'loan_approved' : action === 'reject' ? 'loan_rejected' : 'reviewer_comment_added';
  await logAudit({
    eventType: auditEvent,
    entityType: 'Exception',
    entityId: ex.loanRecordId,
    actor: req.user!.userId,
    details: { exceptionId: req.params.id, action, comment, loanId: ex.loanId },
  });

  res.json({ reviewAction, message: `Exception ${action}d successfully` });
});

// POST /exceptions/:id/comment
router.post('/:id/comment', authenticate, async (req: AuthRequest, res: Response) => {
  const { comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'comment is required' });

  const ex = await prisma.exception.findUnique({ where: { id: req.params.id } });
  if (!ex) return res.status(404).json({ error: 'Exception not found' });

  const action = await prisma.reviewAction.create({
    data: {
      exceptionId: req.params.id,
      reviewerId: req.user!.userId,
      action: 'comment',
      comment,
    },
  });

  await logAudit({
    eventType: 'reviewer_comment_added',
    entityType: 'Exception',
    entityId: ex.loanRecordId,
    actor: req.user!.userId,
    details: { exceptionId: req.params.id, comment, loanId: ex.loanId },
  });

  res.json(action);
});

// PATCH /exceptions/:id/fields — edit allowed fields with logging
router.patch('/:id/fields', authenticate, async (req: AuthRequest, res: Response) => {
  const { fields } = req.body; // { fieldName: newValue, ... }
  if (!fields || typeof fields !== 'object') {
    return res.status(400).json({ error: 'fields object required' });
  }

  const ex = await prisma.exception.findUnique({
    where: { id: req.params.id },
    include: { loanRecord: true },
  });
  if (!ex) return res.status(404).json({ error: 'Exception not found' });

  // Capture old values before update
  const loanRecord = ex.loanRecord;
  const oldValues: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) {
    oldValues[key] = (loanRecord as Record<string, unknown>)[key];
  }

  // Update loan record
  await prisma.loanRecord.update({
    where: { id: ex.loanRecordId },
    data: fields,
  });

  // Log the edit action
  const reviewAction = await prisma.reviewAction.create({
    data: {
      exceptionId: req.params.id,
      reviewerId: req.user!.userId,
      action: 'edit_field',
      comment: `Edited fields: ${Object.keys(fields).join(', ')}`,
      fieldChangesJson: JSON.stringify({ before: oldValues, after: fields }),
    },
  });

  await logAudit({
    eventType: 'field_edited',
    entityType: 'LoanRecord',
    entityId: ex.loanRecordId,
    actor: req.user!.userId,
    details: { exceptionId: req.params.id, loanId: ex.loanId, before: oldValues, after: fields },
  });

  res.json({ reviewAction, message: 'Fields updated and logged' });
});

export default router;
