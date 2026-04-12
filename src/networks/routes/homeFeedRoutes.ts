/**
 * Networks Home Feed Routes
 *
 * GET /home-feed - Get complete home feed (recommended, featured, connections)
 */

import { Router } from "express";
import { requirePlatformAuth } from "../../middleware/authentication";
import { networks_home_feed_get } from "../handlers/NetworksHomeFeedHandlers";

const router: Router = Router();

/**
 * GET /home-feed
 *
 * Requires authentication.
 * Returns home feed with three sections: recommended, featured, connections.
 *
 * Query Parameters:
 * - limit: number (optional, default=6, max=20) - items per section
 *
 * Response includes all three sections with consistent metadata structure.
 */
router.get("/home-feed", requirePlatformAuth(), networks_home_feed_get as any);

export default router;
