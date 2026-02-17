# 🏁 AutoGST Billing: Launch Readiness Risk Assessment

**Date:** 2026-02-17
**Version:** v1.0-RC1

---

## 🚨 Must Fix Before Public Launch (Critical Blockers)

1.  **Missing Reverse Proxy (HTTPS/SSL)**
    *   **Risk**: High (Security)
    *   **Issue**: The Node.js app listens on HTTP (`4000`). Direct exposure captures traffic in plain text.
    *   **Fix**: Put **Nginx**, **Caddy**, or **AWS ALB** in front to terminate SSL/TLS. Do *not* run `node dist/index.js` exposed to the public internet.

2.  **Row-Level Security (RLS) Verification**
    *   **Risk**: Critical (Data Leak)
    *   **Issue**: We implemented application-level filtering (`.eq('business_id', ...)`) in `invoices.ts` and `jobs.ts`. If a developer forgets this filter in a future endpoint, data leaks.
    *   **Fix**: Ensure `ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;` is executed in Supabase and policies are rigorous. Application logic should be a *backup*, not the *only* defense.

3.  **Production Secrets Management**
    *   **Risk**: High (Compromise)
    *   **Issue**: `.env` files are fine for local, but for production (Docker), pass secrets via your orchestrator (Docker Swarm Secrets, AWS Parameter Store, or proper Environment Injection). Ensure `SUPABASE_SERVICE_ROLE_KEY` is never leaked to client-side code.

---

## ⚠️ Acceptable Risks for Private Beta (manageable)

1.  **No Automated "Orphaned File" Cleanup**
    *   **Risk**: Medium (Cost)
    *   **Context**: If an upload succeeds but the DB transaction fails (rare due to RPC), files might linger in MinIO.
    *   **Mitigation**: Accept the slight storage cost for Beta. Implement the "Sweeper Cron" in Phase 2.

2.  **Single Worker Instance**
    *   **Risk**: Medium (Availability)
    *   **Context**: We have one OCR worker container. If it crashes, jobs queue up until restart.
    *   **Mitigation**: BullMQ persists jobs in Redis. They won't be lost, just delayed. Acceptable for Beta.

3.  **Database Backups**
    *   **Risk**: High (Data Loss)
    *   **Context**: Assuming Supabase handles automated backups.
    *   **Action**: Confirm Supabase Point-in-Time Recovery (PITR) is enabled for the project.

---

## 🟡 Post-Launch Improvements (Phase 2)

1.  **Global Rate Limiting Strategy**: Currently localized. Need a global Redis-backed rate limiter (e.g., "1000 requests per IP per hour") to prevent DDoS.
2.  **Webhooks**: Clients will want notifications when OCR finishes, rather than polling `/api/jobs/:id`.
3.  **Admin Dashboard**: You currently need to edit the DB directly to ban users or debug stuck jobs.

---

## 🧠 Overall Launch Readiness Score: 8/10

**Verdict**: The system is **Code-Complete** for a secure Private Beta. The backend logic is robust (Atomic Transactions + JWT Auth + Isolation Tests). The remaining risks are mostly **Operational** (SSL, Deployment config) rather than **Architectural** logic errors.

---

## 🚀 Recommended Next Milestone

**"Operation Production"**
1.  **Infrastructure**: Set up a VPS (EC2/DigitalOcean).
2.  **Security**: Configure Nginx with Let's Encrypt (SSL).
3.  **Database**: Apply `backend/src/db/policies.sql` (Ensure RLS is active).
4.  **Deploy**: Run `docker-compose up -d` in production mode.
