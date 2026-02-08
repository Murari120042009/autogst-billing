"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateItcExcel = generateItcExcel;
const exportDispatcher_1 = require("../exportDispatcher");
async function generateItcExcel(month, year) {
    const invoices = await (0, exportDispatcher_1.fetchItcInvoices)(month, year);
    const summary = invoices.map(invoice => [
        invoice.supplier_gstin,
        invoice.supplier_name,
        invoice.invoice_number,
        invoice.invoice_date,
        invoice.taxable_value,
        invoice.cgst,
        invoice.sgst,
        invoice.igst,
        invoice.cgst + invoice.sgst + invoice.igst,
        invoice.total
    ]);
    return {
        sheetName: "ITC Report",
        columns: [
            "Supplier GSTIN",
            "Supplier Name",
            "Invoice Number",
            "Invoice Date",
            "Taxable Value",
            "CGST",
            "SGST",
            "IGST",
            "Total GST",
            "Total Amount"
        ],
        rows: summary
    };
}
