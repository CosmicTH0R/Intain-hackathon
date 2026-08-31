# Loan Data Verification Copilot
**Intain Campus FinTech Challenge 2026 — Full Stack Track**

> An AI-assisted full-stack console that turns messy loan records into validated, traceable, trusted data.

---

## 🚀 Quick Start (Local — No Docker Required)

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Clone & Install

```bash
git clone <your-repo>
cd loan-verification-copilot

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY if you have one (optional, app works in mock mode without it)
```

### 3. Initialize Database & Seed

```bash
cd backend
npx prisma db push         # Create SQLite DB from schema
npm run db:seed            # Seed 3 users + 16 validation rules
```

### 4. Run Development Servers

Open **two terminals**:

```bash
# Terminal 1 — Backend (http://localhost:3001)
cd backend
npm run dev

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 🔑 Test Credentials (All Roles)

| Role | Email | Password | What they can do |
|---|---|---|---|
| **Data Operator** | `operator@demo.com` | `operator123` | Upload CSVs, view import summaries |
| **Reviewer** | `reviewer@demo.com` | `reviewer123` | Review exceptions, use AI, approve loans |
| **Data Consumer** | `consumer@demo.com` | `consumer123` | View verified records, export, audit trail |

---

## 📁 Project Structure

```
loan-verification-copilot/
├── frontend/          # React + Vite + TypeScript + Tailwind CSS
├── backend/           # Node.js + Express + TypeScript + Prisma (SQLite)
├── sample-data/       # Sample CSVs with intentional data issues
├── docs/              # Documentation files
│   ├── ARCHITECTURE.md
│   ├── AI_DEV_LOG.md
│   ├── USER_MANUAL.md
│   └── LIMITATIONS.md
├── docker-compose.yml
└── README.md
```

---

## 📊 Sample Data Files

Upload these in order for best validation results:

| File | Purpose | Issues Embedded |
|---|---|---|
| `sample-data/document_manifest.csv` | Document availability | — |
| `sample-data/servicer_update.csv` | Servicer field updates | Conflicts with loan tape |
| `sample-data/loan_tape.csv` | Primary 50-row dataset | All 16 intentional issues |

---

## 🔌 API Endpoints (Module H)

All endpoints require `Authorization: Bearer <token>` header.

```bash
# Summary stats
curl http://localhost:3001/summary -H "Authorization: Bearer $TOKEN"

# All loans (paginated)
curl "http://localhost:3001/loans?page=1&limit=10" -H "Authorization: Bearer $TOKEN"

# Single loan
curl http://localhost:3001/loans/:id -H "Authorization: Bearer $TOKEN"

# All exceptions
curl "http://localhost:3001/exceptions?severity=critical" -H "Authorization: Bearer $TOKEN"

# Verified loans
curl http://localhost:3001/verified-loans -H "Authorization: Bearer $TOKEN"

# Single verified loan
curl http://localhost:3001/verified-loans/:id -H "Authorization: Bearer $TOKEN"

# Loan audit trail
curl http://localhost:3001/audit/LN-001 -H "Authorization: Bearer $TOKEN"

# Health check
curl http://localhost:3001/health
```

---

## 🤖 AI Features (Module D)

All AI calls require an `ANTHROPIC_API_KEY`. Without one, the app runs in **mock mode** with simulated responses (fully functional for demo).

| Endpoint | What it does |
|---|---|
| `POST /ai/explain-exception` | Explains why a record failed validation |
| `POST /ai/suggest-correction` | Suggests likely field correction |
| `POST /ai/compare-conflict` | Compares loan tape vs servicer update |
| `POST /ai/draft-note` | Drafts reviewer note |
| `POST /ai/classify-severity` | Classifies exception severity with reasoning |
| `POST /ai/summarize-batch` | Batch exception summary |
| `POST /ai/generate-rule` | Generates rule from natural language |

---

## 🧪 Running Tests

```bash
cd backend
npm test
```

---

## 🌐 Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite path |
| `JWT_SECRET` | Yes | fallback | JWT signing key |
| `ANTHROPIC_API_KEY` | No | mock mode | Claude API key |
| `PORT` | No | `3001` | Backend port |
| `FRONTEND_URL` | No | `http://localhost:5173` | CORS allowed origin |
