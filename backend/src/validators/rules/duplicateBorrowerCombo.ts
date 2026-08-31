// Rule 11: Duplicate borrower_id + original_principal + origination_date combo
export function findDuplicateBorrowerCombos(
  rows: Array<Record<string, unknown>>
): Map<string, number[]> {
  const seen = new Map<string, number[]>();
  rows.forEach((row, idx) => {
    const borrowerId = row['borrowerId'] ?? row['borrower_id'] ?? '';
    const principal = row['originalPrincipal'] ?? row['original_principal'] ?? '';
    const origDate = row['originationDate'] ?? row['origination_date'] ?? '';
    if (!borrowerId) return;
    const key = `${borrowerId}|${principal}|${origDate}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(idx);
  });
  const duplicates = new Map<string, number[]>();
  seen.forEach((indices, key) => {
    if (indices.length > 1) duplicates.set(key, indices);
  });
  return duplicates;
}

export function checkDuplicateBorrowerCombo(
  row: Record<string, unknown>,
  duplicateMap: Map<string, number[]>
): string | null {
  const borrowerId = row['borrowerId'] ?? row['borrower_id'] ?? '';
  const principal = row['originalPrincipal'] ?? row['original_principal'] ?? '';
  const origDate = row['originationDate'] ?? row['origination_date'] ?? '';
  const key = `${borrowerId}|${principal}|${origDate}`;
  if (duplicateMap.has(key)) {
    return `Duplicate borrower combo detected: borrower_id="${borrowerId}", amount=${principal}, origination_date=${origDate}`;
  }
  return null;
}
