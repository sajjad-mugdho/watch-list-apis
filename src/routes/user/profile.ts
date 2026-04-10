/**
 * User Verification Routes
 *
 * Handles user Persona identity verification status
 *
 * DEPRECATED ENDPOINTS REMOVED:
 * - Profile updates (/profile, /avatar)
 * - User status (/status)
 * - Account deactivation (/deactivate)
 * - User deletion (/)
 * - Wishlist management (/wishlist, /wishlist/:id)
 *
 * Remaining endpoints:
 * - GET /api/v1/user/verification
 */

import { Router, Request, Response, NextFunction } from "express";
import { getUserId } from "../../middleware/attachUser";
import { User } from "../../models/User";

const router = Router();

/**
 * @route GET /api/v1/user/verification
 * @desc Get current user's Persona verification status
 */
router.get(
  "/verification",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);

      const user = await User.findById(userId).select(
        "identityVerified identityVerifiedAt personaStatus",
      );

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        data: {
          status: user.personaStatus ?? "unverified",
          identityVerified: user.identityVerified,
          verifiedAt: user.identityVerifiedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export { router as userProfileRoutes };
