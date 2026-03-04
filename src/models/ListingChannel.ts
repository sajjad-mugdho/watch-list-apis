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
 * Network listing channel interface (User-to-User centric)
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
  inquiries?: IInquiry[];
  offer_history: IOffer[];
  last_offer?: IOffer | null;

  // GetStream integration mapping
  getstream_channel_id?: string | null;
  getstream_channel_type?: string;

  // Reference to canonical Order document
  order_id: Types.ObjectId | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  isOfferExpired(): boolean;
  hasActiveOffer(): boolean;
  getUserRole(userId: string | Schema.Types.ObjectId): "buyer" | "seller" | null;
}

export interface INetworkListingChannelModel extends Model<INetworkListingChannel> {}

// ----------------------------------------------------------
// Schema
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
    offer_type: { type: String, enum: OFFER_TYPE_VALUES, default: "initial", required: true },
    status: { type: String, enum: OFFER_STATUS_VALUES, default: "sent", required: true },
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
    year: { type: Number, min: 1800 },
  },
  { _id: false }
);

const networkListingChannelSchema = new Schema<INetworkListingChannel>(
  {
    listing_id: { type: Schema.Types.ObjectId, ref: "NetworkListing", required: true, index: true },
    buyer_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    seller_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: CHANNEL_STATUS_VALUES, default: "open", index: true },
    created_from: { type: String, enum: EVENT_TYPE_VALUES, required: true },
    last_event_type: { type: String, enum: EVENT_TYPE_VALUES, default: null },
    buyer_snapshot: { type: UserSnapshotSchema, required: true },
    seller_snapshot: { type: UserSnapshotSchema, required: true },
    listing_snapshot: { type: ListingSnapshotSchema, required: true },
    inquiry: { type: InquirySchema, default: null },
    inquiries: { type: [InquirySchema], default: [] },
    offer_history: { type: [OfferSchema], default: [] },
    last_offer: { type: OfferSchema, default: null },
    getstream_channel_id: { type: String, default: null, index: true },
    getstream_channel_type: { type: String, default: "messaging" },
    order_id: { type: Schema.Types.ObjectId, ref: "NetworkOrder", default: null, index: true },
  },
  { timestamps: true }
);

// Indexes
networkListingChannelSchema.index({ buyer_id: 1, seller_id: 1 }, { unique: true });

// Methods
networkListingChannelSchema.methods.isOfferExpired = function (): boolean {
  if (!this.last_offer || !this.last_offer.expiresAt) return false;
  return this.last_offer.expiresAt <= new Date();
};

networkListingChannelSchema.methods.hasActiveOffer = function (): boolean {
  return this.last_offer != null && this.last_offer.status === "sent" && !this.isOfferExpired();
};

networkListingChannelSchema.methods.getUserRole = function (userId: string | Schema.Types.ObjectId): "buyer" | "seller" | null {
  const uid = String(userId);
  if (String(this.buyer_id) === uid) return "buyer";
  if (String(this.seller_id) === uid) return "seller";
  return null;
};

export const NetworkListingChannel = mongoose.model<INetworkListingChannel, INetworkListingChannelModel>(
  "NetworkListingChannel",
  networkListingChannelSchema,
  "network_listing_channels"
);
