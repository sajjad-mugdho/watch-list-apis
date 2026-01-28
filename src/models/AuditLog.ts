// src/models/AuditLog.ts
/**
 * Audit Log Model for Finix Sandbox Certification
 * Tracks all sensitive operations (refunds, captures, voids) with actor, timestamp, and reason
 *
 * This fulfills Finix certification requirement #11: Role-based Access & audit logs
 */
import mongoose, { Schema, Document, Types } from "mongoose";

export type AuditAction =
  | "REFUND_REQUESTED"
  | "REFUND_APPROVED"
  | "REFUND_DENIED"
  | "REFUND_CANCELLED"
  | "ADMIN_REFUND"
  | "PRODUCT_RETURN_SUBMITTED"
  | "PRODUCT_RETURN_CONFIRMED"
  | "CAPTURE_INITIATED"
  | "CAPTURE_COMPLETED"
  | "VOID_INITIATED"
  | "VOID_COMPLETED"
  | "AUTHORIZATION_CREATED"
  | "PAYMENT_PROCESSED"
  | "DISPUTE_CREATED"
  | "DISPUTE_UPDATED"
  | "ORDER_CANCELLED"
  | "ORDER_STATUS_CHANGED";

export type ActorRole = "buyer" | "seller" | "admin" | "system";

export interface IAuditLog extends Document {
  _id: Types.ObjectId;

  // The action that was performed
  action: AuditAction;

  // Who performed the action
  actor_id: Types.ObjectId | null; // User ID, null for system actions
  actor_role: ActorRole;
  actor_email?: string | null;

  // What was affected
  order_id: Types.ObjectId;
  listing_id?: Types.ObjectId | null;

  // Additional context
  amount?: number | null; // For refunds, captures, etc.
  currency?: string | null;
  reason?: string | null; // Reason for action (e.g., refund reason)

  // Finix references
  finix_transfer_id?: string | null;
  finix_authorization_id?: string | null;
  finix_reversal_id?: string | null;

  // Previous and new state
  previous_state?: string | null;
  new_state?: string | null;

  // Request metadata
  ip_address?: string | null;
  user_agent?: string | null;
  idempotency_id?: string | null;

  // Additional metadata
  metadata?: Record<string, any>;

  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      enum: [
        "REFUND_REQUESTED",
        "REFUND_APPROVED",
        "REFUND_DENIED",
        "REFUND_CANCELLED",
        "ADMIN_REFUND",
        "PRODUCT_RETURN_SUBMITTED",
        "PRODUCT_RETURN_CONFIRMED",
        "CAPTURE_INITIATED",
        "CAPTURE_COMPLETED",
        "VOID_INITIATED",
        "VOID_COMPLETED",
        "AUTHORIZATION_CREATED",
        "PAYMENT_PROCESSED",
        "DISPUTE_CREATED",
        "DISPUTE_UPDATED",
        "ORDER_CANCELLED",
        "ORDER_STATUS_CHANGED",
      ],
      required: true,
      index: true,
    },

    actor_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actor_role: {
      type: String,
      enum: ["buyer", "seller", "admin", "system"],
      required: true,
      index: true,
    },
    actor_email: { type: String, default: null },

    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    listing_id: {
      type: Schema.Types.ObjectId,
      ref: "MarketplaceListing",
      default: null,
    },

    amount: { type: Number, default: null },
    currency: { type: String, default: "USD" },
    reason: { type: String, default: null },

    finix_transfer_id: { type: String, default: null, index: true },
    finix_authorization_id: { type: String, default: null, index: true },
    finix_reversal_id: { type: String, default: null, index: true },

    previous_state: { type: String, default: null },
    new_state: { type: String, default: null },

    ip_address: { type: String, default: null },
    user_agent: { type: String, default: null },
    idempotency_id: { type: String, default: null },

    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "audit_logs",
  }
);

// Compound indexes for common queries
AuditLogSchema.index({ order_id: 1, action: 1 });
AuditLogSchema.index({ actor_id: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

AuditLogSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    return ret;
  },
});

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

/**
 * Helper function to create an audit log entry
 * Used for tracking sensitive operations for Finix certification compliance
 */
export interface CreateAuditLogParams {
  action: AuditAction;
  user_id: string;
  resource_type: "order" | "refund_request" | "authorization" | "transfer";
  resource_id: string;
  details?: Record<string, any>;
  ip_address?: string | undefined;
  user_agent?: string | undefined;
  idempotency_id?: string | undefined;
}

export async function createAuditLog(
  params: CreateAuditLogParams
): Promise<IAuditLog> {
  const {
    action,
    user_id,
    resource_type,
    resource_id,
    details = {},
    ip_address,
    user_agent,
    idempotency_id,
  } = params;

  // Determine actor role based on action context
  let actor_role: ActorRole = "system";
  if (action.includes("ADMIN")) {
    actor_role = "admin";
  } else if (
    action === "REFUND_REQUESTED" ||
    action === "REFUND_CANCELLED" ||
    action === "PRODUCT_RETURN_SUBMITTED"
  ) {
    // Buyer-initiated actions
    actor_role = "buyer";
  } else if (
    action === "REFUND_APPROVED" ||
    action === "REFUND_DENIED" ||
    action === "PRODUCT_RETURN_CONFIRMED"
  ) {
    // Seller-initiated actions
    actor_role = "seller";
  }

  const auditLog = new AuditLog({
    action,
    actor_id: mongoose.Types.ObjectId.isValid(user_id)
      ? new mongoose.Types.ObjectId(user_id)
      : null,
    actor_role,
    // Use resource_id as order_id for backwards compatibility
    order_id: mongoose.Types.ObjectId.isValid(resource_id)
      ? new mongoose.Types.ObjectId(resource_id)
      : new mongoose.Types.ObjectId(),
    ip_address: ip_address || null,
    user_agent: user_agent || null,
    idempotency_id: idempotency_id || null,
    metadata: {
      resource_type,
      ...details,
    },
  });

  return auditLog.save();
}

export default AuditLog;
