import crypto from 'crypto';

/**
 * Produces a deterministic SHA-256 hash of a canonical JSON object.
 * Keys are sorted alphabetically before hashing to ensure consistency.
 */
export function hashCanonicalData(data: Record<string, unknown>): string {
  const canonical = deterministicStringify(data);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Recursively sorts object keys to create a stable string representation.
 */
function deterministicStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(deterministicStringify).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const sorted = Object.keys(value as object)
      .sort()
      .map((k) => `"${k}":${deterministicStringify((value as Record<string, unknown>)[k])}`)
      .join(',');
    return '{' + sorted + '}';
  }
  return JSON.stringify(value);
}

/**
 * Verifies a hash against canonical data. Returns true if match.
 */
export function verifyHash(data: Record<string, unknown>, expectedHash: string): boolean {
  return hashCanonicalData(data) === expectedHash;
}
