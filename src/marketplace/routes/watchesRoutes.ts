/**
 * Marketplace Platform - Watch Routes
 * GET /api/v1/marketplace/watches - List watches with pricing metrics
 */

import { Router } from "express";
import { marketplace_watches_list } from "../handlers/WatchesHandlers";
import { validateRequest } from "../../middleware/validation";
import { z } from "zod";

const marketplaceWatchesSchema = z.object({
  query: z.object({
    q: z.string().optional(),
    category: z
      .enum([
        "Luxury",
        "Sport",
        "Dress",
        "Vintage",
        "Casual",
        "Dive",
        "Pilot",
        "Uncategorized",
      ])
      .optional(),
    condition: z.enum(["excellent", "very_good", "good", "fair"]).optional(),
    min_price: z.string().optional(),
    max_price: z.string().optional(),
    sort: z
      .enum([
        "recent",
        "price_low_to_high",
        "price_high_to_low",
        "most_available",
        "highest_rated",
      ])
      .optional(),
    limit: z.string().optional(),
    offset: z.string().optional(),
  }),
});

const router = Router();

/**
 * @swagger
 * /api/v1/marketplace/watches:
 *   get:
 *     summary: List watches with marketplace pricing metrics
 *     description: Authenticated endpoint that returns watches with pricing metrics (priceRange, inventoryLevel, merchantReputation) specific to Marketplace platform.
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
 *       - name: min_price
 *         in: query
 *         description: Minimum price filter (in cents)
 *         schema:
 *           type: string
 *       - name: max_price
 *         in: query
 *         description: Maximum price filter (in cents)
 *         schema:
 *           type: string
 *       - name: sort
 *         in: query
 *         description: Sort order (marketplace-specific options)
 *         schema:
 *           type: string
 *           enum: [recent, price_low_to_high, price_high_to_low, most_available, highest_rated]
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
 *         description: List of watches with pricing metrics
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
 *                       priceRange:
 *                         type: object
 *                         properties:
 *                           min:
 *                             type: number
 *                           max:
 *                             type: number
 *                           avg:
 *                             type: number
 *                       inventoryLevel:
 *                         type: integer
 *                         description: Available quantity
 *                       merchantReputation:
 *                         type: number
 *                         description: Average merchant rating (0-5)
 *                 _metadata:
 *                   type: object
 *                   properties:
 *                     platform:
 *                       type: string
 *                       example: marketplace
 *                     filters:
 *                       type: object
 *                       properties:
 *                         price:
 *                           type: object
 *                           properties:
 *                             min:
 *                               type: number
 *                             max:
 *                               type: number
 *       401:
 *         description: Unauthorized - authentication required
 *       400:
 *         description: Invalid query parameters
 */
router.get(
  "/",
  validateRequest(marketplaceWatchesSchema),
  marketplace_watches_list,
);

export default router;
