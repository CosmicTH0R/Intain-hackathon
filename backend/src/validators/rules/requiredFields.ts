// Rule 1: Required fields present
export function checkRequiredFields(
  row: Record<string, unknown>,
  config: { requiredFields: string[] }
): string | null {
  const missing: string[] = [];
  for (const field of config.requiredFields) {
    const val = row[field];
    if (val === null || val === undefined || val === '') {
      missing.push(field);
    }
  }
  return missing.length > 0
    ? `Missing required fields: ${missing.join(', ')}`
    : null;
}
