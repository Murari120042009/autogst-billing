import { PDFDocument, StandardFonts } from "pdf-lib";

export async function generateInvoicePDF(data: any) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;

  // HEADER
  page.drawText("TAX INVOICE", { x: 250, y, size: 16, font: bold });
  y -= 20;

  // SELLER DETAILS
  page.drawText("Seller:", { x: 50, y, size: 12, font: bold });
  page.drawText(data.seller.name, { x: 120, y, size: 10, font });
  y -= 14;
  page.drawText(data.seller.address || "", { x: 120, y, size: 10, font });
  y -= 14;
  page.drawText(`GSTIN: ${data.seller.gstin}`, { x: 120, y, size: 10, font });

  // BUYER DETAILS
  y -= 30;
  page.drawText("Buyer:", { x: 50, y, size: 12, font: bold });
  page.drawText(data.buyer.name || "", { x: 120, y, size: 10, font });
  y -= 14;
  page.drawText(data.buyer.address || "", { x: 120, y, size: 10, font });
  y -= 14;
  page.drawText(`GSTIN: ${data.buyer.gstin}`, { x: 120, y, size: 10, font });

  // INVOICE METADATA
  y -= 30;
  page.drawText(`Invoice No: ${data.invoice.number}`, { x: 50, y, size: 10, font });
  page.drawText(`Date: ${data.invoice.date}`, { x: 300, y, size: 10, font });
  page.drawText(`State: ${data.invoice.state}`, { x: 450, y, size: 10, font });

  // TABLE HEADER
  y -= 40;
  page.drawText("S.No", { x: 50, y, size: 10, font: bold });
  page.drawText("Description", { x: 90, y, size: 10, font: bold });
  page.drawText("HSN/SAC", { x: 250, y, size: 10, font: bold });
  page.drawText("Qty", { x: 310, y, size: 10, font: bold });
  page.drawText("Rate", { x: 360, y, size: 10, font: bold });
  page.drawText("CGST", { x: 410, y, size: 10, font: bold });
  page.drawText("SGST", { x: 460, y, size: 10, font: bold });
  page.drawText("IGST", { x: 510, y, size: 10, font: bold });
  page.drawText("Total", { x: 560, y, size: 10, font: bold });

  // TABLE ROWS
  y -= 16;
  data.items.forEach((item: any, i: number) => {
    page.drawText(String(i + 1), { x: 50, y, size: 10, font });
    page.drawText(item.name, { x: 90, y, size: 10, font });
    page.drawText(item.hsn || "", { x: 250, y, size: 10, font });
    page.drawText(String(item.quantity), { x: 310, y, size: 10, font });
    page.drawText(String(item.rate), { x: 360, y, size: 10, font });
    page.drawText(String(item.cgst || 0), { x: 410, y, size: 10, font });
    page.drawText(String(item.sgst || 0), { x: 460, y, size: 10, font });
    page.drawText(String(item.igst || 0), { x: 510, y, size: 10, font });
    page.drawText(String(item.amount), { x: 560, y, size: 10, font });
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

  // FOOTER
  y -= 40;
  page.drawText("Amount in Words:", { x: 50, y, size: 10, font: bold });
  page.drawText(data.amountInWords || "", { x: 150, y, size: 10, font });

  y -= 20;
  page.drawText("Bank Details:", { x: 50, y, size: 10, font: bold });
  page.drawText(data.bankDetails || "", { x: 150, y, size: 10, font });

  y -= 40;
  page.drawText("Declaration:", { x: 50, y, size: 10, font: bold });
  page.drawText(data.declaration || "", { x: 150, y, size: 10, font });

  y -= 40;
  page.drawText("Authorized Signatory", { x: 450, y, size: 10, font });

  return await pdf.save();
}