import { Router } from "express";
import { unifiedSearch } from "../handlers/NetworksSearchHandlers";
import { getPopularBrands } from "../handlers/NetworksBrandHandlers";

const router = Router();

/**
 * @route GET /api/v1/networks/search
 * @desc Unified search across listings, isos, and members
 */
router.get("/", unifiedSearch as any);

/**
 * @route GET /api/v1/networks/search/popular-brands
 * @desc Get most popular brands for discovery
 */
router.get("/popular-brands", getPopularBrands as any);

export default router;
