import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const ocrQueue = new Queue("ocr", {
  connection: redisConnection
});
