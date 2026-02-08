import express from "express";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "../middleware/requirePermission";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/invoices
 * List invoices for dashboard
 */
router.get(
  "/",
  requirePermission("invoice.view"),
  async (req, res) => {
    try {
      const businessId = req.headers["x-business-id"];

      if (!businessId) {
        return res.status(400).json({
          error: "Missing x-business-id header"
        });
      }

      const { data, error } = await supabase
        .from("invoices")
        .select("id, status, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return res.json(data);
    } catch (err) {
      console.error("FETCH INVOICES FAILED", err);
      return res.status(500).json({
        error: "Failed to fetch invoices"
      });
    }
  }
);

/**
 * GET /api/invoices/:invoiceId
 * Fetch latest invoice version (preview)
 */
router.get(
  "/:invoiceId",
  requirePermission("invoice.view"),
  async (req, res) => {
    try {
      const { invoiceId } = req.params;

      const { data, error } = await supabase
        .from("invoice_versions")
        .select("version_number, data_snapshot, created_at")
        .eq("invoice_id", invoiceId)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return res.status(404).json({
          error: "Invoice not found"
        });
      }

      return res.json(data);
    } catch (err) {
      console.error("FETCH INVOICE FAILED", err);
      return res.status(500).json({
        error: "Failed to fetch invoice"
      });
    }
  }
);

export default router;