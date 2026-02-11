// src/models/OfferRevision.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------
export const CURRENCY_VALUES = ["USD", "CAD"] as const;
export type Currency = (typeof CURRENCY_VALUES)[number];

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------
export interface IOfferRevision extends Document {
  _id: Types.ObjectId;

  // Parent offer
  offer_id: Types.ObjectId;

  // Revision details
  amount: number;
  currency: Currency;
  note?: string;

  // Legal terms reference
  reservation_terms_id?: Types.ObjectId;

  // Who made this revision
  created_by: Types.ObjectId;
  revision_number: number;

  // Timestamps
  createdAt: Date;
}

export interface IOfferRevisionModel extends Model<IOfferRevision> {
  findByOffer(offerId: string | Types.ObjectId): Promise<IOfferRevision[]>;

  getLatestRevision(
    offerId: string | Types.ObjectId
  ): Promise<IOfferRevision | null>;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------
const OfferRevisionSchema = new Schema<IOfferRevision>(
  {
    offer_id: {
      type: Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      enum: CURRENCY_VALUES,
      default: "USD",
      required: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    reservation_terms_id: {
      type: Schema.Types.ObjectId,
      ref: "ReservationTerms",
    },

    created_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    revision_number: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // No updates allowed
  }
);

// ----------------------------------------------------------
// Indexes
// ----------------------------------------------------------

// Unique revision number per offer
OfferRevisionSchema.index(
  { offer_id: 1, revision_number: 1 },
  { unique: true }
);

// Query by offer, sorted by revision
OfferRevisionSchema.index({ offer_id: 1, createdAt: -1 });

// ----------------------------------------------------------
// Immutability Guards
// ----------------------------------------------------------
OfferRevisionSchema.pre("findOneAndUpdate", function () {
  throw new Error("OfferRevision documents are immutable and cannot be updated");
});

OfferRevisionSchema.pre("updateOne", function () {
  throw new Error("OfferRevision documents are immutable and cannot be updated");
});

OfferRevisionSchema.pre("updateMany", function () {
  throw new Error("OfferRevision documents are immutable and cannot be updated");
});

// ----------------------------------------------------------
// Static Methods
// ----------------------------------------------------------
OfferRevisionSchema.statics.findByOffer = function (
  offerId: string | Types.ObjectId
) {
  return this.find({ offer_id: offerId }).sort({ revision_number: 1 });
};

OfferRevisionSchema.statics.getLatestRevision = function (
  offerId: string | Types.ObjectId
) {
  return this.findOne({ offer_id: offerId }).sort({ revision_number: -1 });
};

// ----------------------------------------------------------
// Model
// ----------------------------------------------------------
export const OfferRevision = mongoose.model<
  IOfferRevision,
  IOfferRevisionModel
>("OfferRevision", OfferRevisionSchema, "offer_revisions");

export default OfferRevision;
