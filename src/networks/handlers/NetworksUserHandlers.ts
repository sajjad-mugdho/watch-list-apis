import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import {
  DatabaseError,
  MissingUserContextError,
  ValidationError,
  NotFoundError,
} from "../../utils/errors";

import { Review } from "../../models/Review";
import { ReferenceCheck } from "../../models/ReferenceCheck";
import { Connection } from "../models/Connection";
import { User } from "../../models/User";
import { Favorite } from "../../models/Favorite";
import { Order } from "../../models/Order";
import { ISO } from "../../models/ISO";
import { Block } from "../models/Block";
import { Report } from "../models/Report";
import {
  GetUserPublicProfileInput,
  BlockUserInput,
  CreateReportInput,
} from "../../validation/schemas";
import mongoose from "mongoose";
import { INetworkListing, NetworkListing } from "../models/NetworkListing";
import { NetworkListingChannel } from "../models/NetworkListingChannel";
import { feedService } from "../../services/FeedService";
import { supportTicketService } from "../../services/support/SupportTicketService";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export type PaginationFields = {
  count: number;
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export interface InventoryMetadata {
  paging: PaginationFields;
  groups: Record<"draft" | "active" | "reserved" | "sold", number>;
  filters: {
    status: string;
    search?: string;
    sort?: string;
  };
}

// ----------------------------------------------------------
// Handler Functions
// ----------------------------------------------------------

/**
 * Get networks user info with minimal user details
 * GET /api/v1/networks/user
 * Returns: platform, display_name, first_name, last_name, email (lightweight alternative to /profile)
 */
export const networks_user_get = async (
  req: Request,
  res: Response<
    ApiResponse<{
      platform: "networks";
      display_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
    }>
  >,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req as any).user?.dialist_id;
    if (!userId) {
      throw new MissingUserContextError();
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    const response: ApiResponse<{
      platform: "networks";
      display_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
    }> = {
      data: {
        platform: "networks",
        display_name: user.display_name || null,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        email: user.email || null,
      } as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (error: any) {
    next(new DatabaseError("Failed to fetch user", error));
  }
};

/**
 * Get consolidated current-user profile payload for Networks screens.
 * GET /api/v1/networks/user/profile
 */
export const networks_user_profile_get = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser?.dialist_id) {
      throw new MissingUserContextError({
        route: req.path,
        note: "(req as any).user.dialist_id missing in networks_user_profile_get",
      });
    }

    const userId = new mongoose.Types.ObjectId(authUser.dialist_id);

    const [
      user,
      listingsByStatus,
      pendingOffers,
      activeISOs,
      pendingRefChecks,
      followersCount,
      followingCount,
      verifiedDealersCount,
      hasFirstListing,
      hasFirstISO,
      activeOrders,
      wishlistCount,
      openTicketsCount,
    ] = await Promise.all([
      User.findById(userId)
        .select(
          "first_name last_name display_name email bio avatar location social_links createdAt rating_average rating_count reference_count identityVerified identityVerifiedAt personaStatus",
        )
        .lean(),
      NetworkListing.aggregate([
        { $match: { dialist_id: userId, is_deleted: { $ne: true } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      NetworkListingChannel.countDocuments({
        $or: [{ buyer_id: userId }, { seller_id: userId }],
        status: "open",
        "last_offer.status": "sent",
        "last_offer.sender_id": { $ne: userId },
      }),
      ISO.countDocuments({ user_id: userId, status: "active" }),
      ReferenceCheck.countDocuments({ target_id: userId, status: "pending" }),
      Connection.getIncomingCount(authUser.dialist_id),
      Connection.getOutgoingCount(authUser.dialist_id),
      User.countDocuments({ "verification.verification_state": "SUCCEEDED" }),
      NetworkListing.exists({ dialist_id: userId }),
      ISO.exists({ user_id: userId }),
      Order.countDocuments({
        listing_type: "NetworkListing",
        $or: [{ buyer_id: userId }, { seller_id: userId }],
        status: {
          $in: [
            "pending",
            "reserved",
            "paid",
            "authorized",
            "shipped",
            "delivered",
          ],
        },
      }),
      Favorite.countDocuments({
        user_id: userId,
        $or: [
          { platform: "networks" },
          { platform: null },
          { platform: { $exists: false } },
        ],
      }),
      supportTicketService.getOpenTicketsCount(userId.toString()),
    ]);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const listingGroups = {
      all: 0,
      draft: 0,
      active: 0,
      reserved: 0,
      sold: 0,
      inactive: 0,
    };

    for (const row of listingsByStatus) {
      const key = String(row._id);
      const count = Number(row.count || 0);
      if (key in listingGroups) {
        (listingGroups as any)[key] = count;
      }
      listingGroups.all += count;
    }

    const verificationStatus = user.identityVerified
      ? "SUCCEEDED"
      : "NOT_STARTED";

    const onboardingItems = [
      { id: "display_name", completed: !!user.display_name },
      { id: "avatar", completed: !!user.avatar },
      {
        id: "location",
        completed: !!(user.location?.country || user.location?.region),
      },
      { id: "first_listing", completed: !!hasFirstListing },
      { id: "first_iso", completed: !!hasFirstISO },
    ];

    const onboardingCompleted = onboardingItems.filter(
      (i) => i.completed,
    ).length;

    const response: ApiResponse<any> = {
      data: {
        profile: {
          _id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          display_name: user.display_name,
          email: user.email,
          bio: user.bio || null,
          avatar_url: user.avatar || null,
          location: {
            city: user.location?.city || null,
            region: user.location?.region || null,
            country: user.location?.country || null,
          },
          social_links: user.social_links || {},
          joined_at: user.createdAt,
        },
        verification: {
          status: user.personaStatus ?? "unverified",
          identity_verified: !!user.identityVerified,
          verified_at: user.identityVerifiedAt || null,
          verification_status: verificationStatus,
        },
        onboarding: {
          completed_count: onboardingCompleted,
          total_count: onboardingItems.length,
          percentage: Math.round(
            (onboardingCompleted / onboardingItems.length) * 100,
          ),
          items: onboardingItems,
        },
        stats: {
          listings: {
            all: listingGroups.all,
            draft: listingGroups.draft,
            active: listingGroups.active,
            reserved: listingGroups.reserved,
            sold: listingGroups.sold,
            inactive: listingGroups.inactive,
          },
          offers: { pending: pendingOffers },
          orders: { active: activeOrders },
          isos: { active: activeISOs },
          reference_checks: { pending: pendingRefChecks },
          favorites: { total: wishlistCount },
          support: { open_tickets: openTicketsCount },
          social: {
            followers: followersCount,
            following: followingCount,
          },
          rating: {
            average: user.rating_average || 0,
            count: user.rating_count || 0,
            reference_count: user.reference_count || 0,
          },
          verified_dealers_global: verifiedDealersCount,
        },
      },
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (error: any) {
    if (
      error instanceof MissingUserContextError ||
      error instanceof NotFoundError
    ) {
      next(error);
      return;
    }
    next(
      new DatabaseError(
        "Failed to fetch consolidated networks user profile",
        error,
      ),
    );
  }
};

/**
 * Get networks user inventory (listings)
 * GET /api/v1/networks/user/listings
 */
export const networks_user_inventory_get = async (
  req: Request,
  res: Response<ApiResponse<INetworkListing[], InventoryMetadata>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user)
      throw new MissingUserContextError({
        route: req.path,
        note: "(req as any).user missing in getUserInventory",
      });

    const status = (req.query.status as string) ?? "all";
    const search = (req.query.search as string | undefined)?.trim();
    const sort = (req.query.sort as string | undefined) ?? "recent";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    const filters: Record<string, any> = {
      dialist_id: new mongoose.Types.ObjectId((req as any).user.dialist_id),
      is_deleted: { $ne: true },
    };
    if (status !== "all") filters.status = status;
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
      ];
    }

    const sortOrder =
      sort === "offers"
        ? { offers_count: -1 as const }
        : sort === "views"
          ? { view_count: -1 as const }
          : { createdAt: -1 as const };

    const listings = await NetworkListing.find(filters)
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await NetworkListing.countDocuments(filters);

    const counts = await NetworkListing.aggregate([
      {
        $match: {
          dialist_id: new mongoose.Types.ObjectId((req as any).user.dialist_id),
          is_deleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const groups: Record<"draft" | "active" | "reserved" | "sold", number> = {
      draft: 0,
      active: 0,
      reserved: 0,
      sold: 0,
    };

    counts.forEach((c) => {
      if (c._id in groups) {
        groups[c._id as keyof typeof groups] = c.count;
      }
    });

    const filterObj: {
      status: string;
      search?: string;
      sort?: string;
    } = { status };
    if (search) filterObj.search = search;
    if (sort) filterObj.sort = sort;

    const response: ApiResponse<INetworkListing[], InventoryMetadata> = {
      data: listings as any,
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        paging: {
          count: listings.length,
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        groups,
        filters: filterObj,
      },
    };

    res.json(response);
  } catch (err: any) {
    if (err instanceof MissingUserContextError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch user inventory", err));
    }
  }
};

/**
 * Get public profile with reputation metrics
 * GET /api/v1/networks/user/:id/profile
 */
export const networks_user_public_profile_get = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid user ID");
    }

    const user = await User.findById(id)
      .select(
        "display_name avatar first_name last_name location bio website createdAt",
      )
      .lean();
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // 1. Get Review metrics
    const reviewStats = await Review.aggregate([
      { $match: { target_user_id: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    // 2. Get Reference Check metrics
    const referenceStats = await ReferenceCheck.aggregate([
      {
        $match: {
          target_id: new mongoose.Types.ObjectId(id),
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          positive: { $sum: "$summary.positive_count" },
          neutral: { $sum: "$summary.neutral_count" },
          negative: { $sum: "$summary.negative_count" },
          total: { $sum: "$summary.total_responses" },
        },
      },
    ]);

    // 3. Get Active Listings count
    const activeListingsCount = await NetworkListing.countDocuments({
      dialist_id: id,
      status: "active",
    });

    const reputation = {
      rating: reviewStats[0]?.averageRating || 0,
      reviewsCount: reviewStats[0]?.count || 0,
      references: {
        positive: referenceStats[0]?.positive || 0,
        neutral: referenceStats[0]?.neutral || 0,
        negative: referenceStats[0]?.negative || 0,
        total: referenceStats[0]?.total || 0,
      },
      activeListingsCount,
    };

    res.json({
      data: {
        ...user,
        reputation,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    next(err);
  }
};

/**
 * Get public listings for a user
 * GET /api/v1/networks/user/:id/listings
 */
export const networks_user_listings_get = async (
  req: Request<
    GetUserPublicProfileInput["params"],
    {},
    {},
    GetUserPublicProfileInput["query"]
  >,
  res: Response<ApiResponse<INetworkListing[]>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const status = (req.query?.status as string) ?? "active";
    const listingType = req.query?.type as string | undefined;
    const search = (req.query?.search as string | undefined)?.trim();
    const page = Number(req.query?.page) || 1;
    const limit = Number(req.query?.limit) || 30;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid user ID");
    }

    const filters: Record<string, any> = {
      dialist_id: new mongoose.Types.ObjectId(id),
      is_deleted: { $ne: true },
    };

    if (status === "all") {
      filters.status = { $in: ["active", "sold"] };
    } else if (status === "active" || status === "sold") {
      filters.status = status;
    } else {
      throw new ValidationError(
        "Can only view active or sold listings publicly",
      );
    }

    if (listingType) {
      filters.type = listingType;
    }

    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
      ];
    }

    const listings = await NetworkListing.find(filters)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await NetworkListing.countDocuments(filters);

    res.json({
      data: listings as any,
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        paging: {
          count: listings.length,
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Block a user
 * POST /api/v1/networks/user/block
 */
export const networks_user_block = async (
  req: Request<{}, {}, BlockUserInput["body"]>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const blocker_id = (req as any).user.dialist_id;
    const { blocked_id, reason } = req.body;

    if (String(blocker_id) === String(blocked_id)) {
      throw new ValidationError("Cannot block yourself");
    }

    await Block.findOneAndUpdate(
      { blocker_id, blocked_id },
      { blocker_id, blocked_id, reason },
      { upsert: true, new: true },
    );

    // Blocking severs connections/requests in both directions immediately.
    await Connection.deleteMany({
      $or: [
        { follower_id: blocker_id, following_id: blocked_id },
        { follower_id: blocked_id, following_id: blocker_id },
      ],
    });

    const [blockerOutgoing, blockerIncoming, blockedOutgoing, blockedIncoming] =
      await Promise.all([
        Connection.getOutgoingCount(String(blocker_id)),
        Connection.getIncomingCount(String(blocker_id)),
        Connection.getOutgoingCount(String(blocked_id)),
        Connection.getIncomingCount(String(blocked_id)),
      ]);

    await Promise.all([
      User.findByIdAndUpdate(blocker_id, {
        $set: {
          "stats.following_count": blockerOutgoing,
          "stats.follower_count": blockerIncoming,
        },
      }),
      User.findByIdAndUpdate(blocked_id, {
        $set: {
          "stats.following_count": blockedOutgoing,
          "stats.follower_count": blockedIncoming,
        },
      }),
      // Feed cleanup is best-effort, DB state remains source of truth.
      feedService
        .unfollow(String(blocker_id), String(blocked_id))
        .catch(() => {}),
      feedService
        .unfollow(String(blocked_id), String(blocker_id))
        .catch(() => {}),
    ]);

    res.json({
      data: { success: true, message: "User blocked successfully" },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Report a user or listing
 * POST /api/v1/networks/user/report
 */
export const networks_user_report = async (
  req: Request<{}, {}, CreateReportInput["body"]>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const reporter_id = (req as any).user.dialist_id;
    const { target_id, target_type, reason, description } = req.body;

    const report = await Report.create({
      reporter_id,
      target_id,
      target_type,
      reason,
      description,
      status: "pending",
    });

    res.status(201).json({
      data: report,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List blocked users for the current user
 * GET /api/v1/networks/user/blocks
 */
export const networks_user_blocks_get = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const blocker_id = (req as any).user.dialist_id;

    const blocks = await Block.find({ blocker_id })
      .populate("blocked_id", "first_name last_name avatar display_name")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      data: blocks,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Unblock a user
 * DELETE /api/v1/networks/user/blocks/:blocked_id
 */
export const networks_user_unblock = async (
  req: Request<{ blocked_id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const blocker_id = (req as any).user.dialist_id;
    const { blocked_id } = req.params;

    const result = await Block.findOneAndDelete({ blocker_id, blocked_id });

    if (!result) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Block not found" },
        requestId: req.headers["x-request-id"] as string,
      } as any);
      return;
    }

    res.json({
      data: { success: true, message: "User unblocked successfully" },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get completed reference checks for a public user profile
 * GET /api/v1/networks/users/:id/references
 */
export const networks_user_references_get = async (
  req: Request<
    { id: string },
    {},
    {},
    { role?: string; limit?: string; offset?: string }
  >,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: userId } = req.params;
    const { role, limit: limitStr, offset: offsetStr } = req.query;

    if (!mongoose.isValidObjectId(userId)) {
      throw new ValidationError("Invalid user ID");
    }

    const limit = Math.min(parseInt(limitStr || "20") || 20, 50);
    const offset = Math.max(parseInt(offsetStr || "0") || 0, 0);

    let filter: any = {
      status: "completed",
      $or: [{ requester_id: userId }, { target_id: userId }],
    };

    if (role === "requester") {
      filter = { status: "completed", requester_id: userId };
    } else if (role === "target") {
      filter = { status: "completed", target_id: userId };
    }

    const [checks, total] = await Promise.all([
      ReferenceCheck.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      ReferenceCheck.countDocuments(filter),
    ]);

    res.json({
      data: checks,
      _metadata: { total, limit, offset },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};
