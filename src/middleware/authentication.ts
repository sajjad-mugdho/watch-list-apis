import { Request, Response, NextFunction } from "express";
import {
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  AppError,
} from "../utils/errors";
import { customGetAuth } from "./customClerkMw";
import { RequestUserFromAuthSchema } from "../validation/schemas";
import { fetchAndSyncLocalUser } from "../utils/user"; // adjust path as needed

/**
 * Authentication & Authorization Middleware
 *
 * Available middleware functions:
 * 1. requirePlatformAuth() - Base authentication for all authenticated routes
 * 2. requireCompletedOnboarding() - Ensures user has completed onboarding (for buyers)
 *
 * Usage example for order routes:
 *   router.use(requirePlatformAuth());
 *   router.use(requireCompletedOnboarding()); // Buyers must complete onboarding to purchase
 */

const SKIP_PATHS: string[] = ["/health", "/public"];

// ------------------------------------------------------------------
// Base auth for a platform user access
// Validates: user auth, claims presence, dialist_id format.
// ------------------------------------------------------------------
export function requirePlatformAuth() {
  return async function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ) {
    try {
      // Optionally allow public paths
      const fullPath = req.baseUrl + req.path;
      if (SKIP_PATHS.some((p) => fullPath.startsWith(p))) return next();

      // Must have a Clerk user
      const auth = customGetAuth(req) as any;
      if (!auth?.userId) throw new AuthenticationError("Unauthorized");

      // Check for x-refresh-session header to force DB fallback
      const forceRefresh =
        req.headers["x-refresh-session"] === "1" ||
        req.headers["x-refresh-session"] === "true";

      if (forceRefresh) {
        console.log(
          `[auth] x-refresh-session header detected for user ${auth.userId}, forcing DB lookup`
        );
        const user_claims = await fetchAndSyncLocalUser({
          external_id: auth?.userId,
        });
        (req as any).user = { userId: auth.userId, ...user_claims };
        return next();
      }

      // Attach a typed user for downstream handlers
      const claimsResult = RequestUserFromAuthSchema.safeParse({
        userId: auth.userId,
        claims: auth.sessionClaims,
      });

      if (claimsResult.success) {
        (req as any).user = claimsResult.data;
        (req as any).dialistUserId = claimsResult.data.dialist_id;
        return next();
      } else {
        console.warn(
          `[auth] Missing/invalid claims for user ${auth.userId}, falling back to database`
        );
        const user_claims = await fetchAndSyncLocalUser({
          external_id: auth?.userId,
        });
        (req as any).user = { userId: auth.userId, ...user_claims };
        (req as any).dialistUserId = user_claims.dialist_id;
        return next();
      }
    } catch (err) {
      if (err instanceof AppError) return next(err);
      console.error("requireAuth error:", err);
      return next(
        new DatabaseError("Unexpected error in auth middleware", {
          original: err,
          path: req.path,
        })
      );
    }
  };
}

// ------------------------------------------------------------------
// Require completed user onboarding
// Used for buyer actions like purchasing watches
// ------------------------------------------------------------------
export function requireCompletedOnboarding() {
  return async function checkOnboardingMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ) {
    try {
      // Ensure user is authenticated first
      if (!req.user) {
        throw new AuthenticationError("Unauthorized - user not authenticated");
      }

      // Check if user has completed onboarding
      if (req.user.onboarding_status !== "completed") {
        throw new AuthorizationError(
          "User onboarding must be completed before purchasing watches",
          {
            context: {
              userId: req.user.dialist_id,
              currentStatus: req.user.onboarding_status,
              requiredStatus: "completed",
            },
          }
        );
      }

      return next();
    } catch (err) {
      if (err instanceof AppError) return next(err);
      console.error("requireCompletedOnboarding error:", err);
      return next(
        new DatabaseError("Unexpected error in onboarding check middleware", {
          original: err,
          path: req.path,
        })
      );
    }
  };
}

// Alias for routes that just need authentication
export const requireAuth = requirePlatformAuth;
