import { Watch, IWatch } from "../models/Watches";
import { NextFunction, Request, Response } from "express";
import { GetWatchesInput } from "../validation/schemas";
import { ApiResponse } from "../types";
import { buildPaginationOptions } from "../utils/pagination";
import logger from "../utils/logger";
import { DatabaseError } from "../utils/errors";
import { watchCacheService } from "../services/WatchCacheService";

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
      res.json({
        data: cached.data as IWatch[],
        requestId: req.headers["x-request-id"] as string,
        _metadata: {
          platform: "public",
          cached: true,
          cacheAge: cached.age,
          hitCount: cached.hitCount,
          pagination: { limit, offset: skip, hasMore: false },
        } as any,
      });
      return;
    }

    let items: IWatch[] = [];
    let total = 0;

    if (q.length > 0) {
      // Try Atlas Search first, fall back to regex if it fails
      try {
        const pipeline: any[] = [];
        pipeline.push({
          $search: {
            index: "default",
            compound: {
              should: [
                {
                  autocomplete: {
                    query: q,
                    path: "brand",
                    fuzzy: { maxEdits: 1 },
                  },
                },
                {
                  autocomplete: {
                    query: q,
                    path: "model",
                    fuzzy: { maxEdits: 1 },
                  },
                },
                { autocomplete: { query: q, path: "reference" } },
                { autocomplete: { query: q, path: "bracelet" } },
                { autocomplete: { query: q, path: "color" } },
                { autocomplete: { query: q, path: "materials" } },
              ],
              minimumShouldMatch: 1,
            },
          },
        });

        // Apply category filter after search
        if (category) {
          pipeline.push({ $match: { category } });
        }

        pipeline.push({
          $facet: {
            items: [...(skip ? [{ $skip: skip }] : []), { $limit: limit }],
            meta: [{ $count: "total" }],
          },
        });

        const [faceted] = await Watch.aggregate(pipeline).exec();
        items = ((faceted as any)?.items ?? []) as IWatch[];
        total =
          Array.isArray((faceted as any)?.meta) &&
          (faceted as any).meta.length > 0
            ? ((faceted as any).meta[0]?.total ?? 0)
            : items.length;
      } catch (searchError) {
        // Atlas Search not configured, fall back to regex search
        logger.warn("Atlas Search failed, using regex fallback", {
          searchError,
        });

        const searchRegex = new RegExp(q, "i");
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

    // STORE IN CACHE (24 hours)
    watchCacheService.set("public", cacheParams, items);

    const response: ApiResponse<IWatch[]> = {
      data: items,
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        q,
        count: items.length,
        total,
        pagination: { limit, offset: skip, hasMore },
      } as any, // Use any to allow custom metadata shape
    };

    res.json(response);
  } catch (err) {
    logger.error("Error fetching watches", { error: err });
    next(new DatabaseError("Failed to fetch watches", err));
  }
};
