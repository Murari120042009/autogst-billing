# 🐞 Debugging File Upload Failures (AutoGST Billing)

**Symptom:** "Upload Failed" on Frontend.
**Stack:** React -> Node/Express (Vercel) -> MinIO/Supabase.

Follow these steps in order.

---

## 1️⃣ Phase 1: Browser Network Tab (The "What")
*Open DevTools (F12) -> Network Tab -> filter by `XHR/Fetch` -> Attempt Upload.*

| Status Code | Likely Cause | Investigation Step |
| :--- | :--- | :--- |
| **413** | **Payload Too Large** | **Vercel Limit (4.5MB)** or Multer Limit. See Phase 2. |
| **504** | **Gateway Timeout** | Vercel Function timed out (10s limit). File took too long to process. |
| **401** | **Unauthorized** | JWT missing/expired. Check `Authorization: Bearer <token>` header. |
| **403** | **Forbidden** | Valid token, but valid `business_id` missing in metadata. |
| **400** | **Bad Request** | Multer rejection (Wrong file type? Field name mismatch?). Check Response JSON. |
| **500** | **Internal Error** | Code crash, MinIO down, or DB transaction failed. Check Server Logs. |
| **CORS Error** | **CORS** | Browser Console will show red text. Backend URL mismatch. |

---

## 2️⃣ Phase 2: The "Vercel Trap" (Deployment) 🚨 **High Probability**

Vercel Serverless Functions have strict limits that often break file uploads.

1.  **Body Size Limit (4.5MB)**:
    *   **Check**: Is your file > 4.5MB?
    *   **Fix**: Vercel functions generally **cannot** handle large multipart uploads directly.
    *   **Workaround**: Use **Client-Side Presigned URLs** (Upload directly to MinIO/S3 from React, bypass Node for the file body).
    *   **Config Fix (If under 4.5MB)**: Ensure `body-parser` or `express.json()` isn't interfering before Multer.

2.  **Timeout (10s - 60s)**:
    *   **Check**: Does it spin for exactly 10s or 60s then fail?
    *   **Fix**: Optimize `upload.ts`. Do not wait for OCR. We already use a Queue (Fire & Forget), so this should be fast. Ensure `await ocrQueue.add` isn't hanging (Redis connection).

---

## 3️⃣ Phase 3: Auth & Multer (The Guard)

1.  **JWT Header**:
    *   Inspect Request Header: `Authorization: Bearer ewJhbGci...`
    *   If `null` or `undefined`, Frontend Auth Context isn't passing the token.

2.  **Multer Configuration**:
    *   **Field Name**: Frontend must send `FormData` with field `"files"`.
        ```javascript
        const formData = new FormData();
        formData.append("files", fileObj); // MUST match upload.array("files")
        ```
    *   **MIME Type**: We whitelist `application/pdf`, `image/jpeg`, `image/png`.
    *   **Check**: Try uploading a small, valid JPG. If that works, it's a file-specific issue.

---

## 4️⃣ Phase 4: Infrastructure (The Backend)

If you get a **500**, check the Vercel/Server Logs.

1.  **MinIO Connectivity**:
    *   Is `MINIO_ENDPOINT` reachable from the Vercel environment?
    *   *Self-hosted MinIO* often has firewall issues when accessed from Vercel's public IP.

2.  **Supabase Transaction**:
    *   We use an RPC `upload_invoice_meta`. If RLS is enabled but policies are missing for `INSERT`, this might fail (though technically `SECURITY DEFINER` should bypass request-auth RLS, provided the service role or generic role has permissions).

3.  **Redis (Queue)**:
    *   If `ocrQueue.add()` fails, the whole request fails (we catch and return 500).
    *   Check `REDIS_URL`. Redis must be publicly accessible (with password) if backend is on Vercel.

---

## 🚀 Quick Fixes

*   **If 413 (Vercel)**: Switch to Client-Direct Upload or reduce file size.
*   **If 400 (Multer)**: Verify `formData.append("files", ...)` in React.
*   **If 500 (Redis)**: Verify Redis connection string in Vercel Environment Variables.
