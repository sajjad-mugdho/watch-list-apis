// src/models/Block.ts
import mongoose, { Document, Schema, Types } from "mongoose";

export interface IBlock extends Document {
  _id: Types.ObjectId;
  blocker_id: Types.ObjectId;
  blocked_id: Types.ObjectId;
  reason?: string;
  createdAt: Date;
}

const blockSchema = new Schema<IBlock>(
  {
    blocker_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blocked_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      validate: {
        validator: function (this: IBlock, value: Types.ObjectId) {
          return String(this.blocker_id) !== String(value);
        },
        message: "Users cannot block themselves",
      },
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Prevent duplicate blocks
blockSchema.index({ blocker_id: 1, blocked_id: 1 }, { unique: true });

export const Block = mongoose.model<IBlock>("Block", blockSchema, "blocks");
