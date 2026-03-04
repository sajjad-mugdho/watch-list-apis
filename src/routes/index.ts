import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import networksRoutes from "../networks";
import marketplaceRoutes from "../marketplace";

import { healthCheck, readinessCheck } from "../middleware/operational";
import { requirePlatformAuth, requireAdmin } from "../middleware/authentication";
import { networksOnly } from "../middleware/deprecation";
import { watchesRoutes } from "./watchesRoutes";
import { onboardingRoutes } from "./onboardingRoutes";
import { authRoutes } from "./auth";
import { debugRoutes } from "./debugRoutes";
import { feedRoutes } from "./feedRoutes";
import { followRoutes } from "./followRoutes";
import { isoRoutes } from "./isoRoutes";
// Reference checks - Networks only (modular handler)
import referenceCheckRoutes from "../networks/routes/referenceCheckRoutes";
import { subscriptionRoutes } from "./subscriptionRoutes";
import { getstreamWebhookRoutes } from "./getstreamWebhookRoutes";
import { userSubRoutes } from "./user"; // Consolidated user routes
import { reviewRoutes } from "./reviewRoutes";
import { notificationRoutes } from "./notificationRoutes";
import { analyticsRoutes } from "./analyticsRoutes";
import { newsRoutes } from "./newsRoutes";

import { trustCaseRoutes } from "./admin/trustCaseRoutes";
import * as orderHandlers from "../marketplace/handlers/MarketplaceOrderHandlers";
import { validateRequest } from "../middleware/validation";
import { reserveListingSchema, resetListingSchema } from "../validation/schemas";
import { reservationTermsRoutes } from "./reservationTermsRoutes";

const router: Router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({ status: "API is running on /api" });
});
// Health check endpoint with system metrics
router.get("/health", healthCheck);

// Readiness check endpoint for Kubernetes probes
router.get("/ready", readinessCheck);

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

const onboardingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: { error: { message: "Too many requests to onboarding, please try again later." } }
});
router.use("/v1/onboarding", requirePlatformAuth(), onboardingLimiter, onboardingRoutes);

// Current User Resources (scoped to the authenticated user)
// /api/v1/user/* -> "My Content"
router.use("/v1/user", requirePlatformAuth(), userSubRoutes); // Consolidated!

// Reviews (platform-agnostic, works for both networks and marketplace)
router.use("/v1/reviews", requirePlatformAuth(), reviewRoutes);

// Social/follow features - mounted on /users/:id
// Public User Resources (scoped to a specific user ID)
// /api/v1/users/:id/* -> "Their Content"
// Marketplace does NOT support follow functionality - Networks only
router.use("/v1/users", requirePlatformAuth(), networksOnly, followRoutes);

// ISO (In Search Of / WTB) feature
// ISOs are Networks-only (Marketplace doesn't have WTB)
router.use("/v1/isos", requirePlatformAuth(), networksOnly, isoRoutes);

// Reference checks - Networks only
router.use("/v1/reference-checks", requirePlatformAuth(), networksOnly, referenceCheckRoutes);

// Subscriptions
router.use("/v1/subscriptions", requirePlatformAuth(), subscriptionRoutes);

// GetStream webhooks (no auth - uses signature verification)
router.use("/v1/webhooks/getstream", getstreamWebhookRoutes);

// platform specific routes
router.use("/v1/networks", requirePlatformAuth(), networksRoutes);
router.use("/v1/marketplace", requirePlatformAuth(), marketplaceRoutes);

// Feeds - Networks only (no follow-based timeline for Marketplace)
router.use("/v1/feeds", requirePlatformAuth(), networksOnly, feedRoutes);

// Analytics and tracking
router.use("/v1/analytics", requirePlatformAuth(), requireAdmin(), analyticsRoutes);

// Notification routes
router.use("/v1/notifications", requirePlatformAuth(), notificationRoutes);

// News & Events (Batch 2 Dashboard)
router.use("/v1/news", requirePlatformAuth(), newsRoutes);

// Reservation Terms - versioned legal terms
router.use("/v1/reservation-terms", reservationTermsRoutes);

// Admin routes - Trust & Safety
router.use("/v1/admin/trust-cases", requirePlatformAuth(), requireAdmin(), trustCaseRoutes);

export { router as apiRoutes };
