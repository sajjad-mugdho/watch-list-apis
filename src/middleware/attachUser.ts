/**
 * Attach User Middleware
 *
 * Automatically populates req.user from auth.userId.
 * Eliminates 79+ duplicate User.findOne() calls across routes.
 *
 * Usage:
 *   router.use(attachUser) // Apply to all routes
 *   router.get('/path', attachUser, handler) // Apply to specific route
 */

import { Request, Response, NextFunction } from "express";
import { User, IUser } from "../models/User";
import logger from "../utils/logger";

// Express augmentation moved to src/types/express.d.ts

/**
 * Attaches the current authenticated user to the request.
 * Sets req.user (full document) and req.dialistUserId (string ID).
 * Auto-creates user if they don't exist (for Bearer token auth).
 */
export const attachUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const auth = (req as any).auth;

    if (!auth?.userId) {
      res.status(401).json({ error: { message: "Unauthorized" } });
      return;
    }

    let user = await User.findOne({ external_id: auth.userId }).select(
      "+external_id",
    );

    // ✅ Auto-create user ONLY in test/development environments. In production, return 404.
    if (!user) {
      const canAutoCreateUser = process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";
      
      if (!canAutoCreateUser) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }
      
      try {
        user = new User({
          external_id: auth.userId,
          email: `${auth.userId}@test.local`,
          first_name: "Test",
          last_name: "User",
          display_name: auth.userId,
          onboarding: {
            status: "incomplete",
            steps: {
              location: {},
              display_name: { confirmed: false, user_provided: false },
              avatar: { confirmed: false, user_provided: false },
            },
          },
        });
        await user.save();
        logger.info("Auto-created user from Bearer token", {
          userId: user._id,
          externalId: auth.userId,
        });
      } catch (createError) {
        logger.error("Failed to auto-create user", { auth, createError });
        res.status(500).json({ error: { message: "Failed to create user" } });
        return;
      }
    }

    // Attach to request
    req.user = user;
    req.dialistUserId = user._id.toString();

    next();
  } catch (error) {
    logger.error("Error in attachUser middleware", { error });
    next(error);
  }
};

/**
 * Optional user attachment - doesn't fail if user not found.
 * Useful for routes that work with or without authentication.
 */
export const attachUserOptional = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const auth = (req as any).auth;

    if (auth?.userId) {
      const user = await User.findOne({ external_id: auth.userId });
      if (user) {
        req.user = user;
        req.dialistUserId = user._id.toString();
      }
    }

    next();
  } catch (error) {
    logger.error("Error in attachUserOptional middleware", { error });
    next(error);
  }
};

/**
 * Helper to get user from request with type safety.
 * Throws if user not attached.
 */
export const getUser = (req: Request): IUser => {
  if (!req.user) {
    throw new Error(
      "User not attached to request. Did you forget attachUser middleware?",
    );
  }
  return req.user;
};

/**
 * Helper to get user ID from request with type safety.
 */
export const getUserId = (req: Request): string => {
  if (!req.dialistUserId) {
    throw new Error(
      "User ID not attached to request. Did you forget attachUser middleware?",
    );
  }
  return req.dialistUserId;
};
