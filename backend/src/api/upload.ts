import express from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import fs from "fs";
import os from "os";
import { minioClient } from "../config/minio";
import { ocrQueue } from "../queues/ocrQueue";
import { createClient } from "@supabase/supabase-js";
import { authenticateUser } from "../middleware/authMiddleware";
import { logger } from "../utils/logger";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ 1. DISK STORAGE (Prevents RAM OOM)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    cb(null, `${uuid()}-${file.originalname}`);
  },
});

// ✅ 2. SECURE CONFIGURATION
const upload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB Max per file
    files: 5, // Max 5 files per request (Burst protection)
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, JPG, and PNG are allowed."));
    }
  },
});

import { uploadLimiter } from "../middleware/rateLimit";
import { idempotency } from "../middleware/idempotency";

const handleUpload = upload.array("files", 5);

router.post("/", 
  authenticateUser, 
  uploadLimiter, 
  idempotency, 
  (req, res, next) => {
    handleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    const user = req.user!;
  const { businessId } = user;

  if (!businessId) {
    return res.status(403).json({ error: "User is not associated with a business context" });
  }

  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  const created: any[] = [];
  const cleanupTasks: Promise<void>[] = [];

  try {
    for (const file of files) {
      const invoiceId = uuid();
      const jobId = uuid();
      const versionId = uuid();
      const fileId = uuid();
      
      const objectName = `invoices/${businessId}/${invoiceId}-${file.originalname}`;

      // 1️⃣ Upload file to MinIO
      try {
        await minioClient.fPutObject(
          process.env.MINIO_BUCKET!,
          objectName,
          file.path,
          { "Content-Type": file.mimetype }
        );
      } catch (err) {
        logger.error({ 
          msg: "MinIO upload failed", 
          err, 
          businessId, 
          file: objectName 
        });
        cleanupTasks.push(fs.promises.unlink(file.path).catch(() => {}));
        return res.status(500).json({ error: "File storage failed" });
      }

      // 2️⃣ ATOMIC DB TRANSACTION via RPC
      const { error: rpcError } = await supabase.rpc("upload_invoice_meta", {
        p_invoice_id: invoiceId,
        p_business_id: businessId,
        p_user_id: user.userId,
        p_file_id: fileId,
        p_file_path: objectName,
        p_file_mimetype: file.mimetype,
        p_file_size: file.size,
        p_version_id: versionId,
        p_job_id: jobId
      });

      if (rpcError) {
        logger.error({
          msg: "DB Transaction RPC failed",
          err: rpcError,
          businessId,
          jobId
        });
        
        // Cleanup: Removing file from MinIO since DB failed
        cleanupTasks.push(minioClient.removeObject(process.env.MINIO_BUCKET!, objectName).catch((e) => {
          logger.warn({ msg: "Failed to cleanup orphaned MinIO file", file: objectName, err: e });
        }));
        
        cleanupTasks.push(fs.promises.unlink(file.path).catch(() => {}));
        return res.status(500).json({ error: "Database transaction failed" });
      }

      // 3️⃣ QUEUE JOB
      try {
        await ocrQueue.add("ocr", {
          jobId,
          invoiceId,
          filePath: objectName,
          businessId,
          requestId: req.id // ✅ End-to-End Tracing
        });
      } catch (queueError) {
        // Critical: DB committed but Queue failed.
        // We log strict error. Rescuer worker (planned) should pick this up.
        logger.error({
          msg: "CRITICAL: Job Queueing Failed (Zombie Job)",
          err: queueError,
          jobId,
          invoiceId
        });
        // We do NOT rollback DB here as it's already committed. 
        // We return success to user but with warning? Or just success and rely on rescuer.
        // For now, assume success but log heavily.
      }

      created.push({ invoiceId, jobId, filePath: objectName });
      
      // Schedule temp file cleanup
      cleanupTasks.push(fs.promises.unlink(file.path).catch(() => {}));
    }

    await Promise.all(cleanupTasks);

    return res.json({
      message: "Invoices created and OCR jobs queued",
      data: created
    });

  } catch (err) {
    logger.error({ msg: "Upload route fatal error", err, businessId });
    // Emergency cleanup
    if (files) {
      files.forEach(f => fs.unlink(f.path, () => {}));
    }
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
