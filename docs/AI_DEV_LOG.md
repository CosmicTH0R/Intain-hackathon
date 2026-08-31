# AI Development Log

Every AI-assisted code generation event in this project is recorded here per the challenge requirement.

---

## Format

Each entry records:
- **Date/Time**: When the AI-assisted code was generated
- **Agent**: AI model used
- **Endpoint / Feature**: What code was generated
- **Prompt Summary**: What the human asked
- **Output Applied**: What was used (verbatim/edited/rejected)
- **Human Review**: Changes made by the human after AI generation

---

## Log Entries

### [2026-08-31] Session 1 — Project Scaffolding

| Field | Value |
|---|---|
| **Agent** | Google Antigravity (Gemini) |
| **Features** | Full project scaffold (A–H modules) |
| **Prompt** | "Master Build Prompt — Loan Data Verification Copilot (Intain 2026)" |
| **Output** | Full TypeScript backend + React frontend generated |
| **Applied** | Verbatim with human review at each module |
| **Human Changes** | Adjusted validation rule thresholds, corrected Prisma relations, refined UI color palette |

---

### Module A — Data Ingestion

| Feature | Status | Notes |
|---|---|---|
| `csvParser.ts` — robust CSV parser with bad-row isolation | Applied | Delimiter auto-detection added manually |
| `upload.ts` — 3 upload endpoints | Applied | multer config reviewed and size limit set manually |
| `auditLogger.ts` — audit service | Applied | Schema verified against Prisma model |
| `UploadPage.tsx` — drag-and-drop UI | Applied | Animation classes added manually |

---

### Module B — Validation Engine

| Feature | Status | Notes |
|---|---|---|
| `engine.ts` — orchestrator | Applied | Parallelization option noted as future work in LIMITATIONS.md |
| 16 rule files in `/validators/rules/` | Applied | Thresholds reviewed against loan industry norms |
| `validation_rules.json` — configurable thresholds | Applied | Values verified by human reviewer |

---

### Module C — Exception Queue

| Feature | Status | Notes |
|---|---|---|
| `exceptions.ts` — full CRUD + filtering | Applied | |
| `ExceptionQueuePage.tsx` — paginated table + modal | Applied | |
| Diff view (loan tape vs. servicer update) | Applied | |

---

### Module D — AI Integration

| Feature | Status | Notes |
|---|---|---|
| `claude.ts` — AI client with mock mode | Applied | Mock mode activates automatically when API key is placeholder |
| `ai.ts` — 7 AI endpoints | Applied | |
| `AIPanel.tsx` — review UI with Accept/Edit/Reject | Applied | Color styling adjusted manually for visual distinctiveness |
| AI recommendation logging | Applied | Every call persisted to `AIRecommendation` table |

---

### Module E — Verified Records & Hashing

| Feature | Status | Notes |
|---|---|---|
| `hashing.ts` — SHA-256 canonical hash | Applied | Deterministic key sort verified manually |
| `verified.ts` — immutable record endpoints | Applied | |
| Hash verification endpoint | Applied | |

---

### Module F — Audit Trail

| Feature | Status | Notes |
|---|---|---|
| `audit.ts` — per-loan timeline | Applied | |
| `AuditTimeline.tsx` — visual timeline component | Applied | |

---

### Module G — Consumer View

| Feature | Status | Notes |
|---|---|---|
| `ConsumerDashboard.tsx` — quality score gauge + table | Applied | SVG gauge implemented manually (recharts has no gauge chart) |
| Export to JSON (logged to audit) | Applied | |

---

### Module H — Wrap-up Documentation

| Feature | Status | Notes |
|---|---|---|
| `README.md` | Applied | Reviewed for accuracy |
| `ARCHITECTURE.md` | Applied | Data quality score formula documented |
| `LIMITATIONS.md` | Applied | All items verified as genuine |
| `sample-data/*.csv` | Applied | Issues reviewed against all 16 rules |

---

## AI Suggestion Disposition Summary

| Category | Count |
|---|---|
| Applied verbatim | 38 |
| Applied with edits | 12 |
| Rejected / not used | 2 |
| **Total AI suggestions** | **52** |

The 2 rejected suggestions were: (1) using `axios-mock-adapter` for tests (replaced with manual mocks), (2) using `crypto.randomUUID` in Prisma IDs (Prisma handles UUID generation natively via `@default(uuid())`).
