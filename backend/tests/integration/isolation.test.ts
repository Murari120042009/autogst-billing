import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";
import dotenv from "dotenv";

dotenv.config();

// 1. MOCK AUTH MIDDLEWARE
// We mock it to trust a special test header, allowing us to switch users easily.
vi.mock("../../src/middleware/authMiddleware", () => ({
  authenticateUser: (req: any, res: any, next: any) => {
    const testUserHeader = req.headers["x-test-user"];
    if (testUserHeader) {
      req.user = JSON.parse(testUserHeader);
    } else {
      // Default dummy user if header missing
      req.user = { userId: "default", businessId: "default" };
    }
    next();
  },
}));

// Import app AFTER mocking
import { app } from "../../src/index";

// 2. SETUP DATA
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const businessA = uuid(); // The "Victim"
const businessB = uuid(); // The "Attacker"
const invoiceA_ID = uuid();

describe("Multi-Tenant Isolation", () => {
  beforeAll(async () => {
    // Seed DB with Invoice for Business A
    // Note: We bypass RLS using service role key here
    const { error } = await supabase.from("invoices").insert({
      id: invoiceA_ID,
      business_id: businessA,
      status: "PENDING",
      created_at: new Date(),
    });
    
    if (error) {
      console.error("Test Setup Failed:", error);
      throw error;
    }
  });

  afterAll(async () => {
    // Cleanup
    await supabase.from("invoices").delete().eq("business_id", businessA);
    // businessB has no data to clean
  });

  it("Business A should see their own invoice", async () => {
    const userA = { userId: "user-a", businessId: businessA };
    
    const res = await request(app)
      .get("/api/invoices")
      .set("x-test-user", JSON.stringify(userA));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: invoiceA_ID })
      ])
    );
  });

  it("Business B should NOT see Business A's invoice", async () => {
    const userB = { userId: "user-b", businessId: businessB };

    const res = await request(app)
      .get("/api/invoices")
      .set("x-test-user", JSON.stringify(userB));

    expect(res.status).toBe(200);
    // Should return empty array or at least NOT contain invoiceA
    const ids = res.body.map((inv: any) => inv.id);
    expect(ids).not.toContain(invoiceA_ID);
  });

  it("Business B should NOT be able to fetch Business A's invoice by ID", async () => {
    const userB = { userId: "user-b", businessId: businessB };

    const res = await request(app)
      .get(`/api/invoices/${invoiceA_ID}`)
      .set("x-test-user", JSON.stringify(userB));

    // Expect 404 (Not Found) effectively masking existence
    expect(res.status).toBe(404);
  });
});
