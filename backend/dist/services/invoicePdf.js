"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoicePDF = generateInvoicePDF;
const pdf_lib_1 = require("pdf-lib");
async function generateInvoicePDF(data) {
    const pdf = await pdf_lib_1.PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const bold = await pdf.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
    let y = 800;
    // SELLER
    page.drawText(data.seller.name, { x: 50, y, size: 14, font: bold });
    y -= 18;
    page.drawText(data.seller.address || "", { x: 50, y, size: 10, font });
    y -= 14;
    page.drawText(`GSTIN: ${data.seller.gstin}`, { x: 50, y, size: 10, font });
    // INVOICE META
    y -= 30;
    page.drawText(`Invoice No: ${data.invoice.number}`, { x: 350, y, size: 10, font });
    y -= 14;
    page.drawText(`Date: ${data.invoice.date}`, { x: 350, y, size: 10, font });
    // BUYER
    y -= 40;
    page.drawText("Bill To:", { x: 50, y, size: 11, font: bold });
    y -= 14;
    page.drawText(data.buyer.name || "", { x: 50, y, size: 10, font });
    y -= 14;
    page.drawText(data.buyer.address || "", { x: 50, y, size: 10, font });
    y -= 14;
    page.drawText(`GSTIN: ${data.buyer.gstin}`, { x: 50, y, size: 10, font });
    // TABLE HEADER
    y -= 30;
    page.drawText("S.No", { x: 50, y, size: 10, font: bold });
    page.drawText("Particulars", { x: 90, y, size: 10, font: bold });
    page.drawText("HSN", { x: 260, y, size: 10, font: bold });
    page.drawText("Qty", { x: 310, y, size: 10, font: bold });
    page.drawText("Rate", { x: 360, y, size: 10, font: bold });
    page.drawText("Amount", { x: 430, y, size: 10, font: bold });
    // ITEMS
    y -= 16;
    data.items.forEach((item, i) => {
        page.drawText(String(i + 1), { x: 50, y, size: 10, font });
        page.drawText(item.name, { x: 90, y, size: 10, font });
        page.drawText(item.hsn || "", { x: 260, y, size: 10, font });
        page.drawText(String(item.quantity), { x: 310, y, size: 10, font });
        page.drawText(String(item.rate), { x: 360, y, size: 10, font });
        page.drawText(String(item.amount), { x: 430, y, size: 10, font });
        y -= 14;
    });
    // TOTALS
    y -= 20;
    page.drawText(`Subtotal: ₹${data.totals.subtotal}`, { x: 360, y, size: 10, font });
    y -= 14;
    page.drawText(`CGST: ₹${data.taxes?.cgst?.amount || 0}`, { x: 360, y, size: 10, font });
    y -= 14;
    page.drawText(`SGST: ₹${data.taxes?.sgst?.amount || 0}`, { x: 360, y, size: 10, font });
    y -= 14;
    page.drawText(`IGST: ₹${data.taxes?.igst?.amount || 0}`, { x: 360, y, size: 10, font });
    y -= 18;
    page.drawText(`Grand Total: ₹${data.totals.grand_total}`, {
        x: 360,
        y,
        size: 12,
        font: bold
    });
    return await pdf.save();
}
