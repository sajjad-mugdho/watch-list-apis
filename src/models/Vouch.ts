// src/models/Vouch.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------
export const CONNECTION_TYPE_VALUES = ["friend", "mutual", "follow"] as const;
export type ConnectionType = (typeof CONNECTION_TYPE_VALUES)[number];

// ----------------------------------------------------------
// Interfaces
// ----------------------------------------------------------
export interface IVoucherSnapshot {
  display_name: string;
  avatar?: string;
  connection_type: ConnectionType;
  reputation_score?: number;
}

export interface IVouch extends Document {
  _id: Types.ObjectId;

  // References
  reference_check_id: Types.ObjectId;
  vouched_for_user_id: Types.ObjectId; // The user being vouched for
  vouched_by_user_id: Types.ObjectId; // The voucher

  // Content
  comment?: string;
  weight: number; // Calculated at creation time

  // Snapshot of voucher at time of vouch
  voucher_snapshot: IVoucherSnapshot;

  // Timestamps
  createdAt: Date;
}

export interface IVouchModel extends Model<IVouch> {
  findByReferenceCheck(
    referenceCheckId: string | Types.ObjectId
  ): Promise<IVouch[]>;

  findByVouchedForUser(
    userId: string | Types.ObjectId
  ): Promise<IVouch[]>;

  findByVoucher(userId: string | Types.ObjectId): Promise<IVouch[]>;

  countForReferenceCheck(
    referenceCheckId: string | Types.ObjectId
  ): Promise<number>;

  getTotalWeightForReferenceCheck(
    referenceCheckId: string | Types.ObjectId
  ): Promise<number>;
}

// ----------------------------------------------------------
// Sub-schemas
// ----------------------------------------------------------
const VoucherSnapshotSchema = new Schema<IVoucherSnapshot>(
  {
    display_name: { type: String, required: true, trim: true },
    avatar: { type: String, trim: true },
    connection_type: {
      type: String,
      enum: CONNECTION_TYPE_VALUES,
      required: true,
    },
    reputation_score: { type: Number, min: 0 },
  },
  { _id: false }
);

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------
const VouchSchema = new Schema<IVouch>(
  {
    reference_check_id: {
      type: Schema.Types.ObjectId,
      ref: "ReferenceCheck",
      required: true,
      index: true,
    },

    vouched_for_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    vouched_by_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    comment: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    weight: {
      type: Number,
      required: true,
      min: 0,
      default: 1.0,
    },

    voucher_snapshot: {
      type: VoucherSnapshotSchema,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Vouches are immutable
  }
);

// ----------------------------------------------------------
// Indexes
// ----------------------------------------------------------

// Unique: one vouch per user per reference check
VouchSchema.index(
  { reference_check_id: 1, vouched_by_user_id: 1 },
  { unique: true, name: "unique_vouch_per_check" }
);

// User's received vouches
VouchSchema.index({ vouched_for_user_id: 1, createdAt: -1 });

// User's given vouches
VouchSchema.index({ vouched_by_user_id: 1, createdAt: -1 });

// ----------------------------------------------------------
// Immutability Guards
// ----------------------------------------------------------
VouchSchema.pre("findOneAndUpdate", function () {
  throw new Error("Vouch documents are immutable and cannot be updated");
});

VouchSchema.pre("updateOne", function () {
  throw new Error("Vouch documents are immutable and cannot be updated");
});

VouchSchema.pre("updateMany", function () {
  throw new Error("Vouch documents are immutable and cannot be updated");
});

// ----------------------------------------------------------
// Static Methods
// ----------------------------------------------------------
VouchSchema.statics.findByReferenceCheck = function (
  referenceCheckId: string | Types.ObjectId
) {
  return this.find({ reference_check_id: referenceCheckId }).sort({
    createdAt: -1,
  });
};

VouchSchema.statics.findByVouchedForUser = function (
  userId: string | Types.ObjectId
) {
  return this.find({ vouched_for_user_id: userId }).sort({ createdAt: -1 });
};

VouchSchema.statics.findByVoucher = function (userId: string | Types.ObjectId) {
  return this.find({ vouched_by_user_id: userId }).sort({ createdAt: -1 });
};

VouchSchema.statics.countForReferenceCheck = function (
  referenceCheckId: string | Types.ObjectId
) {
  return this.countDocuments({ reference_check_id: referenceCheckId });
};

VouchSchema.statics.getTotalWeightForReferenceCheck = async function (
  referenceCheckId: string | Types.ObjectId
): Promise<number> {
  const result = await this.aggregate([
    { $match: { reference_check_id: new Types.ObjectId(String(referenceCheckId)) } },
    { $group: { _id: null, totalWeight: { $sum: "$weight" } } },
  ]);
  return result[0]?.totalWeight || 0;
};

// ----------------------------------------------------------
// Model
// ----------------------------------------------------------
export const Vouch = mongoose.model<IVouch, IVouchModel>(
  "Vouch",
  VouchSchema,
  "vouches"
);

export default Vouch;
