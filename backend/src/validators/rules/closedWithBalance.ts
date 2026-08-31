// Rule 15: Closed loan with positive balance
export function checkClosedWithBalance(row: Record<string, unknown>): string | null {
  const status = ((row['paymentStatus'] ?? row['payment_status'] ?? '') as string).toLowerCase();
  const balance = Number(row['currentBalance'] ?? row['current_balance'] ?? 0);
  if (status === 'closed' && balance > 0) {
    return `Loan is marked "closed" but has positive current_balance: ${balance}`;
  }
  return null;
}
