import { BaseRepository } from './base/BaseRepository';
import { Favorite, IFavorite, FavoriteType, Platform } from '../models/Favorite';
import { FilterQuery } from 'mongoose';

export class FavoriteRepository extends BaseRepository<IFavorite> {
  constructor() {
    super(Favorite);
  }

  async findForUser(
    userId: string,
    params: {
      itemType?: FavoriteType;
      platform?: Platform;
      limit?: number;
      offset?: number;
    }
  ): Promise<IFavorite[]> {
    const { itemType, platform, limit = 20, offset = 0 } = params;
    
    const query: FilterQuery<IFavorite> = { user_id: userId };
    if (itemType) query.item_type = itemType;
    if (platform) query.platform = platform;

    return (this.model as any).find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean() as any as Promise<IFavorite[]>;
  }

  async countForUser(
    userId: string,
    params: {
      itemType?: FavoriteType;
      platform?: Platform;
    }
  ): Promise<number> {
    const { itemType, platform } = params;
    
    const query: FilterQuery<IFavorite> = { user_id: userId };
    if (itemType) query.item_type = itemType;
    if (platform) query.platform = platform;

    return (this.model as any).countDocuments(query);
  }

  async findSpecific(
    userId: string,
    itemType: FavoriteType,
    itemId: string,
    platform: Platform
  ): Promise<IFavorite | null> {
    return (this.model as any).findOne({
      user_id: userId,
      item_type: itemType,
      item_id: itemId,
      platform
    }).lean() as any as Promise<IFavorite | null>;
  }

  async deleteSpecific(
    userId: string,
    itemType: FavoriteType,
    itemId: string,
    platform: Platform
  ): Promise<boolean> {
    const result = await (this.model as any).deleteOne({
      user_id: userId,
      item_type: itemType,
      item_id: itemId,
      platform
    });
    return result.deletedCount > 0;
  }
}

export const favoriteRepository = new FavoriteRepository();
