// Rule 16: Suspiciously repeated borrower records
export function findRepeatedBorrowers(
  rows: Array<Record<string, unknown>>,
  config: { threshold: number }
): Map<string, number> {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const id = (row['borrowerId'] ?? row['borrower_id'] ?? '') as string;
    if (!id) return;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  const repeated = new Map<string, number>();
  counts.forEach((count, id) => {
    if (count >= config.threshold) repeated.set(id, count);
  });
  return repeated;
}

export function checkRepeatedBorrower(
  row: Record<string, unknown>,
  repeatedMap: Map<string, number>,
  config: { threshold: number }
): string | null {
  const id = (row['borrowerId'] ?? row['borrower_id'] ?? '') as string;
  if (!id) return null;
  const count = repeatedMap.get(id);
  if (count !== undefined) {
    return `borrower_id "${id}" appears ${count} times in this batch (threshold: ${config.threshold})`;
  }
  return null;
}
