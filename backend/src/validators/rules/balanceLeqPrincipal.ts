// Rule 5: current_balance must not exceed original_principal
export function checkBalanceLeqPrincipal(row: Record<string, unknown>): string | null {
  const principal = Number(row['originalPrincipal'] ?? row['original_principal']);
  const balance = Number(row['currentBalance'] ?? row['current_balance']);
  if (isNaN(principal) || isNaN(balance)) return null;
  if (balance > principal) {
    return `current_balance (${balance}) exceeds original_principal (${principal})`;
  }
  return null;
}
