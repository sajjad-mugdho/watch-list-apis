import { IRecentSearch, Platform, SearchContext } from '../../models/RecentSearch';
import { recentSearchRepository } from '../../repositories/RecentSearchRepository';
import logger from '../../utils/logger';

// Max searches to keep per user (could be from config)
const MAX_SEARCHES = 20;

export class RecentSearchService {
  /**
   * Add a recent search query
   */
  async addSearch(params: {
    userId: string;
    query: string;
    platform: Platform;
    context?: SearchContext;
    filters?: Record<string, any>;
    resultCount?: number;
  }): Promise<IRecentSearch> {
    const { userId, query, platform, context, filters, resultCount } = params;
    const normalizedQuery = query.toLowerCase().trim();

    logger.info('Adding recent search', { userId, query: normalizedQuery, platform });

    // 1. Check if already exists and delete to bump to top
    await recentSearchRepository.deleteMany({
      user_id: userId,
      query: normalizedQuery,
      platform
    } as any);

    // 2. Create new record
    const search = await recentSearchRepository.create({
      user_id: userId as any,
      query: normalizedQuery,
      platform,
      ...(context ? { context } : {}),
      ...(filters ? { filters } : {}),
      ...(resultCount ? { result_count: resultCount } : {})
    });

    // 3. Optional: Cleanup old searches beyond limit
    // This could also be done as a post-action or in repo
    const searchCount = await recentSearchRepository.count({ user_id: userId } as any);
    if (searchCount > MAX_SEARCHES) {
      const all = await recentSearchRepository.findForUser(userId, { limit: 100 });
      const toDelete = all.slice(MAX_SEARCHES).map(s => (s as any)._id);
      if (toDelete.length > 0) {
        await recentSearchRepository.deleteMany({ _id: { $in: toDelete } } as any);
      }
    }

    return search;
  }

  /**
   * Get user's recent searches
   */
  async getSearches(userId: string, platform?: Platform): Promise<IRecentSearch[]> {
    return recentSearchRepository.findForUser(userId, { 
      ...(platform ? { platform } : {}) 
    });
  }

  /**
   * Clear all searches for a user
   */
  async clearSearches(userId: string, platform?: Platform): Promise<void> {
    logger.info('Clearing recent searches', { userId, platform });
    await recentSearchRepository.deleteForUser(userId, platform);
  }

  /**
   * Delete a specific search entry
   */
  async deleteSearch(userId: string, searchId: string): Promise<void> {
    logger.info('Deleting specific search', { userId, searchId });
    const result = await recentSearchRepository.deleteById(searchId);
    if (!result) {
      throw new Error('Search not found');
    }
  }
}

export const recentSearchService = new RecentSearchService();
