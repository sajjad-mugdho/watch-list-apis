/**
 * Review Model
 * 
 * Post-transaction ratings and feedback system
 * Distinct from ReferenceCheck which is for pre-sale vouching
 * 
 * Flow:
 * 1. Order.status → "delivered" triggers review_reminder notification
 * 2. User calls POST /reviews with rating + feedback
 * 3. User.stats.avg_rating updates automatically
 */

import mongoose, { Document, Schema, Types, Model } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------

export const REVIEW_ROLE_VALUES = ["buyer", "seller"] as const;
export type ReviewRole = (typeof REVIEW_ROLE_VALUES)[number];

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------

export interface IReview extends Document {
  _id: Types.ObjectId;
  
  // Participants
  reviewer_id: Types.ObjectId;       // User leaving the review
  target_user_id: Types.ObjectId;    // User being reviewed
  
  // Context
  order_id: Types.ObjectId;          // Related transaction (required)
  listing_id?: Types.ObjectId | null; // Related listing (optional)
  role: ReviewRole;                   // Reviewer's role in transaction
  
  // Content
  rating: number;                    // 1-5 stars
  feedback: string;                  // Review text (required, 10-1000 chars)
  
  // Options
  is_anonymous: boolean;             // Hide reviewer name from display
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IReviewModel extends Model<IReview> {
  /**
   * Get rating summary for a user
   */
  getRatingSummary(userId: string | Types.ObjectId): Promise<{
    avg_rating: number;
    rating_count: number;
    rating_sum: number; // Accurate sum for persistence (no rounding issues)
    review_count_as_buyer: number;
    review_count_as_seller: number;
    breakdown: { [key: number]: number }; // { 1: 2, 2: 0, 3: 5, 4: 10, 5: 15 }
  }>;
  
  /**
   * Check if user has already reviewed an order
   */
  hasReviewed(orderId: string | Types.ObjectId, reviewerId: string | Types.ObjectId): Promise<boolean>;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------

const ReviewSchema = new Schema<IReview>(
  {
    reviewer_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    target_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    listing_id: {
      type: Schema.Types.ObjectId,
      ref: "NetworkListing",
      default: null,
    },
    role: {
      type: String,
      enum: REVIEW_ROLE_VALUES,
      required: true,
    },
    rating: {
      type: Number,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating must be at most 5"],
      required: true,
    },
    feedback: {
      type: String,
      required: true,
      trim: true,
      minlength: [10, "Feedback must be at least 10 characters"],
      maxlength: [1000, "Feedback must be at most 1000 characters"],
    },
    is_anonymous: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ----------------------------------------------------------
// Indexes
// ----------------------------------------------------------

// One review per order per reviewer (prevent duplicate reviews)
ReviewSchema.index({ order_id: 1, reviewer_id: 1 }, { unique: true });

// For fetching reviews about a user (profile page)
ReviewSchema.index({ target_user_id: 1, createdAt: -1 });

// For rating aggregation queries
ReviewSchema.index({ target_user_id: 1, rating: 1 });

// For finding reviews by a specific reviewer
ReviewSchema.index({ reviewer_id: 1, createdAt: -1 });

// ----------------------------------------------------------
// Static Methods
// ----------------------------------------------------------

/**
 * Get rating summary for a user
 */
ReviewSchema.statics.getRatingSummary = async function(
  userId: string | Types.ObjectId
): Promise<{
  avg_rating: number;
  rating_count: number;
  rating_sum: number; // Accurate sum for persistence (no rounding issues)
  review_count_as_buyer: number;
  review_count_as_seller: number;
  breakdown: { [key: number]: number };
}> {
  const objectId = typeof userId === "string" ? new Types.ObjectId(userId) : userId;
  
  const result = await this.aggregate([
    { $match: { target_user_id: objectId } },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              avg_rating: { $avg: "$rating" },
              rating_count: { $sum: 1 },
              rating_sum: { $sum: "$rating" }, // Accurate sum for persistence
            },
          },
        ],
        roleBreakdown: [
          {
            $group: {
              _id: "$role",
              count: { $sum: 1 },
            },
          },
        ],
        ratingBreakdown: [
          {
            $group: {
              _id: "$rating",
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]).exec();
  
  const summary = result[0]?.summary[0] || { avg_rating: 0, rating_count: 0, rating_sum: 0 };
  const roleBreakdown = result[0]?.roleBreakdown || [];
  const ratingBreakdown = result[0]?.ratingBreakdown || [];
  
  // Build role counts
  const review_count_as_buyer = roleBreakdown.find(
    (r: { _id: string; count: number }) => r._id === "buyer"
  )?.count || 0;
  const review_count_as_seller = roleBreakdown.find(
    (r: { _id: string; count: number }) => r._id === "seller"
  )?.count || 0;
  
  // Build rating breakdown object { 1: n, 2: n, 3: n, 4: n, 5: n }
  const breakdown: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratingBreakdown.forEach((r: { _id: number; count: number }) => {
    if (r._id >= 1 && r._id <= 5) {
      breakdown[r._id] = r.count;
    }
  });
  
  return {
    avg_rating: Math.round((summary.avg_rating || 0) * 10) / 10, // Round to 1 decimal for display
    rating_count: summary.rating_count || 0,
    rating_sum: summary.rating_sum || 0, // Accurate sum for persistence
    review_count_as_buyer,
    review_count_as_seller,
    breakdown,
  };
};

/**
 * Check if user has already reviewed an order
 */
ReviewSchema.statics.hasReviewed = async function(
  orderId: string | Types.ObjectId,
  reviewerId: string | Types.ObjectId
): Promise<boolean> {
  const orderObjectId = typeof orderId === "string" ? new Types.ObjectId(orderId) : orderId;
  const reviewerObjectId = typeof reviewerId === "string" ? new Types.ObjectId(reviewerId) : reviewerId;
  
  const existing = await this.findOne({
    order_id: orderObjectId,
    reviewer_id: reviewerObjectId,
  }).lean();
  
  return !!existing;
};

// ----------------------------------------------------------
// Transform
// ----------------------------------------------------------

ReviewSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.reviewer_id = ret.reviewer_id?.toString?.();
    ret.target_user_id = ret.target_user_id?.toString?.();
    ret.order_id = ret.order_id?.toString?.();
    ret.listing_id = ret.listing_id?.toString?.() || null;
    return ret;
  },
});

// ----------------------------------------------------------
// Export
// ----------------------------------------------------------

export const Review = mongoose.model<IReview, IReviewModel>(
  "Review",
  ReviewSchema,
  "reviews"
);
