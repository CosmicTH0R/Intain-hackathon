import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';

const router = Router();

// GET /summary — aggregate stats + data quality score
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  const [
    totalLoans,
    totalVerified,
    exceptionStats,
    recentBatches,
    severityStats,
  ] = await Promise.all([
    prisma.loanRecord.count(),
    prisma.verifiedLoanRecord.count(),
    prisma.exception.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.importBatch.findMany({ orderBy: { uploadedAt: 'desc' }, take: 5 }),
    prisma.exception.groupBy({ by: ['severity'], _count: { _all: true } }),
  ]);

  const totalExceptions = exceptionStats.reduce((sum, s) => sum + s._count._all, 0);
  const openExceptions = exceptionStats.find((s) => s.status === 'open')?._count._all ?? 0;

  /**
   * Data Quality Score formula (documented in ARCHITECTURE.md):
   * score = (verified / total) * 100 * (1 - open_exception_rate)
   * where open_exception_rate = open_exceptions / max(total_loans, 1)
   * Clamped to [0, 100]
   */
  const verificationRate = totalLoans > 0 ? totalVerified / totalLoans : 0;
  const exceptionRate = totalLoans > 0 ? openExceptions / totalLoans : 0;
  const dataQualityScore = Math.round(
    Math.min(100, Math.max(0, verificationRate * 100 * (1 - exceptionRate)))
  );

  const exceptionByStatus: Record<string, number> = {};
  exceptionStats.forEach((s) => { exceptionByStatus[s.status] = s._count._all; });

  const exceptionBySeverity: Record<string, number> = {};
  severityStats.forEach((s) => { exceptionBySeverity[s.severity] = s._count._all; });

  res.json({
    totalLoans,
    totalVerified,
    totalExceptions,
    openExceptions,
    dataQualityScore,
    exceptionByStatus,
    exceptionBySeverity,
    recentBatches: recentBatches.map((b) => ({
      id: b.id,
      fileName: b.fileName,
      fileType: b.fileType,
      uploadedAt: b.uploadedAt,
      importedRows: b.importedRows,
      failedRows: b.failedRows,
    })),
  });
});

export default router;
