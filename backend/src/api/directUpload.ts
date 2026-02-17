import express from "express";
import { v4 as uuid } from "uuid";
import { minioClient } from "../config/minio";
import { authenticateUser } from "../middleware/authMiddleware";
import { createClient } from "@supabase/supabase-js";
import { ocrQueue } from "../queues/ocrQueue";
import { logger } from "../utils/logger";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GENERATE PRESIGNED UPLOAD URL
 * 
 * Allows frontend to upload directly to MinIO, bypassing Vercel limits.
 * Authentication required.
 */
router.post("/presigned", authenticateUser, async (req, res) => {
  const { filename, mimetype, size } = req.body;
  const user = req.user!;
  
  // 1. Validate Required Fields
  if (!filename || !mimetype || !size) {
    return res.status(400).json({ error: "Missing filename, mimetype, or size" });
  }

  // 2. Validate File Size (50MB limit)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  if (size > MAX_FILE_SIZE) {
    return res.status(413).json({ error: "File too large. Maximum size is 50MB" });
  }

  // 3. Generate Secure Path
  const fileId = uuid();
  const objectName = `invoices/${user.businessId}/${fileId}-${filename}`;
  const bucket = process.env.MINIO_BUCKET!;

  // 4. Validate MIME Type
  const allowedMimes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
  if (!allowedMimes.includes(mimetype)) {
    return res.status(400).json({ error: "Invalid file type" });
  }

  try {
    // 5. Generate Presigned PUT URL (Valid for 5 mins - security best practice)
    const url = await minioClient.presignedPutObject(bucket, objectName, 5 * 60);

    res.json({
      url,         // The signed URL the frontend uses for PUT
      method: "PUT",
      fileId,      // Tracking ID for subsequent notify call
      objectName,  // Path needed for notify call
      headers: { "Content-Type": mimetype },
      expiresIn: 300 // Seconds until URL expires
    });
  } catch (err) {
    logger.error({ msg: "Presigned URL generation failed", err, businessId: user.businessId });
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * NOTIFY UPLOAD COMPLETE
 * 
 * Triggers database record creation and OCR job queuing.
 * Called by frontend AFTER successful upload to MinIO.
 */
router.post("/notify", authenticateUser, async (req, res) => {
  const { objectName, fileId, filename, mimetype, size, jobId: executionId } = req.body;
  const user = req.user!;
  
  if (!objectName || !fileId || !filename || !mimetype || !size) {
    return res.status(400).json({ error: "Missing metadata fields" });
  }

  // 🔒 CRITICAL SECURITY: Verify ownership
  // Prevent User A from triggering OCR for User B's files
  const expectedPrefix = `invoices/${user.businessId}/`;
  if (!objectName.startsWith(expectedPrefix)) {
    logger.warn({ 
      msg: "Unauthorized file access attempt blocked", 
      userId: user.userId,
      businessId: user.businessId,
      attemptedPath: objectName 
    });
    return res.status(403).json({ error: "Unauthorized" });
  }

  // 🔒 VERIFY FILE EXISTS: Prevent orphaned DB records
  try {
    await minioClient.statObject(process.env.MINIO_BUCKET!, objectName);
  } catch (err) {
    logger.error({ 
      msg: "File not found in storage", 
      objectName, 
      businessId: user.businessId,
      err 
    });
    return res.status(404).json({ error: "File not found in storage" });
  }

  const invoiceId = uuid();
  const jobId = executionId || uuid(); // Use provided ID if tracking, or new
  const versionId = uuid();

  try {
     // 1️⃣ ATOMIC DB TRANSACTION via RPC
      const { error: rpcError } = await supabase.rpc("upload_invoice_meta", {
        p_invoice_id: invoiceId,
        p_business_id: user.businessId,
        p_user_id: user.userId,
        p_file_id: fileId,
        p_file_path: objectName,
        p_file_mimetype: mimetype,
        p_file_size: size,
        p_version_id: versionId,
        p_job_id: jobId
      });

      if (rpcError) {
        logger.error({
          msg: "DB Transaction RPC failed (Direct Upload)",
          err: rpcError,
          businessId: user.businessId,
          jobId
        });
        // We do NOT delete the file from MinIO here because client owns it.
        // The sweeper job will clean it up later.
        return res.status(500).json({ error: "Database transaction failed" });
      }

      // 2️⃣ QUEUE JOB
      try {
        await ocrQueue.add("ocr", {
          jobId,
          invoiceId,
          filePath: objectName,
          businessId: user.businessId,
          requestId: req.id || uuid() // Fallback if req.id not set
        });
      } catch (queueError) {
        logger.error({
          msg: "CRITICAL: Job Queueing Failed (Direct Upload)",
          err: queueError,
          jobId,
          invoiceId
        });
        // DB is committed, but queue failed. Rely on rescue worker.
      }

      return res.json({
        message: "Upload confirmed and OCR job queued",
        data: {
          invoiceId,
          jobId,
          status: "QUEUED"
        }
      });

  } catch (err: any) {
    logger.error({ msg: "Notify route fatal error", err, businessId: user.businessId });
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
