"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const emailOtp_1 = __importDefault(require("./api/emailOtp"));
const upload_1 = __importDefault(require("./api/upload"));
const invoiceCorrection_1 = __importDefault(require("./api/invoiceCorrection")); // ✅ ADD THIS
const invoiceFinalize_1 = __importDefault(require("./api/invoiceFinalize"));
const exports_1 = __importDefault(require("./api/exports"));
const exportFreeze_1 = __importDefault(require("./api/exportFreeze"));
const reports_1 = __importDefault(require("./api/reports"));
const dashboard_1 = __importDefault(require("./api/dashboard"));
const audit_1 = __importDefault(require("./api/audit"));
const invoices_1 = __importDefault(require("./api/invoices"));
const app = (0, express_1.default)();
// ✅ CORS
app.use((0, cors_1.default)({
    origin: "http://localhost:3000",
    credentials: true
}));
// ✅ JSON parser
app.use(express_1.default.json());
app.get("/", (_req, res) => {
    res.send("AutoGST Backend Running");
});
// ✅ ROUTES (unchanged order)
app.use("/api/email-otp", emailOtp_1.default);
app.use("/api/upload", upload_1.default);
// ✅ ONLY REQUIRED ADDITION
app.use("/api/invoices", invoiceCorrection_1.default);
const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
app.use("/api/invoices", invoiceFinalize_1.default);
app.use("/api/exports", exports_1.default);
app.use("/api/exports", exportFreeze_1.default);
app.use("/api/reports", reports_1.default);
app.use("/api/dashboard", dashboard_1.default);
app.use("/api/audit", audit_1.default);
app.use("/api/invoices", invoices_1.default);
