"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supabase_js_1 = require("@supabase/supabase-js");
const router = express_1.default.Router();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
/**
 * GET /api/reports/gstr1/summary
 * Query params:
 *  - businessId
 *  - financialYearId
 *  - month (1–12)
 */
router.get("/", async (req, res) => {
    try {
        const { businessId, financialYearId, month } = req.query;
        if (!businessId || !financialYearId || !month) {
            return res.status(400).json({ error: "Missing parameters" });
        }
        const { data, error } = await supabase.rpc("gstr1_monthly_summary", {
            p_business_id: businessId,
            p_financial_year_id: financialYearId,
            p_month: Number(month)
        });
        if (error) {
            console.error("GSTR1 SUMMARY ERROR", error);
            return res.status(500).json({ error: "Failed to generate summary" });
        }
        return res.json(data);
    }
    catch (err) {
        console.error("SUMMARY API ERROR", err);
        return res.status(500).json({ error: "Internal error" });
    }
});
exports.default = router;
