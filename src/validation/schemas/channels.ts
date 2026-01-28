/**
 * Shared Channel Schemas
 *
 * Centralized Zod schemas for channel-related routes.
 * Used by both Marketplace and Networks channel routes.
 */

import { z } from 'zod';

/**
 * GET /channels - Query parameters
 */
export const getChannelsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    status: z.enum(['open', 'closed', 'all']).optional().default('all'),
  }),
});

/**
 * GET /channels/:channelId/messages - Path and query parameters
 */
export const getMessagesSchema = z.object({
  params: z.object({
    channelId: z.string().min(1),
  }),
  query: z.object({
    limit: z.coerce.number().min(1).max(100).default(50),
    before: z.string().optional(), // message ID for pagination
  }),
});

/**
 * POST /channels/:channelId/messages - Send message
 */
export const sendMessageSchema = z.object({
  params: z.object({
    channelId: z.string().min(1),
  }),
  body: z.object({
    text: z.string().min(1).max(4000),
    attachments: z.array(z.object({
      type: z.enum(['image', 'file', 'video']),
      url: z.string().url(),
      name: z.string().optional(),
      size: z.number().optional(),
    })).optional(),
    parent_id: z.string().optional(), // For replies
    custom_data: z.record(z.any()).optional(),
  }),
});

/**
 * Channel ID parameter only
 */
export const channelIdParamSchema = z.object({
  params: z.object({
    channelId: z.string().min(1),
  }),
});
