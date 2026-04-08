import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { computeInternalDisplayName } from "../utils/user";
import mongooseLeanVirtuals from "mongoose-lean-virtuals";
import {
  MerchantAccountStatus,
  MerchantVerificationStatus,
} from "../utils/finix";

function locationByGranularity(
  loc?: {
    country?: string;
    region?: string;
    city?: string;
    postal_code?: string;
  },
  mode: "country" | "country_region" | "city" | "full" = "country_region",
) {
  const country = loc?.country ?? "";
  const region = loc?.region ?? "";
  const city = loc?.city ?? "";
  switch (mode) {
    case "country":
      return country;
    case "country_region":
      return [region, country].filter(Boolean).join(", ");
    case "city":
      return [city, region].filter(Boolean).join(", ");
    case "full":
    default:
      return [city, region, country].filter(Boolean).join(", ");
  }
}

// ----------------------------------------------------------
// Interfaces
// ----------------------------------------------------------
export type UserCountry = "US" | "CA";

export interface IUserLocation {
  country?: UserCountry | null;
  region?: string | null;
  city?: string | null;
  postal_code?: string | null;
  line1?: string | null; // Street address
  line2?: string | null; // Apt/Suite number
  time_zone?: string | null;
  currency?: string | null;
}

export interface IUser extends Document {
  // Identifiers
  _id: Types.ObjectId;
  external_id?: string | null;

  // Basic info (clerk)
  first_name: string;
  last_name: string;
  location?: IUserLocation | null;

  email: string;
  phone?: string;
  avatar?: string; // defaults to internal

  display_name: string | null;
  display_name_last_changed_at?: Date | null;
  display_name_history?: Array<{ value: string; changed_at: Date }>;

  // Platform-specific display names
  networks_display_name?: string | null; // Auto-generated from first_name + last_name on Networks onboarding
  marketplace_display_name?: string | null; // Custom business name (dealers) or users' marketplace persona

  // Platform-specific avatars
  networks_avatar?: string | null; // Avatar from Networks onboarding
  marketplace_avatar?: string | null; // Avatar from Marketplace onboarding (separate from Networks)

  legal_acks?: { tos_ack: boolean; privacy_ack: boolean; rules_ack: boolean };

  // last accessed.
  marketplace_last_accessed: Date | null;
  networks_last_accessed: Date | null;

  // Persona Identity Verification
  identityVerified: boolean;
  identityVerifiedAt: Date | null;
  personaInquiryId: string | null;
  personaStatus: "pending" | "approved" | "failed" | "expired" | null;

  // Marketplace merchant account / status (Finix onboarding)
  merchant?: {
    // Finix resource IDs (for linking webhook events)
    identity_id?: string; // THE KEY - links all Finix events to user
    merchant_id?: string; // Finix Merchant ID
    verification_id?: string; // Finix Verification resource ID
    onboarding_form_id?: string; // Finix Onboarding Form ID

    // Status tracking (separate from platform onboarding!)
    onboarding_state?: MerchantAccountStatus; // PROVISIONING | APPROVED | REJECTED | UPDATE_REQUESTED
    verification_state?: MerchantVerificationStatus; // PENDING | SUCCEEDED | FAILED

    // Timestamps
    onboarded_at?: Date; // When form was completed
    verified_at?: Date; // When verification succeeded

    // Form link management (for expired links)
    last_form_link?: string;
    last_form_link_expires_at?: Date;
  };
  marketplace_profile_config: {
    location: "country" | "country_region" | "city" | "full";
    show_name: boolean;
  };
  marketplace_published: boolean;
  is_private: boolean;
  // Networks
  networks_application_id: Types.ObjectId | null;
  networks_published: boolean;
  networks_profile_config: {
    location: "country" | "country_region" | "city";
    show_name: boolean;
  };
  // Shared onboarding (Networks, generic platform)
  onboarding: {
    status: "incomplete" | "completed";
    version: string;
    steps: {
      location: {
        country: "CA" | "US" | null;
        postal_code: string | null;
        region: string | null;
        city?: string | null; // City name
        line1?: string | null; // Street address
        line2?: string | null; // Apt/Suite number
        currency?: string | null;
        updated_at: Date | null;
      };
      profile?: {
        first_name?: string | null;
        last_name?: string | null;
        confirmed?: boolean;
        updated_at?: Date | null;
      };
      business_info?: {
        // Business/Professional information
        business_name?: string | null; // Dedicated business name (separate from display_name)
        business_type?: string | null; // "INDIVIDUAL_SOLE_PROPRIETORSHIP", "LLC", "CORPORATION", etc.
        business_phone?: string | null; // Business phone (can be same as personal)
        website?: string | null; // Business website URL
        tax_id?: string | null; // Business EIN/Tax ID (encrypted at rest)
        updated_at?: Date | null;
      };
      personal_info?: {
        // Additional personal details for merchant verification
        date_of_birth?: {
          year?: number | null;
          month?: number | null;
          day?: number | null;
        } | null;
        ssn_last_4?: string | null; // Last 4 digits of SSN (encrypted at rest)
        title?: string | null; // Job title (e.g., "Owner", "CEO")
        updated_at?: Date | null;
      };
      display_name: {
        confirmed: boolean;
        value: string | null;
        user_provided: boolean;
        updated_at: Date | null;
      };
      avatar: {
        type?: "monogram" | "upload";
        monogram_initials?: string | null;
        monogram_color?: string | null;
        monogram_style?: string | null;
        confirmed?: boolean;
        url?: string | null;
        user_provided?: boolean;
        updated_at?: Date | null;
      };
      payment?: {
        payment_method?: "card" | "bank_account" | null;
        last_four?: string | null;
        status?: string | null; // pending_verification | verified | failed
        updated_at?: Date | null;
      };
      acknowledgements?: {
        tos: boolean;
        privacy: boolean;
        rules: boolean;
        updated_at: Date | null;
      };
    };
    last_step?: string | null;
    completed_at?: Date | null;
  };

  // Marketplace-specific onboarding (separate from Networks)
  marketplace_onboarding?: {
    status: "incomplete" | "completed";
    version: string;
    intent?: "buyer" | "dealer";
    steps: {
      profile: {
        first_name?: string | null;
        last_name?: string | null;
        confirmed: boolean;
        updated_at: Date | null;
      };
      location: {
        country?: "CA" | "US" | null;
        region?: string | null;
        postal_code?: string | null;
        city?: string | null;
        line1?: string | null;
        line2?: string | null;
        currency?: string | null;
        confirmed: boolean;
        updated_at: Date | null;
      };
      avatar: {
        url: string | null;
        confirmed: boolean;
        updated_at: Date | null;
      };
      acknowledgements: {
        marketplace_tos: boolean;
        updated_at: Date | null;
      };
    };
    completed_at?: Date | null;
  };

  // Profile Enhancement
  bio?: string | null;
  social_links?: {
    instagram?: string | null;
    twitter?: string | null;
    website?: string | null;
  };
  wishlist?: Types.ObjectId[];
  stats?: {
    follower_count: number;
    following_count: number;
    friend_count: number;
    avg_rating: number;
    rating_sum: number; // Internal: for atomic avg calculation
    rating_count: number;
    review_count_as_buyer: number;
    review_count_as_seller: number;
  };

  // Reputation (Batch 2)
  rating_average: number;
  rating_count: number;
  reference_count: number;

  // Status (Batch 2)
  deactivated_at: Date | null;
  is_deleted?: boolean;
  presence_status: "online" | "offline" | "away" | "busy";
  full_name: string;
  isActive: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  // Soft-delete flag exists (see schema `is_deleted`)

  // Trust & Safety: Suspension
  suspended_at?: Date | null;
  suspension_reason?: string | null;
  suspended_by?: Types.ObjectId | null;
  suspension_expires_at?: Date | null;
  adminOverride?: boolean;
  isAdmin?: boolean;

  // Virtuals
  dialist_id: any;
  userId: string;
  display_avatar?: string;
  location_country?: string;
  location_region?: string;
  onboarding_status: "incomplete" | "completed";
  marketplace_display_location?: string;
  networks_display_location?: string;
}

export interface IUserModel extends Model<IUser> {}

// ----------------------------------------------------------
// Schemas
// ----------------------------------------------------------
// General Onboarding Schemas
const OBLocationSchema = new Schema(
  {
    country: { type: String, enum: ["CA", "US"], default: null },
    region: { type: String, default: null },
    postal_code: { type: String, default: null },
    city: { type: String, default: null },
    line1: { type: String, default: null }, // Street address
    line2: { type: String, default: null }, // Apt/Suite number
    currency: { type: String, trim: true, default: null },
    updated_at: { type: Date, default: null },
  },
  { _id: false },
);
const OBProfileSchema = new Schema(
  {
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    confirmed: { type: Boolean, default: false },
    updated_at: { type: Date, default: null },
  },
  { _id: false },
);
const OBDisplayNameSchema = new Schema(
  {
    value: { type: String, default: null }, // only if user_provided === true
    user_provided: { type: Boolean, default: false },
    confirmed: { type: Boolean, default: false },
    updated_at: { type: Date },
  },
  { _id: false },
);
const OBAvatarSchema = new Schema(
  {
    // Type of avatar: 'monogram' or 'upload'
    type: { type: String, enum: ["monogram", "upload"], default: undefined },
    // Monogram fields (type: 'monogram')
    monogram_initials: { type: String, default: null },
    monogram_color: { type: String, default: null },
    monogram_style: { type: String, default: null },
    // Upload fields (type: 'upload')
    url: { type: String, default: null },
    user_provided: { type: Boolean, default: false },
    confirmed: { type: Boolean, default: false },
    updated_at: { type: Date },
  },
  { _id: false },
);
const OBAcksSchema = new Schema(
  {
    tos: { type: Boolean, default: false },
    privacy: { type: Boolean, default: false },
    rules: { type: Boolean, default: false },
    updated_at: { type: Date },
  },
  { _id: false },
);

// Payment Information Schema
const OBPaymentSchema = new Schema(
  {
    payment_method: {
      type: String,
      enum: ["card", "bank_account"],
      default: null,
    },
    // Card fields
    last_four: { type: String, default: null }, // Last 4 digits for display
    // Payment status
    status: {
      type: String,
      enum: ["pending_verification", "verified", "failed"],
      default: null,
    }, // pending_verification, verified, failed
    updated_at: { type: Date },
  },
  { _id: false },
);

// Business Information Schema
const OBBusinessInfoSchema = new Schema(
  {
    business_name: { type: String, default: null },
    business_type: { type: String, default: null }, // "INDIVIDUAL_SOLE_PROPRIETORSHIP", "LLC", "CORPORATION", etc.
    business_phone: { type: String, default: null },
    website: { type: String, default: null },
    tax_id: { type: String, default: null, select: false }, // Encrypted, sensitive
    updated_at: { type: Date, default: null },
  },
  { _id: false },
);

// Personal Information Schema (for merchant verification)
const OBPersonalInfoSchema = new Schema(
  {
    date_of_birth: {
      year: { type: Number, default: null },
      month: { type: Number, default: null },
      day: { type: Number, default: null },
    },
    ssn_last_4: { type: String, default: null, select: false }, // Encrypted, sensitive
    title: { type: String, default: null }, // Job title (e.g., "Owner", "CEO")
    updated_at: { type: Date, default: null },
  },
  { _id: false },
);

const OnboardingSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["incomplete", "completed"],
      default: "incomplete",
      index: true,
    },
    version: { type: String, default: "v1" },
    steps: {
      location: { type: OBLocationSchema, default: {} },
      profile: { type: OBProfileSchema, default: {} },
      business_info: { type: OBBusinessInfoSchema, default: {} },
      personal_info: { type: OBPersonalInfoSchema, default: {} },
      display_name: { type: OBDisplayNameSchema, default: {} },
      avatar: { type: OBAvatarSchema, default: undefined },
      payment: { type: OBPaymentSchema, default: undefined },
      acknowledgements: { type: OBAcksSchema, default: {} },
    },
    last_step: { type: String, default: null },
    completed_at: { type: Date, default: null },
  },
  { _id: false },
);

// Marketplace Onboarding Schemas (separate from Networks)
const MPOnboardingProfileSchema = new Schema(
  {
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    confirmed: { type: Boolean, default: false },
    updated_at: { type: Date, default: null },
  },
  { _id: false },
);

const MPOnboardingLocationSchema = new Schema(
  {
    country: { type: String, enum: ["CA", "US"], default: null },
    region: { type: String, default: null },
    postal_code: { type: String, default: null },
    city: { type: String, default: null },
    line1: { type: String, default: null },
    line2: { type: String, default: null },
    currency: { type: String, trim: true, default: null },
    confirmed: { type: Boolean, default: false },
    updated_at: { type: Date, default: null },
  },
  { _id: false },
);

const MPOnboardingAvatarSchema = new Schema(
  {
    url: { type: String, default: null },
    confirmed: { type: Boolean, default: false },
    updated_at: { type: Date, default: null },
  },
  { _id: false },
);

const MPOnboardingAcksSchema = new Schema(
  {
    marketplace_tos: { type: Boolean, default: false },
    updated_at: { type: Date, default: null },
  },
  { _id: false },
);

const MarketplaceOnboardingSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["incomplete", "completed"],
      default: "incomplete",
      index: true,
    },
    version: { type: String, default: "v1" },
    intent: { type: String, enum: ["buyer", "dealer"], default: "buyer" },
    steps: {
      profile: { type: MPOnboardingProfileSchema, default: {} },
      location: { type: MPOnboardingLocationSchema, default: {} },
      avatar: { type: MPOnboardingAvatarSchema, default: {} },
      acknowledgements: { type: MPOnboardingAcksSchema, default: {} },
    },
    completed_at: { type: Date, default: null },
  },
  { _id: false },
);

export const UserLocationSchema = new Schema<IUserLocation>(
  {
    country: { type: String, enum: ["CA", "US"], required: false, trim: true },
    region: { type: String, required: false, trim: true },
    city: { type: String, required: false, trim: true },
    postal_code: { type: String, required: false, trim: true },
    line1: { type: String, required: false, trim: true },
    line2: { type: String, required: false, trim: true },
    time_zone: { type: String, required: false, trim: true },
    currency: { type: String, required: false, trim: true },
  },
  { _id: false, timestamps: true },
);

const userSchema = new Schema<IUser>(
  {
    // Identifiers
    external_id: { type: Schema.Types.String, index: true, select: false },
    email: {
      type: Schema.Types.String,
      unique: true,
      required: true,
      select: false,
    },

    // Basic info
    first_name: { type: Schema.Types.String, select: false, default: null },
    last_name: { type: Schema.Types.String, select: false, default: null },
    location: { type: UserLocationSchema, select: false },

    avatar: {
      type: String,
      default: "https://images.dialist.com/images/example-uuid-avatar/w=80",
      trim: true,
    },
    // Soft-delete flag used by tests / search filters
    is_deleted: { type: Boolean, default: false, index: true },

    display_name: { type: String, default: null, trim: true },
    display_name_last_changed_at: { type: Date, default: null },
    display_name_history: [
      { value: String, changed_at: { type: Date, default: Date.now } },
    ],

    // Platform-specific display names
    networks_display_name: { type: String, default: null, trim: true }, // Auto-generated from first + last
    marketplace_display_name: { type: String, default: null, trim: true }, // Custom business name

    // Platform-specific avatars
    networks_avatar: { type: String, default: null, trim: true }, // Networks avatar URL
    marketplace_avatar: { type: String, default: null, trim: true }, // Marketplace avatar URL

    networks_published: { type: Boolean, default: false },
    marketplace_published: { type: Boolean, default: false },
    is_private: { type: Boolean, default: false },

    marketplace_last_accessed: { type: Date },
    networks_last_accessed: { type: Date },
    networks_application_id: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    }, // todo ref NetworksApplication

    networks_profile_config: {
      location: {
        type: String,
        enum: ["country", "country_region", "city"],
        default: "country_region",
      },
    },
    marketplace_profile_config: {
      location: {
        type: String,
        enum: ["country", "country_region", "city", "full"],
        default: "country_region",
      },
    },

    // Persona Identity Verification
    identityVerified: {
      type: Boolean,
      default: false,
    },
    identityVerifiedAt: {
      type: Date,
      default: null,
    },
    personaInquiryId: {
      type: String,
      default: null,
    },
    personaStatus: {
      type: String,
      enum: ["pending", "approved", "failed", "expired", null],
      default: null,
    },

    // ❌ REMOVED: merchant field - now using MerchantOnboarding collection as single source of truth
    // See: src/models/MerchantOnboarding.ts for merchant onboarding data
    // Query: await MerchantOnboarding.findOne({ dialist_user_id: user._id })

    // general onboarding. All users
    onboarding: { type: OnboardingSchema, default: {} },

    // marketplace-specific onboarding (separate from Networks)
    marketplace_onboarding: { type: MarketplaceOnboardingSchema, default: {} },

    // legal
    legal_acks: {
      tos_ack: { type: Boolean, default: false },
      privacy_ack: { type: Boolean, default: false },
      rules_ack: { type: Boolean, default: false },
    },

    // ===== Profile Enhancement =====
    // User bio for profile display
    bio: {
      type: String,
      maxlength: 500,
      default: null,
      trim: true,
    },

    // Social media links
    social_links: {
      instagram: { type: String, default: null, trim: true },
      twitter: { type: String, default: null, trim: true },
      website: { type: String, default: null, trim: true },
    },

    // Wishlist of listings user wants to track
    wishlist: [
      {
        type: Schema.Types.ObjectId,
        ref: "NetworkListing",
      },
    ],

    // Cached stats (denormalized for performance)
    // Updated via ReviewService and FriendshipService
    stats: {
      follower_count: { type: Number, default: 0 },
      following_count: { type: Number, default: 0 },
      friend_count: { type: Number, default: 0 },
      avg_rating: { type: Number, default: 0 },
      rating_sum: { type: Number, default: 0 }, // Internal: for atomic avg calculation
      rating_count: { type: Number, default: 0 },
      review_count_as_buyer: { type: Number, default: 0 },
      review_count_as_seller: { type: Number, default: 0 },
    },

    // Status (Batch 2)
    deactivated_at: { type: Date, default: null },
    presence_status: {
      type: String,
      enum: ["online", "offline", "away", "busy"],
      default: "offline",
    },

    // ===== Trust & Safety: Suspension Fields =====
    suspended_at: { type: Date, default: null },
    suspension_reason: { type: String, default: null, trim: true },
    suspended_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    suspension_expires_at: { type: Date, default: null },
    isAdmin: { type: Boolean, default: false },
  },
  {
    strict: false, // per request
    timestamps: true,
  },
);

// Text index for unified user search (display_name, bio, email)
userSchema.index({ display_name: "text", bio: "text", email: "text" });

// Transform _id to string in JSON responses
userSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    return ret;
  },
});
userSchema.set("toObject", { virtuals: true });

// --- virtuals ---
userSchema.virtual("dialist_id").get(function (this: any) {
  return this._id;
});

userSchema.virtual("userId").get(function (this: any) {
  return this.external_id;
});

userSchema.virtual("display_avatar").get(function (this: any) {
  return this.avatar;
});

userSchema.virtual("location_country").get(function (this: any) {
  return this.location?.country;
});

userSchema.virtual("location_region").get(function (this: any) {
  return this.location?.region;
});

userSchema.virtual("onboarding_status").get(function (this: any) {
  return this.onboarding?.status;
});

userSchema.virtual("marketplace_display_location").get(function (this: any) {
  const mode = this.marketplace_profile_config?.location ?? "country_region";
  return locationByGranularity(this.location, mode) || "Unknown";
});

// compute display location based on users desired config
userSchema.virtual("networks_display_location").get(function (this: any) {
  const mode = this.networks_profile_config?.location ?? "country_region";
  return locationByGranularity(this.location, mode) || "Unknown";
});

userSchema.virtual("full_name").get(function (this: any) {
  return [this.first_name, this.last_name].filter(Boolean).join(" ");
});

userSchema.virtual("isActive").get(function (this: any) {
  return !this.deactivated_at && !this.suspended_at;
});

// ❌ REMOVED: isMerchant virtual - now query MerchantOnboarding collection directly
// Old implementation relied on user.merchant field which is being deprecated
// New approach: await MerchantOnboarding.findOne({ dialist_user_id, onboarding_state: "APPROVED" })

/** Guard: prevent writing onboarding once completed (except by admin paths). */

/** Default: Auto set display_name based on first_name and last_name */

userSchema.pre("save", function (next) {
  const u = this as any;
  // --- 1) Auto-set initial display_name for new docs ---
  if (u.isNew) {
    const cur = u.display_name;
    if (!cur || !String(cur).trim()) {
      u.display_name = computeInternalDisplayName(u);
      u.display_name_last_changed_at = null; // no history for initial default
    }
  }
  // --- 2) Onboarding guard (allow transition to "completed", block later edits) ---
  if (u.isModified("onboarding") && !u.adminOverride) {
    const statusNow = u.get("onboarding.status");
    const statusChangedToCompleted =
      u.isModified("onboarding.status") && statusNow === "completed";

    if (!statusChangedToCompleted && statusNow === "completed") {
      return next(new Error("Onboarding is completed and cannot be modified"));
    }
  }

  next();
});

userSchema.plugin(mongooseLeanVirtuals);

// ----------------------------------------------------------
// Model
// ----------------------------------------------------------

export const User = mongoose.model<IUser, IUserModel>(
  "User",
  userSchema,
  "users",
);
