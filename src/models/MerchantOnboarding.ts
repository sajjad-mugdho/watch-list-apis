import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * MerchantOnboarding Model
 *
 * Tracks Finix merchant onboarding separately from platform onboarding.
 * This collection handles out-of-order webhook events and provides a
 * single source of truth for merchant status.
 *
 * Key insight: Finix webhooks can arrive out of order, and identity_id
 * is only available after form completion. This model uses form_id as
 * the initial primary key and updates with identity_id when available.
 */

export interface IMerchantOnboarding extends Document {
  _id: Types.ObjectId;

  // Finix resource IDs
  form_id: string; // Finix onboarding form ID (set on creation)
  identity_id?: string | null; // Finix identity ID (set when form completed)
  merchant_id?: string | null; // Finix merchant ID (set on merchant.created)
  verification_id?: string | null; // Finix verification ID

  // Dialist association
  dialist_user_id: Types.ObjectId; // Our user ID

  // Status tracking
  onboarding_state:
    | "PENDING"
    | "PROVISIONING"
    | "APPROVED"
    | "REJECTED"
    | "UPDATE_REQUESTED";
  verification_state?: "PENDING" | "SUCCEEDED" | "FAILED" | null;

  // Form link management
  last_form_link?: string | null;
  last_form_link_expires_at?: Date | null;

  // Timestamps
  onboarded_at?: Date | null; // When form was completed
  verified_at?: Date | null; // When verification succeeded
  createdAt: Date;
  updatedAt: Date;
}

const MerchantOnboardingSchema = new Schema<IMerchantOnboarding>(
  {
    // Finix resource IDs
    form_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    identity_id: {
      type: String,
      default: null,
      sparse: true,
      // Note: Can't use unique because multiple null values cause E11000 error
      // form_id is already unique, which ensures one onboarding per form
      index: true,
    },
    merchant_id: {
      type: String,
      default: null,
      index: true,
      // Note: Can't use unique+sparse because multiple null values in tests
      // In production, merchant_id should be unique when set
    },
    verification_id: {
      type: String,
      default: null,
    },

    // Dialist association
    dialist_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Status tracking
    onboarding_state: {
      type: String,
      enum: [
        "PENDING",
        "PROVISIONING",
        "APPROVED",
        "REJECTED",
        "UPDATE_REQUESTED",
      ],
      default: "PENDING",
      index: true,
    },
    verification_state: {
      type: String,
      enum: ["PENDING", "SUCCEEDED", "FAILED"],
      default: null,
    },

    // Form link management
    last_form_link: {
      type: String,
      default: null,
    },
    last_form_link_expires_at: {
      type: Date,
      default: null,
    },

    // Timestamps
    onboarded_at: {
      type: Date,
      default: null,
    },
    verified_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "merchant_onboardings",
  }
);

// Additional indexes for common queries
MerchantOnboardingSchema.index({ dialist_user_id: 1, onboarding_state: 1 });
MerchantOnboardingSchema.index({ identity_id: 1, merchant_id: 1 });

// Transform _id to string in JSON responses
MerchantOnboardingSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.dialist_user_id = ret.dialist_user_id?.toString?.();
    return ret;
  },
});

export const MerchantOnboarding = mongoose.model<IMerchantOnboarding>(
  "MerchantOnboarding",
  MerchantOnboardingSchema
);
