/**
 * Networks Platform - Watch Catalog Handler
 * With engagement metrics and networking-specific features
 */

import { Watch } from "../../models/Watches";
import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import { buildPaginationOptions } from "../../utils/pagination";
import logger from "../../utils/logger";
import { DatabaseError } from "../../utils/errors";
import { watchCacheService } from "../../services/WatchCacheService";

// Escape special regex characters to prevent ReDoS attacks
const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/v1/networks/watches
 * Networks-specific with engagement metrics
 *
 * Filters:
 * - q: Search query
 * - category: Watch category
 * - condition: excellent, very_good, good, fair
 * - materials: Case materials
 * - brands: Comma-separated brands
 * - sort: recent|trending|popular|most_trusted
 */
export const networks_watches_list = async (
  req: Request,
  res: Response<ApiResponse<any[]>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = ((req.query.q as string) || "").trim();
    const category = req.query.category as string;
    const condition = req.query.condition as string;
    const materials = req.query.materials as string;
    const brands = ((req.query.brands as string) || "")
      .split(",")
      .filter(Boolean);
    const sort = ((req.query.sort as string) || "recent").toLowerCase();

    const limitParsed = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : undefined;
    const offsetParsed = req.query.offset
      ? parseInt(req.query.offset as string, 10)
      : undefined;
    const { limit, skip } = buildPaginationOptions(limitParsed, offsetParsed);

    // Build cache params
    const cacheParams = {
      q: q || undefined,
      category,
      condition,
      materials,
      brands,
      sort,
      limit,
      skip,
    };

    // CHECK CACHE
    const cached = watchCacheService.get("networks", cacheParams);
    if (cached) {
      const { watches: cachedWatches, total: cachedTotal, hasMore: cachedHasMore } = cached.data as any;
      res.json({
        data: cachedWatches,
        requestId: req.headers["x-request-id"] as string,
        _metadata: {
          platform: "networks",
          count: cachedWatches.length,
          total: cachedTotal,
          cached: true,
          cacheAge: cached.age,
          hitCount: cached.hitCount,
          pagination: { limit, offset: skip, hasMore: cachedHasMore },
          filters: { q, category, condition, materials, brands },
        },
      });
      return;
    }

    // Build match stage
    const matchStage: Record<string, any> = {};
    if (q) matchStage.$text = { $search: q };
    if (category) matchStage.category = category;
    if (condition) matchStage.condition = condition;
    if (materials) matchStage.materials = { $regex: escapeRegex(materials), $options: "i" };
    if (brands.length > 0) matchStage.brand = { $in: brands };

    // Build aggregation pipeline
    const pipeline: any[] = [];

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Add engagement metrics
    pipeline.push({
      $lookup: {
        from: "networklistings",
        let: { watchId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$watch", "$$watchId"] },
              status: { $in: ["active", "reserved", "sold"] },
              is_deleted: { $ne: true },
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              trustedCount: { $sum: { $cond: ["$seller_verified", 1, 0] } },
              watchersTotal: { $sum: "$watchers_count" },
            },
          },
        ],
        as: "networkMetrics",
      },
    });

    // Add computed fields
    pipeline.push({
      $addFields: {
        usageCount: {
          $cond: [
            { $gt: [{ $size: "$networkMetrics" }, 0] },
            { $arrayElemAt: ["$networkMetrics.count", 0] },
            0,
          ],
        },
        trustedSellersCount: {
          $cond: [
            { $gt: [{ $size: "$networkMetrics" }, 0] },
            { $arrayElemAt: ["$networkMetrics.trustedCount", 0] },
            0,
          ],
        },
        watchersCount: {
          $cond: [
            { $gt: [{ $size: "$networkMetrics" }, 0] },
            { $arrayElemAt: ["$networkMetrics.watchersTotal", 0] },
            0,
          ],
        },
      },
    });

    // Sort
    const sortStage: Record<string, any> = {};
    const sortValue = sort;
    switch (sortValue) {
      case "trending":
        sortStage.createdAt = -1;
        sortStage.watchersCount = -1;
        break;
      case "popular":
        sortStage.usageCount = -1;
        sortStage.createdAt = -1;
        break;
      case "most_trusted":
        sortStage.trustedSellersCount = -1;
        sortStage.createdAt = -1;
        break;
      default:
        sortStage.createdAt = -1;
    }

    pipeline.push({ $sort: sortStage });

    // Pagination
    pipeline.push({
      $facet: {
        items: [...(skip > 0 ? [{ $skip: skip }] : []), { $limit: limit }],
        metadata: [{ $count: "total" }],
      },
    });

    const [result] = (await Watch.aggregate(pipeline).exec()) as any[];
    const watches = (result?.items ?? []) as any[];
    const total =
      Array.isArray(result?.metadata) && result.metadata.length > 0
        ? (result.metadata[0]?.total ?? 0)
        : watches.length;
    const hasMore = skip + limit < total;

    // STORE IN CACHE (24 hours) - include pagination metadata
    watchCacheService.set("networks", cacheParams, {
      watches,
      total,
      hasMore,
    });

    const response: ApiResponse<any[]> = {
      data: watches,
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        platform: "networks",
        count: watches.length,
        total,
        pagination: { limit, offset: skip, hasMore },
        filters: { q, category, condition, materials, brands },
      } as any,
    };

    res.json(response);
  } catch (err) {
    logger.error("Networks watches error", { error: err });
    next(new DatabaseError("Failed to fetch watches", err));
  }
};
