"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supabase_js_1 = require("@supabase/supabase-js");
const uuid_1 = require("uuid");
const router = express_1.default.Router();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
/**
 * POST /api/exports/freeze
 * Freeze immutable snapshot of finalized invoice_versions
 */
router.post("/freeze", async (req, res) => {
    try {
        const { businessId, financialYearId, month, exportType, userId } = req.body;
        if (!businessId || !financialYearId || !month || !exportType || !userId) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        // 1️⃣ Fetch finalized invoice versions
        const { data: versions, error: fetchError } = await supabase
            .from("invoice_versions")
            .select("id")
            .eq("is_final", true);
        if (fetchError || !versions || versions.length === 0) {
            return res.status(400).json({ error: "No finalized invoices to export" });
        }
        // 2️⃣ Create export record
        const exportId = (0, uuid_1.v4)();
        const { error: exportError } = await supabase.from("exports").insert({
            id: exportId,
            business_id: businessId,
            financial_year_id: financialYearId,
            month,
            export_type: exportType,
            locked: true,
            created_by: userId
        });
        if (exportError)
            throw exportError;
        // 3️⃣ Link invoice versions
        const links = versions.map(v => ({
            export_id: exportId,
            invoice_version_id: v.id
        }));
        const { error: linkError } = await supabase
            .from("export_invoice_links")
            .insert(links);
        if (linkError)
            throw linkError;
        res.json({
            message: "Export snapshot frozen",
            exportId,
            versionCount: versions.length
        });
    }
    catch (err) {
        console.error("EXPORT FREEZE ERROR", err);
        res.status(500).json({
            error: "Failed to freeze export",
            details: err.message
        });
    }
});
exports.default = router;
