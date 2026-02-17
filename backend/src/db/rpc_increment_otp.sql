-- ==============================================================================
-- 🔢 ATOMIC INCREMENT OTP ATTEMPTS (RPC)
-- ==============================================================================
-- This function allows incrementing the attempts counter atomically.
-- It avoids the "read-modify-write" race condition where two concurrent
-- requests might both see attempts=0 and update to 1.
--
-- Usage in JS:
-- const { error } = await supabase.rpc('increment_otp_attempts', { row_id: 'uuid' });

CREATE OR REPLACE FUNCTION increment_otp_attempts(row_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE otps
  SET 
    attempts = attempts + 1,
    updated_at = NOW()
  WHERE id = row_id;
END;
$$;
