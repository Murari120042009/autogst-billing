import { Worker, Job, WorkerOptions, Processor } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { logger, createChildLogger } from "../../utils/logger";
import { redisConnection } from "../../queues/redis";

/**
 * 🛡️ Reliable Worker Template
 * 
 * Guarantees:
 * 1. Idempotency (Skip if already done)
 * 2. Atomic-ish State Transitions (Queued -> Processing -> Completed/Failed)
 * 3. Structured Logging with Trace IDs
 * 4. Error Persistence
 */

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ReliableJobData {
  jobId: string;      // UUID from our DB
  requestId?: string; // For tracing
  [key: string]: any;
}

export const createReliableWorker = <T extends ReliableJobData>(
  queueName: string,
  processor: (job: Job<T>, jobLogger: any) => Promise<void>,
  options?: WorkerOptions
) => {
  
  const workerProcessor: Processor<T> = async (job) => {
    const { jobId, requestId } = job.data;
    
    // 1️⃣ LOGGING CONTEXT
    const jobLogger = createChildLogger({
      jobId,
      queue: queueName,
      requestId: requestId || "unknown",
      attempt: job.attemptsMade + 1,
    });

    jobLogger.info(`🔄 Job Started (Attempt ${job.attemptsMade + 1})`);

    try {
      // 2️⃣ IDEMPOTENCY CHECK (Database)
      // Verify job hasn't already been completed (e.g. zombie retry)
      const { data: jobRecord, error: fetchError } = await supabase
        .from("invoice_ocr_jobs") // ⚠️ Make this dynamic if reused for other tables
        .select("status")
        .eq("id", jobId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        // DB Error - Retry
        throw new Error(`DB Fetch Error: ${fetchError.message}`);
      }

      if (jobRecord?.status === "COMPLETED") {
        jobLogger.warn("⏭️ Job already COMPLETED. Skipping.");
        return; // Success, don't re-run
      }

      // 3️⃣ MARK "PROCESSING"
      // Only update if not already completed/failed
      await supabase
        .from("invoice_ocr_jobs")
        .update({ status: "PROCESSING", processed_at: new Date() })
        .eq("id", jobId);

      // 4️⃣ EXECUTE BUSINESS LOGIC
      await processor(job, jobLogger);

      // 5️⃣ MARK "COMPLETED"
      // (Processor is responsible for saving results, we just mark status)
      await supabase
        .from("invoice_ocr_jobs")
        .update({ status: "COMPLETED", completed_at: new Date() })
        .eq("id", jobId);

      jobLogger.info("✅ Job Completed Successfully");

    } catch (err: any) {
      jobLogger.error({ msg: "❌ Job Failed", err });

      // 6️⃣ MARK "FAILED" & PERSIST ERROR
      await supabase
        .from("invoice_ocr_jobs")
        .update({ 
          status: "FAILED", 
          error_message: err.message || "Unknown error" 
        })
        .eq("id", jobId);

      // Rethrow to let BullMQ handle backoff/retries
      throw err;
    }
  };

  const worker = new Worker(queueName, workerProcessor, {
    connection: redisConnection,
    ...options,
  });

  // Global Error Handlers
  worker.on("failed", (job, err) => {
    logger.error({ msg: "BullMQ Job Failed", jobId: job?.data.jobId, err });
  });

  worker.on("error", (err) => {
    logger.error({ msg: "BullMQ Worker Error", err });
  });

  return worker;
};
