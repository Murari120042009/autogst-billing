import { fetchGstr3bInvoices } from "../exportDispatcher";

export async function generateGstr3bExcel(month: number, year: number) {
  const invoices = await fetchGstr3bInvoices(month, year);

  const summary = invoices.reduce(
    (acc, invoice) => {
      acc.taxableValue += invoice.taxable_value;
      acc.cgst += invoice.cgst;
      acc.sgst += invoice.sgst;
      acc.igst += invoice.igst;
      acc.totalGst += invoice.cgst + invoice.sgst + invoice.igst;
      acc.totalInvoiceAmount += invoice.total;
      return acc;
    },
    {
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalGst: 0,
      totalInvoiceAmount: 0
    }
  );

  return {
    sheetName: "GSTR-3B",
    columns: [
      "Taxable Value",
      "CGST",
      "SGST",
      "IGST",
      "Total GST",
      "Total Invoice Amount"
    ],
    rows: [
      [
        summary.taxableValue,
        summary.cgst,
        summary.sgst,
        summary.igst,
        summary.totalGst,
        summary.totalInvoiceAmount
      ]
    ]
  };
}