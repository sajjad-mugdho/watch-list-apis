import mongoose, { Document, Model, Schema, Types } from "mongoose";

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
export interface IMarketplaceListing extends Document {
  dialist_id: Types.ObjectId;
  clerk_id: string;
  status: ListingStatus;
  
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
  
  // Marketplace specific
  stock_count: number;
  allow_offers: boolean;
  
  // Author snapshot
  author: IListingAuthorSnapshot;
  
  createdAt: Date;
  updatedAt: Date;
}

const marketplaceListingSchema = new Schema<IMarketplaceListing>(
  {
    dialist_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clerk_id: { type: String, required: true, index: true },
    status: { type: String, enum: LISTING_STATUS_VALUES, default: "draft", index: true },
    title: { type: String, required: true },
    brand: { type: String, required: true, index: true },
    model: { type: String, required: true },
    reference: { type: String, required: true, index: true },
    thumbnail: { type: String },
    images: { type: [String], default: [] },
    price: { type: Number, min: 0 },
    condition: { type: String },
    year: { type: Number },
    stock_count: { type: Number, default: 1 },
    allow_offers: { type: Boolean, default: true },
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
export interface INetworkListing extends Document {
  dialist_id: Types.ObjectId;
  clerk_id: string;
  status: ListingStatus;
  
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
  
  // Networks specific
  allow_offers: boolean;
  
  // Author snapshot
  author: IListingAuthorSnapshot;
  
  // Location
  ships_from: {
    country: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const networkListingSchema = new Schema<INetworkListing>(
  {
    dialist_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clerk_id: { type: String, required: true, index: true },
    status: { type: String, enum: LISTING_STATUS_VALUES, default: "draft", index: true },
    title: { type: String, required: true },
    brand: { type: String, required: true, index: true },
    model: { type: String, required: true },
    reference: { type: String, required: true, index: true },
    thumbnail: { type: String },
    images: { type: [String], default: [] },
    price: { type: Number, min: 0 },
    condition: { type: String },
    year: { type: Number },
    allow_offers: { type: Boolean, default: true },
    author: {
      _id: { type: Schema.Types.ObjectId, ref: "User", required: true },
      name: { type: String, required: true },
      avatar: { type: String },
      location: { type: Schema.Types.Mixed },
    },
    ships_from: {
      country: { type: String },
    },
  },
  { timestamps: true }
);

export const NetworkListing = mongoose.model<INetworkListing>(
  "NetworkListing",
  networkListingSchema,
  "network_listings"
);
