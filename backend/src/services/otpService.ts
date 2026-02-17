import { createClient } from "@supabase/supabase-js";
import { hashOtp, safeCompare } from "../utils/crypto";

// Type Definition for OTP Row
interface OtpRow {
  id: string;
  otp_hash: string;
  consumed: boolean;
  expires_at: string;
  attempts: number;
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_ATTEMPTS = 5;

/**
 * Verifies an OTP with strict security controls.
 * - Checks expiry & consumption status first.
 * - Prevents brute-force by tracking attempts on the *latest* OTP.
 * - Atomically consumes the OTP on success.
 */
export const verifyOtp = async (email: string, otp: string, purpose: string): Promise<{ success: boolean; message: string }> => {
  // 1️⃣ FIND ACTIVE OTP (Latest unconsumed within expiry window)
  const { data: row, error: fetchError } = await supabase
    .from("otps")
    .select("id, otp_hash, attempts, expires_at, consumed")
    .eq("email", email)
    .eq("purpose", purpose)
    .eq("consumed", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !row) {
    // SECURITY: Limit information leakage.
    return { success: false, message: "Invalid or expired OTP" };
  }

  // 2️⃣ CHECK ATTEMPTS LIMIT (Lockout)
  if (row.attempts >= MAX_ATTEMPTS) {
    // Lockout active
    return { success: false, message: "Too many failed attempts. Please request a new OTP." };
  }

  const inputHash = hashOtp(otp);

  // 3️⃣ HASH MATCH CHECK (Timing Safe)
  const isMatch = safeCompare(row.otp_hash, inputHash);

  if (!isMatch) {
    // ❌ FAILURE: Increment attempts
    // Note: For strict concurrency, use an RPC: rpc('increment_attempts', { row_id: row.id })
    await supabase
      .from("otps")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
      
    // Return generic error to prevent enumeration of "valid email but wrong code" 
    // vs "invalid email". However, since we matched email/purpose above, 
    // user knows email is valid. 
    return { success: false, message: "Invalid OTP" };
  }

  // 4️⃣ ATOMIC CONSUME (Success Path)
  const { data: updatedRows, error: updateError } = await supabase
    .from("otps")
    .update({ 
      consumed: true,
      updated_at: new Date()
    })
    .eq("id", row.id)
    .eq("consumed", false) // 🛡️ CRITICAL: Prevent Race Condition Replay
    .select();

  if (updateError || !updatedRows || updatedRows.length === 0) {
    // This happens ONLY if a concurrent request consumed it milliseconds ago
    return { success: false, message: "OTP already used" };
  }

  return { success: true, message: "OTP verified successfully" };
};
