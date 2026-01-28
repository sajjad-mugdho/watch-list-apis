import { Request, Response, NextFunction } from "express";
import { customGetAuth } from "../middleware/customClerkMw";
import { fetchAndSyncLocalUser } from "../utils/user";
import { ApiResponse } from "../types";
import { AuthenticationError } from "../utils/errors";

/**
 * Get current authenticated user state (canonical bootstrap endpoint)
 * GET /api/v1/me
 *
 * This endpoint ALWAYS returns DB-backed user state to ensure consistency
 * across web and mobile clients during bootstrap. Session claims are used
 * as a fast-path optimization, but we fall back to DB when stale/missing.
 *
 * Use cases:
 * - Client bootstrap after Clerk authentication
 * - Verify onboarding status before showing app UI
 * - Get fresh merchant status after Finix approval
 */
export const me_get = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> => {
  try {
    const auth = customGetAuth(req) as any;
    if (!auth?.userId) {
      throw new AuthenticationError("Unauthorized");
    }

    // req.user is already attached by requirePlatformAuth() middleware
    // It contains either session claims (fast path) or DB-backed claims (fallback)
    const claims = (req as any).user;

    if (!claims) {
      // Defensive fallback: if middleware somehow didn't attach user, query DB
      const freshClaims = await fetchAndSyncLocalUser({
        external_id: auth.userId,
      });
      (req as any).user = { userId: auth.userId, ...freshClaims };
    }

    const response: ApiResponse<any> = {
      data: (req as any).user,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Force refresh user session claims from database
 * POST /api/v1/auth/refresh
 *
 * This endpoint forces a DB lookup and syncs the result back to Clerk
 * session claims (best-effort). Used after onboarding completion or
 * merchant approval to ensure client has latest state.
 *
 * Use cases:
 * - After completing platform onboarding
 * - After Finix merchant approval webhook
 * - When client detects stale session claims
 */
export const auth_refresh_post = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> => {
  try {
    const auth = customGetAuth(req) as any;
    if (!auth?.userId) {
      throw new AuthenticationError("Unauthorized");
    }

    // Force DB lookup (skip session claims)
    const claims = await fetchAndSyncLocalUser({
      external_id: auth.userId,
    });

    const response: ApiResponse<any> = {
      data: claims,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
};
