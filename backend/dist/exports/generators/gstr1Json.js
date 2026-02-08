"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateGstr1Json = generateGstr1Json;
const exportDispatcher_1 = require("../exportDispatcher");
async function generateGstr1Json(ctx) {
    const invoices = await (0, exportDispatcher_1.fetchGstr1Invoices)(ctx);
    return {
        gstin: "BUSINESS_GSTIN_LATER",
        period: `${ctx.month}/${ctx.financialYearId}`,
        invoices: invoices.map(inv => ({
            invoice_number: inv.invoice_number,
            invoice_date: inv.invoice_date,
            taxable_value: inv.taxable_value,
            cgst: inv.cgst,
            sgst: inv.sgst,
            igst: inv.igst,
            total: inv.total
        }))
    };
}
