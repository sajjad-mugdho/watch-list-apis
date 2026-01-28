import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common';

export const ISO_URGENCY_VALUES = ['low', 'medium', 'high', 'urgent'] as const;
export const ISO_STATUS_VALUES = ['active', 'fulfilled', 'expired', 'closed'] as const;

export const createISOSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').max(100, 'Title too long'),
    description: z.string().trim().max(1000, 'Description too long').optional(),
    criteria: z.record(z.any()).optional(),
    urgency: z.enum(ISO_URGENCY_VALUES).optional().default('medium'),
    is_public: z.boolean().optional().default(true),
    expires_at: z.string().datetime().optional(),
  }),
});

export const updateISOSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    title: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(1000).optional(),
    criteria: z.record(z.any()).optional(),
    urgency: z.enum(ISO_URGENCY_VALUES).optional(),
    is_public: z.boolean().optional(),
    expires_at: z.string().datetime().optional(),
    status: z.enum(ISO_STATUS_VALUES).optional(),
  }),
});

export const getISOsSchema = z.object({
  query: paginationSchema,
});

export const getMyISOsSchema = z.object({
  query: z.object({
    status: z.enum(['active', 'fulfilled', 'expired', 'closed', 'all']).optional(),
  }),
});

export const fulfillISOSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const deleteISOSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const getISOBIDSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});
