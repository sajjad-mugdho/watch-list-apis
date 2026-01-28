/**
 * Subscription Model
 *
 * Manages user subscriptions with Finix payment integration.
 * Supports different subscription tiers and billing cycles.
 */

import mongoose, { Document, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------

export const SUBSCRIPTION_STATUS_VALUES = [
  "active",
  "cancelled",
  "past_due",
  "expired",
  "trial",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_VALUES)[number];

export const SUBSCRIPTION_TIER_VALUES = [
  "free",
  "basic",
  "premium",
  "enterprise",
] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIER_VALUES)[number];

export const BILLING_CYCLE_VALUES = ["monthly", "yearly"] as const;
export type BillingCycle = (typeof BILLING_CYCLE_VALUES)[number];

// Tier configuration
export const TIER_CONFIG = {
  free: {
    name: "Free",
    price_monthly: 0,
    price_yearly: 0,
    features: {
      max_listings: 3,
      max_iso: 2,
      chat_enabled: true,
      analytics_enabled: false,
    },
  },
  basic: {
    name: "Basic",
    price_monthly: 999, // $9.99 in cents
    price_yearly: 9999, // $99.99 in cents
    features: {
      max_listings: 10,
      max_iso: 5,
      chat_enabled: true,
      analytics_enabled: true,
    },
  },
  premium: {
    name: "Premium",
    price_monthly: 2499, // $24.99 in cents
    price_yearly: 24999, // $249.99 in cents
    features: {
      max_listings: 50,
      max_iso: 20,
      chat_enabled: true,
      analytics_enabled: true,
      priority_support: true,
    },
  },
  enterprise: {
    name: "Enterprise",
    price_monthly: 9999, // $99.99 in cents
    price_yearly: 99999, // $999.99 in cents
    features: {
      max_listings: -1, // Unlimited
      max_iso: -1, // Unlimited
      chat_enabled: true,
      analytics_enabled: true,
      priority_support: true,
      custom_branding: true,
    },
  },
};

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------

export interface ISubscription extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  clerk_id: string;

  // Subscription details
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;

  // Finix integration
  finix_instrument_id?: string; // Payment instrument (card/bank)
  finix_authorization_id?: string; // Current billing authorization

  // Billing
  price_cents: number;
  currency: string;
  current_period_start: Date;
  current_period_end: Date;
  trial_end?: Date;

  // Cancellation
  cancel_at_period_end: boolean;
  cancelled_at?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Methods
  isActive(): boolean;
  isPaid(): boolean;
  getFeatures(): Record<string, any>;
  cancel(): Promise<ISubscription>;
  reactivate(): Promise<ISubscription>;
  upgradeTier(newTier: SubscriptionTier): Promise<ISubscription>;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------

const SubscriptionSchema = new Schema<ISubscription>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One subscription per user
      index: true,
    },
    clerk_id: {
      type: String,
      required: true,
      index: true,
    },
    tier: {
      type: String,
      enum: SUBSCRIPTION_TIER_VALUES,
      default: "free",
      index: true,
    },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUS_VALUES,
      default: "active",
      index: true,
    },
    billing_cycle: {
      type: String,
      enum: BILLING_CYCLE_VALUES,
      default: "monthly",
    },
    finix_instrument_id: {
      type: String,
      default: null,
    },
    finix_authorization_id: {
      type: String,
      default: null,
    },
    price_cents: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    current_period_start: {
      type: Date,
      default: () => new Date(),
    },
    current_period_end: {
      type: Date,
      default: () => {
        const end = new Date();
        end.setMonth(end.getMonth() + 1);
        return end;
      },
    },
    trial_end: {
      type: Date,
      default: null,
    },
    cancel_at_period_end: {
      type: Boolean,
      default: false,
    },
    cancelled_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Transform _id to string in JSON
SubscriptionSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.user_id = ret.user_id?.toString?.();
    return ret;
  },
});

// ----------------------------------------------------------
// Methods
// ----------------------------------------------------------

SubscriptionSchema.methods.isActive = function (): boolean {
  return (
    (this.status === "active" || this.status === "trial") &&
    this.current_period_end > new Date()
  );
};

SubscriptionSchema.methods.isPaid = function (): boolean {
  return this.tier !== "free";
};

SubscriptionSchema.methods.getFeatures = function () {
  return TIER_CONFIG[this.tier as SubscriptionTier]?.features || TIER_CONFIG.free.features;
};

SubscriptionSchema.methods.cancel = async function (): Promise<ISubscription> {
  this.cancel_at_period_end = true;
  this.cancelled_at = new Date();
  return this.save();
};

SubscriptionSchema.methods.reactivate = async function (): Promise<ISubscription> {
  if (this.current_period_end > new Date()) {
    this.cancel_at_period_end = false;
    this.cancelled_at = null;
    this.status = "active";
    return this.save();
  }
  throw new Error("Subscription period has ended, please renew");
};

SubscriptionSchema.methods.upgradeTier = async function (
  newTier: SubscriptionTier
): Promise<ISubscription> {
  const tierOrder = SUBSCRIPTION_TIER_VALUES;
  const currentIndex = tierOrder.indexOf(this.tier);
  const newIndex = tierOrder.indexOf(newTier);

  if (newIndex <= currentIndex) {
    throw new Error("Can only upgrade to a higher tier");
  }

  const tierConfig = TIER_CONFIG[newTier];
  this.tier = newTier;
  this.price_cents =
    this.billing_cycle === "yearly"
      ? tierConfig.price_yearly
      : tierConfig.price_monthly;

  return this.save();
};

// ----------------------------------------------------------
// Statics
// ----------------------------------------------------------

interface ISubscriptionModel extends mongoose.Model<ISubscription> {
  getByUserId(userId: string): Promise<ISubscription | null>;
  getActiveSubscriptions(): Promise<ISubscription[]>;
  getExpiringSoon(days: number): Promise<ISubscription[]>;
}

SubscriptionSchema.statics.getByUserId = async function (
  userId: string
): Promise<ISubscription | null> {
  return this.findOne({ user_id: userId });
};

SubscriptionSchema.statics.getActiveSubscriptions = async function (): Promise<
  ISubscription[]
> {
  return this.find({
    status: { $in: ["active", "trial"] },
    current_period_end: { $gt: new Date() },
  });
};

SubscriptionSchema.statics.getExpiringSoon = async function (
  days: number = 7
): Promise<ISubscription[]> {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return this.find({
    status: "active",
    current_period_end: { $lte: futureDate, $gt: new Date() },
    cancel_at_period_end: false,
  });
};

export const Subscription = mongoose.model<ISubscription, ISubscriptionModel>(
  "Subscription",
  SubscriptionSchema,
  "subscriptions"
);

export default Subscription;
