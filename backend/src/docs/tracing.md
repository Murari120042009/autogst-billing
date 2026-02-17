# 🕵️ End-to-End Request Tracing Architecture

## Overview
Every HTTP request generates a unique `request_id` (UUID v4) which is propagated across the entire system, including async background jobs (BullMQ) and worker processes.

## Components

### 1. Request ID Generation (Middleware)
- **File**: `backend/src/middleware/requestLogging.ts`
- **Method**: Uses `pino-http` to generate or read `X-Request-Id` header.
- **Access**: Available as `req.id` in all controllers.

### 2. Job Propagation
- **Producer**: `backend/src/api/upload.ts`
- **Action**: Passes `req.id` into the BullMQ job payload as `requestId`.

### 3. Worker Correlation
- **Consumer**: `backend/src/workers/ocrWorker.ts`
- **Action**: 
  - Extracts `requestId` from job data.
  - Creates a child logger with `{ requestId }`.
  - All worker logs automatically include this ID.

## Usage Guide for Developers

### In API Routes
Access the ID via `req.id` (typed in `express.d.ts`).
```typescript
logger.info({ requestId: req.id, msg: "Doing something" });
```

### In Workers
Ensure your Job Data interface includes `requestId`.
```typescript
const jobLogger = logger.child({ requestId: job.data.requestId });
jobLogger.info("Async task started");
```

## Logs Example
**API Log**:
```json
{"level":30,"time":1700000000000,"req":{"id":"abc-123",...},"msg":"request completed"}
```

**Worker Log**:
```json
{"level":30,"time":1700000005000,"requestId":"abc-123","component":"ocr-worker","msg":"Processing Job"}
```

You can now filter logs by `requestId` in your log aggregator (e.g., Datadog, ELK) to see the full lifecycle of a user action.
