/**
 * ReferenceCheck Model
 *
 * Tracks reference check requests within networks.
 * Allows users to request references about other users from their network.
 */

import mongoose, { Document, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------

export const REFERENCE_STATUS_VALUES = [
  "pending",
  "approved",
  "declined",
  "completed",
] as const;
export type ReferenceStatus = (typeof REFERENCE_STATUS_VALUES)[number];

export const REFERENCE_RATING_VALUES = [
  "positive",
  "neutral",
  "negative",
] as const;
export type ReferenceRating = (typeof REFERENCE_RATING_VALUES)[number];

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------

export interface IReferenceResponse {
  responder_id: Types.ObjectId;
  rating: ReferenceRating;
  comment?: string;
  is_anonymous: boolean;
  responded_at: Date;
}

export interface IReferenceCheck extends Document {
  _id: Types.ObjectId;
  requester_id: Types.ObjectId; // User requesting the check
  target_id: Types.ObjectId; // User being checked
  network_id?: Types.ObjectId; // Optional network context
  order_id?: Types.ObjectId; // Optional order context
  getstream_channel_id?: string; // Specific channel for this check

  // Request details
  reason?: string;
  status: ReferenceStatus;

  // Responses from network members
  responses: IReferenceResponse[];

  // Summary (computed when completed)
  summary?: {
    total_responses: number;
    positive_count: number;
    neutral_count: number;
    negative_count: number;
  };

  // Timestamps
  expires_at?: Date;
  completed_at?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------

const ReferenceResponseSchema = new Schema<IReferenceResponse>(
  {
    responder_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: String,
      enum: REFERENCE_RATING_VALUES,
      required: true,
    },
    comment: {
      type: String,
      default: null,
      maxlength: 1000,
    },
    is_anonymous: {
      type: Boolean,
      default: false,
    },
    responded_at: {
      type: Date,
      default: () => new Date(),
    },
  },
  { _id: false }
);

const ReferenceSummarySchema = new Schema(
  {
    total_responses: { type: Number, default: 0 },
    positive_count: { type: Number, default: 0 },
    neutral_count: { type: Number, default: 0 },
    negative_count: { type: Number, default: 0 },
  },
  { _id: false }
);

const ReferenceCheckSchema = new Schema<IReferenceCheck>(
  {
    requester_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    target_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    network_id: {
      type: Schema.Types.ObjectId,
      ref: "Network",
      default: null,
      index: true,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    getstream_channel_id: {
      type: String,
      default: null,
    },
    reason: {
      type: String,
      default: null,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: REFERENCE_STATUS_VALUES,
      default: "pending",
      index: true,
    },
    responses: {
      type: [ReferenceResponseSchema],
      default: [],
    },
    summary: {
      type: ReferenceSummarySchema,
      default: null,
    },
    expires_at: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
    completed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
ReferenceCheckSchema.index({ requester_id: 1, status: 1 });
ReferenceCheckSchema.index({ target_id: 1, status: 1 });
ReferenceCheckSchema.index({ network_id: 1, status: 1 });

// Transform _id to string in JSON
ReferenceCheckSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.requester_id = ret.requester_id?.toString?.();
    ret.target_id = ret.target_id?.toString?.();
    if (ret.network_id) ret.network_id = ret.network_id?.toString?.();
    return ret;
  },
});

// ----------------------------------------------------------
// Methods
// ----------------------------------------------------------

ReferenceCheckSchema.methods.addResponse = async function (
  responderId: string,
  rating: ReferenceRating,
  comment?: string,
  isAnonymous: boolean = false
): Promise<IReferenceCheck> {
  // Check if already responded
  const existingResponse = this.responses.find(
    (r: IReferenceResponse) => r.responder_id.toString() === responderId
  );

  if (existingResponse) {
    throw new Error("User has already responded to this reference check");
  }

  this.responses.push({
    responder_id: responderId,
    rating,
    comment: comment || null,
    is_anonymous: isAnonymous,
    responded_at: new Date(),
  });

  return this.save();
};

ReferenceCheckSchema.methods.complete = async function (): Promise<IReferenceCheck> {
  // Calculate summary
  const summary = {
    total_responses: this.responses.length,
    positive_count: this.responses.filter(
      (r: IReferenceResponse) => r.rating === "positive"
    ).length,
    neutral_count: this.responses.filter(
      (r: IReferenceResponse) => r.rating === "neutral"
    ).length,
    negative_count: this.responses.filter(
      (r: IReferenceResponse) => r.rating === "negative"
    ).length,
  };

  this.summary = summary;
  this.status = "completed";
  this.completed_at = new Date();

  return this.save();
};

// ----------------------------------------------------------
// Statics
// ----------------------------------------------------------

interface IReferenceCheckModel extends mongoose.Model<IReferenceCheck> {
  getPendingForUser(userId: string): Promise<IReferenceCheck[]>;
  getRequestedByUser(userId: string): Promise<IReferenceCheck[]>;
  getChecksAboutUser(userId: string): Promise<IReferenceCheck[]>;
}

ReferenceCheckSchema.statics.getPendingForUser = async function (
  userId: string
): Promise<IReferenceCheck[]> {
  return this.find({
    status: "pending",
    requester_id: { $ne: userId },
    target_id: { $ne: userId },
    "responses.responder_id": { $ne: userId },
    expires_at: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

ReferenceCheckSchema.statics.getRequestedByUser = async function (
  userId: string
): Promise<IReferenceCheck[]> {
  return this.find({
    requester_id: userId,
  }).sort({ createdAt: -1 });
};

ReferenceCheckSchema.statics.getChecksAboutUser = async function (
  userId: string
): Promise<IReferenceCheck[]> {
  return this.find({
    target_id: userId,
    status: "completed",
  }).sort({ completed_at: -1 });
};

export const ReferenceCheck = mongoose.model<
  IReferenceCheck,
  IReferenceCheckModel
>("ReferenceCheck", ReferenceCheckSchema, "reference_checks");

export default ReferenceCheck;
