import mongoose, { Document, Schema, Types } from "mongoose";

export type SocialGroupRole = "admin" | "moderator" | "member";

export interface ISocialGroupMember extends Document {
  _id: Types.ObjectId;
  group_id: Types.ObjectId;
  user_id: Types.ObjectId;
  role: SocialGroupRole;
  muted: boolean;
  last_read_at: Date;
  joinedAt: Date;
  updatedAt: Date;
}

const SocialGroupMemberSchema = new Schema<ISocialGroupMember>(
  {
    group_id: {
      type: Schema.Types.ObjectId,
      ref: "SocialGroup",
      required: true,
      index: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "moderator", "member"],
      default: "member",
    },
    muted: {
      type: Boolean,
      default: false,
    },
    last_read_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "joinedAt", updatedAt: "updatedAt" },
  }
);

// Compound index for uniqueness
SocialGroupMemberSchema.index({ group_id: 1, user_id: 1 }, { unique: true });

// Transform for JSON
SocialGroupMemberSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.group_id = ret.group_id?.toString?.();
    ret.user_id = ret.user_id?.toString?.();
    return ret;
  },
});

export const SocialGroupMember = mongoose.model<ISocialGroupMember>(
  "SocialGroupMember",
  SocialGroupMemberSchema,
  "social_group_members"
);

export default SocialGroupMember;
