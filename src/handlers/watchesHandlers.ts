import { Watch, IWatch } from "../models/Watches";
import { NextFunction, Request, Response } from "express";
import { GetWatchesInput } from "../validation/schemas";
import { ApiResponse } from "../types";
import { buildPaginationOptions } from "../utils/pagination";
import logger from "../utils/logger";
import { DatabaseError } from "../utils/errors";
import { watchCacheService } from "../services/WatchCacheService";

/**
 * Escape regex metacharacters in user input to prevent injection/ReDoS attacks
 */
function escapeRegexChars(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ----------------------------------------------------------
// Handler Functions
// ----------------------------------------------------------

/**
 * Get watches list with search, sorting, and pagination
 * GET /api/v1/watches
 */
export const watches_list_get = async (
  req: Request<{}, {}, {}, GetWatchesInput["query"]>,
  res: Response<ApiResponse<IWatch[]>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = (req.query.q ?? "").trim();
    const sort = (req.query.sort ?? "recent").toLowerCase() as
      | "recent"
      | "random";
    // Category filter
    const category = req.query.category;
    const { limit, skip } = buildPaginationOptions(
      req.query.limit,
      req.query.offset,
    );

    // CHECK CACHE
    const cacheParams = { q: q || undefined, category, sort, limit, skip };
    const cached = watchCacheService.get("public", cacheParams);
    if (cached) {
      const { items, total, hasMore, q: cachedQ, count } = cached.data as any;
      res.json({
        data: items,
        requestId: req.headers["x-request-id"] as string,
        _metadata: {
          q: cachedQ,
          count,
          total,
          pagination: { limit, offset: skip, hasMore },
        } as any,
      });
      return;
    }

    let items: IWatch[] = [];
    let total = 0;

    if (q.length > 0) {
      // Build match stage with text search
      const matchStage: Record<string, any> = {};
      matchStage.$text = { $search: q };
      if (category) matchStage.category = category;

      // Build aggregation pipeline with text search
      const pipeline: any[] = [{ $match: matchStage }];

      // Add explicit projection to ensure all fields including images
      pipeline.push({
        $project: {
          brand: 1,
          model: 1,
          reference: 1,
          diameter: 1,
          color: 1,
          bezel: 1,
          materials: 1,
          bracelet: 1,
          images: 1,
          category: 1,
          condition: 1,
          createdAt: 1,
          _id: 1,
          score: { $meta: "textScore" },
        },
      });

      pipeline.push({
        $facet: {
          items: [
            { $sort: { score: { $meta: "textScore" } } },
            ...(skip ? [{ $skip: skip }] : []),
            { $limit: limit },
          ],
          meta: [{ $count: "total" }],
        },
      });

      try {
        const [faceted] = await Watch.aggregate(pipeline).exec();
        items = ((faceted as any)?.items ?? []) as IWatch[];
        total =
          Array.isArray((faceted as any)?.meta) &&
          (faceted as any).meta.length > 0
            ? ((faceted as any).meta[0]?.total ?? 0)
            : items.length;
      } catch (searchError) {
        // Text search failed, fall back to regex search
        logger.warn("Text search failed, using regex fallback", {
          searchError,
        });

        // Escape regex metacharacters to prevent injection attacks
        const escapedQuery = escapeRegexChars(q);
        const searchRegex = new RegExp(escapedQuery, "i");
        const filter: Record<string, any> = {
          $or: [
            { brand: searchRegex },
            { model: searchRegex },
            { reference: searchRegex },
            { bracelet: searchRegex },
            { color: searchRegex },
            { materials: searchRegex },
          ],
        };

        // Apply category filter
        if (category) {
          filter.category = category;
        }

        // Get total count
        total = await Watch.countDocuments(filter);

        // Get paginated results
        items = (await Watch.find(filter)
          .select({
            brand: 1,
            model: 1,
            reference: 1,
            diameter: 1,
            color: 1,
            bezel: 1,
            materials: 1,
            bracelet: 1,
            images: 1,
            category: 1,
            condition: 1,
            createdAt: 1,
            _id: 1,
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()) as IWatch[];
      }
    } else {
      // No search query
      const pipeline: any[] = [];

      // Apply category filter
      if (category) {
        pipeline.push({ $match: { category } });
      }

      // Add explicit projection to ensure all fields including images
      pipeline.push({
        $project: {
          brand: 1,
          model: 1,
          reference: 1,
          diameter: 1,
          color: 1,
          bezel: 1,
          materials: 1,
          bracelet: 1,
          images: 1,
          category: 1,
          condition: 1,
          createdAt: 1,
          _id: 1,
        },
      });

      if (sort === "random") {
        pipeline.push({ $sample: { size: limit } });
        pipeline.push({
          $facet: {
            items: [{ $match: {} }],
            meta: [{ $count: "total" }],
          },
        });
      } else {
        // Recent
        pipeline.push({ $sort: { createdAt: -1 } });
        pipeline.push({
          $facet: {
            items: [...(skip ? [{ $skip: skip }] : []), { $limit: limit }],
            meta: [{ $count: "total" }],
          },
        });
      }

      const [faceted] = await Watch.aggregate(pipeline).exec();
      items = (faceted?.items ?? []) as IWatch[];
      total =
        Array.isArray(faceted?.meta) && faceted.meta.length > 0
          ? (faceted.meta[0]?.total ?? 0)
          : items.length;
    }

    const hasMore = sort === "random" ? false : skip + limit < total;

    // Cache results for 24 hours
    watchCacheService.set("public", cacheParams, {
      items,
      total,
      hasMore,
      q,
      count: items.length,
    });

    const response: ApiResponse<IWatch[]> = {
      data: items,
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        q,
        count: items.length,
        total,
        pagination: { limit, offset: skip, hasMore },
      } as any,
    };

    res.json(response);
  } catch (err) {
    logger.error("Error fetching watches", { error: err });
    next(new DatabaseError("Failed to fetch watches", err));
  }
};
