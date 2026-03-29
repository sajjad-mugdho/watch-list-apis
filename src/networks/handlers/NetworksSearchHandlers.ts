import { Request, Response, NextFunction } from "express";
import { NetworkListing } from "../models/NetworkListing";
import { ISO } from "../../models/ISO";
import { User } from "../../models/User";
import { getUserId } from "../../middleware/attachUser";
import { recentSearchService } from "../../services";
import logger from "../../utils/logger";
import { GetNetworksSearchInput } from "../../validation/schemas";
import {
  buildListingFilter,
  buildListingSort,
} from "../../utils/listingFilters";

/**
 * Unified Search Gateway
 * GET /v1/networks/search
 * Query params: q, type (listing|iso|user), limit, offset
 */
export const unifiedSearch = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const queryInput = req.query as unknown as GetNetworksSearchInput["query"];
    const {
      q = "",
      type,
      limit = 20,
      page = 1,
      brand,
      condition,
      category,
      contents,
      year_min,
      year_max,
      min_price,
      max_price,
      allow_offers,
      sort_by = "created",
      sort_order = "desc",
    } = queryInput;

    const query = String(q).trim();
    const searchLimit = Math.min(Number(limit), 50);
    const searchPage = Number(page);
    const searchOffset = (searchPage - 1) * searchLimit;

    // Enforce minimum query length
    if (query.length > 0 && query.length < 2) {
      res
        .status(400)
        .json({ error: "Search query must be at least 2 characters" });
      return;
    }

    // Save search history if query exists
    if (query) {
      recentSearchService
        .addSearch({
          userId,
          query,
          platform: "networks",
          context: (type as any) || undefined,
        })
        .catch((err) => logger.error("Failed to save search history", err));
    }

    const results: any = {};

    // 1. Listings Search (For Sale)
    if (!type || type === "listing") {
      const listingFilterInput: Record<string, any> = {};
      if (query && sort_by !== "relevance") listingFilterInput.q = query;
      if (brand) listingFilterInput.brand = brand;
      if (category) listingFilterInput.category = category;
      if (condition) listingFilterInput.condition = condition;
      if (contents) listingFilterInput.contents = contents;
      if (year_min !== undefined) listingFilterInput.year_min = year_min;
      if (year_max !== undefined) listingFilterInput.year_max = year_max;
      if (min_price !== undefined) listingFilterInput.min_price = min_price;
      if (max_price !== undefined) listingFilterInput.max_price = max_price;
      if (allow_offers !== undefined)
        listingFilterInput.allow_offers = allow_offers;

      const listingQuery: Record<string, any> = {
        ...buildListingFilter(listingFilterInput, true),
        status: "active",
        type: "for_sale",
        is_deleted: { $ne: true },
      };

      if (sort_by === "relevance" && query) {
        listingQuery.$text = { $search: query };
      }

      const listingSort = buildListingSort(sort_by, sort_order);
      const listingFind =
        sort_by === "relevance" && query
          ? NetworkListing.find(listingQuery, {
              score: { $meta: "textScore" },
            }).sort({ score: { $meta: "textScore" }, createdAt: -1 } as any)
          : NetworkListing.find(listingQuery).sort(listingSort);

      results.listings = await listingFind
        .skip(searchOffset)
        .limit(searchLimit)
        .lean();

      results.listings_count =
        await NetworkListing.countDocuments(listingQuery);
    }

    // 2. ISO Search (WTB)
    if (!type || type === "iso") {
      const isoQuery: any = {
        status: "active",
        is_public: true,
      };
      if (query) {
        isoQuery.$or = [
          { title: { $regex: query, $options: "i" } },
          { "criteria.brand": { $regex: query, $options: "i" } },
          { "criteria.model": { $regex: query, $options: "i" } },
        ];
      }
      if (brand)
        isoQuery["criteria.brand"] = { $regex: String(brand), $options: "i" };
      if (condition) isoQuery["criteria.condition"] = String(condition);
      results.isos = await ISO.find(isoQuery)
        .sort({ createdAt: -1 })
        .skip(searchOffset)
        .limit(searchLimit);

      results.isos_count = await ISO.countDocuments(isoQuery);
    }

    // 3. Members Search
    if (!type || type === "user") {
      const userQuery: any = {
        networks_published: true,
        deactivated_at: null,
      };
      if (query) {
        userQuery.$or = [
          { display_name: { $regex: query, $options: "i" } },
          { first_name: { $regex: query, $options: "i" } },
          { last_name: { $regex: query, $options: "i" } },
        ];
      }
      results.users = await User.find(userQuery)
        .select(
          "display_name avatar location stats rating_average rating_count reference_count identityVerified",
        )
        .sort({ "stats.follower_count": -1 })
        .skip(searchOffset)
        .limit(searchLimit);

      results.users_count = await User.countDocuments(userQuery);
    }

    res.json({
      data: results,
      pagination: {
        limit: searchLimit,
        page: searchPage,
        offset: searchOffset,
      },
    });
  } catch (err) {
    next(err);
  }
};
