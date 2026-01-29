import mongoose, { Model, Schema } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------
const CONDITION_VALUES = ["new", "like-new", "good", "fair", "poor"] as const;
const CONTENTS_VALUES = ["box_papers", "box", "papers", "watch"] as const;
const STATUS_VALUES = ["draft", "active", "reserved", "sold"] as const;

// ----------------------------------------------------------
// Interfaces
// ----------------------------------------------------------

/**
 * Base listing interface - shared by both networks and marketplace
 */
export interface IListing {
  // Ownership + references
  dialist_id: Schema.Types.ObjectId;
  clerk_id: string;
  watch_id: Schema.Types.ObjectId; // Status
  status: (typeof STATUS_VALUES)[number];
  title?: string;
  subtitle?: string;

  // Watch details (embedded from Watch model)
  brand: string;
  model: string; // watch model name
  reference: string;
  diameter: string;
  bezel: string;
  materials: string;
  bracelet: string;
  color?: string;

  // Author info
  author: {
    _id: Schema.Types.ObjectId;
    name: string;
    avatar?: string;
    location?: string;
  };

  // Shipping
  ships_from: { country: string; state?: string; city?: string };
  shipping?: Array<{
    region: string;
    shippingIncluded: boolean;
    shippingCost: number;
  }>;

  // Listing details
  price: number;
  condition?: (typeof CONDITION_VALUES)[number];
  year?: number;
  contents?: (typeof CONTENTS_VALUES)[number];

  // Media
  thumbnail?: string;
  images?: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Network listing interface - includes allow_offers and order info
 */
export interface INetworkListing extends IListing {
  allow_offers?: boolean;
  order?: {
    channel_id: Schema.Types.ObjectId;
    reserved_at: Date;
    buyer_name: string;
    buyer_id: Schema.Types.ObjectId;
  } | null;

  // WTB Listing fields
  type: "for_sale" | "wtb";
  year_range?: { min?: number; max?: number } | null;
  price_range?: { min?: number; max?: number } | null;
  acceptable_conditions?: Array<(typeof CONDITION_VALUES)[number]>;
  wtb_description?: string | null;
}

/**
 * Marketplace listing interface - with offers support and watch snapshots
 */
export interface IMarketplaceListing extends IListing {
  // Watch snapshot - immutable watch data at listing creation time
  watch_snapshot: {
    brand: string;
    model: string;
    reference: string;
    diameter: string;
    bezel: string;
    materials: string;
    bracelet: string;
    color?: string;
  };

  // Offers support
  allow_offers?: boolean;

  // Order tracking
  order?: {
    channel_id: Schema.Types.ObjectId;
    reserved_at: Date;
    buyer_name: string;
    buyer_id: Schema.Types.ObjectId;
  } | null;

  // Reservation fields (for future use)
  reserved_until?: Date | null;
  reserved_by_user_id?: Schema.Types.ObjectId | null;
  reserved_by_order_id?: Schema.Types.ObjectId | null;

  // Edit trakiing for republish requremntents
  requires_republish?: boolean;
  edit_count_since_publish?: number;
}

export interface IListingsModel<T extends IListing> extends Model<T> {}

// ----------------------------------------------------------
// Schemas
// ----------------------------------------------------------

const ListingAuthorSchema = new Schema(
  {
    _id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: Schema.Types.String, required: true },
    avatar: { type: Schema.Types.String },
    location: { type: Schema.Types.String },
  },
  { _id: false }
);

const ListingShippingSchema = new Schema(
  {
    region: { type: String, enum: ["US", "CA"], required: true },
    shippingIncluded: { type: Boolean, default: false },
    shippingCost: { type: Number, default: 0 },
  },
  { _id: false }
);

const ListingOrderSchema = new Schema(
  {
    channel_id: {
      type: Schema.Types.ObjectId,
      ref: "NetworkListingChannel",
      required: true,
    },
    reserved_at: { type: Date, required: true },
    buyer_name: { type: String, required: true },
    buyer_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
);

// Base schema shared by both
const baseListingSchema = {
  // Ownership + references
  dialist_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  clerk_id: { type: Schema.Types.String, required: true, index: true },
  watch_id: {
    type: Schema.Types.ObjectId,
    ref: "Watch",
    required: true,
    index: true,
  },

  // Author
  author: { type: ListingAuthorSchema },
  // Shipping
  shipping: [ListingShippingSchema],

  ships_from: {
    country: { type: Schema.Types.String, required: true },
    state: { type: Schema.Types.String },
    city: { type: Schema.Types.String },
  },

  // Status
  status: {
    type: Schema.Types.String,
    required: true,
    index: true,
    default: "draft",
    enum: { values: STATUS_VALUES },
  },

  // Watch metadata
  title: { type: Schema.Types.String, default: null },
  brand: { type: Schema.Types.String, required: true },
  model: { type: Schema.Types.String, required: true },
  reference: { type: Schema.Types.String, required: true },
  diameter: { type: Schema.Types.String, required: true },
  bracelet: { type: Schema.Types.String, required: true },
  bezel: { type: Schema.Types.String, required: true },
  materials: { type: Schema.Types.String, required: true },
  color: { type: Schema.Types.String },

  // Listing details
  subtitle: { type: Schema.Types.String, default: null },
  price: { type: Schema.Types.Number, default: 0 },
  condition: {
    type: Schema.Types.String,
    enum: CONDITION_VALUES,
    required: false,
  },
  year: { type: Schema.Types.Number, min: 1900, max: 2025, default: null },
  contents: {
    type: Schema.Types.String,
    enum: CONTENTS_VALUES,
    required: false,
  },

  // Media
  thumbnail: { type: Schema.Types.String },
  images: [{ type: Schema.Types.String }],
};

// ----------------------------------------------------------
// Network Listing Schema (with offers support)
// ----------------------------------------------------------
const networkListingSchema = new Schema<INetworkListing>(
  {
    ...(baseListingSchema as any),
    allow_offers: { type: Schema.Types.Boolean, default: true, index: true },
    order: { type: ListingOrderSchema, default: null },

    // WTB Listing fields
    type: {
      type: String,
      enum: ["for_sale", "wtb"],
      default: "for_sale",
      required: true,
      index: true,
    },
    year_range: {
      min: { type: Number, min: 1800, max: 2030 },
      max: { type: Number, min: 1800, max: 2030 },
    },
    price_range: {
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
    },
    acceptable_conditions: [{
      type: String,
      enum: CONDITION_VALUES,
    }],
    wtb_description: {
      type: String,
      maxlength: 2000,
    },
  },
  { strict: true, timestamps: true }
);

// Transform _id to string in JSON responses
networkListingSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id.toString();
    return ret;
  },
});

// Add status transition method
networkListingSchema.methods.transitionStatus = async function (
  newStatus: string
) {
  const { transitionListingStatus } = await import(
    "../utils/listingStatusMachine"
  );
  const validStatuses = ["draft", "active", "reserved", "sold"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }
  return transitionListingStatus(this, newStatus as any);
};

// ----------------------------------------------------------
// Marketplace Listing Schema (with offers and watch snapshots)
// ----------------------------------------------------------
const WatchSnapshotSchema = new Schema(
  {
    brand: { type: String, required: true },
    model: { type: String, required: true },
    reference: { type: String, required: true },
    diameter: { type: String, required: true },
    bezel: { type: String, required: true },
    materials: { type: String, required: true },
    bracelet: { type: String, required: true },
    color: { type: String },
  },
  { _id: false }
);

const marketplaceListingSchema = new Schema<IMarketplaceListing>(
  {
    ...(baseListingSchema as any),

    // Watch snapshot - immutable watch data
    watch_snapshot: { type: WatchSnapshotSchema, required: true },

    // Offers support
    allow_offers: { type: Schema.Types.Boolean, default: true, index: true },

    // Order tracking
    order: { type: ListingOrderSchema, default: null },

    // Reservation fields
    reserved_until: { type: Date, default: null },
    reserved_by_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reserved_by_order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    // Edit tracking
    requires_republish: { type: Boolean, default: false },
    edit_count_since_publish: { type: Number, default: 0 },
  },
  { strict: true, timestamps: true }
);

// Transform _id to string in JSON responses
marketplaceListingSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id.toString();
    return ret;
  },
});

// Add status transition method
marketplaceListingSchema.methods.transitionStatus = async function (
  newStatus: string
) {
  const { transitionListingStatus } = await import(
    "../utils/listingStatusMachine"
  );
  const validStatuses = ["draft", "active", "reserved", "sold"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }
  return transitionListingStatus(this, newStatus as any);
};

// ----------------------------------------------------------
// Models - Separate collections for networks and marketplace
// ----------------------------------------------------------

export const NetworkListing = mongoose.model<
  INetworkListing,
  IListingsModel<INetworkListing>
>("NetworkListing", networkListingSchema, "network_listings");

export const MarketplaceListing = mongoose.model<
  IMarketplaceListing,
  IListingsModel<IMarketplaceListing>
>("MarketplaceListing", marketplaceListingSchema, "marketplace_listings");
