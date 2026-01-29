/**
 * Review Service
 * 
 * Business logic for the review/rating system
 * Handles review creation, validation, and user stats updates
 */

import { Types } from "mongoose";
import { Review, IReview, ReviewRole } from "../../models/Review";
import { User } from "../../models/User";
import { Order } from "../../models/Order";
import { NotificationService } from "../notification/NotificationService";
import logger from "../../utils/logger";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export interface CreateReviewInput {
  reviewer_id: string;
  order_id: string;
  rating: number;
  feedback: string;
  is_anonymous?: boolean;
}

export interface ReviewSummary {
  avg_rating: number;
  rating_count: number;
  review_count_as_buyer: number;
  review_count_as_seller: number;
  breakdown: { [key: number]: number };
}

// ----------------------------------------------------------
// Service Class
// ----------------------------------------------------------

export class ReviewService {
  private notificationService: NotificationService;
  
  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }
  
  /**
   * Create a review for a completed order
   * Validates eligibility and updates user stats
   */
  async createReview(input: CreateReviewInput): Promise<IReview> {
    const { reviewer_id, order_id, rating, feedback, is_anonymous = false } = input;
    
    // Validate order exists and is completed
    const order = await Order.findById(order_id);
    if (!order) {
      throw new Error("Order not found");
    }
    
    // Check order status allows review (must be delivered or completed)
    const reviewableStatuses = ["delivered", "completed"];
    if (!reviewableStatuses.includes(order.status)) {
      throw new Error(`Cannot review order with status: ${order.status}. Order must be delivered or completed.`);
    }
    
    // Determine reviewer's role and target user
    const buyerId = order.buyer_id.toString();
    const sellerId = order.seller_id.toString();
    
    let role: ReviewRole;
    let target_user_id: string;
    
    if (reviewer_id === buyerId) {
      role = "buyer";
      target_user_id = sellerId;
    } else if (reviewer_id === sellerId) {
      role = "seller";
      target_user_id = buyerId;
    } else {
      throw new Error("You are not a participant of this order");
    }
    
    // Check if already reviewed
    const hasReviewed = await Review.hasReviewed(order_id, reviewer_id);
    if (hasReviewed) {
      throw new Error("You have already reviewed this order");
    }
    
    // Create the review
    const review = await Review.create({
      reviewer_id: new Types.ObjectId(reviewer_id),
      target_user_id: new Types.ObjectId(target_user_id),
      order_id: new Types.ObjectId(order_id),
      listing_id: order.listing_id || null,
      role,
      rating,
      feedback,
      is_anonymous,
    });
    
    // Update target user's stats atomically
    await this.atomicIncrementUserStats(target_user_id, rating, role);
    
    // Send notification to target user
    try {
      await this.notificationService.create({
        userId: target_user_id,
        type: "review_received",
        title: "New Review Received",
        body: is_anonymous 
          ? `You received a ${rating}-star review from a buyer`
          : `You received a ${rating}-star review`,
        data: {
          review_id: review._id.toString(),
          order_id: order_id,
          rating,
        },
      });
    } catch (err) {
      logger.warn("Failed to send review notification", { err, review_id: review._id });
    }
    
    logger.info("Review created", {
      review_id: review._id,
      reviewer_id,
      target_user_id,
      order_id,
      rating,
    });
    
    return review;
  }
  
  /**
   * Get reviews for a user
   */
  async getReviewsForUser(
    userId: string,
    options: {
      role?: ReviewRole | undefined;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ reviews: any[]; total: number }> {
    const { role, limit = 20, offset = 0 } = options;
    
    const query: Record<string, any> = {
      target_user_id: typeof userId === "string" ? new Types.ObjectId(userId) : userId,
    };
    
    if (role) {
      // Filter by reviewer's role (e.g., show only reviews from buyers)
      query.role = role;
    }
    
    const [reviews, total] = await Promise.all([
      Review.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("reviewer_id", "display_name avatar")
        .lean(),
      Review.countDocuments(query),
    ]);
    
    return {
      reviews,
      total,
    };
  }
  
  /**
   * Get reviews written by a user
   */
  async getReviewsByUser(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ reviews: any[]; total: number }> {
    const { limit = 20, offset = 0 } = options;
    
    const query = {
      reviewer_id: new Types.ObjectId(userId),
    };
    
    const [reviews, total] = await Promise.all([
      Review.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("target_user_id", "display_name avatar")
        .lean(),
      Review.countDocuments(query),
    ]);
    
    return {
      reviews,
      total,
    };
  }
  
  /**
   * Get rating summary for a user
   */
  async getReviewSummary(userId: string): Promise<ReviewSummary> {
    return Review.getRatingSummary(userId);
  }
  
  /**
   * Update user's cached stats atomically after a new review
   * Uses MongoDB aggregation pipeline in update to avoid race conditions
   */
  async atomicIncrementUserStats(userId: string, rating: number, role: ReviewRole): Promise<void> {
    const roleField = role === "buyer" ? "stats.review_count_as_buyer" : "stats.review_count_as_seller";
    
    await User.findByIdAndUpdate(userId, [
      {
        $set: {
          "stats.rating_count": { $add: [{ $ifNull: ["$stats.rating_count", 0] }, 1] },
          "stats.rating_sum": { $add: [{ $ifNull: ["$stats.rating_sum", 0] }, rating] },
          [roleField]: { $add: [{ $ifNull: [`$${roleField}`, 0] }, 1] }
        }
      },
      {
        $set: {
          "stats.avg_rating": {
             $cond: [
               { $lte: [{ $ifNull: ["$stats.rating_count", 0] }, 0] },
               0,
               { $divide: [
                 { $ifNull: ["$stats.rating_sum", 0] }, 
                 { $ifNull: ["$stats.rating_count", 1] }
               ]}
             ]
          }
        }
      }
    ]);

    logger.info("User stats updated atomically", { userId, rating, role });
  }

  /**
   * Legacy update method - kept for full re-sync capability (drift correction)
   */
  async recomputeUserStats(userId: string): Promise<void> {
    const summary = await Review.getRatingSummary(userId);
    
    await User.findByIdAndUpdate(userId, {
      $set: {
        "stats.avg_rating": summary.avg_rating,
        "stats.rating_count": summary.rating_count,
        "stats.rating_sum": summary.rating_sum, // Use accurate sum from aggregation
        "stats.review_count_as_buyer": summary.review_count_as_buyer,
        "stats.review_count_as_seller": summary.review_count_as_seller,
      },
    });
    
    logger.info("User stats recomputed from source", { userId, summary });
  }
  
  /**
   * Send review reminder for completed order
   * Called when order status changes to "delivered"
   */
  async sendReviewReminder(orderId: string): Promise<void> {
    const order = await Order.findById(orderId);
    if (!order) {
      logger.warn("Order not found for review reminder", { orderId });
      return;
    }
    
    const buyerId = order.buyer_id.toString();
    
    // Check if buyer has already reviewed
    const hasReviewed = await Review.hasReviewed(orderId, buyerId);
    if (hasReviewed) {
      logger.info("Buyer already reviewed, skipping reminder", { orderId, buyerId });
      return;
    }
    
    try {
      await this.notificationService.create({
        userId: buyerId,
        type: "review_reminder",
        title: "How was your purchase?",
        body: "Leave a review for your recent purchase to help other buyers",
        data: {
          order_id: orderId,
        },
      });
      
      logger.info("Review reminder sent", { orderId, buyerId });
    } catch (err) {
      logger.warn("Failed to send review reminder", { err, orderId });
    }
  }
}

// ----------------------------------------------------------
// Export singleton
// ----------------------------------------------------------

export const reviewService = new ReviewService();
