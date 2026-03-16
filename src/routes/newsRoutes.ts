import { Router, Request, Response, NextFunction } from "express";
import { News } from "../models/News";
import { ApiResponse } from "../types";
import { DatabaseError } from "../utils/errors";

const router = Router();

/**
 * Get active news and events for dashboard
 * GET /api/v1/news
 */
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = Number(req.query.limit) || 10;
      
      const news = await News.find({
        is_active: true,
        status: "published",
        $or: [
          { end_date: null },
          { end_date: { $gt: new Date() } }
        ]
      })
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit)
      .lean();

      const response: ApiResponse<any> = {
        data: news,
        requestId: req.headers["x-request-id"] as string,
      };

      res.json(response);
    } catch (error) {
      next(new DatabaseError("Failed to fetch news", error));
    }
  }
);

export { router as newsRoutes };
