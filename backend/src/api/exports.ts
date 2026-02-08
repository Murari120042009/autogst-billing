import express from "express";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";
import { requirePermission } from "../middleware/requirePermission";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/exports/freeze
 */
router.post(
  "/freeze",
  requirePermission("invoice.export"),
  async (req, res) => {
    try {
      const {
        businessId,
        financialYearId,
        month,
        exportType,
        userId
      } = req.body;

      if (!businessId || !financialYearId || !month || !exportType || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const exportId = uuid();

      /* ================================
         1️⃣ CREATE EXPORT RECORD
      ================================== */
      const { error: exportError } = await supabase
        .from("exports")
        .insert({
          id: exportId,
          business_id: businessId,
          financial_year_id: financialYearId,
          month,
          export_type: exportType,
          created_by: userId,
          is_locked: true
        });

      if (exportError) throw exportError;

      /* ================================
         2️⃣ FETCH LATEST INVOICE VERSIONS
         (DB IS AUTHORITY)
      ================================== */
      const { data: versions, error: versionsError } = await supabase.rpc(
        "get_latest_invoice_versions_for_business",
        { p_business_id: businessId }
      );

      if (versionsError) throw versionsError;

      const safeVersions = versions ?? [];

      /* ================================
         3️⃣ LINK SNAPSHOT TO EXPORT
      ================================== */
      if (safeVersions.length > 0) {
        const links = safeVersions.map((v: any) => ({
          export_id: exportId,
          invoice_version_id: v.invoice_version_id
        }));

        const { error: linkError } = await supabase
          .from("export_invoice_links")
          .insert(links);

        if (linkError) throw linkError;
      }

      /* ================================
         4️⃣ RESPONSE
      ================================== */
      return res.status(200).json({
        message: "Export snapshot frozen",
        exportId,
        versionCount: safeVersions.length
      });

    } catch (err: any) {
      console.error("EXPORT FREEZE FAILED", err);
      return res.status(500).json({
        error: "Failed to freeze export",
        details: err
      });
    }
  }
);

/**
 * GET /api/exports/audit
 */
router.get(
  "/audit",
  requirePermission("audit.view"),
  async (req, res) => {
    // EXISTING LOGIC — DO NOT TOUCH
    return res.status(501).json({ error: "Not implemented" });
  }
);

export default router;