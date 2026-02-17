import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const ocrQueue = new Queue("ocr", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000, // 1s, 2s, 4s
    },
    removeOnComplete: true, // Auto-cleanup successful jobs (save Redis memory)
    removeOnFail: false, // Keep failed jobs for inspection/rescue
  },
});
