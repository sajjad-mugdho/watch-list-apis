/**
 * Trust Case Service
 *
 * Business logic for Trust & Safety case management.
 * Handles creation, assignment, escalation, resolution, and user suspension.
 *
 * Status machine: OPEN → INVESTIGATING → ESCALATED → RESOLVED → CLOSED
 */

import mongoose, { Types } from "mongoose";
import {
  TrustCase,
  ITrustCase,
  TrustCaseStatus,
  TrustCasePriority,
  TrustCaseCategory,
} from "../../models/TrustCase";
import { User } from "../../models/User";
import { Order } from "../../models/Order";
// ReferenceCheck imported dynamically when needed
// import { ReferenceCheck } from "../../models/ReferenceCheck";
import { Vouch } from "../../models/Vouch";
import { Offer } from "../../models/Offer";
import { OfferRevision } from "../../models/OfferRevision";
import { EventOutbox, EventType } from "../../models/EventOutbox";
import { Notification } from "../../models/Notification";
import logger from "../../utils/logger";

// ============================================================
// Constants
// ============================================================
const SYSTEM_USER_ID = new Types.ObjectId("000000000000000000000000");

// ============================================================
// Types
// ============================================================

export interface CreateTrustCaseParams {
  reporterUserId?: string;
  reportedUserId: string;
  orderId?: string;
  referenceCheckId?: string;
  category: TrustCaseCategory;
  priority?: TrustCasePriority;
  reason: string;
}

export interface AddNoteParams {
  caseId: string;
  authorId: string;
  content: string;
}

export interface ResolveCaseParams {
  caseId: string;
  resolvedById: string;
  resolution: string;
}

export interface SuspendUserParams {
  caseId: string;
  userId: string;
  durationDays: number;
  reason: string;
  suspendedById: string;
}

export interface TrustCaseListOptions {
  status?: TrustCaseStatus;
  priority?: TrustCasePriority;
  category?: TrustCaseCategory;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

// ============================================================
// TrustCaseService Class
// ============================================================

export class TrustCaseService {
  /**
   * Create a new trust case with evidence snapshots.
   */
  async createCase(params: CreateTrustCaseParams): Promise<ITrustCase> {
    const {
      reporterUserId,
      reportedUserId,
      orderId,
      referenceCheckId,
      category,
      priority = "medium",
      reason,
    } = params;

    logger.info("[TrustCaseService] Creating trust case", {
      reportedUserId,
      category,
      priority,
    });

    // 1. Generate case number
    const caseNumber = await TrustCase.generateCaseNumber();

    // 2. Gather evidence snapshots
    const evidenceParams: {
      reporterUserId?: string;
      reportedUserId: string;
      orderId?: string;
      referenceCheckId?: string;
    } = { reportedUserId };
    if (reporterUserId) evidenceParams.reporterUserId = reporterUserId;
    if (orderId) evidenceParams.orderId = orderId;
    if (referenceCheckId) evidenceParams.referenceCheckId = referenceCheckId;
    const evidenceSnapshot = await this.gatherEvidence(evidenceParams);

    const isTest = process.env.NODE_ENV === "test";
    const session = isTest ? null : await mongoose.startSession();
    if (session) session.startTransaction();

    try {
      // 3. Create the case
      const trustCase = new TrustCase({
        case_number: caseNumber,
        reporter_user_id: reporterUserId
          ? new Types.ObjectId(reporterUserId)
          : undefined,
        reported_user_id: new Types.ObjectId(reportedUserId),
        order_id: orderId ? new Types.ObjectId(orderId) : undefined,
        reference_check_id: referenceCheckId
          ? new Types.ObjectId(referenceCheckId)
          : undefined,
        status: "OPEN",
        priority,
        category,
        evidence_snapshot: evidenceSnapshot,
        notes: [
          {
            author_id: reporterUserId
              ? new Types.ObjectId(reporterUserId)
              : SYSTEM_USER_ID,
            content: `Case created: ${reason}`,
            created_at: new Date(),
          },
        ],
      });
      await (session ? trustCase.save({ session }) : trustCase.save());

      // 4. Write outbox event
      const event = new EventOutbox({
        aggregate_type: "trust_case",
        aggregate_id: trustCase._id,
        event_type: "TRUST_CASE_CREATED" as EventType,
        payload: {
          caseId: trustCase._id.toString(),
          caseNumber,
          reportedUserId,
          reporterUserId,
          category,
          priority,
        },
        published: false,
      });
      await (session ? event.save({ session }) : event.save());

      if (session) await session.commitTransaction();

      logger.info("[TrustCaseService] Trust case created", {
        caseId: trustCase._id.toString(),
        caseNumber,
      });

      return trustCase;
    } catch (error) {
      if (session) await session.abortTransaction();
      throw error;
    } finally {
      if (session) session.endSession();
    }
  }

  /**
   * Assign a case to an admin.
   */
  async assignCase(
    caseId: string,
    assigneeId: string,
    assignedById: string
  ): Promise<ITrustCase> {
    const isTest = process.env.NODE_ENV === "test";
    const session = isTest ? null : await mongoose.startSession();
    if (session) session.startTransaction();

    try {
      const trustCase = await (session
        ? TrustCase.findById(caseId).session(session)
        : TrustCase.findById(caseId));
      if (!trustCase) throw new Error("Trust case not found");

      if (trustCase.status === "RESOLVED" || trustCase.status === "CLOSED") {
        throw new Error("Cannot assign a resolved or closed case");
      }

      const previousStatus = trustCase.status;
      trustCase.assigned_to = new Types.ObjectId(assigneeId);
      if (trustCase.status === "OPEN") {
        trustCase.status = "INVESTIGATING";
      }

      trustCase.notes.push({
        author_id: new Types.ObjectId(assignedById),
        content: `Case assigned to admin ${assigneeId}`,
        created_at: new Date(),
      });

      await (session ? trustCase.save({ session }) : trustCase.save());

      // Write outbox event
      const event = new EventOutbox({
        aggregate_type: "trust_case",
        aggregate_id: trustCase._id,
        event_type: "TRUST_CASE_ASSIGNED" as EventType,
        payload: {
          caseId: trustCase._id.toString(),
          caseNumber: trustCase.case_number,
          assigneeId,
          assignedById,
          previousStatus,
          newStatus: trustCase.status,
          timestamp: new Date(),
        },
        published: false,
      });
      await (session ? event.save({ session }) : event.save());

      if (session) await session.commitTransaction();

      logger.info("[TrustCaseService] Case assigned", {
        caseId,
        assigneeId,
      });

      return trustCase;
    } catch (error) {
      if (session) await session.abortTransaction();
      throw error;
    } finally {
      if (session) session.endSession();
    }
  }

  /**
   * Escalate a case.
   */
  async escalateCase(
    caseId: string,
    escalatedToId: string,
    escalatedById: string,
    reason: string
  ): Promise<ITrustCase> {
    const isTest = process.env.NODE_ENV === "test";
    const session = isTest ? null : await mongoose.startSession();
    if (session) session.startTransaction();

    try {
      const trustCase = await (session
        ? TrustCase.findById(caseId).session(session)
        : TrustCase.findById(caseId));
      if (!trustCase) throw new Error("Trust case not found");

      if (trustCase.status === "RESOLVED" || trustCase.status === "CLOSED") {
        throw new Error("Cannot escalate a resolved or closed case");
      }

      trustCase.status = "ESCALATED";
      trustCase.escalated_to = new Types.ObjectId(escalatedToId);
      trustCase.priority = "critical";

      trustCase.notes.push({
        author_id: new Types.ObjectId(escalatedById),
        content: `Case escalated: ${reason}`,
        created_at: new Date(),
      });

      await (session ? trustCase.save({ session }) : trustCase.save());

      // Write outbox
      const event = new EventOutbox({
        aggregate_type: "trust_case",
        aggregate_id: trustCase._id,
        event_type: "TRUST_CASE_ESCALATED" as EventType,
        payload: {
          caseId: trustCase._id.toString(),
          caseNumber: trustCase.case_number,
          escalatedTo: escalatedToId,
          reason,
        },
        published: false,
      });
      await (session ? event.save({ session }) : event.save());

      if (session) await session.commitTransaction();

      logger.info("[TrustCaseService] Case escalated", {
        caseId,
        escalatedToId,
      });

      return trustCase;
    } catch (error) {
      if (session) await session.abortTransaction();
      throw error;
    } finally {
      if (session) session.endSession();
    }
  }

  /**
   * Add a note to a case.
   */
  async addNote(params: AddNoteParams): Promise<ITrustCase> {
    const { caseId, authorId, content } = params;

    const trustCase = await TrustCase.findById(caseId);
    if (!trustCase) throw new Error("Trust case not found");

    trustCase.notes.push({
      author_id: new Types.ObjectId(authorId),
      content,
      created_at: new Date(),
    });

    await trustCase.save();

    logger.info("[TrustCaseService] Note added to case", {
      caseId,
      authorId,
    });

    return trustCase;
  }

  /**
   * Resolve a case.
   */
  async resolveCase(params: ResolveCaseParams): Promise<ITrustCase> {
    const { caseId, resolvedById, resolution } = params;

    const isTest = process.env.NODE_ENV === "test";
    const session = isTest ? null : await mongoose.startSession();
    if (session) session.startTransaction();

    try {
      const trustCase = await (session
        ? TrustCase.findById(caseId).session(session)
        : TrustCase.findById(caseId));
      if (!trustCase) throw new Error("Trust case not found");

      if (trustCase.status === "RESOLVED" || trustCase.status === "CLOSED") {
        throw new Error("Case is already resolved or closed");
      }

      trustCase.status = "RESOLVED";
      trustCase.resolution = resolution;
      trustCase.resolved_at = new Date();

      trustCase.notes.push({
        author_id: new Types.ObjectId(resolvedById),
        content: `Case resolved: ${resolution}`,
        created_at: new Date(),
      });

      await (session ? trustCase.save({ session }) : trustCase.save());

      // Write outbox
      const event = new EventOutbox({
        aggregate_type: "trust_case",
        aggregate_id: trustCase._id,
        event_type: "TRUST_CASE_RESOLVED" as EventType,
        payload: {
          caseId: trustCase._id.toString(),
          caseNumber: trustCase.case_number,
          resolution,
          resolvedBy: resolvedById,
        },
        published: false,
      });
      await (session ? event.save({ session }) : event.save());

      if (session) await session.commitTransaction();

      logger.info("[TrustCaseService] Case resolved", {
        caseId,
        resolution,
      });

      return trustCase;
    } catch (error) {
      if (session) await session.abortTransaction();
      throw error;
    } finally {
      if (session) session.endSession();
    }
  }

  /**
   * Close a case (after resolution).
   */
  async closeCase(caseId: string, closedById: string): Promise<ITrustCase> {
    const isTest = process.env.NODE_ENV === "test";
    const session = isTest ? null : await mongoose.startSession();
    if (session) session.startTransaction();

    try {
      const trustCase = await (session
        ? TrustCase.findById(caseId).session(session)
        : TrustCase.findById(caseId));
      if (!trustCase) throw new Error("Trust case not found");

      if (trustCase.status !== "RESOLVED") {
        throw new Error("Only resolved cases can be closed");
      }

      trustCase.status = "CLOSED";

      trustCase.notes.push({
        author_id: new Types.ObjectId(closedById),
        content: "Case closed",
        created_at: new Date(),
      });

      await (session ? trustCase.save({ session }) : trustCase.save());

      // Write outbox
      const event = new EventOutbox({
        aggregate_type: "trust_case",
        aggregate_id: trustCase._id,
        event_type: "TRUST_CASE_CLOSED" as EventType,
        payload: {
          caseId: trustCase._id.toString(),
          caseNumber: trustCase.case_number,
          closedBy: closedById,
        },
        published: false,
      });
      await (session ? event.save({ session }) : event.save());

      if (session) await session.commitTransaction();
      return trustCase;
    } catch (error) {
      if (session) await session.abortTransaction();
      throw error;
    } finally {
      if (session) session.endSession();
    }
  }

  /**
   * Suspend a user as part of a trust case.
   */
  async suspendUser(params: SuspendUserParams): Promise<ITrustCase> {
    const { caseId, userId, durationDays, reason, suspendedById } = params;

    const isTest = process.env.NODE_ENV === "test";
    const session = isTest ? null : await mongoose.startSession();
    if (session) session.startTransaction();

    try {
      const trustCase = await (session
        ? TrustCase.findById(caseId).session(session)
        : TrustCase.findById(caseId));
      if (!trustCase) throw new Error("Trust case not found");

      // Update user with suspension
      const user = await (session
        ? User.findById(userId).session(session)
        : User.findById(userId));
      if (!user) throw new Error("User not found");

      // Set suspension fields on user
      user.suspended_at = new Date();
      user.suspension_reason = reason;
      user.suspended_by = new Types.ObjectId(suspendedById);
      user.suspension_expires_at = new Date(
        Date.now() + durationDays * 24 * 60 * 60 * 1000
      );
      user.adminOverride = true; // Mark as admin action to skip user logic filters
      await (session ? user.save({ session }) : user.save());

      // Record on trust case
      trustCase.suspension_applied = {
        user_id: new Types.ObjectId(userId),
        duration_days: durationDays,
        reason,
        applied_at: new Date(),
      };

      trustCase.notes.push({
        author_id: new Types.ObjectId(suspendedById),
        content: `User ${userId} suspended for ${durationDays} days: ${reason}`,
        created_at: new Date(),
      });

      await (session ? trustCase.save({ session }) : trustCase.save());

      // Write outbox event for suspension
      const event = new EventOutbox({
        aggregate_type: "user",
        aggregate_id: user._id,
        event_type: "USER_SUSPENDED" as EventType,
        payload: {
          userId,
          suspendedById,
          caseId,
          reason,
          durationDays,
        },
        published: false,
      });
      await (session ? event.save({ session }) : event.save());

      if (session) await session.commitTransaction();

      // Notify suspended user (non-blocking)
      try {
        await Notification.create({
          user_id: new Types.ObjectId(userId),
          type: "account_suspended",
          title: "Account Suspended",
          body: `Your account has been suspended for ${durationDays} days. Reason: ${reason}`,
          data: { caseNumber: trustCase.case_number },
        });
      } catch (err) {
        logger.warn(
          "[TrustCaseService] Failed to send suspension notification",
          {
            userId,
            err,
          }
        );
      }

      logger.info("[TrustCaseService] User suspended", {
        caseId,
        userId,
        durationDays,
      });

      return trustCase;
    } catch (error) {
      if (session) await session.abortTransaction();
      throw error;
    } finally {
      if (session) session.endSession();
    }
  }

  /**
   * Get a case by ID.
   */
  async getCaseById(caseId: string): Promise<ITrustCase | null> {
    return TrustCase.findById(caseId)
      .populate("reported_user_id", "_id display_name avatar email")
      .populate("reporter_user_id", "_id display_name avatar email")
      .populate("assigned_to", "_id display_name avatar email");
  }

  /**
   * Get a case by case number.
   */
  async getCaseByCaseNumber(caseNumber: string): Promise<ITrustCase | null> {
    return TrustCase.findOne({ case_number: caseNumber })
      .populate("reported_user_id", "_id display_name avatar email")
      .populate("reporter_user_id", "_id display_name avatar email")
      .populate("assigned_to", "_id display_name avatar email");
  }

  /**
   * List cases with filters.
   */
  async listCases(options: TrustCaseListOptions = {}): Promise<{
    cases: ITrustCase[];
    total: number;
  }> {
    const {
      status,
      priority,
      category,
      assignedTo,
      limit = 20,
      offset = 0,
    } = options;

    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (assignedTo)
      filter.assigned_to = new Types.ObjectId(assignedTo);

    const [cases, total] = await Promise.all([
      TrustCase.aggregate([
        { $match: filter },
        {
          $addFields: {
            priority_order: {
              $indexOfArray: [
                ["critical", "high", "medium", "low"],
                "$priority",
              ],
            },
          },
        },
        { $sort: { priority_order: 1, createdAt: -1 } },
        { $skip: offset },
        { $limit: limit },
      ]).then((results) =>
        TrustCase.populate(results, [
          { path: "reported_user_id", select: "_id display_name avatar" },
          { path: "assigned_to", select: "_id display_name avatar" },
        ])
      ),
      TrustCase.countDocuments(filter),
    ]);

    return { cases, total };
  }

  /**
   * Get open cases.
   */
  async getOpenCases(): Promise<ITrustCase[]> {
    return TrustCase.findOpen();
  }

  /**
   * Get cases assigned to an admin.
   */
  async getCasesForAdmin(adminId: string): Promise<ITrustCase[]> {
    return TrustCase.findByAssignee(adminId);
  }

  /**
   * Get cases for a reported user.
   */
  async getCasesForUser(userId: string): Promise<ITrustCase[]> {
    return TrustCase.findByReportedUser(userId);
  }

  // ============================================================
  // Private: Evidence Gathering
  // ============================================================

  private async gatherEvidence(params: {
    reporterUserId?: string;
    reportedUserId: string;
    orderId?: string;
    referenceCheckId?: string;
  }): Promise<any> {
    const { reporterUserId, reportedUserId, orderId, referenceCheckId } =
      params;

    const evidence: any = {
      chat_history: [], // TODO: Implement automated message gathering from GetStream
      offer_history: [],
      vouches: [],
      order_snapshot: null,
      user_profiles: {},
      captured_at: new Date(),
    };

    // Gather user profiles
    try {
      const reportedUser = await User.findById(reportedUserId)
        .select("_id display_name avatar email createdAt stats")
        .lean();
      evidence.user_profiles.reported = reportedUser;

      if (reporterUserId) {
        const reporterUser = await User.findById(reporterUserId)
          .select("_id display_name avatar email createdAt stats")
          .lean();
        evidence.user_profiles.reporter = reporterUser;
      }
    } catch (err) {
      logger.warn("[TrustCaseService] Failed to gather user profiles", { err });
    }

    // Gather order snapshot
    if (orderId) {
      try {
        const order = await Order.findById(orderId).lean();
        evidence.order_snapshot = order;
      } catch (err) {
        logger.warn("[TrustCaseService] Failed to gather order snapshot", {
          err,
        });
      }
    }

    // Gather offer history for the reported user (Batch query to avoid N+1)
    try {
      const offers = await Offer.find({
        $or: [
          { buyer_id: new Types.ObjectId(reportedUserId) },
          { seller_id: new Types.ObjectId(reportedUserId) },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      // Batch fetch revisions
      const offerIds = offers.map((o) => o._id);
      const allRevisions = await OfferRevision.find({
        offer_id: { $in: offerIds },
      })
        .sort({ revision_number: 1 })
        .lean();

      const revisionsByOffer = new Map<string, any[]>();
      for (const r of allRevisions) {
        const key = r.offer_id.toString();
        if (!revisionsByOffer.has(key)) revisionsByOffer.set(key, []);
        revisionsByOffer.get(key)!.push(r);
      }

      for (const offer of offers) {
        evidence.offer_history.push({
          offer,
          revisions: revisionsByOffer.get(offer._id.toString()) ?? [],
        });
      }
    } catch (err) {
      logger.warn("[TrustCaseService] Failed to gather offer history", { err });
    }

    // Gather vouches
    if (referenceCheckId) {
      try {
        const vouches = await Vouch.findByReferenceCheck(referenceCheckId);
        evidence.vouches = vouches.map((v) => v.toJSON());
      } catch (err) {
        logger.warn("[TrustCaseService] Failed to gather vouches", { err });
      }
    }

    return evidence;
  }
}

// Singleton
export const trustCaseService = new TrustCaseService();
