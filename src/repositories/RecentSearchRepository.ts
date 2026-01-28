import { BaseRepository } from './base/BaseRepository';
import { RecentSearch, IRecentSearch, Platform, SearchContext } from '../models/RecentSearch';
import { FilterQuery } from 'mongoose';

export class RecentSearchRepository extends BaseRepository<IRecentSearch> {
  constructor() {
    super(RecentSearch);
  }

  async findForUser(
    userId: string,
    params: {
      platform?: Platform;
      context?: SearchContext;
      limit?: number;
    }
  ): Promise<IRecentSearch[]> {
    const { platform, context, limit = 20 } = params;
    
    const query: FilterQuery<IRecentSearch> = { user_id: userId };
    if (platform) query.platform = platform;
    if (context) query.context = context;

    return (this.model as any).find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean() as any as Promise<IRecentSearch[]>;
  }

  async deleteForUser(userId: string, platform?: Platform): Promise<void> {
    const query: FilterQuery<IRecentSearch> = { user_id: userId };
    if (platform) query.platform = platform;
    await (this.model as any).deleteMany(query);
  }

  async findExisting(userId: string, query: string, platform: Platform): Promise<IRecentSearch | null> {
    return (this.model as any).findOne({
      user_id: userId,
      query: query.toLowerCase().trim(),
      platform
    }).lean() as any as Promise<IRecentSearch | null>;
  }
}

export const recentSearchRepository = new RecentSearchRepository();
