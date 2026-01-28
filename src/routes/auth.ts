import { Router } from "express";
import { requirePlatformAuth } from "../middleware/authentication";
import { me_get, auth_refresh_post } from "../handlers/authHandlers";

const router = Router();

/**
 * @route GET /api/v1/me
 * @desc Get canonical user state (DB-backed, always fresh)
 * @access Private (requires authentication)
 */
router.get("/me", requirePlatformAuth(), me_get);

/**
 * @route POST /api/v1/auth/refresh
 * @desc Force refresh session claims from database
 * @access Private (requires authentication)
 */
router.post("/auth/refresh", requirePlatformAuth(), auth_refresh_post);

export { router as authRoutes };
