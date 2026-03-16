/**
 * Services Index - Dependency Injection Container
 *
 * Exports all service instances as singletons.
 * Services depend on repositories and each other via this container.
 */

// Channel service
export {
  channelService,
  ChannelService,
} from "../shared/services/channel/ChannelService";

// Message service
export {
  messageService,
  MessageService,
} from "../shared/services/message/MessageService";

// Offer service
export { offerService, OfferService } from "./offer/OfferService";

// Favorite service
export { favoriteService, FavoriteService } from "./favorite/FavoriteService";

// Recent Search service
export {
  recentSearchService,
  RecentSearchService,
} from "./search/RecentSearchService";

// Events
export { events, TypedEventEmitter } from "../utils/events";
