import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISocialInvite extends Document {
  _id: Types.ObjectId;
  inviter_id: Types.ObjectId;
  token: string;
  target_email?: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SocialInviteSchema = new Schema<ISocialInvite>(
  {
    inviter_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    target_email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired"],
      default: "pending",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Transform for JSON
SocialInviteSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.inviter_id = ret.inviter_id?.toString?.();
    return ret;
  },
});

export const SocialInvite = mongoose.model<ISocialInvite>(
  "SocialInvite",
  SocialInviteSchema,
  "social_invites"
);

export default SocialInvite;
