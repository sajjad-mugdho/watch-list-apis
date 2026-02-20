/**
 * Vouch Service
 *
 * Business logic for vouch management in reference checks.
 *
 * Key Rules:
 * - Only connected users can vouch (friend, mutual, follow)
 * - One vouch per user per reference check
 * - Cannot vouch for yourself
 * - Vouches are immutable once created
 * - Weight calculated based on voucher reputation
 */

import mongoose, { Types } from "mongoose";
import { Vouch, IVouch, ConnectionType } from "../../models/Vouch";
import { ReferenceCheck } from "../../models/ReferenceCheck";
import { Friendship } from "../../models/Friendship";
import { User } from "../../models/User";
import { Follow } from "../../models/Follow";
import { EventOutbox } from "../../models/EventOutbox";
import logger from "../../utils/logger";

// Rate limit: max vouches per hour
const MAX_VOUCHES_PER_HOUR = 5;

// --------------------------------------------------------
// Interfaces
// --------------------------------------------------------
export interface CreateVouchParams {
  referenceCheckId: string;
  vouchForUserId: string; // buyer or seller in the reference check
  voucherId: string;
  comment?: string;
}

export interface VouchEligibility {
  eligible: boolean;
  reason?: string;
}

export interface VouchDTO {
  id: string;
  referenceCheckId: string;
  vouchedForUserId: string;
  vouchedByUserId: string;
  comment?: string;
  weight: number;
  voucherSnapshot: {
    displayName: string;
    avatar?: string;
    connectionType: ConnectionType;
  };
  createdAt: Date;
}

// --------------------------------------------------------
// VouchService
// --------------------------------------------------------
export class VouchService {
  /**
   * Check if a user is eligible to vouch
   */
  async checkEligibility(
    referenceCheckId: string,
    vouchForUserId: string,
    voucherId: string
  ): Promise<VouchEligibility> {
    // 1. Get reference check
    const refCheck = await ReferenceCheck.findById(referenceCheckId);
    if (!refCheck) {
      return { eligible: false, reason: "Reference check not found" };
    }

    // 2. Check reference check is pending
    if ((refCheck as any).status !== "pending") {
      return { eligible: false, reason: "Reference check is not pending" };
    }

    // 3. Verify vouchForUserId is a party in the reference check
    const requesterId = (refCheck as any).requester_id?.toString();
    const targetId = (refCheck as any).target_id?.toString();
    if (vouchForUserId !== requesterId && vouchForUserId !== targetId) {
      return { eligible: false, reason: "Can only vouch for parties in this check" };
    }

    // 4. Cannot vouch for self
    if (voucherId === vouchForUserId) {
      return { eligible: false, reason: "Cannot vouch for yourself" };
    }

    // 5. Cannot be a party in the reference check
    if (voucherId === requesterId || voucherId === targetId) {
      return { eligible: false, reason: "Cannot vouch as a party in this check" };
    }

    // 6. Check connection exists
    const connection = await this.getConnection(voucherId, vouchForUserId);
    if (!connection) {
      return { eligible: false, reason: "Must be connected to vouch" };
    }

    // 7. Check not already vouched
    const existingVouch = await Vouch.findOne({
      reference_check_id: new Types.ObjectId(referenceCheckId),
      vouched_by_user_id: new Types.ObjectId(voucherId),
    });
    if (existingVouch) {
      return { eligible: false, reason: "Already vouched in this check" };
    }

    // 8. Rate limit check
    const hourAgo = new Date();
    hourAgo.setHours(hourAgo.getHours() - 1);

    const recentVouchCount = await Vouch.countDocuments({
      vouched_by_user_id: new Types.ObjectId(voucherId),
      createdAt: { $gte: hourAgo },
    });

    if (recentVouchCount >= MAX_VOUCHES_PER_HOUR) {
      return { eligible: false, reason: "Rate limit exceeded. Try again later." };
    }

    return { eligible: true };
  }

  /**
   * Create a vouch
   */
  async createVouch(params: CreateVouchParams): Promise<VouchDTO> {
    const { referenceCheckId, vouchForUserId, voucherId, comment } = params;

    logger.info("[VouchService] Creating vouch", {
      referenceCheckId,
      vouchForUserId,
      voucherId,
    });

    // 1. Check eligibility (Read-only checks)
    const eligibility = await this.checkEligibility(
      referenceCheckId,
      vouchForUserId,
      voucherId
    );

    if (!eligibility.eligible) {
      throw new Error(eligibility.reason || "Not eligible to vouch");
    }

    // 2. Get voucher info
    const voucher = await User.findById(voucherId);
    if (!voucher) throw new Error("Voucher not found");

    // 3. Get connection type
    const connection = await this.getConnection(voucherId, vouchForUserId);
    if (!connection) throw new Error("Connection not found");

    // 4. Calculate weight
    const weight = await this.calculateWeight(voucher, connection);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 5. Create vouch
      const vouch = new Vouch({
        reference_check_id: new Types.ObjectId(referenceCheckId),
        vouched_for_user_id: new Types.ObjectId(vouchForUserId),
        vouched_by_user_id: new Types.ObjectId(voucherId),
        comment: comment || undefined,
        weight,
        voucher_snapshot: {
          display_name: (voucher as any).display_name || (voucher as any).username || "User",
          avatar: (voucher as any).avatar,
          connection_type: connection.type,
          reputation_score: (voucher as any).reputation_score,
        },
      });
      await vouch.save({ session });

      // 6. Write to outbox
      const event = new EventOutbox({
        aggregate_type: "vouch",
        aggregate_id: vouch._id,
        event_type: "VOUCH_ADDED",
        payload: {
          vouchId: vouch._id.toString(),
          referenceCheckId,
          vouchForUserId,
          voucherId,
          weight,
          voucherName: (voucher as any).display_name || (voucher as any).username,
        },
        published: false,
      });
      await event.save({ session });

      await session.commitTransaction();

      logger.info("[VouchService] Vouch created", {
        vouchId: vouch._id.toString(),
        weight,
      });

      return this.toDTO(vouch);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get vouches for a reference check
   */
  async getVouchesForReferenceCheck(referenceCheckId: string): Promise<VouchDTO[]> {
    const vouches = await Vouch.findByReferenceCheck(referenceCheckId);
    return vouches.map((v) => this.toDTO(v));
  }

  /**
   * Get total vouch weight for a reference check
   */
  async getTotalWeight(referenceCheckId: string): Promise<number> {
    return Vouch.getTotalWeightForReferenceCheck(referenceCheckId);
  }

  /**
   * Get vouch count for a reference check
   */
  async getVouchCount(referenceCheckId: string): Promise<number> {
    return Vouch.countForReferenceCheck(referenceCheckId);
  }

  /**
   * Get vouches given by a user
   */
  async getVouchesGivenBy(userId: string): Promise<VouchDTO[]> {
    const vouches = await Vouch.findByVoucher(userId);
    return vouches.map((v) => this.toDTO(v));
  }

  /**
   * Get vouches received by a user
   */
  async getVouchesReceivedBy(userId: string): Promise<VouchDTO[]> {
    const vouches = await Vouch.findByVouchedForUser(userId);
    return vouches.map((v) => this.toDTO(v));
  }

  // --------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------

  private async getConnection(
    userId: string,
    otherUserId: string
  ): Promise<{ type: ConnectionType } | null> {
    // Check for friendship
    const friendship = await Friendship.findOne({
      $or: [
        { requester_id: new Types.ObjectId(userId), addressee_id: new Types.ObjectId(otherUserId) },
        { requester_id: new Types.ObjectId(otherUserId), addressee_id: new Types.ObjectId(userId) },
      ],
      status: "accepted",
    });

    if (friendship) {
      // In this model, status: accepted means it's already a mutual friendship
      // but we'll return "mutual" for consistency with the service's intention
      return { type: "mutual" };
    }

    // Check for follow
    // If voucher follows the user they are vouching for, that counts as a connection
    const isFollowing = await Follow.isFollowing(userId, otherUserId);
    if (isFollowing) {
        return { type: "follow" };
    }

    return null;
  }

  private async calculateWeight(
    voucher: any,
    connection: { type: ConnectionType }
  ): Promise<number> {
    let weight = 1.0;

    // Connection type weight
    if (connection.type === "friend" || connection.type === "mutual") {
      weight *= 2.0;
    } else if (connection.type === "follow") {
      weight *= 1.0;
    }

    // Account age bonus
    const createdAt = voucher.createdAt || new Date();
    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceCreation > 365) {
      weight *= 1.5;
    } else if (daysSinceCreation > 90) {
      weight *= 1.2;
    }

    // Verified account bonus
    if (voucher.onboarding_status === "completed") {
      weight *= 1.3;
    }

    // Past transaction bonus
    const completedOrders = voucher.stats?.orders_completed || 0;
    if (completedOrders > 10) {
      weight *= 1.5;
    } else if (completedOrders > 5) {
      weight *= 1.2;
    }

    // Round to 2 decimal places
    return Math.round(weight * 100) / 100;
  }

  private toDTO(vouch: IVouch): VouchDTO {
    const dto: VouchDTO = {
      id: vouch._id.toString(),
      referenceCheckId: vouch.reference_check_id.toString(),
      vouchedForUserId: vouch.vouched_for_user_id.toString(),
      vouchedByUserId: vouch.vouched_by_user_id.toString(),
      weight: vouch.weight,
      voucherSnapshot: {
        displayName: vouch.voucher_snapshot.display_name,
        connectionType: vouch.voucher_snapshot.connection_type,
      },
      createdAt: vouch.createdAt,
    };
    if (vouch.comment !== undefined) {
      dto.comment = vouch.comment;
    }
    if (vouch.voucher_snapshot.avatar !== undefined) {
      dto.voucherSnapshot.avatar = vouch.voucher_snapshot.avatar;
    }
    return dto;
  }
}

// Singleton instance
export const vouchService = new VouchService();
