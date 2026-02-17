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

const worker = new Worker<OcrJobData>(
  "ocr",
  async (job: Job<OcrJobData>) => {
    const { jobId, invoiceId, filePath, businessId, requestId } = job.data;
    const endTimer = ocrJobDurationSeconds.startTimer(); // ⏱️ Start Timer

    // Create context-aware logger for this job
    const jobLogger = createChildLogger({ 
      jobId, 
      invoiceId, 
      businessId, 
      requestId, 
      component: "ocr-worker" 
    });
    
    jobLogger.info("📥 PROCESSING JOB");

    try {
      // 1️⃣ UPDATE STATUS: PROCESSING
      await supabase
        .from("invoice_ocr_jobs")
        .update({ status: "PROCESSING", processed_at: new Date() })
        .eq("id", jobId);

      // ... existing code ...

      // 2️⃣ STREAM FILE
      const fileStream = await minioClient.getObject(
        process.env.MINIO_BUCKET!,
        filePath
      );

      // 3️⃣ PREPARE FORM
      const form = new FormData();
      form.append("file", fileStream, {
        filename: filePath.split("/").pop() || "invoice.pdf",
      });
      form.append("business_id", businessId);
      form.append("job_id", jobId);

      // 4️⃣ SEND TO PYTHON
      jobLogger.info({ msg: "Sending to Python Service", url: OCR_SERVICE_URL });
      
      const response = await axios.post(OCR_SERVICE_URL, form, {
        headers: {
          ...form.getHeaders(),
        },
        timeout: 60000, 
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      } as any);

      const ocrResult = response.data as { status: string; message?: string; data: any };
      
      if (ocrResult.status !== "success") {
        throw new Error(ocrResult.message || "OCR Service returned failure");
      }

      jobLogger.info("✅ OCR COMPLETED SUCCESSFULLY");

      // 5️⃣ SAVE RESULTS
      const versionId = uuid();
      const { data: rawData } = ocrResult;

      const { error: versionError } = await supabase
        .from("invoice_versions")
        .insert({
          id: versionId,
          invoice_id: invoiceId,
          version_number: 1,
          data_snapshot: rawData,
          raw_ocr_json: rawData,
          confidence: 0.95,
          created_by: "system",
        });

      if (versionError) {
        jobLogger.error({ msg: "Version insert error", err: versionError });
        throw new Error(`DB Insert Error: ${versionError.message}`);
      }

      // 6️⃣ UPDATE JOB & INVOICE
      await supabase
        .from("invoice_ocr_jobs")
        .update({ status: "COMPLETED" })
        .eq("id", jobId);

      await supabase
        .from("invoices")
        .update({ status: "NEEDS_REVIEW" })
        .eq("id", invoiceId);

      endTimer({ status: "success" }); // ✅ Record Success Duration
      jobLogger.info("🎉 JOB FINISHED");

    } catch (err: any) {
      endTimer({ status: "failed" }); // ✅ Record Failure Duration
      ocrJobFailuresTotal.inc({ error_type: err.code || "unknown" }); // ✅ Record Failure Count
      
      jobLogger.error({ msg: "Job Failed", err: err.message });

      // UPDATE STATUS: FAILED
      await supabase
        .from("invoice_ocr_jobs")
        .update({ status: "FAILED", error_message: err.message })
        .eq("id", jobId);
        
      throw err; 
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

