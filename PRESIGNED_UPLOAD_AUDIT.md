# 🔍 Presigned Upload Architecture - Production Audit

**Date:** 2026-02-17  
**Status:** ✅ Implementation Complete | ⚠️ Hardening Required

---

## 1️⃣ Backend Flow Verification

### ✅ Current Implementation

```
1. POST /api/upload-direct/presigned
   ├─ Auth: authenticateUser middleware ✅
   ├─ Validates: filename, mimetype ✅
   ├─ Generates: Secure path with businessId isolation ✅
   └─ Returns: Presigned PUT URL (15min expiry) ✅

2. PUT {presignedUrl}
   ├─ Direct to MinIO (bypasses Vercel) ✅
   └─ No auth header (URL is pre-signed) ✅

3. POST /api/upload-direct/notify
   ├─ Auth: authenticateUser middleware ✅
   ├─ Validates: objectName, fileId, metadata ✅
   ├─ DB: Calls upload_invoice_meta RPC ✅
   └─ Queue: Adds OCR job to BullMQ ✅
```

**Verdict:** ✅ Flow is architecturally sound.

---

## 2️⃣ Security & Bug Analysis

### 🔴 CRITICAL Issues

#### Issue #1: Missing Ownership Verification in `/notify`
**Risk:** User A can trigger OCR for User B's file if they know the `objectName`.

**Current Code:**
```typescript
router.post("/notify", authenticateUser, async (req, res) => {
  const { objectName, fileId } = req.body;
  // ❌ No check that objectName belongs to user.businessId
```

**Attack Vector:**
1. User A calls `/presigned` → gets `objectName: invoices/businessA/uuid-file.pdf`
2. User B intercepts/guesses this path
3. User B calls `/notify` with User A's `objectName`
4. System creates invoice record under User B's account pointing to User A's file

**Fix:**
```typescript
// Verify objectName starts with user's businessId
const expectedPrefix = `invoices/${user.businessId}/`;
if (!objectName.startsWith(expectedPrefix)) {
  return res.status(403).json({ error: "Unauthorized file access" });
}
```

#### Issue #2: No File Existence Verification
**Risk:** User can call `/notify` without actually uploading the file.

**Impact:** Creates orphaned DB records, wastes OCR worker time.

**Fix:**
```typescript
// Before DB insert, verify file exists in MinIO
try {
  await minioClient.statObject(process.env.MINIO_BUCKET!, objectName);
} catch (err) {
  return res.status(404).json({ error: "File not found in storage" });
}
```

#### Issue #3: Presigned URL Expiry Too Long
**Current:** 15 minutes  
**Risk:** If URL leaks, attacker has 15min to upload malicious content.

**Recommendation:** Reduce to **5 minutes** for production.

### 🟡 MEDIUM Issues

#### Issue #4: No File Size Limit in `/presigned`
**Risk:** User can request presigned URL for 10GB file, then upload it.

**Fix:**
```typescript
router.post("/presigned", authenticateUser, async (req, res) => {
  const { filename, mimetype, size } = req.body; // Add size
  
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  if (size > MAX_FILE_SIZE) {
    return res.status(413).json({ error: "File too large" });
  }
```

#### Issue #5: Race Condition Window
**Scenario:** User uploads file, but `/notify` fails (network timeout). File exists in MinIO but no DB record.

**Current Mitigation:** Comment says "sweeper job will clean it up" but no sweeper exists.

**Recommendation:** Implement a daily cleanup job:
```sql
-- Find files in MinIO not in DB (older than 24h)
-- Delete them
```

### 🟢 LOW Issues

#### Issue #6: Missing Request ID Propagation
**Current:** `requestId: req.id` assumes `req.id` exists.

**Fix:** Ensure `requestLogger` middleware sets `req.id`, or fallback:
```typescript
requestId: req.id || uuid()
```

---

## 3️⃣ MinIO CORS Configuration

### Required CORS Policy

For presigned uploads to work from browser, MinIO **must** allow:

```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>http://localhost:3000</AllowedOrigin>
    <AllowedOrigin>https://your-production-domain.com</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
  </CORSRule>
</CORSConfiguration>
```

**How to Apply (MinIO CLI):**
```bash
mc anonymous set-json policy.json myminio/autogst-invoices
```

**How to Test:**
```bash
curl -X OPTIONS https://minio.example.com/bucket/test.pdf \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: PUT"
```

Expected: `Access-Control-Allow-Origin: http://localhost:3000`

---

## 4️⃣ Frontend Implementation

### Minimal Working Example

```typescript
// React Component: UploadInvoice.tsx

import { useState } from 'react';
import axios from 'axios';

const UploadInvoice = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');

  const handleUpload = async () => {
    if (!file) return;

    try {
      setStatus('Requesting upload URL...');
      
      // Step 1: Get presigned URL
      const { data: presignData } = await axios.post(
        '/api/upload-direct/presigned',
        {
          filename: file.name,
          mimetype: file.type,
          size: file.size // ⚠️ Add this for size validation
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setStatus('Uploading to storage...');

      // Step 2: Upload directly to MinIO
      // ⚠️ CRITICAL: Do NOT send Authorization header here
      await axios.put(presignData.url, file, {
        headers: {
          'Content-Type': file.type
        },
        onUploadProgress: (e) => {
          const percent = Math.round((e.loaded * 100) / (e.total || 1));
          setStatus(`Uploading: ${percent}%`);
        }
      });

      setStatus('Finalizing...');

      // Step 3: Notify backend
      const { data: result } = await axios.post(
        '/api/upload-direct/notify',
        {
          objectName: presignData.objectName,
          fileId: presignData.fileId,
          filename: file.name,
          mimetype: file.type,
          size: file.size
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setStatus(`✅ Success! Job ID: ${result.data.jobId}`);
    } catch (err: any) {
      setStatus(`❌ Error: ${err.response?.data?.error || err.message}`);
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => setFile(e.files?.[0] || null)} />
      <button onClick={handleUpload} disabled={!file}>Upload</button>
      <p>{status}</p>
    </div>
  );
};
```

### Common Frontend Pitfalls

1. **Sending Auth Header to MinIO** ❌
   ```typescript
   // WRONG
   await axios.put(presignData.url, file, {
     headers: { Authorization: `Bearer ${token}` } // ❌ MinIO will reject
   });
   ```

2. **Wrong Content-Type** ❌
   ```typescript
   // WRONG
   await axios.put(presignData.url, file, {
     headers: { 'Content-Type': 'multipart/form-data' } // ❌ Should match file type
   });
   ```

3. **Not Handling CORS Errors**
   - If you see `CORS policy: No 'Access-Control-Allow-Origin'`, MinIO CORS is not configured.

---

## 5️⃣ Backend Hardening

### Recommended Changes

```typescript
// backend/src/api/directUpload.ts

router.post("/presigned", authenticateUser, async (req, res) => {
  const { filename, mimetype, size } = req.body;
  const user = req.user!;
  
  // ✅ Validate size
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (!size || size > MAX_SIZE) {
    return res.status(413).json({ error: "File size invalid or too large" });
  }
  
  if (!filename || !mimetype) {
    return res.status(400).json({ error: "Missing filename or mimetype" });
  }

  const fileId = uuid();
  const objectName = `invoices/${user.businessId}/${fileId}-${filename}`;
  const bucket = process.env.MINIO_BUCKET!;

  const allowedMimes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
  if (!allowedMimes.includes(mimetype)) {
    return res.status(400).json({ error: "Invalid file type" });
  }

  try {
    // ✅ Reduce expiry to 5 minutes
    const url = await minioClient.presignedPutObject(bucket, objectName, 5 * 60);

    res.json({
      url,
      method: "PUT",
      fileId,
      objectName,
      headers: { "Content-Type": mimetype },
      expiresIn: 300 // Tell frontend when URL expires
    });
  } catch (err) {
    logger.error({ msg: "Presigned URL generation failed", err });
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.post("/notify", authenticateUser, async (req, res) => {
  const { objectName, fileId, filename, mimetype, size } = req.body;
  const user = req.user!;
  
  if (!objectName || !fileId || !filename || !mimetype || !size) {
    return res.status(400).json({ error: "Missing metadata fields" });
  }

  // ✅ CRITICAL: Verify ownership
  const expectedPrefix = `invoices/${user.businessId}/`;
  if (!objectName.startsWith(expectedPrefix)) {
    logger.warn({ 
      msg: "Unauthorized file access attempt", 
      userId: user.userId, 
      objectName 
    });
    return res.status(403).json({ error: "Unauthorized" });
  }

  // ✅ Verify file exists
  try {
    await minioClient.statObject(process.env.MINIO_BUCKET!, objectName);
  } catch (err) {
    logger.error({ msg: "File not found in storage", objectName, err });
    return res.status(404).json({ error: "File not found" });
  }

  const invoiceId = uuid();
  const jobId = uuid();
  const versionId = uuid();

  try {
    const { error: rpcError } = await supabase.rpc("upload_invoice_meta", {
      p_invoice_id: invoiceId,
      p_business_id: user.businessId,
      p_user_id: user.userId,
      p_file_id: fileId,
      p_file_path: objectName,
      p_file_mimetype: mimetype,
      p_file_size: size,
      p_version_id: versionId,
      p_job_id: jobId
    });

    if (rpcError) {
      logger.error({
        msg: "DB Transaction RPC failed",
        err: rpcError,
        businessId: user.businessId,
        jobId
      });
      return res.status(500).json({ error: "Database transaction failed" });
    }

    try {
      await ocrQueue.add("ocr", {
        jobId,
        invoiceId,
        filePath: objectName,
        businessId: user.businessId,
        requestId: req.id || uuid() // ✅ Fallback
      });
    } catch (queueError) {
      logger.error({
        msg: "CRITICAL: Job Queueing Failed",
        err: queueError,
        jobId,
        invoiceId
      });
    }

    return res.json({
      message: "Upload confirmed and OCR job queued",
      data: {
        invoiceId,
        jobId,
        status: "QUEUED"
      }
    });

  } catch (err: any) {
    logger.error({ msg: "Notify route fatal error", err, businessId: user.businessId });
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
```

---

## 6️⃣ Production Safety Checklist

### Pre-Launch

- [ ] **MinIO CORS configured** for production domain
- [ ] **Environment variables set** in Vercel:
  - `MINIO_ENDPOINT` (publicly accessible HTTPS URL)
  - `MINIO_BUCKET`
  - `MINIO_ACCESS_KEY`
  - `MINIO_SECRET_KEY`
- [ ] **Presigned URL expiry** reduced to 5 minutes
- [ ] **File size validation** added to `/presigned`
- [ ] **Ownership verification** added to `/notify`
- [ ] **File existence check** added to `/notify`
- [ ] **Frontend updated** to use new flow
- [ ] **Old `/api/upload` route** deprecated or removed

### Monitoring

- [ ] **Alert on high `/notify` 403 errors** (possible attack)
- [ ] **Alert on high `/notify` 404 errors** (upload failures)
- [ ] **Track presigned URL usage** (requests vs actual uploads)
- [ ] **Monitor orphaned files** in MinIO (files without DB records)

### Testing

```bash
# Test 1: Happy path
curl -X POST http://localhost:4000/api/upload-direct/presigned \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.pdf","mimetype":"application/pdf","size":1024}'

# Test 2: Ownership violation
# Get presigned URL as User A, try to notify as User B (should 403)

# Test 3: Non-existent file
# Call /notify without uploading (should 404)
```

---

## 7️⃣ Vercel-Specific Considerations

### ✅ Advantages Gained
- **No 4.5MB limit** (file goes directly to MinIO)
- **No 10s timeout** (upload happens client-side)
- **Lower bandwidth costs** (Vercel doesn't proxy the file)

### ⚠️ Remaining Limits
- `/presigned` and `/notify` still subject to Vercel function timeout
- These should be fast (<1s each) since they're just metadata operations

### 🔧 Optimization
If `/notify` becomes slow due to DB/Queue operations:
```typescript
// Fire-and-forget pattern
res.json({ message: "Processing..." }); // Respond immediately

// Then do DB + Queue in background
setImmediate(async () => {
  await supabase.rpc(...);
  await ocrQueue.add(...);
});
```

---

## 8️⃣ Summary

| Component | Status | Action Required |
|-----------|--------|-----------------|
| Backend Flow | ✅ Correct | None |
| Auth Protection | ⚠️ Partial | Add ownership check in `/notify` |
| File Validation | ❌ Missing | Add size limit + existence check |
| MinIO CORS | ⚠️ Unknown | Configure and test |
| Frontend Example | ✅ Provided | Implement in React app |
| Monitoring | ❌ Missing | Add alerts for 403/404 errors |

**Estimated Time to Production-Ready:** 2-4 hours (implementing fixes + testing)
