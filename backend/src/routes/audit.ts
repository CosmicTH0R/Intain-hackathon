import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';

const router = Router();

// GET /audit/:loanId — full chronological lineage for one loan
router.get('/:loanId', authenticate, async (req: AuthRequest, res: Response) => {
  const { loanId } = req.params;

  // Find the loan record(s) for this loan_id
  const loanRecords = await prisma.loanRecord.findMany({
    where: { loanId },
    select: { id: true },
  });

  if (loanRecords.length === 0) {
    return res.status(404).json({ error: `No loan found with loan_id: ${loanId}` });
  }

  const recordIds = loanRecords.map((r) => r.id);

  // Gather audit entries for all record IDs (covers LoanRecord + Exception entities)
  const entries = await prisma.auditLogEntry.findMany({
    where: {
      OR: [
        { entityId: { in: recordIds } },
        { detailsJson: { contains: loanId } },
      ],
    },
    orderBy: { timestamp: 'asc' },
  });

  // Parse details for readability
  const timeline = entries.map((entry) => ({
    id: entry.id,
    eventType: entry.eventType,
    entityType: entry.entityType,
    entityId: entry.entityId,
    actor: entry.actor,
    timestamp: entry.timestamp,
    details: JSON.parse(entry.detailsJson),
  }));

  res.json({ loanId, totalEvents: timeline.length, timeline });
});

// GET /audit — recent audit log (admin/consumer view)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { eventType, page = '1', limit = '50' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const pageSize = parseInt(limit as string, 10);

  const where = eventType ? { eventType: eventType as string } : {};

  const [total, entries] = await Promise.all([
    prisma.auditLogEntry.count({ where }),
    prisma.auditLogEntry.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    data: entries.map((e) => ({ ...e, details: JSON.parse(e.detailsJson) })),
    pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
  });
});

export default router;
