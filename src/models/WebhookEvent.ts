import mongoose, { Document, Schema } from "mongoose";

// ----------------------------------------------------------
// Interfaces
// ----------------------------------------------------------

export interface IWebhookEvent extends Document {
  eventId: string;
  provider: "clerk" | "finix" | "getstream";
  type: string;
  payload: any;
  status: "received" | "processing" | "processed" | "failed";
  processedAt?: Date;
  error?: string;
  data: any; // Additional metadata (attempt numbers, etc.)
  createdAt: Date;
  updatedAt: Date;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------

const webhookEventSchema = new Schema<IWebhookEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ["clerk", "finix", "getstream"],
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["received", "processing", "processed", "failed"],
      default: "received",
      index: true,
    },
    processedAt: {
      type: Date,
    },
    error: {
      type: String,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// ----------------------------------------------------------
// Model
// ----------------------------------------------------------

export const WebhookEvent = mongoose.model<IWebhookEvent>(
  "WebhookEvent",
  webhookEventSchema,
  "webhook_events"
);
