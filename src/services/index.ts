/**
 * Services Index - Dependency Injection Container
 * 
 * Exports all service instances as singletons.
 * Services depend on repositories and each other via this container.
 */

// Channel service
export { channelService, ChannelService } from './channel/ChannelService';

// Message service
export { messageService, MessageService } from './message/MessageService';

// Notification service
export { notificationService, NotificationService } from './notification/NotificationService';

// Offer service
export { offerService, OfferService } from './offer/OfferService';

// User service
export { userService, UserService } from './user/UserService';

// Favorite service
export { favoriteService, FavoriteService } from './favorite/FavoriteService';

// Recent Search service
export { recentSearchService, RecentSearchService } from './search/RecentSearchService';

// ISO service
export { isoService } from './iso/ISOService';

// Events
export { events, TypedEventEmitter } from '../utils/events';
