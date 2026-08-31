# Architecture — Loan Data Verification Copilot

## System Overview

A three-tier web application: React SPA frontend → Express REST API backend → SQLite database, with server-side Anthropic Claude integration.

```
Browser (React + Vite)
    ↓ HTTPS / Bearer JWT
Express API (Node.js + TypeScript)
    ├── CSV Parser & Normalizer
    ├── Validation Engine (16 rules)
    ├── AI Service (Claude, server-side only)
    ├── Audit Logger
    └── SHA-256 Hashing
    ↓ Prisma ORM
SQLite DB (PostgreSQL-compatible schema)
```

---

## Data Model

### Core Tables

| Table | Purpose |
|---|---|
| `User` | 3 roles: data_operator, reviewer, data_consumer |
| `ImportBatch` | One per uploaded file; tracks total/imported/failed rows |
| `FailedRowLog` | Per-row failure records for lineage |
| `LoanRecord` | Normalized loan data + raw JSON for lineage |
| `ServicerUpdate` | Second-source file records |
| `DocumentManifest` | Document availability per loan |
| `ValidationRule` | 16 rules loaded from DB (seeded from validation_rules.json) |
| `Exception` | One per rule violation; status: open/approved/rejected/corrected |
| `ReviewAction` | Every reviewer action (comment/approve/reject/edit) |
| `AIRecommendation` | Every AI call: prompt + model + response + status |
| `VerifiedLoanRecord` | Immutable canonical record with SHA-256 hash |
| `AuditLogEntry` | All 11 event types with actor + timestamp |

### Key Relationships
- `LoanRecord` → many `Exception` → many `ReviewAction`
- `Exception` → many `AIRecommendation`
- `LoanRecord` → one `VerifiedLoanRecord` (immutable)
- All actions → `AuditLogEntry`

---

## API Design

RESTful API with JWT Bearer auth. All list endpoints support pagination via `?page=N&limit=N`. Role-based access enforced per route.

### Route Organization
- `/auth` — login, /me
- `/upload` — 3 CSV endpoints + history + failed rows
- `/loans` — list + single loan with all relations
- `/exceptions` — list/filter/search, review actions, comments, field edits
- `/ai` — 7 AI endpoints + recommendation decision
- `/verified-loans` — create + list + single + verify-hash + export
- `/audit` — per-loan timeline + general log
- `/summary` — aggregate stats + data quality score

---

## Validation Engine Design

Rules are loaded from `validation_rules.json` (thresholds configurable without code changes). Each rule is a standalone function in `/validators/rules/`. The engine orchestrator (`engine.ts`) runs all 16 rules against a batch of loan records.

### Rule Categories
| Type | Rules |
|---|---|
| Completeness | required_fields |
| Format | valid_date_formats |
| Range | no_negative_balance, interest_rate_range |
| Consistency | maturity_after_origination, balance_leq_principal, payment_status_vs_dpd, closed_with_balance |
| Enum | valid_payment_status, valid_state_code |
| Uniqueness | duplicate_loan_id, duplicate_borrower_combo |
| Cross-file | document_status_check, servicer_conflict |
| Timeliness | stale_record |
| Anomaly | repeated_borrower |

### Configurable Thresholds (validation_rules.json)
- Interest rate: 0–25% (configurable)
- Stale record: 90 days (configurable)
- Repeated borrower: 3+ occurrences (configurable)

---

## AI Feature Design

All Claude calls are **server-side only** (API key never exposed to client). Every call is logged to `AIRecommendation` with: prompt text, model name, timestamp, raw response, suggested action.

### AI Controls (Hard Requirements)
1. AI output is shown in a visually distinct panel (purple gradient border)
2. Reviewer must click Accept / Edit / Reject — no auto-apply
3. Every decision updates `AIRecommendation.status`
4. Every AI call is logged to `AuditLogEntry`
5. Prompt, model name, and timestamp are visible in the UI

### Mock Mode
If `ANTHROPIC_API_KEY` is not set or is a placeholder, the app runs in mock mode with clearly labeled simulated responses. All logging still works identically.

---

## Audit Trail Design

`AuditLogEntry` records 11 event types:
`file_uploaded`, `loan_record_imported`, `validation_executed`, `exception_created`, `ai_recommendation_generated`, `reviewer_comment_added`, `field_edited`, `loan_approved`, `loan_rejected`, `verified_record_created`, `verified_record_exported`

Each entry: `eventType`, `entityType`, `entityId`, `actor` (userId), `timestamp`, `detailsJson`.

`GET /audit/:loanId` queries by all record IDs for that loan, returning a complete chronological lineage from raw CSV → verified record.

---

## Verified Record Hashing

SHA-256 hash is computed over a deterministic canonical JSON (keys sorted alphabetically). This means:
- Same data → same hash, every time
- Any field change → hash mismatch
- Verify via: `GET /verified-loans/:id/verify-hash`

---

## Data Quality Score Formula

```
score = (verified_count / total_loans) × 100 × (1 − open_exception_rate)
open_exception_rate = open_exceptions / max(total_loans, 1)
```

Clamped to [0, 100]. Rationale: rewards verified records while penalizing unresolved exceptions.

---

## Trade-offs Made

| Decision | Rationale |
|---|---|
| SQLite over PostgreSQL | Zero-setup for local judging; Prisma schema is Postgres-compatible, just change `DATABASE_URL` |
| In-memory multer | Avoids disk I/O for uploads; acceptable for hackathon CSV sizes |
| Simple JWT auth | Per spec: "no production-grade security required" |
| Mock AI mode | Judges without an API key can still see the full UI flow |
| Single-tenant | Multi-tenancy is out of scope; all users share the same dataset |
