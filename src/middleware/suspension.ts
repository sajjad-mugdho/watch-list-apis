/**
 * Suspension Check Middleware
 *
 * Blocks API access for suspended users.
 * Checks if the authenticated user is currently suspended and returns 403 if so.
 * Automatically lifts expired suspensions.
 */

import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import logger from "../utils/logger";

/**
 * Middleware that checks if the authenticated user is suspended.
 * Should be applied AFTER auth middleware so req.auth is available.
 *
 * - If user has no suspended_at → pass through
 * - If suspension_expires_at is in the past → auto-lift and pass through
 * - If actively suspended → return 403 with suspension info
 */
export async function checkSuspension(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = (req as any).auth;
    if (!auth?.userId) {
      // No auth context, let auth middleware handle it
      return next();
    }

    const user = await User.findOne({ external_id: auth.userId })
      .select("suspended_at suspension_reason suspension_expires_at")
      .lean();

    if (!user || !user.suspended_at) {
      return next();
    }

    // Check if suspension has expired
    if (
      user.suspension_expires_at &&
      new Date(user.suspension_expires_at) < new Date()
    ) {
      // Auto-lift expired suspension
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            suspended_at: null,
            suspension_reason: null,
            suspended_by: null,
            suspension_expires_at: null,
          },
        }
      );

      logger.info("[Suspension] Auto-lifted expired suspension", {
        userId: user._id,
      });

      return next();
    }

    // User is actively suspended
    logger.warn("[Suspension] Blocked request from suspended user", {
      userId: user._id,
      suspendedAt: user.suspended_at,
      expiresAt: user.suspension_expires_at,
    });

    res.status(403).json({
      error: {
        code: "USER_SUSPENDED",
        message: "Your account has been suspended.",
        reason: user.suspension_reason || undefined,
        expires_at: user.suspension_expires_at || undefined,
      },
    });
  } catch (error) {
    // Don't block requests on suspension check failures
    logger.error("[Suspension] Error checking suspension status", { error });
    next();
  }
}
