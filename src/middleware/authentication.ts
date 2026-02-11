import { Request, Response, NextFunction } from "express";
import {
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  AppError,
} from "../utils/errors";
import { customGetAuth } from "./customClerkMw";
import { RequestUserFromAuthSchema } from "../validation/schemas";
import { fetchAndSyncLocalUser } from "../utils/user";
import { User } from "../models/User";
import logger from "../utils/logger";

const SKIP_PATHS: string[] = ["/health", "/public"];

/**
 * requirePlatformAuth() - Base authentication for all authenticated routes
 * Validates: user auth, claims presence, dialist_id format.
 */
export function requirePlatformAuth() {
  return async function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ) {
    try {
      const fullPath = req.baseUrl + req.path;
      if (SKIP_PATHS.some((p) => fullPath.startsWith(p))) return next();

      const auth = customGetAuth(req) as any;
      if (!auth?.userId) throw new AuthenticationError("Unauthorized");

      const forceRefresh =
        req.headers["x-refresh-session"] === "1" ||
        req.headers["x-refresh-session"] === "true";

      if (forceRefresh) {
        console.log(`[auth] x-refresh-session header detected for user ${auth.userId}, forcing DB lookup`);
        const user_claims = await fetchAndSyncLocalUser({ external_id: auth?.userId });
        (req as any).user = { userId: auth.userId, ...user_claims };
        return next();
      }

      const claimsResult = RequestUserFromAuthSchema.safeParse({
        userId: auth.userId,
        claims: auth.sessionClaims,
      });

      if (claimsResult.success) {
        (req as any).user = claimsResult.data;
        (req as any).dialistUserId = claimsResult.data.dialist_id;
        return next();
      } else {
        console.warn(`[auth] Missing/invalid claims for user ${auth.userId}, falling back to database`);
        const user_claims = await fetchAndSyncLocalUser({ external_id: auth?.userId });
        (req as any).user = { userId: auth.userId, ...user_claims };
        (req as any).dialistUserId = user_claims.dialist_id;
        return next();
      }
    } catch (err) {
      if (err instanceof AppError) return next(err);
      console.error("requireAuth error:", err);
      return next(new DatabaseError("Unexpected error in auth middleware", { original: err, path: req.path }));
    }
  };
}

/**
 * Middleware to require completed onboarding
 */
export function requireCompletedOnboarding() {
  return async function checkOnboardingMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) throw new AuthenticationError("Unauthorized - user not authenticated");
      if (req.user.onboarding_status !== "completed") {
        throw new AuthorizationError("User onboarding must be completed before purchasing watches", {
          context: { userId: req.user.dialist_id, currentStatus: req.user.onboarding_status, requiredStatus: "completed" },
        });
      }
      return next();
    } catch (err) {
      if (err instanceof AppError) return next(err);
      console.error("requireCompletedOnboarding error:", err);
      return next(new DatabaseError("Unexpected error in onboarding check middleware", { original: err, path: req.path }));
    }
  };
}

/**
 * Middleware to require admin role
 * Must be used AFTER requirePlatformAuth()
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const auth = (req as any).auth;
    if (!auth?.userId) {
      res.status(401).json({ error: { message: "Unauthorized" } });
      return;
    }

    const user = await User.findOne({ external_id: auth.userId }).select("+isAdmin +external_id");

    if (!user || !user.isAdmin) {
      logger.warn(`Unauthorized admin access attempt by user ${auth.userId}`);
      res.status(403).json({
        error: {
          message: "Forbidden: Admin access required",
          code: "INSUFFICIENT_PERMISSIONS",
        },
      });
      return;
    }

    next();
  } catch (error) {
    logger.error("Error in requireAdmin middleware", { error });
    next(error);
  }
};

export const requireAuth = requirePlatformAuth;
