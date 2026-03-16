// src/models/RefundRequest.ts
/**
 * Refund Request Model for Finix Sandbox Certification
 *
 * CORRECT FLOW (per Finix docs):
 * 1. BUYER requests refund with reason (item not as described, damaged, etc.)
 * 2. SELLER receives request, reviews reason
 * 3. BUYER must return the product to seller
 * 4. SELLER confirms product received and approves refund
 * 5. Refund is executed via Finix and BUYER gets money back
 *
 * All actions are logged in AuditLog for compliance.
 */
import mongoose, { Schema, Document, Types } from "mongoose";

export type RefundRequestStatus =
  | "pending" // Buyer requested, waiting for seller review
  | "return_requested" // Buyer submitted return tracking info
  | "return_received" // Seller confirmed product received
  | "approved" // Seller approved the refund
  | "executed" // Refund executed via Finix
  | "denied" // Seller denied the request
  | "cancelled"; // Buyer cancelled their request

export interface IRefundRequest extends Document {
  _id: Types.ObjectId;

  // Order reference
  order_id: Types.ObjectId;

  // Parties involved
  buyer_id: Types.ObjectId; // Who requests the refund
  seller_id: Types.ObjectId; // Who approves/denies the refund

  // Refund details
  requested_amount: number; // Amount to refund in cents
  original_transfer_amount: number; // Original transaction amount in cents
  currency: string;

  // Buyer's refund request (simple string reason for handlers)
  buyer_reason: string; // Why buyer wants refund (min 10 chars)

  // Status tracking
  status: RefundRequestStatus;

  // Return tracking (product must be returned before refund)
  product_returned: boolean; // Whether buyer has returned the product
  product_return_confirmed: boolean; // Whether seller confirmed receipt
  return_tracking_number?: string | null;
  return_carrier?: string | null;
  return_shipped_at?: Date | null;

  // Seller response
  seller_response_reason?: string | null; // Seller's reason for approval/denial
  approved_by?: string | null;
  approved_at?: Date | null;
  denied_by?: string | null;
  denied_at?: Date | null;

  // Finix processing details
  finix_reversal_id?: string | null;
  finix_reversal_state?: string | null;
  finix_transfer_id: string; // Original transfer being refunded
  executed_at?: Date | null;

  // Idempotency
  idempotency_id: string;

  createdAt: Date;
  updatedAt: Date;
}

const RefundRequestSchema = new Schema<IRefundRequest>(
  {
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
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

    requested_amount: { type: Number, required: true, min: 1 },
    original_transfer_amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "USD" },

    // Buyer's reason for refund (simple text)
    buyer_reason: { type: String, required: true, minlength: 10 },

    status: {
      type: String,
      enum: [
        "pending",
        "return_requested",
        "return_received",
        "approved",
        "executed",
        "denied",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    // Return tracking
    product_returned: { type: Boolean, default: false },
    product_return_confirmed: { type: Boolean, default: false },
    return_tracking_number: { type: String, default: null },
    return_carrier: { type: String, default: null },
    return_shipped_at: { type: Date, default: null },

    // Seller response
    seller_response_reason: { type: String, default: null },
    approved_by: { type: String, default: null },
    approved_at: { type: Date, default: null },
    denied_by: { type: String, default: null },
    denied_at: { type: Date, default: null },

    // Finix details
    finix_reversal_id: { type: String, default: null, index: true },
    finix_reversal_state: { type: String, default: null },
    finix_transfer_id: { type: String, required: true },
    executed_at: { type: Date, default: null },

    idempotency_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "refund_requests",
  }
);

// Compound indexes for common queries
RefundRequestSchema.index({ seller_id: 1, status: 1 });
RefundRequestSchema.index({ buyer_id: 1, status: 1 });
RefundRequestSchema.index({ order_id: 1, status: 1 });
RefundRequestSchema.index({ createdAt: -1 });

RefundRequestSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    return ret;
  },
});

export const RefundRequest = mongoose.model<IRefundRequest>(
  "RefundRequest",
  RefundRequestSchema
);
export default RefundRequest;
