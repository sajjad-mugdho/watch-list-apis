import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISocialGroup extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  avatar?: string;
  created_by: Types.ObjectId;
  member_count: number;
  privacy: "public" | "private" | "invite-only" | "secret";
  is_private: boolean;
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
      required: true,
      index: true,
    },
    member_count: {
      type: Number,
      default: 1, // Creator is the first member
    },
    privacy: {
      type: String,
      enum: ["public", "private", "invite-only", "secret"],
      default: "public",
      index: true,
    },
    is_private: {
      type: Boolean,
      default: false,
      index: true,
    },
    getstream_channel_id: {
      type: String,
      sparse: true,
      unique: true,
    }
  },
  {
    timestamps: true,
  }
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
  "social_groups"
);

export default SocialGroup;
