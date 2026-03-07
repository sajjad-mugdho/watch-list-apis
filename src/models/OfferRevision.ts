import mongoose, { Model, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Interfaces
// ----------------------------------------------------------
export interface IOfferRevision {
  _id: Types.ObjectId;
  offer_id: Types.ObjectId;
  amount: number;
  currency: string;
  note?: string;
  reservation_terms_id?: Types.ObjectId;
  created_by: Types.ObjectId;
  revision_number: number;

  createdAt: Date;
}

export interface IOfferRevisionModel extends Model<IOfferRevision> {
  getLatestRevision(offerId: string): Promise<IOfferRevision | null>;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------
// Import CURRENCY_VALUES from User model
const CURRENCY_VALUES = ["USD", "CAD"] as const;

const offerRevisionSchema = new Schema<IOfferRevision>(
  {
    offer_id: {
      type: Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      enum: CURRENCY_VALUES,
      default: "USD",
      required: true,
    },
    note: { type: String, trim: true, maxlength: 1000 },
    reservation_terms_id: {
      type: Schema.Types.ObjectId,
      ref: "ReservationTerms",
    },
    created_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    revision_number: { type: Number, required: true, min: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Prevent duplicate revision numbers for the same offer
offerRevisionSchema.index(
  { offer_id: 1, revision_number: 1 },
  { unique: true },
);

// Statics
offerRevisionSchema.statics.getLatestRevision = function (offerId: string) {
  return this.findOne({ offer_id: offerId }).sort({ revision_number: -1 });
};

export const OfferRevision = mongoose.model<
  IOfferRevision,
  IOfferRevisionModel
>("OfferRevision", offerRevisionSchema, "offer_revisions");
