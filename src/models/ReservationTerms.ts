// src/models/ReservationTerms.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";
import crypto from "crypto";

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------
export interface IReservationTerms extends Document {
  _id: Types.ObjectId;

  // Version identifier (e.g., "2024.02.01")
  version: string;

  // Content
  content: string;
  content_hash: string; // SHA-256 for integrity verification

  // Dates
  effective_date: Date;

  // Admin who created
  created_by?: Types.ObjectId;

  // Flags
  is_current: boolean; // Only one can be current at a time
  is_archived: boolean;

  // Timestamps
  createdAt: Date;
}

export interface IReservationTermsModel extends Model<IReservationTerms> {
  getCurrent(): Promise<IReservationTerms | null>;
  getByVersion(version: string): Promise<IReservationTerms | null>;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------
const ReservationTermsSchema = new Schema<IReservationTerms>(
  {
    version: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^\d{4}\.\d{2}\.\d{2}(-\d+)?$/, // Format: YYYY.MM.DD or YYYY.MM.DD-N
    },

    content: {
      type: String,
      required: true,
    },

    content_hash: {
      type: String,
      required: true,
    },

    effective_date: {
      type: Date,
      required: true,
    },

    created_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    is_current: {
      type: Boolean,
      default: false,
      index: true,
    },

    is_archived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ----------------------------------------------------------
// Indexes
// ----------------------------------------------------------

// Only one current terms allowed
ReservationTermsSchema.index(
  { is_current: 1 },
  {
    unique: true,
    partialFilterExpression: { is_current: true },
    name: "unique_current_terms",
  }
);

ReservationTermsSchema.index({ effective_date: -1 });

// ----------------------------------------------------------
// Pre-save Hook: Compute Content Hash
// ----------------------------------------------------------
ReservationTermsSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("content")) {
    this.content_hash = crypto
      .createHash("sha256")
      .update(this.content)
      .digest("hex");
  }
  next();
});

// ----------------------------------------------------------
// Static Methods
// ----------------------------------------------------------
ReservationTermsSchema.statics.getCurrent = function () {
  return this.findOne({ is_current: true, is_archived: false });
};

ReservationTermsSchema.statics.getByVersion = function (version: string) {
  return this.findOne({ version });
};

// ----------------------------------------------------------
// Model
// ----------------------------------------------------------
export const ReservationTerms = mongoose.model<
  IReservationTerms,
  IReservationTermsModel
>("ReservationTerms", ReservationTermsSchema, "reservation_terms");

export default ReservationTerms;
