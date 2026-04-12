import logger from "../../utils/logger";
import {
  onNetworkChatMessageNew,
  onNetworkChatMessageRead,
  onNetworkChatMessageUpdated,
  onNetworkChatMessageDeleted,
  onNetworkChatMemberAdded,
  onNetworkChatMemberUpdated,
  onNetworkChatChannelCreated,
  onNetworkChatChannelUpdated,
  onNetworkChatReactionNew,
  onNetworkChatReactionDeleted,
} from "./getstreamHandlers";

/**
 * Register Networks event handlers
 *
 * Exports webhook event handlers so webhookProcessor can route
 * GetStream events to Networks domain logic.
 *
 * Handler routing:
 * - message.new → onNetworkChatMessageNew (auto-increment unread)
 * - message.read → onNetworkChatMessageRead (clear unread)
 * - message.updated → onNetworkChatMessageUpdated (update preview)
 * - message.deleted → onNetworkChatMessageDeleted (soft delete)
 * - member.added → onNetworkChatMemberAdded (track participants)
 * - member.updated → onNetworkChatMemberUpdated (track role changes)
 * - channel.created → onNetworkChatChannelCreated (audit log)
 * - channel.updated → onNetworkChatChannelUpdated (sync participants)
 * - reaction.new → onNetworkChatReactionNew (Phase 3)
 * - reaction.deleted → onNetworkChatReactionDeleted (Phase 3)
 */
export function registerNetworksEventHandlers(): void {
  logger.info("Registering Networks event handlers...");
  logger.info("✅ GetStream webhooks will call Networks handlers");
  logger.info("Networks event handlers registered successfully.");
}

// Export handlers for webhookProcessor to use
export {
  onNetworkChatMessageNew,
  onNetworkChatMessageRead,
  onNetworkChatMessageUpdated,
  onNetworkChatMessageDeleted,
  onNetworkChatMemberAdded,
  onNetworkChatMemberUpdated,
  onNetworkChatChannelCreated,
  onNetworkChatChannelUpdated,
  onNetworkChatReactionNew,
  onNetworkChatReactionDeleted,
};
