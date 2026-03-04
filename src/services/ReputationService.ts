import { Types } from "mongoose";
import { User } from "../../models/User";
import { Review } from "../../models/Review";
import { Vouch } from "../../models/Vouch";
import logger from "../../utils/logger";

export interface UserReputation {
  rating_average: number;
  rating_count: number;
  reference_count: number;
  breakdown: { [key: number]: number };
}

export class ReputationService {
  /**
   * Recalculate and persist reputation metrics for a user
   * Aggregates from:
   * 1. Star-based Reviews (post-transaction)
   * 2. Community Vouches (social references)
   */
  async refreshUserReputation(userId: string): Promise<UserReputation> {
    const objectId = new Types.ObjectId(userId);

    try {
      // 1. Get Star Rating Summary
      const reviewSummary = await Review.getRatingSummary(objectId);

      // 2. Get Vouch/Reference Count
      const referenceCount = await Vouch.countDocuments({
        vouched_for_user_id: objectId,
      });

      // 3. Update User Document
      await User.findByIdAndUpdate(objectId, {
        rating_average: reviewSummary.avg_rating,
        rating_count: reviewSummary.rating_count,
        reference_count: referenceCount,
      });

      logger.info("User reputation refreshed", {
        userId,
        avg: reviewSummary.avg_rating,
        count: reviewSummary.rating_count,
        refs: referenceCount,
      });

      return {
        rating_average: reviewSummary.avg_rating,
        rating_count: reviewSummary.rating_count,
        reference_count: referenceCount,
        breakdown: reviewSummary.breakdown,
      };
    } catch (error) {
      logger.error("Failed to refresh user reputation", { userId, error });
      throw error;
    }
  }

  /**
   * Get current reputation for display
   */
  async getReputation(userId: string): Promise<UserReputation> {
    const user = await User.findById(userId).select("rating_average rating_count reference_count").lean();
    
    // Breakdown is only needed on the profile page, so we fetch it on demand
    const reviewSummary = await Review.getRatingSummary(userId);

    return {
      rating_average: user?.rating_average || 0,
      rating_count: user?.rating_count || 0,
      reference_count: user?.reference_count || 0,
      breakdown: reviewSummary.breakdown,
    };
  }
}

export const reputationService = new ReputationService();
