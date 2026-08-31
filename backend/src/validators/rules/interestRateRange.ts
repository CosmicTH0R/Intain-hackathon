// Rule 6: interest_rate within expected range
export function checkInterestRateRange(
  row: Record<string, unknown>,
  config: { min: number; max: number }
): string | null {
  const rate = Number(row['interestRate'] ?? row['interest_rate']);
  if (isNaN(rate)) return null;
  if (rate < config.min || rate > config.max) {
    return `interest_rate (${rate}) is outside expected range [${config.min}%, ${config.max}%]`;
  }
  return null;
}
