import pino from "pino";

// ✅ CONFIG
const isDev = process.env.NODE_ENV !== "production";

// ✅ LOGGER INSTANCE
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // In dev: pretty print | In prod: JSON (default)
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname", 
        },
      }
    : undefined,
  // Redact sensitive data automatically
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "password", "email"],
    remove: true,
  },
  base: {
    app: "autogst-backend", // Tag logs with app name
  },
});

// Helper for child loggers (e.g., worker context)
export const createChildLogger = (context: Record<string, any>) => {
  return logger.child(context);
};
