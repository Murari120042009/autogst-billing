import { ExportContext } from "../../exportTypes";
import { fetchGstr1Invoices } from "../exportDispatcher";

export async function generateGstr1Json(ctx: ExportContext) {
  const invoices = await fetchGstr1Invoices(ctx);

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