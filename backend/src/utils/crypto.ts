import crypto from "crypto";

/**
 * Creates a SHA-256 hash of the input string.
 * Used for OTP verification securely without storing plain text.
 */
export const hashOtp = (otp: string): string => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};

/**
 * Constant-time comparison to prevent timing attacks.
 * Returns true if strings match, false otherwise.
 */
export const safeCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  // timingSafeEqual throws if lengths differ, so we check first.
  // We leak length information here, but for fixed-length hashes (SHA-256 hex = 64 chars) 
  // this is constant time anyway.
  if (bufA.length !== bufB.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(bufA, bufB);
};
