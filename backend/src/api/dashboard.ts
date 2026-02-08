import express from "express";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "../middleware/requirePermission";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
router.get(
  "/invoice-status",
  requirePermission("invoice.view"),
  async (req, res) => {
    const businessId = req.headers["x-business-id"] as string;

    const { data, error } = await supabase
      .from("dashboard_invoice_status")
      .select("*")
      .eq("business_id", businessId);

    if (error) {
      return res.status(500).json({ error: "Failed to fetch data" });
    }

    res.json(data);
  }
);
router.get(
  "/monthly-totals",
  requirePermission("invoice.view"),
  async (req, res) => {
    const businessId = req.headers["x-business-id"] as string;

    const { data, error } = await supabase
      .from("dashboard_monthly_totals")
      .select("*")
      .eq("business_id", businessId)
      .order("month", { ascending: true });

    if (error) {
      return res.status(500).json({ error: "Failed to fetch data" });
    }

    res.json(data);
  }
);
router.get(
  "/ocr-health",
  requirePermission("invoice.view"),
  async (_req, res) => {
    const { data, error } = await supabase
      .from("dashboard_ocr_health")
      .select("*");

    if (error) {
      return res.status(500).json({ error: "Failed to fetch data" });
    }

    res.json(data);
  }
);
router.get(
  "/activity",
  requirePermission("audit.view"),
  async (_req, res) => {
    const { data, error } = await supabase
      .from("dashboard_activity")
      .select("*");

    if (error) {
      return res.status(500).json({ error: "Failed to fetch data" });
    }

    res.json(data);
  }
);
export default router;