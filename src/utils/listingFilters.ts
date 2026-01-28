/**
 * Shared utility for building listing filter queries
 * Standardizes filtering logic between marketplace and networks
 */

export interface ListingFilterInput {
  q?: string;
  brand?: string;
  condition?: string;
  min_price?: number;
  max_price?: number;
  allow_offers?: boolean;
}

/**
 * Build a MongoDB filter query for listings
 * @param input - Filter parameters from query string
 * @param includeOffersFilter - Whether to include allow_offers in filter (marketplace now supports it)
 * @returns MongoDB filter object
 */
export function buildListingFilter(
  input: ListingFilterInput,
  includeOffersFilter: boolean = true
): Record<string, any> {
  const { q, brand, condition, min_price, max_price, allow_offers } = input;

  const filter: any = {
    status: "active",
  };

  // Search query (searches brand, model, reference)
  if (q) {
    filter.$or = [
      { brand: { $regex: q, $options: "i" } },
      { model: { $regex: q, $options: "i" } },
      { reference: { $regex: q, $options: "i" } },
    ];
  }

  // Brand filter
  if (brand) {
    filter.brand = { $regex: `^${brand}$`, $options: "i" };
  }

  // Condition filter
  if (condition) {
    filter.condition = condition;
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
  sort_by?: "price" | "created" | "updated",
  sort_order?: "asc" | "desc"
): Record<string, 1 | -1> {
  const sortField =
    sort_by === "created"
      ? "createdAt"
      : sort_by === "updated"
      ? "updatedAt"
      : "price";
  const sortDirection: 1 | -1 = sort_order === "asc" ? 1 : -1;
  return { [sortField]: sortDirection };
}
