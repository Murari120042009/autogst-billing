import { ExportContext } from "../../exportTypes";
import { fetchGstr1Invoices } from "../exportDispatcher";

export async function generateGstr1Csv(ctx: ExportContext) {
  const invoices = await fetchGstr1Invoices(ctx);

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