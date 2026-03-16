/**
 * Repository Index
 *
 * Exports all repository instances as singletons.
 * These are injected into services via the DI container.
 */

export {
  BaseRepository,
  QueryOptions,
  PaginatedResult,
} from "../shared/repositories/base/BaseRepository";
export {
  channelRepository,
  ChannelRepository,
  Platform,
  Channel,
} from "./ChannelRepository";
export { messageRepository, MessageRepository } from "./MessageRepository";
export { favoriteRepository, FavoriteRepository } from "./FavoriteRepository";
export {
  recentSearchRepository,
  RecentSearchRepository,
} from "./RecentSearchRepository";
export { userRepository, UserRepository } from "./UserRepository";

// New repositories
export { isoRepository } from "./ISORepository";
export {
  connectionRepository,
  ConnectionRepository,
} from "./ConnectionRepository";
export { subscriptionRepository } from "./SubscriptionRepository";
