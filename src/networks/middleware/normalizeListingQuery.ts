import { NextFunction, Request, Response } from "express";

const sortAliasMap: Record<
  string,
  { sort_by: string; sort_order: "asc" | "desc" }
> = {
  relevance: { sort_by: "relevance", sort_order: "desc" },
  priceAsc: { sort_by: "price", sort_order: "asc" },
  priceDesc: { sort_by: "price", sort_order: "desc" },
  mostPopular: { sort_by: "popularity", sort_order: "desc" },
  newest: { sort_by: "created", sort_order: "desc" },
};

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const parseNonNegativeInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

/**
 * Normalizes legacy listing/search query aliases into one canonical shape.
 * Canonical keys: year_min/year_max, sort_by/sort_order, page/limit.
 */
export const normalizeListingQuery = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const query = req.query as Record<string, any>;

  if (query.year_min === undefined && query.min_year !== undefined) {
    query.year_min = query.min_year;
  }

  if (query.year_max === undefined && query.max_year !== undefined) {
    query.year_max = query.max_year;
  }

  if (query.sort_by === undefined && typeof query.sort === "string") {
    const mappedSort = sortAliasMap[query.sort];
    if (mappedSort) {
      query.sort_by = mappedSort.sort_by;
      if (query.sort_order === undefined) {
        query.sort_order = mappedSort.sort_order;
      }
    }
  }

  if (query.page === undefined && query.offset !== undefined) {
    const limit = parsePositiveInt(query.limit, 20);
    const offset = parseNonNegativeInt(query.offset, 0);
    // Keep query values string-like for downstream Zod query schemas.
    query.page = String(Math.floor(offset / limit) + 1);
  }

  if (typeof query.allow_offers === "boolean") {
    query.allow_offers = query.allow_offers ? "true" : "false";
  }

  next();
};
