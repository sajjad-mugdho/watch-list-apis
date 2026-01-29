/**
 * RecentSearch Model
 *
 * Tracks user's recent search queries for quick access.
 */

import mongoose, { Document, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------

// Platform values for scoping searches
export const PLATFORM_VALUES = ["marketplace", "networks"] as const;
export type Platform = (typeof PLATFORM_VALUES)[number];

// Search context types 
export const SEARCH_CONTEXT_VALUES = ["for-sale", "profiles", "wtb-iso"] as const;
export type SearchContext = (typeof SEARCH_CONTEXT_VALUES)[number];

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------

export interface IRecentSearch extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  query: string;
  platform: Platform;  // NEW: Platform scoping
  context?: SearchContext;  // NEW: Search context (for-sale, profiles, wtb-iso)
  filters?: Record<string, any>;
  result_count?: number;
  createdAt: Date;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------

// Maximum recent searches to keep per user
const MAX_RECENT_SEARCHES = 20;

const RecentSearchSchema = new Schema<IRecentSearch>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    platform: {
      type: String,
      enum: PLATFORM_VALUES,
      required: true,
      default: "marketplace",
      index: true,
    },
    context: {
      type: String,
      enum: SEARCH_CONTEXT_VALUES,
      default: "for-sale",
    },
    filters: {
      type: Schema.Types.Mixed,
      default: null,
    },
    result_count: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Index for efficient queries
RecentSearchSchema.index({ user_id: 1, createdAt: -1 });

// Transform _id to string in JSON
RecentSearchSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.user_id = ret.user_id?.toString?.();
    return ret;
  },
});

// ----------------------------------------------------------
// Statics
// ----------------------------------------------------------

interface IRecentSearchModel extends mongoose.Model<IRecentSearch> {
  addSearch(
    userId: string,
    query: string,
    filters?: Record<string, any>,
    resultCount?: number
  ): Promise<IRecentSearch>;
  getRecentSearches(
    userId: string,
    limit?: number
  ): Promise<IRecentSearch[]>;
  clearSearches(userId: string): Promise<void>;
}

RecentSearchSchema.statics.addSearch = async function (
  userId: string,
  query: string,
  filters?: Record<string, any>,
  resultCount?: number
): Promise<IRecentSearch> {
  // Remove duplicate search if exists
  await this.deleteMany({ user_id: userId, query: query.toLowerCase().trim() });

  // Create new search
  const search = await this.create({
    user_id: userId,
    query: query.toLowerCase().trim(),
    filters,
    result_count: resultCount,
  });

  // Cleanup old searches (keep only MAX_RECENT_SEARCHES)
  const searchCount = await this.countDocuments({ user_id: userId });
  if (searchCount > MAX_RECENT_SEARCHES) {
    const oldSearches = await this.find({ user_id: userId })
      .sort({ createdAt: 1 })
      .limit(searchCount - MAX_RECENT_SEARCHES);

    await this.deleteMany({
      _id: { $in: oldSearches.map((s: any) => s._id) },
    });
  }

  return search;
};

RecentSearchSchema.statics.getRecentSearches = async function (
  userId: string,
  limit: number = 10
): Promise<IRecentSearch[]> {
  return this.find({ user_id: userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

RecentSearchSchema.statics.clearSearches = async function (
  userId: string
): Promise<void> {
  await this.deleteMany({ user_id: userId });
};

export const RecentSearch = mongoose.model<IRecentSearch, IRecentSearchModel>(
  "RecentSearch",
  RecentSearchSchema,
  "recent_searches"
);

export default RecentSearch;
