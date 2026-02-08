import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function audit(
  entityType: string,
  entityId: string,
  action: string,
  performedBy: string,
  metadata: Record<string, any> = {}
) {
  const { error } = await supabase.rpc("write_audit_log", {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_action: action,
    p_performed_by: performedBy,
    p_metadata: metadata
  });

  if (error) {
    console.error("AUDIT WRITE FAILED", error);
    throw error;
  }
}