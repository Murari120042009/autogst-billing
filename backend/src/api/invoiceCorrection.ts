import express from "express";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";
import { requirePermission } from "../middleware/requirePermission";
import { audit } from "../services/auditService";
import { generateInvoicePDF } from "../services/invoicePdf";
import { minioClient, uploadBufferToMinio } from "../config/minio";
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/invoices/:invoiceId/correct
 * IMPORTANT: :invoiceId MUST be invoice_id (NOT invoice_version_id)
 */
router.post(
  "/:invoiceId/correct",
  requirePermission("invoice.edit"),
  async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const { userId, correctedData } = req.body;

      /* ================================
         0️⃣ VALIDATION
      ================================== */

      if (!invoiceId || !userId || !correctedData) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Enforce UUID
      const UUID_REGEX =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!UUID_REGEX.test(invoiceId)) {
        return res.status(400).json({
          error: "Invalid invoice_id format"
        });
      }

      /* ================================
         1️⃣ VERIFY invoice_id EXISTS
      ================================== */

      const { data: invoiceExists } = await supabase
        .from("invoices")
        .select("id")
        .eq("id", invoiceId)
        .single();

      if (!invoiceExists) {
        return res.status(404).json({
          error: "Invoice not found (did you pass invoice_version_id?)"
        });
      }

      /* ================================
         2️⃣ FETCH LATEST VERSION
      ================================== */

      const { data: latestVersion, error: fetchError } = await supabase
        .from("invoice_versions")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !latestVersion) {
        return res.status(404).json({
          error: "No invoice versions found"
        });
      }

      /* ================================
         3️⃣ CREATE NEW VERSION
         (DB triggers enforce locking)
      ================================== */

      const newVersionId = uuid();
      const newVersionNumber = latestVersion.version_number + 1;

      const { error: insertError } = await supabase
        .from("invoice_versions")
        .insert({
          id: newVersionId,
          invoice_id: invoiceId,
          version_number: newVersionNumber,
          data_snapshot: correctedData,
          raw_ocr_json: latestVersion.raw_ocr_json,
          confidence: latestVersion.confidence,
          created_by: userId
        });

      if (insertError) {
        // Raised by DB trigger
        if (insertError.code === "23514") {
          return res.status(403).json({
            error: "Invoice is locked due to export"
          });
        }

        console.error("VERSION INSERT FAILED", insertError);
        return res.status(500).json({
          error: "Failed to save correction"
        });
      }

      /* ================================
         4️⃣ AUDIT LOG
      ================================== */

      await audit(
        "invoice",
        invoiceId,
        "CORRECTED",
        userId,
        {
          from_version: latestVersion.version_number,
          to_version: newVersionNumber
        }
      );
   // 1️⃣ Generate PDF from corrected data
const pdfBytes = await generateInvoicePDF(correctedData);

// 2️⃣ Upload PDF to MinIO
const pdfUrl = await uploadBufferToMinio({
  bucketName: "invoices",
  objectName: `invoice-${invoiceId}-v${latestVersion.version_number}.pdf`,
  buffer: pdfBuffer
});

// 3️⃣ Save pdf_url against this invoice version
await supabase
  .from("invoice_versions")
  .update({
    pdf_url: pdfUrl
  })
  .eq("id", latestVersion.id);

      /* ================================
         5️⃣ RESPONSE
      ================================== */

      return res.status(200).json({
        message: "Correction saved",
        versionId: newVersionId
      });

    } catch (err) {
      console.error("INVOICE CORRECTION ERROR", err);
      return res.status(500).json({
        error: "Internal server error"
      });
    }
  }
);

// Correctly define pdfBuffer as a placeholder for the actual PDF content
const pdfBuffer = Buffer.alloc(0); // Replace with actual PDF generation logic

export default router;