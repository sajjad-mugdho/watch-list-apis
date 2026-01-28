/**
 * User Search Routes
 * 
 * Endpoints for managing recent searches for the current authenticated user.
 * Mounted at: /api/v1/user/searches
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { recentSearchService } from "../../services";
import { validateRequest } from "../../middleware/validation";
import { User } from "../../models/User";
import { PLATFORM_VALUES, SEARCH_CONTEXT_VALUES } from "../../models/RecentSearch";

const router = Router();

// Validation Schemas
// EDGE CASE FIX #7: Platform is REQUIRED per Michael
// "Platform-based - Marketplace searches should not appear in Networks"
const addSearchSchema = z.object({
  body: z.object({
    query: z.string().min(1).max(200),
    platform: z.enum(PLATFORM_VALUES), // REQUIRED - no default
    context: z.enum(SEARCH_CONTEXT_VALUES).optional(),
    filters: z.record(z.any()).optional(),
    result_count: z.number().optional(),
  }),
});

const getSearchesSchema = z.object({
  query: z.object({
    platform: z.enum(PLATFORM_VALUES), // REQUIRED - no default
    limit: z.coerce.number().min(1).max(50).default(20),
  }),
});

const searchIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

/**
 * POST /api/v1/user/searches/recent
 */
router.post(
  "/recent",
  validateRequest(addSearchSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { query, platform, context, filters, result_count } = req.body;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const search = await recentSearchService.addSearch({
        userId: user._id.toString(),
        query,
        platform: platform as any,
        context: context as any,
        filters,
        resultCount: result_count,
      });

      res.status(201).json({ data: search });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/user/searches/recent
 */
router.get(
  "/recent",
  validateRequest(getSearchesSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { platform } = req.query as any;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const searches = await recentSearchService.getSearches(
        user._id.toString(),
        platform as any
      );

      res.json({ data: searches });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/user/searches/recent
 * Clear all searches
 */
router.delete(
  "/recent",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { platform } = req.query as any;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      await recentSearchService.clearSearches(user._id.toString(), platform as any);
      res.json({ success: true, message: "Recent searches cleared" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/user/searches/recent/:id
 */
router.delete(
  "/recent/:id",
  validateRequest(searchIdSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { id } = req.params;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      await recentSearchService.deleteSearch(user._id.toString(), id);
      res.json({ success: true, message: "Search entry deleted" });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  }
);

export { router as userSearchRoutes };
