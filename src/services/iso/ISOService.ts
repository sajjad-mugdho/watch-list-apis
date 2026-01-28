/**
 * ISO Service
 * 
 * Business logic for ISO (In Search Of) operations.
 * Extracted from isoRoutes.ts to follow proper service layer pattern.
 */

import { Types } from 'mongoose';
import { isoRepository } from '../../repositories';
import { ISO, IISO, ISOStatus, ISOUrgency, ISO_STATUS_VALUES, ISO_URGENCY_VALUES } from '../../models/ISO';
import { feedService } from '../FeedService';
import logger from '../../utils/logger';
import { ApiError } from '../../utils/apiErrors';

// Configuration
const MAX_ACTIVE_ISOS = 10;

export interface CreateISOParams {
  userId: string;
  clerkId: string;
  title: string;
  description?: string;
  criteria?: {
    brand?: string;
    model?: string;
    reference?: string;
    year_min?: number;
    year_max?: number;
    condition?: string;
    max_price?: number;
  };
  urgency?: ISOUrgency;
  isPublic?: boolean;
  expiresAt?: string | Date;
}

export interface UpdateISOParams {
  title?: string;
  description?: string;
  criteria?: {
    brand?: string;
    model?: string;
    reference?: string;
    year_min?: number;
    year_max?: number;
    condition?: string;
    max_price?: number;
  };
  urgency?: ISOUrgency;
  isPublic?: boolean;
  expiresAt?: string | Date | null;
  status?: ISOStatus;
}

export interface ISOListParams {
  limit?: number;
  offset?: number;
  status?: ISOStatus;
}

class ISOService {
  /**
   * Create a new ISO
   */
  async create(params: CreateISOParams): Promise<IISO> {
    const { userId, clerkId, title, description, criteria, urgency, isPublic, expiresAt } = params;

    // Validate urgency
    if (urgency && !ISO_URGENCY_VALUES.includes(urgency)) {
      throw ApiError.badRequest('Invalid urgency value');
    }

    // Check active ISO limit
    const activeCount = await isoRepository.countActiveByUser(userId);
    if (activeCount >= MAX_ACTIVE_ISOS) {
      throw ApiError.badRequest(`Maximum ${MAX_ACTIVE_ISOS} active ISOs allowed`);
    }

    // Create ISO
    const iso = await ISO.create({
      user_id: new Types.ObjectId(userId),
      clerk_id: clerkId,
      title: title.trim(),
      description: description?.trim() || null,
      criteria: criteria || {},
      urgency: urgency || 'medium',
      is_public: isPublic !== false,
      expires_at: expiresAt ? new Date(expiresAt) : null,
    });

    // Add to activity feed if public
    if (iso.is_public) {
      try {
        await feedService.addISOActivity(userId, iso._id.toString(), {
          criteria: iso.title,
          urgency: iso.urgency,
        });
      } catch (feedError) {
        logger.warn('Failed to add ISO to activity feed', { feedError });
      }
    }

    logger.info('ISO created', { isoId: iso._id, userId });
    return iso;
  }

  /**
   * Get public active ISOs
   */
  async getPublicActive(params: ISOListParams = {}) {
    const { limit = 20, offset = 0 } = params;
    return isoRepository.getPublicActive(limit, offset);
  }

  /**
   * Get user's ISOs
   */
  async getByUser(
    userId: string, 
    params: ISOListParams = {}
  ): Promise<{ isos: IISO[]; total: number }> {
    const { status } = params;
    
    const isos = await isoRepository.findByUserId(userId, status);
    
    return {
      isos,
      total: isos.length,
    };
  }

  /**
   * Get ISO by ID
   */
  async getById(isoId: string): Promise<IISO | null> {
    if (!Types.ObjectId.isValid(isoId)) {
      throw ApiError.badRequest('Invalid ISO ID');
    }
    return isoRepository.findById(isoId);
  }

  /**
   * Update ISO
   */
  async update(
    isoId: string, 
    userId: string, 
    params: UpdateISOParams
  ): Promise<IISO> {
    if (!Types.ObjectId.isValid(isoId)) {
      throw ApiError.badRequest('Invalid ISO ID');
    }

    const iso = await ISO.findById(isoId);
    if (!iso) {
      throw ApiError.notFound('ISO not found');
    }

    // Verify ownership
    if (iso.user_id.toString() !== userId) {
      throw ApiError.forbidden('Not authorized to update this ISO');
    }

    // Apply updates
    if (params.title) iso.title = params.title.trim();
    if (params.description !== undefined) {
      (iso as any).description = (params.description?.trim() || null) as any;
    }
    if (params.criteria) {
      iso.criteria = { ...iso.criteria, ...params.criteria };
    }
    if (params.urgency && ISO_URGENCY_VALUES.includes(params.urgency)) {
      iso.urgency = params.urgency;
    }
    if (params.isPublic !== undefined) {
      iso.is_public = params.isPublic;
    }
    if (params.expiresAt !== undefined) {
      (iso as any).expires_at = params.expiresAt 
        ? new Date(params.expiresAt as string) 
        : null;
    }
    if (params.status && ISO_STATUS_VALUES.includes(params.status)) {
      iso.status = params.status;
    }

    await iso.save();
    logger.info('ISO updated', { isoId: iso._id });
    
    return iso;
  }

  /**
   * Mark ISO as fulfilled
   */
  async markFulfilled(isoId: string, userId: string): Promise<IISO> {
    return this.update(isoId, userId, { status: 'fulfilled' });
  }

  /**
   * Close ISO
   */
  async close(isoId: string, userId: string): Promise<IISO> {
    return this.update(isoId, userId, { status: 'closed' });
  }

  /**
   * Delete ISO
   */
  async delete(isoId: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(isoId)) {
      throw ApiError.badRequest('Invalid ISO ID');
    }

    const iso = await ISO.findById(isoId);
    if (!iso) {
      throw ApiError.notFound('ISO not found');
    }

    if (iso.user_id.toString() !== userId) {
      throw ApiError.forbidden('Not authorized to delete this ISO');
    }

    await ISO.deleteOne({ _id: isoId });
    logger.info('ISO deleted', { isoId });
  }

  /**
   * Search ISOs by text
   */
  async search(query: string, params: ISOListParams = {}) {
    return isoRepository.searchByText(query, params);
  }

  /**
   * Check if user owns ISO
   */
  async isOwner(isoId: string, userId: string): Promise<boolean> {
    const iso = await this.getById(isoId);
    if (!iso) return false;
    return iso.user_id.toString() === userId;
  }
}

// Singleton instance
export const isoService = new ISOService();
