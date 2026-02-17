import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import emailOtpRouter from "./api/emailOtp";
import uploadRouter from "./api/upload";
import uploadInvoiceRoute from "./routes/uploadInvoiceRoute";
import directUploadRouter from "./api/directUpload"; 
import invoiceCorrectionRouter from "./api/invoiceCorrection";
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

import { apiLimiter } from "./middleware/rateLimit";

// ✅ LOGGING
app.use(requestLogger);

// ✅ RATE LIMITING
app.use(apiLimiter);

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
app.use("/api/upload-direct", directUploadRouter); // ✅ NEW DIRECT UPLOAD
app.use("/api/invoices", invoiceCorrectionRouter); // ✅ Fixes, edits
app.use("/api/invoices", invoiceFinalizeRouter);   // ✅ Finalization
app.use("/api/invoices", invoicesRouter);          // ✅ Listing/Fetching
app.use("/api/exports", exportRouter);
app.use("/api/exports", exportFreezeRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/audit", auditRouter);
app.use("/api/jobs", jobsRouter);
