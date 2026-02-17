# 🕵️ Final System Connection Audit

**Date:** 2026-02-17
**Status:** 🚨 CRITICAL GAPS FOUND

---

## 🚨 Broken Connections (Must Fix Immediately)

### 1. Row-Level Security (RLS) is Ghostware
*   **Gap**: While `invoices.ts` filters by `business_id` in application code, there are **ZERO** RLS policies in the database (`backend/src/db`).
*   **Risk**: If a developer forgets `.eq('business_id', ...)` in a new endpoint, data leaks instantly.
*   **Fix**: Apply `CREATE POLICY` statements to `invoices`, `invoice_versions`, `files`, `invoice_ocr_jobs`.

### 2. Rate Limiting is Unplugged
*   **Gap**: `backend/src/middleware/rateLimit.ts` defines robust limits (`uploadLimiter`, `authLimiter`), but they are **NEVER MOUNTED** in `index.ts` or `api/upload.ts`.
*   **Risk**: Trivial DDoS or brute-force attacks.
*   **Fix**: Add `app.use(apiLimiter)` in `index.ts` and `router.post('/', uploadLimiter, ...)` in `upload.ts`.

### 3. Idempotency is Dead Code
*   **Gap**: `backend/src/middleware/idempotency.ts` logic is sound but **NEVER USED**.
*   **Risk**: Double-billing or duplicate invoice processing on network retries.
*   **Fix**: Mount `idempotency` middleware on `POST /api/upload`.

---

## ⚠️ Weak Connections (High Risk)

### 4. Queue Has No Retry Strategy
*   **Gap**: `ocrQueue.ts` initializes with defaults. BullMQ defaults to **0 retries**.
*   **Risk**: A 1-second network blip contacting the Python service will permanently fail the job.
*   **Fix**: Configure `{ defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } } }`.

### 5. RPC Blindly Trusts Inputs
*   **Gap**: `upload_invoice_meta` accepts `p_business_id` and inserts it. It does not verify that `p_user_id` actually belongs to `p_business_id` (though `upload.ts` tries to ensure this).
*   **Fix**: Add a check inside the PL/PGSQL function or rely on strict RLS.

### 6. Orphaned File Cleanup is Optimistic
*   **Gap**: If the DB transaction fails, `upload.ts` *tries* to delete the file from MinIO. If that network call fails, the file is orphaned forever.
*   **Fix**: Acceptable for MVP. Real fix needs a "Sweeper Cron".

---

## 🟡 Likely Missing Safeguards

*   **Python Service Traceability**: The Python service logs, but does it send logs to a centralized place? Currently, they just go to stdout. If the worker fails, you have to verify Python logs manually.
*   **Database Migrations**: No `migrations` runner is set up (e.g., `db-migrate` or Supabase CLI in CI). Schema changes are manual/adhoc.

---

## 🧪 Recommended Verification Tests

1.  **The "Forgot Filter" Test**: Create a test route *without* `.eq('business_id')` and verify RLS blocks access (currently this would FAIL/Leak).
2.  **The "Spam Upload" Test**: Fire 50 requests in 1 second to `/api/upload`. Verify `429 Too Many Requests` (currently this would PASS/Crash).
3.  **The "Kill Python" Test**: Kill the Python container, trigger a job. Restart Python. Verify job retries and succeeds (currently this would FAIL).

---

## 🚀 Next Highest-ROI Fix

**Fix Criticals #1, #2, and #3 in one go.**
They are just configuration/mounting changes but provide massive security/stability value.
