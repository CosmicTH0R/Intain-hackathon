import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { parseCSV, normalizeLoanRow, normalizeServicerRow, normalizeManifestRow } from '../services/csvParser';
import { runValidationEngine, persistExceptions } from '../validators/engine';
import { logAudit } from '../services/auditLogger';
import prisma from '../prisma/client';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// POST /upload/loan-tape
router.post(
  '/loan-tape',
  authenticate,
  requireRole('data_operator'),
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const batchId = uuidv4();
    const sourceFileId = uuidv4();
    const { parsed, failed } = parseCSV(req.file.buffer, 'loan_tape');

    // Create batch record
    const batch = await prisma.importBatch.create({
      data: {
        id: batchId,
        fileName: req.file.originalname,
        fileType: 'loan_tape',
        uploadedBy: req.user!.userId,
        totalRows: parsed.length + failed.length,
        importedRows: 0,
        failedRows: failed.length,
        status: 'processing',
      },
    });

    // Store failed rows
    if (failed.length > 0) {
      await prisma.failedRowLog.createMany({
        data: failed.map((f) => ({
          batchId,
          rowNumber: f.rowNumber,
          rawContent: f.rawContent,
          reason: f.reason,
        })),
      });
    }

    // Normalize and store loan records
    const loanRecords: Array<{ id: string; loanId: string; data: Record<string, unknown> }> = [];
    let importedCount = 0;

    for (const row of parsed) {
      try {
        const normalized = normalizeLoanRow(row);
        if (!normalized.loanId) {
          await prisma.failedRowLog.create({
            data: { batchId, rowNumber: 0, rawContent: JSON.stringify(row), reason: 'Missing loan_id after normalization' },
          });
          continue;
        }

        const recordId = uuidv4();
        await prisma.loanRecord.create({
          data: {
            id: recordId,
            loanId: normalized.loanId as string,
            borrowerId: normalized.borrowerId as string ?? '',
            loanType: normalized.loanType as string | null,
            originationDate: normalized.originationDate as string | null,
            maturityDate: normalized.maturityDate as string | null,
            originalPrincipal: normalized.originalPrincipal as number | null,
            currentBalance: normalized.currentBalance as number | null,
            interestRate: normalized.interestRate as number | null,
            termMonths: normalized.termMonths as number | null,
            borrowerState: normalized.borrowerState as string | null,
            loanPurpose: normalized.loanPurpose as string | null,
            creditGrade: normalized.creditGrade as string | null,
            employmentLength: normalized.employmentLength as string | null,
            incomeBand: normalized.incomeBand as string | null,
            paymentStatus: normalized.paymentStatus as string | null,
            daysPastDue: normalized.daysPastDue as number | null,
            servicerName: normalized.servicerName as string | null,
            lastPaymentDate: normalized.lastPaymentDate as string | null,
            lastUpdatedAt: normalized.lastUpdatedAt as string | null,
            documentStatus: normalized.documentStatus as string | null,
            sourceSystem: normalized.sourceSystem as string | null,
            sourceFileId,
            importBatchId: batchId,
            rawRowJson: JSON.stringify(row),
          },
        });

        loanRecords.push({ id: recordId, loanId: normalized.loanId as string, data: normalized });
        importedCount++;

        await logAudit({
          eventType: 'loan_record_imported',
          entityType: 'LoanRecord',
          entityId: recordId,
          actor: req.user!.userId,
          details: { loanId: normalized.loanId, batchId, fileName: req.file!.originalname },
        });
      } catch (err) {
        await prisma.failedRowLog.create({
          data: { batchId, rowNumber: 0, rawContent: JSON.stringify(row), reason: (err as Error).message },
        });
      }
    }

    // Update batch counters
    await prisma.importBatch.update({
      where: { id: batchId },
      data: { importedRows: importedCount, failedRows: failed.length + (parsed.length - importedCount), status: 'completed' },
    });

    // Log file upload
    await logAudit({
      eventType: 'file_uploaded',
      entityType: 'ImportBatch',
      entityId: batchId,
      actor: req.user!.userId,
      details: { fileName: req.file.originalname, totalRows: parsed.length + failed.length, importedRows: importedCount },
    });

    // Run validation if we have records
    if (loanRecords.length > 0) {
      // Get servicer updates from DB
      const servicerUpdates = await prisma.servicerUpdate.findMany({
        where: { loanId: { in: loanRecords.map((r) => r.loanId) } },
      });
      const servicerMap = new Map(
        servicerUpdates.map((su) => [su.loanId, JSON.parse(su.rawRowJson)])
      );

      // Get manifest
      const manifests = await prisma.documentManifest.findMany({
        where: { loanId: { in: loanRecords.map((r) => r.loanId) } },
      });
      const manifestMap = new Map(manifests.map((m) => [m.loanId, m.documentStatus]));

      const exceptions = await runValidationEngine(loanRecords, servicerMap, manifestMap);
      if (exceptions.length > 0) {
        await persistExceptions(exceptions);
        // Log each exception
        for (const ex of exceptions) {
          await logAudit({
            eventType: 'exception_created',
            entityType: 'Exception',
            entityId: ex.loanRecordId,
            actor: 'system',
            details: { ruleName: ex.ruleName, severity: ex.severity, loanId: ex.loanId },
          });
        }
      }

      await logAudit({
        eventType: 'validation_executed',
        entityType: 'ImportBatch',
        entityId: batchId,
        actor: 'system',
        details: { recordsValidated: loanRecords.length, exceptionsFound: exceptions.length },
      });

      return res.json({
        batchId,
        fileName: req.file.originalname,
        totalRows: parsed.length + failed.length,
        importedRows: importedCount,
        failedRows: failed.length + (parsed.length - importedCount),
        exceptionsFound: exceptions.length,
        summary: summarizeExceptions(exceptions),
      });
    }

    return res.json({
      batchId,
      fileName: req.file.originalname,
      totalRows: parsed.length + failed.length,
      importedRows: importedCount,
      failedRows: failed.length,
      exceptionsFound: 0,
      summary: {},
    });
  }
);

// POST /upload/servicer-update
router.post(
  '/servicer-update',
  authenticate,
  requireRole('data_operator'),
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const batchId = uuidv4();
    const sourceFileId = uuidv4();
    const { parsed, failed } = parseCSV(req.file.buffer, 'servicer_update');

    await prisma.importBatch.create({
      data: {
        id: batchId,
        fileName: req.file.originalname,
        fileType: 'servicer_update',
        uploadedBy: req.user!.userId,
        totalRows: parsed.length + failed.length,
        importedRows: 0,
        failedRows: failed.length,
        status: 'processing',
      },
    });

    let importedCount = 0;
    for (const row of parsed) {
      const normalized = normalizeServicerRow(row);
      if (!normalized.loanId) continue;
      await prisma.servicerUpdate.create({
        data: {
          loanId: normalized.loanId as string,
          sourceFileId,
          importBatchId: batchId,
          rawRowJson: JSON.stringify(row),
          currentBalance: normalized.currentBalance as number | null,
          paymentStatus: normalized.paymentStatus as string | null,
          daysPastDue: normalized.daysPastDue as number | null,
          lastPaymentDate: normalized.lastPaymentDate as string | null,
          lastUpdatedAt: normalized.lastUpdatedAt as string | null,
          documentStatus: normalized.documentStatus as string | null,
        },
      });
      importedCount++;
    }

    await prisma.importBatch.update({
      where: { id: batchId },
      data: { importedRows: importedCount, status: 'completed' },
    });

    await logAudit({
      eventType: 'file_uploaded',
      entityType: 'ImportBatch',
      entityId: batchId,
      actor: req.user!.userId,
      details: { fileName: req.file.originalname, fileType: 'servicer_update', importedRows: importedCount },
    });

    res.json({ batchId, importedRows: importedCount, failedRows: failed.length });
  }
);

// POST /upload/document-manifest
router.post(
  '/document-manifest',
  authenticate,
  requireRole('data_operator'),
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const batchId = uuidv4();
    const sourceFileId = uuidv4();
    const { parsed, failed } = parseCSV(req.file.buffer, 'document_manifest');

    await prisma.importBatch.create({
      data: {
        id: batchId,
        fileName: req.file.originalname,
        fileType: 'document_manifest',
        uploadedBy: req.user!.userId,
        totalRows: parsed.length + failed.length,
        importedRows: 0,
        failedRows: failed.length,
        status: 'processing',
      },
    });

    let importedCount = 0;
    for (const row of parsed) {
      const normalized = normalizeManifestRow(row);
      if (!normalized.loanId) continue;
      await prisma.documentManifest.create({
        data: {
          loanId: normalized.loanId as string,
          documentStatus: normalized.documentStatus as string ?? 'unknown',
          sourceFileId,
          importBatchId: batchId,
        },
      });
      importedCount++;
    }

    await prisma.importBatch.update({
      where: { id: batchId },
      data: { importedRows: importedCount, status: 'completed' },
    });

    res.json({ batchId, importedRows: importedCount, failedRows: failed.length });
  }
);

// GET /upload/history
router.get('/history', authenticate, async (_req: AuthRequest, res: Response) => {
  const batches = await prisma.importBatch.findMany({
    orderBy: { uploadedAt: 'desc' },
    take: 50,
  });
  res.json(batches);
});

// GET /upload/failed-rows/:batchId
router.get('/failed-rows/:batchId', authenticate, async (req: AuthRequest, res: Response) => {
  const rows = await prisma.failedRowLog.findMany({
    where: { batchId: req.params.batchId },
    orderBy: { rowNumber: 'asc' },
  });
  res.json(rows);
});

function summarizeExceptions(exceptions: Array<{ severity: string; ruleName: string }>) {
  const bySeverity: Record<string, number> = {};
  const byRule: Record<string, number> = {};
  for (const ex of exceptions) {
    bySeverity[ex.severity] = (bySeverity[ex.severity] ?? 0) + 1;
    byRule[ex.ruleName] = (byRule[ex.ruleName] ?? 0) + 1;
  }
  return { bySeverity, byRule };
}

export default router;
