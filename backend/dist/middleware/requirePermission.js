"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
const supabase_js_1 = require("@supabase/supabase-js");
/**
 * ⚠️ PHASE CONTROL
 * RBAC MUST REMAIN DISABLED until Phase 9
 * Flip this to `true` ONLY when:
 * - has_permission RPC is finalized
 * - user auth is enforced everywhere
 * - x-user-id and x-business-id are guaranteed
 */
const RBAC_ENABLED = false;
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
/**
 * Middleware to enforce permission checks
 * Currently gated for future phases
 */
function requirePermission(permission) {
    return async (req, res, next) => {
        try {
            /* ================================
               PHASE 7–8 BYPASS
            ================================= */
            if (!RBAC_ENABLED) {
                return next();
            }
            /* ================================
               PHASE 9+ REAL RBAC
            ================================= */
            const userId = req.body?.userId ||
                req.headers["x-user-id"];
            const businessId = req.headers["x-business-id"];
            if (!userId || !businessId) {
                return res.status(401).json({
                    error: "Unauthorized"
                });
            }
            const { data, error } = await supabase.rpc("has_permission", {
                p_user_id: userId,
                p_business_id: businessId,
                p_permission: permission
            });
            if (error) {
                console.error("RBAC RPC ERROR", error);
                return res.status(500).json({
                    error: "Permission check failed"
                });
            }
            if (data !== true) {
                return res.status(403).json({
                    error: "Permission denied"
                });
            }
            next();
        }
        catch (err) {
            console.error("RBAC MIDDLEWARE ERROR", err);
            return res.status(500).json({
                error: "Internal server error"
            });
        }
    };
}
