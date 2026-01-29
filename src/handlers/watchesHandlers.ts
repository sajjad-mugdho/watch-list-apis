import { Watch, IWatch } from "../models/Watches";
import { NextFunction, Request, Response } from "express";
import { GetWatchesInput } from "../validation/schemas";
import { ApiResponse } from "../types";
import { buildPaginationOptions } from "../utils/pagination";
import { DatabaseError } from "../utils/errors";

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
  next: NextFunction
): Promise<void> => {
  try {
    const q = (req.query.q ?? "").trim();
    const sort = (req.query.sort ?? "recent").toLowerCase() as
      | "recent"
      | "random";
    // Gap Fill Phase 2: Category filter
    const category = req.query.category;
    const { limit, skip } = buildPaginationOptions(
      req.query.limit,
      req.query.offset
    );

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

        // Gap Fill Phase 2: Apply category filter after search
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
        items = (faceted?.items ?? []) as IWatch[];
        total =
          Array.isArray(faceted?.meta) && faceted.meta.length > 0
            ? faceted.meta[0]?.total ?? 0
            : items.length;
      } catch (searchError) {
        // Atlas Search not configured, fall back to regex search
        console.log("Atlas Search failed, using regex fallback:", searchError);

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

        // Gap Fill Phase 2: Apply category filter
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

      // Gap Fill Phase 2: Apply category filter
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
          ? faceted.meta[0]?.total ?? 0
          : items.length;
    }

    const hasMore = sort === "random" ? false : skip + limit < total;

    const response: ApiResponse<IWatch[]> = {
      data: items,
      requestId: req.headers["x-request-id"] as string,
      _metadata: {
        q,
        count: items.length,
        total,
        pagination: { limit, offset: skip, hasMore },
        sortMode: sort, // Renamed from 'sort' to avoid conflict with SortMeta type
      },
    };

    res.json(response);
  } catch (err) {
    console.error(err);
    next(new DatabaseError("Failed to fetch watches", err));
  }
};
