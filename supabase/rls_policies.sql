-- ==============================================================================
-- 🛡️ ROW LEVEL SECURITY (RLS) FOR MULTI-TENANT INVOICES TABLE
-- ==============================================================================

-- 1️⃣ ENABLE RLS
-- This forces all queries to go through policies. Admin/Service Role bypasses this.
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 🧠 BEST PRACTICE: JWT CLAIMS vs TABLE LOOKUPS
-- ==============================================================================
-- We use JWT Claims ((auth.jwt() -> 'app_metadata' ->> 'business_id')) instead of 
-- querying a 'users' table or 'memberships' table in every policy.
--
-- WHY?
-- 1. ⚡ PERFORMANCE: No join penalties. The ID is already in memory (the token).
-- 2. 🔒 SECURITY: The token is signed. A user cannot fake this value without the request signing key.
-- 3. 🧩 SIMPLICITY: Policies are one-liners.
--
-- PRE-REQUISITE:
-- Your auth handler (e.g. Supabase Auth Hook or custom login) MUST add 
-- 'business_id' to the JWT 'app_metadata' or 'user_metadata'.
-- ==============================================================================

-- 2️⃣ DEFINE POLICIES

-- 👁️ SELECT: Users can only view their own business's invoices
CREATE POLICY "Tenant View Policy" ON invoices
FOR SELECT
USING (
  business_id = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid
  OR
  business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
);

-- ➕ INSERT: Users can only create invoices for their own business
-- CHECK ensures the new row's business_id matches the user's token.
CREATE POLICY "Tenant Insert Policy" ON invoices
FOR INSERT
WITH CHECK (
  business_id = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid
  OR
  business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
);

-- ✏️ UPDATE: Users can only update their own business's invoices
-- USING checks if the existing row is yours.
-- WITH CHECK ensures you don't reassign it to another business.
CREATE POLICY "Tenant Update Policy" ON invoices
FOR UPDATE
USING (
  business_id = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid
  OR
  business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
)
WITH CHECK (
  business_id = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid
  OR
  business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
);

-- ❌ DELETE: Users can only delete their own business's invoices
CREATE POLICY "Tenant Delete Policy" ON invoices
FOR DELETE
USING (
  business_id = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid
  OR
  business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
);

-- ==============================================================================
-- 🧪 VERIFICATION QUERIES
-- Run these to test your policies
-- ==============================================================================

/*
-- 1. Check if RLS is on
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'invoices';

-- 2. Simulate User A (Business A)
-- Needs a valid JWT or mocking for testing purposes
-- In Supabase SQL Editor, you can impersonate via:
-- SET LOCAL request.jwt.claim.sub = 'user_uuid';
-- SET LOCAL request.jwt.claim.app_metadata = '{"business_id": "business_uuid_A"}';

-- SELECT * FROM invoices; -- Should only show Business A rows

-- 3. Attempt Illegal Insert
-- INSERT INTO invoices (business_id) VALUES ('business_uuid_B');
-- Should fail with "new row violates row-level security policy"
*/
