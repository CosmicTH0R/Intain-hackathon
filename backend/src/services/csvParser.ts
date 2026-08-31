import { parse } from 'csv-parse/sync';

export interface ParsedRow {
  [key: string]: string;
}

export interface FailedRow {
  rowNumber: number;
  rawContent: string;
  reason: string;
}

export interface ParseResult {
  parsed: ParsedRow[];
  failed: FailedRow[];
  headers: string[];
}

/**
 * Normalize a key to snake_case from various formats.
 */
function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Parse a CSV buffer into normalized rows. Robust against:
 * - BOM characters
 * - Different line endings (CRLF/LF)
 * - Quoted fields with commas
 * - Extra whitespace in headers
 * - Missing/extra columns vs header row
 */
export function parseCSV(buffer: Buffer, fileType: string): ParseResult {
  const parsed: ParsedRow[] = [];
  const failed: FailedRow[] = [];

  // Strip UTF-8 BOM if present
  const content = buffer.toString('utf-8').replace(/^\uFEFF/, '');

  let records: string[][];
  try {
    records = parse(content, {
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as string[][];
  } catch (err) {
    return {
      parsed: [],
      failed: [{ rowNumber: 0, rawContent: content.slice(0, 200), reason: `CSV parse error: ${(err as Error).message}` }],
      headers: [],
    };
  }

  if (records.length === 0) {
    return { parsed: [], failed: [], headers: [] };
  }

  const rawHeaders = records[0];
  const headers = rawHeaders.map(normalizeKey);

  for (let i = 1; i < records.length; i++) {
    const row = records[i];
    const rawContent = row.join(',');

    try {
      // Build the object from header → value mapping
      const obj: ParsedRow = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx] !== undefined ? row[idx].trim() : '';
      });

      // Check that loan_id-like field is present for loan_tape and servicer_update
      if (fileType !== 'document_manifest' && !obj['loan_id'] && !obj['loanid']) {
        throw new Error('Missing loan_id column value');
      }

      parsed.push(obj);
    } catch (err) {
      failed.push({
        rowNumber: i + 1, // 1-indexed, accounting for header row
        rawContent,
        reason: (err as Error).message,
      });
    }
  }

  return { parsed, failed, headers };
}

/**
 * Normalize a loan tape row into a consistent internal format.
 */
export function normalizeLoanRow(row: ParsedRow): Record<string, unknown> {
  return {
    loanId: row['loan_id'] || null,
    borrowerId: row['borrower_id'] || null,
    loanType: row['loan_type'] || null,
    originationDate: row['origination_date'] || null,
    maturityDate: row['maturity_date'] || null,
    originalPrincipal: parseFloat(row['original_principal']) || null,
    currentBalance: parseFloat(row['current_balance']) || null,
    interestRate: parseFloat(row['interest_rate']) || null,
    termMonths: parseInt(row['term_months'], 10) || null,
    borrowerState: row['borrower_state'] || null,
    loanPurpose: row['loan_purpose'] || null,
    creditGrade: row['credit_grade'] || null,
    employmentLength: row['employment_length'] || null,
    incomeBand: row['income_band'] || null,
    paymentStatus: row['payment_status'] || null,
    daysPastDue: parseInt(row['days_past_due'], 10) || 0,
    servicerName: row['servicer_name'] || null,
    lastPaymentDate: row['last_payment_date'] || null,
    lastUpdatedAt: row['last_updated_at'] || null,
    documentStatus: row['document_status'] || null,
    sourceSystem: row['source_system'] || null,
  };
}

/**
 * Normalize a servicer update row.
 */
export function normalizeServicerRow(row: ParsedRow): Record<string, unknown> {
  return {
    loanId: row['loan_id'] || null,
    currentBalance: row['current_balance'] ? parseFloat(row['current_balance']) : null,
    paymentStatus: row['payment_status'] || null,
    daysPastDue: row['days_past_due'] ? parseInt(row['days_past_due'], 10) : null,
    lastPaymentDate: row['last_payment_date'] || null,
    lastUpdatedAt: row['last_updated_at'] || null,
    documentStatus: row['document_status'] || null,
  };
}

/**
 * Normalize a document manifest row.
 */
export function normalizeManifestRow(row: ParsedRow): Record<string, unknown> {
  return {
    loanId: row['loan_id'] || null,
    documentStatus: row['document_status'] || null,
  };
}
