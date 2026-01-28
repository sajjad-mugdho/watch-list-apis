import { Router, Request, Response, NextFunction } from "express";
import {
  getMockUsersList,
  getMockUser,
  MockUser,
} from "../middleware/customClerkMw";
import { config } from "../config";

/**
 * Debug routes for development and testing.
 * These routes are ONLY available in development/test environments.
 *
 * Endpoints:
 * - GET /api/v1/debug/mock-users          List all available mock users
 * - GET /api/v1/debug/mock-users/:id      Get details for a specific mock user
 * - GET /api/v1/debug/mock-users/category/:category  Get mock users by category
 */

const debugRoutes = Router();

// Helper to group mock users by category
function groupByCategory(): Record<
  string,
  Array<{ id: string; name: string; description: string }>
> {
  const list = getMockUsersList();
  const grouped: Record<
    string,
    Array<{ id: string; name: string; description: string }>
  > = {};

  for (const user of list) {
    if (!grouped[user.category]) {
      grouped[user.category] = [];
    }
    grouped[user.category].push({
      id: user.id,
      name: user.name,
      description: user.description,
    });
  }

  return grouped;
}

// Middleware to ensure debug routes are only available in dev/test
debugRoutes.use((_req: Request, res: Response, next: NextFunction) => {
  if (config.nodeEnv !== "development" && config.nodeEnv !== "test") {
    res.status(404).json({
      error: "Not Found",
      message: "Debug endpoints are not available in production",
    });
    return;
  }
  next();
});

/**
 * GET /api/v1/debug/mock-users
 *
 * Returns a list of all available mock users with their descriptions.
 * Use the `id` field as the value for the `x-test-user` header.
 */
debugRoutes.get("/mock-users", (_req: Request, res: Response) => {
  const mockUsers = getMockUsersList();

  // Group by category for easier browsing
  const categories = groupByCategory();

  res.json({
    message: "Available mock users for frontend development",
    usage: {
      header: "x-test-user",
      example:
        'fetch("/api/v1/me", { headers: { "x-test-user": "buyer_us_complete" } })',
      note: "Mock users are ONLY available in development/test environments",
    },
    total: mockUsers.length,
    categories: Object.keys(categories),
    users_by_category: categories,
    all_users: mockUsers.map((u) => ({
      id: u.id,
      name: u.name,
      description: u.description,
      category: u.category,
    })),
  });
});

/**
 * GET /api/v1/debug/mock-users/:id
 *
 * Returns detailed information about a specific mock user,
 * including all session claims that will be injected.
 */
debugRoutes.get("/mock-users/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const mockUser = getMockUser(id);

  if (!mockUser) {
    res.status(404).json({
      error: "Mock user not found",
      available_ids: getMockUsersList().map((u) => u.id),
    });
    return;
  }

  res.json({
    message: `Mock user details: ${mockUser.name}`,
    usage: {
      header: "x-test-user",
      value: mockUser.id,
      example: `fetch("/api/v1/me", { headers: { "x-test-user": "${mockUser.id}" } })`,
    },
    user: {
      id: mockUser.id,
      name: mockUser.name,
      description: mockUser.description,
      category: mockUser.category,
    },
    session_claims: mockUser.auth.sessionClaims,
    expected_behavior: generateExpectedBehavior(mockUser),
  });
});

/**
 * GET /api/v1/debug/mock-users/category/:category
 *
 * Returns all mock users in a specific category.
 */
debugRoutes.get(
  "/mock-users/category/:category",
  (req: Request, res: Response) => {
    const { category } = req.params;
    const categories = groupByCategory();
    const validCategories = Object.keys(categories);

    if (!validCategories.includes(category)) {
      res.status(404).json({
        error: `Invalid category: ${category}`,
        valid_categories: validCategories,
      });
      return;
    }

    const users = categories[category];

    res.json({
      message: `Mock users in category: ${category}`,
      category,
      count: users.length,
      users: users.map(
        (u: { id: string; name: string; description: string }) => ({
          id: u.id,
          name: u.name,
          description: u.description,
        })
      ),
    });
  }
);

/**
 * Generate expected behavior documentation for a mock user
 */
function generateExpectedBehavior(mockUser: MockUser): Record<string, string> {
  const claims = mockUser.auth.sessionClaims;
  const behavior: Record<string, string> = {};

  // Onboarding status
  if (claims.onboarding_status === "incomplete") {
    behavior["GET /api/v1/me"] =
      "Returns user with onboarding_status: incomplete, next_step indicates current step";
    behavior["Protected buyer routes"] =
      "403 Forbidden - User must complete platform onboarding";
  } else {
    behavior["GET /api/v1/me"] =
      "Returns user with onboarding_status: completed";
    behavior["Protected buyer routes"] =
      "200 OK - User can access buyer features";
  }

  // Merchant status
  if (claims.onboarding_state === "APPROVED") {
    behavior["Merchant routes"] = "200 OK - User can list items for sale";
    behavior["Create listing"] = "Allowed";
  } else if (claims.onboarding_state === "PENDING") {
    behavior["Merchant status"] =
      "PENDING - User has started merchant onboarding but not completed form";
    behavior["Create listing"] = "Not allowed until APPROVED";
  } else if (claims.onboarding_state === "PROVISIONING") {
    behavior["Merchant status"] =
      "PROVISIONING - Form completed, waiting for Finix verification";
    behavior["Create listing"] = "Not allowed until APPROVED";
  } else if (claims.onboarding_state === "REJECTED") {
    behavior["Merchant status"] = "REJECTED - Merchant application was denied";
    behavior["Create listing"] = "Not allowed - must re-apply";
  } else if (
    !claims.onboarding_state &&
    claims.onboarding_status === "completed"
  ) {
    behavior["Merchant status"] =
      "Not started - User is a buyer only, no merchant onboarding";
    behavior["Create listing"] = "Must complete merchant onboarding first";
  }

  // Networks
  if (claims.networks_accessed) {
    behavior["Networks feature"] = "User has accessed networks";
  } else {
    behavior["Networks feature"] = "User has not accessed networks yet";
  }

  return behavior;
}

export { debugRoutes };
