"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchGstr1Invoices = fetchGstr1Invoices;
exports.fetchGstr3bInvoices = fetchGstr3bInvoices;
exports.fetchItcInvoices = fetchItcInvoices;
exports.generateExport = generateExport;
const supabase_js_1 = require("@supabase/supabase-js");
const gstr1Json_1 = require("./generators/gstr1Json");
const gstr1Csv_1 = require("./generators/gstr1Csv");
const gstr1Excel_1 = require("./generators/gstr1Excel");
const gstr3bExcel_1 = require("./generators/gstr3bExcel");
const itcExcel_1 = require("./generators/itcExcel");
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function fetchGstr1Invoices(ctx) {
    const { data, error } = await supabase
        .from("report_gstr1_invoices")
        .select("*")
        .eq("export_id", ctx.exportId);
    if (error)
        throw error;
    return data;
}
async function fetchGstr3bInvoices(month, year) {
    const { data, error } = await supabase
        .from("invoices")
        .select("gstin, taxable_value, cgst, sgst, igst, total")
        .eq("status", "GST Auto-Corrected")
        .eq("month", month)
        .eq("year", year);
    if (error)
        throw error;
    return data;
}
async function fetchItcInvoices(month, year) {
    const { data, error } = await supabase
        .from("invoices")
        .select("supplier_gstin, supplier_name, invoice_number, invoice_date, taxable_value, cgst, sgst, igst, total")
        .eq("invoice_type", "purchase")
        .eq("status", "GST Auto-Corrected")
        .eq("month", month)
        .eq("year", year);
    if (error)
        throw error;
    return data;
}
async function generateExport(ctx, format) {
    if (ctx.exportType === "GSTR1") {
        switch (format) {
            case "json":
                return (0, gstr1Json_1.generateGstr1Json)(ctx);
            case "csv":
                return (0, gstr1Csv_1.generateGstr1Csv)(ctx);
            case "excel":
                return (0, gstr1Excel_1.generateGstr1Excel)(ctx);
        }
    }
    else if (ctx.exportType === "GSTR3B") {
        switch (format) {
            case "excel":
                return (0, gstr3bExcel_1.generateGstr3bExcel)(ctx.month, ctx.year);
            default:
                throw new Error("Unsupported format for GSTR-3B");
        }
    }
    else if (ctx.exportType === "ITC") {
        switch (format) {
            case "excel":
                return (0, itcExcel_1.generateItcExcel)(ctx.month, ctx.year);
            default:
                throw new Error("Unsupported format for ITC");
        }
    }
    else {
        throw new Error("Unsupported export type");
    }
}
