import express from "express";
import { createClient } from "@supabase/supabase-js";
import { authenticateUser } from "../middleware/authMiddleware";

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
  authenticateUser,
  async (req, res) => {
    try {
      const user = req.user!;
      const { businessId } = user;

      if (!businessId) {
        return res.status(403).json({
          error: "User is not associated with a business context"
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
  authenticateUser,
  async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const { businessId } = req.user!;

      // 1. Verify Ownership
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("id")
        .eq("id", invoiceId)
        .eq("business_id", businessId)
        .single();

      if (invoiceError || !invoice) {
        return res.status(404).json({
          error: "Invoice not found or access denied" // Security: Ambiguous error message
        });
      }

      // 2. Fetch Version Data
      const { data, error } = await supabase
        .from("invoice_versions")
        .select("version_number, data_snapshot, created_at")
        .eq("invoice_id", invoiceId)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return res.status(404).json({
          error: "Invoice version data not found"
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