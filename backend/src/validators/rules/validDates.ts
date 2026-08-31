// Rule 2: Valid date formats
export function checkValidDates(
  row: Record<string, unknown>,
  config: { dateFields: string[] }
): string | null {
  const invalid: string[] = [];
  for (const field of config.dateFields) {
    const val = row[field];
    if (val === null || val === undefined || val === '') continue; // skip empty — caught by required fields rule
    const parsed = new Date(val as string);
    if (isNaN(parsed.getTime())) {
      invalid.push(`${field}="${val}"`);
    }
  }
  return invalid.length > 0
    ? `Invalid date format in: ${invalid.join(', ')}`
    : null;
}

export function parseDate(val: unknown): Date | null {
  if (!val || val === '') return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}
