/**
 * Shared Offer Schemas
 *
 * Centralized Zod schemas for offer-related routes.
 * Used by both Marketplace and Networks offer routes.
 */

import { z } from 'zod';

/**
 * Offer ID parameter
 */
export const offerIdParamSchema = z.object({
  params: z.object({
    offerId: z.string().min(1),
  }),
});

/**
 * Counter offer request
 */
export const counterOfferSchema = z.object({
  params: z.object({
    offerId: z.string().min(1),
  }),
  body: z.object({
    amount: z.number().positive(),
    message: z.string().max(500).optional(),
    expires_in_hours: z.number().min(1).max(168).default(48), // 1 hour to 7 days
  }),
});

/**
 * Get offers query parameters  
 */
export const getOffersSchema = z.object({
  query: z.object({
    status: z.enum(['sent', 'accepted', 'rejected', 'expired', 'all']).optional().default('all'),
    role: z.enum(['buyer', 'seller', 'all']).optional().default('all'),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  }),
});

/**
 * Send offer request
 */
export const sendOfferSchema = z.object({
  body: z.object({
    amount: z.number().positive(),
    message: z.string().max(500).optional(),
    channel_id: z.string().optional(), // If replying in existing channel
    listing_id: z.string().min(1), // Required for new offers
  }),
});

/**
 * Accept/reject offer
 */
export const offerActionSchema = z.object({
  params: z.object({
    offerId: z.string().min(1),
  }),
  body: z.object({
    message: z.string().max(500).optional(),
  }).optional(),
});
