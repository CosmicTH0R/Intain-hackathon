import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { callClaude, updateRecommendationStatus } from '../ai/claude';
import { logAudit } from '../services/auditLogger';
import prisma from '../prisma/client';

const router = Router();

// POST /ai/explain-exception
router.post('/explain-exception', authenticate, async (req: AuthRequest, res: Response) => {
  const { exceptionId } = req.body;
  if (!exceptionId) return res.status(400).json({ error: 'exceptionId required' });

  const ex = await prisma.exception.findUnique({
    where: { id: exceptionId },
    include: { rule: true, loanRecord: true },
  });
  if (!ex) return res.status(404).json({ error: 'Exception not found' });

  const details = JSON.parse(ex.detailsJson);
  const loan = ex.loanRecord;

  const prompt = `A loan record failed validation. Explain the issue in plain language for a non-technical reviewer.

RULE VIOLATED: "${ex.rule.name}" — ${ex.rule.description}
SEVERITY: ${ex.severity}
LOAN ID: ${ex.loanId}
ERROR DETAILS: ${details.message}

KEY LOAN FIELDS:
- loan_type: ${loan.loanType}
- origination_date: ${loan.originationDate}
- maturity_date: ${loan.maturityDate}
- original_principal: $${loan.originalPrincipal}
- current_balance: $${loan.currentBalance}
- interest_rate: ${loan.interestRate}%
- payment_status: ${loan.paymentStatus}
- days_past_due: ${loan.daysPastDue}
- borrower_state: ${loan.borrowerState}
- last_updated_at: ${loan.lastUpdatedAt}

Explain: (1) what is wrong and why it matters, (2) what a correct value would look like.`;

  const result = await callClaude(prompt, 'explain-exception', exceptionId, ex.loanId);

  await logAudit({
    eventType: 'ai_recommendation_generated',
    entityType: 'LoanRecord',
    entityId: ex.loanRecordId,
    actor: req.user!.userId,
    details: { endpoint: 'explain-exception', recommendationId: result.recommendationId, loanId: ex.loanId },
  });

  res.json(result);
});

// POST /ai/suggest-correction
router.post('/suggest-correction', authenticate, async (req: AuthRequest, res: Response) => {
  const { exceptionId } = req.body;
  if (!exceptionId) return res.status(400).json({ error: 'exceptionId required' });

  const ex = await prisma.exception.findUnique({
    where: { id: exceptionId },
    include: { rule: true, loanRecord: true },
  });
  if (!ex) return res.status(404).json({ error: 'Exception not found' });

  const loan = ex.loanRecord;
  const details = JSON.parse(ex.detailsJson);

  const prompt = `Suggest a specific correction for this loan data validation failure.

RULE: "${ex.rule.name}" — ${ex.rule.description}
ERROR: ${details.message}
LOAN ID: ${ex.loanId}

RAW LOAN DATA:
${JSON.stringify(JSON.parse(loan.rawRowJson), null, 2)}

Provide:
1. The most likely correct value for the problematic field(s)
2. Your reasoning (e.g., "origination_date looks like MM/DD/YYYY was entered as DD/MM/YYYY")
3. Confidence level: High / Medium / Low
4. Suggested Action: [one-sentence actionable step for the reviewer]`;

  const result = await callClaude(prompt, 'suggest-correction', exceptionId, ex.loanId);

  await logAudit({
    eventType: 'ai_recommendation_generated',
    entityType: 'LoanRecord',
    entityId: ex.loanRecordId,
    actor: req.user!.userId,
    details: { endpoint: 'suggest-correction', recommendationId: result.recommendationId },
  });

  res.json(result);
});

// POST /ai/compare-conflict
router.post('/compare-conflict', authenticate, async (req: AuthRequest, res: Response) => {
  const { loanId } = req.body;
  if (!loanId) return res.status(400).json({ error: 'loanId required' });

  const loan = await prisma.loanRecord.findFirst({ where: { loanId } });
  const servicer = await prisma.servicerUpdate.findFirst({ where: { loanId }, orderBy: { createdAt: 'desc' } });

  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  if (!servicer) return res.status(404).json({ error: 'No servicer update found for this loan' });

  const loanData = JSON.parse(loan.rawRowJson);
  const servicerData = JSON.parse(servicer.rawRowJson);

  const prompt = `Two data sources report different values for the same loan. Recommend which source is more reliable.

LOAN ID: ${loanId}

LOAN TAPE VALUES:
- current_balance: ${loan.currentBalance}
- payment_status: ${loan.paymentStatus}
- days_past_due: ${loan.daysPastDue}
- last_payment_date: ${loan.lastPaymentDate}
- document_status: ${loan.documentStatus}
- last_updated_at: ${loan.lastUpdatedAt}

SERVICER UPDATE VALUES:
- current_balance: ${servicerData.current_balance || 'N/A'}
- payment_status: ${servicerData.payment_status || 'N/A'}
- days_past_due: ${servicerData.days_past_due || 'N/A'}
- last_payment_date: ${servicerData.last_payment_date || 'N/A'}
- document_status: ${servicerData.document_status || 'N/A'}
- last_updated_at: ${servicerData.last_updated_at || 'N/A'}

For each conflicting field: (1) which value is more reliable and why, (2) recommended action.`;

  const result = await callClaude(prompt, 'compare-conflict', undefined, loanId);

  await logAudit({
    eventType: 'ai_recommendation_generated',
    entityType: 'LoanRecord',
    entityId: loan.id,
    actor: req.user!.userId,
    details: { endpoint: 'compare-conflict', recommendationId: result.recommendationId, loanId },
  });

  res.json(result);
});

// POST /ai/draft-note
router.post('/draft-note', authenticate, async (req: AuthRequest, res: Response) => {
  const { exceptionId } = req.body;
  if (!exceptionId) return res.status(400).json({ error: 'exceptionId required' });

  const ex = await prisma.exception.findUnique({
    where: { id: exceptionId },
    include: { rule: true, loanRecord: true, reviewActions: { take: 5, orderBy: { timestamp: 'desc' } } },
  });
  if (!ex) return res.status(404).json({ error: 'Exception not found' });

  const details = JSON.parse(ex.detailsJson);

  const prompt = `Draft a professional reviewer note for this loan exception. The note will be saved in the audit trail.

LOAN ID: ${ex.loanId}
RULE VIOLATED: ${ex.rule.name} (${ex.rule.description})
SEVERITY: ${ex.severity}
ISSUE: ${details.message}
CURRENT STATUS: ${ex.status}
PREVIOUS COMMENTS: ${ex.reviewActions.map((a) => a.comment).filter(Boolean).join(' | ') || 'None'}

Write a concise reviewer note (2-3 sentences) that: describes the issue, states the recommended action, and notes any risk.`;

  const result = await callClaude(prompt, 'draft-note', exceptionId, ex.loanId);

  await logAudit({
    eventType: 'ai_recommendation_generated',
    entityType: 'Exception',
    entityId: ex.loanRecordId,
    actor: req.user!.userId,
    details: { endpoint: 'draft-note', recommendationId: result.recommendationId },
  });

  res.json(result);
});

// POST /ai/classify-severity
router.post('/classify-severity', authenticate, async (req: AuthRequest, res: Response) => {
  const { exceptionId } = req.body;
  if (!exceptionId) return res.status(400).json({ error: 'exceptionId required' });

  const ex = await prisma.exception.findUnique({
    where: { id: exceptionId },
    include: { rule: true, loanRecord: true },
  });
  if (!ex) return res.status(404).json({ error: 'Exception not found' });

  const details = JSON.parse(ex.detailsJson);

  const prompt = `Classify the severity of this loan data exception as low, medium, high, or critical. Provide reasoning.

RULE: ${ex.rule.name} — ${ex.rule.description}
ISSUE: ${details.message}
LOAN TYPE: ${ex.loanRecord.loanType}
ORIGINAL PRINCIPAL: $${ex.loanRecord.originalPrincipal}
PAYMENT STATUS: ${ex.loanRecord.paymentStatus}
DAYS PAST DUE: ${ex.loanRecord.daysPastDue}

Factors to consider: data integrity risk, downstream impact on reporting, financial exposure, regulatory implications.
Format: Severity: [low/medium/high/critical] — Reasoning: [2-3 sentences]`;

  const result = await callClaude(prompt, 'classify-severity', exceptionId, ex.loanId);

  await logAudit({
    eventType: 'ai_recommendation_generated',
    entityType: 'Exception',
    entityId: ex.loanRecordId,
    actor: req.user!.userId,
    details: { endpoint: 'classify-severity', recommendationId: result.recommendationId },
  });

  res.json(result);
});

// POST /ai/summarize-batch
router.post('/summarize-batch', authenticate, async (req: AuthRequest, res: Response) => {
  const { batchId } = req.body;

  const where = batchId ? { loanRecord: { importBatchId: batchId } } : {};
  const exceptions = await prisma.exception.findMany({
    where,
    include: { rule: true },
    take: 200,
  });

  if (exceptions.length === 0) {
    return res.json({
      recommendationId: 'no-data',
      responseText: 'No exceptions found for this batch.',
      suggestedAction: null,
    });
  }

  const bySeverity: Record<string, number> = {};
  const byRule: Record<string, number> = {};
  exceptions.forEach((ex) => {
    bySeverity[ex.severity] = (bySeverity[ex.severity] ?? 0) + 1;
    byRule[ex.rule.name] = (byRule[ex.rule.name] ?? 0) + 1;
  });

  const topRules = Object.entries(byRule)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rule, count]) => `${rule}: ${count}`)
    .join(', ');

  const prompt = `Summarize this batch of loan data validation exceptions for a data quality report.

TOTAL EXCEPTIONS: ${exceptions.length}
BY SEVERITY: ${JSON.stringify(bySeverity)}
TOP RULES TRIGGERED: ${topRules}

Provide:
1. A 2-3 sentence executive summary of the data quality issues
2. The most critical issue to address first
3. Overall data quality assessment (Good/Fair/Poor)
4. Top 2-3 recommended actions`;

  const result = await callClaude(prompt, 'summarize-batch', undefined, undefined);

  res.json({ ...result, stats: { total: exceptions.length, bySeverity, byRule } });
});

// POST /ai/generate-rule
router.post('/generate-rule', authenticate, async (req: AuthRequest, res: Response) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'description required' });

  const prompt = `A loan data quality analyst describes a new validation rule in natural language. Generate a formal rule specification.

USER DESCRIPTION: "${description}"

Available field names: loan_id, borrower_id, loan_type, origination_date, maturity_date, original_principal, current_balance, interest_rate, term_months, borrower_state, loan_purpose, credit_grade, employment_length, income_band, payment_status, days_past_due, servicer_name, last_payment_date, last_updated_at, document_status, source_system

Generate:
1. Rule name (snake_case, descriptive)
2. Description (one sentence)
3. Type (completeness | format | range | consistency | uniqueness | cross_file | timeliness | anomaly | enum)
4. Severity (low | medium | high | critical)
5. Config JSON (thresholds, valid values, etc.)
6. Pseudocode for the check logic (3-5 lines)
7. Example of a PASSING record
8. Example of a FAILING record`;

  const result = await callClaude(prompt, 'generate-rule', undefined, undefined);
  res.json(result);
});

// POST /ai/recommendations/:id/decision — accept/reject/edit
router.post('/recommendations/:id/decision', authenticate, async (req: AuthRequest, res: Response) => {
  const { status, editedResponse } = req.body;
  const validStatuses = ['accepted', 'rejected', 'edited'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  const rec = await prisma.aIRecommendation.findUnique({ where: { id: req.params.id } });
  if (!rec) return res.status(404).json({ error: 'Recommendation not found' });

  await updateRecommendationStatus(req.params.id, status, editedResponse);

  await logAudit({
    eventType: 'reviewer_comment_added',
    entityType: 'AIRecommendation',
    entityId: rec.exceptionId || rec.loanId || req.params.id,
    actor: req.user!.userId,
    details: { recommendationId: req.params.id, decision: status, endpoint: rec.endpoint },
  });

  res.json({ message: `Recommendation ${status}`, id: req.params.id });
});

// GET /ai/recommendations/:exceptionId
router.get('/recommendations/exception/:exceptionId', authenticate, async (req: AuthRequest, res: Response) => {
  const recs = await prisma.aIRecommendation.findMany({
    where: { exceptionId: req.params.exceptionId },
    orderBy: { timestamp: 'desc' },
  });
  res.json(recs);
});

export default router;
