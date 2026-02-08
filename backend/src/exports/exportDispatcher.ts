import { createClient } from "@supabase/supabase-js";
import { ExportContext } from "../exportTypes";
import { generateGstr1Json } from "./generators/gstr1Json";
import { generateGstr1Csv } from "./generators/gstr1Csv";
import { generateGstr1Excel } from "./generators/gstr1Excel";
import { generateGstr3bExcel } from "./generators/gstr3bExcel";
import { generateItcExcel } from "./generators/itcExcel";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function fetchGstr1Invoices(ctx: ExportContext) {
  const { data, error } = await supabase
    .from("report_gstr1_invoices")
    .select("*")
    .eq("export_id", ctx.exportId);

  if (error) throw error;
  return data;
}

export async function fetchGstr3bInvoices(
  month: number,
  year: number
) {
  const { data, error } = await supabase
    .from("invoices")
    .select("gstin, taxable_value, cgst, sgst, igst, total")
    .eq("status", "GST Auto-Corrected")
    .eq("month", month)
    .eq("year", year);

  if (error) throw error;
  return data;
}

export async function fetchItcInvoices(
  month: number,
  year: number
) {
  const { data, error } = await supabase
    .from("invoices")
    .select("supplier_gstin, supplier_name, invoice_number, invoice_date, taxable_value, cgst, sgst, igst, total")
    .eq("invoice_type", "purchase")
    .eq("status", "GST Auto-Corrected")
    .eq("month", month)
    .eq("year", year);

  if (error) throw error;
  return data;
}

export async function generateExport(
  ctx: ExportContext,
  format: "json" | "csv" | "excel"
) {
  if (ctx.exportType === "GSTR1") {
    switch (format) {
      case "json":
        return generateGstr1Json(ctx);
      case "csv":
        return generateGstr1Csv(ctx);
      case "excel":
        return generateGstr1Excel(ctx);
    }
  } else if (ctx.exportType === "GSTR3B") {
    switch (format) {
      case "excel":
        return generateGstr3bExcel(ctx.month, ctx.year);
      default:
        throw new Error("Unsupported format for GSTR-3B");
    }
  } else if (ctx.exportType === "ITC") {
    switch (format) {
      case "excel":
        return generateItcExcel(ctx.month, ctx.year);
      default:
        throw new Error("Unsupported format for ITC");
    }
  } else {
    throw new Error("Unsupported export type");
  }
}