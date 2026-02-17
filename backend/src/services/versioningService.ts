import { createClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";

// Assume we have this from context
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PRODUCTION-SAFE INVOICE VERSION INSERT
 * 
 * Strategy:
 * 1. Read latest version.
 * 2. Try to insert (MAX + 1).
 * 3. If duplicate error (23505) -> Retry once.
 */
export async function createNewInvoiceVersion(
  invoiceId: string, 
  rawData: any, 
  userId: string
) {
  const MAX_RETRIES = 2; // Small retry, usually succeeds immediately

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // 1️⃣ READ LATEST VERSION (Optimistic)
      const { data: latest, error: fetchError } = await supabase
        .from("invoice_versions")
        .select("version_number")
        .eq("invoice_id", invoiceId)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();
      
      // If none, start at 1
      const nextVersion = latest ? latest.version_number + 1 : 1;

      // 2️⃣ ATTEMPT INSERT
      const { data, error } = await supabase
        .from("invoice_versions")
        .insert({
          id: uuid(),
          invoice_id: invoiceId,
          version_number: nextVersion,
          data_snapshot: rawData,
          created_by: userId,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        // 3️⃣ HANDLE DUPLICATE (Race Condition Caught)
        if (error.code === "23505") { // unique_violation (Postgres code)
          console.warn(`RACE CONDITION: Version ${nextVersion} exists. Retrying...`);
          continue; // Loop again -> fetch new MAX -> try insert
        }
        throw new Error(`Insert failed: ${error.message}`);
      }

      return data; // Success!

    } catch (err: any) {
      if (attempt === MAX_RETRIES - 1) {
        console.error("MAX RETRIES EXCEEDED for versioning", err);
        throw new Error("Could not create version due to high concurrency. Please try again.");
      }
    }
  }
}
