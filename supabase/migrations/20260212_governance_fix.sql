
-- Enable RLS and add policies for user_id = auth.uid()
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_select ON invoices FOR SELECT USING (user_id = auth.uid());
CREATE POLICY invoices_insert ON invoices FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY invoices_update ON invoices FOR UPDATE USING (user_id = auth.uid());

ALTER TABLE invoice_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_versions_select ON invoice_versions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY invoice_versions_insert ON invoice_versions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY invoice_versions_update ON invoice_versions FOR UPDATE USING (user_id = auth.uid());

ALTER TABLE invoice_ocr_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_ocr_jobs_select ON invoice_ocr_jobs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY invoice_ocr_jobs_insert ON invoice_ocr_jobs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY invoice_ocr_jobs_update ON invoice_ocr_jobs FOR UPDATE USING (user_id = auth.uid());

ALTER TABLE files ENABLE ROW LEVEL SECURITY;
CREATE POLICY files_select ON files FOR SELECT USING (user_id = auth.uid());
CREATE POLICY files_insert ON files FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY files_update ON files FOR UPDATE USING (user_id = auth.uid());

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY audit_logs_update ON audit_logs FOR UPDATE USING (user_id = auth.uid());
-- Foreign key constraints and ON DELETE CASCADE
ALTER TABLE files
  ADD CONSTRAINT fk_files_invoice_id FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE invoice_versions
  ADD CONSTRAINT fk_invoice_versions_invoice_id FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE invoice_ocr_jobs
  ADD CONSTRAINT fk_invoice_ocr_jobs_invoice_id FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

-- Unique constraint for (seller_gstin, invoice_number)
ALTER TABLE invoices
  ADD CONSTRAINT unique_seller_invoice UNIQUE (seller_gstin, invoice_number);

-- NOT NULL constraints for critical fields
ALTER TABLE invoices
  ALTER COLUMN seller_gstin SET NOT NULL,
  ALTER COLUMN invoice_number SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;
ALTER TABLE files
  ALTER COLUMN invoice_id SET NOT NULL,
  ALTER COLUMN path SET NOT NULL;
ALTER TABLE invoice_versions
  ALTER COLUMN invoice_id SET NOT NULL;
ALTER TABLE invoice_ocr_jobs
  ALTER COLUMN invoice_id SET NOT NULL;

-- ENUM type enforcement (if not present)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('PENDING', 'FINALIZED', 'NEEDS_REVIEW');
  END IF;
END $$;
ALTER TABLE invoices
  ALTER COLUMN status TYPE invoice_status USING status::invoice_status;
-- SQL: DB trigger for OCR job failure propagation
CREATE OR REPLACE FUNCTION propagate_ocr_failure()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'FAILED' THEN
    UPDATE invoices SET status = 'NEEDS_REVIEW' WHERE id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_propagate_ocr_failure ON invoice_ocr_jobs;
CREATE TRIGGER trg_propagate_ocr_failure
AFTER UPDATE OF status ON invoice_ocr_jobs
FOR EACH ROW
WHEN (NEW.status = 'FAILED')
EXECUTE FUNCTION propagate_ocr_failure();

-- SQL: DB trigger for audit log on invoice status change
CREATE OR REPLACE FUNCTION audit_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (id, entity_type, entity_id, action, metadata, created_at)
  VALUES (gen_random_uuid(), 'invoice', NEW.id, 'STATUS_CHANGE', jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_invoice_status_change ON invoices;
CREATE TRIGGER trg_audit_invoice_status_change
AFTER UPDATE OF status ON invoices
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION audit_invoice_status_change();

-- SQL: Enforce allowed invoice status transitions
CREATE OR REPLACE FUNCTION enforce_invoice_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'FINALIZED' AND (NEW.status = 'PENDING' OR NEW.status = 'NEEDS_REVIEW') THEN
    RAISE EXCEPTION 'Invalid status transition from FINALIZED';
  END IF;
  IF OLD.status = 'PENDING' AND NOT (NEW.status IN ('FINALIZED', 'NEEDS_REVIEW')) THEN
    RAISE EXCEPTION 'Invalid status transition from PENDING';
  END IF;
  IF OLD.status = 'NEEDS_REVIEW' AND NEW.status <> 'FINALIZED' THEN
    RAISE EXCEPTION 'Invalid status transition from NEEDS_REVIEW';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_invoice_status_transition ON invoices;
CREATE TRIGGER trg_enforce_invoice_status_transition
BEFORE UPDATE OF status ON invoices
FOR EACH ROW
EXECUTE FUNCTION enforce_invoice_status_transition();
