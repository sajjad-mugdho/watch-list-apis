/**
 * User Profile Routes
 * 
 * Handles profile updates (bio, social_links) and wishlist management
 */

import { Router, Request, Response, NextFunction } from "express";
import { getUserId } from "../../middleware/attachUser";
import { validateRequest } from "../../middleware/validation";
import {
  updateProfileSchema,
  addToWishlistSchema,
  removeFromWishlistSchema,
  getWishlistSchema,
} from "../../validation/schemas";
import { User } from "../../models/User";

import { Follow } from "../../models/Follow";
import { Order } from "../../models/Order";
import { Types } from "mongoose";
import { deactivateUserSchema } from "../../validation/schemas";
import logger from "../../utils/logger";
import { imageService, ImageContext } from "../../services/ImageService";
import multer from "multer";
import { NetworkListing } from "../../models/Listings";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

const router = Router();

// ----------------------------------------------------------
// Profile Update Endpoints
// ----------------------------------------------------------

/**
 * @route PATCH /api/v1/user/profile
 * @desc Update current user's profile (bio, social_links)
 */
router.patch(
  "/profile",
  validateRequest(updateProfileSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { bio, social_links, fullName } = req.body;

      const updateData: Record<string, any> = {};

      // Handle split name update if fullName provided
      if (fullName !== undefined && fullName !== null) {
        const parts = fullName.trim().split(/\s+/);
        if (parts.length > 0) {
          updateData.first_name = parts[0];
          updateData.last_name = parts.slice(1).join(" ") || "";
        }
      }

      // Only update fields that are provided
      if (bio !== undefined) {
        updateData.bio = bio;
      }

      if (social_links !== undefined) {
        // Merge with existing social_links (don't overwrite all if only one provided)
        if (social_links.instagram !== undefined) {
          updateData["social_links.instagram"] = social_links.instagram;
        }
        if (social_links.twitter !== undefined) {
          updateData["social_links.twitter"] = social_links.twitter;
        }
        if (social_links.website !== undefined) {
          updateData["social_links.website"] = social_links.website;
        }
      }

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          error: "No valid fields to update",
        });
        return;
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select("bio social_links");

      if (!updatedUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        data: {
          bio: updatedUser.bio,
          social_links: updatedUser.social_links,
          fullName: updatedUser.full_name,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route POST /api/v1/user/avatar
 * @desc Upload avatar for current user
 */
router.post(
  "/avatar",
  upload.single("avatar"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: "No image file provided" });
        return;
      }

      // Upload to S3 via ImageService
      const metadata = await imageService.uploadImage(file, {
        context: ImageContext.AVATAR,
        entityId: userId,
        optimize: true,
        maxWidth: 500,
        maxHeight: 500,
      });

      // Update user record
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { avatar: metadata.url } },
        { new: true }
      ).select("avatar");

      res.json({
        data: {
          avatar_url: updatedUser?.avatar,
          metadata,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route GET /api/v1/user/profile
 * @desc Get current user's profile (bio, social_links, stats)
 */
router.get(
  "/profile",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);

      const user = await User.findById(userId).select(
        "bio social_links stats display_name avatar rating_average rating_count reference_count"
      );

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Fetch follow counts
      const [follower_count, following_count] = await Promise.all([
        Follow.getFollowersCount(userId),
        Follow.getFollowingCount(userId),
      ]);

      res.json({
        data: {
          bio: user.bio || null,
          social_links: user.social_links || {},
          stats: {
            ...((user as any).stats || {}),
            follower_count,
            following_count,
            avg_rating: user.rating_average || 0,
            rating_count: user.rating_count || 0,
            reference_count: user.reference_count || 0,
          },
          display_name: user.display_name,
          avatar: user.avatar,
          deactivated_at: (user as any).deactivated_at,
          isActive: (user as any).isActive,
          full_name: (user as any).full_name,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

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
        "identityVerified identityVerifiedAt personaStatus"
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
  }
);

/**
 * @route PATCH /api/v1/user/status
 * @desc Deactivate/Reactivate current user's account
 */
router.patch(
  "/status",
  validateRequest(deactivateUserSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { active } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const updateData: any = {
        deactivated_at: active ? null : new Date(),
      };

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      );

      logger.info(`User ${userId} ${active ? "reactivated" : "deactivated"} their account`);

      res.json({
        data: {
          active: !!active,
          deactivated_at: updatedUser?.deactivated_at || null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route DELETE /api/v1/user
 * @desc Permanently delete current user's account (requires checks)
 */
router.delete(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);

      // Check for active financial activity
      const activeOrders = await Order.countDocuments({
        $or: [{ buyer_id: userId }, { seller_id: userId }],
        status: { $in: ["pending", "processing", "authorized", "paid", "shipped"] },
      });

      if (activeOrders > 0) {
        res.status(400).json({
          error: "Cannot delete account while you have active orders. Please complete or cancel them first.",
        });
        return;
      }

      // TODO: Check for pending disputes/escrow if applicable

      // For Clerk integration, usually the deletion is initiated from Clerk
      // or we anonymize the user record here.
      // In this case, we'll mark as deleted/anonymize.
      await User.findByIdAndUpdate(userId, {
        $set: {
          first_name: "Deleted",
          last_name: "User",
          email: `deleted_${userId}@dialist.com`,
          display_name: "Deleted User",
          avatar: null,
          external_id: null, // Unlink from Clerk
          deactivated_at: new Date(),
          "social_links.instagram": null,
          "social_links.twitter": null,
          "social_links.website": null,
          bio: "This account has been deleted.",
        },
      });

      logger.info(`User ${userId} deleted their account`);

      res.json({
        success: true,
        message: "Your account has been deleted and anonymized.",
      });
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------------
// Wishlist Endpoints
// ----------------------------------------------------------

/**
 * @route GET /api/v1/user/wishlist
 * @desc Get current user's wishlist
 */
router.get(
  "/wishlist",
  validateRequest(getWishlistSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { limit = 20, offset = 0 } = req.query;

      const user = await User.findById(userId)
        .select("wishlist")
        .populate({
          path: "wishlist",
          model: NetworkListing,
          options: {
            skip: Number(offset),
            limit: Number(limit),
          },
        });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Get total count
      const totalUser = await User.findById(userId).select("wishlist");
      const total = totalUser?.wishlist?.length || 0;

      res.json({
        data: user.wishlist || [],
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route POST /api/v1/user/wishlist
 * @desc Add a listing to wishlist
 */
router.post(
  "/wishlist",
  validateRequest(addToWishlistSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { listing_id } = req.body;

      // Verify listing exists
      const listing = await NetworkListing.findById(listing_id);
      if (!listing) {
        res.status(404).json({ error: "Listing not found" });
        return;
      }

      // Add to wishlist (using $addToSet to avoid duplicates)
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $addToSet: { wishlist: new Types.ObjectId(listing_id) } },
        { new: true }
      ).select("wishlist");

      if (!updatedUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.status(201).json({
        data: {
          added: true,
          listing_id,
          wishlist_count: updatedUser.wishlist?.length || 0,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route DELETE /api/v1/user/wishlist/:listing_id
 * @desc Remove a listing from wishlist
 */
router.delete(
  "/wishlist/:listing_id",
  validateRequest(removeFromWishlistSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { listing_id } = req.params;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $pull: { wishlist: new Types.ObjectId(listing_id) } },
        { new: true }
      ).select("wishlist");

      if (!updatedUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        data: {
          removed: true,
          listing_id,
          wishlist_count: updatedUser.wishlist?.length || 0,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route GET /api/v1/user/wishlist/check/:listing_id
 * @desc Check if a listing is in the wishlist
 */
router.get(
  "/wishlist/check/:listing_id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { listing_id } = req.params;

      const user = await User.findById(userId).select("wishlist");

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const isInWishlist = user.wishlist?.some(
        (id) => id.toString() === listing_id
      );

      res.json({
        data: {
          in_wishlist: !!isInWishlist,
          listing_id,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export { router as userProfileRoutes };
