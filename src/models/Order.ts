// src/models/Order.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type OrderStatus =
  | "reserved"
  | "pending" // existing - waiting payment
  | "processing" // NEW - payment captured, waiting for transfer confirmation
  | "authorized" // NEW - Finix authorization created
  | "paid" // existing - payment captured
  | "shipped" // NEW - tracking uploaded
  | "delivered" // NEW - buyer confirmed
  | "completed" // existing - fully done
  | "cancelled" // existing
  | "expired" // NEW - reservation timeout
  | "refunded"; // NEW - refunded (full or partial)

export interface IOrder extends Document {
  _id: Types.ObjectId;
  listing_type: "NetworkListing" | "MarketplaceListing"; // Discriminator for listing reference
  listing_id: Types.ObjectId;
  listing_snapshot: {
    brand?: string | null;
    model?: string | null;
    reference?: string | null;
    condition?: string | null;
    price: number;
    images?: string[];
    thumbnail?: string | null;
  };
  from_offer_id: Types.ObjectId | null;
  buyer_id: Types.ObjectId;
  seller_id: Types.ObjectId;
  amount: number;
  currency: string;

  status: OrderStatus;

  // Reservation (45-min window)
  reserved_at?: Date | null;
  reservation_expires_at?: Date | null;

  // Finix fields
  finix_buyer_identity_id?: string | null;
  finix_payment_instrument_id?: string | null;
  finix_authorization_id?: string | null;
  finix_transaction_id?: string | null;
  finix_transfer_id?: string | null;
  fraud_session_id?: string | null;

  // Channel references
  channel_id?: Types.ObjectId | null; // NetworkListingChannel._id or MarketplaceListingChannel._id
  channel_type?: "NetworkListingChannel" | "MarketplaceListing Channel" | null; // Discriminator for channel reference
  getstream_channel_id?: string | null;

  // Shipping info
  tracking_number?: string | null;
  tracking_carrier?: string | null;
  shipped_at?: Date | null;

  // Delivery info
  delivered_at?: Date | null;
  auto_confirmed_at?: Date | null;

  // timestamps for status changes
  authorized_at?: Date | null;
  paid_at?: Date | null;
  completed_at?: Date | null;
  cancelled_at?: Date | null;
  refunded_at?: Date | null;

  // Dispute fields (Finix certification requirement)
  dispute_id?: string | null;
  dispute_state?: "INQUIRY" | "PENDING" | "WON" | "LOST" | null;
  dispute_reason?: string | null;
  dispute_amount?: number | null;
  dispute_respond_by?: Date | null;
  dispute_created_at?: Date | null;

  // 3DS fields
  three_ds_redirect_url?: string | null;
  three_ds_started_at?: Date | null;
  three_ds_completed_at?: Date | null;

  // Payment method tracking
  payment_method?: "card" | "bank" | "token" | null;

  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ListingSnapshotSchema = new Schema(
  {
    brand: { type: String, default: null },
    model: { type: String, default: null },
    reference: { type: String, default: null },
    condition: { type: String, default: null },
    price: { type: Number, required: true },
    images: [{ type: String }],
    thumbnail: { type: String, default: null },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    listing_type: {
      type: String,
      enum: ["NetworkListing", "MarketplaceListing"],
      required: true,
      default: "NetworkListing", // Default for backward compatibility
      index: true,
    },
    listing_id: {
      type: Schema.Types.ObjectId,
      refPath: "listing_type", // Dynamic reference based on listing_type
      required: true,
      index: true,
    },
    listing_snapshot: { type: ListingSnapshotSchema, required: true },
    from_offer_id: {
      type: Schema.Types.ObjectId,
      ref: "NetworkListingChannel", // TODO: Make this dynamic with refPath if needed
      required: false,
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
      enum: [
        "reserved",
        "pending",
        "processing",
        "authorized",
        "paid",
        "shipped",
        "delivered",
        "completed",
        "cancelled",
        "expired",
        "refunded",
      ],
      default: "pending",
      index: true,
    },

    // Reservation (45-min window)
    reserved_at: { type: Date, default: null },
    reservation_expires_at: { type: Date, default: null },

    // finix payment fields
    finix_buyer_identity_id: { type: String, default: null },
    finix_payment_instrument_id: { type: String, default: null },
    finix_authorization_id: { type: String, default: null },
    finix_transaction_id: { type: String, default: null },
    finix_transfer_id: { type: String, default: null },
    fraud_session_id: { type: String, default: null },

    // Shipping info
    tracking_number: { type: String, default: null },
    tracking_carrier: { type: String, default: null },
    shipped_at: { type: Date, default: null },

    // Delivery info
    delivered_at: { type: Date, default: null },
    auto_confirmed_at: { type: Date, default: null },

    channel_type: {
      type: String,
      enum: ["NetworkListingChannel", "MarketplaceListingChannel", null],
      default: null,
    },
    channel_id: {
      type: Schema.Types.ObjectId,
      refPath: "channel_type", // Dynamic reference based on channel_type
      default: null,
    },
    getstream_channel_id: { type: String, default: null },

    authorized_at: { type: Date, default: null },
    paid_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
    cancelled_at: { type: Date, default: null },
    refunded_at: { type: Date, default: null },

    // Dispute fields (Finix certification requirement)
    dispute_id: { type: String, default: null },
    dispute_state: {
      type: String,
      enum: ["INQUIRY", "PENDING", "WON", "LOST", null],
      default: null,
    },
    dispute_reason: { type: String, default: null },
    dispute_amount: { type: Number, default: null },
    dispute_respond_by: { type: Date, default: null },
    dispute_created_at: { type: Date, default: null },

    // 3DS fields
    three_ds_redirect_url: { type: String, default: null },
    three_ds_started_at: { type: Date, default: null },
    three_ds_completed_at: { type: Date, default: null },

    // Payment method tracking
    payment_method: {
      type: String,
      enum: ["card", "bank", "token", null],
      default: null,
    },

    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

OrderSchema.index({ buyer_id: 1, status: 1 });
OrderSchema.index({ seller_id: 1, status: 1 });
OrderSchema.index({ reservation_expires_at: 1 });
OrderSchema.index({ finix_authorization_id: 1 }, { sparse: true });
OrderSchema.index({ finix_transaction_id: 1 }, { sparse: true });
OrderSchema.index({ dispute_id: 1 }, { sparse: true });
OrderSchema.index({ dispute_state: 1 }, { sparse: true });

OrderSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    return ret;
  },
});

export const Order = mongoose.model<IOrder>("Order", OrderSchema, "orders");
export default Order;
