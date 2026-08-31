import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';

const router = Router();

// GET /loans
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20', status, loanId, borrowerId } = req.query;
  const pageNum = parseInt(page as string, 10);
  const pageSize = parseInt(limit as string, 10);

  const where: Record<string, unknown> = {};
  if (loanId) where['loanId'] = { contains: loanId as string };
  if (borrowerId) where['borrowerId'] = { contains: borrowerId as string };

  const [total, loans] = await Promise.all([
    prisma.loanRecord.count({ where }),
    prisma.loanRecord.findMany({
      where,
      include: {
        exceptions: { select: { id: true, severity: true, status: true } },
        verifiedRecord: { select: { id: true, reviewerDecision: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    data: loans.map((l) => ({
      ...l,
      rawRow: undefined, // don't expose raw on list
      exceptionsCount: l.exceptions.length,
      openExceptionsCount: l.exceptions.filter((e) => e.status === 'open').length,
      isVerified: !!l.verifiedRecord,
    })),
    pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
  });
});

// GET /loans/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const loan = await prisma.loanRecord.findUnique({
    where: { id: req.params.id },
    include: {
      exceptions: {
        include: { rule: true, reviewActions: { orderBy: { timestamp: 'desc' } } },
      },
      verifiedRecord: true,
      batch: { select: { fileName: true, uploadedAt: true, fileType: true } },
    },
  });

  if (!loan) return res.status(404).json({ error: 'Loan not found' });

  // Get servicer update for diff view
  const servicerUpdate = await prisma.servicerUpdate.findFirst({
    where: { loanId: loan.loanId },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    ...loan,
    rawRow: JSON.parse(loan.rawRowJson),
    servicerUpdate: servicerUpdate ? JSON.parse(servicerUpdate.rawRowJson) : null,
  });
});

export default router;
