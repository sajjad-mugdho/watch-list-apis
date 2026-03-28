/**
 * Shared utility for building listing filter queries
 * Standardizes filtering logic between marketplace and networks
 */

/**
 * Escape regex metacharacters in user input to prevent injection/ReDoS attacks
 * @param value - Raw user input string
 * @returns Escaped string safe to use in MongoDB $regex
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type ListingQueryMode = "regex" | "text";

export interface ListingFilterInput {
  q?: string;
  brand?: string;
  condition?: string;
  category?: string;
  contents?: string;
  year_min?: number;
  year_max?: number;
  min_price?: number;
  max_price?: number;
  allow_offers?: boolean;
  is_featured?: boolean;
}

/**
 * Build a MongoDB filter query for listings
 * @param input - Filter parameters from query string
 * @param includeOffersFilter - Whether to include allow_offers in filter (marketplace now supports it)
 * @param queryMode - "regex" for keyword search, "text" for full-text search (skip regex $or when using $text)
 * @returns MongoDB filter object
 */
export function buildListingFilter(
  input: ListingFilterInput,
  includeOffersFilter: boolean = true,
  queryMode: ListingQueryMode = "regex",
): Record<string, any> {
  const {
    q,
    brand,
    condition,
    category,
    contents,
    year_min,
    year_max,
    min_price,
    max_price,
    allow_offers,
    is_featured,
  } = input;

  const filter: any = {
    status: "active",
  };

  if (is_featured !== undefined) {
    filter.is_featured = is_featured;
  }

  // Search query (searches brand, model, reference)
  // Skip regex $or if using $text search mode (prevents combined query semantics)
  if (q && queryMode === "regex") {
    filter.$or = [
      { brand: { $regex: escapeRegex(q), $options: "i" } },
      { model: { $regex: escapeRegex(q), $options: "i" } },
      { reference: { $regex: escapeRegex(q), $options: "i" } },
      { title: { $regex: escapeRegex(q), $options: "i" } },
    ];
  }

  // Brand filter
  if (brand) {
    filter.brand = {
      $regex: `^${escapeRegex(brand)}$`,
      $options: "i",
    };
  }

  // Category filter (enum-like, escape to prevent injection)
  if (category) {
    filter.category = {
      $regex: `^${escapeRegex(category)}$`,
      $options: "i",
    };
  }

  // Condition filter
  if (condition) {
    filter.condition = condition;
  }

  // Contents filter (escape to prevent regex injection/ReDoS)
  if (contents) {
    filter.contents = {
      $regex: escapeRegex(contents),
      $options: "i",
    };
  }

  // Year range filter
  if (year_min !== undefined || year_max !== undefined) {
    filter.year = {};
    if (year_min !== undefined) {
      filter.year.$gte = year_min;
    }
    if (year_max !== undefined) {
      filter.year.$lte = year_max;
    }
  }

  // Price range filters
  if (min_price !== undefined || max_price !== undefined) {
    filter.price = {};
    if (min_price !== undefined) {
      filter.price.$gte = min_price;
    }
    if (max_price !== undefined) {
      filter.price.$lte = max_price;
    }
  }

  // Offers filter (only if enabled for this listing type)
  if (includeOffersFilter && allow_offers !== undefined) {
    filter.allow_offers = allow_offers;
  }

  return filter;
}

/**
 * Build sort options for listing queries
 * @param sort_by - Field to sort by
 * @param sort_order - Sort direction
 * @returns MongoDB sort object
 */
export function buildListingSort(
  sort_by?: "price" | "created" | "updated" | "popularity" | "relevance",
  sort_order?: "asc" | "desc",
): Record<string, 1 | -1> {
  const sortField =
    sort_by === "created"
      ? "createdAt"
      : sort_by === "updated"
        ? "updatedAt"
        : sort_by === "popularity"
          ? "view_count"
          : sort_by === "relevance"
            ? "createdAt"
            : "price";
  const sortDirection: 1 | -1 = sort_order === "asc" ? 1 : -1;
  return { [sortField]: sortDirection };
}
