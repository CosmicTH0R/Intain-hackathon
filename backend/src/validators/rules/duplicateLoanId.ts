// Rule 10: Duplicate loan_id detection (batch-level check)
export function findDuplicateLoanIds(
  rows: Array<Record<string, unknown>>
): Map<string, number[]> {
  const seen = new Map<string, number[]>();
  rows.forEach((row, idx) => {
    const id = (row['loanId'] ?? row['loan_id'] ?? '') as string;
    if (!id) return;
    if (!seen.has(id)) seen.set(id, []);
    seen.get(id)!.push(idx);
  });
  // Return only IDs that appear more than once
  const duplicates = new Map<string, number[]>();
  seen.forEach((indices, id) => {
    if (indices.length > 1) duplicates.set(id, indices);
  });
  return duplicates;
}

export function checkDuplicateLoanId(
  loanId: string,
  duplicateMap: Map<string, number[]>
): string | null {
  if (duplicateMap.has(loanId)) {
    const indices = duplicateMap.get(loanId)!;
    return `loan_id "${loanId}" appears ${indices.length} times in this batch (rows: ${indices.map(i => i + 2).join(', ')})`;
  }
  return null;
}
