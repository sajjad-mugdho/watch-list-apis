import mongoose, { Schema, Types } from "mongoose";

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
  "authorized",
] as const;
export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

// ----------------------------------------------------------
// Interfaces
// ----------------------------------------------------------
export interface IOrder {
  _id: Types.ObjectId;
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

  reservation_terms_snapshot?: string;

  offer_id?: Types.ObjectId;
  offer_revision_id?: Types.ObjectId;

  buyer_confirmed_complete: boolean;
  seller_confirmed_complete: boolean;
  confirmed_by: {
    user_id: Types.ObjectId;
    confirmed_at: Date;
  }[];

  channel_id?: Types.ObjectId;
  channel_type?: "MarketplaceListingChannel" | "NetworkListingChannel";
  getstream_channel_id?: string;

  // Platform specific (Finix)
  finix_transfer_id?: string;
  finix_authorization_id?: string;
  finix_buyer_identity_id?: string;
  finix_payment_instrument_id?: string;
  finix_transaction_id?: string;
  fraud_session_id?: string;

  reserved_at?: Date;
  reservation_expires_at?: Date;
  paid_at?: Date;
  shipped_at?: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  refunded_at?: Date;
  authorized_at?: Date;
  three_ds_completed_at?: Date;

  metadata?: Record<string, any>;

  dispute_id?: string;
  dispute_state?: string;
  dispute_reason?: string;
  dispute_amount?: number;
  dispute_respond_by?: Date | undefined;
  dispute_created_at?: Date;

  createdAt: Date;
  updatedAt: Date;

  toJSON?(): Record<string, any>;
  toObject?(): Record<string, any>;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------
const orderSchema = new Schema<IOrder>(
  {
    listing_type: {
      type: String,
      enum: ["MarketplaceListing", "NetworkListing"],
      required: true,
    },
    listing_id: { type: Schema.Types.ObjectId, required: true, index: true },
    listing_snapshot: {
      brand: { type: String, required: true },
      model: { type: String, required: true },
      reference: { type: String, required: true },
      price: { type: Number, required: true },
      thumbnail: { type: String },
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
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    status: {
      type: String,
      enum: ORDER_STATUS_VALUES,
      default: "pending",
      index: true,
    },
    reservation_terms_snapshot: { type: String, default: null },
    offer_id: { type: Schema.Types.ObjectId, ref: "Offer" },
    offer_revision_id: { type: Schema.Types.ObjectId, ref: "OfferRevision" },
    buyer_confirmed_complete: { type: Boolean, default: false },
    seller_confirmed_complete: { type: Boolean, default: false },
    confirmed_by: [
      {
        user_id: { type: Schema.Types.ObjectId, ref: "User" },
        confirmed_at: { type: Date },
      },
    ],
    channel_id: { type: Schema.Types.ObjectId, required: false, index: true },
    channel_type: {
      type: String,
      enum: ["MarketplaceListingChannel", "NetworkListingChannel"],
      required: false,
    },
    getstream_channel_id: { type: String, index: true },
    finix_transfer_id: { type: String, index: true },
    finix_authorization_id: { type: String, index: true },
    finix_buyer_identity_id: { type: String, index: true },
    finix_payment_instrument_id: { type: String, index: true },
    finix_transaction_id: { type: String, index: true },
    fraud_session_id: { type: String, index: true },
    reserved_at: { type: Date },
    reservation_expires_at: { type: Date },
    paid_at: { type: Date },
    shipped_at: { type: Date },
    completed_at: { type: Date },
    cancelled_at: { type: Date },
    refunded_at: { type: Date },
    authorized_at: { type: Date },
    three_ds_completed_at: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    dispute_id: { type: String, index: true },
    dispute_state: { type: String, index: true },
    dispute_reason: { type: String },
    dispute_amount: { type: Number },
    dispute_respond_by: { type: Date },
    dispute_created_at: { type: Date },
  },
  { timestamps: true },
);

export const Order = mongoose.model<IOrder>("Order", orderSchema, "orders");
