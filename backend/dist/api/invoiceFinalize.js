"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supabase_js_1 = require("@supabase/supabase-js");
const auditService_1 = require("../services/auditService");
const router = express_1.default.Router();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
router.post("/:invoiceId/finalize", async (req, res) => {
    const { invoiceId } = req.params;
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
    }
    // 1️⃣ Fetch invoice
    const { data: invoice, error: fetchError } = await supabase
        .from("invoices")
        .select("id, status")
        .eq("id", invoiceId)
        .single();
    if (fetchError || !invoice) {
        return res.status(404).json({ error: "Invoice not found" });
    }
    if (invoice.status === "FINALIZED") {
        return res.status(409).json({
            error: "Invoice already finalized"
        });
    }
    // 2️⃣ Update invoice status
    const { error: updateError } = await supabase
        .from("invoices")
        .update({
        status: "FINALIZED",
        finalized_at: new Date()
    })
        .eq("id", invoiceId);
    if (updateError) {
        console.error("FINALIZE INVOICE ERROR >>>", updateError);
        return res.status(500).json({
            error: "Failed to finalize invoice",
            details: updateError
        });
    }
    // 3️⃣ Audit log
    await (0, auditService_1.audit)("invoice", invoiceId, "CORRECTED", userId, {
        from_version: 1,
        to_version: 2
    });
    res.json({
        message: "Invoice finalized successfully"
    });
});
exports.default = router;
