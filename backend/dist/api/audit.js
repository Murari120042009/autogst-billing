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
router.get("/", (0, requirePermission_1.requirePermission)("audit.view"), async (req, res) => {
    const businessId = req.headers["x-business-id"];
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
});
exports.default = router;
