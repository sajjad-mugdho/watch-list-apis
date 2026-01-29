/**
 * Favorite Model
 *
 * Tracks user's favorite listings, watches, and users.
 */

import mongoose, { Document, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------

// Favorites should ONLY apply to Listings (for-sale and WTB/ISO)
// Users can toggle between "For Sale" and "WTB" views in the UI
export const FAVORITE_TYPE_VALUES = [
  "for_sale",  // For-Sale listings (Marketplace + Networks)
  "wtb",       // Want-to-Buy/ISO listings (Networks only)
] as const;
export type FavoriteType = (typeof FAVORITE_TYPE_VALUES)[number];

// Platform values for scoping favorites
export const PLATFORM_VALUES = ["marketplace", "networks"] as const;
export type Platform = (typeof PLATFORM_VALUES)[number];

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------

export interface IFavorite extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  item_type: FavoriteType;
  item_id: Types.ObjectId;
  platform: Platform;  // Platform scoping
  createdAt: Date;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------

const FavoriteSchema = new Schema<IFavorite>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    item_type: {
      type: String,
      enum: FAVORITE_TYPE_VALUES,
      required: true,
      index: true,
    },
    item_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: PLATFORM_VALUES,
      required: true,
      default: "marketplace",
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Unique compound index to prevent duplicate favorites
// Unique compound index now includes platform for cross-platform scoping
FavoriteSchema.index({ user_id: 1, item_type: 1, item_id: 1, platform: 1 }, { unique: true });

// Transform _id to string in JSON
FavoriteSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.user_id = ret.user_id?.toString?.();
    ret.item_id = ret.item_id?.toString?.();
    return ret;
  },
});

// ----------------------------------------------------------
// Statics
// ----------------------------------------------------------

interface IFavoriteModel extends mongoose.Model<IFavorite> {
  isFavorited(
    userId: string,
    itemType: FavoriteType,
    itemId: string
  ): Promise<boolean>;
  getFavorites(
    userId: string,
    itemType?: FavoriteType,
    limit?: number,
    offset?: number
  ): Promise<IFavorite[]>;
  countFavorites(userId: string, itemType?: FavoriteType): Promise<number>;
}

FavoriteSchema.statics.isFavorited = async function (
  userId: string,
  itemType: FavoriteType,
  itemId: string
): Promise<boolean> {
  const favorite = await this.findOne({
    user_id: userId,
    item_type: itemType,
    item_id: itemId,
  });
  return !!favorite;
};

FavoriteSchema.statics.getFavorites = async function (
  userId: string,
  itemType?: FavoriteType,
  limit: number = 20,
  offset: number = 0
): Promise<IFavorite[]> {
  const query: Record<string, any> = { user_id: userId };
  if (itemType) query.item_type = itemType;

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

FavoriteSchema.statics.countFavorites = async function (
  userId: string,
  itemType?: FavoriteType
): Promise<number> {
  const query: Record<string, any> = { user_id: userId };
  if (itemType) query.item_type = itemType;

  return this.countDocuments(query);
};

export const Favorite = mongoose.model<IFavorite, IFavoriteModel>(
  "Favorite",
  FavoriteSchema,
  "favorites"
);

export default Favorite;
