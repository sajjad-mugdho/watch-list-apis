// src/types/auth.ts

/**
 * UserClaims — Clerk session claims that may be incomplete.
 * This matches the shape of the Zod schema in validation/schemas.ts
 */
export interface UserClaims {
  dialist_id?: string;
  onboarding_status?: "incomplete" | "completed";
  display_name?: string | null;
  networks_application_id?: string | null;
  networks_accessed?: boolean | null;
  display_avatar?: string;
  location_country?: string;
  location_region?: string;
  onboarding_state?: "PENDING" | "PROVISIONING" | "UPDATE_REQUESTED" | "REJECTED" | "APPROVED";
  [key: string]: any;
}

/**
 * ValidatedUserClaims — After DB fallback.
 * dialist_id and onboarding_status are guaranteed.
 */
export interface ValidatedUserClaims {
  dialist_id: string;
  onboarding_status: "incomplete" | "completed";
  display_name: string | null;
  networks_application_id: string | null;
  networks_accessed: boolean | null;
  display_avatar?: string | null;
  location_country?: string | null;
  location_region?: string | null;
  onboarding_state?:
    | "PENDING"
    | "PROVISIONING"
    | "UPDATE_REQUESTED"
    | "REJECTED"
    | "APPROVED"
    | null;
  isMerchant?: boolean | null;
  [key: string]: any; // Add index signature for compatibility with Clerk's UserPublicMetadata
}


/** User object we attach to req (from Clerk claims) */
export interface RequestUser extends ValidatedUserClaims {
  userId: string;
}
