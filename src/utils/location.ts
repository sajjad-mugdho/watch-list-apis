/**
 * Location Normalization Utilities
 *
 * Converts user-provided location data to Finix-compatible formats:
 * - Country codes: "US"/"CA" → "USA"/"CAN"
 * - Region codes: Full state/province names → 2-letter codes
 * - Postal codes: Validates and formats ZIP/postal codes
 */

// US State Mappings (full name → 2-letter code)
export const US_STATES: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};

// Canadian Province Mappings (full name → 2-letter code)
export const CA_PROVINCES: Record<string, string> = {
  Alberta: "AB",
  "British Columbia": "BC",
  Manitoba: "MB",
  "New Brunswick": "NB",
  "Newfoundland and Labrador": "NL",
  "Northwest Territories": "NT",
  "Nova Scotia": "NS",
  Nunavut: "NU",
  Ontario: "ON",
  "Prince Edward Island": "PE",
  Quebec: "QC",
  Saskatchewan: "SK",
  Yukon: "YT",
};

/**
 * Convert country code from User model format to Finix format
 * @param country - "US" or "CA" from user model
 * @returns "USA" or "CAN" for Finix API
 */
export function getCountryName(country: "US" | "CA"): "USA" | "CAN" {
  return country === "US" ? "USA" : "CAN";
}

/**
 * Normalize region code (state/province) to 2-letter abbreviation
 * Handles both full names and abbreviations
 *
 * @param region - Full state/province name or 2-letter code
 * @param country - "USA" or "CAN" to determine which mapping to use
 * @returns 2-letter region code (e.g., "WA", "ON")
 */
export function normalizeRegionCode(
  region: string | null | undefined,
  country: "USA" | "CAN"
): string | null {
  if (!region || !region.trim()) {
    return null;
  }

  const trimmedRegion = region.trim();

  // If already a 2-letter code, return it uppercased
  if (trimmedRegion.length === 2) {
    return trimmedRegion.toUpperCase();
  }

  // Look up full name in the appropriate mapping
  const mapping = country === "USA" ? US_STATES : CA_PROVINCES;

  // Try exact match first
  if (mapping[trimmedRegion]) {
    return mapping[trimmedRegion];
  }

  // Try case-insensitive match
  const lowerRegion = trimmedRegion.toLowerCase();
  for (const [fullName, code] of Object.entries(mapping)) {
    if (fullName.toLowerCase() === lowerRegion) {
      return code;
    }
  }

  // If no match found, return original value uppercased (assume it's already a code)
  return trimmedRegion.toUpperCase();
}

/**
 * Validate and format postal code
 * - US: 5-digit ZIP code (e.g., "98040") or ZIP+4 format (e.g., "98040-1234")
 * - Canada: 6-character format (e.g., "K1A 0A6" or "K1A0A6")
 *
 * @param postalCode - Raw postal code input
 * @param country - "USA" or "CAN" to determine validation rules
 * @returns Formatted postal code or null if invalid
 */
export function validateAndFormatPostalCode(
  postalCode: string | null | undefined,
  country: "USA" | "CAN"
): string | null {
  if (!postalCode || !postalCode.trim()) {
    return null;
  }

  const trimmed = postalCode.trim().toUpperCase();

  if (country === "USA") {
    // US ZIP code: 5 digits or 5+4 format
    const zipRegex = /^(\d{5})(-\d{4})?$/;
    const match = trimmed.match(zipRegex);
    return match ? match[1] : null; // Return 5-digit portion
  } else {
    // Canadian postal code: A1A 1A1 or A1A1A1 format
    const canRegex = /^([A-Z]\d[A-Z])\s?(\d[A-Z]\d)$/;
    const match = trimmed.match(canRegex);
    if (match) {
      return `${match[1]} ${match[2]}`; // Return with space: "K1A 0A6"
    }
    return null;
  }
}

/**
 * Validate location data completeness for Finix form prefill
 * @returns true if all required fields are present and valid
 */
export function isLocationComplete(location: {
  country?: string | null;
  region?: string | null;
  postal_code?: string | null;
}): boolean {
  return !!(location.country && location.region && location.postal_code);
}
