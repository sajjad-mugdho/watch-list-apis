import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import {
  DatabaseError,
  MissingUserContextError,
  NotFoundError,
} from "../../utils/errors";
import {
  INetworkListing,
  IMarketplaceListing,
  MarketplaceListing,
  NetworkListing,
} from "../../models/Listings";
import { User } from "../../models/User";
import mongoose from "mongoose";
import { GetUserInventoryInput } from "../../validation/schemas";

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
  };
}

// ----------------------------------------------------------
// Handler Functions
// ----------------------------------------------------------

/**
 * Get networks user info
 * GET /api/v1/networks/user
 */
export const networks_user_get = async (
  req: Request,
  res: Response<ApiResponse<{ platform: "networks" }>>,
  next: NextFunction
): Promise<void> => {
  try {
    const response: ApiResponse<{ platform: "networks" }> = {
      data: {
        platform: "networks",
      } as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (error: any) {
    next(new DatabaseError("Failed to fetch user", error));
  }
};

/**
 * Get marketplace user info
 * GET /api/v1/marketplace/user
 */
export const marketplace_user_get = async (
  req: Request,
  res: Response<ApiResponse<{ platform: "marketplace" }>>,
  next: NextFunction
): Promise<void> => {
  try {
    const response: ApiResponse<{ platform: "marketplace" }> = {
      data: {
        platform: "marketplace",
      },
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (error: any) {
    next(new DatabaseError("Failed to fetch user", error));
  }
};

/**
 * Get networks user inventory (listings)
 * GET /api/v1/networks/user/listings
 */
export const networks_user_inventory_get = async (
  req: Request<{}, {}, {}, GetUserInventoryInput["query"]>,
  res: Response<ApiResponse<INetworkListing[], InventoryMetadata>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user)
      throw new MissingUserContextError({
        route: req.path,
        note: "(req as any).user missing in getUserInventory",
      });

    // Handle defaults in handler
    const status = (req.query.status as string) ?? "all";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    // Build filters
    const filters: Record<string, any> = {
      dialist_id: new mongoose.Types.ObjectId((req as any).user.dialist_id),
    };
    if (status !== "all") filters.status = status;

    // Fetch paginated listings
    const listings = await NetworkListing.find(filters)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await NetworkListing.countDocuments(filters);

    // Get grouped counts across all statuses
    const counts = await NetworkListing.aggregate([
      {
        $match: {
          dialist_id: new mongoose.Types.ObjectId((req as any).user.dialist_id),
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
        filters: { status },
      },
    };

    res.json(response);
  } catch (err: any) {
    console.error("Error fetching networks user inventory:", err);
    if (err instanceof MissingUserContextError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch user inventory", err));
    }
  }
};

/**
 * Get marketplace user inventory (listings)
 * GET /api/v1/marketplace/user/listings
 */
export const marketplace_user_inventory_get = async (
  req: Request,
  res: Response<ApiResponse<IMarketplaceListing[], InventoryMetadata>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user)
      throw new MissingUserContextError({
        route: req.path,
        note: "(req as any).user missing in getUserInventory",
      });

    // Handle defaults in handler
    const status = (req.query.status as string) ?? "all";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    // Build filters
    const filters: Record<string, any> = {
      dialist_id: new mongoose.Types.ObjectId((req as any).user.dialist_id),
    };
    if (status !== "all") filters.status = status;

    // Fetch paginated listings
    const listings = await MarketplaceListing.find(filters)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await MarketplaceListing.countDocuments(filters);

    // Get grouped counts across all statuses
    const counts = await MarketplaceListing.aggregate([
      {
        $match: {
          dialist_id: new mongoose.Types.ObjectId((req as any).user.dialist_id),
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

    const response: ApiResponse<IMarketplaceListing[], InventoryMetadata> = {
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
        filters: { status },
      },
    };

    res.json(response);
  } catch (err: any) {
    console.error("Error fetching marketplace user inventory:", err);
    if (err instanceof MissingUserContextError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch user inventory", err));
    }
  }
};

/**
 * Get current authenticated user profile
 * GET /api/v1/user
 */
export const user_get = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user)
      throw new MissingUserContextError({
        route: req.path,
        note: "(req as any).user missing in user_get",
      });

    // Get user from database
    const user = await User.findById((req as any).user.dialist_id);
    if (!user) throw new NotFoundError("User not found");

    const response: ApiResponse<any> = {
      data: {
        _id: user._id,
        external_id: user.external_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        location: user.location,
        display_name: user.display_name,
        avatar: user.avatar,
        onboarding: user.onboarding,
        marketplace_last_accessed: user.marketplace_last_accessed,
        networks_last_accessed: user.networks_last_accessed,
        merchant: user.merchant,
        marketplace_profile_config: user.marketplace_profile_config,
        marketplace_published: user.marketplace_published,
        networks_application_id: user.networks_application_id,
        networks_published: user.networks_published,
        networks_profile_config: user.networks_profile_config,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (error: any) {
    if (
      error instanceof NotFoundError ||
      error instanceof MissingUserContextError
    ) {
      next(error);
    } else {
      next(new DatabaseError("Failed to fetch user", error));
    }
  }
};

import { Offer } from "../../models/Offer";

/**
 * Get marketplace user offers
 * GET /api/v1/marketplace/user/offers
 */
export const marketplace_user_offers_get_handler = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user)
      throw new MissingUserContextError({
        route: req.path,
        note: "(req as any).user missing in marketplace_user_offers_get",
      });

    const type = (req.query.type === "sent" || req.query.type === "received") ? req.query.type : "sent";
    const status = (req.query.status as string) ?? "all";
    const MAX_LIMIT = 100;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), MAX_LIMIT);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const userId = new mongoose.Types.ObjectId((req as any).user.dialist_id);

    const query: any = { platform: "marketplace" };
    
    if (type === "sent") {
      query.buyer_id = userId;
    } else {
      query.seller_id = userId;
    }

    if (status !== "all") {
      query.state = status;
    }

    const offers = await Offer.find(query)
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const total = await Offer.countDocuments(query);

    const response: ApiResponse<any> = {
      data: offers,
      _metadata: {
        total,
        limit,
        offset,
      },
      requestId: (req.headers["x-request-id"] as string) ?? "",
    };

    res.json(response);
  } catch (error: any) {
    if (error instanceof MissingUserContextError) {
      next(error);
    } else {
      next(new DatabaseError("Failed to fetch user offers", error));
    }
  }
};
