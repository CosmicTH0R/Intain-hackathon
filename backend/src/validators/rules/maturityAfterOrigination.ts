// Rule 3: Maturity date must be after origination date
import { parseDate } from './validDates';

export function checkMaturityAfterOrigination(row: Record<string, unknown>): string | null {
  const orig = parseDate(row['originationDate'] ?? row['origination_date']);
  const mat = parseDate(row['maturityDate'] ?? row['maturity_date']);
  if (!orig || !mat) return null; // date format rule handles invalid dates
  if (mat <= orig) {
    return `maturity_date (${row['maturityDate'] ?? row['maturity_date']}) must be after origination_date (${row['originationDate'] ?? row['origination_date']})`;
  }
  return null;
}
