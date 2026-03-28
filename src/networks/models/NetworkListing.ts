import mongoose, { Schema, Types } from "mongoose";
import {
  LISTING_STATUS_VALUES,
  ListingStatus,
  IListingAuthorSnapshot,
} from "../../models/Listings";
import { WATCH_CATEGORY_VALUES, WatchCategory } from "../../models/Watches";

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
  type: "for_sale" | "wtb";
  title: string;
  brand: string;
  model: string;
  reference: string;
  category?: WatchCategory;
  thumbnail?: string;
  images: string[];
  price?: number;
  condition?: string;
  year?: number;
  contents?: string;

  // Networks specific
  allow_offers: boolean;
  reservation_terms?: string;
  subtitle?: string;
  description?: string;
  offers_count: number;
  view_count: number;

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
    dialist_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clerk_id: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: LISTING_STATUS_VALUES,
      default: "draft",
      index: true,
    },
    type: {
      type: String,
      enum: ["for_sale", "wtb"],
      default: "for_sale",
      index: true,
    },
    is_deleted: { type: Boolean, default: false },
    title: { type: String, required: true },
    brand: { type: String, required: true, index: true },
    model: { type: String, required: true },
    reference: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: WATCH_CATEGORY_VALUES,
      default: "Uncategorized",
      index: true,
    },
    thumbnail: { type: String },
    images: { type: [String], default: [] },
    price: { type: Number, min: 0 },
    condition: { type: String },
    year: { type: Number },
    contents: { type: String },
    allow_offers: { type: Boolean, default: true },
    reservation_terms: { type: String },
    subtitle: { type: String, maxlength: 100 },
    description: { type: String, maxlength: 2000 },
    offers_count: { type: Number, default: 0, index: true },
    view_count: { type: Number, default: 0, index: true },
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
    shipping: {
      type: [
        {
          region: { type: String, required: true },
          shippingIncluded: { type: Boolean, required: true },
          shippingCost: { type: Number, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

// Supports basic relevance sorting for listing search.
networkListingSchema.index({
  title: "text",
  brand: "text",
  model: "text",
  reference: "text",
});

export const NetworkListing = mongoose.model<INetworkListing>(
  "NetworkListing",
  networkListingSchema,
  "network_listings",
);
