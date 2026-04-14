/**
 * Networks Home Feed Service
 *
 * Orchestrates three sections of the home feed:
 * - Recommended: User's favorited listings + popularity fallback
 * - Featured: Popularity-based listings (view_count + offers_count*2)
 * - Connections: Accepted connection users' listings
 *
 * All sections are Redis-cached with configurable TTLs.
 * Gracefully degrades if Redis unavailable.
 */

import { Types } from "mongoose";
import { cache } from "../../utils/cache";
import { DatabaseError } from "../../utils/errors";
import { INetworkListing, NetworkListing } from "../models/NetworkListing";
import { Favorite } from "../../models/Favorite";
import { Connection } from "../models/Connection";
import logger from "../../utils/logger";

interface HomeFeedResponse {
  recommended: INetworkListing[];
  featured: INetworkListing[];
  connections: INetworkListing[];
}

/**
 * Networks Home Feed Service
 *
 * Handles fetching and caching of home feed sections.
 * All caching is transparent - if Redis fails, falls back to DB.
 */
export class NetworksHomeFeedService {
  /**
   * Get complete home feed with all three sections
   * Executes all sections in parallel for speed
   */
  async getHomeFeed(
    dialistUserId: string,
    limit: number = 6,
  ): Promise<HomeFeedResponse> {
    try {
      // Execute all three sections in parallel
      const [recommended, featured, connections] = await Promise.all([
        this.getRecommended(dialistUserId, limit),
        this.getFeatured(limit),
        this.getConnections(dialistUserId, limit),
      ]);

      return {
        recommended,
        featured,
        connections,
      };
    } catch (error) {
      logger.error("Error fetching home feed:", error);
      throw new DatabaseError("Failed to fetch home feed");
    }
  }

  /**
   * Get recommended listings based on user's favorites
   *
   * Logic:
   * 1. Fetch user's favorited listings (for_sale type, networks platform)
   * 2. If <3 items, fill with popular listings from similar categories
   * 3. If still <1 item, fall back to most popular overall
   * 4. Always return 1-6 items (never empty)
   *
   * Cache: 3 minutes per user
   */
  async getRecommended(
    dialistUserId: string,
    limit: number = 6,
  ): Promise<INetworkListing[]> {
    const cacheKey = this.getRecommendedCacheKey(dialistUserId, limit);

    // Try cache first
    const cached = await this.getFromCache<INetworkListing[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }

    try {
      // Get user's favorites
      const favorites = await Favorite.find({
        user_id: new Types.ObjectId(dialistUserId),
        item_type: "for_sale",
        platform: "networks",
      }).select("item_id");

      const favoritedIds = favorites.map((f) => f.item_id);

      let recommendations: INetworkListing[] = [];

      // Step 2: Fetch the favorited listings themselves
      if (favoritedIds.length > 0) {
        recommendations = await NetworkListing.find({
          _id: { $in: favoritedIds },
          status: "active",
          is_deleted: { $ne: true },
        })
          .select(
            "_id title brand model thumbnail price condition status offers_count view_count author createdAt",
          )
          .lean()
          .limit(limit);
      }

      // Step 3: If <3 items, fill with popular from similar categories
      if (recommendations.length < 3) {
        const userCategories = await NetworkListing.find({
          dialist_id: new Types.ObjectId(dialistUserId),
        }).distinct("category");

        if (userCategories.length > 0) {
          const categoryFillCount = Math.min(
            limit - recommendations.length,
            limit,
          );
          const categoryListings = await NetworkListing.find({
            category: { $in: userCategories },
            _id: { $nin: [...favoritedIds] }, // Don't duplicate favorites
            status: "active",
            is_deleted: { $ne: true },
          })
            .select(
              "_id title brand model thumbnail price condition status offers_count view_count author createdAt",
            )
            .lean()
            .sort({ createdAt: -1 })
            .limit(categoryFillCount);

          recommendations = [...recommendations, ...categoryListings];
        }
      }

      // Step 4: If still <1 item, fall back to most popular overall
      if (recommendations.length < 1) {
        recommendations = await NetworkListing.aggregate([
          { $match: { status: "active", is_deleted: { $ne: true } } },
          {
            $addFields: {
              score: {
                $add: ["$view_count", { $multiply: ["$offers_count", 2] }],
              },
            },
          },
          { $sort: { score: -1, createdAt: -1 } },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              title: 1,
              brand: 1,
              model: 1,
              thumbnail: 1,
              price: 1,
              condition: 1,
              status: 1,
              offers_count: 1,
              view_count: 1,
              author: 1,
              createdAt: 1,
            },
          },
        ]);
      }

      // Cap at limit
      recommendations = recommendations.slice(0, limit);

      // Cache for 3 minutes
      await this.setInCache(cacheKey, recommendations, 180);

      return recommendations;
    } catch (error) {
      logger.error("Error fetching recommended listings:", error);
      return []; // Empty is acceptable; feed still works with featured/connections
    }
  }

  /**
   * Get featured listings based on popularity score
   *
   * Formula: score = view_count + (offers_count * 2)
   * Uses MongoDB aggregation (DB-optimized, not in-memory)
   * Tie-breaker: createdAt descending
   *
   * Cache: 5 minutes global (same for all users)
   */
  async getFeatured(limit: number = 6): Promise<INetworkListing[]> {
    const cacheKey = this.getFeaturedCacheKey(limit);

    // Try cache first
    const cached = await this.getFromCache<INetworkListing[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }

    try {
      const featured = await NetworkListing.aggregate([
        { $match: { status: "active", is_deleted: { $ne: true } } },
        {
          $addFields: {
            score: {
              $add: ["$view_count", { $multiply: ["$offers_count", 2] }],
            },
          },
        },
        { $sort: { score: -1, createdAt: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            title: 1,
            brand: 1,
            model: 1,
            thumbnail: 1,
            price: 1,
            condition: 1,
            status: 1,
            offers_count: 1,
            view_count: 1,
            author: 1,
            createdAt: 1,
          },
        },
      ]);

      // Cache for 5 minutes (global)
      await this.setInCache(cacheKey, featured, 300);

      return featured as INetworkListing[];
    } catch (error) {
      logger.error("Error fetching featured listings:", error);
      return [];
    }
  }

  /**
   * Get listings from user's accepted connections
   *
   * Logic:
   * 1. Find all connections where user is the follower and status="accepted"
   * 2. Extract the following_id (the users they connected to)
   * 3. Fetch active listings from those users
   * 4. Sort by createdAt descending, limit to 6
   * 5. Can be empty if user has no connections
   *
   * Cache: 2 minutes per user
   */
  async getConnections(
    dialistUserId: string,
    limit: number = 6,
  ): Promise<INetworkListing[]> {
    const cacheKey = this.getConnectionsCacheKey(dialistUserId, limit);

    // Try cache first
    const cached = await this.getFromCache<INetworkListing[]>(cacheKey);
    if (cached && Array.isArray(cached)) {
      return cached;
    }

    try {
      // Step 1: Get accepted connections where current user is the requester
      // follower_id = requester (the person who initiated contact)
      // following_id = target (the person being connected to)
      // We want people WE connected to: follower_id = us, extract following_id
      const acceptedConnections = await Connection.find({
        follower_id: new Types.ObjectId(dialistUserId),
        status: "accepted",
      }).select("following_id");

      if (acceptedConnections.length === 0) {
        // No connections; return empty and cache it
        await this.setInCache(cacheKey, [], 120);
        return [];
      }

      const followingIds = acceptedConnections.map((c) => c.following_id);

      // Step 2: Fetch listings from those users
      const connections = await NetworkListing.find({
        dialist_id: { $in: followingIds },
        status: "active",
        is_deleted: { $ne: true },
      })
        .select(
          "_id title brand model thumbnail price condition status offers_count view_count author createdAt",
        )
        .lean()
        .sort({ createdAt: -1 })
        .limit(limit);

      // Cache for 2 minutes
      await this.setInCache(cacheKey, connections, 120);

      return connections as INetworkListing[];
    } catch (error) {
      logger.error("Error fetching connection listings:", error);
      return [];
    }
  }

  /**
   * Invalidate all user-specific cache keys
   * Call when user's favorites or connections change
   */
  async invalidateUserCache(dialistUserId: string): Promise<void> {
    try {
      // Invalidate all limits for recommended and connections
      await Promise.all([
        cache.invalidatePattern(
          `home-feed:recommended:${dialistUserId}:limit:*`,
        ),
        cache.invalidatePattern(
          `home-feed:connections:${dialistUserId}:limit:*`,
        ),
      ]);

      logger.info(`Invalidated home feed cache for user ${dialistUserId}`);
    } catch (error) {
      logger.warn("Error invalidating user cache:", error);
    }
  }

  /**
   * Invalidate featured listings cache
   * Call when any listing's view_count or offers_count changes
   */
  async invalidateFeaturedCache(): Promise<void> {
    try {
      // Clear all featured cache entries regardless of limit
      await cache.invalidatePattern("home-feed:featured:limit:*");
      logger.info("Invalidated featured listings cache");
    } catch (error) {
      logger.warn("Error invalidating featured cache:", error);
    }
  }

  // ========================================
  // Private Cache Methods
  // ========================================

  /**
   * Get a typed value from cache with error handling
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      return await cache.get<T>(key);
    } catch (error) {
      logger.warn(`Cache get error for key "${key}":`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with error handling
   */
  private async setInCache(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await cache.set(key, value, ttlSeconds);
    } catch (error) {
      logger.warn(`Cache set error for key "${key}":`, error);
      // Non-blocking; feed continues to work without cache
    }
  }

  /**
   * Cache key generators
   */
  private getRecommendedCacheKey(
    dialistUserId: string,
    limit: number = 6,
  ): string {
    return `home-feed:recommended:${dialistUserId}:limit:${limit}`;
  }

  private getFeaturedCacheKey(limit: number = 6): string {
    return `home-feed:featured:limit:${limit}`;
  }

  private getConnectionsCacheKey(
    dialistUserId: string,
    limit: number = 6,
  ): string {
    return `home-feed:connections:${dialistUserId}:limit:${limit}`;
  }
}

export const networksHomeFeedService = new NetworksHomeFeedService();
