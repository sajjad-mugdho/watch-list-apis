/**
 * Common Validation Schemas
 *
 * Shared schemas used across multiple route modules.
 */

import { z } from 'zod';

/**
 * MongoDB ObjectId validation
 */
export const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ObjectId format');

/**
 * Pagination query parameters
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * ID parameter (generic)
 */
export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

/**
 * Platform enum
 */
export const platformSchema = z.enum(['marketplace', 'networks']);

/**
 * User ID parameter
 */
export const userIdParamSchema = z.object({
  params: z.object({
    userId: z.string().min(1),
  }),
});

/**
 * Listing ID parameter
 */
export const listingIdParamSchema = z.object({
  params: z.object({
    listingId: z.string().min(1),
  }),
});

/**
 * Date range query
 */
export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/**
 * Sort order
 */
export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');
