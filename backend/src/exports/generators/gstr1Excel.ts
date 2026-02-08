import { ExportContext } from "../../exportTypes";
import { fetchGstr1Invoices } from "../exportDispatcher";

export async function generateGstr1Excel(ctx: ExportContext) {
  const invoices = await fetchGstr1Invoices(ctx);

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