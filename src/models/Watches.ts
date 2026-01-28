import mongoose, { Schema, Model } from "mongoose";

// Watch category constants (Gap Fill Phase 2)
export const WATCH_CATEGORY_VALUES = [
  "Luxury",
  "Sport",
  "Dress",
  "Vintage",
  "Casual",
  "Dive",
  "Pilot",
  "Uncategorized",
] as const;
export type WatchCategory = (typeof WATCH_CATEGORY_VALUES)[number];

export interface IWatch {
  brand: string;
  model: string;
  reference: string;
  diameter: string;
  color: string;
  bezel: string;
  materials: string;
  bracelet: string;
  images?: {
    watch?: string;
    dial?: string;
  };
  // Gap Fill Phase 2
  category?: WatchCategory;
}

export interface IWatchModel extends Model<IWatch> {}

const watchSchema = new Schema<IWatch>(
  {
    brand: { type: String, required: true, index: true },
    model: { type: String, required: true },
    reference: { type: String, required: true },
    diameter: { type: String, required: true },
    bezel: { type: String, required: true },
    materials: { type: String, required: true },
    bracelet: { type: String, required: true },
    images: {
      watch: { type: String },
      dial: { type: String },
    },
    // Gap Fill Phase 2: Watch category for search/filter
    category: {
      type: String,
      enum: WATCH_CATEGORY_VALUES,
      default: "Uncategorized",
      index: true,
    },
  },
  {
    strict: true,
  }
);

watchSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id.toString();
    return ret;
  },
});

export const Watch = mongoose.model<IWatch, IWatchModel>("Watch", watchSchema);
