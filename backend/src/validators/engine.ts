import prisma from '../prisma/client';
import validationRulesConfig from '../../validation_rules.json';
import { checkRequiredFields } from './rules/requiredFields';
import { checkValidDates } from './rules/validDates';
import { checkMaturityAfterOrigination } from './rules/maturityAfterOrigination';
import { checkNoNegativeBalance } from './rules/noNegativeBalance';
import { checkBalanceLeqPrincipal } from './rules/balanceLeqPrincipal';
import { checkInterestRateRange } from './rules/interestRateRange';
import { checkValidPaymentStatus } from './rules/validPaymentStatus';
import { checkPaymentStatusVsDpd } from './rules/paymentStatusVsDpd';
import { checkDocumentStatus } from './rules/documentStatus';
import { findDuplicateLoanIds, checkDuplicateLoanId } from './rules/duplicateLoanId';
import { findDuplicateBorrowerCombos, checkDuplicateBorrowerCombo } from './rules/duplicateBorrowerCombo';
import { checkValidStateCode } from './rules/validStateCode';
import { checkStaleRecord } from './rules/staleRecord';
import { checkServicerConflicts } from './rules/servicerConflicts';
import { checkClosedWithBalance } from './rules/closedWithBalance';
import { findRepeatedBorrowers, checkRepeatedBorrower } from './rules/repeatedBorrower';

export interface ValidationException {
  loanId: string;
  loanRecordId: string;
  ruleId: string;
  ruleName: string;
  severity: string;
  details: Record<string, unknown>;
}

function getRuleConfig(name: string): Record<string, unknown> {
  const rule = (validationRulesConfig.rules as Array<Record<string, unknown>>).find(
    (r) => r['name'] === name
  );
  return rule ?? {};
}

/**
 * Run all 16 validation rules against a batch of normalized loan records.
 * Returns all exceptions found. Each exception references the rule ID from DB.
 */
export async function runValidationEngine(
  loanRecords: Array<{ id: string; loanId: string; data: Record<string, unknown> }>,
  servicerMap: Map<string, Record<string, unknown>>,
  manifestMap: Map<string, string>
): Promise<ValidationException[]> {
  const exceptions: ValidationException[] = [];

  // Load rule IDs from DB (keyed by name)
  const dbRules = await prisma.validationRule.findMany({ where: { isActive: true } });
  const ruleMap = new Map(dbRules.map((r) => [r.name, r]));

  // Batch-level pre-computations
  const allRows = loanRecords.map((lr) => lr.data);
  const duplicateLoanIdMap = findDuplicateLoanIds(allRows);
  const duplicateBorrowerMap = findDuplicateBorrowerCombos(allRows);
  const repeatedBorrowerCfg = getRuleConfig('repeated_borrower') as { threshold: number };
  const repeatedBorrowerMap = findRepeatedBorrowers(allRows, repeatedBorrowerCfg);

  for (const record of loanRecords) {
    const row = record.data;
    const loanId = record.loanId;
    const recordId = record.id;

    const addException = (ruleName: string, message: string, extraDetails?: Record<string, unknown>) => {
      const rule = ruleMap.get(ruleName);
      if (!rule) return;
      exceptions.push({
        loanId,
        loanRecordId: recordId,
        ruleId: rule.id,
        ruleName,
        severity: rule.severity,
        details: { message, loanId, ...extraDetails },
      });
    };

    // Rule 1: Required fields
    {
      const cfg = getRuleConfig('required_fields') as { requiredFields: string[] };
      const err = checkRequiredFields(row, cfg);
      if (err) addException('required_fields', err);
    }

    // Rule 2: Valid dates
    {
      const cfg = getRuleConfig('valid_date_formats') as { dateFields: string[] };
      const err = checkValidDates(row, cfg);
      if (err) addException('valid_date_formats', err);
    }

    // Rule 3: Maturity after origination
    {
      const err = checkMaturityAfterOrigination(row);
      if (err) addException('maturity_after_origination', err);
    }

    // Rule 4: No negative balance
    {
      const err = checkNoNegativeBalance(row);
      if (err) addException('no_negative_balance', err);
    }

    // Rule 5: Balance ≤ principal
    {
      const err = checkBalanceLeqPrincipal(row);
      if (err) addException('balance_leq_principal', err);
    }

    // Rule 6: Interest rate range
    {
      const cfg = getRuleConfig('interest_rate_range') as { min: number; max: number };
      const err = checkInterestRateRange(row, cfg);
      if (err) addException('interest_rate_range', err);
    }

    // Rule 7: Valid payment status
    {
      const cfg = getRuleConfig('valid_payment_status') as { validValues: string[] };
      const err = checkValidPaymentStatus(row, cfg);
      if (err) addException('valid_payment_status', err);
    }

    // Rule 8: Payment status vs DPD
    {
      const cfg = getRuleConfig('payment_status_vs_dpd') as { currentMaxDpd: number };
      const err = checkPaymentStatusVsDpd(row, cfg);
      if (err) addException('payment_status_vs_dpd', err);
    }

    // Rule 9: Document status cross-check
    {
      const err = checkDocumentStatus(row, manifestMap);
      if (err) addException('document_status_check', err);
    }

    // Rule 10: Duplicate loan_id
    {
      const err = checkDuplicateLoanId(loanId, duplicateLoanIdMap);
      if (err) addException('duplicate_loan_id', err);
    }

    // Rule 11: Duplicate borrower combo
    {
      const err = checkDuplicateBorrowerCombo(row, duplicateBorrowerMap);
      if (err) addException('duplicate_borrower_combo', err);
    }

    // Rule 12: Valid state code
    {
      const err = checkValidStateCode(row);
      if (err) addException('valid_state_code', err);
    }

    // Rule 13: Stale record
    {
      const cfg = getRuleConfig('stale_record') as { maxAgeDays: number };
      const err = checkStaleRecord(row, cfg);
      if (err) addException('stale_record', err);
    }

    // Rule 14: Servicer conflicts
    {
      const servicerRow = servicerMap.get(loanId) ?? null;
      const cfg = getRuleConfig('servicer_conflict') as { fieldsToCompare: string[] };
      const conflicts = checkServicerConflicts(row, servicerRow, cfg);
      if (conflicts.length > 0) {
        addException('servicer_conflict', `${conflicts.length} field conflict(s) with servicer update`, {
          conflicts,
        });
      }
    }

    // Rule 15: Closed with balance
    {
      const err = checkClosedWithBalance(row);
      if (err) addException('closed_with_balance', err);
    }

    // Rule 16: Repeated borrower
    {
      const err = checkRepeatedBorrower(row, repeatedBorrowerMap, repeatedBorrowerCfg);
      if (err) addException('repeated_borrower', err);
    }
  }

  return exceptions;
}

/**
 * Persist exceptions to the database.
 */
export async function persistExceptions(exceptions: ValidationException[]): Promise<void> {
  await prisma.exception.createMany({
    data: exceptions.map((ex) => ({
      loanId: ex.loanId,
      loanRecordId: ex.loanRecordId,
      ruleId: ex.ruleId,
      severity: ex.severity,
      status: 'open',
      detailsJson: JSON.stringify(ex.details),
    })),
  });
}
