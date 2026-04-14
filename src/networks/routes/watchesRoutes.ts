/**
 * Networks Platform - Watch Routes
 * GET /api/v1/networks/watches - List watches with engagement metrics
 */

import { Router } from "express";
import { networks_watches_list } from "../handlers/WatchesHandlers";
import { validateRequest } from "../../middleware/validation";
import { z } from "zod";

const networkWatchesSchema = z.object({
  q: z.string().optional(),
  category: z.enum([
    "Luxury",
    "Sport",
    "Dress",
    "Vintage",
    "Casual",
    "Dive",
    "Pilot",
    "Uncategorized",
  ]).optional(),
  condition: z.enum(["excellent", "very_good", "good", "fair"]).optional(),
  materials: z.string().optional(),
  brands: z.string().optional(),
  sort: z.enum(["recent", "trending", "popular", "most_trusted"]).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const router = Router();

/**
 * @swagger
 * /api/v1/networks/watches:
 *   get:
 *     summary: List watches with networks engagement metrics
 *     description: Authenticated endpoint that returns watches with engagement metrics (usageCount, trustedSellersCount, watchersCount) specific to Networks platform.
 *     tags: [Watches]
 *     security:
 *       - mockUser: []
 *       - bearerAuth: []
 *     parameters:
 *       - name: q
 *         in: query
 *         description: Search query (searches brand, model, reference)
 *         schema:
 *           type: string
 *           example: Rolex
 *       - name: category
 *         in: query
 *         description: Filter by watch category
 *         schema:
 *           type: string
 *           enum: [Luxury, Sport, Dress, Vintage, Casual, Dive, Pilot, Uncategorized]
 *       - name: condition
 *         in: query
 *         description: Filter by watch condition
 *         schema:
 *           type: string
 *           enum: [excellent, very_good, good, fair]
 *       - name: brands
 *         in: query
 *         description: Filter by brands (comma-separated)
 *         schema:
 *           type: string
 *           example: Rolex,Omega
 *       - name: materials
 *         in: query
 *         description: Filter by materials
 *         schema:
 *           type: string
 *       - name: sort
 *         in: query
 *         description: Sort order (networks-specific options)
 *         schema:
 *           type: string
 *           enum: [recent, trending, popular, most_trusted]
 *           default: recent
 *       - name: limit
 *         in: query
 *         description: Results per page (1-50)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *       - name: offset
 *         in: query
 *         description: Pagination offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: List of watches with engagement metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       brand:
 *                         type: string
 *                       model:
 *                         type: string
 *                       usageCount:
 *                         type: integer
 *                         description: Number of network listings
 *                       trustedSellersCount:
 *                         type: integer
 *                         description: Number of verified sellers
 *                       watchersCount:
 *                         type: integer
 *                         description: Total watchers
 *                 _metadata:
 *                   type: object
 *                   properties:
 *                     platform:
 *                       type: string
 *                       example: networks
 *       401:
 *         description: Unauthorized - authentication required
 *       400:
 *         description: Invalid query parameters
 */
router.get("/", validateRequest(networkWatchesSchema), networks_watches_list);

export default router;
