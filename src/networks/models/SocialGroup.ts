import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISocialGroup extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  avatar?: string;
  created_by: Types.ObjectId;
  member_count: number;
  privacy: "public" | "private" | "invite_only" | "invite-only" | "secret";
  getstream_channel_id?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SocialGroupSchema = new Schema<ISocialGroup>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    avatar: {
      type: String,
      default: null,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
      index: true,
    },
    member_count: {
      type: Number,
      default: 1, // Creator is the first member
    },
    privacy: {
      type: String,
      // Keep legacy invite-only for read compatibility; writes normalize to invite_only.
      enum: ["public", "private", "invite_only", "invite-only", "secret"],
      default: "public",
      index: true,
    },
    getstream_channel_id: {
      type: String,
      sparse: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);

// Transform for JSON
SocialGroupSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.created_by = ret.created_by?.toString?.();
    return ret;
  },
});

export const SocialGroup = mongoose.model<ISocialGroup>(
  "SocialGroup",
  SocialGroupSchema,
  "social_groups",
);

export default SocialGroup;
