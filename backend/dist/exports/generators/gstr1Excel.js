"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateGstr1Excel = generateGstr1Excel;
const exportDispatcher_1 = require("../exportDispatcher");
async function generateGstr1Excel(ctx) {
    const invoices = await (0, exportDispatcher_1.fetchGstr1Invoices)(ctx);
    // Placeholder object structure (Excel lib later)
    return {
        sheetName: "GSTR-1",
        columns: [
            "Invoice Number",
            "Invoice Date",
            "Taxable Value",
            "CGST",
            "SGST",
            "IGST",
            "Total"
        ],
        rows: invoices.map(i => ({
            invoice_number: i.invoice_number,
            invoice_date: i.invoice_date,
            taxable_value: i.taxable_value,
            cgst: i.cgst,
            sgst: i.sgst,
            igst: i.igst,
            total: i.total
        }))
    };
}
