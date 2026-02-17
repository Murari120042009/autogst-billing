import { pinoHttp } from "pino-http";
import { logger } from "../utils/logger";
import { v4 as uuid } from "uuid";
import { Request } from "express";

// ✅ REQUEST LOGGING MIDDLEWARE
// Attach basic request info + custom serializers for clean output
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => (req.headers["x-request-id"] as string) || uuid(),
  
  // Custom serialized log fields
  customProps: (req: Request) => {
    // If auth middleware has run, attach user context
    // NOTE: This usually runs BEFORE auth, so we might miss user context.
    // If you log "on finished", this captures user data if set later.
    const user = (req as any).user;
    return {
      userId: user?.userId || null,
      businessId: user?.businessId || null,
      method: req.method,
      url: req.originalUrl,
    };
  },

  // Log on error or finish
  autoLogging: {
    ignore: (req) => {
      // Ignore noisy health checks
      return req.url?.includes("/health") || false;
    }
  },

  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      // Don't log headers/body by default (security)
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
