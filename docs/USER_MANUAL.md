# User Manual — Loan Data Verification Copilot

Welcome to the Loan Data Verification Copilot! This guide explains how to use the system depending on your role.

---

## 1. Data Operator Role
**Focus**: Uploading and ingesting loan data files.

### Logging In
- Use credentials: `operator@demo.com` / `operator123`
- You will be directed to the **Data Operator Dashboard**.

### Uploading Files
1. Go to the **Upload New Batch** page.
2. The system accepts 3 types of files:
   - **Loan Tape**: The primary dataset of loans (e.g., `loan_tape.csv`).
   - **Servicer Update**: Secondary file with updated fields from a loan servicer (e.g., `servicer_update.csv`).
   - **Document Manifest**: Lists whether documents are available for a given loan (e.g., `document_manifest.csv`).
3. Drag and drop your file into the respective drop zone.
4. The system immediately parses the CSV, runs the 16 validation rules, and generates exceptions for any invalid data.
5. Review the **Import Summary** to see how many rows succeeded and how many failed validation.

---

## 2. Reviewer Role
**Focus**: Resolving exceptions, utilizing AI, and approving loans.

### Logging In
- Use credentials: `reviewer@demo.com` / `reviewer123`
- You will be directed to the **Reviewer Dashboard**.

### Managing the Exception Queue
1. The **Exception Queue** shows a prioritized list of all validation failures across the dataset.
2. Click on any exception to view its details.
3. You can resolve an exception in several ways:
   - **Manual Edit**: Correct the data field manually based on the context.
   - **Approve Exception**: Sometimes exceptions are acceptable (e.g., business rules allow an exception). You can leave a comment and mark it approved.
   - **Reject Loan**: If the data is completely unsalvageable, you can reject the loan from the pool.

### Using the AI Assistant
For complex exceptions (e.g., a servicer conflict where two files report different outstanding balances), you can ask the AI for help:
1. Inside the exception modal, click on the **AI Assistant** tab (distinctive purple border).
2. Ask the AI to:
   - **Explain** why the exception triggered.
   - **Compare** conflicting fields.
   - **Suggest a correction** to the data.
   - **Draft a note** for the audit log.
3. **Mandatory Human Review**: The AI will provide a suggestion, but it will *never* apply it automatically. You must manually click **Accept**, **Edit**, or **Reject** on the AI's proposal.

---

## 3. Data Consumer / Auditor Role
**Focus**: Viewing clean, verified data and auditing the lineage.

### Logging In
- Use credentials: `consumer@demo.com` / `consumer123`
- You will be directed to the **Data Consumer Dashboard**.

### Accessing Verified Data
1. The Consumer dashboard only shows **Verified Records**. A record only becomes verified when it has zero open exceptions and has been explicitly approved.
2. You can view the **Data Quality Score** which indicates the health of the entire loan pool.

### Reviewing the Audit Trail
1. Transparency is a core feature. Click on any verified loan to view its **Audit Timeline**.
2. The timeline shows every single event that happened to this loan record:
   - When it was uploaded.
   - Which validation rules it failed.
   - What AI recommendations were generated.
   - Which human Reviewer approved the AI recommendation or edited a field.
   - The final timestamp of when it was verified.
3. Every verified record has a **SHA-256 Hash**. This hash is a deterministic fingerprint of the data. If a single byte of the verified loan changes, the hash breaks, ensuring data immutability.

### Exporting Data
1. Click **Export JSON** to download the verified loan pool data.
2. The export action itself is logged in the audit trail.
