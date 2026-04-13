import { Request, Response, NextFunction } from "express";
import { requireCompletedOnboarding } from "../../src/middleware/authentication";
import {
  AuthenticationError,
  AuthorizationError,
} from "../../src/utils/errors";

describe("requireCompletedOnboarding middleware", () => {
  let req: any;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {};
    next = jest.fn();
  });

  it("should allow users with completed onboarding", async () => {
    req.user = {
      userId: "user_test123",
      dialist_id: "507f1f77bcf86cd799439011",
      onboarding_status: "completed",
    };

    const middleware = requireCompletedOnboarding();
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(); // No error passed
  });

  it("should reject users with incomplete onboarding", async () => {
    req.user = {
      userId: "user_test123",
      dialist_id: "507f1f77bcf86cd799439011",
      onboarding_status: "incomplete",
    };

    const middleware = requireCompletedOnboarding();
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error.message).toContain("User onboarding must be completed");
  });

  it("should reject unauthenticated users", async () => {
    req.user = undefined;

    const middleware = requireCompletedOnboarding();
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error.message).toContain("Unauthorized");
  });
});
