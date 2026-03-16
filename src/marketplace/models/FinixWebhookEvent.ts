/**
 * FinixWebhookEvent Model
 *
 * Stores raw Finix webhook events for traceability, debugging, and idempotency.
 * Used to ensure webhook events are processed exactly once and maintain audit trail.
 */

import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * Interface for Finix webhook event document
 */
export interface IFinixWebhookEvent extends Document {
  _id: Types.ObjectId;

  eventId: string;
  eventType: string;

  // Raw payload and metadata
  payload: any;
  headers: Record<string, string>;

  // Processing status
  status: "pending" | "processing" | "processed" | "failed";
  error?: string;
  attemptCount: number;

  // Timestamps
  receivedAt: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const finixWebhookEventSchema = new Schema<IFinixWebhookEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    headers: {
      type: Map,
      of: String,
      default: {},
    },
    status: {
      type: String,
      enum: ["pending", "processing", "processed", "failed"],
      default: "pending",
      index: true,
    },
    error: {
      type: String,
      default: null,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "finix_webhook_events",
  }
);

// Indexes for efficient querying
finixWebhookEventSchema.index({ status: 1, receivedAt: 1 });
finixWebhookEventSchema.index({ eventType: 1, createdAt: -1 });

// Transform _id to string in JSON responses
finixWebhookEventSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    return ret;
  },
});

export const FinixWebhookEvent = mongoose.model<IFinixWebhookEvent>(
  "FinixWebhookEvent",
  finixWebhookEventSchema
);
