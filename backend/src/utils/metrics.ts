import client from "prom-client";
import { Queue } from "bullmq";
import { logger } from "./logger";

// Create a Registry
const register = new client.Registry();

// Add default metrics (GC, Event Loop, Memory)
client.collectDefaultMetrics({ register });

// --- HTTP METRICS ---

export const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.5, 1, 1.5, 2, 5], // Customize buckets for your app's latency profile
  registers: [register],
});

export const httpRequestCount = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});


// --- OCR WORKER METRICS ---

export const ocrJobDurationSeconds = new client.Histogram({
  name: "ocr_job_duration_seconds",
  help: "Duration of OCR jobs in seconds",
  labelNames: ["status"], // success, failed
  buckets: [1, 5, 10, 30, 60, 120], // OCR takes time
  registers: [register],
});

export const ocrJobFailuresTotal = new client.Counter({
  name: "ocr_job_failures_total",
  help: "Total number of failed OCR jobs",
  labelNames: ["error_type"],
  registers: [register],
});

export const ocrQueueDepth = new client.Gauge({
  name: "ocr_queue_depth",
  help: "Number of jobs waiting/active/delayed in OCR queue",
  labelNames: ["state"], // waiting, active, delayed, failed
  registers: [register],
});

// --- QUEUE POLLER (Low Overhead) ---
// Poll queue depth every 15s to avoid redis hammering
export const startQueueMetricsPoller = (queue: Queue) => {
  if (!queue) return;
  
  setInterval(async () => {
    try {
      const counts = await queue.getJobCounts("waiting", "active", "delayed", "failed");
      ocrQueueDepth.set({ state: "waiting" }, counts.waiting);
      ocrQueueDepth.set({ state: "active" }, counts.active);
      ocrQueueDepth.set({ state: "delayed" }, counts.delayed);
      ocrQueueDepth.set({ state: "failed" }, counts.failed);
    } catch (err: any) {
      logger.error({ msg: "Failed do collect queue metrics", err: err.message });
    }
  }, 15000); // 15s interval
};

export { register };
