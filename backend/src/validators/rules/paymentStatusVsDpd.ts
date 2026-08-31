// Rule 8: payment_status must be consistent with days_past_due
export function checkPaymentStatusVsDpd(
  row: Record<string, unknown>,
  config: { currentMaxDpd: number }
): string | null {
  const status = ((row['paymentStatus'] ?? row['payment_status'] ?? '') as string).toLowerCase();
  const dpd = Number(row['daysPastDue'] ?? row['days_past_due'] ?? 0);

  if (!status) return null;

  if (status === 'current' && dpd > config.currentMaxDpd) {
    return `payment_status is "current" but days_past_due is ${dpd} (expected 0)`;
  }
  if (status === 'closed' && dpd > 0) {
    return `payment_status is "closed" but days_past_due is ${dpd}`;
  }
  if ((status === 'delinquent' || status === 'default') && dpd === 0) {
    return `payment_status is "${status}" but days_past_due is 0`;
  }

  return null;
}
