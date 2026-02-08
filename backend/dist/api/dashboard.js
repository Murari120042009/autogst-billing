"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supabase_js_1 = require("@supabase/supabase-js");
const requirePermission_1 = require("../middleware/requirePermission");
const router = express_1.default.Router();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
router.get("/invoice-status", (0, requirePermission_1.requirePermission)("invoice.view"), async (req, res) => {
    const businessId = req.headers["x-business-id"];
    const { data, error } = await supabase
        .from("dashboard_invoice_status")
        .select("*")
        .eq("business_id", businessId);
    if (error) {
        return res.status(500).json({ error: "Failed to fetch data" });
    }
    res.json(data);
});
router.get("/monthly-totals", (0, requirePermission_1.requirePermission)("invoice.view"), async (req, res) => {
    const businessId = req.headers["x-business-id"];
    const { data, error } = await supabase
        .from("dashboard_monthly_totals")
        .select("*")
        .eq("business_id", businessId)
        .order("month", { ascending: true });
    if (error) {
        return res.status(500).json({ error: "Failed to fetch data" });
    }
    res.json(data);
});
router.get("/ocr-health", (0, requirePermission_1.requirePermission)("invoice.view"), async (_req, res) => {
    const { data, error } = await supabase
        .from("dashboard_ocr_health")
        .select("*");
    if (error) {
        return res.status(500).json({ error: "Failed to fetch data" });
    }
    res.json(data);
});
router.get("/activity", (0, requirePermission_1.requirePermission)("audit.view"), async (_req, res) => {
    const { data, error } = await supabase
        .from("dashboard_activity")
        .select("*");
    if (error) {
        return res.status(500).json({ error: "Failed to fetch data" });
    }
    res.json(data);
});
exports.default = router;
