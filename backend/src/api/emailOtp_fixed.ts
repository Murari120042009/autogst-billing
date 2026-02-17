// VERIFY OTP (Fixed Race Condition)
router.post("/verify", async (req, res) => {
  const { email, otp, purpose } = req.body;

  if (!email || !otp || !purpose) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // 1️⃣ FIND LATEST VALID OTP
  // We check 'consumed' here only to quickly fail invalid requests.
  // The actual race protection is in the UPDATE step.
  const { data, error } = await supabase
    .from("otps")
    .select("*")
    .eq("email", email)
    .eq("purpose", purpose)
    .gt("expires_at", new Date().toISOString())
    .eq("consumed", false) // Optimistic check
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return res.status(400).json({ error: "OTP not found or expired" });
  }

  // 2️⃣ VERIFY HASH (CPU intensive, do before DB lock if possible)
  const valid = await verifyOtp(otp, data.otp_hash);

  if (!valid) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  // 3️⃣ ATOMIC CONSUMPTION (The Fix)
  // We try to update ONLY if consumed is still FALSE.
  // PostgreSQL handles the concurrency here.
  const { data: updatedData, error: updateError } = await supabase
    .from("otps")
    .update({ consumed: true })
    .eq("id", data.id)
    .eq("consumed", false) // 🛡️ CRITICAL: Atomic Check-and-Set
    .select(); // Returns updated rows

  if (updateError) {
    console.error("OTP UPDATE ERROR", updateError);
    return res.status(500).json({ error: "Verification failed" });
  }

  // If no rows were returned, it means 'consumed' was already true (Race condition caught)
  if (!updatedData || updatedData.length === 0) {
    console.warn(`OTP REPLAY ATTACK BLOCKED: ${email}`);
    return res.status(400).json({ error: "OTP already used" });
  }

  res.json({ message: "OTP verified" });
});
