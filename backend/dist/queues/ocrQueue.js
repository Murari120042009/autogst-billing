"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("./redis");
exports.ocrQueue = new bullmq_1.Queue("ocr", {
    connection: redis_1.redisConnection
});
