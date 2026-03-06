import { Request, Response, NextFunction } from "express";
import { NetworkListing } from "../../models/Listings";

/**
 * Discovery: Popular Brands
 * GET /v1/networks/brands/popular
 */
export const getPopularBrands = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Aggregate brands from active listings
    const popularBrands = await NetworkListing.aggregate([
      { $match: { status: "active", type: "for_sale" } },
      { $group: { _id: "$brand", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { name: "$_id", count: 1, _id: 0 } },
    ]);

    res.json({
      data: popularBrands,
    });
  } catch (err) {
    next(err);
  }
};
