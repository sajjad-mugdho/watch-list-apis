import { IFavorite, FavoriteType, Platform } from '../../models/Favorite';
import { favoriteRepository } from '../../repositories/FavoriteRepository';
import { MarketplaceListing, NetworkListing } from '../../models/Listings';
import { ISO } from '../../models/ISO';
import logger from '../../utils/logger';

export interface FavoriteParams {
  userId: string;
  itemType: FavoriteType;
  itemId: string;
  platform: Platform;
}

export class FavoriteService {
  /**
   * Add an item to favorites
   * 
   * Per Michael's requirements:
   * - Favorites should ONLY apply to Listings
   * - Can only favorite ACTIVE listings
   * - WTB/ISO favorites are Networks-only (Marketplace doesn't have ISO/WTB)
   */
  async addFavorite(params: FavoriteParams): Promise<IFavorite> {
    const { userId, itemType, itemId, platform } = params;
    
    logger.info('Adding favorite', { userId, itemType, itemId, platform });

    // EDGE CASE FIX #3: WTB/ISO is Networks-only
    // Per Michael: "Marketplace doesn't have ISO/WTB listings anyways"
    if (itemType === 'wtb' && platform === 'marketplace') {
      throw new Error('WTB/ISO favorites are only available on the Networks platform');
    }

    // EDGE CASE FIX #2: Validate listing is ACTIVE before favoriting
    // Per Michael: "Can only favorite ACTIVE: ISO/WTB and For-Sale listings"
    if (itemType === 'for_sale') {
      let listing: any = null;

      if (platform === 'marketplace') {
        listing = await MarketplaceListing.findById(itemId);
      } else if (platform === 'networks') {
        listing = await NetworkListing.findById(itemId);
      }

      if (!listing) {
        throw new Error('Listing not found');
      }
      if (listing.status !== 'active') {
        throw new Error(`Can only favorite active listings. Current status: ${listing.status}`);
      }
    } else if (itemType === 'wtb') {
      const iso = await ISO.findById(itemId);
      if (!iso) {
        throw new Error('ISO/WTB listing not found');
      }
      if (iso.status !== 'active') {
        throw new Error(`Can only favorite active ISO listings. Current status: ${iso.status}`);
      }
    }

    // Check if already favorited
    const existing = await favoriteRepository.findSpecific(userId, itemType, itemId, platform);
    if (existing) {
      throw new Error('Item already in favorites');
    }

    const favorite = await favoriteRepository.create({
      user_id: userId as any,
      item_type: itemType,
      item_id: itemId as any,
      platform
    });

    return favorite;
  }

  /**
   * Get user favorites
   */
  async getFavorites(
    userId: string,
    params: {
      itemType?: FavoriteType;
      platform?: Platform;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ favorites: IFavorite[]; total: number }> {
    const [favorites, total] = await Promise.all([
      favoriteRepository.findForUser(userId, params),
      favoriteRepository.countForUser(userId, params)
    ]);

    return { favorites, total };
  }

  /**
   * Remove from favorites
   */
  async removeFavorite(params: FavoriteParams): Promise<void> {
    const { userId, itemType, itemId, platform } = params;
    
    logger.info('Removing favorite', { userId, itemType, itemId, platform });

    const deleted = await favoriteRepository.deleteSpecific(userId, itemType, itemId, platform);
    if (!deleted) {
      throw new Error('Favorite not found');
    }
  }

  /**
   * Check if item is favorited
   */
  async isFavorited(params: FavoriteParams): Promise<boolean> {
    const { userId, itemType, itemId, platform } = params;
    const favorite = await favoriteRepository.findSpecific(userId, itemType, itemId, platform);
    return !!favorite;
  }
}

export const favoriteService = new FavoriteService();
