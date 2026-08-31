// Rule 4: No negative principal or balance
export function checkNoNegativeBalance(row: Record<string, unknown>): string | null {
  const issues: string[] = [];
  const principal = row['originalPrincipal'] ?? row['original_principal'];
  const balance = row['currentBalance'] ?? row['current_balance'];

  if (principal !== null && principal !== undefined && Number(principal) < 0) {
    issues.push(`original_principal=${principal}`);
  }
  if (balance !== null && balance !== undefined && Number(balance) < 0) {
    issues.push(`current_balance=${balance}`);
  }
  return issues.length > 0 ? `Negative value detected: ${issues.join(', ')}` : null;
}
