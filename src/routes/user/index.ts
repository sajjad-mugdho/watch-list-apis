/**
 * User Route Aggregator (MINIMAL)
 *
 * DEPRECATED ROUTES REMOVED:
 * - GET /api/v1/user (user profile endpoint)
 * - All /user/notifications/* routes
 * - All /user/subscription/* routes
 * - All /user/tokens/* routes
 * - All /user/support/* routes
 *
 * REMAINING:
 * - GET /api/v1/user/verification (moved to networks/marketplace)
 */

import { Router } from "express";
import { attachUser } from "../../middleware/attachUser";
import { userProfileRoutes } from "./profile";

const router = Router();

// Apply attachUser middleware to ALL routes in this router
router.use(attachUser);

// /api/v1/user/verification — only remaining endpoint
router.use("/", userProfileRoutes);

export { router as userSubRoutes };
