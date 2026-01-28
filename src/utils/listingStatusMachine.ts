// src/utils/listingStatusMachine.ts
import { ValidationError } from "./errors";

export type ListingStatus = "draft" | "active" | "reserved" | "sold";

export interface StatusTransition {
  from: ListingStatus;
  to: ListingStatus;
  allowed: boolean;
  description: string;
}

// Define valid transitions
const VALID_TRANSITIONS: StatusTransition[] = [
  {
    from: "draft",
    to: "active",
    allowed: true,
    description: "Publish listing",
  },
  {
    from: "active",
    to: "reserved",
    allowed: true,
    description: "Offer accepted, order created",
  },
  {
    from: "reserved",
    to: "sold",
    allowed: true,
    description: "Order completed",
  },
  {
    from: "active",
    to: "sold",
    allowed: true,
    description: "Direct sale (no offer)",
  },
  // Invalid transitions (for error messages)
  {
    from: "draft",
    to: "sold",
    allowed: false,
    description: "Cannot sell draft listing",
  },
  {
    from: "sold",
    to: "active",
    allowed: false,
    description: "Cannot reactivate sold listing",
  },
  {
    from: "reserved",
    to: "active",
    allowed: false,
    description: "Cannot unreserve listing",
  },
];

/**
 * Validates if a status transition is allowed
 * @param from - Current status
 * @param to - Target status
 * @returns true if transition is allowed
 */
export function isValidTransition(
  from: ListingStatus,
  to: ListingStatus
): boolean {
  const transition = VALID_TRANSITIONS.find(
    (t) => t.from === from && t.to === to
  );
  return transition?.allowed ?? false;
}

/**
 * Gets error message for invalid transition
 * @param from - Current status
 * @param to - Target status
 * @returns Error message
 */
export function getTransitionError(
  from: ListingStatus,
  to: ListingStatus
): string {
  const transition = VALID_TRANSITIONS.find(
    (t) => t.from === from && t.to === to
  );
  if (transition?.allowed) {
    return "";
  }
  return transition?.description || `Invalid transition from ${from} to ${to}`;
}

/**
 * Gets all possible next statuses for a given status
 * @param currentStatus - Current listing status
 * @returns Array of allowed next statuses
 */
export function getAllowedTransitions(
  currentStatus: ListingStatus
): ListingStatus[] {
  return VALID_TRANSITIONS.filter(
    (t) => t.from === currentStatus && t.allowed
  ).map((t) => t.to);
}

/**
 * Transitions a listing status with validation
 * @param listing - Listing document (must have save() method)
 * @param newStatus - Target status
 * @throws ValidationError if transition is invalid
 */
export async function transitionListingStatus(
  listing: any,
  newStatus: ListingStatus
): Promise<void> {
  if (listing.status === newStatus) {
    return; // No-op if already in target status
  }

  if (!isValidTransition(listing.status, newStatus)) {
    throw new ValidationError(getTransitionError(listing.status, newStatus));
  }

  // Update status and timestamp
  listing.status = newStatus;

  // Add status-specific timestamps
  switch (newStatus) {
    case "active":
      listing.published_at = new Date();
      break;
    case "reserved":
      listing.reserved_at = new Date();
      break;
    case "sold":
      listing.sold_at = new Date();
      break;
  }

  await listing.save();
}
