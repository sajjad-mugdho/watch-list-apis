import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------
const OFFER_TYPE_VALUES = ["initial", "counter"] as const;
const OFFER_STATUS_VALUES = [
  "sent",
  "accepted",
  "declined",
  "superseded",
  "expired",
] as const;
const CHANNEL_STATUS_VALUES = ["open", "closed"] as const;
const EVENT_TYPE_VALUES = ["inquiry", "offer", "order"] as const;
const ORDER_STATUS_VALUES = [
  "pending",
  "paid",
  "shipped",
  "completed",
  "cancelled",
] as const;

// ----------------------------------------------------------
// Interfaces
// ----------------------------------------------------------
export interface IInquiry {
  sender_id: Schema.Types.ObjectId;
  message: string;
  createdAt: Date;
}

export interface IOffer {
  _id?: Types.ObjectId;
  sender_id: Types.ObjectId;
  amount: number;
  message?: string | null;
  offer_type: (typeof OFFER_TYPE_VALUES)[number];
  status: (typeof OFFER_STATUS_VALUES)[number];
  expiresAt?: Date;
  createdAt: Date;
}

export interface IOrder {
  from_offer_id: Types.ObjectId;
  amount: number;
  buyer_id: Schema.Types.ObjectId;
  seller_id: Schema.Types.ObjectId;
  status: (typeof ORDER_STATUS_VALUES)[number];
  createdAt: Date;
}

export interface IUserSnapshot {
  _id: Schema.Types.ObjectId;
  name: string;
  avatar?: string;
}

export interface IListingSnapshot {
  brand: string;
  model: string;
  reference: string;
  price?: number;
  condition?: string;
  contents?: string;
  thumbnail?: string;
  year?: number;
}

/**
 * Networks-only listing channel interface
 */
export interface INetworkListingChannel extends Document {
  // Refs
  listing_id: Schema.Types.ObjectId;
  buyer_id: Schema.Types.ObjectId;
  seller_id: Schema.Types.ObjectId;

  // Channel meta
  status: (typeof CHANNEL_STATUS_VALUES)[number];
  created_from: (typeof EVENT_TYPE_VALUES)[number];
  last_event_type?: (typeof EVENT_TYPE_VALUES)[number] | null;

  // Snapshots
  buyer_snapshot: IUserSnapshot;
  seller_snapshot: IUserSnapshot;
  listing_snapshot: IListingSnapshot;

  // Conversation + commerce
  inquiry?: IInquiry | null;
  inquiries?: IInquiry[];  // NEW: Array of inquiries for multiple inquiry support
  offer_history: IOffer[];
  last_offer?: IOffer | null;

  // GetStream integration mapping
  getstream_channel_id?: string | null;
  getstream_channel_type?: string;

  // Reference to canonical Order document (single source of truth)
  order_id: Types.ObjectId | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  isOfferExpired(): boolean;
  hasActiveOffer(): boolean;
  getUserRole(
    userId: string | Schema.Types.ObjectId
  ): "buyer" | "seller" | null;
  supersedeLastOffer(): void;
  resolveLastOffer(status: "accepted" | "declined"): Promise<void>;
}

export interface INetworkListingChannelModel
  extends Model<INetworkListingChannel> {
  findByListingAndBuyer(
    listingId: string,
    buyerId: string
  ): Promise<INetworkListingChannel | null>;

  findByUserId(
    userId: string,
    role?: "buyer" | "seller"
  ): Promise<INetworkListingChannel[]>;

  findActiveOffersForSeller(
    sellerId: string
  ): Promise<INetworkListingChannel[]>;
}

// ----------------------------------------------------------
// Sub-schemas
// ----------------------------------------------------------
const InquirySchema = new Schema<IInquiry>(
  {
    sender_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const OfferSchema = new Schema<IOffer>(
  {
    sender_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    message: { type: String, default: null, trim: true },
    offer_type: {
      type: String,
      enum: OFFER_TYPE_VALUES,
      default: "initial",
      required: true,
    },
    status: {
      type: String,
      enum: OFFER_STATUS_VALUES,
      default: "sent",
      required: true,
    },
    expiresAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const UserSnapshotSchema = new Schema<IUserSnapshot>(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    avatar: { type: String, trim: true },
  },
  { _id: false }
);

const ListingSnapshotSchema = new Schema<IListingSnapshot>(
  {
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    reference: { type: String, required: true, trim: true },
    price: { type: Number, min: 0 },
    condition: { type: String, trim: true },
    contents: { type: String, trim: true },
    thumbnail: { type: String, trim: true },
    year: { type: Number, min: 1800, max: new Date().getFullYear() + 1 },
  },
  { _id: false }
);

// ----------------------------------------------------------
// Network Listing Channel Schema
// ----------------------------------------------------------
const networkListingChannelSchema = new Schema<INetworkListingChannel>(
  {
    listing_id: {
      type: Schema.Types.ObjectId,
      ref: "NetworkListing",
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

    status: {
      type: String,
      enum: CHANNEL_STATUS_VALUES,
      default: "open",
      index: true,
    },
    created_from: { type: String, enum: EVENT_TYPE_VALUES, required: true },
    last_event_type: { type: String, enum: EVENT_TYPE_VALUES, default: null },

    buyer_snapshot: { type: UserSnapshotSchema, required: true },
    seller_snapshot: { type: UserSnapshotSchema, required: true },
    listing_snapshot: { type: ListingSnapshotSchema, required: true },

    inquiry: { type: InquirySchema, default: null },
    inquiries: { type: [InquirySchema], default: [] },  // NEW: Multiple inquiries

    offer_history: { type: [OfferSchema], default: [] },
    last_offer: { type: OfferSchema, default: null },

    // GetStream mapping — will store chat channel id once chat is created
    getstream_channel_id: {
      type: String,
      default: null,
      index: true,
      maxlength: 128,
    },
    getstream_channel_type: { type: String, default: "messaging" },

    // Reference to canonical Order document (single source of truth)
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
networkListingChannelSchema.index(
  { buyer_id: 1, seller_id: 1 },
  { unique: true }
);
networkListingChannelSchema.index({ "last_offer.status": 1 });
networkListingChannelSchema.index({ buyer_id: 1, updatedAt: -1 });
networkListingChannelSchema.index({ seller_id: 1, updatedAt: -1 });

// Instance methods
networkListingChannelSchema.methods.isOfferExpired = function (): boolean {
  if (!this.last_offer || !this.last_offer.expiresAt) return false;
  return this.last_offer.expiresAt <= new Date();
};

networkListingChannelSchema.methods.hasActiveOffer = function (): boolean {
  return (
    this.last_offer != null &&
    this.last_offer.status === "sent" &&
    !this.isOfferExpired()
  );
};

networkListingChannelSchema.methods.getUserRole = function (
  userId: string | Schema.Types.ObjectId
): "buyer" | "seller" | null {
  const uid = String(userId);
  if (String(this.buyer_id) === uid) return "buyer";
  if (String(this.seller_id) === uid) return "seller";
  return null;
};

networkListingChannelSchema.methods.supersedeLastOffer = function (): void {
  if (!this.last_offer) return;
  const superseded = {
    ...(this.last_offer.toObject?.() ?? this.last_offer),
    status: "superseded" as const,
  };
  this.offer_history.push(superseded);
  this.last_offer = null;
};

networkListingChannelSchema.methods.resolveLastOffer = async function (
  status: "accepted" | "declined"
): Promise<void> {
  if (!this.last_offer) throw new Error("No active offer to resolve");
  const resolved = {
    ...(this.last_offer.toObject?.() ?? this.last_offer),
    status,
  };
  this.offer_history.push(resolved);
  this.last_offer = null;
  this.last_event_type = "offer";
  await this.save();
};

// Static methods
networkListingChannelSchema.statics.findByListingAndBuyer = function (
  listingId: string | Schema.Types.ObjectId,
  buyerId: string | Schema.Types.ObjectId
) {
  return this.findOne({ listing_id: listingId, buyer_id: buyerId });
};

networkListingChannelSchema.statics.findByUserId = function (
  userId: string | Schema.Types.ObjectId,
  role?: "buyer" | "seller"
) {
  if (role === "buyer")
    return this.find({ buyer_id: userId }).sort({ updatedAt: -1 });
  if (role === "seller")
    return this.find({ seller_id: userId }).sort({ updatedAt: -1 });
  return this.find({
    $or: [{ buyer_id: userId }, { seller_id: userId }],
  }).sort({ updatedAt: -1 });
};

networkListingChannelSchema.statics.findActiveOffersForSeller = function (
  sellerId: string | Schema.Types.ObjectId
) {
  return this.find({
    seller_id: sellerId,
    status: "open",
    "last_offer.status": "sent",
    $or: [
      { "last_offer.expiresAt": { $exists: false } },
      { "last_offer.expiresAt": { $gt: new Date() } },
    ],
  }).sort({ updatedAt: -1 });
};

// ----------------------------------------------------------
// Model - Networks only
// ----------------------------------------------------------
export const NetworkListingChannel = mongoose.model<
  INetworkListingChannel,
  INetworkListingChannelModel
>(
  "NetworkListingChannel",
  networkListingChannelSchema,
  "network_listing_channels"
);
