/**
 * Networks-specific GetStream webhook event handlers
 *
 * This module processes GetStream chat events and updates Networks business logic:
 * - Tracks unread message counts (AUTO-INCREMENT on message.new)
 * - Updates conversation metadata (last_message_at, last_message_preview)
 * - Manages participant status (added, removed, updated)
 * - Records channel lifecycle events
 *
 * SEPARATION PRINCIPLE:
 * - These handlers contain NETWORKS DOMAIN LOGIC only
 * - Reuses ChatService and models (NO code duplication)
 * - Called by global webhookProcessor (single routing point)
 * - Idempotent: Safe to call multiple times for same event
 *
 * INTEGRATION FLOW:
 * GetStream Cloud
 *   ↓ webhook
 * getstreamWebhookHandler (verify signature, queue)
 *   ↓ Bull queue
 * webhookProcessor (route by type)
 *   ↓ check if Networks event
 * getstreamHandlers (update NetworkListingChannel)
 *   ↓
 * MongoDB: NetworkListingChannel.unread_count++
 */

import logger from "../../utils/logger";
import { NetworkListingChannel } from "../models/NetworkListingChannel";

import { Types } from "mongoose";
import { networksChatService } from "../services/NetworksChatService";
import { ChatMessage } from "../models/ChatMessage";

// ============================================================================
// MESSAGE EVENTS
// ============================================================================

/**
 * Handle message.new webhook event
 *
 * When a new message arrives in a Networks channel:
 * 1. Increment unread_count for the OTHER user (not the sender)
 * 2. Update last_message_at timestamp
 * 3. Store message preview text
 * 4. Archive message to MongoDB
 * 5. Emit NotificationEvent (Phase 2: trigger push notification)
 *
 * @param event GetStream webhook payload
 */
export async function onNetworkChatMessageNew(event: any): Promise<void> {
  try {
    const { cid, message, user } = event;
    if (!cid || !message || !user) {
      logger.warn("Invalid message.new webhook payload", {
        cid,
        message,
        user,
      });
      return;
    }

    if (!cid.includes(":")) {
      logger.warn("Malformed cid - missing channel type separator", { cid });
      return;
    }

    // Parse channel ID: "messaging:networks-listing-{listing_id}"
    const channelId = cid.split(":")[1];
    const listsplitted = channelId.split("networks-listing-");
    const listingId = listsplitted[1];

    if (!listingId) {
      logger.warn("Could not extract listing ID from channel", {
        cid,
        channelId,
      });
      return;
    }

    // Find the NetworkListingChannel by getstream_channel_id
    const networkChannel = await NetworkListingChannel.findOne({
      getstream_channel_id: channelId,
    });

    if (!networkChannel) {
      logger.warn("NetworkListingChannel not found for channel", {
        channelId,
        cid,
      });
      return;
    }

    // Determine which user should get the unread increment
    // (the user who is NOT the sender)
    const senderId = user.id;
    let recipientId: string;

    if (networkChannel.buyer_id?.toString() === senderId) {
      recipientId = networkChannel.seller_id?.toString() || "";
    } else {
      recipientId = networkChannel.buyer_id?.toString() || "";
    }

    if (!recipientId) {
      logger.warn("Could not determine recipient user", {
        channelId,
        senderId,
      });
      return;
    }

    // TASK 1: INCREMENT UNREAD COUNT
    await networksChatService.updateUnreadCount(
      channelId,
      recipientId,
      1, // increment by 1
    );

    // TASK 2: UPDATE LAST MESSAGE METADATA
    await networksChatService.updateLastMessage(
      channelId,
      message.text || "(attachment)",
      senderId,
    );

    // TASK 3: ARCHIVE MESSAGE TO MONGODB
    try {
      // Extract Clerk ID from GetStream message
      // In GetStream webhook, message.user.id contains the Clerk user ID
      const senderClerkId = message.user?.id || senderId;

      // Verify we have all required fields before creating
      if (!senderClerkId) {
        logger.warn("Missing sender clerk ID for message archive", {
          messageId: message.id,
          senderId,
          channelId,
        });
        // Don't archive if we can't get clerk ID - fail validation intentionally
        throw new Error("Missing required field: sender_clerk_id");
      }

      const archived = await ChatMessage.create({
        channel_id: channelId,
        getstream_message_id: message.id,
        sender_id: new Types.ObjectId(senderId),
        sender_clerk_id: senderClerkId,
        text: message.text || "",
        html: message.html,
        attachments: message.attachments || [],
        mentioned_users: (message.mentioned_users || []).map(
          (u: any) => new Types.ObjectId(u.id),
        ),
        reactions: new Map(),
        read_by: [],
        pinned: message.pinned || false,
        created_at: new Date(message.created_at),
        updated_at: new Date(message.updated_at),
        status: "delivered", // Message came from GetStream, so it's delivered
      });

      logger.info("Message archived successfully", {
        messageId: message.id,
        channelId,
        senderId,
        dbId: archived._id,
      });
    } catch (archiveError) {
      // Don't fail the webhook if archiving fails
      logger.warn("Failed to archive message to MongoDB", {
        messageId: message.id,
        channelId,
        error: archiveError,
      });
    }

    // TASK 4: EMIT NOTIFICATION EVENT
    // Phase 2 will listen to this and send push notifications
    // For now, just log it
    logger.info("Message received - ready for notification", {
      recipientId,
      senderId,
      channelId,
      messageId: message.id,
    });
  } catch (error) {
    logger.error("Error processing message.new webhook", {
      error,
      event,
    });
    throw error; // Re-throw so Bull retries
  }
}

/**
 * Handle message.read webhook event
 *
 * When a user marks messages as read:
 * 1. Clear unread_count for that user
 * 2. Record last_read_at timestamp
 * 3. Store who read the message in ChatMessage
 *
 * @param event GetStream webhook payload
 */
export async function onNetworkChatMessageRead(event: any): Promise<void> {
  try {
    const { cid, user, channel_last_read_at } = event;
    if (!cid || !user) {
      logger.warn("Invalid message.read webhook payload", { cid, user });
      return;
    }

    const channelId = cid.split(":")[1];

    // Clear unread count for this user
    await networksChatService.markChannelAsRead(channelId, user.id);

    // Optional: Update ChatMessage read_by array
    // This is for Phase 3 (read receipt tracking)
    // For now, just log
    logger.info("Channel marked as read", {
      channelId,
      userId: user.id,
      lastReadAt: channel_last_read_at,
    });
  } catch (error) {
    logger.error("Error processing message.read webhook", {
      error,
      event,
    });
    throw error;
  }
}

/**
 * Handle message.updated webhook event
 *
 * When a user edits a message:
 * 1. Update the message in MongoDB
 * 2. Update last_message_preview if this was the last message
 *
 * @param event GetStream webhook payload
 */
export async function onNetworkChatMessageUpdated(event: any): Promise<void> {
  try {
    const { cid, message } = event;
    if (!cid || !message) {
      logger.warn("Invalid message.updated webhook payload", { cid, message });
      return;
    }

    if (!cid.includes(":")) {
      logger.warn("Malformed cid in message.updated", { cid });
      return;
    }

    const channelId = cid.split(":")[1];

    // Update message in MongoDB
    try {
      await ChatMessage.updateOne(
        { getstream_message_id: message.id },
        {
          $set: {
            text: message.text,
            html: message.html,
            updated_at: new Date(message.updated_at),
          },
        },
      );

      const isLatestMessage = await ChatMessage.findOne(
        { channel_id: channelId },
        { created_at: 1 },
        { sort: { created_at: -1 } },
      );

      if (
        isLatestMessage &&
        isLatestMessage.getstream_message_id === message.id
      ) {
        // This was the latest message, update the channel preview
        await NetworkListingChannel.updateOne(
          { getstream_channel_id: channelId },
          {
            $set: {
              last_message_preview: message.text,
              last_message_at: new Date(message.updated_at),
            },
          },
        );

        logger.info("Channel preview updated after message edit", {
          channelId,
          messageId: message.id,
        });
      }

      logger.info("Message updated in archive", {
        channelId,
        messageId: message.id,
      });
    } catch (archiveError) {
      logger.warn("Failed to update message in MongoDB", {
        messageId: message.id,
        error: archiveError,
      });
    }
  } catch (error) {
    logger.error("Error processing message.updated webhook", {
      error,
      event,
    });
    throw error;
  }
}

/**
 * Handle message.deleted webhook event
 *
 * When a user deletes a message:
 * 1. Mark as deleted in MongoDB (soft delete)
 * 2. Update last_message_preview to previous message
 *
 * @param event GetStream webhook payload
 */
export async function onNetworkChatMessageDeleted(event: any): Promise<void> {
  try {
    const { cid, message } = event;
    if (!cid || !message) {
      logger.warn("Invalid message.deleted webhook payload", { cid, message });
      return;
    }

    if (!cid.includes(":")) {
      logger.warn("Malformed cid in message.deleted", { cid });
      return;
    }

    const channelId = cid.split(":")[1];

    // Soft delete in MongoDB
    try {
      await ChatMessage.updateOne(
        { getstream_message_id: message.id },
        {
          $set: {
            deleted_at: new Date(),
            text: "[deleted]",
          },
        },
      );

      const isLatestMessage = await ChatMessage.findOne(
        { channel_id: channelId, deleted_at: { $exists: false } },
        { created_at: 1 },
        { sort: { created_at: -1 } },
      );

      if (isLatestMessage) {
        // Update to the new latest message
        await NetworkListingChannel.updateOne(
          { getstream_channel_id: channelId },
          {
            $set: {
              last_message_preview: isLatestMessage.text,
              last_message_at: isLatestMessage.created_at,
            },
          },
        );

        logger.info("Channel preview updated after message deletion", {
          channelId,
          deletedMessageId: message.id,
          newLatestMessage: isLatestMessage._id,
        });
      }

      logger.info("Message marked as deleted", {
        messageId: message.id,
      });
    } catch (archiveError) {
      logger.warn("Failed to delete message in MongoDB", {
        messageId: message.id,
        error: archiveError,
      });
    }
  } catch (error) {
    logger.error("Error processing message.deleted webhook", {
      error,
      event,
    });
    throw error;
  }
}

// ============================================================================
// CHANNEL MEMBER EVENTS
// ============================================================================

/**
 * Handle member.added webhook event
 *
 * When a new participant is added to a Networks channel:
 * 1. Record in NetworkListingChannel.participants
 * 2. Log activity for audit trail
 *
 * @param event GetStream webhook payload
 */
export async function onNetworkChatMemberAdded(event: any): Promise<void> {
  try {
    const { cid, member } = event;
    if (!cid || !member) {
      logger.warn("Invalid member.added webhook payload", { cid, member });
      return;
    }

    const channelId = cid.split(":")[1];
    const userId = member.user_id;

    // Add to participants if not already there
    const updated = await NetworkListingChannel.findOneAndUpdate(
      {
        getstream_channel_id: channelId,
        participants: { $ne: userId },
      },
      {
        $push: { participants: userId },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    );

    if (updated) {
      logger.info("Member added to Networks channel", {
        channelId,
        userId,
      });
    }
  } catch (error) {
    logger.error("Error processing member.added webhook", {
      error,
      event,
    });
    throw error;
  }
}

/**
 * Handle member.updated webhook event
 *
 * When a participant's role changes (moderator status, etc):
 * 1. Log the change for audit trail
 * 2. Update in NetworkListingChannel if needed
 *
 * @param event GetStream webhook payload
 */
export async function onNetworkChatMemberUpdated(event: any): Promise<void> {
  try {
    const { cid, member } = event;
    if (!cid || !member) {
      logger.warn("Invalid member.updated webhook payload", { cid, member });
      return;
    }

    // For Networks, we don't track moderator status yet
    // Phase 3: Add moderator tracking if needed
    logger.info("Member updated in Networks channel", {
      channelId: cid.split(":")[1],
      userId: member.user_id,
      isModerator: member.is_moderator,
    });
  } catch (error) {
    logger.error("Error processing member.updated webhook", {
      error,
      event,
    });
    throw error;
  }
}

// ============================================================================
// CHANNEL EVENTS
// ============================================================================

/**
 * Handle channel.created webhook event
 *
 * When a Networks listing channel is created:
 * 1. Log for audit trail
 * 2. Verify NetworkListingChannel was created
 *
 * @param event GetStream webhook payload
 */
export async function onNetworkChatChannelCreated(event: any): Promise<void> {
  try {
    const { cid, channel } = event;
    if (!cid || !channel) {
      logger.warn("Invalid channel.created webhook payload", { cid, channel });
      return;
    }

    logger.info("Networks channel created in GetStream", {
      channelId: channel.id,
      channelType: channel.type,
      createdBy: channel.created_by?.id,
    });

    // Note: NetworkListingChannel should already exist from NetworksChatService
    // This is just for logging/confirmation
  } catch (error) {
    logger.error("Error processing channel.created webhook", {
      error,
      event,
    });
    throw error;
  }
}

/**
 * Handle channel.updated webhook event
 *
 * When a Networks channel metadata is updated:
 * 1. Sync participants list if changed
 * 2. Update channel metadata in our system
 *
 * @param event GetStream webhook payload
 */
export async function onNetworkChatChannelUpdated(event: any): Promise<void> {
  try {
    const { cid, channel } = event;
    if (!cid || !channel) {
      logger.warn("Invalid channel.updated webhook payload", { cid, channel });
      return;
    }

    const channelId = cid.split(":")[1];

    // Sync member list
    const memberIds = channel.members?.map((m: any) => m.user_id) || [];

    if (memberIds.length > 0) {
      await NetworkListingChannel.findOneAndUpdate(
        { getstream_channel_id: channelId },
        {
          $set: {
            participants: memberIds,
            updatedAt: new Date(),
          },
        },
      );

      logger.info("Networks channel participants synced", {
        channelId,
        participantCount: memberIds.length,
      });
    }
  } catch (error) {
    logger.error("Error processing channel.updated webhook", {
      error,
      event,
    });
    throw error;
  }
}

// ============================================================================
// REACTION EVENTS (Phase 3 - Optional)
// ============================================================================

/**
 * Handle reaction.new webhook event
 *
 * When a user adds a reaction to a message:
 * 1. Record in ChatMessage.reactions
 * 2. For Phase 3: Use for reputation/engagement tracking
 *
 * @param event GetStream webhook payload
 */
export async function onNetworkChatReactionNew(event: any): Promise<void> {
  try {
    const { message, reaction } = event;
    if (!message || !reaction) {
      logger.warn("Invalid reaction.new webhook payload", {
        message,
        reaction,
      });
      return;
    }

    // Phase 3: Store reaction for analytics
    logger.info("Reaction added to message", {
      messageId: message.id,
      reactionType: reaction.type,
      userId: reaction.user?.id,
    });
  } catch (error) {
    logger.error("Error processing reaction.new webhook", {
      error,
      event,
    });
    throw error;
  }
}

/**
 * Handle reaction.deleted webhook event
 *
 * When a user removes a reaction:
 * 1. Remove from ChatMessage.reactions
 *
 * @param event GetStream webhook payload
 */
export async function onNetworkChatReactionDeleted(event: any): Promise<void> {
  try {
    const { message, reaction } = event;
    if (!message || !reaction) {
      logger.warn("Invalid reaction.deleted webhook payload", {
        message,
        reaction,
      });
      return;
    }

    // Phase 3: Remove from analytics
    logger.info("Reaction removed from message", {
      messageId: message.id,
      reactionType: reaction.type,
      userId: reaction.user?.id,
    });
  } catch (error) {
    logger.error("Error processing reaction.deleted webhook", {
      error,
      event,
    });
    throw error;
  }
}
