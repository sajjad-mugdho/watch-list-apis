import { Router, Request, Response } from "express";
import { networksRoutes } from "./networksRoutes";
import { marketplaceRoutes } from "./marketplaceRoutes";

import { healthCheck } from "../middleware/operational";
import { requirePlatformAuth } from "../middleware/authentication";
import { deprecatedRoute, networksOnly } from "../middleware/deprecation";
import { watchesRoutes } from "./watchesRoutes";
import { onboardingRoutes } from "./onboardingRoutes";
import { authRoutes } from "./auth";
import { debugRoutes } from "./debugRoutes";
import { chatRoutes } from "./chatRoutes";
import { feedRoutes } from "./feedRoutes";
import { followRoutes } from "./followRoutes";
import { isoRoutes } from "./isoRoutes";
import { referenceCheckRoutes } from "./referenceCheckRoutes";
import { subscriptionRoutes } from "./subscriptionRoutes";
import { getstreamWebhookRoutes } from "./getstreamWebhookRoutes";
import { messageRoutes } from "./messageRoutes";
import { userSubRoutes } from "./user"; // Consolidated user routes
import { reviewRoutes } from "./reviewRoutes"; // Gap Fill Phase 3
import * as orderHandlers from "../handlers/orderHandlers";
import { validateRequest } from "../validation/middleware";
import { reserveListingSchema, resetListingSchema } from "../validation/schemas";

const router: Router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({ status: "API is running on /api" });
});
// Health check endpoint with system metrics
router.get("/health", healthCheck);

// ⚠️ TEMPORARY DEV ENDPOINT - No auth required (must be before authenticated routes)
// Remove in production!
if (process.env.NODE_ENV === "development") {
  router.post(
    "/v1/marketplace/orders/dev/clear-reservations",
    validateRequest(reserveListingSchema.partial()), // Use partial for clear-reservations if it takes no body
    orderHandlers.clearAllReservations
  );
  router.post(
    "/v1/marketplace/orders/dev/reset-listing",
    validateRequest(resetListingSchema),
    orderHandlers.resetListing
  );
}

// -- versioned routes --

// Auth & bootstrap endpoints (platform-agnostic)
router.use("/v1", authRoutes);

// Debug routes (dev/test only - protected by middleware in debugRoutes.ts)
router.use("/v1/debug", debugRoutes);

// platform-agnostic top level resources
router.use("/v1/watches", watchesRoutes);
router.use("/v1/onboarding", requirePlatformAuth(), onboardingRoutes);
router.use("/v1/user", requirePlatformAuth(), userSubRoutes); // Consolidated!

// Reviews - Gap Fill Phase 3 (platform-agnostic, works for both networks and marketplace)
router.use("/v1/reviews", requirePlatformAuth(), reviewRoutes);

// Social/follow features - mounted on /users/:id
// Per Michael: Marketplace does NOT support follow functionality - Networks only
router.use("/v1/users", requirePlatformAuth(), networksOnly, followRoutes);

// ISO (In Search Of / WTB) feature
// EDGE CASE FIX #6: ISOs are Networks-only per Michael (Marketplace doesn't have WTB)
router.use("/v1/isos", requirePlatformAuth(), networksOnly, isoRoutes);

// Reference checks - Networks only per Michael
router.use("/v1/reference-checks", requirePlatformAuth(), networksOnly, referenceCheckRoutes);

// Subscriptions
router.use("/v1/subscriptions", requirePlatformAuth(), subscriptionRoutes);

// GetStream webhooks (no auth - uses signature verification)
router.use("/v1/webhooks/getstream", getstreamWebhookRoutes);

// platform specific routes
router.use("/v1/networks", requirePlatformAuth(), networksRoutes);
router.use("/v1/marketplace", requirePlatformAuth(), marketplaceRoutes);

// ===== DEPRECATED ROUTES =====
// Per Michael: Use platform-namespaced routes instead
// These routes are deprecated and will be removed in a future version

// DEPRECATED: Use /v1/{platform}/channels/:channelId/messages instead
router.use(
  "/v1/messages",
  requirePlatformAuth(),
  deprecatedRoute({
    message: "Deprecated. Use /v1/marketplace/channels/:channelId/messages or /v1/networks/channels/:channelId/messages instead.",
    replacement: "/v1/{platform}/channels/:channelId/messages",
    sunsetDate: "2026-04-01",
  }),
  messageRoutes
);

// DEPRECATED: Use /v1/{platform}/channels instead
router.use(
  "/v1/chat",
  requirePlatformAuth(),
  deprecatedRoute({
    message: "Deprecated. Use /v1/marketplace/channels or /v1/networks/channels instead.",
    replacement: "/v1/{platform}/channels",
    sunsetDate: "2026-04-01",
  }),
  chatRoutes
);

// Feeds - Networks only (no follow-based timeline for Marketplace)
router.use("/v1/feeds", requirePlatformAuth(), networksOnly, feedRoutes);

export { router as apiRoutes };
