import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------
export const ORDER_STATUS_VALUES = [
  "pending",
  "reserved",
  "paid", // Marketplace only
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
] as const;
export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

// ----------------------------------------------------------
// Interfaces
// ----------------------------------------------------------
export interface IOrder extends Document {
  listing_type: "MarketplaceListing" | "NetworkListing";
  listing_id: Types.ObjectId;
  listing_snapshot: {
    brand: string;
    model: string;
    reference: string;
    price: number;
    thumbnail?: string;
  };
  
  buyer_id: Types.ObjectId;
  seller_id: Types.ObjectId;
  
  amount: number;
  currency: string;
  status: OrderStatus;
  
  offer_id?: Types.ObjectId;
  offer_revision_id?: Types.ObjectId;
  
  channel_id: Types.ObjectId;
  channel_type: "MarketplaceListingChannel" | "NetworkListingChannel";
  getstream_channel_id?: string;
  
  // Platform specific (Finix)
  finix_transfer_id?: string;
  finix_authorization_id?: string;
  
  reserved_at?: Date;
  paid_at?: Date;
  completed_at?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------
const orderSchema = new Schema<IOrder>(
  {
    listing_type: { type: String, enum: ["MarketplaceListing", "NetworkListing"], required: true },
    listing_id: { type: Schema.Types.ObjectId, required: true, index: true },
    listing_snapshot: {
      brand: { type: String, required: true },
      model: { type: String, required: true },
      reference: { type: String, required: true },
      price: { type: Number, required: true },
      thumbnail: { type: String },
    },
    buyer_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    seller_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ORDER_STATUS_VALUES, default: "pending", index: true },
    offer_id: { type: Schema.Types.ObjectId, ref: "Offer" },
    offer_revision_id: { type: Schema.Types.ObjectId, ref: "OfferRevision" },
    channel_id: { type: Schema.Types.ObjectId, required: true, index: true },
    channel_type: { 
      type: String, 
      enum: ["MarketplaceListingChannel", "NetworkListingChannel"], 
      required: true 
    },
    getstream_channel_id: { type: String, index: true },
    finix_transfer_id: { type: String, index: true },
    finix_authorization_id: { type: String, index: true },
    reserved_at: { type: Date },
    paid_at: { type: Date },
    completed_at: { type: Date },
  },
  { timestamps: true }
);

export const Order = mongoose.model<IOrder>("Order", orderSchema, "orders");
