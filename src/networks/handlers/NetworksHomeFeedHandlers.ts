/**
 * Networks Home Feed Handlers
 *
 * HTTP handler for the home feed endpoint.
 * GET /api/v1/networks/home-feed
 */

import { Request, Response, NextFunction } from "express";
import { ApiResponse, PagingMeta, ResponseMeta } from "../../types";
import { INetworkListing } from "../models/NetworkListing";
import { MissingUserContextError, ValidationError } from "../../utils/errors";
import { networksHomeFeedService } from "../services/NetworksHomeFeedService";
import logger from "../../utils/logger";

/**
 * GET /api/v1/networks/home-feed
 *
 * Returns home feed with three sections: recommended, featured, connections
 *
 * Response:
 * {
 *   data: {
 *     recommended: INetworkListing[],
 *     featured: INetworkListing[],
 *     connections: INetworkListing[]
 *   },
 *   _metadata: { paging: { count, total, limit, hasMore } },
 *   requestId: string
 * }
 */
export const networks_home_feed_get = async (
  req: Request,
  res: Response<
    ApiResponse<{
      recommended: INetworkListing[];
      featured: INetworkListing[];
      connections: INetworkListing[];
    }>
  >,
  next: NextFunction,
): Promise<void> => {
  try {
    // Extract user context from authentication middleware
    const dialistUserId = (req as any).dialistUserId;
    const userId = (req as any).user?.userId;

    if (!dialistUserId || !userId) {
      throw new MissingUserContextError({
        dialistUserId,
        userId,
      });
    }

    // Validate limit if provided
    let limit = 6;
    if (req.query.limit) {
      const parsedLimit = parseInt(req.query.limit as string);

      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 20) {
        throw new ValidationError("Limit must be a number between 1 and 20");
      }

      limit = parsedLimit;
    }

    // Fetch home feed
    const feed = await networksHomeFeedService.getHomeFeed(
      dialistUserId,
      limit,
    );

    // Calculate metadata
    const count =
      feed.recommended.length + feed.featured.length + feed.connections.length;
    const total = count; // Not paginated; total = count
    const hasMore = false; // All sections are complete

    const paging: PagingMeta = {
      count,
      total,
      limit,
      hasMore,
    };

    const meta: ResponseMeta = {
      paging,
    };

    // Return standardized response
    const response: ApiResponse<typeof feed> = {
      data: feed,
      _metadata: meta,
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error("Error in networks_home_feed_get:", error);
    next(error);
  }
};
