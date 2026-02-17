-- ==============================================================================
-- 🛠️ ATOMIC UPLOAD TRANSACTION (Stored Procedure)
-- ==============================================================================
-- This function replaces the "fake" client-side transaction logic.
-- It performs all INSERTs in a single atomic transaction on the database.

-- DROP FUNCTION IF EXISTS upload_invoice_meta;

CREATE OR REPLACE FUNCTION upload_invoice_meta(
  p_invoice_id UUID,
  p_business_id UUID,
  p_user_id UUID,        -- For audit logs
  p_file_id UUID,
  p_file_path TEXT,
  p_file_mimetype TEXT,
  p_file_size BIGINT,
  p_version_id UUID,
  p_job_id UUID
) 
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER -- Run as owner (bypass RLS for internal inserts if needed, or use INVOKER to respect RLS)
AS $$
BEGIN
  -- 1️⃣ Insert Invoice
  INSERT INTO invoices (id, business_id, status)
  VALUES (p_invoice_id, p_business_id, 'PENDING');

  -- 2️⃣ Insert File
  INSERT INTO files (id, invoice_id, path, mimetype, size)
  VALUES (p_file_id, p_invoice_id, p_file_path, p_file_mimetype, p_file_size);

  -- 3️⃣ Insert Version (v1)
  INSERT INTO invoice_versions (id, invoice_id, version_number, created_at, created_by)
  VALUES (p_version_id, p_invoice_id, 1, NOW(), p_user_id);

  -- 4️⃣ Insert OCR Job
  INSERT INTO invoice_ocr_jobs (id, invoice_id, business_id, file_path, status)
  VALUES (p_job_id, p_invoice_id, p_business_id, p_file_path, 'QUEUED');

  -- 5️⃣ Insert Audit Logs
  -- Log Invoice Creation
  INSERT INTO audit_logs (id, entity_type, entity_id, action, metadata, created_at)
  VALUES (
    uuid_generate_v4(), 
    'invoice', 
    p_invoice_id, 
    'CREATE', 
    jsonb_build_object('businessId', p_business_id, 'uploadedBy', p_user_id), 
    NOW()
  );
  
  -- Log OCR Job Creation
  INSERT INTO audit_logs (id, entity_type, entity_id, action, metadata, created_at)
  VALUES (
    uuid_generate_v4(), 
    'invoice_ocr_jobs', 
    p_job_id, 
    'CREATE', 
    jsonb_build_object('file', p_file_path), 
    NOW()
  );

END;
$$;
