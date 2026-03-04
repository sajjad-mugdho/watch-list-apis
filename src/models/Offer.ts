import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------
export const OFFER_STATE_VALUES = [
  "CREATED",
  "COUNTERED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type OfferState = (typeof OFFER_STATE_VALUES)[number];

// ----------------------------------------------------------
// Interfaces
// ----------------------------------------------------------
export interface IOffer extends Document {
  listing_id: Types.ObjectId;
  channel_id: Types.ObjectId;
  buyer_id: Types.ObjectId;
  seller_id: Types.ObjectId;
  platform: "marketplace" | "networks";
  
  getstream_channel_id?: string;
  state: OfferState;
  expires_at: Date;
  
  active_revision_id?: Types.ObjectId;
  
  listing_snapshot?: {
    brand: string;
    model: string;
    reference: string;
    price?: number;
    condition?: string;
    thumbnail?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;

  // Methods
  isActive(): boolean;
  isExpired(): boolean;
  canBeAccepted(): boolean;
}

export interface IOfferModel extends Model<IOffer> {
  findExpiredOffers(platform?: string): Promise<IOffer[]>;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------
const offerSchema = new Schema<IOffer>(
  {
    listing_id: { type: Schema.Types.ObjectId, required: true, index: true },
    channel_id: { type: Schema.Types.ObjectId, required: true, index: true },
    buyer_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    seller_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    platform: { type: String, enum: ["marketplace", "networks"], required: true, index: true },
    
    getstream_channel_id: { type: String, index: true },
    state: { type: String, enum: OFFER_STATE_VALUES, default: "CREATED", index: true },
    expires_at: { type: Date, required: true, index: true },
    
    active_revision_id: { type: Schema.Types.ObjectId, ref: "OfferRevision" },
    
    listing_snapshot: {
      brand: { type: String },
      model: { type: String },
      reference: { type: String },
      price: { type: Number },
      condition: { type: String },
      thumbnail: { type: String },
    },
  },
  { timestamps: true }
);

// Methods
offerSchema.methods.isActive = function (): boolean {
  return (this.state === "CREATED" || this.state === "COUNTERED") && !this.isExpired();
};

offerSchema.methods.isExpired = function (): boolean {
  return this.expires_at <= new Date();
};

offerSchema.methods.canBeAccepted = function (): boolean {
  return this.isActive();
};

// Statics
offerSchema.statics.findExpiredOffers = function (platform?: string) {
  const query: any = {
    state: { $in: ["CREATED", "COUNTERED"] },
    expires_at: { $lt: new Date() },
  };
  if (platform) query.platform = platform;
  return this.find(query);
};

export const Offer = mongoose.model<IOffer, IOfferModel>("Offer", offerSchema, "offers");
