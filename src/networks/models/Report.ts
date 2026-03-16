// src/models/Report.ts
import mongoose, { Document, Schema, Types } from "mongoose";

export const REPORT_TARGET_VALUES = ["User", "NetworkListing", "SocialGroup", "ChatMessage"] as const;
export const REPORT_STATUS_VALUES = ["pending", "reviewed", "dismissed"] as const;

export interface IReport extends Document {
  _id: Types.ObjectId;
  reporter_id: Types.ObjectId;
  target_id: Types.ObjectId;
  target_type: (typeof REPORT_TARGET_VALUES)[number];
  reason: string;
  description?: string;
  status: (typeof REPORT_STATUS_VALUES)[number];
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporter_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    target_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    target_type: {
      type: String,
      enum: REPORT_TARGET_VALUES,
      required: true,
    },
    reason: {
       type: String,
       required: true,
       trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: REPORT_STATUS_VALUES,
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

export const Report = mongoose.model<IReport>("Report", reportSchema, "reports");
