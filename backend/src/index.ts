import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import emailOtpRouter from "./api/emailOtp";
import uploadRouter from "./api/upload";
import uploadInvoiceRoute from "./routes/uploadInvoiceRoute";
import invoiceCorrectionRouter from "./api/invoiceCorrection"; // ✅ ADD THIS
import invoiceFinalizeRouter from "./api/invoiceFinalize";
import exportRouter from "./api/exports";
import exportFreezeRouter from "./api/exportFreeze";
import reportsRouter from "./api/reports";
import dashboardRouter from "./api/dashboard";
import auditRouter from "./api/audit";
import invoicesRouter from "./api/invoices";
import jobsRouter from "./api/jobs"; // ✅ ADD THIS
import { requestLogger } from "./middleware/requestLogging";
import { logger } from "./utils/logger";
import { metricsMiddleware } from "./middleware/metricsMiddleware";
import { ocrQueue } from "./queues/ocrQueue";
import { startQueueMetricsPoller, register } from "./utils/metrics";
import { setupSwagger } from "./config/swagger";

const app = express();

setupSwagger(app); // ✅ SWAGGER DOCS

// ✅ CORS
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true
  })
);

// ✅ LOGGING
app.use(requestLogger);

// ✅ METRICS
startQueueMetricsPoller(ocrQueue);
app.use(metricsMiddleware);

app.get("/metrics", async (req, res) => {
  // Basic protection: Require specific header if in production
  if (process.env.NODE_ENV === "production" && req.headers["x-metrics-key"] !== process.env.METRICS_SECRET) {
    return res.status(401).send("Unauthorized");
  }
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// ✅ JSON parser
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("AutoGST Backend Running");
});

// ✅ ROUTES (unchanged order)
app.use("/api/email-otp", emailOtpRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/upload-invoice", uploadInvoiceRoute);

// ✅ ONLY REQUIRED ADDITION
app.use("/api/invoices", invoiceCorrectionRouter);

// ✅ HEALTH CHECKS
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.get("/ready", (req, res) => {
  // Check Redis/DB connection status ideally
  // For MVP, if we are running, we are "ready" unless we add deep checks
  res.status(200).json({ status: "ready" });
});

// Export app for testing
export { app };

const PORT = Number(process.env.PORT) || 4000;

let server: any;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// ✅ GRACEFUL SHUTDOWN
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Closing HTTP server...`);
  server.close(() => {
    logger.info("HTTP server closed.");
    // Close DB/Redis connections here if explicit cleanup needed
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
app.use("/api/invoices", invoiceFinalizeRouter);
app.use("/api/exports", exportRouter);
app.use("/api/exports", exportFreezeRouter);

app.use("/api/reports", reportsRouter);

app.use("/api/dashboard", dashboardRouter);
app.use("/api/audit", auditRouter)
app.use("/api/invoices", invoicesRouter);
app.use("/api/jobs", jobsRouter); // ✅ ADD THIS
