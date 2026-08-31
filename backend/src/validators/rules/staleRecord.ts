// Rule 13: Stale record detection
import { parseDate } from './validDates';

export function checkStaleRecord(
  row: Record<string, unknown>,
  config: { maxAgeDays: number }
): string | null {
  const lastUpdated = parseDate(row['lastUpdatedAt'] ?? row['last_updated_at']);
  if (!lastUpdated) return null;

  const now = new Date();
  const ageMs = now.getTime() - lastUpdated.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  if (ageDays > config.maxAgeDays) {
    return `Record is stale: last_updated_at is ${ageDays} days ago (threshold: ${config.maxAgeDays} days)`;
  }
  return null;
}
