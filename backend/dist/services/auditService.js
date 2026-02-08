"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.audit = audit;
const supabase_js_1 = require("@supabase/supabase-js");
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function audit(entityType, entityId, action, performedBy, metadata = {}) {
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
