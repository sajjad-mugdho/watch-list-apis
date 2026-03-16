import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import { DatabaseError, MissingUserContextError } from "../../utils/errors";
import { NetworkListing } from "../models/NetworkListing";
import { NetworkListingChannel } from "../models/NetworkListingChannel";
import { ISO } from "../../models/ISO";
import { ReferenceCheck } from "../../models/ReferenceCheck";
import { User } from "../../models/User";
import { Connection } from "../models/Connection";
import mongoose from "mongoose";

/**
 * Get networks dashboard stats and progress
 * GET /api/v1/networks/dashboard/stats
 */
export const networks_dashboard_stats_get = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) throw new MissingUserContextError();

    const userId = new mongoose.Types.ObjectId(user.dialist_id);

    // 1. Concurrent counts for cards
    const [
      activeListings,
      pendingOffers,
      activeISOs,
      pendingRefChecks,
      followersCount,
      followingCount,
      verifiedDealersCount,
    ] = await Promise.all([
      NetworkListing.countDocuments({ dialist_id: userId, status: "active" }),
      NetworkListingChannel.countDocuments({
        $or: [{ buyer_id: userId }, { seller_id: userId }],
        status: "open",
        "last_offer.status": "sent",
        "last_offer.sender_id": { $ne: userId },
      }),
      ISO.countDocuments({ user_id: userId, status: "active" }),
      ReferenceCheck.countDocuments({ target_id: userId, status: "pending" }),
      Connection.getIncomingCount(user.dialist_id),
      Connection.getOutgoingCount(user.dialist_id),
      User.countDocuments({ "verification.verification_state": "SUCCEEDED" }),
    ]);

    // 2. Calculate Onboarding Progress (X/Y)
    // Progress items: Profile (Display Name), avatar, location, first listing, first ISO
    const progressItems = [
      { id: "display_name", completed: !!user.display_name },
      { id: "avatar", completed: !!user.display_avatar },
      {
        id: "location",
        completed: !!(user.location_country || user.location_region),
      },
      {
        id: "first_listing",
        completed: false, // Will be set in parallel query below
      },
      { id: "first_iso", completed: false }, // Will be set in parallel query below
    ];

    // Parallelize database queries for performance
    const [hasFirstListing, hasFirstISO] = await Promise.all([
      NetworkListing.exists({ dialist_id: userId }),
      ISO.exists({ user_id: userId }),
    ]);

    progressItems[3].completed = !!hasFirstListing;
    progressItems[4].completed = !!hasFirstISO;

    const completedCount = progressItems.filter(
      (item) => item.completed,
    ).length;
    const totalCount = progressItems.length;

    const response: ApiResponse<any> = {
      data: {
        stats: {
          listings: { active: activeListings },
          offers: { pending: pendingOffers },
          isos: { active: activeISOs },
          reference_checks: { pending: pendingRefChecks },
          social: {
            followers: followersCount,
            following: followingCount,
          },
          verified_dealers_global: verifiedDealersCount,
        },
        onboarding: {
          completed_count: completedCount,
          total_count: totalCount,
          percentage: Math.round((completedCount / totalCount) * 100),
          items: progressItems,
        },
        user: {
          verification_status: user.verification_state || "NOT_STARTED",
          rating: {
            average: user.rating_average || 0,
            count: user.rating_count || 0,
          },
        },
      },
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (error: any) {
    next(new DatabaseError("Failed to fetch dashboard stats", error));
  }
};
