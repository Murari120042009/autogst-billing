import { createClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mock GSTIN dataset for lookup
const mockGstDatabase = [
  { companyName: "ABC Pvt Ltd", gstin: "29ABCDE1234F1Z5", address: "Bangalore, Karnataka" },
  { companyName: "XYZ Ltd", gstin: "27XYZDE5678G1Z6", address: "Mumbai, Maharashtra" }
];

// ✅ EXPORT IS CRITICAL
export async function validateInvoiceGstin(
  invoiceVersionId: string,
  gstin: string,
  businessStateCode: number
): Promise<{ isValid: boolean }> {
  console.log("➡️ GST VALIDATION STARTED");

  const isValid = gstin.length === 15;

  const { error } = await supabase
    .from("gst_validation_logs")
    .insert({
      id: uuid(),
      invoice_version_id: invoiceVersionId,
      gstin,
      status: isValid ? "VERIFIED" : "FAILED",
      reason: isValid ? "GSTIN format valid" : "Invalid GSTIN format"
    });

  if (error) {
    console.error("GST VALIDATION LOG INSERT ERROR >>>", error);
    throw error;
  }

  console.log("✅ GST VALIDATION LOG INSERTED");
  return { isValid };
}

export async function correctGstinUsingCompanyName(
  companyName: string
): Promise<{ gstin: string; address: string } | null> {
  console.log("➡️ GSTIN CORRECTION STARTED");

  // Lookup in mock dataset
  const result = mockGstDatabase.find(entry =>
    entry.companyName.toLowerCase() === companyName.toLowerCase()
  );

  if (result) {
    console.log("✅ GSTIN FOUND IN MOCK DATABASE", result);
    return { gstin: result.gstin, address: result.address };
  }

  // Lookup in Supabase table (if preferred)
  const { data, error } = await supabase
    .from("gst_reference")
    .select("gstin, address")
    .ilike("company_name", companyName);

  if (error) {
    console.error("❌ GSTIN LOOKUP ERROR >>>", error);
    return null;
  }

  if (data && data.length > 0) {
    console.log("✅ GSTIN FOUND IN SUPABASE", data[0]);
    return { gstin: data[0].gstin, address: data[0].address };
  }

  console.log("❌ GSTIN NOT FOUND");
  return null;
}
