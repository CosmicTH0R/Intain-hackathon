import prisma from '../prisma/client';

export type EventType =
  | 'file_uploaded'
  | 'loan_record_imported'
  | 'validation_executed'
  | 'exception_created'
  | 'ai_recommendation_generated'
  | 'reviewer_comment_added'
  | 'field_edited'
  | 'loan_approved'
  | 'loan_rejected'
  | 'verified_record_created'
  | 'verified_record_exported';

export interface AuditEntry {
  eventType: EventType;
  entityType: string;
  entityId: string;
  actor: string;
  details: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLogEntry.create({
      data: {
        eventType: entry.eventType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        actor: entry.actor,
        detailsJson: JSON.stringify(entry.details),
      },
    });
  } catch (err) {
    // Audit log failures should not crash the main operation
    console.error('[AUDIT] Failed to write audit log:', err);
  }
}

export async function getLoanAuditTrail(loanId: string) {
  return prisma.auditLogEntry.findMany({
    where: { entityId: loanId },
    orderBy: { timestamp: 'asc' },
  });
}
