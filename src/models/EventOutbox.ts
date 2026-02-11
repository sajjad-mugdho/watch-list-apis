// src/models/EventOutbox.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------
export const AGGREGATE_TYPE_VALUES = [
  "offer",
  "order",
  "reference_check",
  "vouch",
  "trust_case",
] as const;

export type AggregateType = (typeof AGGREGATE_TYPE_VALUES)[number];

// Event types by aggregate
export const OFFER_EVENT_TYPES = [
  "OFFER_CREATED",
  "OFFER_COUNTERED",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
  "OFFER_EXPIRED",
] as const;

export const ORDER_EVENT_TYPES = [
  "ORDER_CREATED",
  "ORDER_RESERVED",
  "ORDER_AUTHORIZED",
  "ORDER_PAID",
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
  "ORDER_COMPLETED",
  "ORDER_CANCELLED",
  "ORDER_REFUNDED",
] as const;

export const REFERENCE_CHECK_EVENT_TYPES = [
  "REFERENCE_CHECK_STARTED",
  "REFERENCE_CHECK_COMPLETED",
  "REFERENCE_CHECK_SUSPENDED",
] as const;

export const VOUCH_EVENT_TYPES = ["VOUCH_ADDED"] as const;

export const TRUST_CASE_EVENT_TYPES = [
  "TRUST_CASE_CREATED",
  "TRUST_CASE_ESCALATED",
  "TRUST_CASE_RESOLVED",
  "TRUST_CASE_CLOSED",
] as const;

export type EventType =
  | (typeof OFFER_EVENT_TYPES)[number]
  | (typeof ORDER_EVENT_TYPES)[number]
  | (typeof REFERENCE_CHECK_EVENT_TYPES)[number]
  | (typeof VOUCH_EVENT_TYPES)[number]
  | (typeof TRUST_CASE_EVENT_TYPES)[number];

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------
export interface IEventOutbox extends Document {
  _id: Types.ObjectId;

  // Aggregate info
  aggregate_type: AggregateType;
  aggregate_id: Types.ObjectId;
  event_type: EventType;

  // Payload
  payload: Record<string, any>;

  // Publishing status
  published: boolean;
  published_at?: Date;

  // Retry tracking
  attempts: number;
  last_error?: string;

  // Timestamps
  createdAt: Date;
}

export interface IEventOutboxModel extends Model<IEventOutbox> {
  findUnpublished(limit?: number): Promise<IEventOutbox[]>;

  markAsPublished(eventId: string | Types.ObjectId): Promise<void>;

  markAsFailed(
    eventId: string | Types.ObjectId,
    error: string
  ): Promise<void>;

  cleanupOldEvents(olderThanDays?: number): Promise<number>;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------
const EventOutboxSchema = new Schema<IEventOutbox>(
  {
    aggregate_type: {
      type: String,
      enum: AGGREGATE_TYPE_VALUES,
      required: true,
      index: true,
    },

    aggregate_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    event_type: {
      type: String,
      required: true,
      index: true,
    },

    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },

    published: {
      type: Boolean,
      default: false,
      index: true,
    },

    published_at: {
      type: Date,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    last_error: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ----------------------------------------------------------
// Indexes
// ----------------------------------------------------------

// For publisher queue: unpublished events, ordered by creation
EventOutboxSchema.index({ published: 1, createdAt: 1 });

// For deduplication/lookup
EventOutboxSchema.index(
  { aggregate_type: 1, aggregate_id: 1, event_type: 1 },
  { name: "aggregate_event_lookup" }
);

// For cleanup
EventOutboxSchema.index({ published: 1, published_at: 1 });

// ----------------------------------------------------------
// Static Methods
// ----------------------------------------------------------
EventOutboxSchema.statics.findUnpublished = function (limit = 100) {
  return this.find({ published: false })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
};

EventOutboxSchema.statics.markAsPublished = async function (
  eventId: string | Types.ObjectId
): Promise<void> {
  await this.updateOne(
    { _id: eventId },
    {
      $set: {
        published: true,
        published_at: new Date(),
      },
    }
  );
};

EventOutboxSchema.statics.markAsFailed = async function (
  eventId: string | Types.ObjectId,
  error: string
): Promise<void> {
  await this.updateOne(
    { _id: eventId },
    {
      $inc: { attempts: 1 },
      $set: { last_error: error },
    }
  );
};

EventOutboxSchema.statics.cleanupOldEvents = async function (
  olderThanDays = 7
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await this.deleteMany({
    published: true,
    published_at: { $lt: cutoffDate },
  });

  return result.deletedCount || 0;
};

// ----------------------------------------------------------
// Model
// ----------------------------------------------------------
export const EventOutbox = mongoose.model<IEventOutbox, IEventOutboxModel>(
  "EventOutbox",
  EventOutboxSchema,
  "event_outbox"
);

export default EventOutbox;
