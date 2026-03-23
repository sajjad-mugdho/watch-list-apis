import { Router, Request, Response } from "express";
import networksRoutes from "../networks";
import marketplaceRoutes from "../marketplace";

import { healthCheck, readinessCheck } from "../middleware/operational";
import {
  requirePlatformAuth,
  requireAdmin,
} from "../middleware/authentication";
import { watchesRoutes } from "./watchesRoutes";
import { authRoutes } from "./auth";
import { debugRoutes } from "./debugRoutes";
import { subscriptionRoutes } from "./subscriptionRoutes";
import { getstreamWebhookRoutes } from "./getstreamWebhookRoutes";
import { userSubRoutes } from "./user"; // Consolidated user routes
import { analyticsRoutes } from "./analyticsRoutes";
import { newsRoutes } from "./newsRoutes";
import { marketplaceWebhookRoutes } from "../marketplace/routes/webhookRoutes";

import { trustCaseRoutes } from "./admin/trustCaseRoutes";

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

// Current User Resources (scoped to the authenticated user)
// /api/v1/user/* -> "My Content"
router.use("/v1/user", requirePlatformAuth(), userSubRoutes); // Consolidated!

// Subscriptions
router.use("/v1/subscriptions", requirePlatformAuth(), subscriptionRoutes);

// GetStream webhooks (no auth - uses signature verification)
router.use("/v1/webhooks/getstream", getstreamWebhookRoutes);

// Marketplace webhooks (no auth - uses Finix signature verification)
router.use("/v1/marketplace/webhooks", marketplaceWebhookRoutes);

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

// News & Events (Batch 2 Dashboard)
router.use("/v1/news", requirePlatformAuth(), newsRoutes);

// Admin routes - Trust & Safety
router.use(
  "/v1/admin/trust-cases",
  requirePlatformAuth(),
  requireAdmin(),
  trustCaseRoutes,
);

export { router as apiRoutes };
