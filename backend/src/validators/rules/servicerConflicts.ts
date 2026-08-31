// Rule 14: Conflicts between loan_tape and servicer_update
export interface ConflictDetail {
  field: string;
  loanTapeValue: unknown;
  servicerValue: unknown;
}

export function checkServicerConflicts(
  loanRow: Record<string, unknown>,
  servicerRow: Record<string, unknown> | null,
  config: { fieldsToCompare: string[] }
): ConflictDetail[] {
  if (!servicerRow) return [];

  const conflicts: ConflictDetail[] = [];
  const fieldMap: Record<string, [string, string]> = {
    current_balance: ['currentBalance', 'currentBalance'],
    payment_status: ['paymentStatus', 'paymentStatus'],
    days_past_due: ['daysPastDue', 'daysPastDue'],
    last_payment_date: ['lastPaymentDate', 'lastPaymentDate'],
    document_status: ['documentStatus', 'documentStatus'],
  };

  for (const field of config.fieldsToCompare) {
    const [loanKey, svcKey] = fieldMap[field] ?? [field, field];
    const loanVal = String(loanRow[loanKey] ?? '').trim();
    const svcVal = String(servicerRow[svcKey] ?? '').trim();
    if (svcVal !== '' && loanVal !== svcVal) {
      conflicts.push({ field, loanTapeValue: loanVal, servicerValue: svcVal });
    }
  }

  return conflicts;
}
