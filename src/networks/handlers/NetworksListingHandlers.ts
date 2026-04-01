import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import {
  AuthorizationError,
  DatabaseError,
  MissingUserContextError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors";
import {
  CreateListingInput,
  GetListingsInput,
  PublishListingInput,
  UpdateListingInput,
  UpdateListingStatusInput,
  DeleteListingInput,
} from "../../validation/schemas";
import { INetworkListing, NetworkListing } from "../models/NetworkListing";

import { Watch } from "../../models/Watches";
import { NetworkListingChannel } from "../models/NetworkListingChannel";
import { ExtractWatchSpecData } from "../../utils/watchDataExtraction";
import { validateListingCompleteness } from "../../utils/listingValidation";
import {
  buildListingFilter,
  buildListingSort,
} from "../../utils/listingFilters";
import { transitionListingStatus } from "../../utils/listingStatusMachine";
import { Subscription } from "../../models/Subscription";
import { feedService } from "../../services/FeedService";
import { listingEvents } from "../../events/listingEvents";
import logger from "../../utils/logger";

// ----------------------------------------------------------
// Constants - Listing Limits
// ----------------------------------------------------------
const MAX_DRAFT_LISTINGS = 10;
const MAX_ACTIVE_LISTINGS_FREE = 25;
const MAX_ACTIVE_LISTINGS_PREMIUM = 50;

// ----------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------
// (Extracted to shared utilities)

// ----------------------------------------------------------
// Handler Functions
// ----------------------------------------------------------

/**
 * Get public listings with filtering, sorting, and pagination
 * GET /api/v1/networks/listings
 */
export const networks_listings_get = async (
  req: Request<{}, {}, {}, GetListingsInput["query"]>,
  res: Response<ApiResponse<INetworkListing[]>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const {
      q,
      brand,
      category,
      condition,
      contents,
      year_min,
      year_max,
      min_price,
      max_price,
      allow_offers,
      sort_by,
      sort_order,
      limit,
      page,
    } = req.query;

    // Build filter query using shared utility
    const filterInput: Record<string, any> = {};
    if (q && sort_by !== "relevance") filterInput.q = q;
    if (brand) filterInput.brand = brand;
    if (category) filterInput.category = category;
    if (condition) filterInput.condition = condition;
    if (contents) filterInput.contents = contents;
    if (year_min !== undefined) filterInput.year_min = year_min;
    if (year_max !== undefined) filterInput.year_max = year_max;
    if (min_price !== undefined) filterInput.min_price = min_price;
    if (max_price !== undefined) filterInput.max_price = max_price;
    if (allow_offers !== undefined) filterInput.allow_offers = allow_offers;

    const filter = buildListingFilter(
      filterInput,
      true, // Networks supports allow_offers filtering
    );

    // Build sort object using shared utility
    const sort = buildListingSort(sort_by, sort_order);

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination (excluding deleted)
    const activeFilter: Record<string, any> = {
      ...filter,
      is_deleted: { $ne: true },
      status: { $in: ["active", "reserved", "sold"] },
    };
    if (sort_by === "relevance" && q) {
      activeFilter.$text = { $search: String(q) };
    }

    const listQuery =
      sort_by === "relevance" && q
        ? NetworkListing.find(activeFilter, {
            score: { $meta: "textScore" },
          }).sort({ score: { $meta: "textScore" }, createdAt: -1 } as any)
        : NetworkListing.find(activeFilter).sort(sort);

    const [listings, total] = await Promise.all([
      listQuery.skip(skip).limit(limit).lean(),
      NetworkListing.countDocuments(activeFilter),
    ]);

    const response: ApiResponse<INetworkListing[]> = {
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
        filters: {
          q,
          brand,
          category,
          condition,
          contents,
          year_min,
          year_max,
          min_price,
          max_price,
          allow_offers,
        },
        sort: {
          field: sort_by,
          order: sort_order,
        },
      },
    };

    res.json(response);
  } catch (error: any) {
    logger.error("Error fetching networks listings", { error });
    next(new DatabaseError("Failed to fetch listings", error));
  }
};

/**
 * Create a new network listing
 * POST /api/v1/networks/listings
 */
export const networks_listing_create = async (
  req: Request<{}, {}, CreateListingInput["body"]>,
  res: Response<ApiResponse<INetworkListing>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "(req as any).user missing in createListing",
      });
    }

    const user = (req as any).user;
    const { watch, type = "for_sale" } = req.body;
    const country =
      (typeof user.location_country === "string" &&
        user.location_country.trim()) ||
      "US";

    const fetchedProduct = await Watch.findById(watch).lean();
    if (!fetchedProduct) {
      throw new NotFoundError(`Watch with ID ${watch} not found`);
    }

    // Extract watch fields
    const watchDetails = ExtractWatchSpecData(fetchedProduct);

    // ✅ ENFORCE DRAFT LIMIT: Max 10 draft listings per user
    const draftCount = await NetworkListing.countDocuments({
      dialist_id: user.dialist_id,
      status: "draft",
    });

    if (draftCount >= MAX_DRAFT_LISTINGS) {
      throw new ValidationError(
        `Maximum ${MAX_DRAFT_LISTINGS} draft listings allowed. Please publish or delete existing drafts.`,
        { current_drafts: draftCount, limit: MAX_DRAFT_LISTINGS },
      );
    }

    // Create listing
    const newListing = await NetworkListing.create({
      status: "draft",
      type,
      dialist_id: user.dialist_id,
      clerk_id: user.userId,
      title: `${watchDetails?.brand} ${watchDetails?.model}`,
      ...watchDetails,
      author: {
        _id: user.dialist_id,
        name: user.display_name,
        avatar: user.display_avatar,
        location: user.location,
      },
      ships_from: {
        country,
      },
    });

    const response: ApiResponse<INetworkListing> = {
      data: newListing.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(201).json(response);
  } catch (err: any) {
    if (
      err instanceof ValidationError ||
      err instanceof AuthorizationError ||
      err instanceof NotFoundError
    ) {
      return next(err);
    }
    next(new DatabaseError("Failed to create listing", err));
  }
};

/**
 * Update a network listing
 * PATCH /api/v1/networks/listings/:id
 */
export const networks_listing_update = async (
  req: Request<UpdateListingInput["params"], {}, UpdateListingInput["body"]>,
  res: Response<ApiResponse<INetworkListing>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "(req as any).user missing in updateListing",
      });
    }

    const { id } = req.params;
    const updates = req.body;

    // Find listing
    const listing = await NetworkListing.findOne({
      _id: id,
      is_deleted: { $ne: true },
    });
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Validate ownership
    if (String(listing.dialist_id) !== String((req as any).user.dialist_id)) {
      throw new AuthorizationError("Not authorized to edit this listing", {});
    }

    // BLOCK Modification if active binding counter-offer exists
    const hasBindingOffer = await NetworkListingChannel.findOne({
      listing_id: id,
      status: "open",
      "last_offer.offer_type": "counter",
      "last_offer.status": "sent",
      "last_offer.expiresAt": { $gt: new Date() },
    });
    if (hasBindingOffer) {
      throw new ValidationError(
        "Cannot modify listing while a binding counter-offer is active (24h period)",
      );
    }

    // Only allow updates if draft
    if (listing.status !== "draft") {
      throw new ValidationError("Only draft listings can be updated");
    }

    // Apply updates (Zod already validated allowed fields via .strict())
    Object.assign(listing, updates);
    await listing.save();

    const response: ApiResponse<INetworkListing> = {
      data: listing.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err: any) {
    logger.error("Error updating listing", { error: err });
    if (
      err instanceof NotFoundError ||
      err instanceof AuthorizationError ||
      err instanceof ValidationError ||
      err instanceof MissingUserContextError
    ) {
      next(err);
    } else {
      next(new DatabaseError("Failed to update listing", err));
    }
  }
};

/**
 * Publish a network listing
 * POST /api/v1/networks/listings/:id/publish
 */
export const networks_listing_publish = async (
  req: Request<PublishListingInput["params"], {}, {}>,
  res: Response<ApiResponse<INetworkListing>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "(req as any).user missing in publishListing",
      });
    }

    const { id } = req.params;

    // Find listing
    const listing = await NetworkListing.findOne({
      _id: id,
      is_deleted: { $ne: true },
    });
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Validate ownership
    if (String(listing.dialist_id) !== String((req as any).user.dialist_id)) {
      throw new AuthorizationError("Not authorized to edit this listing", {});
    }

    // Must be draft
    if (listing.status !== "draft") {
      throw new ValidationError("Only draft listings can be published");
    }

    // Validate completeness
    const missing = validateListingCompleteness(listing);
    if (missing.length > 0) {
      throw new ValidationError("Draft is missing required fields to publish", {
        missing,
      });
    }

    // ✅ ENFORCE ACTIVE LIMIT: Max 25 (or 50 for premium) active listings
    const subscription = await Subscription.findOne({
      user_id: (req as any).user.dialist_id,
      status: "active",
    });

    const maxActiveListings =
      subscription?.tier === "premium" || subscription?.tier === "enterprise"
        ? MAX_ACTIVE_LISTINGS_PREMIUM
        : MAX_ACTIVE_LISTINGS_FREE;

    const activeCount = await NetworkListing.countDocuments({
      dialist_id: (req as any).user.dialist_id,
      status: "active",
    });

    if (activeCount >= maxActiveListings) {
      const upgradeMessage =
        subscription?.tier === "free" || !subscription
          ? " Upgrade to Premium for up to 50 active listings."
          : "";
      throw new ValidationError(
        `Maximum ${maxActiveListings} active listings allowed.${upgradeMessage}`,
        {
          current_active: activeCount,
          limit: maxActiveListings,
          tier: subscription?.tier || "free",
        },
      );
    }

    // Publish
    listing.status = "active";
    await listing.save();

    // ✅ Add to activity feed for followers
    try {
      await feedService.addListingActivity(
        String((req as any).user.dialist_id),
        String(listing._id),
        {
          title: listing.title || "New Listing",
          price: listing.price || 0,
          ...(listing.thumbnail && { thumbnail: listing.thumbnail }),
        },
      );
    } catch (feedError) {
      logger.warn("Failed to add network listing to activity feed", {
        feedError,
      });
    }

    // Trigger ISO matching (Async via Event)
    try {
      listingEvents.emitPublished(listing);
    } catch (isoError) {
      logger.warn("Failed to trigger ISO matching for network listing", {
        isoError,
      });
    }

    const response: ApiResponse<INetworkListing> = {
      data: listing.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err: any) {
    logger.error("Error publishing listing", { error: err });
    if (
      err instanceof NotFoundError ||
      err instanceof AuthorizationError ||
      err instanceof ValidationError ||
      err instanceof MissingUserContextError
    ) {
      next(err);
    } else {
      next(new DatabaseError("Failed to publish listing", err));
    }
  }
};

/**
 * Update listing status (deactivate/reactivate)
 * PATCH /api/v1/networks/listings/:id/status
 */
export const networks_listing_status_patch = async (
  req: Request<
    UpdateListingStatusInput["params"],
    {},
    UpdateListingStatusInput["body"]
  >,
  res: Response<ApiResponse<INetworkListing>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "(req as any).user missing in statusUpdate",
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    // Find listing
    const listing = await NetworkListing.findOne({
      _id: id,
      is_deleted: { $ne: true },
    });
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Validate ownership
    if (String(listing.dialist_id) !== String((req as any).user.dialist_id)) {
      throw new AuthorizationError("Not authorized to edit this listing", {});
    }

    // BLOCK Status change if active binding counter-offer exists
    const hasBindingOffer = await NetworkListingChannel.findOne({
      listing_id: id,
      status: "open",
      "last_offer.offer_type": "counter",
      "last_offer.status": "sent",
      "last_offer.expiresAt": { $gt: new Date() },
    });
    if (hasBindingOffer) {
      throw new ValidationError(
        "Cannot change status while a binding counter-offer is active (24h period)",
      );
    }

    // Transition status
    await transitionListingStatus(listing, status);

    const response: ApiResponse<INetworkListing> = {
      data: listing.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err: any) {
    logger.error("Error updating listing status", { error: err });
    if (
      err instanceof NotFoundError ||
      err instanceof AuthorizationError ||
      err instanceof ValidationError ||
      err instanceof MissingUserContextError
    ) {
      next(err);
    } else {
      next(new DatabaseError("Failed to update listing status", err));
    }
  }
};

/**
 * Delete a network listing (soft delete)
 * DELETE /api/v1/networks/listings/:id
 */
export const networks_listing_delete = async (
  req: Request<DeleteListingInput["params"]>,
  res: Response<ApiResponse<{ success: boolean }>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "(req as any).user missing in deleteListing",
      });
    }

    const { id } = req.params;

    // Find listing
    const listing = await NetworkListing.findOne({
      _id: id,
      is_deleted: { $ne: true },
    });
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Validate ownership
    if (String(listing.dialist_id) !== String((req as any).user.dialist_id)) {
      throw new AuthorizationError("Not authorized to delete this listing", {});
    }

    // BLOCK Deletion if any active channel (ongoing negotiation/offer) exists
    const hasActiveChannel = await NetworkListingChannel.findOne({
      listing_id: id,
      status: "open",
    });
    if (hasActiveChannel) {
      throw new ValidationError(
        "Cannot delete listing while there is an active offer or negotiation",
      );
    }

    // Check for active orders/offers if necessary (placeholder for now)
    // For now, we allow soft delete if it's draft or active or inactive
    // If reserved or sold, we might want to block deletion.
    if (listing.status === "reserved" || listing.status === "sold") {
      throw new ValidationError(
        `Cannot delete listing with status: ${listing.status}`,
      );
    }

    // Permanent delete for now, or we could add 'isDeleted' field.
    // The user rules suggest "Soft delete recommended".

    listing.is_deleted = true;
    await listing.save();

    res.json({
      data: { success: true },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    logger.error("Error deleting listing", { error: err });
    if (
      err instanceof NotFoundError ||
      err instanceof AuthorizationError ||
      err instanceof ValidationError ||
      err instanceof MissingUserContextError
    ) {
      next(err);
    } else {
      next(new DatabaseError("Failed to delete listing", err));
    }
  }
};

/**
 * Get listing preview (for draft or unpublished listings)
 * GET /api/v1/networks/listings/:id/preview
 */
export const networks_listing_preview = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<INetworkListing>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "(req as any).user missing in getPreview",
      });
    }

    const { id } = req.params;

    // Find listing
    const listing = await NetworkListing.findOne({
      _id: id,
      is_deleted: { $ne: true },
    });
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Validate ownership - only author can preview their own draft/listing
    if (String(listing.dialist_id) !== String((req as any).user.dialist_id)) {
      throw new AuthorizationError(
        "Not authorized to preview this listing",
        {},
      );
    }

    const response: ApiResponse<INetworkListing> = {
      data: listing.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err: any) {
    logger.error("Error fetching listing preview", { error: err });
    if (
      err instanceof NotFoundError ||
      err instanceof AuthorizationError ||
      err instanceof ValidationError ||
      err instanceof MissingUserContextError
    ) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch listing preview", err));
    }
  }
};

/**
 * Get a single network listing by ID (Public view)
 * GET /api/v1/networks/listings/:id
 *
 * Visibility:
 * - Active/Reserved/Sold: Anyone
 * - Draft/Inactive: Author only
 */
export const networks_listing_get = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<INetworkListing>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.dialist_id;

    const listing = await NetworkListing.findById(id);
    if (!listing || listing.is_deleted) {
      throw new NotFoundError("Listing not found");
    }

    // Visibility check
    const isOwner = userId && String(listing.dialist_id) === String(userId);
    const isPubliclyVisible = ["active", "reserved", "sold"].includes(
      listing.status,
    );

    if (!isPubliclyVisible && !isOwner) {
      throw new AuthorizationError(
        "You do not have permission to view this listing",
        {},
      );
    }

    const response: ApiResponse<INetworkListing> = {
      data: listing.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err: any) {
    next(err);
  }
};
