"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supabase_js_1 = require("@supabase/supabase-js");
const emailOtpService_1 = require("../services/emailOtpService");
const router = express_1.default.Router();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// SEND OTP
router.post("/send", async (req, res) => {
    const { email, purpose } = req.body;
    if (!email || !purpose) {
        return res.status(400).json({ error: "Missing email or purpose" });
    }
    const otp = (0, emailOtpService_1.generateOtp)();
    const otpHash = await (0, emailOtpService_1.hashOtp)(otp);
    const expiresAt = new Date(Date.now() + Number(process.env.OTP_EXPIRY_MINUTES) * 60000).toISOString();
    const { error } = await supabase.from("otps").insert({
        email,
        purpose,
        otp_hash: otpHash,
        expires_at: expiresAt,
        consumed: false
    });
    if (error) {
        console.error("OTP INSERT ERROR:", error);
        return res.status(500).json({ error: "OTP insert failed" });
    }
    await (0, emailOtpService_1.sendEmailOtp)(email, otp);
    res.json({ message: "OTP sent to email" });
});
// VERIFY OTP
router.post("/verify", async (req, res) => {
    const { email, otp, purpose } = req.body;
    if (!email || !otp || !purpose) {
        return res.status(400).json({ error: "Missing fields" });
    }
    const { data, error } = await supabase
        .from("otps")
        .select("*")
        .eq("email", email)
        .eq("purpose", purpose)
        .eq("consumed", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
    if (error || !data) {
        return res.status(400).json({ error: "OTP not found" });
    }
    const valid = await (0, emailOtpService_1.verifyOtp)(otp, data.otp_hash);
    if (!valid) {
        return res.status(400).json({ error: "Invalid OTP" });
    }
    await supabase
        .from("otps")
        .update({ consumed: true })
        .eq("id", data.id);
    res.json({ message: "OTP verified" });
});
exports.default = router;
