/**
 * Repository Index
 * 
 * Exports all repository instances as singletons.
 * These are injected into services via the DI container.
 */

export { BaseRepository, QueryOptions, PaginatedResult } from './base/BaseRepository';
export { channelRepository, ChannelRepository, Platform, Channel } from './ChannelRepository';
export { messageRepository, MessageRepository } from './MessageRepository';
export { notificationRepository, NotificationRepository } from './NotificationRepository';
export { favoriteRepository, FavoriteRepository } from './FavoriteRepository';
export { recentSearchRepository, RecentSearchRepository } from './RecentSearchRepository';
export { userRepository, UserRepository } from './UserRepository';

// New repositories
export { isoRepository } from './ISORepository';
export { followRepository } from './FollowRepository';
export { subscriptionRepository } from './SubscriptionRepository';
