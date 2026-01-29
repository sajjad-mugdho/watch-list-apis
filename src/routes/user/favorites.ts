/**
 * User Favorite Routes
 * 
 * Endpoints for managing favorites for the current authenticated user.
 * Mounted at: /api/v1/user/favorites
 * 
 * Note: req.user is populated by attachUser middleware applied at parent router.
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { favoriteService } from "../../services";
import { validateRequest } from "../../middleware/validation";
import { getUserId } from "../../middleware/attachUser";
import { FAVORITE_TYPE_VALUES } from "../../models/Favorite";

const router = Router();

// Validation Schemas
// Platform is REQUIRED - Marketplace favorites should NOT appear in Networks
// Only for_sale and wtb types allowed (FAVORITE_TYPE_VALUES updated)
const addFavoriteSchema = z.object({
  body: z.object({
    item_type: z.enum(FAVORITE_TYPE_VALUES),
    item_id: z.string().min(1),
    platform: z.enum(["marketplace", "networks"]), // REQUIRED
  }),
});

const getFavoritesSchema = z.object({
  query: z.object({
    type: z.enum(FAVORITE_TYPE_VALUES).optional(),
    platform: z.enum(["marketplace", "networks"]), // REQUIRED
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  }),
});

const favoriteCheckSchema = z.object({
  params: z.object({
    type: z.enum(FAVORITE_TYPE_VALUES),
    id: z.string().min(1),
  }),
  query: z.object({
    platform: z.enum(["marketplace", "networks"]), // REQUIRED
  }),
});

/**
 * POST /api/v1/user/favorites
 * Add an item to favorites
 */
router.post(
  "/",
  validateRequest(addFavoriteSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { item_type, item_id, platform } = req.body;

      const favorite = await favoriteService.addFavorite({
        userId,
        itemType: item_type,
        itemId: item_id,
        platform: platform as any,
      });

      res.status(201).json({ data: favorite });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already in favorites")) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/user/favorites
 * Get current user's favorites
 */
router.get(
  "/",
  validateRequest(getFavoritesSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { type, platform, limit, offset } = req.query as any;

      const { favorites, total } = await favoriteService.getFavorites(userId, {
        itemType: type,
        platform,
        limit,
        offset,
      });

      res.json({
        data: favorites,
        total,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/user/favorites/check/:type/:id
 * Check if an item is favorited
 */
router.get(
  "/check/:type/:id",
  validateRequest(favoriteCheckSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { type, id } = req.params;
      const { platform } = req.query as any;

      const isFavorited = await favoriteService.isFavorited({
        userId,
        itemType: type as any,
        itemId: id,
        platform: platform as any,
      });

      res.json({ is_favorited: isFavorited });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/user/favorites/:type/:id
 */
router.delete(
  "/:type/:id",
  validateRequest(favoriteCheckSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { type, id } = req.params;
      const { platform } = req.query as any;

      await favoriteService.removeFavorite({
        userId,
        itemType: type as any,
        itemId: id,
        platform: platform as any,
      });

      res.json({ success: true, message: "Favorite removed" });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  }
);

export { router as userFavoriteRoutes };
