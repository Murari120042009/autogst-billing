"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const minio_1 = require("../config/minio");
const ocrQueue_1 = require("../queues/ocrQueue");
const supabase_js_1 = require("@supabase/supabase-js");
const router = express_1.default.Router();
// Supabase service-role client (backend authority)
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// Multer (memory storage)
const upload = (0, multer_1.default)({
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});
router.post("/", upload.array("files", 50), async (req, res) => {
    try {
        const files = req.files;
        const businessId = req.headers["x-business-id"];
        if (!businessId) {
            return res.status(400).json({ error: "Missing business ID" });
        }
        if (!files || files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }
        const created = [];
        for (const file of files) {
            const invoiceId = (0, uuid_1.v4)();
            const jobId = (0, uuid_1.v4)();
            const objectName = `invoices/${businessId}/${invoiceId}-${file.originalname}`;
            // 1️⃣ Upload file to MinIO
            await minio_1.minioClient.putObject(process.env.MINIO_BUCKET, objectName, file.buffer, file.size, {
                "Content-Type": file.mimetype
            });
            // 2️⃣ Insert invoice row
            const { error: invoiceError } = await supabase
                .from("invoices")
                .insert({
                id: invoiceId,
                business_id: businessId,
                status: "PENDING"
            });
            if (invoiceError) {
                console.error("INVOICE INSERT ERROR >>>", JSON.stringify(invoiceError, null, 2));
                return res.status(500).json({
                    error: "Invoice insert failed",
                    details: invoiceError
                });
            }
            // 3️⃣ Insert OCR job row (FULL LOGGING)
            const { data: ocrData, error: ocrError } = await supabase
                .from("invoice_ocr_jobs")
                .insert({
                id: jobId,
                invoice_id: invoiceId,
                file_path: objectName,
                status: "QUEUED"
            })
                .select();
            if (ocrError) {
                console.error("OCR JOB INSERT ERROR >>>", JSON.stringify(ocrError, null, 2));
                return res.status(500).json({
                    error: "OCR job insert failed",
                    details: ocrError
                });
            }
            console.log("OCR JOB INSERTED >>>", ocrData);
            // 4️⃣ Push job to BullMQ
            await ocrQueue_1.ocrQueue.add("ocr", {
                jobId,
                invoiceId,
                filePath: objectName
            });
            created.push({
                invoiceId,
                jobId,
                filePath: objectName
            });
        }
        return res.json({
            message: "Invoices created and OCR jobs queued",
            data: created
        });
    }
    catch (err) {
        console.error("UPLOAD PIPELINE ERROR >>>", err);
        return res.status(500).json({ error: "Upload pipeline failed" });
    }
});
exports.default = router;
