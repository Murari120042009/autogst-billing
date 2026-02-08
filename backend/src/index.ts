import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import emailOtpRouter from "./api/emailOtp";
import uploadRouter from "./api/upload";
import invoiceCorrectionRouter from "./api/invoiceCorrection"; // ✅ ADD THIS
import invoiceFinalizeRouter from "./api/invoiceFinalize";
import exportRouter from "./api/exports";
import exportFreezeRouter from "./api/exportFreeze";
import reportsRouter from "./api/reports";
import dashboardRouter from "./api/dashboard";
import auditRouter from "./api/audit";
import invoicesRouter from "./api/invoices";
const app = express();

// ✅ CORS
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true
  })
);

// ✅ JSON parser
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("AutoGST Backend Running");
});

// ✅ ROUTES (unchanged order)
app.use("/api/email-otp", emailOtpRouter);
app.use("/api/upload", uploadRouter);

// ✅ ONLY REQUIRED ADDITION
app.use("/api/invoices", invoiceCorrectionRouter);

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
app.use("/api/invoices", invoiceFinalizeRouter);
app.use("/api/exports", exportRouter);
app.use("/api/exports", exportFreezeRouter);

app.use("/api/reports", reportsRouter);

app.use("/api/dashboard", dashboardRouter);
app.use("/api/audit", auditRouter)
app.use("/api/invoices", invoicesRouter);
