/**
 * FeedService - GetStream Activity Feeds Integration
 *
 * Handles all Stream Feeds operations including:
 * - Follow/unfollow relationships
 * - Activity creation for listings, ISOs, reference checks
 * - Timeline feed retrieval
 * - User feed management
 */

import { connect, StreamClient } from "getstream";
import { config } from "../config";
import logger from "../utils/logger";

// Types for feed operations
export interface FeedActivity {
  actor: string;
  verb: string;
  object: string;
  foreign_id?: string;
  time?: string;
  // Custom fields
  type?: string;
  title?: string;
  thumbnail?: string;
  price?: number;
  extra?: Record<string, any>;
}

export interface ActivityWithId extends FeedActivity {
  id: string;
}

class FeedService {
  private client: StreamClient;
  private initialized: boolean = false;

  constructor() {
    this.client = connect(
      config.getstreamApiKey,
      config.getstreamApiSecret,
      config.getstreamAppId
    );
  }

  /**
   * Ensure the Stream client is ready
   */
  private ensureConnected(): void {
    if (!this.initialized) {
      this.initialized = true;
      logger.info("Stream Feeds client initialized");
    }
  }

  /**
   * Get a user's timeline feed (aggregated activities from followed users)
   *
   * @param userId - The user ID
   * @param limit - Number of activities to return
   * @param offset - Offset for pagination
   */
  async getTimeline(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ActivityWithId[]> {
    this.ensureConnected();

    try {
      const timelineFeed = this.client.feed("timeline", userId);
      const response = await timelineFeed.get({ limit, offset });

      return (response.results as any[]).map((activity) => ({
        id: activity.id,
        actor: activity.actor,
        verb: activity.verb,
        object: activity.object,
        foreign_id: activity.foreign_id,
        time: activity.time,
        type: activity.type,
        title: activity.title,
        thumbnail: activity.thumbnail,
        price: activity.price,
        extra: activity.extra,
      }));
    } catch (error) {
      logger.error("Failed to get timeline feed", { userId, error });
      throw error;
    }
  }

  /**
   * Get a user's own feed (their activities)
   *
   * @param userId - The user ID
   * @param limit - Number of activities to return
   * @param offset - Offset for pagination
   */
  async getUserFeed(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ActivityWithId[]> {
    this.ensureConnected();

    try {
      const userFeed = this.client.feed("user", userId);
      const response = await userFeed.get({ limit, offset });

      return (response.results as any[]).map((activity) => ({
        id: activity.id,
        actor: activity.actor,
        verb: activity.verb,
        object: activity.object,
        foreign_id: activity.foreign_id,
        time: activity.time,
        type: activity.type,
        title: activity.title,
        thumbnail: activity.thumbnail,
        price: activity.price,
        extra: activity.extra,
      }));
    } catch (error) {
      logger.error("Failed to get user feed", { userId, error });
      throw error;
    }
  }

  /**
   * Add an activity to a user's feed
   *
   * @param userId - User who performed the action
   * @param activity - Activity data
   */
  async addActivity(
    userId: string,
    activity: Omit<FeedActivity, "actor">
  ): Promise<ActivityWithId> {
    this.ensureConnected();

    try {
      const userFeed = this.client.feed("user", userId);

      const result = await userFeed.addActivity({
        actor: `user:${userId}`,
        ...activity,
      } as any);

      logger.info("Activity added to feed", {
        userId,
        verb: activity.verb,
        object: activity.object,
      });

      return {
        id: result.id,
        actor: `user:${userId}`,
        ...activity,
      };
    } catch (error) {
      logger.error("Failed to add activity", { userId, activity, error });
      throw error;
    }
  }

  /**
   * Add a listing activity when a user publishes a listing
   *
   * @param userId - User ID
   * @param listingId - Listing ID
   * @param listingData - Listing details
   */
  async addListingActivity(
    userId: string,
    listingId: string,
    listingData: {
      title: string;
      price: number;
      thumbnail?: string;
      brand?: string;
      model?: string;
    }
  ): Promise<ActivityWithId> {
    return this.addActivity(userId, {
      verb: "post",
      object: `listing:${listingId}`,
      foreign_id: `listing:${listingId}`,
      type: "listing",
      title: listingData.title,
      price: listingData.price,
      ...(listingData.thumbnail && { thumbnail: listingData.thumbnail }),
      extra: {
        brand: listingData.brand,
        model: listingData.model,
      },
    });
  }

  /**
   * Add an ISO activity when a user creates an ISO
   *
   * @param userId - User ID
   * @param isoId - ISO ID
   * @param isoData - ISO details
   */
  async addISOActivity(
    userId: string,
    isoId: string,
    isoData: {
      criteria: string;
      urgency: string;
    }
  ): Promise<ActivityWithId> {
    return this.addActivity(userId, {
      verb: "post",
      object: `iso:${isoId}`,
      foreign_id: `iso:${isoId}`,
      type: "iso",
      title: `Looking for: ${isoData.criteria}`,
      extra: {
        urgency: isoData.urgency,
      },
    });
  }

  /**
   * Add a reference check activity
   *
   * @param userId - User who initiated the check
   * @param checkId - Reference check ID
   * @param targetUserId - User being checked
   */
  async addReferenceCheckActivity(
    userId: string,
    checkId: string,
    targetUserId: string
  ): Promise<ActivityWithId> {
    return this.addActivity(userId, {
      verb: "request",
      object: `reference_check:${checkId}`,
      foreign_id: `reference_check:${checkId}`,
      type: "reference_check",
      title: "Reference check initiated",
      extra: {
        target_user: targetUserId,
      },
    });
  }

  /**
   * Follow a user - subscribe the follower's timeline to the target's user feed
   *
   * @param followerId - User who is following
   * @param targetId - User being followed
   */
  async follow(followerId: string, targetId: string): Promise<void> {
    this.ensureConnected();

    try {
      const timelineFeed = this.client.feed("timeline", followerId);
      await timelineFeed.follow("user", targetId);

      logger.info("User followed", { followerId, targetId });
    } catch (error) {
      logger.error("Failed to follow user", { followerId, targetId, error });
      throw error;
    }
  }

  /**
   * Unfollow a user - unsubscribe from their feed
   *
   * @param followerId - User who is unfollowing
   * @param targetId - User being unfollowed
   */
  async unfollow(followerId: string, targetId: string): Promise<void> {
    this.ensureConnected();

    try {
      const timelineFeed = this.client.feed("timeline", followerId);
      await timelineFeed.unfollow("user", targetId);

      logger.info("User unfollowed", { followerId, targetId });
    } catch (error) {
      logger.error("Failed to unfollow user", { followerId, targetId, error });
      throw error;
    }
  }

  /**
   * Get list of users that a user is following
   *
   * @param userId - User ID
   * @param limit - Number of results
   * @param offset - Offset for pagination
   */
  async getFollowing(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ feed_id: string; target_id: string }[]> {
    this.ensureConnected();

    try {
      const timelineFeed = this.client.feed("timeline", userId);
      const response = await timelineFeed.following({ limit, offset });

      return response.results.map((item: any) => ({
        feed_id: item.feed_id,
        target_id: item.target_id.replace("user:", ""),
      }));
    } catch (error) {
      logger.error("Failed to get following list", { userId, error });
      throw error;
    }
  }

  /**
   * Get list of followers for a user
   *
   * @param userId - User ID
   * @param limit - Number of results
   * @param offset - Offset for pagination
   */
  async getFollowers(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ feed_id: string; user_id: string }[]> {
    this.ensureConnected();

    try {
      const userFeed = this.client.feed("user", userId);
      const response = await userFeed.followers({ limit, offset });

      return response.results.map((item: any) => ({
        feed_id: item.feed_id,
        user_id: item.feed_id.replace("timeline:", ""),
      }));
    } catch (error) {
      logger.error("Failed to get followers list", { userId, error });
      throw error;
    }
  }

  /**
   * Generate a feed token for client-side access
   *
   * @param userId - User ID
   * @param readOnly - Whether the token is read-only
   */
  createUserToken(userId: string, _readOnly: boolean = false): string {
    // Note: readOnly parameter reserved for future use with scoped tokens
    return this.client.createUserToken(userId) as any;
  }

  /**
   * Remove an activity from a user's feed
   *
   * @param userId - User ID
   * @param foreignId - Foreign ID of the activity to remove
   */
  async removeActivity(userId: string, foreignId: string): Promise<void> {
    this.ensureConnected();

    try {
      const userFeed = this.client.feed("user", userId);
      await userFeed.removeActivity({ foreign_id: foreignId } as any);

      logger.info("Activity removed", { userId, foreignId });
    } catch (error) {
      logger.error("Failed to remove activity", { userId, foreignId, error });
      throw error;
    }
  }
}

// Export singleton instance
export const feedService = new FeedService();
export default feedService;
