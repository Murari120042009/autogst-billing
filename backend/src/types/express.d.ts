import "express";

declare global {
  namespace Express {
    interface Request {
      id: string; // ✅ Added for request tracing (pino-http)
      files?: Multer.File[];
      user?: {
        userId: string;
        businessId?: string;
        email?: string;
      };
    }
  }
}
