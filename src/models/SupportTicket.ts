/**
 * SupportTicket Model
 * 
 * In-app support ticket system for user issues
 * Tracks conversations between users and support team
 */

import mongoose, { Document, Schema, Types, Model } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------

export const TICKET_STATUS_VALUES = [
  "open",         // New ticket, awaiting response
  "in_progress",  // Being worked on
  "awaiting_user", // Waiting for user response
  "resolved",     // Issue resolved
  "closed",       // Ticket closed (may reopen)
] as const;
export type TicketStatus = (typeof TICKET_STATUS_VALUES)[number];

export const TICKET_PRIORITY_VALUES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;
export type TicketPriority = (typeof TICKET_PRIORITY_VALUES)[number];

export const TICKET_CATEGORY_VALUES = [
  "order_issue",
  "payment_issue",
  "account_issue",
  "listing_issue",
  "technical_bug",
  "feature_request",
  "fraud_report",
  "other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORY_VALUES)[number];

// ----------------------------------------------------------
// Interface
// ----------------------------------------------------------

export interface ITicketMessage {
  sender_id: Types.ObjectId;
  sender_type: "user" | "support";
  message: string;
  attachments?: string[];
  created_at: Date;
}

export interface ISupportTicket extends Document {
  _id: Types.ObjectId;
  
  // Ticket owner
  user_id: Types.ObjectId;
  
  // Ticket details
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  
  // Conversation thread
  messages: ITicketMessage[];
  
  // Related resources (optional)
  related_order_id?: Types.ObjectId | null;
  related_listing_id?: Types.ObjectId | null;
  
  // Assignment
  assigned_to?: string | null; // Support agent ID
  
  // Resolution
  resolution_notes?: string | null;
  resolved_at?: Date | null;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface ISupportTicketModel extends Model<ISupportTicket> {
  getOpenTickets(userId: string): Promise<ISupportTicket[]>;
  getTicketsByStatus(status: TicketStatus, limit?: number): Promise<ISupportTicket[]>;
}

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------

const TicketMessageSchema = new Schema<ITicketMessage>(
  {
    sender_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender_type: {
      type: String,
      enum: ["user", "support"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    attachments: [{
      type: String, // URLs to uploaded files
    }],
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      enum: TICKET_CATEGORY_VALUES,
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: TICKET_PRIORITY_VALUES,
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: TICKET_STATUS_VALUES,
      default: "open",
      index: true,
    },
    messages: [TicketMessageSchema],
    related_order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    related_listing_id: {
      type: Schema.Types.ObjectId,
      ref: "NetworkListing",
      default: null,
    },
    assigned_to: {
      type: String,
      default: null,
      index: true,
    },
    resolution_notes: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    resolved_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ----------------------------------------------------------
// Indexes
// ----------------------------------------------------------

// For querying user's tickets
SupportTicketSchema.index({ user_id: 1, status: 1, createdAt: -1 });

// For support dashboard queries
SupportTicketSchema.index({ status: 1, priority: 1, createdAt: 1 });
SupportTicketSchema.index({ assigned_to: 1, status: 1 });

// ----------------------------------------------------------
// Static Methods
// ----------------------------------------------------------

SupportTicketSchema.statics.getOpenTickets = async function(
  userId: string
): Promise<ISupportTicket[]> {
  const objectId = new Types.ObjectId(userId);
  return this.find({
    user_id: objectId,
    status: { $nin: ["resolved", "closed"] },
  }).sort({ updatedAt: -1 });
};

SupportTicketSchema.statics.getTicketsByStatus = async function(
  status: TicketStatus,
  limit: number = 50
): Promise<ISupportTicket[]> {
  return this.find({ status })
    .sort({ priority: -1, createdAt: 1 }) // Urgent first, oldest first
    .limit(limit)
    .populate("user_id", "display_name email");
};

// ----------------------------------------------------------
// Instance Methods
// ----------------------------------------------------------

SupportTicketSchema.methods.addMessage = async function(
  senderId: string,
  senderType: "user" | "support",
  message: string,
  attachments?: string[]
): Promise<ISupportTicket> {
  this.messages.push({
    sender_id: new Types.ObjectId(senderId),
    sender_type: senderType,
    message,
    attachments: attachments || [],
    created_at: new Date(),
  });
  
  // Update status based on sender
  if (senderType === "support" && this.status === "open") {
    this.status = "in_progress";
  } else if (senderType === "user" && this.status === "awaiting_user") {
    this.status = "in_progress";
  }
  
  return this.save();
};

SupportTicketSchema.methods.resolve = async function(
  resolutionNotes: string
): Promise<ISupportTicket> {
  this.status = "resolved";
  this.resolution_notes = resolutionNotes;
  this.resolved_at = new Date();
  return this.save();
};

SupportTicketSchema.methods.close = async function(): Promise<ISupportTicket> {
  this.status = "closed";
  return this.save();
};

SupportTicketSchema.methods.reopen = async function(): Promise<ISupportTicket> {
  if (this.status === "closed" || this.status === "resolved") {
    this.status = "open";
    this.resolved_at = null;
  }
  return this.save();
};

// ----------------------------------------------------------
// Transform
// ----------------------------------------------------------

SupportTicketSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret._id = ret._id?.toString?.();
    ret.user_id = ret.user_id?.toString?.();
    ret.related_order_id = ret.related_order_id?.toString?.();
    ret.related_listing_id = ret.related_listing_id?.toString?.();
    return ret;
  },
});

// ----------------------------------------------------------
// Export
// ----------------------------------------------------------

export const SupportTicket = mongoose.model<ISupportTicket, ISupportTicketModel>(
  "SupportTicket",
  SupportTicketSchema,
  "support_tickets"
);
