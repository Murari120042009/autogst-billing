import rateLimit from "express-rate-limit";

// ============================================
// 🛡️ API RATE LIMITING (Basic Memory Store)
// ============================================

/**
 * Common configuration for production safety
 * - Standard Headers: Returns RateLimit-* headers (RFC draft)
 * - Legacy Headers: Disable X-RateLimit-* headers (deprecated)
 * - Validation: Validate setup
 */
const commonConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }, // Handled by app.set('trust proxy')
};

// 1️⃣ OTP LIMITER (STRICT)
// Prevent SMS/Email bombing and brute-force
export const otpLimiter = rateLimit({
  ...commonConfig,
  windowMs: 60 * 1000, // 1 minute
  limit: 3, // Max 3 OTP requests per minute per IP
  message: { error: "Too many OTP requests. Please try again in a minute." },
});

// 2️⃣ AUTH LIMITER (MODERATE)
// Login/Register attempts
export const authLimiter = rateLimit({
  ...commonConfig,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // Max 20 login attempts per 15 min per IP
  message: { error: "Too many login attempts. Please try again later." },
});

// 3️⃣ UPLOAD LIMITER (BURST PROTECTION)
// Heavier operations involving disk/DB IO
export const uploadLimiter = rateLimit({
  ...commonConfig,
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // Max 10 upload batches per minute per IP
  message: { error: "Upload limit exceeded. Slow down." },
});

// 4️⃣ GENERAL API LIMITER (STANDARD)
// General data fetching
export const apiLimiter = rateLimit({
  ...commonConfig,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // Max 300 requests per 15 min per IP (~20 req/min)
});
