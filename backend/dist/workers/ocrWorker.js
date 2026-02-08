"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const bullmq_1 = require("bullmq");
const redis_1 = require("../queues/redis");
const supabase_js_1 = require("@supabase/supabase-js");
const uuid_1 = require("uuid");
const gstValidationService_1 = require("../services/gstValidationService");
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("🚀 OCR WORKER BOOTING...");
new bullmq_1.Worker("ocr", async (job) => {
    console.log("📥 JOB RECEIVED", job.data);
    const { jobId, invoiceId } = job.data;
    // 🔹 Simulated OCR output
    const rawOcr = {
        invoice_number: "INV-001",
        invoice_date: "2026-02-05",
        taxable_value: 1000,
        cgst: 90,
        sgst: 90,
        total: 1180
    };
    const confidence = 0.92;
    // ✅ DEFINE ONCE
    const versionId = (0, uuid_1.v4)();
    console.log("➡️ INSERTING INVOICE VERSION");
    // 1️⃣ Insert invoice version
    const { error: versionError } = await supabase
        .from("invoice_versions")
        .insert({
        id: versionId,
        invoice_id: invoiceId,
        version_number: 1,
        data_snapshot: rawOcr,
        raw_ocr_json: rawOcr,
        confidence,
        created_by: "00000000-0000-0000-0000-000000000001"
    });
    if (versionError) {
        console.error("❌ INVOICE VERSION INSERT ERROR >>>", versionError);
        throw versionError;
    }
    console.log("✅ INVOICE VERSION INSERTED");
    console.log("➡️ BEFORE GST VALIDATION");
    // 2️⃣ GST Validation (CORRECT TARGET)
    const gstValidationResult = await (0, gstValidationService_1.validateInvoiceGstin)(versionId, "29ABCDE1234F1Z5", 29);
    if (gstValidationResult === undefined || !gstValidationResult.isValid) {
        console.log("➡️ ATTEMPTING GSTIN CORRECTION");
        const correction = await (0, gstValidationService_1.correctGstinUsingCompanyName)("ABC Pvt Ltd");
        if (correction) {
            console.log("✅ GSTIN CORRECTED", correction);
            await supabase
                .from("invoices")
                .update({
                gstin: correction.gstin,
                address: correction.address,
                status: "GST Auto-Corrected"
            })
                .eq("id", invoiceId);
        }
        else {
            console.log("❌ GSTIN CORRECTION FAILED");
            await supabase
                .from("invoices")
                .update({ status: "Needs Review" })
                .eq("id", invoiceId);
        }
    }
    console.log("✅ AFTER GST VALIDATION");
    // 3️⃣ Mark OCR job completed
    await supabase
        .from("invoice_ocr_jobs")
        .update({
        status: "COMPLETED",
        processed_at: new Date()
    })
        .eq("id", jobId);
    // 4️⃣ Update invoice status
    await supabase
        .from("invoices")
        .update({ status: "NEEDS_REVIEW" })
        .eq("id", invoiceId);
    console.log("🎉 OCR PIPELINE FINISHED", jobId);
}, {
    connection: redis_1.redisConnection
});
