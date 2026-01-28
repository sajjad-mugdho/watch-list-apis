import { Request, Response, NextFunction } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { config } from "../config";
import { InvalidUserClaimsError } from "../utils/errors";

/**
 * ============================================================================
 * MOCK USER SYSTEM
 * ============================================================================
 *
 * This system provides mock users for frontend development and testing.
 * Mock users are ONLY available in development/test environments.
 *
 * HOW TO USE:
 * -----------
 * Add `x-test-user` header to any API request with the mock user ID.
 *
 * Example:
 *   fetch('/api/v1/me', {
 *     headers: { 'x-test-user': 'buyer_us_complete' }
 *   })
 *
 * AVAILABLE MOCK USERS:
 * ---------------------
 * See getMockUsersList() below for all available users and their states.
 *
 * Debug endpoint: GET /api/v1/debug/mock-users (dev/test only)
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface MockUserClaims {
  dialist_id: string;
  display_name: string | null;
  display_avatar?: string;
  location_country?: "US" | "CA";
  location_region?: string;
  onboarding_status: "incomplete" | "completed";
  isMerchant: boolean;
  onboarding_state?:
    | "PENDING"
    | "PROVISIONING"
    | "APPROVED"
    | "REJECTED"
    | "UPDATE_REQUESTED";
  networks_application_id: string | null;
  networks_accessed: boolean;
}

export interface MockUser {
  id: string;
  name: string;
  description: string;
  category:
    | "new_user"
    | "onboarding_in_progress"
    | "buyer"
    | "merchant"
    | "edge_case";
  auth: {
    userId: string;
    sessionClaims: MockUserClaims;
  };
}

// =============================================================================
// MOCK USER DEFINITIONS
// =============================================================================

const mockUsers: Record<string, MockUser> = {
  // -------------------------------------------------------------------------
  // CATEGORY: New Users (Pre-onboarding)
  // -------------------------------------------------------------------------

  new_user_us: {
    id: "new_user_us",
    name: "New US User",
    description:
      "Fresh user who just signed up. No onboarding steps completed. Location detected as US.",
    category: "new_user",
    auth: {
      userId: "new_user_us",
      sessionClaims: {
        dialist_id: "aaa111111111111111111111",
        display_name: null,
        onboarding_status: "incomplete",
        isMerchant: false,
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  new_user_ca: {
    id: "new_user_ca",
    name: "New Canadian User",
    description:
      "Fresh user who just signed up. No onboarding steps completed. Location detected as Canada.",
    category: "new_user",
    auth: {
      userId: "new_user_ca",
      sessionClaims: {
        dialist_id: "aaa222222222222222222222",
        display_name: null,
        onboarding_status: "incomplete",
        isMerchant: false,
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  // -------------------------------------------------------------------------
  // CATEGORY: Onboarding In Progress
  // -------------------------------------------------------------------------

  onboarding_step1_location: {
    id: "onboarding_step1_location",
    name: "Onboarding Step 1 - At Location",
    description:
      "User is on Step 1 (location). No steps completed yet. next_step: location",
    category: "onboarding_in_progress",
    auth: {
      userId: "onboarding_step1_location",
      sessionClaims: {
        dialist_id: "bbb111111111111111111111",
        display_name: null,
        onboarding_status: "incomplete",
        isMerchant: false,
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  onboarding_step2_displayname: {
    id: "onboarding_step2_displayname",
    name: "Onboarding Step 2 - At Display Name",
    description:
      "User completed location, now on Step 2 (display_name). next_step: display_name",
    category: "onboarding_in_progress",
    auth: {
      userId: "onboarding_step2_displayname",
      sessionClaims: {
        dialist_id: "bbb222222222222222222222",
        display_name: null,
        location_country: "US",
        location_region: "California",
        onboarding_status: "incomplete",
        isMerchant: false,
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  onboarding_step3_avatar: {
    id: "onboarding_step3_avatar",
    name: "Onboarding Step 3 - At Avatar",
    description:
      "User completed location + display_name, now on Step 3 (avatar). next_step: avatar",
    category: "onboarding_in_progress",
    auth: {
      userId: "onboarding_step3_avatar",
      sessionClaims: {
        dialist_id: "bbb333333333333333333333",
        display_name: "Watch Collector",
        location_country: "US",
        location_region: "California",
        onboarding_status: "incomplete",
        isMerchant: false,
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  onboarding_step4_acks: {
    id: "onboarding_step4_acks",
    name: "Onboarding Step 4 - At Acknowledgements",
    description:
      "User completed location + display_name + avatar, now on Step 4 (acknowledgements). next_step: acknowledgements",
    category: "onboarding_in_progress",
    auth: {
      userId: "onboarding_step4_acks",
      sessionClaims: {
        dialist_id: "bbb444444444444444444444",
        display_name: "Watch Collector",
        display_avatar: "https://images.dialist.com/images/mock-avatar-1/w=400",
        location_country: "US",
        location_region: "California",
        onboarding_status: "incomplete",
        isMerchant: false,
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  // -------------------------------------------------------------------------
  // CATEGORY: Buyers (Platform onboarding complete, NOT merchant)
  // -------------------------------------------------------------------------

  buyer_us_complete: {
    id: "buyer_us_complete",
    name: "US Buyer (Complete)",
    description:
      "Fully onboarded US buyer. Can browse/buy but NOT sell. No merchant onboarding started.",
    category: "buyer",
    auth: {
      userId: "buyer_us_complete",
      sessionClaims: {
        dialist_id: "ccc111111111111111111111",
        display_name: "John Buyer",
        display_avatar:
          "https://images.dialist.com/images/mock-avatar-buyer/w=400",
        location_country: "US",
        location_region: "New York",
        onboarding_status: "completed",
        isMerchant: false,
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  buyer_ca_complete: {
    id: "buyer_ca_complete",
    name: "Canadian Buyer (Complete)",
    description:
      "Fully onboarded Canadian buyer. Can browse/buy but NOT sell. No merchant onboarding started.",
    category: "buyer",
    auth: {
      userId: "buyer_ca_complete",
      sessionClaims: {
        dialist_id: "ccc222222222222222222222",
        display_name: "Marie Buyer",
        display_avatar:
          "https://images.dialist.com/images/mock-avatar-buyer-ca/w=400",
        location_country: "CA",
        location_region: "Ontario",
        onboarding_status: "completed",
        isMerchant: false,
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  buyer_with_custom_name: {
    id: "buyer_with_custom_name",
    name: "Buyer with Custom Display Name",
    description:
      "Buyer who used custom mode for display_name during onboarding.",
    category: "buyer",
    auth: {
      userId: "buyer_with_custom_name",
      sessionClaims: {
        dialist_id: "ccc333333333333333333333",
        display_name: "The Watch Guy",
        display_avatar:
          "https://images.dialist.com/images/mock-avatar-custom/w=400",
        location_country: "US",
        location_region: "Texas",
        onboarding_status: "completed",
        isMerchant: false,
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  // -------------------------------------------------------------------------
  // CATEGORY: Merchants (Started or completed Finix onboarding)
  // -------------------------------------------------------------------------

  merchant_pending: {
    id: "merchant_pending",
    name: "Merchant - Pending",
    description:
      "Buyer who started merchant onboarding (form link generated) but hasn't completed it yet.",
    category: "merchant",
    auth: {
      userId: "merchant_pending",
      sessionClaims: {
        dialist_id: "ddd111111111111111111111",
        display_name: "Pending Watches",
        display_avatar:
          "https://images.dialist.com/images/mock-avatar-merchant/w=400",
        location_country: "US",
        location_region: "Florida",
        onboarding_status: "completed",
        isMerchant: false,
        onboarding_state: "PENDING",
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  merchant_provisioning: {
    id: "merchant_provisioning",
    name: "Merchant - Provisioning",
    description:
      "Merchant completed Finix form, account is being set up. Waiting for verification.",
    category: "merchant",
    auth: {
      userId: "merchant_provisioning",
      sessionClaims: {
        dialist_id: "ddd222222222222222222222",
        display_name: "Provisioning Watches",
        display_avatar:
          "https://images.dialist.com/images/mock-avatar-merchant/w=400",
        location_country: "US",
        location_region: "California",
        onboarding_status: "completed",
        isMerchant: false,
        onboarding_state: "PROVISIONING",
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  merchant_approved: {
    id: "merchant_approved",
    name: "Merchant - Approved (Can Sell)",
    description:
      "Fully approved merchant. Can list items and receive payments. isMerchant: true",
    category: "merchant",
    auth: {
      userId: "merchant_approved",
      sessionClaims: {
        dialist_id: "ddd333333333333333333333",
        display_name: "Premium Watches",
        display_avatar:
          "https://images.dialist.com/images/mock-avatar-merchant-approved/w=400",
        location_country: "US",
        location_region: "New York",
        onboarding_status: "completed",
        isMerchant: true,
        onboarding_state: "APPROVED",
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  merchant_approved_ca: {
    id: "merchant_approved_ca",
    name: "Merchant - Approved (Canada)",
    description: "Fully approved Canadian merchant. Can sell.",
    category: "merchant",
    auth: {
      userId: "merchant_approved_ca",
      sessionClaims: {
        dialist_id: "ddd444444444444444444444",
        display_name: "Maple Watches",
        display_avatar:
          "https://images.dialist.com/images/mock-avatar-merchant-ca/w=400",
        location_country: "CA",
        location_region: "British Columbia",
        onboarding_status: "completed",
        isMerchant: true,
        onboarding_state: "APPROVED",
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  merchant_rejected: {
    id: "merchant_rejected",
    name: "Merchant - Rejected",
    description:
      "Merchant application was rejected by Finix. Cannot sell until re-application.",
    category: "merchant",
    auth: {
      userId: "merchant_rejected",
      sessionClaims: {
        dialist_id: "ddd555555555555555555555",
        display_name: "Rejected Seller",
        display_avatar:
          "https://images.dialist.com/images/mock-avatar-merchant/w=400",
        location_country: "US",
        location_region: "Nevada",
        onboarding_status: "completed",
        isMerchant: false,
        onboarding_state: "REJECTED",
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  merchant_update_requested: {
    id: "merchant_update_requested",
    name: "Merchant - Update Requested",
    description:
      "Finix requested additional information. Merchant needs to update their application.",
    category: "merchant",
    auth: {
      userId: "merchant_update_requested",
      sessionClaims: {
        dialist_id: "ddd666666666666666666666",
        display_name: "Update Needed Watches",
        display_avatar:
          "https://images.dialist.com/images/mock-avatar-merchant/w=400",
        location_country: "US",
        location_region: "Oregon",
        onboarding_status: "completed",
        isMerchant: false,
        onboarding_state: "UPDATE_REQUESTED",
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  // -------------------------------------------------------------------------
  // CATEGORY: Edge Cases
  // -------------------------------------------------------------------------

  user_with_networks: {
    id: "user_with_networks",
    name: "User with Networks Access",
    description:
      "Buyer who has accessed the Networks feature. networks_accessed: true",
    category: "edge_case",
    auth: {
      userId: "user_with_networks",
      sessionClaims: {
        dialist_id: "eee111111111111111111111",
        display_name: "Network User",
        display_avatar:
          "https://images.dialist.com/images/mock-avatar-networks/w=400",
        location_country: "US",
        location_region: "Washington",
        onboarding_status: "completed",
        isMerchant: false,
        networks_application_id: "fff111111111111111111111",
        networks_accessed: true,
      },
    },
  },

  user_minimal_claims: {
    id: "user_minimal_claims",
    name: "User with Minimal Claims",
    description:
      "Edge case: User with only required claims set. Good for testing claim validation.",
    category: "edge_case",
    auth: {
      userId: "user_minimal_claims",
      sessionClaims: {
        dialist_id: "eee222222222222222222222",
        display_name: null,
        onboarding_status: "incomplete",
        isMerchant: false,
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  // -------------------------------------------------------------------------
  // LEGACY MOCK USERS (Kept for backward compatibility with existing tests)
  // -------------------------------------------------------------------------

  user_new_incomplete: {
    id: "user_new_incomplete",
    name: "[Legacy] New Incomplete",
    description: "Legacy mock user. Use new_user_us instead.",
    category: "new_user",
    auth: {
      userId: "user_new_incomplete",
      sessionClaims: {
        dialist_id: "677a1111111111111111aaa1",
        display_name: null,
        onboarding_status: "incomplete",
        isMerchant: false,
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  user_onboarded_buyer: {
    id: "user_onboarded_buyer",
    name: "[Legacy] Onboarded Buyer",
    description: "Legacy mock user. Use buyer_us_complete instead.",
    category: "buyer",
    auth: {
      userId: "user_onboarded_buyer",
      sessionClaims: {
        dialist_id: "677a2222222222222222bbb2",
        display_name: "John Buyer",
        location_country: "US",
        onboarding_status: "completed",
        isMerchant: false,
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  user_merchant_approved: {
    id: "user_merchant_approved",
    name: "[Legacy] Merchant Approved",
    description: "Legacy mock user. Use merchant_approved instead.",
    category: "merchant",
    auth: {
      userId: "user_merchant_approved",
      sessionClaims: {
        dialist_id: "677a3333333333333333ccc3",
        display_name: "Jane's Watches",
        location_country: "US",
        onboarding_status: "completed",
        isMerchant: true,
        onboarding_state: "APPROVED",
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },

  user_orphaned: {
    id: "user_orphaned",
    name: "[Legacy] Orphaned User",
    description:
      "Legacy mock user for edge case testing. Minimal data, simulates session with no matching DB user.",
    category: "edge_case",
    auth: {
      userId: "user_orphaned",
      sessionClaims: {
        dialist_id: "677a4444444444444444ddd4",
        display_name: null,
        onboarding_status: "incomplete",
        isMerchant: false,
        networks_application_id: null,
        networks_accessed: false,
      },
    },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get list of all available mock users with their descriptions.
 * Used by the debug endpoint and for documentation.
 */
export function getMockUsersList(): Array<{
  id: string;
  name: string;
  description: string;
  category: string;
  claims: MockUserClaims;
}> {
  return Object.values(mockUsers).map((user) => ({
    id: user.id,
    name: user.name,
    description: user.description,
    category: user.category,
    claims: user.auth.sessionClaims,
  }));
}

/**
 * Get a specific mock user by ID.
 * Returns undefined if not found.
 */
export function getMockUser(id: string): MockUser | undefined {
  return mockUsers[id];
}

/**
 * Get mock users by category.
 */
export function getMockUsersByCategory(
  category: MockUser["category"]
): MockUser[] {
  return Object.values(mockUsers).filter((user) => user.category === category);
}

// =============================================================================
// MIDDLEWARE FUNCTIONS
// =============================================================================

/**
 * Returns the test user ID if running in development/test
 * and the x-test-user header is present with a valid mock user ID.
 * Otherwise returns undefined.
 */
export function isTestUser(req: Request): string | undefined {
  // In test and development environments, accept the x-test-user header to enable test mode
  const isDev = config.nodeEnv === "development" || config.nodeEnv === "test";
  const testUserId = req.headers["x-test-user"] as string | undefined;

  if (!isDev || !testUserId || !mockUsers[testUserId]) return undefined;
  return testUserId;
}

/**
 * Returns a middleware that, in development and when the `x-test-user` header is present,
 * will bypass Clerk and inject a fake auth; otherwise, it will defer to real clerkMiddleware.
 */
export function customClerkMw() {
  // instantiate the real clerk middleware once
  const realClerk = clerkMiddleware();

  return (req: Request, res: Response, next: NextFunction) => {
    const testUserId = isTestUser(req);

    // Dev-only mock user injection
    if (testUserId) {
      const mockUser = mockUsers[testUserId];
      const { auth } = mockUser;

      (req as any).auth = {
        userId: auth.userId,
        sessionClaims: auth.sessionClaims,
      };

      return next();
    }

    // Otherwise, use the real Clerk middleware
    return realClerk(req, res, next);
  };
}

/**
 * Get auth from mock user or real Clerk.
 * Use this instead of getAuth() to support mock users.
 */
export function customGetAuth(req: Request) {
  let raw: unknown;
  if (isTestUser(req)) {
    raw = (req as any)?.auth;
  } else {
    raw = getAuth(req);
  }

  if (!raw)
    throw new InvalidUserClaimsError({ reason: "No raw auth provided" });

  return raw;
}
