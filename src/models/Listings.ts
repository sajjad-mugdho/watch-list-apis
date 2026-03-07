import { Types } from "mongoose";

// ----------------------------------------------------------
// Common Interfaces & Constants
// ----------------------------------------------------------
export const LISTING_STATUS_VALUES = [
  "draft",
  "active",
  "reserved",
  "sold",
] as const;
export type ListingStatus = (typeof LISTING_STATUS_VALUES)[number];

export interface IListingAuthorSnapshot {
  _id: Types.ObjectId;
  name: string;
  avatar?: string;
  location?: any;
}

// ----------------------------------------------------------
// Re-export platform-specific models from their modules
// ----------------------------------------------------------
export {
  MarketplaceListing,
  IMarketplaceListing,
} from "../marketplace/models/MarketplaceListing";
export {
  NetworkListing,
  INetworkListing,
} from "../networks/models/NetworkListing";
