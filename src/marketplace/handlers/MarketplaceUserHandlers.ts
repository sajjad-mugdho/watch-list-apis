import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { ApiResponse } from "../../types";
import logger from "../../utils/logger";
import {
  AppError,
  ConflictError,
  DatabaseError,
  MissingUserContextError,
  ValidationError,
} from "../../utils/errors";
import {
  IMarketplaceListing,
  MarketplaceListing,
} from "../models/MarketplaceListing";
import mongoose from "mongoose";
import { User } from "../../models/User";
import { MarketplaceOnboardingCompleteInput } from "../../validation/schemas";
import { MerchantOnboarding } from "../models/MerchantOnboarding";
import { ensureMerchantOnboardingSession } from "./MarketplaceMerchantHandlers";

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
 * Get marketplace user info
 * GET /api/v1/marketplace/user
 */
export const marketplace_user_get = async (
  req: Request,
  res: Response<ApiResponse<{ platform: "marketplace" }>>,
  next: NextFunction,
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
 * Get marketplace user inventory (listings)
 * GET /api/v1/marketplace/user/listings
 */
export const marketplace_user_inventory_get = async (
  req: Request,
  res: Response<ApiResponse<IMarketplaceListing[], InventoryMetadata>>,
  next: NextFunction,
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
    logger.error("Error fetching marketplace user inventory", { error: err });
    if (err instanceof MissingUserContextError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch user inventory", err));
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
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user)
      throw new MissingUserContextError({
        route: req.path,
        note: "(req as any).user missing in marketplace_user_offers_get",
      });

    const type =
      req.query.type === "sent" || req.query.type === "received"
        ? req.query.type
        : "sent";
    const status = (req.query.status as string) ?? "all";
    const MAX_LIMIT = 100;
    const limit = Math.min(
      Math.max(parseInt(req.query.limit as string, 10) || 50, 1),
      MAX_LIMIT,
    );
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

// ----------------------------------------------------------
// Marketplace Onboarding Handlers
// ----------------------------------------------------------

/**
 * Get marketplace onboarding status
 * GET /api/v1/marketplace/onboarding/status
 *
 * Returns onboarding status with pre-population hints if user has completed Networks onboarding.
 * Used on first Marketplace app load to determine if user needs to complete onboarding.
 */
export const marketplace_onboarding_status_get = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const dialist_id = req.user?.dialist_id;
    if (!dialist_id) {
      throw new MissingUserContextError({ route: req.path });
    }

    // Load user document
    const user = await User.findById(dialist_id).select(
      [
        "first_name",
        "last_name",
        "location",
        "onboarding",
        "marketplace_onboarding",
      ].join(" "),
    );
    if (!user) {
      throw new ValidationError("User not found");
    }

    // Check if user has completed Networks onboarding (for pre-population)
    const networksComplete = user.onboarding?.status === "completed";
    const marketplaceComplete =
      user.marketplace_onboarding?.status === "completed";

    const networksProfile = user.onboarding?.steps?.profile;
    const networksLocation = user.onboarding?.steps?.location;

    const hasPrefillProfile =
      networksComplete &&
      !!networksProfile?.first_name?.trim() &&
      !!networksProfile?.last_name?.trim();

    const hasPrefillLocation =
      networksComplete &&
      !!networksLocation?.country &&
      !!networksLocation?.region?.trim() &&
      !!networksLocation?.currency?.trim();

    const intent = user.marketplace_onboarding?.intent ?? "buyer";

    // Fetch merchant onboarding state to surface dealer status (auto-start from marketplace onboarding)
    const merchantOnboarding = await MerchantOnboarding.findOne({
      dialist_user_id: user._id,
    });
    const merchantState = merchantOnboarding?.onboarding_state ?? null;

    // Build pre-population data if valid completed Networks source data exists
    const pre_populated =
      marketplaceComplete || (!hasPrefillProfile && !hasPrefillLocation)
        ? null
        : {
            ...(hasPrefillProfile && {
              first_name: networksProfile?.first_name ?? null,
              last_name: networksProfile?.last_name ?? null,
            }),
            ...(hasPrefillLocation && {
              location: {
                country: networksLocation?.country ?? null,
                region: networksLocation?.region ?? null,
                postal_code: networksLocation?.postal_code ?? null,
                city: networksLocation?.city ?? null,
                line1: networksLocation?.line1 ?? null,
                line2: networksLocation?.line2 ?? null,
                currency: networksLocation?.currency ?? null,
              },
            }),
            source: "networks",
          };

    // Determine what fields still need to be collected
    const requires = marketplaceComplete
      ? []
      : [
          ...(hasPrefillProfile ? [] : ["profile"]),
          ...(hasPrefillLocation ? [] : ["location"]),
          "marketplace_avatar",
          "marketplace_tos",
          "intent",
        ];

    // Determine user type (buyer vs dealer) based on merchant status
    const user_type = merchantState === "APPROVED" ? "dealer" : "buyer";

    // Build response
    const response: ApiResponse<any> = {
      data: {
        status: user.marketplace_onboarding?.status || "incomplete",
        ...(pre_populated && { pre_populated }),
        ...(requires.length > 0 && { requires }),
        ...(marketplaceComplete && { user_type, intent }),
        ...(merchantState && { merchant_onboarding_state: merchantState }),
        ...(merchantOnboarding && {
          merchant_onboarding: {
            form_id: merchantOnboarding.form_id,
            onboarding_state: merchantOnboarding.onboarding_state,
            last_form_link: merchantOnboarding.last_form_link ?? null,
            last_form_link_expires_at:
              merchantOnboarding.last_form_link_expires_at
                ? merchantOnboarding.last_form_link_expires_at.toISOString()
                : null,
          },
        }),
      },
      _metadata: {
        message: "Marketplace onboarding status retrieved successfully",
        timestamp: new Date(),
      },
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error("Error retrieving marketplace onboarding status", { error });
    next(
      error instanceof AppError
        ? error
        : new DatabaseError("Failed to retrieve onboarding status", error),
    );
  }
};

/**
 * Complete marketplace onboarding atomically
 * PATCH /api/v1/marketplace/onboarding/complete
 *
 * Accepts: intent (buyer|dealer), profile (first/last name), location, avatar (upload URL), acknowledgements (marketplace_tos)
 * Does NOT accept payment - payment is handled separately by dealer upgrade flow
 *
 * Data Persistence:
 * - All fields saved together (atomic transaction)
 * - If any validation fails, entire update is rolled back
 * - marketplace_avatar is stored separately from networks_avatar
 * - marketplace_display_name is set to first + last name initially
 * - Timestamps recorded for audit trail
 * - Status changed to "completed" on success only
 */
export const marketplace_onboarding_complete_patch = async (
  req: Request<{}, {}, MarketplaceOnboardingCompleteInput["body"]>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  let session: mongoose.ClientSession | null = null;

  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const dialist_id = req.user?.dialist_id;
    if (!dialist_id) {
      throw new MissingUserContextError({ route: req.path });
    }

    // Load user within transaction
    const user = await User.findById(dialist_id).session(session);
    if (!user) {
      throw new ValidationError("User not found");
    }

    // Guard: prevent re-completion
    if (user.marketplace_onboarding?.status === "completed") {
      throw new ConflictError("Marketplace onboarding already completed");
    }

    const requestId = req.headers["x-request-id"] as string;

    // Extract payload (NO payment, NO dealer_mode)
    const { profile, location, avatar, acknowledgements, intent } = req.body;

    // Update marketplace profile (can differ from Networks)
    user.marketplace_display_name =
      `${profile.first_name} ${profile.last_name}`.trim();

    // Update location (can be edited from Networks pre-population)
    user.location = {
      country: location.country,
      region: location.region,
      postal_code: location.postal_code ?? null,
      city: location.city ?? null,
      line1: location.line1 ?? null,
      line2: location.line2 ?? null,
      currency: location.currency,
    };

    // Update marketplace avatar (separate from networks_avatar)
    if (avatar.type === "upload") {
      user.marketplace_avatar = avatar.url;
    }

    // Update marketplace_onboarding steps
    user.marketplace_onboarding = {
      status: "completed",
      version: "1.0",
      intent,
      completed_at: new Date(),
      steps: {
        profile: {
          first_name: profile.first_name,
          last_name: profile.last_name,
          confirmed: true,
          updated_at: new Date(),
        },
        location: {
          country: location.country,
          region: location.region,
          postal_code: location.postal_code ?? null,
          city: location.city ?? null,
          line1: location.line1 ?? null,
          line2: location.line2 ?? null,
          currency: location.currency,
          confirmed: true,
          updated_at: new Date(),
        },
        avatar: {
          url: avatar.url,
          confirmed: true,
          updated_at: new Date(),
        },
        acknowledgements: {
          marketplace_tos: acknowledgements.marketplace_tos,
          updated_at: new Date(),
        },
      },
    };

    // Persist legal acknowledgements (Marketplace owns ToS now)
    user.legal_acks = {
      privacy_ack: user.legal_acks?.privacy_ack ?? false,
      rules_ack: user.legal_acks?.rules_ack ?? false,
      tos_ack: acknowledgements.marketplace_tos,
    };

    // Save within transaction
    await user.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Auto-start merchant onboarding when user selects dealer intent
    let merchant_onboarding: any = null;
    if (intent === "dealer") {
      try {
        merchant_onboarding = await ensureMerchantOnboardingSession({
          user,
          requestId,
          idempotencyId: randomUUID(),
          businessName: user.marketplace_display_name,
        });
      } catch (error) {
        logger.error("Failed to auto-start merchant onboarding", {
          error,
          user_id: user._id.toString(),
          requestId,
        });
      }
    }

    const merchantRecord = await MerchantOnboarding.findOne({
      dialist_user_id: user._id,
    });

    const user_type =
      merchantRecord?.onboarding_state === "APPROVED" ? "dealer" : "buyer";

    // Return success response with complete marketplace profile
    const response: ApiResponse<any> = {
      data: {
        user: {
          user_id: user._id,
          dialist_id: user.dialist_id,
          first_name: user.first_name,
          last_name: user.last_name,
          marketplace_display_name: user.marketplace_display_name,
        },
        marketplace_onboarding: {
          status: user.marketplace_onboarding.status,
          completed_at: user.marketplace_onboarding.completed_at,
          intent,
          user_type,
          ...(merchantRecord && {
            merchant_onboarding_state: merchantRecord.onboarding_state,
            merchant_onboarding_form_id: merchantRecord.form_id,
            merchant_onboarding_link: merchantRecord.last_form_link ?? null,
            merchant_onboarding_link_expires_at:
              merchantRecord.last_form_link_expires_at
                ? merchantRecord.last_form_link_expires_at.toISOString()
                : null,
          }),
        },
        ...(merchant_onboarding && {
          merchant_onboarding,
        }),
      },
      _metadata: {
        message: "Marketplace onboarding completed successfully",
        timestamp: new Date(),
      },
      requestId,
    };

    res.status(200).json(response);
  } catch (error) {
    // Rollback transaction on any error
    if (session && session.inTransaction()) {
      await session.abortTransaction();
    }

    // Log error and delegate to error handler
    logger.error("Error completing marketplace onboarding", { error });
    next(
      error instanceof AppError
        ? error
        : new DatabaseError("Failed to complete onboarding", error),
    );
  } finally {
    await session?.endSession();
  }
};
