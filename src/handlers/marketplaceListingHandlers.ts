import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../types";
import {
  AuthorizationError,
  DatabaseError,
  MissingUserContextError,
  NotFoundError,
  ValidationError,
} from "../utils/errors";
import {
  CreateListingInput,
  GetListingsInput,
  PublishListingInput,
  UpdateListingInput,
} from "../validation/schemas";
import { MarketplaceListing, IMarketplaceListing } from "../models/Listings";
import { Watch } from "../models/Watches";
import { MerchantOnboarding } from "../models/MerchantOnboarding";
import { ExtractWatchSpecData } from "../utils/watchDataExtraction";
import { validateListingCompleteness } from "../utils/listingValidation";
import { buildListingFilter, buildListingSort } from "../utils/listingFilters";
import { Subscription } from "../models/Subscription";
import { feedService } from "../services/FeedService";
import { isoMatchingService } from "../services/ISOMatchingService";
import { listingEvents } from "../events/listingEvents";
import logger from "../utils/logger";

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
 * Get public marketplace listings with filtering, sorting, and pagination
 * GET /api/v1/marketplace/listings
 */
export const marketplace_listings_get = async (
  req: Request<{}, {}, {}, GetListingsInput["query"]>,
  res: Response<ApiResponse<IMarketplaceListing[]>>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      q,
      brand,
      condition,
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
    if (q) filterInput.q = q;
    if (brand) filterInput.brand = brand;
    if (condition) filterInput.condition = condition;
    if (min_price) filterInput.min_price = min_price;
    if (max_price) filterInput.max_price = max_price;
    if (allow_offers !== undefined) filterInput.allow_offers = allow_offers;

    const filter = buildListingFilter(
      filterInput,
      true // Marketplace now supports allow_offers filtering
    );

    // Build sort object using shared utility
    const sort = buildListingSort(sort_by, sort_order);

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [listings, total] = await Promise.all([
      MarketplaceListing.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      MarketplaceListing.countDocuments(filter),
    ]);

    const response: ApiResponse<IMarketplaceListing[]> = {
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
          condition,
          min_price,
          max_price,
        },
        sort: {
          field: sort_by,
          order: sort_order,
        },
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching marketplace listings:", error);
    next(new DatabaseError("Failed to fetch listings", error));
  }
};

/**
 * Get a single marketplace listing by ID
 * GET /api/v1/marketplace/listings/:id
 */
export const marketplace_listing_get_by_id = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<IMarketplaceListing>>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const listing = await MarketplaceListing.findById(id).lean();

    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    const response: ApiResponse<IMarketplaceListing> = {
      data: listing as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (error) {
    if (error instanceof NotFoundError) {
      next(error);
    } else {
      console.error("Error fetching listing by ID:", error);
      next(new DatabaseError("Failed to fetch listing", error));
    }
  }
};

/**
 * Create a new marketplace listing
 * POST /api/v1/marketplace/listings
 */
export const marketplace_listing_create = async (
  req: Request<{}, {}, CreateListingInput["body"]>,
  res: Response<ApiResponse<IMarketplaceListing>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "req.user missing in createListing",
      });
    }

    const user = req.user;

    // ✅ Check if user is an approved merchant (query MerchantOnboarding collection)
    const merchantOnboarding = await MerchantOnboarding.findOne({
      dialist_user_id: user.dialist_id,
      onboarding_state: "APPROVED",
    });

    if (!merchantOnboarding) {
      throw new AuthorizationError(
        "Only approved merchants can create marketplace listings. Please complete merchant onboarding first.",
        {
          route: req.path,
          userId: user.userId,
          requiredPermission: "MERCHANT_APPROVED",
        }
      );
    }

    const { watch } = req.body;

    const fetchedProduct = await Watch.findById(watch).lean();
    if (!fetchedProduct) {
      throw new NotFoundError(`Watch with ID ${watch} not found`);
    }

    // Extract watch fields
    const watchDetails = ExtractWatchSpecData(fetchedProduct);

    if (!watchDetails) {
      throw new ValidationError("Invalid watch data - missing required fields");
    }

    // ✅ ENFORCE DRAFT LIMIT: Max 10 draft listings per user
    const draftCount = await MarketplaceListing.countDocuments({
      dialist_id: user.dialist_id,
      status: "draft",
    });

    if (draftCount >= MAX_DRAFT_LISTINGS) {
      throw new ValidationError(
        `Maximum ${MAX_DRAFT_LISTINGS} draft listings allowed. Please publish or delete existing drafts.`,
        { current_drafts: draftCount, limit: MAX_DRAFT_LISTINGS }
      );
    }

    // Create listing with watch_snapshot (immutable watch data)
    const newListing = await MarketplaceListing.create({
      status: "draft",
      dialist_id: user.dialist_id,
      clerk_id: user.userId,
      watch_id: watchDetails.watch_id,
      title: `${watchDetails.brand} ${watchDetails.model}`,
      brand: watchDetails.brand,
      model: watchDetails.model,
      reference: watchDetails.reference,
      diameter: watchDetails.diameter,
      bezel: watchDetails.bezel,
      materials: watchDetails.materials,
      bracelet: watchDetails.bracelet,
      color: watchDetails.color,
      watch_snapshot: {
        brand: watchDetails.brand,
        model: watchDetails.model,
        reference: watchDetails.reference,
        diameter: watchDetails.diameter,
        bezel: watchDetails.bezel,
        materials: watchDetails.materials,
        bracelet: watchDetails.bracelet,
        color: watchDetails.color,
      },
      author: {
        _id: user.dialist_id,
        name: user.display_name,
        avatar: user.display_avatar,
        location: user.location,
      },
      ships_from: {
        country: user.location_country,
      },
    });

    const response: ApiResponse<IMarketplaceListing> = {
      data: newListing.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(201).json(response);
  } catch (err) {
    console.error(err);
    if (
      err instanceof NotFoundError ||
      err instanceof MissingUserContextError ||
      err instanceof AuthorizationError
    ) {
      next(err);
    } else {
      console.error(err);
      next(new DatabaseError("Failed to create listing", err));
    }
  }
};

/**
 * Update a marketplace listing
 * PATCH /api/v1/marketplace/listings/:id
 */
export const marketplace_listing_update = async (
  req: Request<UpdateListingInput["params"], {}, UpdateListingInput["body"]>,
  res: Response<ApiResponse<IMarketplaceListing>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "req.user missing in updateListing",
      });
    }

    const { id } = req.params;
    const updates = req.body;

    // Find listing
    const listing = await MarketplaceListing.findById(id);
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Validate ownership
    if (String(listing.dialist_id) !== String(req.user.dialist_id)) {
      throw new AuthorizationError("Not authorized to edit this listing", {});
    }

    // Only allow updates if draft
    if (listing.status !== "draft") {
      throw new ValidationError("Only draft listings can be updated");
    }

    // Apply updates (Zod already validated allowed fields via .strict())
    Object.assign(listing, updates);
    await listing.save();

    const response: ApiResponse<IMarketplaceListing> = {
      data: listing.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err) {
    console.error("Error updating listing:", err);
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
 * Publish a marketplace listing
 * POST /api/v1/marketplace/listings/:id/publish
 */
export const marketplace_listing_publish = async (
  req: Request<PublishListingInput["params"], {}, {}>,
  res: Response<ApiResponse<IMarketplaceListing>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "req.user missing in publishListing",
      });
    }

    const { id } = req.params;

    // Find listing
    const listing = await MarketplaceListing.findById(id);
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Validate ownership
    if (String(listing.dialist_id) !== String(req.user.dialist_id)) {
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
    // Check user's subscription tier
    const subscription = await Subscription.findOne({
      user_id: req.user.dialist_id,
      status: "active",
    });

    const maxActiveListings = subscription?.tier === "premium" || subscription?.tier === "enterprise"
      ? MAX_ACTIVE_LISTINGS_PREMIUM
      : MAX_ACTIVE_LISTINGS_FREE;

    const activeCount = await MarketplaceListing.countDocuments({
      dialist_id: req.user.dialist_id,
      status: "active",
    });

    if (activeCount >= maxActiveListings) {
      const upgradeMessage = subscription?.tier === "free" || !subscription
        ? " Upgrade to Premium for up to 50 active listings."
        : "";
      throw new ValidationError(
        `Maximum ${maxActiveListings} active listings allowed.${upgradeMessage}`,
        {
          current_active: activeCount,
          limit: maxActiveListings,
          tier: subscription?.tier || "free",
        }
      );
    }

    // Publish
    listing.status = "active";
    await listing.save();

    // ✅ Add to activity feed for followers
    try {
      await feedService.addListingActivity(
        String(req.user.dialist_id),
        String(listing._id),
        {
          title: listing.title || "New Listing",
          price: listing.price || 0,
          ...(listing.thumbnail && { thumbnail: listing.thumbnail }),
        }
      );
    } catch (feedError) {
      logger.warn("Failed to add listing to activity feed", { feedError });
    }

    // ✅ Match against active ISOs and notify owners (Async via Event)
    try {
      listingEvents.emitPublished(listing);
    } catch (isoError) {
      logger.warn("Failed to emit listing published event", { isoError });
    }

    const response: ApiResponse<IMarketplaceListing> = {
      data: listing.toJSON() as any,
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err) {
    console.error("Error publishing listing:", err);
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
