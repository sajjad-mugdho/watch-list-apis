/**
 * Shared utility for validating listing completeness
 * Removes code duplication between marketplace and networks listing handlers
 */

export interface ListingForValidation {
  shipping?: Array<any> | null;
  price?: number | null;
  images?: string[] | null;
  thumbnail?: string | null;
  contents?: string | null;
  condition?: string | null;
}

/**
 * Validate that a listing has all required fields for publishing
 * @param listing - Listing document with required fields
 * @returns Array of missing field names (empty if complete)
 */
export function validateListingCompleteness(
  listing: ListingForValidation
): string[] {
  const missing: string[] = [];

  if (!listing.shipping || listing.shipping.length < 1) {
    missing.push("shipping");
  }
  if (!listing.price || listing.price <= 0) {
    missing.push("price");
  }
  if (!listing.images || listing.images.length < 3) {
    missing.push("images (min 3)");
  }
  if (!listing.thumbnail) {
    missing.push("thumbnail");
  }
  if (!listing.contents) {
    missing.push("contents");
  }
  if (!listing.condition) {
    missing.push("condition");
  }

  return missing;
}
