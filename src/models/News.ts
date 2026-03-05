import mongoose, { Document, Schema, Types } from "mongoose";

export interface INews extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  image_url?: string;
  action_url?: string;
  type: "event" | "news" | "promotion";
  status: "draft" | "published" | "expired";
  start_date: Date | null;
  end_date: Date | null;
  is_active: boolean;
  priority: number; // For sorting on dashboard
  createdAt: Date;
  updatedAt: Date;
}

const NewsSchema = new Schema<INews>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    image_url: { type: String, trim: true },
    action_url: { type: String, trim: true },
    type: {
      type: String,
      enum: ["event", "news", "promotion"],
      default: "news",
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "expired"],
      default: "published",
      index: true,
    },
    start_date: { type: Date, default: null },
    end_date: { type: Date, default: null },
    is_active: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

// Index for fetching active news for dashboard
NewsSchema.index({ is_active: 1, status: 1, priority: -1, createdAt: -1 });

export const News = mongoose.model<INews>("News", NewsSchema, "news_content");
export default News;
