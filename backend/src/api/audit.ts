import express from "express";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "../middleware/requirePermission";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

router.get(
  "/",
  requirePermission("audit.view"),
  async (req, res) => {
    const businessId = req.headers["x-business-id"] as string;

    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("metadata->>business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return res.status(500).json({ error: "Failed to fetch audit logs" });
    }

    res.json(data);
  }
);

export default router;