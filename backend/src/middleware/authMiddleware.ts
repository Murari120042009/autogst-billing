import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Use SUPABASE_JWT_SECRET if available (standard for Supabase projects), else JWT_SECRET
const SECRET_KEY = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-secret' : undefined);

if (!SECRET_KEY) {
  throw new Error("FATAL: Missing SUPABASE_JWT_SECRET or JWT_SECRET environment variable.");
}

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  aud: string;
  exp: number;
  app_metadata?: {
    business_id?: string;
    [key: string]: any;
  };
  user_metadata?: {
    business_id?: string;
    [key: string]: any;
  };
}

export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // Don't leak details, just 401
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    // Verify token signature and expiration
    const payload = jwt.verify(token, SECRET_KEY) as SupabaseJwtPayload;

    // Verify audience (standard Supabase check)
    if (payload.aud !== "authenticated") {
      return res.status(401).json({ error: "Unauthorized: Invalid audience" });
    }

    // Extract Context
    // app_metadata is secure (admin only), user_metadata is user-editable (via client)
    // PREFER app_metadata for critical fields like business_id if managed by admin
    const businessId =
      payload.app_metadata?.business_id || payload.user_metadata?.business_id;

    // Attach to Request
    req.user = {
      userId: payload.sub,
      email: payload.email,
      businessId
    };

    next();
  } catch (err) {
    // Distinguish between expired vs invalid if needed, but 401 is standard
    if (err instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: "Unauthorized: Token expired" });
    }
    return res.status(401).json({ error: "Unauthorized" });
  }
};
