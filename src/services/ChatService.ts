/**
 * ChatService - GetStream Chat Integration
 *
 * Handles all Stream Chat operations including:
 * - User token generation for client authentication
 * - Channel creation/retrieval for buyer-seller conversations
 * - System message sending for offer/order notifications
 * - User presence and sync with Stream
 *
 * Architecture Notes:
 * - Backend acts as controller; Stream handles real-time delivery
 * - All channel IDs are deterministic hashes for idempotency
 * - Channel data is cached in-memory for performance
 * - Failures are logged with metrics for monitoring
 */

import { StreamChat, Channel } from "stream-chat";
import { config } from "../config";
import logger from "../utils/logger";
import crypto from "crypto";

// ============================================================
// VALIDATION HELPERS (Aman's suggestion: input validation)
// ============================================================

function validateUserId(userId: string, fieldName: string = "userId"): void {
  if (!userId || typeof userId !== "string") {
    throw new Error(`${fieldName} is required and must be a non-empty string`);
  }
  // MongoDB ObjectId format or Clerk ID format
  if (userId.length < 10 || userId.length > 64) {
    throw new Error(`${fieldName} must be between 10 and 64 characters`);
  }
}

function validateChannelId(channelId: string): void {
  if (!channelId || typeof channelId !== "string") {
    throw new Error("channelId is required and must be a non-empty string");
  }
  // MD5 hex hash is 32 chars
  if (!/^[a-f0-9]{32}$/.test(channelId)) {
    throw new Error("channelId must be a valid 32-character hex string");
  }
}

function validateMetadata(metadata: ChatChannelMetadata): void {
  if (!metadata || typeof metadata !== "object") {
    throw new Error("metadata is required and must be an object");
  }
  if (!metadata.listing_id || typeof metadata.listing_id !== "string") {
    throw new Error("metadata.listing_id is required");
  }
}

// ============================================================
// TYPES
// ============================================================

export interface ChatUserData {
  id: string;
  name: string;
  avatar?: string;
}

export interface ChatChannelMetadata {
  listing_id: string;
  listing_title?: string;
  listing_price?: number;
  listing_thumbnail?: string;
}

export interface SystemMessageData {
  type:
    | "offer"
    | "counter_offer"
    | "offer_accepted"
    | "offer_rejected"
    | "order_created"
    | "order_paid"
    | "order_shipped"
    | "order_completed"
    | "listing_reserved"
    | "listing_sold"
    | "reference_check_initiated"
    | "offer_expired"
    | "inquiry";
  amount?: number;
  offer_id?: string;
  order_id?: string;
  message?: string;
}

// ============================================================
// CHANNEL CACHE (Aman's suggestion: caching for performance)
// ============================================================

interface CachedChannel {
  channel: Channel;
  cachedAt: number;
}

// Simple in-memory cache with TTL (5 minutes)
const CHANNEL_CACHE_TTL_MS = 5 * 60 * 1000;
const channelCache = new Map<string, CachedChannel>();

function getCachedChannel(channelId: string): Channel | null {
  const cached = channelCache.get(channelId);
  if (!cached) return null;
  
  // Check if expired
  if (Date.now() - cached.cachedAt > CHANNEL_CACHE_TTL_MS) {
    channelCache.delete(channelId);
    return null;
  }
  
  return cached.channel;
}

function setCachedChannel(channelId: string, channel: Channel): void {
  channelCache.set(channelId, { channel, cachedAt: Date.now() });
  
  // Limit cache size (LRU would be better, but this is simple)
  if (channelCache.size > 1000) {
    const firstKey = channelCache.keys().next().value;
    if (firstKey) channelCache.delete(firstKey);
  }
}

// ============================================================
// PERFORMANCE METRICS (Aman's suggestion: enhanced logging)
// ============================================================

interface OperationMetrics {
  operation: string;
  durationMs: number;
  success: boolean;
  cached?: boolean;
}

function logMetrics(metrics: OperationMetrics): void {
  const level = metrics.success ? "debug" : "error";
  logger[level]("📊 ChatService metrics", metrics);
}

// ============================================================
// CHAT SERVICE CLASS
// ============================================================

class ChatService {
  private client: StreamChat;
  private initialized: boolean = false;

  constructor() {
    this.client = StreamChat.getInstance(
      config.getstreamApiKey,
      config.getstreamApiSecret
    );
  }

  /**
   * Ensure the Stream client is connected
   */
  async ensureConnected(): Promise<void> {
    if (!this.initialized) {
      // Server-side client doesn't need to connect like client-side
      this.initialized = true;
      logger.info("StreamChat client initialized");
    }
  }

  /**
   * Get the Stream client for direct access
   */
  getClient(): StreamChat {
    return this.client;
  }

  /**
   * Generate a user token for client-side authentication
   * This token allows the client to connect to Stream Chat
   *
   * @param userId - The user's internal ID (MongoDB ObjectId as string)
   * @returns JWT token for Stream Chat authentication
   */
  createUserToken(userId: string): string {
    if (!userId) {
      throw new Error("User ID is required for token generation");
    }
    return this.client.createToken(userId);
  }

  /**
   * Upsert a user in Stream Chat
   * Call this when a user logs in or updates their profile
   *
   * @param userData - User data to sync with Stream
   */
  async upsertUser(userData: ChatUserData): Promise<void> {
    await this.ensureConnected();

    try {
      await this.client.upsertUser({
        id: userData.id,
        name: userData.name,
        ...(userData.avatar ? { image: userData.avatar } : {}),
      });
      logger.debug("User upserted in Stream Chat", { userId: userData.id });
    } catch (error) {
      logger.error("Failed to upsert user in Stream Chat", {
        userId: userData.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Get or create a messaging channel for a buyer-seller conversation
   * Each channel is unique per (listing, buyer, seller) combination
   *
   * IDEMPOTENCY: Channel IDs are deterministic hashes of (listing_id, buyer, seller)
   * so calling this multiple times with the same inputs returns the same channel.
   *
   * @param buyerId - Buyer's user ID
   * @param sellerId - Seller's user ID
   * @param metadata - Listing metadata to attach to the channel
   * @returns The Stream channel and its ID
   */
  async getOrCreateChannel(
    buyerId: string,
    sellerId: string,
    metadata: ChatChannelMetadata,
    listingUnique: boolean = true
  ): Promise<{ channel: Channel; channelId: string }> {
    const startTime = Date.now();
    
    // Input validation (Aman's suggestion)
    validateUserId(buyerId, "buyerId");
    validateUserId(sellerId, "sellerId");
    validateMetadata(metadata);
    
    await this.ensureConnected();

    // Generate a deterministic channel ID that fits within Stream's 64-character limit
    // This ensures IDEMPOTENCY - same inputs always yield same channel
    const sortedIds = [buyerId, sellerId].sort();
    const rawId = listingUnique
      ? `listing_${metadata.listing_id}_${sortedIds[0]}_${sortedIds[1]}`
      : `direct_${sortedIds[0]}_${sortedIds[1]}`;

    // Stream allows up to 64 chars. Our raw ID can be ~80 chars.
    // We'll use a deterministic hash (MD5 is fine for IDs) to keep it short and safe.
    const channelId = crypto.createHash("md5").update(rawId).digest("hex");

    // Check cache first (Aman's suggestion: caching for performance)
    const cachedChannel = getCachedChannel(channelId);
    if (cachedChannel) {
      logMetrics({
        operation: "getOrCreateChannel",
        durationMs: Date.now() - startTime,
        success: true,
        cached: true,
      });
      return { channel: cachedChannel, channelId };
    }

    try {
      const channel = this.client.channel("messaging", channelId, {
        members: [buyerId, sellerId],
        created_by_id: buyerId,
        // Custom fields stored in channel data (accessed via channel.data)
      } as any);

      // Create the channel if it doesn't exist, or just return it if it does
      await channel.create();

      // Update channel with custom listing data after creation
      await channel.updatePartial({
        set: {
          listing_id: metadata.listing_id,
          listing_title: metadata.listing_title,
          listing_price: metadata.listing_price,
          listing_thumbnail: metadata.listing_thumbnail,
        } as any,
      });

      // Cache the channel for future requests
      setCachedChannel(channelId, channel);

      logger.info("Chat channel created/retrieved", {
        channelId,
        listingId: metadata.listing_id,
        buyerId,
        sellerId,
      });
      
      logMetrics({
        operation: "getOrCreateChannel",
        durationMs: Date.now() - startTime,
        success: true,
        cached: false,
      });

      return { channel, channelId };
    } catch (error) {
      logMetrics({
        operation: "getOrCreateChannel",
        durationMs: Date.now() - startTime,
        success: false,
      });
      logger.error("Failed to create/get chat channel", {
        channelId,
        metadata,
        error,
      });
      throw error;
    }
  }

  /**
   * Send a system message to a channel
   * Used for offer notifications, order updates, etc.
   *
   * FAILURE HANDLING: If this fails, the calling code should log and proceed.
   * System messages are important but not critical to the transaction.
   *
   * @param channelId - The Stream channel ID
   * @param data - System message data
   * @param senderId - ID of the user triggering the action
   */
  async sendSystemMessage(
    channelId: string,
    data: SystemMessageData,
    senderId: string
  ): Promise<void> {
    const startTime = Date.now();
    
    // Input validation (Aman's suggestion)
    validateChannelId(channelId);
    validateUserId(senderId, "senderId");
    
    if (!data || typeof data !== "object") {
      throw new Error("data is required and must be an object");
    }
    if (!data.type || typeof data.type !== "string") {
      throw new Error("data.type is required");
    }
    
    await this.ensureConnected();

    try {
      const channel = this.client.channel("messaging", channelId);

      // Build the message text based on type
      let text = "";
      switch (data.type) {
        case "offer":
          text = `💰 New offer: $${data.amount?.toLocaleString()}`;
          break;
        case "counter_offer":
          text = `🔄 Counter offer: $${data.amount?.toLocaleString()}`;
          break;
        case "offer_accepted":
          text = `✅ Offer accepted: $${data.amount?.toLocaleString()}`;
          break;
        case "offer_rejected":
          text = `❌ Offer declined`;
          break;
        case "order_created":
          text = `📦 Order created - Payment pending`;
          break;
        case "order_paid":
          text = `💳 Payment received - Order confirmed`;
          break;
        case "order_shipped":
          text = `🚚 Order shipped`;
          break;
        case "order_completed":
          text = `🎉 Order completed`;
          break;
        case "listing_reserved":
          text = `🔒 Listing reserved`;
          break;
        case "listing_sold":
          text = `🏷️ Sold! This listing is no longer available.`;
          break;
        case "reference_check_initiated":
          text = `🔍 Reference check initiated`;
          break;
        case "inquiry":
          text = data.message || "New inquiry about this listing";
          break;
        default:
          text = data.message || "System notification";
      }

      await channel.sendMessage({
        text,
        user_id: senderId,
        // Custom metadata for system messages
        ...({
          custom: {
            system_message: true,
            type: data.type,
            amount: data.amount,
            offer_id: data.offer_id,
            order_id: data.order_id,
          },
        } as any),
      });

      logMetrics({
        operation: "sendSystemMessage",
        durationMs: Date.now() - startTime,
        success: true,
      });
      logger.debug("System message sent", { channelId, type: data.type });
    } catch (error) {
      logMetrics({
        operation: "sendSystemMessage",
        durationMs: Date.now() - startTime,
        success: false,
      });
      logger.error("Failed to send system message", { channelId, data, error });
      throw error;
    }
  }

  /**
   * Get a channel by its ID
   *
   * @param channelId - The Stream channel ID
   * @returns The channel or null if not found
   */
  async getChannel(
    channelId: string
  ): Promise<Channel | null> {
    await this.ensureConnected();

    try {
      const channel = this.client.channel("messaging", channelId);
      await channel.watch();
      return channel;
    } catch (error: any) {
      if (error.code === 16) {
        // Channel not found
        return null;
      }
      throw error;
    }
  }

  /**
   * Add a member to an existing channel
   *
   * @param channelId - The Stream channel ID
   * @param userId - User ID to add
   */
  async addChannelMember(channelId: string, userId: string): Promise<void> {
    await this.ensureConnected();

    try {
      const channel = this.client.channel("messaging", channelId);
      await channel.addMembers([userId]);
      logger.debug("Member added to channel", { channelId, userId });
    } catch (error) {
      logger.error("Failed to add member to channel", {
        channelId,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Query channels for a user
   * Returns all channels where the user is a member
   *
   * @param userId - User ID to query channels for
   * @param limit - Maximum number of channels to return
   * @param offset - Offset for pagination
   */
  async getUserChannels(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<Channel[]> {
    await this.ensureConnected();

    try {
      const filter = { members: { $in: [userId] } };
      const sort = [{ last_message_at: -1 as const }];

      const channels = await this.client.queryChannels(filter, sort, {
        limit,
        offset,
        watch: false,
        state: true,
      });

      return channels;
    } catch (error) {
      logger.error("Failed to query user channels", { userId, error });
      throw error;
    }
  }

  /**
   * Get unread counts for a user
   *
   * @param userId - User ID to get unread counts for
   */
  async getUnreadCounts(
    userId: string
  ): Promise<{ total_unread_count: number; channels: Record<string, number> }> {
    await this.ensureConnected();

    try {
      const filter = { members: { $in: [userId] } };
      const channels = await this.client.queryChannels(filter, [], {
        limit: 100,
        watch: false,
        state: true,
      });

      let totalUnread = 0;
      const channelUnreads: Record<string, number> = {};

      for (const channel of channels) {
        const state = channel.state;
        const unread = state.unreadCount || 0;
        totalUnread += unread;
        if (unread > 0) {
          channelUnreads[channel.id || ""] = unread;
        }
      }

      return {
        total_unread_count: totalUnread,
        channels: channelUnreads,
      };
    } catch (error) {
      logger.error("Failed to get unread counts", { userId, error });
      throw error;
    }
  }
}

// Export singleton instance
export const chatService = new ChatService();
export default chatService;
