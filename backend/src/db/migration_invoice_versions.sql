-- ==============================================================================
-- 🛡️ INVOICE VERSIONING MIGRATION (Fix Race Conditions)
-- ==============================================================================

-- 1️⃣ ENFORCE UNIQUE CONSTRAINT
-- This prevents two "Version 5" rows for the same Invoice ID.
-- The UNIQUE INDEX acts as a constraint and also speeds up lookups.
CREATE UNIQUE INDEX IF NOT EXISTS invoice_versions_unique_idx
ON invoice_versions (invoice_id, version_number);

-- If you already have duplicates, this command will fail.
-- To clean duplicates first (keeping latest ID):
/*
DELETE FROM invoice_versions a USING invoice_versions b
WHERE a.id < b.id
AND a.invoice_id = b.invoice_id
AND a.version_number = b.version_number;
*/
