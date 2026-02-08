export type ExportType = "GSTR1" | "GSTR3B";

export interface ExportContext {
  exportId: string;
  businessId: string;
  financialYearId: string;
  month: number;
  year: number; // Added for GSTR-3B
  exportType: ExportType;
}