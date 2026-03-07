// src/utils/listingStatusMachine.ts
import { ClientSession, Types } from "mongoose";
import { ValidationError } from "./errors";
import { NetworkListing } from "../networks/models/NetworkListing";

export type ListingStatus =
  | "draft"
  | "active"
  | "reserved"
  | "sold"
  | "inactive";

export interface StatusTransition {
  from: ListingStatus;
  to: ListingStatus;
  allowed: boolean;
  description: string;
}

// Define valid transitions as array (for reference and error messages)
const VALID_TRANSITIONS_ARRAY: StatusTransition[] = [
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
  {
    from: "active",
    to: "inactive",
    allowed: true,
    description: "Deactivate listing",
  },
  {
    from: "inactive",
    to: "active",
    allowed: true,
    description: "Reactivate listing",
  },
  {
    from: "draft",
    to: "inactive",
    allowed: true,
    description: "Archive draft",
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
  {
    from: "reserved",
    to: "inactive",
    allowed: false,
    description: "Cannot deactivate reserved listing",
  },
];

// Export as both the array and a map format for tests
export const VALID_TRANSITIONS_ARRAY_EXPORT = VALID_TRANSITIONS_ARRAY;

// Create a map-based format for easier testing
// Maps from status to allowed next statuses
export const VALID_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  draft: ["active", "inactive"],
  active: ["reserved", "sold", "inactive"],
  reserved: ["sold"],
  sold: [],
  inactive: ["active"],
};

/**
 * Validates if a status transition is allowed
 * @param from - Current status
 * @param to - Target status
 * @returns true if transition is allowed
 */
export function isValidTransition(
  from: ListingStatus,
  to: ListingStatus,
): boolean {
  const allowedStatuses = VALID_TRANSITIONS[from];
  return allowedStatuses ? allowedStatuses.includes(to) : false;
}

/**
 * Gets error message for invalid transition
 * @param from - Current status
 * @param to - Target status
 * @returns Error message
 */
export function getTransitionError(
  from: ListingStatus,
  to: ListingStatus,
): string {
  const transition = VALID_TRANSITIONS_ARRAY.find(
    (t) => t.from === from && t.to === to,
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
  currentStatus: ListingStatus,
): ListingStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Transitions a listing status with validation
 * @param listingIdOrObject - Listing ID (ObjectId) or legacy listing document object
 * @param statusOrCurrentStatus - Current status (when using ID) or new status (legacy)
 * @param newStatusOrSession - New status (when using ID) or session (legacy)
 * @param contextOrSession - Context object with userId and session, or session (legacy)
 * @returns Updated listing document with new status
 * @throws ValidationError if transition is invalid
 */
export async function transitionListingStatus(
  listingIdOrObject: Types.ObjectId | any,
  statusOrCurrentStatus: ListingStatus,
  newStatusOrSession?: ListingStatus | ClientSession,
  contextOrSession?:
    | { userId?: Types.ObjectId; session?: ClientSession }
    | ClientSession,
): Promise<any> {
  // Determine if this is the new interface (listing ID) or legacy interface (listing object)
  const isNewInterface = listingIdOrObject instanceof Types.ObjectId;

  if (isNewInterface) {
    // New interface: transitionListingStatus(listingId, currentStatus, newStatus, context?)
    const listingId = listingIdOrObject as Types.ObjectId;
    const currentStatus = statusOrCurrentStatus as ListingStatus;
    const newStatus = newStatusOrSession as ListingStatus;
    const context = contextOrSession as
      | { userId?: Types.ObjectId; session?: ClientSession }
      | undefined;
    const session = context?.session;

    // Validate transition
    if (!isValidTransition(currentStatus, newStatus)) {
      throw new ValidationError(getTransitionError(currentStatus, newStatus));
    }

    // Update listing in database and return updated document
    const updated = await NetworkListing.findByIdAndUpdate(
      listingId,
      { status: newStatus, updated_at: new Date() },
      { session, new: true },
    );
    return updated;
  } else {
    // Legacy interface: transitionListingStatus(listing, newStatus, session?)
    const listing = listingIdOrObject as any;
    const newStatus = statusOrCurrentStatus as ListingStatus;
    const session = newStatusOrSession as ClientSession | undefined;

    if (listing.status === newStatus) {
      return listing; // No-op if already in target status
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

    await listing.save(session ? { session } : undefined);
    return listing;
  }
}
