// src/validation/schemas.ts
import { z } from "zod";

// ----------------------------------------------------------
// Common constants
// ----------------------------------------------------------
const objectIdRegex = /^[a-f\d]{24}$/i;

// ----------------------------------------------------------
// Clerk Authentication Schemas
// ----------------------------------------------------------
/**
 * UserClaimsSchema — Clerk session claims that may be incomplete
 * Fields marked optional can be undefined even after DB fallback
 */
export const UserClaimsSchema = z
  .object({
    dialist_id: z
      .string()
      .regex(objectIdRegex, "dialist_id must be a 24-char MongoDB ObjectId")
      .optional(), // Optional in JWT, required after DB
    onboarding_status: z.enum(["incomplete", "completed"]).optional(), // Optional in JWT, required after DB
    display_name: z
      .string()
      .min(1, "display_name is required")
      .nullable()
      .optional(),
    networks_application_id: z
      .string()
      .regex(
        objectIdRegex,
        "networks_application_id must be a 24-char MongoDB ObjectId"
      )
      .nullable()
      .optional(),
    networks_accessed: z.boolean().nullable().optional(),
    display_avatar: z.string().optional(),
    location_country: z
      .string()
      .min(2, "location_country must be 2+ chars")
      .optional(),
    location_region: z
      .string()
      .min(2, "location_region must be 2+ chars")
      .optional(),
    onboarding_state: z
      .enum(["PROVISIONING", "UPDATE_REQUESTED", "REJECTED", "APPROVED"])
      .optional(),
  })
  .passthrough();

/**
 * ValidatedUserClaimsSchema — After DB fallback
 * Only dialist_id and onboarding_status are guaranteed
 * Everything else can still be undefined/null per DB schema
 */
export const ValidatedUserClaimsSchema = z
  .object({
    // Required fields (must exist after DB fallback)
    dialist_id: z
      .string()
      .regex(objectIdRegex, "dialist_id must be a 24-char MongoDB ObjectId"),
    onboarding_status: z.enum(["incomplete", "completed"]),
    // Can be null in DB
    display_name: z.string().min(1).nullable(),
    networks_application_id: z
      .string()
      .regex(
        objectIdRegex,
        "networks_application_id must be a 24-char MongoDB ObjectId"
      )
      .nullable(),
    networks_accessed: z.boolean().nullable(),
    // Can be undefined in DB
    display_avatar: z.string().optional(),
    location_country: z
      .string()
      .min(2, "location_country must be 2+ chars")
      .optional(),
    location_region: z
      .string()
      .min(2, "location_region must be 2+ chars")
      .optional(),
    onboarding_state: z
      .enum([
        "PENDING",
        "PROVISIONING",
        "UPDATE_REQUESTED",
        "REJECTED",
        "APPROVED",
      ])
      .optional(),
    isMerchant: z.boolean().optional(),
  })
  .passthrough();

/**
 * RequestUserFromAuthSchema — transforms Clerk data → RequestUser
 */
export const RequestUserFromAuthSchema = z
  .object({
    userId: z.string(),
    claims: ValidatedUserClaimsSchema,
  })
  .transform<Express.RequestUser>(({ userId, claims }) => ({
    userId,
    dialist_id: claims.dialist_id,
    display_name: claims.display_name,
    display_avatar: claims.display_avatar,

    location_country: claims.location_country,
    location_region: claims.location_region,

    onboarding_state: claims.onboarding_state,
    isMerchant: claims.isMerchant,
    onboarding_status: claims.onboarding_status,

    networks_application_id: claims.networks_application_id,
    networks_accessed: claims.networks_accessed,
  }));

// ----------------------------------------------------------
// Watch Schemas
// ----------------------------------------------------------


const watchCategoryValues = [
  "Luxury",
  "Sport",
  "Dress",
  "Vintage",
  "Casual",
  "Dive",
  "Pilot",
  "Uncategorized",
] as const;

/**
 * Schema for watches list endpoint query parameters
 */
export const getWatchesSchema = z.object({
  query: z.object({
    q: z.string().trim().max(100, "Search query too long").optional(),
    sort: z.enum(["recent", "random"]).optional(),
    // Category filter
    category: z.enum(watchCategoryValues).optional(),
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a positive number")
      .transform(Number)
      .refine((n) => n > 0 && n <= 50, "Limit must be between 1 and 50")
      .optional(),
    offset: z
      .string()
      .regex(/^\d+$/, "Offset must be a non-negative number")
      .transform(Number)
      .refine((n) => n >= 0, "Offset must be non-negative")
      .optional(),
  }),
});

// ----------------------------------------------------------
// Listing Schemas
// ----------------------------------------------------------

export const createListingSchema = z.object({
  body: z.object({
    watch: z
      .string()
      .regex(objectIdRegex, "watch must be a 24-char MongoDB ObjectId"),
    type: z.enum(["for_sale", "wtb"]).default("for_sale").optional(),
    year_range: z
      .object({
        min: z.number().min(1800).max(2030).optional(),
        max: z.number().min(1800).max(2030).optional(),
      })
      .optional(),
    price_range: z
      .object({
        min: z.number().min(0).optional(),
        max: z.number().min(0).optional(),
      })
      .optional(),
    acceptable_conditions: z
      .array(z.enum(["new", "like-new", "good", "fair", "poor"]))
      .optional(),
    wtb_description: z.string().max(2000).optional(),
  }),
});

/**
 * Schema for reserving a listing (temporary 45-min window)
 */
export const reserveListingSchema = z.object({
  body: z.object({
    listing_id: z
      .string()
      .regex(objectIdRegex, "listing_id must be a 24-char MongoDB ObjectId"),
  }),
});

/**
 * Schema for resetting a listing (dev only)
 */
export const resetListingSchema = z.object({
  body: z.object({
    listing_id: z
      .string()
      .regex(objectIdRegex, "listing_id must be a 24-char MongoDB ObjectId")
      .optional(),
    order_id: z
      .string()
      .regex(objectIdRegex, "order_id must be a 24-char MongoDB ObjectId")
      .optional(),
  }).refine(data => data.listing_id || data.order_id, {
    message: "Either listing_id or order_id must be provided"
  }),
});

/**
 * Schema for user inventory endpoint query parameters
 */
export const getUserInventorySchema = z.object({
  query: z.object({
    status: z.enum(["all", "draft", "active", "reserved", "sold"]).optional(),
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a positive number")
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, "Limit must be between 1 and 100")
      .optional(),
    page: z
      .string()
      .regex(/^\d+$/, "Page must be a positive number")
      .transform(Number)
      .refine((n) => n > 0, "Page must be positive")
      .optional(),
  }),
});

/**
 * Schema for updating a listing
 */
export const updateListingSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid listing ID format"),
  }),
  body: z
    .object({
      subtitle: z.string().max(200).optional(),
      price: z.number().min(0).optional(),
      condition: z.enum(["new", "like-new", "good", "fair", "poor"]).optional(),
      allow_offers: z.boolean().optional(),
      year: z.number().min(1900).max(2025).optional(),
      contents: z.enum(["box_papers", "box", "papers", "watch"]).optional(),
      images: z.array(z.string().url()).optional(),
      thumbnail: z.string().url().optional(),
      shipping: z
        .array(
          z.object({
            region: z.enum(["US", "CA"]),
            shippingIncluded: z.boolean(),
            shippingCost: z.number().min(0),
          })
        )
        .optional(),
      ships_from: z
        .object({
          country: z.string().min(2),
          state: z.string().optional(),
          city: z.string().optional(),
        })
        .optional(),
      type: z.enum(["for_sale", "wtb"]).optional(),
      year_range: z
        .object({
          min: z.number().min(1800).max(2030).optional(),
          max: z.number().min(1800).max(2030).optional(),
        })
        .optional(),
      price_range: z
        .object({
          min: z.number().min(0).optional(),
          max: z.number().min(0).optional(),
        })
        .optional(),
      acceptable_conditions: z
        .array(z.enum(["new", "like-new", "good", "fair", "poor"]))
        .optional(),
      wtb_description: z.string().max(2000).optional(),
    })

    .strict(), // Only allow defined fields
});

/**
 * Schema for publishing a listing
 */
export const publishListingSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid listing ID format"),
  }),
});

// ----------------------------------------------------------
// Offer/Channel Schemas
// ----------------------------------------------------------

/**
 * Schema for sending an offer on a listing
 */
export const sendOfferSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid listing ID"),
  }),
  body: z.object({
    amount: z
      .number()
      .positive("Amount must be positive")
      .int("Amount must be an integer")
      .min(1, "Amount must be at least 1"),
    message: z
      .string()
      .trim()
      .max(500, "Message must be 500 characters or less")
      .optional(),
  }),
});
/**
 * Schema for finix webhook validation
 */
// ----------------------------------------------------------
// Finix Webhook Schemas
// ----------------------------------------------------------

/**
 * Schema for Finix webhook event payload
 * Based on Finix API documentation for webhook events
 */
export const FinixEventSchema = z.object({
  id: z.string().optional(), // Finix's unique event ID
  type: z.string().optional(), // e.g. "created" | "updated"
  entity: z.string().optional(), // e.g. "transfer" | "merchant" | "onboarding_form"
  occurred_at: z.string().optional(),
  _embedded: z.record(z.any()).optional(),
});

/**
 * Schema for Finix webhook request validation
 * Validates headers and body structure
 */
export const FinixWebhookRequestSchema = z.object({
  headers: z
    .object({
      "finix-signature": z.string().optional(),
      "content-type": z.string().optional(),
      authorization: z.string().optional(),
    })
    .passthrough(),
  body: FinixEventSchema,
});

// ----------------------------------------------------------
// Merchant Schemas
// ----------------------------------------------------------

/**
 * Schema for merchant onboarding request
 */
export const MerchantOnboardSchema = z.object({
  body: z
    .object({
      idempotency_id: z
        .string()
        .min(1, "idempotency_id is required for idempotent Finix writes"),
      business_name: z
        .string()
        .trim()
        .min(2, "Business name must be at least 2 characters")
        .max(100, "Business name must be less than 100 characters")
        .optional(),
      max_transaction_amount: z
        .number()
        .int("Max transaction amount must be an integer")
        .positive("Max transaction amount must be positive")
        .max(1000000, "Max transaction amount cannot exceed $10,000")
        .optional(),
      return_url: z.string().url("Return URL must be a valid URL").optional(),
    })
    .strict(),
});

export const merchantRefreshLinkSchema = z.object({
  body: z.object({
    idempotency_id: z.string().min(1),
  }),
});

/**
 * Schema for counter offer
 */
export const counterOfferSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid channel ID"),
  }),
  body: z.object({
    amount: z
      .number()
      .positive("Amount must be positive")
      .int("Amount must be an integer")
      .min(1, "Amount must be at least 1"),
    message: z
      .string()
      .trim()
      .max(500, "Message must be 500 characters or less")
      .optional(),
  }),
});

/**
 * Schema for channel actions (accept/reject/get details)
 */
export const channelActionSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid channel ID"),
  }),
});

/**
 * Schema for getting user's channels/offers
 */
export const getUserChannelsSchema = z.object({
  query: z.object({
    type: z.enum(["sent", "received"]).optional(),
    status: z.enum(["active", "accepted", "declined", "all"]).optional(),
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a positive number")
      .transform(Number)
      .refine((n) => n > 0 && n <= 50, "Limit must be between 1 and 50")
      .optional()
      .default("20"),
    offset: z
      .string()
      .regex(/^\d+$/, "Offset must be a non-negative number")
      .transform(Number)
      .refine((n) => n >= 0, "Offset must be non-negative")
      .optional()
      .default("0"),
  }),
});

/**
 * Schema for getting listing channels (seller view of all offers on a listing)
 */
export const getListingChannelsSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid listing ID"),
  }),
});

/**
 * Schema for getting listing channels (seller view of all offers on a listing)
 */
export const getUserPublicProfileSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid user ID"),
  }),
});

/**
 * Onboarding Step Schemas (wrapped in { body: ... } to match validateRequest)
 */

export const patchLocationStepSchema = z.object({
  body: z.object({
    country: z.enum(["CA", "US"], {
      required_error: "Country is required",
      invalid_type_error: "Country must be 'CA' or 'US'",
    }),
    region: z
      .string({
        required_error: "Region is required",
        invalid_type_error: "Region must be a string",
      })
      .trim()
      .min(1, "Region cannot be empty")
      .max(100, "Region too long"),
    postal_code: z
      .string({
        required_error: "Postal code is required",
        invalid_type_error: "Postal code must be a string",
      })
      .trim()
      .min(3, "Postal code too short")
      .max(12, "Postal code too long")
      .refine(
        (val) => /^[A-Za-z0-9\s-]+$/.test(val),
        "Postal code may only contain letters, numbers, spaces, and hyphens"
      ),
  }),
});

export const patchDisplayNameStepSchema = z.object({
  body: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("default"), // user accepts the suggested/default name
    }),
    z.object({
      mode: z.literal("custom"), // user provides their own
      value: z.string().trim().min(7).max(60),
    }),
  ]),
});
export const patchAvatarStepSchema = z.object({
  body: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("default") }),
    z.object({
      mode: z.literal("custom"),
      url: z.string().trim().url().max(512),
    }),
  ]),
});
export const patchAcksStepSchema = z.object({
  body: z.object({
    tos: z.literal(true),
    privacy: z.literal(true),
    rules: z.literal(true),
  }),
});

// ── Status (no payload) ──
export const getOnboardingStatusSchema = z.object({
  query: z.object({}).optional(),
});

/**
 * Schema for getting listings with filters, sorting, and pagination
 */
export const getListingsSchema = z.object({
  query: z.object({
    // Search
    q: z.string().trim().max(100, "Search query too long").optional(),

    // Filters
    brand: z.string().trim().max(50).optional(),
    condition: z.enum(["new", "like-new", "good", "fair", "poor"]).optional(),
    min_price: z
      .string()
      .regex(/^\d+$/, "Min price must be a number")
      .transform(Number)
      .refine((n) => n >= 0, "Min price must be non-negative")
      .optional(),
    max_price: z
      .string()
      .regex(/^\d+$/, "Max price must be a number")
      .transform(Number)
      .refine((n) => n >= 0, "Max price must be non-negative")
      .optional(),
    allow_offers: z
      .enum(["true", "false"])
      .transform((val) => val === "true")
      .optional(),

    // Sorting
    sort_by: z
      .enum(["price", "created", "updated"])
      .optional()
      .default("created"),
    sort_order: z.enum(["asc", "desc"]).optional().default("desc"),

    // Pagination
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a positive number")
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, "Limit must be between 1 and 100")
      .optional()
      .default("20"),
    page: z
      .string()
      .regex(/^\d+$/, "Page must be a positive number")
      .transform(Number)
      .refine((n) => n > 0, "Page must be positive")
      .optional()
      .default("1"),
  }),
});

/** -------------------------
 * Orders / Checkout / Inquire
 * ------------------------- */

/**
 * Create order (from accepted offer or direct buy)
 */

export const createOrderSchema = z.object({
  body: z.object({
    listing_id: z.string().regex(objectIdRegex, "Invalid listing ID"),
    from_offer_id: z
      .string()
      .regex(objectIdRegex, "Invalid offer ID")
      .optional(),
  }),
});

export const getOrderSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid order id"),
  }),
});

export const checkoutSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid order id"),
  }),
  body: z
    .object({
      returnUrl: z.string().url().optional(),
    })
    .optional(),
});

export const getTokenizationSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid order id"),
  }),
  body: z.object({
    idempotency_id: z.string().min(1, "idempotency_id is required"),
  }),
});

/**
 * Process payment schema — supports token, card, or bank (ACH)
 * Supports full billing address for AVS verification (address_line1, city, region)
 */
export const processPaymentSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid order id"),
  }),
  body: z.object({
    // FINIX CERTIFICATION: Both idempotency_id and fraud_session_id are REQUIRED
    idempotency_id: z.string().min(1, "idempotency_id is required"),
    fraud_session_id: z
      .string()
      .min(1, "fraud_session_id is required for fraud detection"),

    // Billing address fields for AVS - OPTIONAL when using payment_token
    // The token already contains the address from Finix.js tokenization form
    postal_code: z.string().optional(),
    postalCode: z.string().optional(),
    address_line1: z.string().optional(),
    addressLine1: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    country: z.string().optional(),

    // Nested billing address
    billing_address: z
      .object({
        address_line1: z.string().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
        postal_code: z.string().optional(),
        country: z.string().optional(),
      })
      .optional(),
    billingAddress: z
      .object({
        addressLine1: z.string().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
      })
      .optional(),

    payment_token: z.string(),
  }),
  // NOTE: postal_code is NOT required when using payment_token
  // Finix tokenization forms (with showAddress: true) already collect and embed
  // the address in the token. The backend will use the address from the token
  // for AVS verification when creating the Payment Instrument.
  // See: https://finix.com/docs/guides/online-payments/payment-tokenization
});

/**
 * Admin: capture payment (internal)
 * POST
 */
export const capturePaymentSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid order id"),
  }),
  body: z
    .object({
      transactionId: z.string().min(1).optional(),
    })
    .optional(),
});

/**
 * Refund schema
 * POST /api/v1/marketplace/orders/:id/refund
 */
export const refundOrderSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid order id"),
  }),
  body: z.object({
    refund_amount: z.number().int().min(1).optional(),
    idempotency_id: z.string().min(1, "idempotency_id is required for refunds"),
  }),
});

/**
 * Inquire (create / open chatroom)
 * POST /api/v1/listings/:id/inquire
 */
export const inquireSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid listing id"),
  }),
  body: z.object({
    message: z.string().trim().min(1).max(1000),
  }),
});

/**
 * Schema for refund requests
 */
export const requestRefundSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid order id"),
  }),
  body: z.object({
    reason: z.string().trim().min(10, "Reason must be at least 10 characters"),
    refund_amount: z.number().int().positive().optional(),
    idempotency_id: z.string().optional(),
  }),
});

/**
 * Schema for uploading tracking info
 */
export const uploadTrackingSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid order id"),
  }),
  body: z.object({
    tracking_number: z.string().trim().min(1, "tracking_number is required"),
    carrier: z.string().trim().optional(),
    tracking_carrier: z.string().trim().optional(),
  }),
});

/**
 * Schema for simple order ID actions (cancel, confirm-delivery)
 */
export const orderIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid order id"),
  }),
});

/**
 * Simple schema for actions on a channel (accept offer -> create order)
 * POST /api/v1/channels/:id/accept
 */
export const channelAcceptSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid channel id"),
  }),
  body: z.object({
    offerId: z.string().regex(objectIdRegex, "Invalid offer id"),
  }),
});

/**
 * Ship order (seller marks shipped)
 * POST /api/v1/orders/:id/ship
 */
export const shipOrderSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid order id"),
  }),
  body: z
    .object({
      trackingNumber: z.string().trim().optional(),
      carrier: z.string().trim().optional(),
    })
    .optional(),
});

// ----------------------------------------------------------

// ----------------------------------------------------------

/**
 * Schema for updating user profile (bio, social_links)
 */
export const updateProfileSchema = z.object({
  body: z.object({
    bio: z
      .string()
      .max(500, "Bio must be 500 characters or less")
      .trim()
      .nullable()
      .optional(),
    social_links: z
      .object({
        instagram: z
          .string()
          .max(100, "Instagram handle too long")
          .trim()
          .nullable()
          .optional(),
        twitter: z
          .string()
          .max(100, "Twitter handle too long")
          .trim()
          .nullable()
          .optional(),
        website: z
          .string()
          .url("Invalid website URL")
          .max(200, "Website URL too long")
          .nullable()
          .optional(),
      })
      .optional(),
  }),
});

/**
 * Schema for adding item to wishlist
 */
export const addToWishlistSchema = z.object({
  body: z.object({
    listing_id: z
      .string()
      .regex(objectIdRegex, "listing_id must be a 24-char MongoDB ObjectId"),
  }),
});

/**
 * Schema for removing item from wishlist
 */
export const removeFromWishlistSchema = z.object({
  params: z.object({
    listing_id: z
      .string()
      .regex(objectIdRegex, "listing_id must be a 24-char MongoDB ObjectId"),
  }),
});

/**
 * Schema for getting user's wishlist
 */
export const getWishlistSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a positive number")
      .transform(Number)
      .refine((n) => n > 0 && n <= 50, "Limit must be between 1 and 50")
      .optional(),
    offset: z
      .string()
      .regex(/^\d+$/, "Offset must be a non-negative number")
      .transform(Number)
      .refine((n) => n >= 0, "Offset must be non-negative")
      .optional(),
  }),
});

// ----------------------------------------------------------

// ----------------------------------------------------------

/**
 * Schema for creating a review
 */
export const createReviewSchema = z.object({
  body: z.object({
    order_id: z
      .string()
      .regex(objectIdRegex, "order_id must be a 24-char MongoDB ObjectId"),
    rating: z
      .number()
      .int()
      .min(1, "Rating must be at least 1")
      .max(5, "Rating must be at most 5"),
    feedback: z
      .string()
      .min(10, "Feedback must be at least 10 characters")
      .max(1000, "Feedback must be at most 1000 characters")
      .trim(),
    is_anonymous: z.boolean().optional().default(false),
  }),
});

/**
 * Schema for getting reviews for a user
 */
export const getUserReviewsSchema = z.object({
  params: z.object({
    user_id: z
      .string()
      .regex(objectIdRegex, "user_id must be a 24-char MongoDB ObjectId"),
  }),
  query: z.object({
    role: z.enum(["buyer", "seller"]).optional(),
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a positive number")
      .transform(Number)
      .refine((n) => n > 0 && n <= 50, "Limit must be between 1 and 50")
      .optional(),
    offset: z
      .string()
      .regex(/^\d+$/, "Offset must be a non-negative number")
      .transform(Number)
      .refine((n) => n >= 0, "Offset must be non-negative")
      .optional(),
  }),
});

/**
 * Schema for getting review summary for a user
 */
export const getReviewSummarySchema = z.object({
  params: z.object({
    user_id: z
      .string()
      .regex(objectIdRegex, "user_id must be a 24-char MongoDB ObjectId"),
  }),
});

// ----------------------------------------------------------

// ----------------------------------------------------------

/**
 * Schema for sending a friend request
 */
export const sendFriendRequestSchema = z.object({
  body: z.object({
    user_id: z
      .string()
      .regex(objectIdRegex, "user_id must be a 24-char MongoDB ObjectId"),
  }),
});

/**
 * Schema for accepting/declining a friend request
 */
export const friendRequestActionSchema = z.object({
  params: z.object({
    friendship_id: z
      .string()
      .regex(objectIdRegex, "friendship_id must be a 24-char MongoDB ObjectId"),
  }),
});

/**
 * Schema for getting friends list
 */
export const getFriendsSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a positive number")
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, "Limit must be between 1 and 100")
      .optional(),
    offset: z
      .string()
      .regex(/^\d+$/, "Offset must be a non-negative number")
      .transform(Number)
      .refine((n) => n >= 0, "Offset must be non-negative")
      .optional(),
  }),
});

/**
 * Schema for getting mutual friends with another user
 */
export const getMutualFriendsSchema = z.object({
  params: z.object({
    user_id: z
      .string()
      .regex(objectIdRegex, "user_id must be a 24-char MongoDB ObjectId"),
  }),
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a positive number")
      .transform(Number)
      .refine((n) => n > 0 && n <= 50, "Limit must be between 1 and 50")
      .optional(),
    offset: z
      .string()
      .regex(/^\d+$/, "Offset must be a non-negative number")
      .transform(Number)
      .refine((n) => n >= 0, "Offset must be non-negative")
      .optional(),
  }),
});

// ----------------------------------------------------------

// ----------------------------------------------------------

const ticketCategoryValues = [
  "order_issue",
  "payment_issue",
  "account_issue",
  "listing_issue",
  "technical_bug",
  "feature_request",
  "fraud_report",
  "other",
] as const;

const ticketPriorityValues = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

const ticketStatusValues = [
  "open",
  "in_progress",
  "awaiting_user",
  "resolved",
  "closed",
] as const;

/**
 * Schema for creating a support ticket
 */
export const createSupportTicketSchema = z.object({
  body: z.object({
    subject: z
      .string()
      .min(5, "Subject must be at least 5 characters")
      .max(200, "Subject must be at most 200 characters")
      .trim(),
    category: z.enum(ticketCategoryValues),
    priority: z.enum(ticketPriorityValues).optional(),
    message: z
      .string()
      .min(10, "Message must be at least 10 characters")
      .max(5000, "Message must be at most 5000 characters")
      .trim(),
    related_order_id: z
      .string()
      .regex(objectIdRegex, "related_order_id must be a valid ObjectId")
      .optional(),
    related_listing_id: z
      .string()
      .regex(objectIdRegex, "related_listing_id must be a valid ObjectId")
      .optional(),
  }),
});

/**
 * Schema for getting a ticket by ID
 */
export const getTicketSchema = z.object({
  params: z.object({
    ticket_id: z
      .string()
      .regex(objectIdRegex, "ticket_id must be a valid ObjectId"),
  }),
});

/**
 * Schema for adding a message to a ticket
 */
export const addTicketMessageSchema = z.object({
  params: z.object({
    ticket_id: z
      .string()
      .regex(objectIdRegex, "ticket_id must be a valid ObjectId"),
  }),
  body: z.object({
    message: z
      .string()
      .min(1, "Message cannot be empty")
      .max(5000, "Message must be at most 5000 characters")
      .trim(),
    attachments: z.array(z.string().url()).max(5).optional(),
  }),
});

/**
 * Schema for updating ticket status
 */
export const updateTicketStatusSchema = z.object({
  params: z.object({
    ticket_id: z
      .string()
      .regex(objectIdRegex, "ticket_id must be a valid ObjectId"),
  }),
  body: z.object({
    status: z.enum(ticketStatusValues),
    resolution_notes: z
      .string()
      .max(2000, "Resolution notes must be at most 2000 characters")
      .optional(),
  }),
});

/**
 * Schema for getting user's tickets
 */
export const getUserTicketsSchema = z.object({
  query: z.object({
    status: z.enum(ticketStatusValues).optional(),
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a positive number")
      .transform(Number)
      .refine((n) => n > 0 && n <= 50, "Limit must be between 1 and 50")
      .optional(),
    offset: z
      .string()
      .regex(/^\d+$/, "Offset must be a non-negative number")
      .transform(Number)
      .refine((n) => n >= 0, "Offset must be non-negative")
      .optional(),
  }),
});

// ----------------------------------------------------------
// Type Exports
// ----------------------------------------------------------
export type UserClaims = z.infer<typeof UserClaimsSchema>;
export type ValidatedUserClaims = z.infer<typeof ValidatedUserClaimsSchema>;

// Onboarding Types
export type PatchAcksStepInput = z.infer<typeof patchAcksStepSchema>;
export type PatchAvatarStepInput = z.infer<typeof patchAvatarStepSchema>;
export type PatchDisplayNameStepInput = z.infer<
  typeof patchDisplayNameStepSchema
>;
export type PatchLocationStepInput = z.infer<typeof patchLocationStepSchema>;

// Watch types
export type GetWatchesInput = z.infer<typeof getWatchesSchema>;

// Listing types
export type GetListingsInput = z.infer<typeof getListingsSchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type GetUserInventoryInput = z.infer<typeof getUserInventorySchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type PublishListingInput = z.infer<typeof publishListingSchema>;

export type GetUserPublicProfileInput = z.infer<
  typeof getUserPublicProfileSchema
>;

// Offer/Channel types
export type SendOfferInput = z.infer<typeof sendOfferSchema>;
export type CounterOfferInput = z.infer<typeof counterOfferSchema>;
export type ChannelActionInput = z.infer<typeof channelActionSchema>;
export type GetUserChannelsInput = z.infer<typeof getUserChannelsSchema>;
export type GetListingChannelsInput = z.infer<typeof getListingChannelsSchema>;

// finix
export type FinixEvent = z.infer<typeof FinixEventSchema>;

// Merchant types
export type MerchantOnboardInput = z.infer<typeof MerchantOnboardSchema>;
export type MerchantRefreshLinkInput = z.infer<
  typeof merchantRefreshLinkSchema
>;
export type GetTokenizationInput = z.infer<typeof getTokenizationSchema>;

// Orders types
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type GetOrderInput = z.infer<typeof getOrderSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CapturePaymentInput = z.infer<typeof capturePaymentSchema>;
export type InquireInput = z.infer<typeof inquireSchema>;
export type ChannelAcceptInput = z.infer<typeof channelAcceptSchema>;
export type ShipOrderInput = z.infer<typeof shipOrderSchema>;
export type RefundOrderInput = z.infer<typeof refundOrderSchema>;
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
export type ReserveListingInput = z.infer<typeof reserveListingSchema>;
export type RequestRefundInput = z.infer<typeof requestRefundSchema>;
export type UploadTrackingInput = z.infer<typeof uploadTrackingSchema>;
export type OrderIdParamInput = z.infer<typeof orderIdParamSchema>;


export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type AddToWishlistInput = z.infer<typeof addToWishlistSchema>;
export type RemoveFromWishlistInput = z.infer<typeof removeFromWishlistSchema>;
export type GetWishlistInput = z.infer<typeof getWishlistSchema>;


export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type GetUserReviewsInput = z.infer<typeof getUserReviewsSchema>;
export type GetReviewSummaryInput = z.infer<typeof getReviewSummarySchema>;


export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
export type FriendRequestActionInput = z.infer<typeof friendRequestActionSchema>;
export type GetFriendsInput = z.infer<typeof getFriendsSchema>;
export type GetMutualFriendsInput = z.infer<typeof getMutualFriendsSchema>;


export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;
export type GetTicketInput = z.infer<typeof getTicketSchema>;
export type AddTicketMessageInput = z.infer<typeof addTicketMessageSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type GetUserTicketsInput = z.infer<typeof getUserTicketsSchema>;
