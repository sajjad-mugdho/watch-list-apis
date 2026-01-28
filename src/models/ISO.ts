/**
 * ISO (In Search Of) Model
 *
 * Represents a user's wish/search for a specific item.
 * Users can create ISOs to broadcast what they're looking for.
 */

import mongoose, { Document, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------

export const ISO_STATUS_VALUES = ["active", "fulfilled", "expired", "closed"] as const;
export type ISOStatus = (typeof ISO_STATUS_VALUES)[number];

export const ISO_URGENCY_VALUES = ["low", "medium", "high", "urgent"] as const;
export type ISOUrgency = (typeof ISO_URGENCY_VALUES)[number];

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------

export interface IISO extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  clerk_id: string;

  // ISO Details
  title: string;
  description?: string;
  criteria: {
    brand?: string;
    model?: string;
    reference?: string;
    year_min?: number;
    year_max?: number;
    condition?: string;
    max_price?: number;
  };

  // Status and visibility
  status: ISOStatus;
  urgency: ISOUrgency;
  is_public: boolean;

  // Timestamps
  expires_at?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------

const ISOCriteriaSchema = new Schema(
  {
    brand: { type: String, default: null },
    model: { type: String, default: null },
    reference: { type: String, default: null },
    year_min: { type: Number, default: null },
    year_max: { type: Number, default: null },
    condition: { type: String, default: null },
    max_price: { type: Number, default: null },
  },
  { _id: false }
);

const ISOSchema = new Schema<IISO>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clerk_id: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    criteria: {
      type: ISOCriteriaSchema,
      default: {},
    },
    status: {
      type: String,
      enum: ISO_STATUS_VALUES,
      default: "active",
      index: true,
    },
    urgency: {
      type: String,
      enum: ISO_URGENCY_VALUES,
      default: "medium",
    },
    is_public: {
      type: Boolean,
      default: true,
      index: true,
    },
    expires_at: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user's ISOs
ISOSchema.index({ user_id: 1, status: 1 });

// Text index for search
ISOSchema.index({ title: "text", description: "text" });

// Transform _id to string in JSON
ISOSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.user_id = ret.user_id?.toString?.();
    return ret;
  },
});

// ----------------------------------------------------------
// Statics
// ----------------------------------------------------------

interface IISOModel extends mongoose.Model<IISO> {
  getActiveByUser(userId: string): Promise<IISO[]>;
  getPublicActive(limit?: number, offset?: number): Promise<IISO[]>;
}

ISOSchema.statics.getActiveByUser = async function (
  userId: string
): Promise<IISO[]> {
  return this.find({
    user_id: userId,
    status: "active",
  }).sort({ createdAt: -1 });
};

ISOSchema.statics.getPublicActive = async function (
  limit: number = 20,
  offset: number = 0
): Promise<IISO[]> {
  return this.find({
    status: "active",
    is_public: true,
    $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
  })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

// ----------------------------------------------------------
// Methods
// ----------------------------------------------------------

ISOSchema.methods.markFulfilled = async function (): Promise<IISO> {
  this.status = "fulfilled";
  return this.save();
};

ISOSchema.methods.close = async function (): Promise<IISO> {
  this.status = "closed";
  return this.save();
};

export const ISO = mongoose.model<IISO, IISOModel>("ISO", ISOSchema, "isos");

export default ISO;
