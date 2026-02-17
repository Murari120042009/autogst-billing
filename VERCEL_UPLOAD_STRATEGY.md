# ☁️ Vercel File Upload Strategy: The Presigned Pattern

**Status:** Critical for Production Stability
**Target:** Replace Multer streaming with Direct-to-MinIO uploads.

---

## 1️⃣ Diagnosis: Is Vercel Blocking You?

Vercel Serverless Functions have two hard limits. If you hit either, uploads fail *before* your code runs.

### How to Confirm
Open Browser DevTools -> Network Tab -> Upload a file > 4.5MB.

| HTTP Status | Message | Root Cause |
| :--- | :--- | :--- |
| **413** | **Payload Too Large** | File body > 4.5MB. Vercel rejects it immediately. |
| **504** | **Gateway Timeout** | Processing took > 10s (Free) or 60s (Pro). OCR or MinIO transfer was too slow. |
| **500** | **Internal Server Error** | Function crashed (Out of Memory). Node.js ran out of RAM buffering the file. |
| **401/403** | **Unauthorized** | Auth header missing or token invalid. (Not a Vercel limit). |

**Verdict**: If you see **413**, **504**, or random **500s** on large files, you must move to the Presigned URL pattern.

---

## 2️⃣ Architecture: The "Presigned" Flow

Instead of:
`Browser -> [Vercel Node.js (4.5MB Limit)] -> MinIO`

We switch to:
1.  **Browser**: Asks Vercel for "Permission to Upload".
2.  **Vercel**: Validates Auth & returns a signed, temporary Upload URL.
3.  **Browser**: Uploads file DIRECTLY to MinIO/S3 using that URL.
4.  **Browser**: Notifies Vercel "Upload Complete" to trigger OCR.

**Pros**:
*   ✅ No size limits (files go to storage directly).
*   ✅ No Vercel timeouts (storage handles the heavy lifting).
*   ✅ Cheaper (less compute time).

---

## 3️⃣ Backend Implementation (Step 1)

Create a new endpoint `POST /api/upload/presigned` that generates a PUT URL.

```typescript
// backend/src/api/directUpload.ts
import express from "express";
import { v4 as uuid } from "uuid";
import { minioClient } from "../config/minio";
import { authenticateUser } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/presigned", authenticateUser, async (req, res) => {
  const { filename, mimetype } = req.body;
  const user = req.user!;
  
  // 1. Generate Secure Path
  const fileId = uuid();
  const objectName = `invoices/${user.businessId}/${fileId}-${filename}`;
  const bucket = process.env.MINIO_BUCKET!;

  try {
    // 2. Generate Presigned PUT URL (Valid for 5 mins)
    const url = await minioClient.presignedPutObject(bucket, objectName, 5 * 60);

    res.json({
      url,         // The magic URL
      method: "PUT",
      fileId,      // Tracking ID
      objectName,  // Path in bucket
      headers: { "Content-Type": mimetype }
    });
  } catch (err) {
    console.error("Presigned URL Error:", err);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// Notify endpoint to trigger OCR after upload
router.post("/notify", authenticateUser, async (req, res) => {
  const { objectName, fileId } = req.body;
  // ... Insert into DB & Trigger Queue (logic similar to valid parts of old upload.ts) ...
});

export default router;
```

---

## 4️⃣ Frontend Implementation (Step 2)

React Code (using `axios`):

```javascript
/* Frontend Upload Component */

const uploadFile = async (file) => {
  // 1. Get Presigned URL
  const { data: signData } = await axios.post("/api/upload/presigned", {
    filename: file.name,
    mimetype: file.type
  });

  // 2. Direct Upload to Storage
  // IMPORTANT: Do NOT send Authorization header here!
  await axios.put(signData.url, file, {
    headers: { "Content-Type": file.type }
  });

  // 3. Notify Backend to Start OCR
  await axios.post("/api/upload/notify", {
    objectName: signData.objectName,
    fileId: signData.fileId,
    filename: file.name,
    // ... metadata ...
  });
};
```

---

## 5️⃣ Migration Plan

1.  **CORS Setup on MinIO/S3**:
    *   You MUST configure CORS on your bucket to allow `PUT` requests from your frontend domain (`localhost:3000` or production URL).
    *   *MinIO Command*: `mc anonymous set upload myminio/mybucket` (or use Console > Buckets > Settings > Access Rules).
    *   *Real S3*: Add CORS XML/JSON policy allowing `AllowedOrigins: [*]`, `AllowedMethods: [PUT]`.

2.  **Environment Variables**:
    *   Ensure `MINIO_ENDPOINT` is reachable from the Browser (Public URL), not just internal Vercel network. If using Docker locally, `localhost:9000` works. In production, use `https://s3.your-domain.com`.

3.  **Deprecate Multer**:
    *   Once frontend switches, remove `multer` logic from `upload.ts` to save bundle size.

---

## ⚠️ Common Pitfalls

1.  **CORS**: The #1 blocker. If browser says "CORS Error" on the PUT request, your Bucket CORS config is wrong.
2.  **Public Access**: Using `localhost:9000` for MinIO endpoint works for local dev, but for production Vercel, MinIO MUST have a public HTTPS URL (e.g. `https://minio.example.com`).
3.  **Token Leak**: Never include your App's `Authorization: Bearer` token in the `PUT` request to MinIO. The URL itself contains the signature.
