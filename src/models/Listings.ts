import mongoose, { Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Common Interfaces & Constants
// ----------------------------------------------------------
export const LISTING_STATUS_VALUES = ["draft", "active", "reserved", "sold"] as const;
export type ListingStatus = (typeof LISTING_STATUS_VALUES)[number];

export interface IListingAuthorSnapshot {
  _id: Types.ObjectId;
  name: string;
  avatar?: string;
  location?: any;
}

// ----------------------------------------------------------
// Marketplace Listing
// ----------------------------------------------------------
export interface IMarketplaceListing {
  _id: Types.ObjectId;
  dialist_id: Types.ObjectId;
  clerk_id: string;
  status: ListingStatus;
  is_deleted?: boolean;
  
  // Watch details
  title: string;
  brand: string;
  model: string;
  reference: string;
  thumbnail?: string;
  images: string[];
  price?: number;
  condition?: string;
  year?: number;
  contents?: string;
  
  // Marketplace specific
  stock_count: number;
  allow_offers: boolean;

  reserved_by_user_id?: Types.ObjectId;
  reserved_until?: Date;
  order?: {
    channel_id: Types.ObjectId;
    buyer_id: Types.ObjectId;
    buyer_name: string;
    reserved_at: Date;
  };
  
  // Author snapshot
  author: IListingAuthorSnapshot;
  
  createdAt: Date;
  updatedAt: Date;

  toJSON?(): Record<string, any>;
  toObject?(): Record<string, any>;
}

const marketplaceListingSchema = new Schema<IMarketplaceListing>(
  {
    dialist_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clerk_id: { type: String, required: true, index: true },
    status: { type: String, enum: LISTING_STATUS_VALUES, default: "draft", index: true },
    is_deleted: { type: Boolean, default: false },
    title: { type: String, required: true },
    brand: { type: String, required: true, index: true },
    model: { type: String, required: true },
    reference: { type: String, required: true, index: true },
    thumbnail: { type: String },
    images: { type: [String], default: [] },
    price: { type: Number, min: 0 },
    condition: { type: String },
    year: { type: Number },
    contents: { type: String },
    stock_count: { type: Number, default: 1 },
    allow_offers: { type: Boolean, default: true },
    reserved_by_user_id: { type: Schema.Types.ObjectId, ref: "User" },
    reserved_until: { type: Date },
    order: {
      channel_id: { type: Schema.Types.ObjectId },
      buyer_id: { type: Schema.Types.ObjectId },
      buyer_name: { type: String },
      reserved_at: { type: Date },
    },
    author: {
      _id: { type: Schema.Types.ObjectId, ref: "User", required: true },
      name: { type: String, required: true },
      avatar: { type: String },
      location: { type: Schema.Types.Mixed },
    },
  },
  { timestamps: true }
);

export const MarketplaceListing = mongoose.model<IMarketplaceListing>(
  "MarketplaceListing",
  marketplaceListingSchema,
  "marketplace_listings"
);

// ----------------------------------------------------------
// Network Listing
// ----------------------------------------------------------
export interface INetworkListing {
  _id: Types.ObjectId;
  dialist_id: Types.ObjectId;
  clerk_id: string;
  status: ListingStatus;
  is_deleted?: boolean;
  
  // Watch details
  title: string;
  brand: string;
  model: string;
  reference: string;
  thumbnail?: string;
  images: string[];
  price?: number;
  condition?: string;
  year?: number;
  contents?: string;
  
  // Networks specific
  allow_offers: boolean;
  reservation_terms?: string;

  reserved_by_user_id?: Types.ObjectId;
  reserved_until?: Date;
  order?: {
    channel_id: Types.ObjectId;
    buyer_id: Types.ObjectId;
    buyer_name: string;
    reserved_at: Date;
  };
  
  // Author snapshot
  author: IListingAuthorSnapshot;
  
  // Location
  ships_from: {
    country: string;
  };
  shipping?: {
    region: string;
    shippingIncluded: boolean;
    shippingCost: number;
  }[];

  createdAt: Date;
  updatedAt: Date;

  toJSON?(): Record<string, any>;
  toObject?(): Record<string, any>;
}

const networkListingSchema = new Schema<INetworkListing>(
  {
    dialist_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clerk_id: { type: String, required: true, index: true },
    status: { type: String, enum: LISTING_STATUS_VALUES, default: "draft", index: true },
    is_deleted: { type: Boolean, default: false },
    title: { type: String, required: true },
    brand: { type: String, required: true, index: true },
    model: { type: String, required: true },
    reference: { type: String, required: true, index: true },
    thumbnail: { type: String },
    images: { type: [String], default: [] },
    price: { type: Number, min: 0 },
    condition: { type: String },
    year: { type: Number },
    contents: { type: String },
    allow_offers: { type: Boolean, default: true },
    reservation_terms: { type: String },
    reserved_by_user_id: { type: Schema.Types.ObjectId, ref: "User" },
    reserved_until: { type: Date },
    order: {
      channel_id: { type: Schema.Types.ObjectId },
      buyer_id: { type: Schema.Types.ObjectId },
      buyer_name: { type: String },
      reserved_at: { type: Date },
    },
    author: {
      _id: { type: Schema.Types.ObjectId, ref: "User", required: true },
      name: { type: String, required: true },
      avatar: { type: String },
      location: { type: Schema.Types.Mixed },
    },
    ships_from: {
      country: { type: String, required: true },
    },
  },
  { timestamps: true }
);

export const NetworkListing = mongoose.model<INetworkListing>(
  "NetworkListing",
  networkListingSchema,
  "network_listings"
);
