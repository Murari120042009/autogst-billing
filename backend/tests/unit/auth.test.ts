import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateUser } from "../../src/middleware/authMiddleware";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";

// Mock environment variables
vi.stubEnv("SUPABASE_JWT_SECRET", "test-secret-key");

// Mock dependencies
vi.mock("jsonwebtoken");

describe("Auth Middleware (Unit)", () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: any;

    beforeEach(() => {
        req = {
            headers: {},
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        next = vi.fn();
        vi.clearAllMocks();
    });

    it("should return 401 if no authorization header present", () => {
        authenticateUser(req as Request, res as Response, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 if token format is invalid (no Bearer)", () => {
        req.headers = { authorization: "InvalidToken" };
        authenticateUser(req as Request, res as Response, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it("should call next() and attach user for valid token", () => {
        req.headers = { authorization: "Bearer valid.token.here" };
        
        // Mock JWT verify success
        const mockPayload = {
            sub: "user-123",
            email: "test@example.com",
            aud: "authenticated",
            app_metadata: { business_id: "biz-456" },
        };
        (jwt.verify as any).mockReturnValue(mockPayload);

        authenticateUser(req as Request, res as Response, next);

        expect(jwt.verify).toHaveBeenCalledWith("valid.token.here", "test-secret-key");
        expect((req as any).user).toEqual({
            userId: "user-123",
            email: "test@example.com",
            businessId: "biz-456",
        });
        expect(next).toHaveBeenCalled();
    });

    it("should return 401 if token is expired", () => {
        req.headers = { authorization: "Bearer expired.token" };
        (jwt.verify as any).mockImplementation(() => {
            throw new jwt.TokenExpiredError("jwt expired", new Date());
        });

        authenticateUser(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized: Token expired" });
    });

    it("should return 401 if user audience is invalid", () => {
        req.headers = { authorization: "Bearer wrong.audience" };
        (jwt.verify as any).mockReturnValue({ aud: "public" }); // Expected "authenticated"

        authenticateUser(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized: Invalid audience" });
    });
});
