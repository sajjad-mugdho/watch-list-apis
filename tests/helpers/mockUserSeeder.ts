import mongoose from "mongoose";
import { User, IUser } from "../../src/models/User";
import { MerchantOnboarding } from "../../src/models/MerchantOnboarding";
import {
  getMockUsersList,
  getMockUser,
  MockUserClaims,
} from "../../src/middleware/customClerkMw";

/**
 * ============================================================================
 * MOCK USER SEEDER
 * ============================================================================
 *
 * This module provides functions to seed the database with mock user records
 * that match the mock users defined in customClerkMw.ts.
 *
 * The mock users in customClerkMw provide session claims, but some operations
 * require actual database records. This seeder creates those records.
 *
 * USAGE:
 * ------
 * import { seedMockUser, seedAllMockUsers } from './mockUserSeeder';
 *
 * // In test setup:
 * beforeEach(async () => {
 *   await seedMockUser('buyer_us_complete');
 * });
 *
 * // Or seed all:
 * beforeAll(async () => {
 *   await seedAllMockUsers();
 * });
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface SeededUser {
  user: IUser;
  merchantOnboarding?: ReturnType<typeof MerchantOnboarding.prototype.toObject>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert MockUserClaims to a full User document structure
 */
function claimsToUserDocument(
  claims: MockUserClaims,
  userId: string
): Partial<IUser> {
  const isOnboardingComplete = claims.onboarding_status === "completed";

  // Parse display name into first/last for internal fields
  const displayParts = claims.display_name?.split(" ") || ["Test", "User"];
  const firstName = displayParts[0] || "Test";
  const lastName =
    displayParts.length > 1 ? displayParts.slice(1).join(" ") : "User";

  return {
    _id: new mongoose.Types.ObjectId(claims.dialist_id),
    external_id: userId,
    email: `${userId}@test.dialist.com`,
    first_name: firstName,
    last_name: lastName.replace(".", ""), // Remove trailing dot from "John B."
    display_name: claims.display_name,
    avatar: claims.display_avatar || undefined,
    location: claims.location_country
      ? {
          country: claims.location_country,
          region: claims.location_region || undefined,
          city: null,
          postal_code: claims.location_country === "US" ? "94102" : "M5V 1A1",
        }
      : undefined,
    onboarding: {
      status: claims.onboarding_status,
      version: "v1",
      steps: {
        location: {
          country: claims.location_country,
          postal_code: claims.location_country
            ? claims.location_country === "US"
              ? "94102"
              : "M5V 1A1"
            : null,
          region: claims.location_region || null,
          updated_at: isOnboardingComplete ? new Date() : null,
        },
        display_name: {
          confirmed: isOnboardingComplete,
          value: claims.display_name,
          user_provided: !!claims.display_name,
          updated_at: isOnboardingComplete ? new Date() : null,
        },
        avatar: {
          confirmed: isOnboardingComplete,
          url: claims.display_avatar,
          user_provided: !!claims.display_avatar,
          updated_at: isOnboardingComplete ? new Date() : null,
        },
        acknowledgements: {
          tos: isOnboardingComplete,
          privacy: isOnboardingComplete,
          rules: isOnboardingComplete,
          updated_at: isOnboardingComplete ? new Date() : null,
        },
      },
      completed_at: isOnboardingComplete ? new Date() : undefined,
    },
    marketplace_profile_config: {
      location: "country_region",
      show_name: true,
    },
    marketplace_published: false,
    networks_application_id: claims.networks_application_id
      ? new mongoose.Types.ObjectId(claims.networks_application_id)
      : null,
    networks_published: false,
    networks_profile_config: {
      location: "country_region",
      show_name: true,
    },
    networks_last_accessed: claims.networks_accessed ? new Date() : null,
  };
}

/**
 * Create MerchantOnboarding record if user has merchant state
 */
async function createMerchantOnboardingRecord(
  claims: MockUserClaims
): Promise<ReturnType<typeof MerchantOnboarding.prototype.toObject> | null> {
  if (!claims.onboarding_state) {
    return null;
  }

  const formId = `obf_mock_${claims.dialist_id}`;
  const identityId = `ID_mock_${claims.dialist_id}`;
  const merchantId = claims.isMerchant ? `MU_mock_${claims.dialist_id}` : null;

  const merchantOnboarding = await MerchantOnboarding.findOneAndUpdate(
    { dialist_user_id: new mongoose.Types.ObjectId(claims.dialist_id) },
    {
      form_id: formId,
      identity_id:
        claims.onboarding_state !== "PENDING" ? identityId : undefined,
      merchant_id: merchantId,
      verification_id: claims.isMerchant
        ? `VR_mock_${claims.dialist_id}`
        : undefined,
      dialist_user_id: new mongoose.Types.ObjectId(claims.dialist_id),
      onboarding_state: claims.onboarding_state,
      verification_state: claims.isMerchant ? "SUCCEEDED" : undefined,
      onboarded_at:
        claims.onboarding_state !== "PENDING" ? new Date() : undefined,
      verified_at: claims.isMerchant ? new Date() : undefined,
    },
    { upsert: true, new: true }
  );

  return merchantOnboarding?.toObject() || null;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Seed a single mock user by ID.
 * Creates both User document and MerchantOnboarding if applicable.
 *
 * @param mockUserId - The mock user ID (e.g., 'buyer_us_complete')
 * @returns The created user and optionally merchant onboarding record
 */
export async function seedMockUser(mockUserId: string): Promise<SeededUser> {
  const mockUser = getMockUser(mockUserId);
  if (!mockUser) {
    throw new Error(`Mock user not found: ${mockUserId}`);
  }

  const { auth } = mockUser;
  const claims = auth.sessionClaims;

  // Create user document
  const userData = claimsToUserDocument(claims, auth.userId);
  const user = await User.findOneAndUpdate({ _id: userData._id }, userData, {
    upsert: true,
    new: true,
  });

  if (!user) {
    throw new Error(`Failed to create user for mock: ${mockUserId}`);
  }

  // Create merchant onboarding if applicable
  const merchantOnboarding = await createMerchantOnboardingRecord(claims);

  return {
    user,
    merchantOnboarding: merchantOnboarding || undefined,
  };
}

/**
 * Seed multiple mock users by ID.
 *
 * @param mockUserIds - Array of mock user IDs to seed
 * @returns Map of mock user ID to seeded data
 */
export async function seedMockUsers(
  mockUserIds: string[]
): Promise<Map<string, SeededUser>> {
  const results = new Map<string, SeededUser>();

  for (const id of mockUserIds) {
    const seeded = await seedMockUser(id);
    results.set(id, seeded);
  }

  return results;
}

/**
 * Seed ALL available mock users.
 * Useful for setting up a complete test environment.
 *
 * @returns Map of mock user ID to seeded data
 */
export async function seedAllMockUsers(): Promise<Map<string, SeededUser>> {
  const mockUsersList = getMockUsersList();
  const ids = mockUsersList.map((u) => u.id);
  return seedMockUsers(ids);
}

/**
 * Remove a seeded mock user from the database.
 *
 * @param mockUserId - The mock user ID to remove
 */
export async function removeMockUser(mockUserId: string): Promise<void> {
  const mockUser = getMockUser(mockUserId);
  if (!mockUser) return;

  const dialistId = mockUser.auth.sessionClaims.dialist_id;
  const objectId = new mongoose.Types.ObjectId(dialistId);

  await Promise.all([
    User.deleteOne({ _id: objectId }),
    MerchantOnboarding.deleteOne({ dialist_user_id: objectId }),
  ]);
}

/**
 * Remove all seeded mock users from the database.
 */
export async function removeAllMockUsers(): Promise<void> {
  const mockUsersList = getMockUsersList();

  for (const mockUser of mockUsersList) {
    await removeMockUser(mockUser.id);
  }
}

/**
 * Get list of available mock user IDs for quick reference.
 */
export function getAvailableMockUserIds(): string[] {
  return getMockUsersList().map((u) => u.id);
}

/**
 * Get mock users grouped by category.
 */
export function getMockUsersByCategory(): Record<
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
