-- ==============================================================================
-- 🔒 ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- This script enables RLS on all critical tables and defines policies based on
-- the `request.jwt.claim.app_metadata.business_id` (or user_metadata).
-- Usage: Run this in Supabase SQL Editor.

-- 1️⃣ INVOICES
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_isolation_policy"
ON invoices
USING (
  business_id = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid
  OR
  business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
);

-- 2️⃣ FILES (Inherits from Invoice)
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "files_isolation_policy"
ON files
USING (
  exists (
    select 1 from invoices i
    where i.id = files.invoice_id
    and (
      i.business_id = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid
      OR
      i.business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    )
  )
);

-- 3️⃣ INVOICE VERSIONS (Inherits from Invoice)
ALTER TABLE invoice_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "versions_isolation_policy"
ON invoice_versions
USING (
  exists (
    select 1 from invoices i
    where i.id = invoice_versions.invoice_id
    and (
      i.business_id = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid
      OR
      i.business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    )
  )
);

-- 4️⃣ OCR JOBS
ALTER TABLE invoice_ocr_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocr_jobs_isolation_policy"
ON invoice_ocr_jobs
USING (
  business_id = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid
  OR
  business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
);

-- 5️⃣ IDEMPOTENCY KEYS (User Scoped)
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idempotency_isolation_policy"
ON idempotency_keys
USING (
  user_id = auth.uid()
);

-- 6️⃣ AUDIT LOGS (Admin/System only ideally, but for now scoped to business via metadata)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_isolation_policy"
ON audit_logs
USING (
  (metadata ->> 'businessId')::uuid = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid
  OR
  (metadata ->> 'businessId')::uuid = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
);

-- NOTE: The 'upload_invoice_meta' RPC is defined as SECURITY DEFINER, 
-- effectively bypassing these policies for creation, which is correct/intended. 
-- These policies primarily protect SELECT/UPDATE/DELETE.
