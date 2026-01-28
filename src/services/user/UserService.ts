import { IUser } from '../../models/User';
import { userRepository } from '../../repositories/UserRepository';
import cache from '../../utils/cache';
import logger from '../../utils/logger';

export class UserService {
  /**
   * Get current user profile by external ID
   */
  async getProfile(clerkId: string): Promise<IUser | null> {
    const cacheKey = `user:profile:clerk:${clerkId}`;
    
    // 1. Try cache first
    const cached = await cache.get<IUser>(cacheKey);
    if (cached) {
      logger.debug('Returning cached user profile', { clerkId });
      return cached;
    }

    // 2. Fetch from repository
    const user = await userRepository.findByExternalId(clerkId);

    // 3. Cache for 5 minutes if found
    if (user) {
      await cache.set(cacheKey, user, 300);
    }

    return user;
  }

  /**
   * Update user last accessed timestamps for platforms
   */
  async updateLastAccessed(userId: string, platform: 'marketplace' | 'networks'): Promise<void> {
    const field = platform === 'marketplace' 
      ? 'marketplace_last_accessed' 
      : 'networks_last_accessed';
    
    await userRepository.updateById(userId, { [field]: new Date() } as any);
    
    // Invalidate profile cache (by pattern since we don't have clerkId here easily)
    // In a real scenario, we'd store the mapping or use consistent IDs
    await cache.invalidatePattern('user:profile:*');
  }

  /**
   * Check if user is onboarding completed
   */
  async isOnboardingCompleted(userId: string): Promise<boolean> {
    const user = await userRepository.findById(userId);
    return user?.onboarding?.status === 'completed';
  }
}

export const userService = new UserService();
