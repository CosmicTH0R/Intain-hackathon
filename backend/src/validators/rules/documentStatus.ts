// Rule 9: document_status cross-check against document manifest
export function checkDocumentStatus(
  row: Record<string, unknown>,
  manifestMap: Map<string, string>
): string | null {
  const loanId = (row['loanId'] ?? row['loan_id'] ?? '') as string;
  const tapeStatus = (row['documentStatus'] ?? row['document_status'] ?? '') as string;

  if (!loanId) return null;

  if (!tapeStatus) {
    return `document_status is missing for loan ${loanId}`;
  }

  if (manifestMap.size > 0 && !manifestMap.has(loanId)) {
    return `loan ${loanId} has no entry in document manifest`;
  }

  return null;
}
