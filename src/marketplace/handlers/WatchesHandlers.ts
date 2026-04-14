/**
 * Marketplace Platform - Watch Catalog Handler
 * With pricing metrics and inventory
 */

import { Watch } from "../../models/Watches";
import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import { buildPaginationOptions } from "../../utils/pagination";
import logger from "../../utils/logger";
import { DatabaseError } from "../../utils/errors";
import { watchCacheService } from "../../services/WatchCacheService";

/**
 * GET /api/v1/marketplace/watches
 * Marketplace-specific with pricing metrics
 *
 * Filters:
 * - q: Search query
 * - category: Watch category
 * - condition: Watch condition
 * - min_price/max_price: Price range
 * - sort: recent|price_low_to_high|price_high_to_low|most_available|highest_rated
 */
export const marketplace_watches_list = async (
  req: Request,
  res: Response<ApiResponse<any[]>>,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = ((req.query.q as string) || "").trim();
    const category = req.query.category as string;
    const condition = req.query.condition as string;
    const min_price = req.query.min_price
      ? ((v) => (isNaN(v) ? undefined : v))(
          parseFloat(req.query.min_price as string),
        )
      : undefined;
    const max_price = req.query.max_price
      ? ((v) => (isNaN(v) ? undefined : v))(
          parseFloat(req.query.max_price as string),
        )
      : undefined;
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
      min_price,
      max_price,
      sort,
      limit,
      skip,
    };

    // CHECK CACHE
    const cached = watchCacheService.get("marketplace", cacheParams);
    if (cached) {
      const {
        watches: cachedWatches,
        total: cachedTotal,
        hasMore: cachedHasMore,
      } = cached.data as any;
      res.json({
        data: cachedWatches,
        requestId: req.headers["x-request-id"] as string,
        _metadata: {
          platform: "marketplace",
          count: cachedWatches.length,
          total: cachedTotal,
          cached: true,
          cacheAge: cached.age,
          hitCount: cached.hitCount,
          pagination: { limit, offset: skip, hasMore: cachedHasMore },
          filters: {
            q,
            category,
            condition,
            price: { min: min_price, max: max_price },
          },
        },
      });
      return;
    }

    // Build aggregation pipeline
    const pipeline: any[] = [];

    // Build initial match stage with search and category/condition filters
    const matchStage: Record<string, any> = {};

    // Try text search first
    if (q) {
      try {
        matchStage.$text = { $search: q };
      } catch (textSearchErr) {
        // Text search not available, use regex fallback
        logger.warn("Text search unavailable, using regex fallback");
        const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        matchStage.$or = [
          { brand: { $regex: escapedQuery, $options: "i" } },
          { model: { $regex: escapedQuery, $options: "i" } },
          { reference: { $regex: escapedQuery, $options: "i" } },
          { bracelet: { $regex: escapedQuery, $options: "i" } },
          { color: { $regex: escapedQuery, $options: "i" } },
          { materials: { $regex: escapedQuery, $options: "i" } },
        ];
      }
    }

    if (category) matchStage.category = category;
    if (condition) matchStage.condition = condition;

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Add pricing metrics
    pipeline.push({
      $lookup: {
        from: "marketplacelistings",
        let: { watchId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$watch", "$$watchId"] },
              status: { $in: ["active", "reserved"] },
              is_deleted: { $ne: true },
            },
          },
          {
            $group: {
              _id: null,
              totalListings: { $sum: 1 },
              avgPrice: { $avg: "$price" },
              minPrice: { $min: "$price" },
              maxPrice: { $max: "$price" },
              avgRating: { $avg: "$seller_rating" },
              totalSales: { $sum: "$sales_count" },
            },
          },
        ],
        as: "marketplaceMetrics",
      },
    });

    // Add computed fields
    pipeline.push({
      $addFields: {
        inventoryLevel: {
          $cond: [
            { $gt: [{ $size: "$marketplaceMetrics" }, 0] },
            { $arrayElemAt: ["$marketplaceMetrics.totalListings", 0] },
            0,
          ],
        },
        priceRange: {
          $cond: [
            { $gt: [{ $size: "$marketplaceMetrics" }, 0] },
            {
              min: { $arrayElemAt: ["$marketplaceMetrics.minPrice", 0] },
              max: { $arrayElemAt: ["$marketplaceMetrics.maxPrice", 0] },
              avg: {
                $round: [
                  { $arrayElemAt: ["$marketplaceMetrics.avgPrice", 0] },
                  2,
                ],
              },
            },
            null,
          ],
        },
        merchantReputation: {
          $cond: [
            { $gt: [{ $size: "$marketplaceMetrics" }, 0] },
            { $arrayElemAt: ["$marketplaceMetrics.avgRating", 0] },
            null,
          ],
        },
      },
    });

    // Price filtering
    if (min_price || max_price) {
      const priceMatch: Record<string, any> = {};
      if (min_price !== undefined) {
        priceMatch["priceRange.min"] = { $gte: min_price };
      }
      if (max_price !== undefined) {
        priceMatch["priceRange.max"] = { $lte: max_price };
      }
      pipeline.push({ $match: priceMatch });
    }

    // Sort
    const sortStage: Record<string, any> = {};
    const sortValue = sort;
    switch (sortValue) {
      case "price_low_to_high":
        sortStage["priceRange.min"] = 1;
        break;
      case "price_high_to_low":
        sortStage["priceRange.max"] = -1;
        break;
      case "most_available":
        sortStage.inventoryLevel = -1;
        sortStage.createdAt = -1;
        break;
      case "highest_rated":
        sortStage.merchantReputation = -1;
        sortStage.createdAt = -1;
        break;
      default:
        sortStage.createdAt = -1;
    }

    pipeline.push({ $sort: sortStage });

    // Project all watch fields before pagination
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
        inventoryLevel: 1,
        priceRange: 1,
        merchantReputation: 1,
        createdAt: 1,
        _id: 1,
      },
    });

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

    // STORE IN CACHE (24 hours)
    watchCacheService.set("marketplace", cacheParams, watches);

    const response: ApiResponse<any[]> = {
      data: watches,
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        platform: "marketplace",
        count: watches.length,
        total,
        pagination: { limit, offset: skip, hasMore: skip + limit < total },
        filters: {
          q,
          category,
          condition,
          price: { min: min_price, max: max_price },
        },
      } as any,
    };

    res.json(response);
  } catch (err) {
    logger.error("Marketplace watches error", { error: err });
    next(new DatabaseError("Failed to fetch watches", err));
  }
};
