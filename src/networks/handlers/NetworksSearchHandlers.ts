import { Request, Response, NextFunction } from "express";
import { NetworkListing } from "../models/NetworkListing";
import { ISO } from "../../models/ISO";
import { User } from "../../models/User";
import { getUserId } from "../../middleware/attachUser";
import { recentSearchService } from "../../services";
import logger from "../../utils/logger";

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
    const {
      q = "",
      type,
      limit = 20,
      offset = 0,
      brand,
      condition,
      category,
      sort,
      min_price,
      max_price,
    } = req.query;
    const query = String(q).trim();
    const searchLimit = Math.min(Number(limit), 50);
    const searchOffset = Number(offset);

    // Enforce minimum query length
    if (query.length > 0 && query.length < 2) {
      res
        .status(400)
        .json({ error: "Search query must be at least 2 characters" });
      return;
    }

    // Determine sort order
    let sortOrder: Record<string, 1 | -1>;
    switch (String(sort)) {
      case "priceAsc":
        sortOrder = { price: 1 };
        break;
      case "priceDesc":
        sortOrder = { price: -1 };
        break;
      case "newest":
      default:
        sortOrder = { createdAt: -1 };
        break;
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
      const listingQuery: any = {
        status: "active",
        type: "for_sale",
        is_deleted: { $ne: true },
      };
      if (query) {
        listingQuery.$or = [
          { brand: { $regex: query, $options: "i" } },
          { model: { $regex: query, $options: "i" } },
          { reference: { $regex: query, $options: "i" } },
          { title: { $regex: query, $options: "i" } },
        ];
      }
      if (brand) listingQuery.brand = { $regex: String(brand), $options: "i" };
      if (condition) listingQuery.condition = String(condition);
      if (category) listingQuery.category = String(category);
      if (min_price || max_price) {
        listingQuery.price = {};
        if (min_price) listingQuery.price.$gte = Number(min_price);
        if (max_price) listingQuery.price.$lte = Number(max_price);
      }
      results.listings = await NetworkListing.find(listingQuery)
        .sort(sortOrder)
        .skip(searchOffset)
        .limit(searchLimit);

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
        offset: searchOffset,
      },
    });
  } catch (err) {
    next(err);
  }
};
