import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/reports/gstr1/invoices
 */
router.get("/", async (req, res) => {
  try {
    const { businessId, financialYearId, month } = req.query;

    if (!businessId || !financialYearId || !month) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const { data, error } = await supabase
      .from("report_gstr1_invoices")
      .select("*")
      .eq("business_id", businessId)
      .eq("financial_year_id", financialYearId)
      .eq("month", Number(month));

    if (error) {
      console.error("GSTR1 INVOICE LIST ERROR", error);
      return res.status(500).json({ error: "Failed to fetch invoices" });
    }

    return res.json(data);

  } catch (err) {
    console.error("INVOICE LIST API ERROR", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
