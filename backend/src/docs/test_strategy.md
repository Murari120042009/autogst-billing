# 🧪 AutoGST Test Strategy

## 1. Philosophy: The "Testing Trophy"
For an early-stage SaaS, **Integration Tests** offer the best ROI. They verify that your components (API, DB, Queue, Storage) work *together*.
-   **Unit Tests**: Use only for complex logic (e.g., auth, parsing algorithms).
-   **Integration Tests**: The bulk of your tests. Real HTTP requests, mocked external services.
-   **E2E Tests**: A few "smoke tests" to ensure the whole system boots and runs a critical path.

## 2. Recommended Stack (Node.js)
-   **Runner**: [Vitest](https://vitest.dev/) (Faster than Jest, native TS support).
-   **API Testing**: [Supertest](https://www.npmjs.com/package/supertest) (Test Express routes without starting server).
-   **Mocking HTTP**: [Nock](https://github.com/nock/nock) (Mock the Python OCR Service).
-   **Mocking DB**: Use a dedicated **Test Database** in Supabase or Docker. *Do not mock the DB client heavily; it makes tests brittle.*

## 3. Top 10 High-ROI Tests (Implement in Order)

### 🥇 Critical Path (Must Have)
1.  **POST /api/upload (Happy Path)**
    -   *Scenario*: User uploads valid PDF.
    -   *Checks*: Returns 200, File in MinIO/Mock, DB record created, Job in Redis Queue.
2.  **OCR Worker (Job Processing)**
    -   *Scenario*: Worker picks up job.
    -   *Checks*: Calls Python service (mocked via Nock), updates DB status to COMPLETED, creates Invoice Version.
3.  **Auth Middleware (Security)**
    -   *Scenario*: Request with invalid/expired JWT.
    -   *Checks*: Returns 401 Unauthorized. Access denied.
4.  **Transaction Rollback (Data Integrity)**
    -   *Scenario*: Upload succeeds, but DB insert fails (force failure).
    -   *Checks*: File is deleted from Disk/MinIO (cleanup logic works).
5.  **E2E Smoke Test**
    -   *Scenario*: Login -> Upload -> Polling Loop -> Result.
    -   *Checks*: The entire flow works on the deployed staging env.

### 🥈 Reliability & Edge Cases
6.  **Rate Limiting**
    -   *Scenario*: Send 100 requests in 1 second.
    -   *Checks*: Returns 429 Too Many Requests after limit.
7.  **Idempotency**
    -   *Scenario*: Send same upload request (with `Idempotency-Key`) twice.
    -   *Checks*: Second request returns cached 200 response, no new DB records.
8.  **Tenant Isolation**
    -   *Scenario*: User A tries to fetch User B's invoice.
    -   *Checks*: Returns 403 Forbidden or 404 Not Found.
9.  **Python OCR Validation**
    -   *Scenario*: Send malformed image/PDF to OCR service.
    -   *Checks*: Service returns 400, Worker handles error gracefully (marks job FAILED, doesn't crash).
10. **Queue Retry Logic**
    -   *Scenario*: OCR Service is "down" (Nock returns 500).
    -   *Checks*: Job goes to `delayed`/`retry` state in BullMQ, not `failed` immediately.

## 4. Folder Structure
```
backend/
  src/
  tests/
    setup.ts          # Global setup (env vars, mock resets)
    unit/
      auth.test.ts    # JWT logic
      utils.test.ts
    integration/
      upload.test.ts  # Supertest upload flows
      worker.test.ts  # Worker processing logic
      api.test.ts     # General API usage
    mocks/
      supabase.ts     # If needed
      minio.ts
```

## 5. What NOT to Test Yet (YAGNI)
-   **Standard Library**: Don't test if `fs.unlink` deletes a file. Assume Node works.
-   **Getters/Setters**: Don't test simple data access.
-   **UI Visuals**: Leave that to manual review or tools like Percy later.
-   **Config Files**: Don't test if `.env` is read correctly (app won't start if not).

## 6. Setup Command
```bash
npm install -D vitest supertest @types/supertest nock
```
