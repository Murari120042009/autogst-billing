-- ==============================================================================
-- 📜 JOB TRACKING SCHEMA (Proposed)
-- ==============================================================================

/*
CREATE TYPE job_status AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE invoice_ocr_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  business_id UUID NOT NULL, -- New: Enables RLS/filtering by tenant
  status job_status NOT NULL DEFAULT 'QUEUED',
  file_path TEXT NOT NULL,
  attempt_count INT DEFAULT 0,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}', -- Store job-specific info (e.g. queue_id)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimize queries by status (common access pattern)
CREATE INDEX idx_ocr_jobs_status ON invoice_ocr_jobs(status, business_id);
*/

-- ==============================================================================
-- 🔄 WORKER UPDATE PATTERN (Safe State Machine)
-- ==============================================================================

/*
  // Good: Optimistic locking or state transition guards
  
  // Start Processing (Only from QUEUED)
  UPDATE invoice_ocr_jobs 
  SET status = 'PROCESSING', attempt_count = attempt_count + 1, processed_at = NOW()
  WHERE id = $jobId AND status = 'QUEUED';

  // Complete (Only from PROCESSING)
  UPDATE invoice_ocr_jobs 
  SET status = 'COMPLETED' 
  WHERE id = $jobId AND status = 'PROCESSING';

  // Fail (Any state)
  UPDATE invoice_ocr_jobs 
  SET status = 'FAILED', error_message = $error 
  WHERE id = $jobId;
*/
