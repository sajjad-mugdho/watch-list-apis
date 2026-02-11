// src/models/TrustCase.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------
export const TRUST_CASE_STATUS_VALUES = [
  "OPEN",
  "INVESTIGATING",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
] as const;

export const TRUST_CASE_PRIORITY_VALUES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const TRUST_CASE_CATEGORY_VALUES = [
  "fraud",
  "dispute",
  "safety",
  "abuse",
  "other",
] as const;

export type TrustCaseStatus = (typeof TRUST_CASE_STATUS_VALUES)[number];
export type TrustCasePriority = (typeof TRUST_CASE_PRIORITY_VALUES)[number];
export type TrustCaseCategory = (typeof TRUST_CASE_CATEGORY_VALUES)[number];

// ----------------------------------------------------------
// Interfaces
// ----------------------------------------------------------
export interface ICaseNote {
  author_id: Types.ObjectId;
  content: string;
  created_at: Date;
}

export interface ISuspensionAction {
  user_id: Types.ObjectId;
  duration_days: number;
  reason: string;
  applied_at: Date;
}

export interface IEvidenceSnapshot {
  chat_history: any[]; // Raw message data
  offer_history: any[]; // Raw offer revision data
  vouches: any[]; // Raw vouch data
  order_snapshot?: any;
  user_profiles: {
    reported?: any;
    reporter?: any;
  };
  captured_at: Date;
}

export interface ITrustCase extends Document {
  _id: Types.ObjectId;

  // Case identifier
  case_number: string; // Format: TC-YYYY-NNNNNN

  // References (at least one should be set)
  order_id?: Types.ObjectId;
  reference_check_id?: Types.ObjectId;
  reported_user_id?: Types.ObjectId;
  reporter_user_id?: Types.ObjectId;

  // Status
  status: TrustCaseStatus;
  priority: TrustCasePriority;
  category: TrustCaseCategory;

  // Assignment
  assigned_to?: Types.ObjectId; // Admin user ID
  escalated_to?: Types.ObjectId;

  // Evidence (immutable snapshots)
  evidence_snapshot: IEvidenceSnapshot;

  // Notes
  notes: ICaseNote[];

  // Resolution
  resolution?: string;
  suspension_applied?: ISuspensionAction;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  resolved_at?: Date;
}

export interface ITrustCaseModel extends Model<ITrustCase> {
  generateCaseNumber(): Promise<string>;

  findOpen(): Promise<ITrustCase[]>;

  findByAssignee(adminId: string | Types.ObjectId): Promise<ITrustCase[]>;

  findByReportedUser(userId: string | Types.ObjectId): Promise<ITrustCase[]>;
}

// ----------------------------------------------------------
// Sub-schemas
// ----------------------------------------------------------
const CaseNoteSchema = new Schema<ICaseNote>(
  {
    author_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const SuspensionActionSchema = new Schema<ISuspensionAction>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    duration_days: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    applied_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const EvidenceSnapshotSchema = new Schema<IEvidenceSnapshot>(
  {
    chat_history: [{ type: Schema.Types.Mixed }],
    offer_history: [{ type: Schema.Types.Mixed }],
    vouches: [{ type: Schema.Types.Mixed }],
    order_snapshot: { type: Schema.Types.Mixed },
    user_profiles: {
      reported: { type: Schema.Types.Mixed },
      reporter: { type: Schema.Types.Mixed },
    },
    captured_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// ----------------------------------------------------------
// Schema
// ----------------------------------------------------------
const TrustCaseSchema = new Schema<ITrustCase>(
  {
    case_number: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },

    reference_check_id: {
      type: Schema.Types.ObjectId,
      ref: "ReferenceCheck",
      index: true,
    },

    reported_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    reporter_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    status: {
      type: String,
      enum: TRUST_CASE_STATUS_VALUES,
      default: "OPEN",
      required: true,
      index: true,
    },

    priority: {
      type: String,
      enum: TRUST_CASE_PRIORITY_VALUES,
      default: "medium",
      required: true,
      index: true,
    },

    category: {
      type: String,
      enum: TRUST_CASE_CATEGORY_VALUES,
      required: true,
      index: true,
    },

    assigned_to: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    escalated_to: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    evidence_snapshot: {
      type: EvidenceSnapshotSchema,
      required: true,
    },

    notes: {
      type: [CaseNoteSchema],
      default: [],
    },

    resolution: {
      type: String,
      trim: true,
    },

    suspension_applied: {
      type: SuspensionActionSchema,
    },

    resolved_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// ----------------------------------------------------------
// Indexes
// ----------------------------------------------------------
TrustCaseSchema.index({ status: 1, priority: -1, createdAt: -1 });
TrustCaseSchema.index({ assigned_to: 1, status: 1 });

// ----------------------------------------------------------
// Static Methods
// ----------------------------------------------------------
TrustCaseSchema.statics.generateCaseNumber = async function (): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TC-${year}-`;

  // Find the highest case number for this year
  const lastCase = await this.findOne({
    case_number: { $regex: `^${prefix}` },
  })
    .sort({ case_number: -1 })
    .lean();

  let nextNumber = 1;
  if (lastCase?.case_number) {
    const lastNumber = parseInt(lastCase.case_number.split("-")[2], 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(6, "0")}`;
};

TrustCaseSchema.statics.findOpen = function () {
  return this.find({
    status: { $in: ["OPEN", "INVESTIGATING", "ESCALATED"] },
  }).sort({ priority: -1, createdAt: 1 });
};

TrustCaseSchema.statics.findByAssignee = function (
  adminId: string | Types.ObjectId
) {
  return this.find({
    assigned_to: adminId,
    status: { $nin: ["RESOLVED", "CLOSED"] },
  }).sort({ priority: -1, createdAt: 1 });
};

TrustCaseSchema.statics.findByReportedUser = function (
  userId: string | Types.ObjectId
) {
  return this.find({ reported_user_id: userId }).sort({ createdAt: -1 });
};

// ----------------------------------------------------------
// Model
// ----------------------------------------------------------
export const TrustCase = mongoose.model<ITrustCase, ITrustCaseModel>(
  "TrustCase",
  TrustCaseSchema,
  "trust_cases"
);

export default TrustCase;
