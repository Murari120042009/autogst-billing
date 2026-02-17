import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/index";
import path from "path";
import { v4 as uuid } from "uuid";
import fs from "fs";

// Mock dependencies (MinIO, DB, Queue)
vi.mock("../../src/config/minio", () => ({
    minioClient: {
        fPutObject: vi.fn().mockResolvedValue("etag"),
        getObject: vi.fn(),
    }
}));

// Mock Auth Middleware to bypass real JWT checks
vi.mock("../../src/middleware/authMiddleware", () => ({
    authenticateUser: (req: any, res: any, next: any) => {
        req.user = { 
            userId: "test-user-123", 
            businessId: "test-business-xyz",
            email: "test@example.com"
        };
        next();
    }
}));

// Mock Supabase RPC (since we use it for upload_invoice_meta)
vi.mock("@supabase/supabase-js", () => {
    return {
        createClient: () => ({
            rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
            from: () => ({
                select: () => ({ eq: () => ({ single: () => ({ data: {} }) }) }),
                insert: () => ({ error: null }),
                update: () => ({ eq: () => ({ error: null }) })
            })
        })
    };
});

// Mock Queue
vi.mock("../../src/queues/ocrQueue", () => ({
    ocrQueue: {
        add: vi.fn().mockResolvedValue({ id: "job-123" })
    }
}));

describe("POST /api/upload", () => {
    const testFilePath = path.join(__dirname, "test-invoice.pdf");

    beforeAll(() => {
        // Create dummy file
        fs.writeFileSync(testFilePath, "dummy pdf content");
    });

    afterAll(() => {
        if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    });

    it("should upload a file successfully", async () => {
        const res = await request(app)
            .post("/api/upload")
            .attach("files", testFilePath);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.message).toContain("Invoices created");
    });

    it("should fail gracefully if file is missing", async () => {
        const res = await request(app)
            .post("/api/upload");
            
        expect(res.status).toBe(400); // Bad Request
    });
});
