import express from "express";
import { createClient } from "@supabase/supabase-js";
import { authenticateUser } from "../middleware/authMiddleware";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * @swagger
 * /api/jobs/{jobId}:
 *   get:
 *     summary: Get OCR Job Status
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: The ID of the OCR job
 *     responses:
 *       200:
 *         description: Job status details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   enum: [QUEUED, PROCESSING, COMPLETED, FAILED]
 *                 progress:
 *                   type: integer
 *                   example: 50
 *                 error:
 *                   type: string
 *                   nullable: true
 *       404:
 *         description: Job not found
 *       403:
 *         description: Access denied (Different tenant)
 */
router.get("/:jobId", authenticateUser, async (req, res) => {
  const { jobId } = req.params as { jobId: string };
  const user = req.user!;
  
  // 1️⃣ VALIDATE JOB_ID FORMAT
  if (!jobId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
    return res.status(400).json({ error: "Invalid Job ID" });
  }

  // 2️⃣ SECURE FETCH (Tenant Scoped by user.businessId)
  /*
  Ideally, the worker populates business_id in the jobs table so we query it directly.
  If your schema links jobs -> invoices -> business_id, use a JOIN.
  For MVP simplicity, we assume RLS policies or direct business_id check.
  */
 
  // Simple Direct Query (assuming jobs have business_id or we check via invoice)
  // Let's assume we fetch by ID and then verify permission/ownership if RLS isn't fully on for this table via API.
  // Actually, let's do a safe join to invoices to verify business ownership if jobs lack business_id column.
  
  const { data: job, error } = await supabase
    .from("invoice_ocr_jobs")
    .select(`
      id,
      status,
      error_message,
      created_at,
      updated_at,
      metadata,
      invoices!inner(business_id)
    `)
    .eq("id", jobId)
    .single();

  if (error || !job) {
    return res.status(404).json({ error: "Job not found" });
  }

  // 3️⃣ VERIFY TENANT OWNERSHIP
  // Ensure the user belongs to the business this job is for
  const invoiceData = job.invoices as any; // Type casting for joined result
  if (invoiceData.business_id !== user.businessId) {
    console.warn(`Unauthorized access attempt: User ${user.userId} (Biz: ${user.businessId}) -> Job ${jobId} (Biz: ${invoiceData.business_id})`);
    return res.status(403).json({ error: "Access denied" });
  }

  // 4️⃣ PUBLIC RESPONSE (Safe Subset)
  return res.json({
    id: job.id,
    status: job.status,
    progress: job.status === "COMPLETED" ? 100 : job.status === "PROCESSING" ? 50 : 0,
    error: job.status === "FAILED" ? job.error_message : null,
    createdAt: job.created_at,
    updatedAt: job.updated_at
  });
});

export default router;
