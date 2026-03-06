import { IUser, User } from "../models/User";
import { ValidatedUserClaims } from "../types/auth";
import { config } from "../config";
import { clerkClient } from "@clerk/express";
import { getCurrentUserByExternalID, getCurrentUserByID } from "./frequentQueries";
import { userLogger } from "./logger";
import { events } from "./events";
import { getMockUser } from "../middleware/customClerkMw";

type StepKey = "location" | "display_name" | "avatar" | "acknowledgements";

// ---------------- Utilities ----------------
export function computeInternalDisplayName(u: {
  first_name: string;
  last_name: string;
}): string {
  const first = u.first_name.trim();
  const last = u.last_name.trim();

  if (!first || !last)
    throw new Error(
      "computeInternalDisplayName: both first_name and last_name are required"
    );
  return `${first} ${last[0].toUpperCase()}.`;
}

export function getOnboardingProgress(user: IUser) {
  const ob = user?.onboarding ?? ({} as IUser["onboarding"]);
  const s = ob?.steps ?? ({} as IUser["onboarding"]["steps"]);

  const locationOk =
    !!s.location?.country && !!s.location?.postal_code && !!s.location?.region;
  const displayNameOk =
    s.display_name.confirmed &&
    (s.display_name.user_provided ? !!s.display_name.value?.trim() : true);
  const avatarOk =
    !!s.avatar?.confirmed &&
    (s.avatar.user_provided ? !!s.avatar?.url?.trim() : true);
  const acksOk =
    s.acknowledgements.tos &&
    s.acknowledgements.privacy &&
    s.acknowledgements.rules;

  const complete = {
    location: locationOk,
    display_name: displayNameOk,
    avatar: avatarOk,
    acknowledgements: acksOk,
  };

  const order: StepKey[] = [
    "location",
    "display_name",
    "avatar",
    "acknowledgements",
  ];
  const missing = order.filter((k) => !complete[k]);

  if (missing.length > 0) {
    // console.log("ONBOARDING MISSING:", missing, "for user", (user as any)._id);
  }

  return {
    complete,
    missing,
    next_step: (missing[0] ?? null) as StepKey | null,
    last_step: ob.last_step ?? null,
    is_finished: missing.length === 0,
  };
}
const norm = (s?: string | null) => (s ?? "").trim().replace(/\s+/g, " ");
const equalsCI = (a?: string | null, b?: string | null) =>
  norm(a).toLowerCase() === norm(b).toLowerCase();

export async function finalizeOnboarding(user: IUser) {
  const now = new Date();
  const s = user?.onboarding?.steps ?? ({} as IUser["onboarding"]["steps"]);

  // 1) Promote location
  user.location = {
    country: s.location.country,
    postal_code: s.location.postal_code,
    region: s.location.region,
  };

  // 2) Promote display_name ONLY if customized AND not equal to the internal default
  if (
    s.display_name.confirmed &&
    s.display_name.user_provided &&
    s.display_name.value?.trim()
  ) {
    const next = norm(s.display_name.value);
    const prev = norm(user.display_name); // creation-time default is already here
    // Compute canonical internal default for comparison (no write)
    const internalDefault = computeInternalDisplayName(user); // uses strict first/last

    const isSameAsDefault = equalsCI(next, internalDefault);
    const isChanged = !equalsCI(next, prev);

    if (!isSameAsDefault && isChanged) {
      user.display_name_history = user.display_name_history ?? [];
      if (prev)
        user.display_name_history.push({ value: prev, changed_at: now });
      user.display_name = next;
      user.display_name_last_changed_at = now;
    }
    // else: typed the default or no real change -> keep existing default, no history spam
  }

  // 3) Promote avatar
  if (s.avatar.confirmed && s.avatar.user_provided && s.avatar.url?.trim())
    user.avatar = s.avatar.url.trim();

  // 4) Promote acknowledgements
  user.legal_acks = {
    ...(user.legal_acks || {}),
    tos_ack: !!s.acknowledgements?.tos,
    privacy_ack: !!s.acknowledgements?.privacy,
    rules_ack: !!s.acknowledgements?.rules,
  };

  // 5) Lock onboarding
  user.onboarding.status = "completed";
  user.onboarding.completed_at = now;

  await user.save();

  // EMIT EVENT: Onboarding Complete
  events.emit('user:onboarding_complete', {
    userId: user._id.toString(),
  });

  // 6) Sync to Clerk session claims (async, best-effort)
  if (user.external_id) {
    const claims = await buildClaimsFromDbUser(user);
    attemptClerkSync(user.external_id, claims).catch((err) => {
      userLogger.error("Failed to sync claims after onboarding completion", {
        user_id: user._id.toString(),
        external_id: user.external_id,
        error: (err as Error).message,
      });
    });
  }
}

export async function buildClaimsFromDbUser(
  dbUser: IUser
): Promise<ValidatedUserClaims> {
  // Query MerchantOnboarding collection for current merchant state (NOT deprecated user.merchant field)
  let merchantState:
    | "PENDING"
    | "PROVISIONING"
    | "APPROVED"
    | "REJECTED"
    | "UPDATE_REQUESTED"
    | undefined = undefined;
  let isMerchant = false;

  try {
    const MerchantOnboarding = (await import("../models/MerchantOnboarding"))
      .MerchantOnboarding;
    const merchantOnboarding = await MerchantOnboarding.findOne({
      dialist_user_id: dbUser._id,
    });

    if (merchantOnboarding) {
      merchantState = merchantOnboarding.onboarding_state as
        | "PENDING"
        | "PROVISIONING"
        | "APPROVED"
        | "REJECTED"
        | "UPDATE_REQUESTED";
      isMerchant = merchantOnboarding.onboarding_state === "APPROVED";
    }
  } catch (err) {
    userLogger.error("Failed to query MerchantOnboarding", {
      user_id: dbUser._id.toString(),
      error: (err as Error).message,
    });
  }

  // Build base claims
  const claims: ValidatedUserClaims = {
    dialist_id: dbUser._id.toString(),
    display_name: dbUser.display_name,
    display_avatar: dbUser.avatar ?? null,
    location_country: dbUser.location?.country ?? null,
    location_region: dbUser.location?.region ?? null,
    onboarding_status: dbUser.onboarding.status,
    isMerchant, // Always include merchant status (false if no MerchantOnboarding record)
    networks_application_id: dbUser?.networks_application_id
      ? dbUser?.networks_application_id.toString()
      : null,
    networks_accessed: !!dbUser?.networks_last_accessed,
  };

  // Only include merchant onboarding_state if user has started merchant onboarding
  if (merchantState !== undefined) {
    claims.onboarding_state = merchantState;
  }

  return claims;
}

/**
 * Sync user metadata to Clerk public_metadata (best effort, non-blocking)
 * Updates JWT claims on user's next session refresh
 *
 * @param externalId - Clerk user ID (auth.userId)
 * @param claims - Validated user claims from database
 */
async function attemptClerkSync(
  externalId: string,
  claims: ValidatedUserClaims
): Promise<void> {
  if (!config.featureClerkMutations) {
    return;
  }
  try {
    await clerkClient.users.updateUserMetadata(externalId, {
      publicMetadata: claims,
    });
    userLogger.info(`Successfully synced claims to Clerk`, {
      external_id: externalId,
      operation: "clerk_sync",
    });
  } catch (err) {
    userLogger.error(`Failed to sync claims to Clerk`, {
      external_id: externalId,
      error: (err as Error).message,
      stack: (err as Error).stack,
      operation: "clerk_sync",
    });
    // Don't throw - this is best-effort
  }
}

/**
 * Load user from database and build claims (DB fallback for missing JWT claims)
 * Queries by dialist_id (preferred) or external_id, then syncs to Clerk async
 *
 * @param input.dialist_id - Internal user ID (faster lookup if available)
 * @param input.external_id - Clerk user ID (fallback lookup method)
 * @returns Complete validated user claims
 */
export async function fetchAndSyncLocalUser(input: {
  external_id: string;
  dialist_id?: string;
}): Promise<ValidatedUserClaims> {
  const { dialist_id, external_id } = input;

  
  let user: IUser | null = null;
  
  try {
    user = dialist_id
      ? await getCurrentUserByID(dialist_id)
      : await getCurrentUserByExternalID(external_id);
  } catch (err) {
    // If user not found, check if it's a mock user in dev/test
    if ((config.nodeEnv === "development" || config.nodeEnv === "test")) {
      const mockUser = getMockUser(external_id);
      if (mockUser) {
        userLogger.info(`Auto-provisioning missing mock user ${external_id}`);
        // Simple provisioning for mock users
        const claims = mockUser.auth.sessionClaims;
        const displayParts = claims.display_name?.split(" ") || ["Mock", "User"];
        const firstName = displayParts[0] || "Mock";
        const lastName = displayParts.length > 1 ? displayParts.slice(1).join(" ") : "User";
        
        user = new User({
          _id: dialist_id || claims.dialist_id,
          external_id: external_id,
          email: `${external_id}@test.dialist.com`,
          first_name: firstName,
          last_name: lastName,
          display_name: claims.display_name,
          avatar: claims.display_avatar,
          onboarding: {
            status: claims.onboarding_status,
            steps: {
              location: { country: claims.location_country as any, region: claims.location_region },
              display_name: { confirmed: claims.onboarding_status === "completed", value: claims.display_name, user_provided: !!claims.display_name },
              avatar: { confirmed: claims.onboarding_status === "completed", url: claims.display_avatar, user_provided: !!claims.display_avatar },
              acknowledgements: { tos: claims.onboarding_status === "completed", privacy: claims.onboarding_status === "completed", rules: claims.onboarding_status === "completed" }
            }
          }
        });
        await user.save();
      }
    }
    
    if (!user) throw err;
  }

  const claims = await buildClaimsFromDbUser(user);
  // Attempt to sync back to Clerk (async, non-blocking)
  // Skip clerk sync for mock users
  if (!getMockUser(external_id)) {
    attemptClerkSync(external_id, claims).catch((err) => {
      userLogger.error(`Background Clerk sync failed`, {
        external_id,
        dialist_id,
        error: (err as Error).message,
        stack: (err as Error).stack,
        operation: "background_clerk_sync",
      });
    });
  }

  return claims;
}

/**
 * Get user by external ID, creating them from Clerk data if they don't exist.
 * Returns the full User document.
 */
export async function getOrCreateUser(externalId: string): Promise<IUser> {
  let user = await User.findOne({ external_id: externalId });

  if (!user) {
    try {
      const clerkUser = await clerkClient.users.getUser(externalId);
      
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      const firstName = clerkUser.firstName || "User";
      const lastName = clerkUser.lastName || "Unknown";

      if (!email) {
        throw new Error(`Clerk user ${externalId} has no email address`);
      }
      
      user = new User({
        external_id: externalId,
        email: email,
        first_name: firstName,
        last_name: lastName,
        display_name: `${firstName} ${lastName}`.trim(),
        avatar: clerkUser.imageUrl,
        onboarding: {
          status: "incomplete",
          steps: {
            location: {},
            display_name: { confirmed: false, user_provided: false },
            avatar: { confirmed: false, user_provided: false },
            acknowledgements: { tos: false, privacy: false, rules: false }
          }
        }
      });
      
      await user.save();
      userLogger.info("Auto-provisioned new user from Clerk", { userId: user._id, externalId });
    } catch (error) {
      userLogger.error("Failed to auto-provision user", { externalId, error });
      throw error;
    }
  }
  
  return user;
}
