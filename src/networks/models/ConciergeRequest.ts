// src/models/ConciergeRequest.ts
import mongoose, { Document, Schema, Types } from "mongoose";

export type ConciergeStatus = "pending" | "approved" | "rejected" | "completed";

export interface IConciergeRequest extends Document {
  _id: Types.ObjectId;
  listing_id: Types.ObjectId;
  buyer_id: Types.ObjectId;
  status: ConciergeStatus;
  message?: string;
  admin_notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ConciergeRequestSchema = new Schema<IConciergeRequest>(
  {
    listing_id: {
      type: Schema.Types.ObjectId,
      ref: "NetworkListing",
      required: true,
      index: true,
    },
    buyer_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
      index: true,
    },
    message: {
      type: String,
      maxlength: 2000,
    },
    admin_notes: {
      type: String,
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

export const ConciergeRequest = mongoose.model<IConciergeRequest>(
  "ConciergeRequest",
  ConciergeRequestSchema,
  "concierge_requests"
);

export default ConciergeRequest;
