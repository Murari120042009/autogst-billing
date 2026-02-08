import express from "express";
import gstr1SummaryRouter from "./gstr1Summary";
import gstr1InvoicesRouter from "./gstr1Invoices";

const router = express.Router();

router.use("/gstr1/summary", gstr1SummaryRouter);
router.use("/gstr1/invoices", gstr1InvoicesRouter);

export default router;
