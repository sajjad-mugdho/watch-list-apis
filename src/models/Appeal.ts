import mongoose, { Schema, Document } from "mongoose";

export interface IAppeal extends Document {
  user_id: mongoose.Types.ObjectId;
  reason: string;
  description?: string;
  evidence?: Array<{
    type: "text" | "image" | "document" | "link";
    content: string;
    uploadedAt: Date;
  }>;
  status: "pending" | "under_review" | "approved" | "denied" | "closed";
  appealType:
    | "account_suspension"
    | "account_restriction"
    | "transaction_dispute"
    | "other";
  relatedOrderId?: mongoose.Types.ObjectId;
  relatedCaseId?: mongoose.Types.ObjectId;
  submittedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  resolution?: string;
  notes: Array<{
    author: mongoose.Types.ObjectId;
    text: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const appealSchema = new Schema<IAppeal>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      maxlength: 500,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
    evidence: [
      {
        type: {
          type: String,
          enum: ["text", "image", "document", "link"],
          default: "text",
        },
        content: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "denied", "closed"],
      default: "pending",
      index: true,
    },
    appealType: {
      type: String,
      enum: [
        "account_suspension",
        "account_restriction",
        "transaction_dispute",
        "other",
      ],
      default: "other",
      index: true,
    },
    relatedOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    relatedCaseId: {
      type: Schema.Types.ObjectId,
      ref: "TrustCase",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: Date,
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    resolution: String,
    notes: [
      {
        author: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes for common queries
appealSchema.index({ user_id: 1, status: 1 });
appealSchema.index({ user_id: 1, submittedAt: -1 });
appealSchema.index({ relatedOrderId: 1 });
appealSchema.index({ status: 1, submittedAt: -1 });

export const Appeal =
  mongoose.models.Appeal || mongoose.model<IAppeal>("Appeal", appealSchema);
