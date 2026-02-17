import { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { authenticateUser } from "./authMiddleware";

/**
 * IDEMPOTENCY MIDDLEWARE (MVP)
 * Stores keys in Postgres (could use Redis for lower latency).
 * 
 * Logic:
 * 1. Check Idempotency-Key header.
 * 2. If missing, pass (or require it).
 * 3. If exists try to INSERT key with status=IN_PROGRESS.
 *    - If insert fails (Duplicate) -> SELECT key logic.
 *      - If status=IN_PROGRESS -> Return 409 (Conflict/Processing).
 *      - If status=COMPLETED -> Return SAVED response (200).
 *      - If status=FAILED -> Assume transient, allow retry (DELETE key + continue).
 * 4. If new -> Inject response interceptor to save result on finish().
 */

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const idempotency = async (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers["idempotency-key"] as string;

  if (!key) {
    return next(); // Opt-in for now
  }
  
  // ensure auth ran first
  if (!req.user?.userId) {
     return next(); // Should fail auth anyway
  }
  
  const userId = req.user.userId;

  try {
    // 1️⃣ ATOMIC ATTEMPT TO CLAIM KEY
    const { error } = await supabase
      .from("idempotency_keys")
      .insert({
        key,
        user_id: userId,
        status: "IN_PROGRESS",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h TTL
      });

    if (error) {
      if (error.code === "23505") { // Duplicate Key
        // 2️⃣ HANDLE EXISTING KEY
        const { data: existing } = await supabase
          .from("idempotency_keys")
          .select("*")
          .eq("key", key)
          .eq("user_id", userId)
          .single();

        if (!existing) return next(); // Weird race, proceed

        if (existing.status === "IN_PROGRESS") {
          return res.status(409).json({ error: "Request already in progress" });
        }

        if (existing.status === "COMPLETED") {
          // Return cached response
          return res.status(existing.response_status || 200).json(existing.response_body);
        }
        
        // If FAILED, maybe let them retry? implementation choice.
        // For strictness, return the error.
        return res.status(existing.response_status || 500).json(existing.response_body);
      }
      throw error;
    }

    // 3️⃣ NEW KEY: INTERCEPT RESPONSE
    const originalSend = res.json;
    
    // Override .json() to capture the body
    res.json = function (body) {
      // Async save (fire and forget or await if critical)
      supabase.from("idempotency_keys")
        .update({
          status: res.statusCode >= 400 ? "FAILED" : "COMPLETED",
          response_status: res.statusCode,
          response_body: body
        })
        .eq("key", key)
        .eq("user_id", userId)
        .then(({ error }) => {
           if(error) console.error("Failed to save idempotency result", error);
        });

      return originalSend.call(this, body);
    };

    next();

  } catch (err) {
    console.error("Idempotency Error", err);
    next(); // Fallback to normal execution? Or fail safe?
  }
};
