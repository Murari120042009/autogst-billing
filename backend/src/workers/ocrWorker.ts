import dotenv from "dotenv";
dotenv.config();

import { Worker, Job } from "bullmq";
import { redisConnection } from "../queues/redis";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";
import axios from "axios";
import FormData from "form-data";
import { minioClient } from "../config/minio";
import { logger, createChildLogger } from "../utils/logger";

// ✅ SUPABASE (Service Role)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://localhost:8000/ocr";

interface OcrJobData {
  jobId: string;
  invoiceId: string;
  filePath: string;
  businessId: string;
  requestId: string; // ✅ TRACING
}

logger.info("🚀 OCR WORKER BOOTING...");

import { ocrJobDurationSeconds, ocrJobFailuresTotal } from "../utils/metrics";

// ✅ HELPER: Check Current State (Idempotency)
const checkJobStatus = async (jobId: string) => {
  const { data, error } = await supabase
    .from("invoice_ocr_jobs")
    .select("status")
    .eq("id", jobId)
    .single();

  if (error || !data) return null;
  return data.status;
};

// ✅ HELPER: Update Status
const updateJobStatus = async (jobId: string, status: string, errorMsg?: string) => {
  const updatePayload: any = { status, updated_at: new Date() };
  if (status === "PROCESSING") updatePayload.processed_at = new Date();
  if (status === "COMPLETED") updatePayload.completed_at = new Date(); // ✅ Track completion time
  if (status === "FAILED") updatePayload.error_message = errorMsg; // Persist error

  const { error } = await supabase
    .from("invoice_ocr_jobs")
    .update(updatePayload)
    .eq("id", jobId);

  if (error) {
    logger.error({ msg: "Failed to update job status", jobId, status, err: error });
    // Don't throw here, as this is a side effect. The job might still succeed logic-wise.
  }
};

const worker = new Worker<OcrJobData>(
  "ocr",
  async (job: Job<OcrJobData>) => {
    const { jobId, invoiceId, filePath, businessId, requestId } = job.data;
    const endTimer = ocrJobDurationSeconds.startTimer(); 
    
    const jobLogger = createChildLogger({ 
      jobId, invoiceId, businessId, requestId, component: "ocr-worker" 
    });

    jobLogger.info(`📥 JOB RECEIVED (Attempt ${job.attemptsMade + 1})`);

    try {
      // 1️⃣ IDEMPOTENCY CHECK
      // If retrying, check if we already finished it to avoid duplicate invoice versions
      const currentStatus = await checkJobStatus(jobId);
      if (currentStatus === "COMPLETED") {
        jobLogger.warn("Job already COMPLETED. Skipping processing.");
        return;
      }

      // 2️⃣ MARK PROCESSING
      await updateJobStatus(jobId, "PROCESSING");

      // 3️⃣ STREAM FILE
      const fileStream = await minioClient.getObject(
        process.env.MINIO_BUCKET!,
        filePath
      );

      // 4️⃣ CALL OCR SERVICE
      const form = new FormData();
      form.append("file", fileStream, { filename: "invoice.pdf" });
      form.append("business_id", businessId);
      form.append("job_id", jobId);

      jobLogger.info({ msg: "Sending to Python Service", url: OCR_SERVICE_URL });
      
      const response = await axios.post(OCR_SERVICE_URL, form, {
        headers: { ...form.getHeaders() },
        timeout: 60000, 
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      if (response.data.status !== "success") {
        throw new Error(response.data.message || "OCR Service returned failure");
      }

      jobLogger.info("✅ OCR Success");

      // 5️⃣ SAVE RESULTS (Atomic-ish)
      const versionId = uuid();
      const ocrData = response.data.data;

      // Insert Version
      const { error: dbError } = await supabase
        .from("invoice_versions")
        .insert({
          id: versionId,
          invoice_id: invoiceId,
          version_number: 1, // Logic for incrementing version number should be better in future
          data_snapshot: ocrData,
          raw_ocr_json: ocrData,
          confidence: 0.95, // Python should return this ideally
          created_by: "system",
        });

      if (dbError) throw new Error(`DB Insert Error: ${dbError.message}`);

      // 6️⃣ MARK COMPLETED
      await updateJobStatus(jobId, "COMPLETED");

      // Update Invoice Status
      await supabase
        .from("invoices")
        .update({ status: "NEEDS_REVIEW" })
        .eq("id", invoiceId);

      endTimer({ status: "success" });
      jobLogger.info("🎉 JOB FINISHED");

    } catch (err: any) {
      endTimer({ status: "failed" });
      ocrJobFailuresTotal.inc({ error_type: err.code || "unknown" });
      
      jobLogger.error({ msg: "Job Failed", err: err.message });

      // 7️⃣ HANDLE FAILURE
      // We mark as FAILED in DB to reflect current state.
      // BullMQ will see the thrown error and schedule a retry if configured.
      // If it retries, step 2 will set it back to PROCESSING.
      await updateJobStatus(jobId, "FAILED", err.message);

      throw err; // REQUIRED for BullMQ to know it failed
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

// ✅ GRACEFUL SHUTDOWN
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, closing worker...`);
  await worker.close();
  logger.info("Worker closed. Exiting.");
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

