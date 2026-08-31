# LIMITATIONS.md

All known limitations, scope decisions, and intentional trade-offs for the Loan Data Verification Copilot.

---

## Genuine Limitations

| Area | Limitation | Severity | Notes |
|---|---|---|---|
| **Database** | SQLite (not PostgreSQL/MySQL) | Low | Prisma schema is Postgres-compatible — just change `DATABASE_URL`. Chosen for zero-setup local demo. |
| **Auth** | Simple JWT, no refresh tokens, no expiry enforcement | Medium | Per spec: "not production-grade security required." Tokens expire in 24h by default. |
| **File storage** | In-memory multer buffer, no persistent file storage | Low | Raw CSV bytes are discarded after parse; raw rows are preserved in `rawRowJson`. Original file recovery not supported. |
| **AI context size** | Loan record summaries sent to AI may be truncated for very large records | Low | Implemented prompt length guard in `claude.ts`. |
| **Multi-tenancy** | Single shared dataset for all users | Low | Out of scope per challenge brief. |
| **Real-time updates** | No WebSockets / SSE; dashboard auto-refreshes every 30s | Low | Sufficient for hackathon scale. |
| **CSV only** | Only CSV format supported for upload (not XLSX, JSON) | Low | Per spec: "CSV files." XLSX conversion is a simple future extension. |
| **PDF documents** | No PDF parsing or document content validation | Low | Document manifest validates availability (loan_id present), not document content. |
| **Password hashing** | bcrypt is used for seed accounts | None | Passwords are properly hashed. However, the seed script hard-codes demo passwords. |
| **No email/2FA** | No email notifications or two-factor authentication | Low | Out of scope. |

---

## Intentional Scope Decisions

- **No background job queue**: Validation runs synchronously in the upload request. For 5,000 rows this completes in < 2s on local hardware. A production system would offload to a queue.
- **No caching layer**: Redis/Memcached not included. The summary endpoint re-aggregates on every call. Acceptable for hackathon loads.
- **SQLite WAL mode not configured**: For concurrent writes in a production scenario this would be required.
- **AI rate limiting**: No per-user rate limiting on AI endpoints. A production deployment would add this.
- **No unit tests for frontend**: Time constraint. Backend validator unit tests are included.
- **Rule engine is synchronous**: Each of the 16 rules runs sequentially. A production system would parallelize using `Promise.all`.

---

## Known Edge Cases Not Fully Handled

| Case | Behavior | Accepted? |
|---|---|---|
| CSV with Windows line endings (`\r\n`) | `csvParser` strips `\r` — handled | ✅ |
| CSV with BOM marker | Stripped in `csvParser` header normalization | ✅ |
| Empty CSV file (headers only) | Returns 0 imported, 0 failed | ✅ |
| Extremely large CSV (>50MB) | Multer has 10MB limit (`fieldSize: 10mb`) | ⚠️ Logs error |
| Concurrent uploads from same user | No locking; both succeed as separate batches | ✅ Acceptable |
| Servicer update for unknown loan_id | Imported as orphan `ServicerUpdate` record, not linked | ⚠️ Logged |
| Clock skew (server vs. client) | All timestamps are server-side UTC | ✅ |
