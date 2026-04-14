import { Router } from "express";
import { watches_list_get } from "../handlers/watchesHandlers";
import { validateRequest } from "../middleware/validation";
import { getWatchesSchema } from "../validation/schemas";

const router = Router();

/**
 * @swagger
 * /api/v1/watches:
 *   get:
 *     summary: List all watches with search, filtering, and pagination
 *     description: Public endpoint to browse watches across all platforms. Supports full-text search, category filtering, pagination, and sorting.
 *     tags: [Watches]
 *     parameters:
 *       - name: q
 *         in: query
 *         description: Search query (searches brand, model, reference, bracelet, color, materials)
 *         schema:
 *           type: string
 *           example: Rolex
 *       - name: category
 *         in: query
 *         description: Filter by watch category
 *         schema:
 *           type: string
 *           enum: [Luxury, Sport, Dress, Vintage, Casual, Dive, Pilot, Uncategorized]
 *           example: Luxury
 *       - name: sort
 *         in: query
 *         description: Sort order
 *         schema:
 *           type: string
 *           enum: [recent, random]
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
 *         description: List of watches
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
 *                       reference:
 *                         type: string
 *                       diameter:
 *                         type: string
 *                       category:
 *                         type: string
 *                       condition:
 *                         type: string
 *                       images:
 *                         type: object
 *                 _metadata:
 *                   type: object
 *                   properties:
 *                     q:
 *                       type: string
 *                     count:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     platform:
 *                       type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         limit:
 *                           type: integer
 *                         offset:
 *                           type: integer
 *                         hasMore:
 *                           type: boolean
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 */
router.get("/", validateRequest(getWatchesSchema), watches_list_get);

export default router;
