/**
 * Audit Service
 *
 * Centralized audit logging for offer, vouch, and reference check events.
 * Provides type-safe helper methods for creating audit trail entries.
 */

import mongoose, { Types } from "mongoose";
import { AuditLog, ActorRole, IAuditLog } from "../models/AuditLog";
import logger from "../utils/logger";

// ============================================================
// Types
// ============================================================

export interface AuditLogOfferParams {
  action:
    | "OFFER_CREATED"
    | "OFFER_COUNTERED"
    | "OFFER_ACCEPTED"
    | "OFFER_DECLINED"
    | "OFFER_EXPIRED";
  actorId: string;
  actorRole: ActorRole;
  offerId: string;
  listingId?: string;
  amount?: number;
  currency?: string;
  previousState?: string;
  newState?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogVouchParams {
  action: "VOUCH_CREATED" | "VOUCH_WEIGHT_CALCULATED";
  actorId: string;
  actorRole: ActorRole;
  vouchId: string;
  referenceCheckId: string;
  vouchForUserId?: string | undefined;
  weight?: number | undefined;
  metadata?: Record<string, any> | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface AuditLogReferenceCheckParams {
  action:
    | "REFERENCE_CHECK_CREATED"
    | "REFERENCE_CHECK_COMPLETED"
    | "REFERENCE_CHECK_RESPONSE_ADDED";
  actorId: string;
  actorRole: ActorRole;
  referenceCheckId: string;
  targetId?: string;
  previousState?: string;
  newState?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================
// Audit Service Class
// ============================================================

export class AuditService {
  /**
   * Log an offer-related event
   */
  async logOfferEvent(params: AuditLogOfferParams): Promise<IAuditLog | null> {
    try {
      const auditLog = new AuditLog({
        action: params.action,
        actor_id: this.toObjectId(params.actorId),
        actor_role: params.actorRole,
        offer_id: this.toObjectId(params.offerId),
        listing_id: params.listingId ? this.toObjectId(params.listingId) : null,
        amount: params.amount,
        currency: params.currency || "USD",
        previous_state: params.previousState,
        new_state: params.newState,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        metadata: {
          ...params.metadata,
          event_category: "offer",
        },
      });

      const saved = await auditLog.save();

      logger.info("[AuditService] Offer event logged", {
        action: params.action,
        offerId: params.offerId,
        actorId: params.actorId,
        auditLogId: saved._id.toString(),
      });

      return saved;
    } catch (error) {
      logger.error("[AuditService] Failed to log offer event", {
        action: params.action,
        offerId: params.offerId,
        error,
      });
      return null;
    }
  }

  /**
   * Log a vouch-related event
   */
  async logVouchEvent(params: AuditLogVouchParams): Promise<IAuditLog | null> {
    try {
      const auditLog = new AuditLog({
        action: params.action,
        actor_id: this.toObjectId(params.actorId),
        actor_role: params.actorRole,
        vouch_id: this.toObjectId(params.vouchId),
        reference_check_id: this.toObjectId(params.referenceCheckId),
        metadata: {
          vouch_for_user_id: params.vouchForUserId,
          weight: params.weight,
          event_category: "vouch",
          ...params.metadata,
        },
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      });

      const saved = await auditLog.save();

      logger.info("[AuditService] Vouch event logged", {
        action: params.action,
        vouchId: params.vouchId,
        actorId: params.actorId,
        auditLogId: saved._id.toString(),
      });

      return saved;
    } catch (error) {
      logger.error("[AuditService] Failed to log vouch event", {
        action: params.action,
        vouchId: params.vouchId,
        error,
      });
      return null;
    }
  }

  /**
   * Log a reference check-related event
   */
  async logReferenceCheckEvent(
    params: AuditLogReferenceCheckParams
  ): Promise<IAuditLog | null> {
    try {
      const auditLog = new AuditLog({
        action: params.action,
        actor_id: this.toObjectId(params.actorId),
        actor_role: params.actorRole,
        reference_check_id: this.toObjectId(params.referenceCheckId),
        previous_state: params.previousState,
        new_state: params.newState,
        metadata: {
          target_id: params.targetId,
          event_category: "reference_check",
          ...params.metadata,
        },
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      });

      const saved = await auditLog.save();

      logger.info("[AuditService] Reference check event logged", {
        action: params.action,
        referenceCheckId: params.referenceCheckId,
        actorId: params.actorId,
        auditLogId: saved._id.toString(),
      });

      return saved;
    } catch (error) {
      logger.error("[AuditService] Failed to log reference check event", {
        action: params.action,
        referenceCheckId: params.referenceCheckId,
        error,
      });
      return null;
    }
  }

  /**
   * Get audit logs for a specific offer
   */
  async getOfferAuditLogs(offerId: string): Promise<IAuditLog[]> {
    const docs = await AuditLog.find({
      offer_id: this.toObjectId(offerId),
    })
      .sort({ createdAt: -1 })
      .lean();
    return docs as unknown as IAuditLog[];
  }

  /**
   * Get audit logs for a specific reference check
   */
  async getReferenceCheckAuditLogs(referenceCheckId: string): Promise<IAuditLog[]> {
    const docs = await AuditLog.find({
      reference_check_id: this.toObjectId(referenceCheckId),
    })
      .sort({ createdAt: -1 })
      .lean();
    return docs as unknown as IAuditLog[];
  }

  /**
   * Get all audit logs by user
   */
  async getAuditLogsByUser(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<IAuditLog[]> {
    const { limit = 50, offset = 0 } = options;

    const docs = await AuditLog.find({
      actor_id: this.toObjectId(userId),
    })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    return docs as unknown as IAuditLog[];
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private toObjectId(id: string): Types.ObjectId | null {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return new Types.ObjectId(id);
  }
}

// Singleton instance
export const auditService = new AuditService();
