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
import { NetworkListing } from "../../models/Listings";
import { Types } from "mongoose";

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
      const { bio, social_links } = req.body;

      const updateData: Record<string, any> = {};

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
        "bio social_links stats display_name avatar"
      );

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        data: {
          bio: user.bio || null,
          social_links: user.social_links || {},
          stats: user.stats || {
            follower_count: 0,
            following_count: 0,
            friend_count: 0,
            avg_rating: 0,
            rating_count: 0,
            review_count_as_buyer: 0,
            review_count_as_seller: 0,
          },
          display_name: user.display_name,
          avatar: user.avatar,
        },
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
