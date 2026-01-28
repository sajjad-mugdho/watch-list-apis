/**
 * Subscription Repository
 * 
 * Data access layer for subscription operations.
 * Extends BaseRepository for standard CRUD operations.
 */

import { Types } from 'mongoose';
import { BaseRepository } from './base/BaseRepository';
import { Subscription, ISubscription, SUBSCRIPTION_TIER_VALUES } from '../models/Subscription';

export type SubscriptionTier = typeof SUBSCRIPTION_TIER_VALUES[number];

class SubscriptionRepository extends BaseRepository<ISubscription> {
  constructor() {
    super(Subscription as any);
  }

  /**
   * Find subscription by user ID
   */
  async findByUserId(userId: string): Promise<ISubscription | null> {
    return this.findOne({
      user_id: new Types.ObjectId(userId),
    });
  }

  /**
   * Find subscription by Clerk ID
   */
  async findByClerkId(clerkId: string): Promise<ISubscription | null> {
    return this.findOne({ clerk_id: clerkId });
  }

  /**
   * Get or create subscription (defaults to free tier)
   */
  async getOrCreate(userId: string, clerkId: string): Promise<ISubscription> {
    let subscription = await this.findByUserId(userId);
    
    if (!subscription) {
      subscription = await this.create({
        user_id: new Types.ObjectId(userId),
        clerk_id: clerkId,
        tier: 'free',
        status: 'active',
        price_cents: 0,
      } as any);
    }
    
    return subscription;
  }

  /**
   * Upgrade subscription tier
   */
  async upgradeTier(
    userId: string, 
    tier: SubscriptionTier,
    billingCycle: 'monthly' | 'yearly',
    priceCents: number
  ): Promise<ISubscription | null> {
    const periodEnd = new Date();
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subscription = await this.findByUserId(userId);
    if (!subscription) return null;

    return this.updateById(subscription._id.toString(), {
      tier,
      billing_cycle: billingCycle,
      price_cents: priceCents,
      status: 'active',
      current_period_start: new Date(),
      current_period_end: periodEnd,
      cancel_at_period_end: false,
    });
  }

  /**
   * Cancel subscription at period end
   */
  async cancelAtPeriodEnd(userId: string): Promise<ISubscription | null> {
    const subscription = await this.findByUserId(userId);
    if (!subscription) return null;

    return this.updateById(subscription._id.toString(), {
      cancel_at_period_end: true,
      cancelled_at: new Date(),
    });
  }

  /**
   * Reactivate cancelled subscription
   */
  async reactivate(userId: string): Promise<ISubscription | null> {
    const subscription = await this.findByUserId(userId);
    if (!subscription) return null;

    return this.updateById(subscription._id.toString(), {
      cancel_at_period_end: false,
      cancelled_at: null,
      status: 'active',
    });
  }

  /**
   * Find subscriptions expiring soon (for renewal reminders)
   */
  async findExpiringSoon(daysAhead: number = 7): Promise<ISubscription[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.find({
      status: 'active',
      current_period_end: { 
        $lte: futureDate,
        $gt: new Date(),
      },
      cancel_at_period_end: false,
    });
  }

  /**
   * Find expired subscriptions (for cleanup)
   */
  async findExpired(): Promise<ISubscription[]> {
    return this.find({
      status: 'active',
      current_period_end: { $lt: new Date() },
      tier: { $ne: 'free' },
    });
  }

  /**
   * Update payment instrument
   */
  async updatePaymentInstrument(
    userId: string, 
    instrumentId: string
  ): Promise<ISubscription | null> {
    const subscription = await this.findByUserId(userId);
    if (!subscription) return null;

    return this.updateById(subscription._id.toString(), {
      finix_instrument_id: instrumentId,
    });
  }
}

// Singleton instance
export const subscriptionRepository = new SubscriptionRepository();
