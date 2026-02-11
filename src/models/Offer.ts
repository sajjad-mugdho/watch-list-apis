// src/models/Offer.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Constants & Types
// ----------------------------------------------------------
export const OFFER_STATE_VALUES = [
  "CREATED",
  "COUNTERED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
] as const;

export type OfferState = (typeof OFFER_STATE_VALUES)[number];

export const PLATFORM_VALUES = ["marketplace", "networks"] as const;
export type Platform = (typeof PLATFORM_VALUES)[number];

// ----------------------------------------------------------
// Interfaces
// ----------------------------------------------------------
export interface IListingSnapshot {
  brand: string;
  model: string;
  reference: string;
  price: number;
  condition?: string;
  thumbnail?: string;
}

export interface IOffer extends Document {
  _id: Types.ObjectId;

  // References
  listing_id: Types.ObjectId;
  channel_id: Types.ObjectId; // MarketplaceListingChannel or NetworkListingChannel
  buyer_id: Types.ObjectId;
  seller_id: Types.ObjectId;

  // Platform
  platform: Platform;

  // GetStream integration
  getstream_channel_id: string;

  // State
  state: OfferState;
  active_revision_id: Types.ObjectId | null;

  // Expiry
  expires_at: Date;

  // Denormalized snapshot
  listing_snapshot: IListingSnapshot;

  // Optimistic concurrency
  version: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  isExpired(): boolean;
  isActive(): boolean;
  canBeAccepted(): boolean;
}

export interface IOfferModel extends Model<IOffer> {
  findActiveByListingAndBuyer(
    listingId: string | Types.ObjectId,
    buyerId: string | Types.ObjectId
  ): Promise<IOffer | null>;

  findByChannel(channelId: string | Types.ObjectId): Promise<IOffer[]>;

  findActiveForSeller(sellerId: string | Types.ObjectId): Promise<IOffer[]>;

  findExpiredOffers(): Promise<IOffer[]>;
}

// ----------------------------------------------------------
// Sub-schemas
// ----------------------------------------------------------
const ListingSnapshotSchema = new Schema<IListingSnapshot>(
  {
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    reference: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    condition: { type: String, trim: true },
    thumbnail: { type: String, trim: true },
  },
  { _id: false }
);

// ----------------------------------------------------------
// Offer Schema
// ----------------------------------------------------------
const OfferSchema = new Schema<IOffer>(
  {
    listing_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    channel_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    buyer_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    seller_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    platform: {
      type: String,
      enum: PLATFORM_VALUES,
      required: true,
      default: "marketplace",
    },

    getstream_channel_id: {
      type: String,
      required: true,
      index: true,
    },

    state: {
      type: String,
      enum: OFFER_STATE_VALUES,
      default: "CREATED",
      required: true,
      index: true,
    },

    active_revision_id: {
      type: Schema.Types.ObjectId,
      ref: "OfferRevision",
      default: null,
    },

    expires_at: {
      type: Date,
      required: true,
      index: true,
    },

    listing_snapshot: {
      type: ListingSnapshotSchema,
      required: true,
    },

    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// ----------------------------------------------------------
// Indexes
// ----------------------------------------------------------

// Unique partial index: only one active offer per (listing, buyer, seller)
OfferSchema.index(
  { listing_id: 1, buyer_id: 1, seller_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      state: { $in: ["CREATED", "COUNTERED"] },
    },
    name: "unique_active_offer",
  }
);

// For expiry job
OfferSchema.index({ expires_at: 1, state: 1 });

// For user queries
OfferSchema.index({ buyer_id: 1, createdAt: -1 });
OfferSchema.index({ seller_id: 1, createdAt: -1 });

// ----------------------------------------------------------
// Instance Methods
// ----------------------------------------------------------
OfferSchema.methods.isExpired = function (): boolean {
  return new Date() > this.expires_at;
};

OfferSchema.methods.isActive = function (): boolean {
  return (
    (this.state === "CREATED" || this.state === "COUNTERED") &&
    !this.isExpired()
  );
};

OfferSchema.methods.canBeAccepted = function (): boolean {
  return this.isActive();
};

// ----------------------------------------------------------
// Pre-save Hook: Optimistic Concurrency
// ----------------------------------------------------------
OfferSchema.pre("save", function (next) {
  if (!this.isNew && this.isModified()) {
    this.version = (this.version || 1) + 1;
  }
  next();
});

// ----------------------------------------------------------
// Static Methods
// ----------------------------------------------------------
OfferSchema.statics.findActiveByListingAndBuyer = function (
  listingId: string | Types.ObjectId,
  buyerId: string | Types.ObjectId
) {
  return this.findOne({
    listing_id: listingId,
    buyer_id: buyerId,
    state: { $in: ["CREATED", "COUNTERED"] },
    expires_at: { $gt: new Date() },
  });
};

OfferSchema.statics.findByChannel = function (
  channelId: string | Types.ObjectId
) {
  return this.find({ channel_id: channelId }).sort({ createdAt: -1 });
};

OfferSchema.statics.findActiveForSeller = function (
  sellerId: string | Types.ObjectId
) {
  return this.find({
    seller_id: sellerId,
    state: { $in: ["CREATED", "COUNTERED"] },
    expires_at: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

OfferSchema.statics.findExpiredOffers = function () {
  return this.find({
    state: { $in: ["CREATED", "COUNTERED"] },
    expires_at: { $lte: new Date() },
  });
};

// ----------------------------------------------------------
// Model
// ----------------------------------------------------------
export const Offer = mongoose.model<IOffer, IOfferModel>(
  "Offer",
  OfferSchema,
  "offers"
);

export default Offer;
