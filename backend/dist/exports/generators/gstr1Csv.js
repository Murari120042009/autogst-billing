"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateGstr1Csv = generateGstr1Csv;
const exportDispatcher_1 = require("../exportDispatcher");
async function generateGstr1Csv(ctx) {
    const invoices = await (0, exportDispatcher_1.fetchGstr1Invoices)(ctx);
    const headers = [
        "Invoice Number",
        "Invoice Date",
        "Taxable Value",
        "CGST",
        "SGST",
        "IGST",
        "Total"
    ];
    const rows = invoices.map(i => [
        i.invoice_number,
        i.invoice_date,
        i.taxable_value,
        i.cgst,
        i.sgst,
        i.igst,
        i.total
    ]);
    return [headers, ...rows]
        .map(r => r.join(","))
        .join("\n");
}
