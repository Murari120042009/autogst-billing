/**
 * 🛡️ PRODUCTION-SAFE OTP CONSUMPTION
 * 
 * Pattern: "Atomic Check-and-Set" (CAS)
 * This prevents race conditions where two requests try to use the same OTP simultaneously.
 */

// ------------------------------------------------------------------
// 1️⃣ Node.js (pg) Example
// ------------------------------------------------------------------
/*
  Assuming table columns: 
  - id (uuid)
  - email (text)
  - otp_code (text) -- OR 'code', 'token', 'otp_hash'
  - consumed (boolean)
  - expires_at (timestamptz)
*/

const consumeOtp = async (email, otpInput) => {
    const query = `
    UPDATE otps
    SET 
      consumed = true,
      updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM otps
      WHERE email = $1
        AND (otp_code = $2 OR otp_hash = $2) -- ⚠️ Handle naming ambiguity
        AND consumed = false
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE SKIP LOCKED -- 🔒 Locks row to prevent race conditions
    )
    RETURNING id, email, purpose, created_at;
  `;

    // Note: If using Bcrypt/Argon2, you CANNOT compare in SQL easily. 
    // You must SELECT first, verify in App, then UPDATE by ID. 
    // See "Hashed OTP" section below.

    try {
        const res = await pool.query(query, [email, otpInput]);

        if (res.rowCount === 0) {
            throw new Error("Invalid or Expired OTP");
        }

        return res.rows[0]; // ✅ Successfully consumed
    } catch (err) {
        console.error("OTP Consume Error:", err);
        throw err;
    }
};

// ------------------------------------------------------------------
// 2️⃣ Supabase SQL Editor Test
// ------------------------------------------------------------------
/*
  Run this in Supabase SQL Editor to verify logic.
  Replace 'test@example.com' and '123456' with real values.
*/

--Create dummy data
INSERT INTO otps(email, otp_code, consumed, expires_at)
VALUES('test@example.com', '123456', false, NOW() + interval '5 minutes');

--Represents the "Consume" action
UPDATE otps
SET consumed = true, updated_at = NOW()
WHERE id = (
    SELECT id FROM otps 
  WHERE email = 'test@example.com' 
    AND otp_code = '123456' 
    AND consumed = false 
    AND expires_at > NOW()
  ORDER BY created_at DESC 
  LIMIT 1
)
RETURNING *;


// ------------------------------------------------------------------
// 3️⃣ Handling Hashed OTPs (Bcrypt/Argon2)
// ------------------------------------------------------------------
/*
  If your DB stores `otp_hash` (Bcrypt), you cannot match it in SQL 
  because you need to verify the plain text against the hash.
  
  Correct Flow:
*/

const verifyAndConsumeHashedOtp = async (email, plainOtp) => {
    // A. SELECT CANDIDATE
    const { data: row, error } = await supabase
        .from("otps")
        .select("id, otp_hash, expires_at")
        .eq("email", email)
        .eq("consumed", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (!row) throw new Error("OTP not found or expired");

    // B. VERIFY HASH (App Layer)
    const isValid = await bcrypt.compare(plainOtp, row.otp_hash);
    if (!isValid) throw new Error("Invalid OTP");

    // C. ATOMIC CONSUME (DB Layer)
    // We use .eq("consumed", false) again to prevent Replay Attacks
    // in the milliseconds between Step A and Step C.
    const { data: consumedRow, error: updateError } = await supabase
        .from("otps")
        .update({ consumed: true })
        .eq("id", row.id)
        .eq("consumed", false) // 🛡️ CRITICAL SAFETY
        .select()
        .single();

    if (!consumedRow) throw new Error("OTP was consumed by another request");

    return consumedRow;
};
