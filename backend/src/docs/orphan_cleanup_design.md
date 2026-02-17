# Architecture Decision: Handling Orphaned Uploads

## Recommendation: Background Sweeper Job (Orphan Cleaner)

**Why**: 
- **Temporary buckets** require complex "move" logic (slow).
- **Two-phase commits** are distributed system nightmares.
- **Signed URLs** push complexity to the frontend.

A **Background Sweeper** is the simplest, most robust MVP approach. We continue uploading to the final bucket but rely on a scheduled job to delete files that have no database record after X hours.

## Implementation Plan

1. **Upload Flow (Unchanged)**:
   - Upload file to MinIO (`invoices/{business_id}/{uuid}`)
   - Insert DB record
   - If DB fails, abort (file remains orphaned)

2. **Sweeper Logic (New Worker)**:
   - Runs every 24 hours.
   - Lists all files in MinIO bucket.
   - For each file, checks if the `file_path` exists in the `files` table.
   - If missing in DB AND file is older than 1 hour -> DELETE from MinIO.

## Code: Orphan Cleaner Worker

### `backend/src/workers/orphanCleaner.ts`

```typescript
import { Worker } from "bullmq";
import { minioClient } from "../config/minio";
import { createClient } from "@supabase/supabase-js";
import { redisConnection } from "../queues/redis";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const BUCKET = process.env.MINIO_BUCKET!;

console.log("🧹 ORPHAN CLEANER STARTED...");

// Define a recurring job in your index.ts or queue setup
// await cleanerQueue.add('clean', {}, { repeat: { cron: '0 3 * * *' } }); // 3 AM daily

new Worker("cleaner", async () => {
  console.log("🕵️ SCANNING FOR ORPHANED FILES...");
  
  const stream = minioClient.listObjectsV2(BUCKET, "", true);
  const orphans = [];

  for await (const obj of stream) {
    const filePath = obj.name;
    
    // Safety: Skip recent files (allow 1 hour grace period for in-flight uploads)
    const ageHours = (Date.now() - obj.lastModified.getTime()) / (1000 * 60 * 60);
    if (ageHours < 1) continue;

    // Check DB existence
    const { data } = await supabase
      .from("files")
      .select("id")
      .eq("path", filePath)
      .single();

    if (!data) {
      console.log(`🗑️ ORPHAN FOUND: ${filePath}`);
      orphans.push(filePath);
    }
  }

  // Batch delete
  if (orphans.length > 0) {
    await minioClient.removeObjects(BUCKET, orphans);
    console.log(`✅ DELETED ${orphans.length} ORPHANED FILES`);
  } else {
    console.log("✅ SYSTEM CLEAN");
  }

}, { connection: redisConnection });
```
