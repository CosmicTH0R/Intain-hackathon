// Rule 7: Valid payment_status enum
export function checkValidPaymentStatus(
  row: Record<string, unknown>,
  config: { validValues: string[] }
): string | null {
  const status = (row['paymentStatus'] ?? row['payment_status'] ?? '') as string;
  if (!status) return null;
  if (!config.validValues.includes(status.toLowerCase())) {
    return `payment_status "${status}" is not a valid value. Expected one of: ${config.validValues.join(', ')}`;
  }
  return null;
}
