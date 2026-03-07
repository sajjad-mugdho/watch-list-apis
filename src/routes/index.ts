import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import networksRoutes from "../networks";
import marketplaceRoutes from "../marketplace";

import { healthCheck, readinessCheck } from "../middleware/operational";
import {
  requirePlatformAuth,
  requireAdmin,
} from "../middleware/authentication";
import { watchesRoutes } from "./watchesRoutes";
import { onboardingRoutes } from "./onboardingRoutes";
import { authRoutes } from "./auth";
import { debugRoutes } from "./debugRoutes";
import { subscriptionRoutes } from "./subscriptionRoutes";
import { getstreamWebhookRoutes } from "./getstreamWebhookRoutes";
import { userSubRoutes } from "./user"; // Consolidated user routes
import { reviewRoutes } from "./reviewRoutes";
import { notificationRoutes } from "./notificationRoutes";
import { analyticsRoutes } from "./analyticsRoutes";
import { newsRoutes } from "./newsRoutes";

import { trustCaseRoutes } from "./admin/trustCaseRoutes";
import { reservationTermsRoutes } from "./reservationTermsRoutes";

const router: Router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({ status: "API is running on /api" });
});
// Health check endpoint with system metrics
router.get("/health", healthCheck);

// Readiness check endpoint for Kubernetes probes
router.get("/ready", readinessCheck);

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
  message: {
    error: {
      message: "Too many requests to onboarding, please try again later.",
    },
  },
});
router.use(
  "/v1/onboarding",
  requirePlatformAuth(),
  onboardingLimiter,
  onboardingRoutes,
);

// Current User Resources (scoped to the authenticated user)
// /api/v1/user/* -> "My Content"
router.use("/v1/user", requirePlatformAuth(), userSubRoutes); // Consolidated!

// Reviews (platform-agnostic, works for both networks and marketplace)
router.use("/v1/reviews", requirePlatformAuth(), reviewRoutes);

// Subscriptions
router.use("/v1/subscriptions", requirePlatformAuth(), subscriptionRoutes);

// GetStream webhooks (no auth - uses signature verification)
router.use("/v1/webhooks/getstream", getstreamWebhookRoutes);

// platform specific routes
router.use("/v1/networks", requirePlatformAuth(), networksRoutes);
router.use("/v1/marketplace", requirePlatformAuth(), marketplaceRoutes);

// Analytics and tracking
router.use(
  "/v1/analytics",
  requirePlatformAuth(),
  requireAdmin(),
  analyticsRoutes,
);

// Notification routes
router.use("/v1/notifications", requirePlatformAuth(), notificationRoutes);

// News & Events (Batch 2 Dashboard)
router.use("/v1/news", requirePlatformAuth(), newsRoutes);

// Reservation Terms - versioned legal terms
router.use("/v1/reservation-terms", reservationTermsRoutes);

// Admin routes - Trust & Safety
router.use(
  "/v1/admin/trust-cases",
  requirePlatformAuth(),
  requireAdmin(),
  trustCaseRoutes,
);

export { router as apiRoutes };
