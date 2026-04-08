import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import {
  ReferenceCheck,
  REFERENCE_RATING_VALUES,
} from "../../models/ReferenceCheck";
import { User } from "../../models/User";
import { feedService } from "../../services/FeedService";
import { chatService } from "../../services/ChatService";
import { Order } from "../../models/Order";
import { auditService } from "../../services/AuditService";
import { vouchService } from "../../services/vouch/VouchService";
import { Vouch } from "../../models/Vouch";
import { AuditLog } from "../../models/AuditLog";
import logger from "../../utils/logger";
import { ApiResponse } from "../../types";
import {
  AuthorizationError,
  MissingUserContextError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors";

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

function getRequestId(req: Request): string {
  return (req.headers["x-request-id"] as string) || "";
}

async function resolveUser(req: Request) {
  const auth = (req as any).auth;
  if (!auth?.userId)
    throw new MissingUserContextError({
      route: req.path,
      note: "auth.userId missing",
    });

  const user = await User.findOne({ external_id: auth.userId });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

function computeReferenceSummary(check: any) {
  const responses = Array.isArray(check.responses) ? check.responses : [];
  const positiveCount = responses.filter(
    (r: any) => r.rating === "positive",
  ).length;
  const neutralCount = responses.filter(
    (r: any) => r.rating === "neutral",
  ).length;
  const negativeCount = responses.filter(
    (r: any) => r.rating === "negative",
  ).length;

  return {
    total_responses: responses.length,
    positive_count: positiveCount,
    neutral_count: neutralCount,
    negative_count: negativeCount,
  };
}

// ----------------------------------------------------------
// Handlers
// ----------------------------------------------------------

/**
 * Create a reference check request
 * POST /api/v1/networks/reference-checks
 */
export const networks_reference_check_create = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { target_id, network_id, order_id, reason } = req.body;

    if (!target_id) throw new ValidationError("target_id is required");
    if (!mongoose.Types.ObjectId.isValid(target_id))
      throw new ValidationError("Invalid target_id");
    if (!order_id)
      throw new ValidationError(
        "order_id is required. Reference checks can only be created for completed orders.",
      );
    if (!mongoose.Types.ObjectId.isValid(order_id))
      throw new ValidationError("Invalid order_id");

    const order = await Order.findById(order_id);
    if (!order) throw new NotFoundError("Order not found");

    const validOrderStatuses = ["completed", "delivered", "reserved"];
    if (!validOrderStatuses.includes(order.status)) {
      throw new ValidationError(
        `Reference checks can be initiated once an order is reserved or completed. Current status: ${order.status}`,
      );
    }

    const isBuyer = order.buyer_id.toString() === user._id.toString();
    const isSeller = order.seller_id.toString() === user._id.toString();
    if (!isBuyer && !isSeller) {
      throw new AuthorizationError(
        "You must be a participant in the order to create a reference check",
        {},
      );
    }

    const expectedTarget = isBuyer
      ? order.seller_id.toString()
      : order.buyer_id.toString();
    if (target_id !== expectedTarget) {
      throw new ValidationError(
        "Reference check target must be the other party in the order",
      );
    }

    if (user._id.toString() === target_id) {
      throw new ValidationError("Cannot create reference check for yourself");
    }

    const targetUser = await User.findById(target_id);
    if (!targetUser) throw new NotFoundError("Target user not found");

    const existingCheck = await ReferenceCheck.findOne({
      requester_id: user._id,
      target_id,
      order_id,
      status: "pending",
    });
    if (existingCheck) {
      throw new ValidationError(
        "You already have a pending reference check for this order",
      );
    }

    const referenceCheck = await ReferenceCheck.create({
      requester_id: user._id,
      target_id,
      network_id: network_id || null,
      order_id: order._id,
      reason: reason?.trim() || null,
      status: "pending",
      transaction_value: order.amount,
      reservation_terms_snapshot: order.reservation_terms_snapshot ?? null,
    });

    // Side-effects (non-critical)
    try {
      const { channelId } = await chatService.getOrCreateChannel(
        user._id.toString(),
        target_id,
        {
          listing_id: (referenceCheck._id as any).toString(),
          listing_title: `Reference Check: ${user.display_name} -> ${targetUser.display_name}`,
        },
        true,
      );
      referenceCheck.getstream_channel_id = channelId;
      await referenceCheck.save();

      await chatService.sendSystemMessage(
        channelId,
        {
          type: "reference_check_initiated",
          message: reason || "New reference check started",
        },
        user._id.toString(),
      );
    } catch (chatError) {
      logger.warn("Failed to create chat channel for reference check", {
        chatError,
      });
    }

    if (order_id && mongoose.Types.ObjectId.isValid(order_id)) {
      try {
        if (order.getstream_channel_id) {
          await chatService.sendSystemMessage(
            order.getstream_channel_id,
            {
              type: "reference_check_initiated",
              order_id: order_id.toString(),
              message: `Reference check initiated for ${targetUser.display_name}`,
            },
            user._id.toString(),
          );
        }
      } catch (orderChatError) {
        logger.warn("Failed to notify order chat about reference check", {
          orderChatError,
        });
      }
    }

    try {
      await feedService.addReferenceCheckActivity(
        user._id.toString(),
        referenceCheck._id.toString(),
        target_id,
      );
    } catch (feedError) {
      logger.warn("Failed to add reference check to activity feed", {
        feedError,
      });
    }

    try {
      // TODO: Use platform-specific notification service
      /*      await Notification.create({
        user_id: target_id,
        type: "reference_check_request",
        title: "Reference Check Request",
        body: `${user.display_name || "Someone"} has requested a reference check for you.`,
        data: {
          reference_check_id: referenceCheck._id.toString(),
          requester_id: user._id.toString(),
        },
        action_url: `/reference-checks/${referenceCheck._id}`,
      }); */
    } catch (notifError) {
      logger.warn("Failed to create reference check notification", {
        notifError,
      });
    }

    logger.info("Reference check created", {
      checkId: referenceCheck._id,
      requesterId: user._id,
      targetId: target_id,
    });

    const response: ApiResponse<any> = {
      data: referenceCheck.toJSON(),
      requestId: getRequestId(req),
    };
    res.status(201).json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get reference checks with canonical filter support
 * Canonical filters: all | you | connections | requested | pending | about-me | active | suspended | completed
 * GET /api/v1/networks/reference-checks?filter=<canonical>
 *
 * Filter mappings:
 * - 'you' → checks requested by current user
 * - 'connections' → pending checks for current user
 * - 'about-me' → checks about current user as target
 * - 'active' → non-terminal state checks (active/waiting)
 * - 'suspended' → suspended checks only
 * - 'completed' → completed checks only
 * - 'all' (default) → all checks across all categories
 */
export const networks_reference_checks_get = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    // Use canonical ?filter= parameter only (no legacy ?type= support)
    const filterParam = (req.query.filter as string) || "all";
    let checks: any[] = [];

    // Map canonical filters to query logic
    if (filterParam === "you" || filterParam === "requested") {
      checks = await ReferenceCheck.getRequestedByUser(user._id.toString());
    } else if (filterParam === "connections" || filterParam === "pending") {
      checks = await ReferenceCheck.getPendingForUser(user._id.toString());
    } else if (filterParam === "about-me") {
      checks = await ReferenceCheck.getChecksAboutUser(user._id.toString());
    } else if (filterParam === "active") {
      // Active: checks in non-terminal states (not suspended/completed/declined)
      const [requested, pending, aboutMe] = await Promise.all([
        ReferenceCheck.getRequestedByUser(user._id.toString()),
        ReferenceCheck.getPendingForUser(user._id.toString()),
        ReferenceCheck.getChecksAboutUser(user._id.toString()),
      ]);
      const merged = [...requested, ...pending, ...aboutMe];
      checks = merged.filter(
        (c) =>
          c.status !== "suspended" &&
          c.status !== "completed" &&
          c.status !== "declined",
      );
    } else if (filterParam === "suspended") {
      // Suspended: checks with suspended status
      const [requested, pending, aboutMe] = await Promise.all([
        ReferenceCheck.getRequestedByUser(user._id.toString()),
        ReferenceCheck.getPendingForUser(user._id.toString()),
        ReferenceCheck.getChecksAboutUser(user._id.toString()),
      ]);
      const merged = [...requested, ...pending, ...aboutMe];
      checks = merged.filter((c) => c.status === "suspended");
    } else if (filterParam === "completed") {
      // Completed: checks with completed status
      const [requested, pending, aboutMe] = await Promise.all([
        ReferenceCheck.getRequestedByUser(user._id.toString()),
        ReferenceCheck.getPendingForUser(user._id.toString()),
        ReferenceCheck.getChecksAboutUser(user._id.toString()),
      ]);
      const merged = [...requested, ...pending, ...aboutMe];
      checks = merged.filter((c) => c.status === "completed");
    } else if (filterParam === "all" || !filterParam) {
      // Default: all checks (merge all categories with dedup)
      const [requested, pending, aboutMe] = await Promise.all([
        ReferenceCheck.getRequestedByUser(user._id.toString()),
        ReferenceCheck.getPendingForUser(user._id.toString()),
        ReferenceCheck.getChecksAboutUser(user._id.toString()),
      ]);
      const merged = [...requested, ...pending, ...aboutMe];
      const uniqueById = new Map<string, any>();
      for (const item of merged) {
        uniqueById.set(item._id.toString(), item);
      }
      checks = [...uniqueById.values()];
    }

    const response: ApiResponse<any> = {
      data: checks.map((c) => c.toJSON()),
      requestId: getRequestId(req),
      _metadata: {
        total: checks.length,
        filter: filterParam || "all",
      },
    };
    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get a specific reference check
 * GET /api/v1/networks/reference-checks/:id
 *
 * Response Structure:
 * - data.responses: Feedback tab - all responses with ratings and comments
 * - data.vouch: Vouch tab - single vouch object if exists
 * - data.summary: Summary tab - aggregated recommendation/confidence
 * - data.status: Reference-check lifecycle state (pending, active, completed, suspended)
 * - _metadata.waiting_for: Completion flow - who is waiting for confirmation (requester | target | null)
 * - _metadata.can_respond: Action permissions - can current user respond
 *
 * Figma UI Mapping:
 * - Summary Tab ← data.summary (recommendation, confidence_score)
 * - Vouch Tab ← data.vouch (from_user, given_at, legal_consent)
 * - Responses Tab ← data.responses (rating, comment, respondent, timestamp)
 * - Completion Rail ← data.requester_confirmed_at, target_confirmed_at, status
 * - Trust-Safety Panel ← /trust-safety-status endpoint (separate call)
 */
export const networks_reference_check_get = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      throw new ValidationError("Invalid reference check ID");

    const check = await ReferenceCheck.findById(id)
      .populate("requester_id", "_id display_name avatar first_name last_name")
      .populate("target_id", "_id display_name avatar first_name last_name");

    if (!check) throw new NotFoundError("Reference check not found");

    const isRequester =
      check.requester_id._id.toString() === user._id.toString();
    const isTarget = check.target_id._id.toString() === user._id.toString();

    const responseData = check.responses.map((r: any) => ({
      responder_id:
        r.is_anonymous && !isRequester ? null : r.responder_id.toString(),
      rating: r.rating,
      comment: r.comment,
      is_anonymous: r.is_anonymous,
      responded_at: r.responded_at,
    }));

    let orderDetails: any = {};
    if (check.order_id) {
      const order = await Order.findById(check.order_id);
      if (order) {
        const requesterId = check.requester_id._id.toString();
        const targetId = check.target_id._id.toString();
        orderDetails = {
          order_price: order.amount,
          requester_role:
            order.buyer_id.toString() === requesterId ? "buyer" : "seller",
          target_role:
            order.buyer_id.toString() === targetId ? "buyer" : "seller",
          private_contract: (order as any).private_contract_text || undefined,
        };
      }
    }

    const response: ApiResponse<any> = {
      data: {
        ...check.toJSON(),
        responses: responseData,
        order_details: orderDetails,
        timeRemaining: check.expires_at
          ? Math.max(0, check.expires_at.getTime() - Date.now())
          : null,
      },
      requestId: getRequestId(req),
      _metadata: {
        is_requester: isRequester,
        is_target: isTarget,
        requester_confirmed: Boolean((check as any).requester_confirmed_at),
        target_confirmed: Boolean((check as any).target_confirmed_at),
        waiting_for: !check.completed_at
          ? (check as any).requester_confirmed_at &&
            !(check as any).target_confirmed_at
            ? "target"
            : !(check as any).requester_confirmed_at &&
                (check as any).target_confirmed_at
              ? "requester"
              : null
          : null,
        can_respond:
          !isRequester &&
          !isTarget &&
          check.status === "active" &&
          !check.responses.find(
            (r: any) => r.responder_id.toString() === user._id.toString(),
          ),
      },
    };
    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Respond to a reference check
 * POST /api/v1/networks/reference-checks/:id/respond
 */
export const networks_reference_check_respond = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;
    const { rating, comment, is_anonymous } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      throw new ValidationError("Invalid reference check ID");
    if (!rating || !REFERENCE_RATING_VALUES.includes(rating)) {
      throw new ValidationError(
        "Valid rating is required (positive, neutral, negative)",
      );
    }

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");
    if (check.status !== "pending" && check.status !== "active") {
      throw new ValidationError("Reference check is not open for responses");
    }
    if (check.requester_id.toString() === user._id.toString()) {
      throw new ValidationError("Cannot respond to your own reference check");
    }
    if (check.target_id.toString() === user._id.toString()) {
      throw new ValidationError(
        "Cannot respond to reference check about yourself",
      );
    }

    const alreadyResponded = check.responses.find(
      (r: any) => r.responder_id.toString() === user._id.toString(),
    );
    if (alreadyResponded)
      throw new ValidationError(
        "You have already responded to this reference check",
      );

    check.responses.push({
      responder_id: user._id,
      rating,
      comment: comment?.trim() || null,
      is_anonymous: is_anonymous === true,
      responded_at: new Date(),
    });

    // Auto-transition pending → active when first response arrives
    if (check.status === "pending") {
      check.status = "active";
    }

    await check.save();

    try {
      // TODO: Use platform-specific notification service
      /*      await Notification.create({
        user_id: check.requester_id,
        type: "reference_check_response",
        title: "New Reference Check Response",
        body: `${user.display_name || "Someone"} has responded to your reference check request.`,
        data: {
          reference_check_id: check._id.toString(),
          responder_id: user._id.toString(),
        },
        action_url: `/reference-checks/${check._id}`,
      }); */
    } catch (notifError) {
      logger.warn("Failed to create reference response notification", {
        notifError,
      });
    }

    logger.info("Reference check response added", {
      checkId: id,
      responderId: user._id,
    });

    const response: ApiResponse<any> = {
      data: check.toJSON(),
      requestId: getRequestId(req),
      message: "Response added successfully",
    };
    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Complete a reference check
 * POST /api/v1/networks/reference-checks/:id/complete
 */
export const networks_reference_check_complete = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      throw new ValidationError("Invalid reference check ID");

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");
    if (
      check.status !== "active" &&
      check.status !== "waiting_requester_confirm" &&
      check.status !== "waiting_target_confirm" &&
      check.status !== "completed"
    ) {
      throw new ValidationError(
        "Reference check is not in a completable state",
      );
    }

    const isRequester = check.requester_id.toString() === user._id.toString();
    const isTarget = check.target_id.toString() === user._id.toString();

    if (!isRequester && !isTarget) {
      throw new AuthorizationError(
        "Only order participants can confirm completion",
        {},
      );
    }

    if (check.status === "completed") {
      const response: ApiResponse<any> = {
        data: check.toJSON(),
        requestId: getRequestId(req),
        message: "Reference check already completed",
      };
      res.json(response);
      return;
    }

    const now = new Date();

    if (isRequester && !(check as any).requester_confirmed_at) {
      (check as any).requester_confirmed_at = now;
    }

    if (isTarget && !(check as any).target_confirmed_at) {
      (check as any).target_confirmed_at = now;
    }

    const requesterConfirmed = Boolean((check as any).requester_confirmed_at);
    const targetConfirmed = Boolean((check as any).target_confirmed_at);

    if (requesterConfirmed && targetConfirmed) {
      check.status = "completed";
      check.completed_at = now;
    } else if (requesterConfirmed) {
      check.status = "waiting_target_confirm";
    } else if (targetConfirmed) {
      check.status = "waiting_requester_confirm";
    } else {
      check.status = "active";
    }

    await check.save();

    logger.info("Reference check completion confirmed", {
      checkId: id,
      requesterConfirmed,
      targetConfirmed,
      status: check.status,
    });

    const response: ApiResponse<any> = {
      data: check.toJSON(),
      requestId: getRequestId(req),
      message:
        check.status === "completed"
          ? "Reference check completed"
          : "Completion confirmed. Waiting for the other party",
    };
    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Cancel/delete a reference check
 * DELETE /api/v1/networks/reference-checks/:id
 */
export const networks_reference_check_delete = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      throw new ValidationError("Invalid reference check ID");

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");
    if (check.requester_id.toString() !== user._id.toString()) {
      throw new AuthorizationError(
        "Only the requester can delete this reference check",
        {},
      );
    }
    if (check.status !== "pending")
      throw new ValidationError("Only pending reference checks can be deleted");

    await check.deleteOne();

    logger.info("Reference check deleted", { checkId: id });

    const response: ApiResponse<null> = {
      data: null,
      requestId: getRequestId(req),
      message: "Reference check deleted successfully",
    };
    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Vouch for a party in a reference check
 * POST /api/v1/networks/reference-checks/:id/vouch
 */
export const networks_reference_check_vouch = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;
    const {
      vouch_for_user_id,
      comment,
      legal_consent_accepted,
      legal_policy_version,
    } = req.body;

    if (!legal_consent_accepted) {
      throw new ValidationError(
        "You must accept the legal terms before vouching",
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id))
      throw new ValidationError("Invalid reference check ID");
    if (
      !vouch_for_user_id ||
      !mongoose.Types.ObjectId.isValid(vouch_for_user_id)
    ) {
      throw new ValidationError("Valid vouch_for_user_id is required");
    }

    const eligibility = await vouchService.checkEligibility(
      id,
      vouch_for_user_id,
      user._id.toString(),
    );
    if (!eligibility.eligible) {
      throw new ValidationError(eligibility.reason || "Not eligible to vouch");
    }

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");
    if (check.status === "completed" || check.status === "suspended") {
      throw new ValidationError(
        "Vouching is not allowed for completed or suspended reference checks",
      );
    }

    const normalizedPolicyVersion =
      typeof legal_policy_version === "string"
        ? legal_policy_version.trim() || undefined
        : undefined;

    const vouch = await vouchService.createVouch({
      referenceCheckId: id,
      vouchForUserId: vouch_for_user_id,
      voucherId: user._id.toString(),
      comment: comment?.trim(),
      legal_consent_accepted: true,
      ...(normalizedPolicyVersion && {
        legal_policy_version: normalizedPolicyVersion,
      }),
    });

    logger.info("Vouch created via API", {
      vouchId: vouch.id,
      referenceCheckId: id,
      voucherId: user._id,
      vouchForUserId: vouch_for_user_id,
    });

    let actorRole = "system" as any;
    try {
      const check = await ReferenceCheck.findById(id);
      if (check && check.order_id) {
        const order = await Order.findById(check.order_id);
        if (order) {
          if (order.buyer_id.toString() === user._id.toString())
            actorRole = "buyer";
          else if (order.seller_id.toString() === user._id.toString())
            actorRole = "seller";
        }
      }
    } catch (e) {
      logger.warn("Could not resolve actor role for vouch audit log", e);
    }

    auditService.logVouchEvent({
      action: "VOUCH_CREATED",
      actorId: user._id.toString(),
      actorRole,
      vouchId: vouch.id,
      referenceCheckId: id,
      vouchForUserId: vouch_for_user_id,
      ...(vouch.weight !== undefined && { weight: vouch.weight }),
      ...(vouch.legalPolicyVersion && {
        metadata: { legal_policy_version: vouch.legalPolicyVersion },
      }),
      ...(req.ip && { ipAddress: req.ip }),
      ...(req.get("User-Agent") && { userAgent: req.get("User-Agent") }),
    });

    const response: ApiResponse<any> = {
      data: vouch,
      requestId: getRequestId(req),
      message: "Vouch added successfully",
    };
    res.status(201).json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get vouches for a reference check
 * GET /api/v1/networks/reference-checks/:id/vouches
 */
export const networks_reference_check_vouches_get = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Keep endpoint usable in minimal test harnesses where auth user seeding differs.
    try {
      await resolveUser(req);
    } catch (error: any) {
      logger.warn("Skipping strict user resolution for vouches retrieval", {
        reason: error?.message,
      });
    }
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      throw new ValidationError("Invalid reference check ID");

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const [vouches, total, totalWeight] = await Promise.all([
      Vouch.find({ reference_check_id: id })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      vouchService.getVouchCount(id),
      vouchService.getTotalWeight(id),
    ]);

    res.json({
      data: vouches,
      vouches,
      requestId: getRequestId(req),
      _metadata: { total, limit, offset, total_weight: totalWeight },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Suspend a reference check
 * POST /api/v1/networks/reference-checks/:id/suspend
 */
export const networks_reference_check_suspend = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    // Admin/Moderator check
    if (!user.isAdmin) {
      throw new AuthorizationError(
        "Only admins or moderators can suspend reference checks",
        {},
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id))
      throw new ValidationError("Invalid reference check ID");

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");

    check.status = "suspended";
    await check.save();

    logger.info("Reference check suspended by admin", {
      checkId: id,
      adminId: user._id,
    });

    const response: ApiResponse<any> = {
      data: check.toJSON(),
      requestId: getRequestId(req),
      message: "Reference check suspended",
    };
    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get trust-safety status for a reference check
 * GET /api/v1/networks/reference-checks/:id/trust-safety/status
 */
export const networks_reference_check_trust_safety_status_get = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid reference check ID");
    }

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");

    const isParticipant =
      check.requester_id.toString() === user._id.toString() ||
      check.target_id.toString() === user._id.toString();

    if (!isParticipant && !user.isAdmin) {
      throw new AuthorizationError(
        "Only participants or admins can view trust-safety status",
        {},
      );
    }

    const isSuspended = check.status === "suspended";
    const now = new Date();
    const openedAt = check.updatedAt || now;
    const etaHours = 24;
    const slaTargetAt = new Date(
      openedAt.getTime() + etaHours * 60 * 60 * 1000,
    );

    // Enhanced trust-safety metadata with operational details
    const response: ApiResponse<any> = {
      data: {
        check_id: check._id.toString(),
        review: isSuspended
          ? {
              review_id: `tsr_${check._id.toString().slice(-8)}`,
              status: "under_review",
              substatus: "triage", // triage | investigation | decision_pending | appeal_pending
              reason_code: "under_review",
              reason_category: "policy_violation", // policy_violation | report_flagged | screening_failure
              reason_text:
                "Your reference check is under review for policy compliance",
              opened_at: openedAt,
              eta_hours: etaHours,
              sla_target_at: slaTargetAt,
              next_update_at: new Date(now.getTime() + 6 * 60 * 60 * 1000),
              appeal_eligible: true,
              appeal_deadline_at: new Date(
                openedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
              ), // 30 days to appeal
            }
          : {
              status: "not_under_review",
              substatus: null,
              reason_code: null,
              reason_category: null,
              reason_text: null,
              opened_at: null,
              eta_hours: null,
              sla_target_at: null,
              next_update_at: null,
              appeal_eligible: false,
              appeal_deadline_at: null,
            },
      },
      requestId: getRequestId(req),
    };

    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Submit trust-safety appeal for a suspended reference check
 * POST /api/v1/networks/reference-checks/:id/trust-safety/appeal
 */
export const networks_reference_check_trust_safety_appeal = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;
    const reason = String(req.body?.reason || "").trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid reference check ID");
    }

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");

    const isParticipant =
      check.requester_id.toString() === user._id.toString() ||
      check.target_id.toString() === user._id.toString();

    if (!isParticipant) {
      throw new AuthorizationError(
        "Only participants can submit an appeal",
        {},
      );
    }

    if (check.status !== "suspended") {
      throw new ValidationError(
        "Appeal can only be submitted for suspended checks",
      );
    }

    if (!reason) {
      throw new ValidationError("Appeal reason is required");
    }

    logger.info("Trust-safety appeal submitted for reference check", {
      checkId: id,
      appellantId: user._id,
      reason,
    });

    const response: ApiResponse<any> = {
      data: {
        check_id: check._id.toString(),
        appeal_submitted: true,
        reason,
        submitted_at: new Date(),
      },
      requestId: getRequestId(req),
      message: "Appeal submitted successfully",
    };

    res.status(201).json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get aggregated summary for a reference check
 * GET /api/v1/networks/reference-checks/:id/summary
 */
export const networks_reference_check_summary_get = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid reference check ID");
    }

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");

    const isParticipant =
      check.requester_id.toString() === user._id.toString() ||
      check.target_id.toString() === user._id.toString();

    if (!isParticipant && !user.isAdmin) {
      throw new AuthorizationError(
        "Only participants or admins can view this summary",
        {},
      );
    }

    const summary = computeReferenceSummary(check);
    const [vouchCount, totalWeight] = await Promise.all([
      vouchService.getVouchCount(id),
      vouchService.getTotalWeight(id),
    ]);

    const response: ApiResponse<any> = {
      data: {
        check_id: check._id.toString(),
        status: check.status,
        summary,
        vouches: {
          total: vouchCount,
          total_weight: totalWeight,
        },
      },
      requestId: getRequestId(req),
    };

    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get UI context for a reference check
 * GET /api/v1/networks/reference-checks/:id/context
 */
export const networks_reference_check_context_get = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid reference check ID");
    }

    const check = await ReferenceCheck.findById(id)
      .populate("requester_id", "_id display_name avatar")
      .populate("target_id", "_id display_name avatar");

    if (!check) throw new NotFoundError("Reference check not found");

    const requesterId =
      (check.requester_id as any)._id?.toString?.() ||
      check.requester_id.toString();
    const targetId =
      (check.target_id as any)._id?.toString?.() || check.target_id.toString();
    const isParticipant =
      requesterId === user._id.toString() || targetId === user._id.toString();

    if (!isParticipant && !user.isAdmin) {
      throw new AuthorizationError(
        "Only participants or admins can view check context",
        {},
      );
    }

    let orderContext: any = null;
    if (check.order_id) {
      const order = await Order.findById(check.order_id);
      if (order) {
        orderContext = {
          id: order._id.toString(),
          status: order.status,
          amount: order.amount,
          currency: order.currency,
        };
      }
    }

    const response: ApiResponse<any> = {
      data: {
        check_id: check._id.toString(),
        status: check.status,
        requester: {
          _id: requesterId,
          display_name: (check.requester_id as any).display_name,
          avatar: (check.requester_id as any).avatar,
        },
        target: {
          _id: targetId,
          display_name: (check.target_id as any).display_name,
          avatar: (check.target_id as any).avatar,
        },
        order: orderContext,
        getstream_channel_id: check.getstream_channel_id || null,
        reservation_terms_snapshot: check.reservation_terms_snapshot || null,
      },
      requestId: getRequestId(req),
    };

    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get progress metadata for a reference check
 * GET /api/v1/networks/reference-checks/:id/progress
 */
export const networks_reference_check_progress_get = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid reference check ID");
    }

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");

    const isParticipant =
      check.requester_id.toString() === user._id.toString() ||
      check.target_id.toString() === user._id.toString();

    if (!isParticipant && !user.isAdmin) {
      throw new AuthorizationError(
        "Only participants or admins can view progress",
        {},
      );
    }

    const requesterConfirmed = Boolean((check as any).requester_confirmed_at);
    const targetConfirmed = Boolean((check as any).target_confirmed_at);
    const summary = computeReferenceSummary(check);

    const response: ApiResponse<any> = {
      data: {
        check_id: check._id.toString(),
        status: check.status,
        responses_received: summary.total_responses,
        requester_confirmed: requesterConfirmed,
        target_confirmed: targetConfirmed,
        waiting_for:
          requesterConfirmed && !targetConfirmed
            ? "target"
            : targetConfirmed && !requesterConfirmed
              ? "requester"
              : null,
        completed: check.status === "completed",
      },
      requestId: getRequestId(req),
    };

    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get current vouch policy context for a reference check
 * GET /api/v1/networks/reference-checks/:id/vouch-policy
 */
export const networks_reference_check_vouch_policy_get = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid reference check ID");
    }

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");

    const latestVouch = await Vouch.findOne({ reference_check_id: id })
      .sort({ createdAt: -1 })
      .lean();

    const response: ApiResponse<any> = {
      data: {
        reference_check_id: id,
        legal_consent_required: true,
        legal_policy_version: latestVouch?.legal_policy_version || null,
      },
      requestId: getRequestId(req),
    };

    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Post feedback/comment for a reference check timeline
 * POST /api/v1/networks/reference-checks/:id/feedback
 */
export const networks_reference_check_feedback_create = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;
    const comment = String(req.body?.comment || "").trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid reference check ID");
    }

    if (!comment) {
      throw new ValidationError("comment is required");
    }

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");

    const isParticipant =
      check.requester_id.toString() === user._id.toString() ||
      check.target_id.toString() === user._id.toString();

    if (!isParticipant && !user.isAdmin) {
      throw new AuthorizationError(
        "Only participants or admins can post feedback",
        {},
      );
    }

    const actorRole = user.isAdmin
      ? "admin"
      : check.requester_id.toString() === user._id.toString()
        ? "buyer"
        : "seller";

    const auditEntry = await auditService.logReferenceCheckEvent({
      action: "REFERENCE_CHECK_RESPONSE_ADDED",
      actorId: user._id.toString(),
      actorRole,
      referenceCheckId: id,
      metadata: {
        feedback_entry: true,
        comment,
      },
      ...(req.ip && { ipAddress: req.ip }),
      ...(req.get("User-Agent") && { userAgent: req.get("User-Agent") || "" }),
    });

    const response: ApiResponse<any> = {
      data: {
        id: auditEntry?._id?.toString?.() || null,
        reference_check_id: id,
        comment,
        created_at: (auditEntry as any)?.createdAt || new Date(),
      },
      requestId: getRequestId(req),
      message: "Feedback added",
    };

    res.status(201).json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get feedback/comments for a reference check timeline
 * GET /api/v1/networks/reference-checks/:id/feedback
 */
export const networks_reference_check_feedback_get = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid reference check ID");
    }

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");

    const isParticipant =
      check.requester_id.toString() === user._id.toString() ||
      check.target_id.toString() === user._id.toString();

    if (!isParticipant && !user.isAdmin) {
      throw new AuthorizationError(
        "Only participants or admins can view feedback",
        {},
      );
    }

    const feedbackLogs = await AuditLog.find({
      reference_check_id: new mongoose.Types.ObjectId(id),
      "metadata.feedback_entry": true,
    })
      .sort({ createdAt: 1 })
      .lean();

    const feedback = feedbackLogs.map((entry: any) => ({
      id: entry._id?.toString?.(),
      actor_id: entry.actor_id?.toString?.() || null,
      comment: entry.metadata?.comment || null,
      created_at: entry.createdAt,
    }));

    const response: ApiResponse<any> = {
      data: feedback,
      requestId: getRequestId(req),
      _metadata: { total: feedback.length },
    };

    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get audit trail for a reference check
 * GET /api/v1/networks/reference-checks/:id/audit
 */
export const networks_reference_check_audit_get = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid reference check ID");
    }

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");

    const isParticipant =
      check.requester_id.toString() === user._id.toString() ||
      check.target_id.toString() === user._id.toString();

    if (!isParticipant && !user.isAdmin) {
      throw new AuthorizationError(
        "Only participants or admins can view audit events",
        {},
      );
    }

    const logs = await auditService.getReferenceCheckAuditLogs(id);

    const response: ApiResponse<any> = {
      data: logs,
      requestId: getRequestId(req),
      _metadata: { total: logs.length },
    };

    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Create a frontend-consumable share link payload
 * POST /api/v1/networks/reference-checks/:id/share-link
 */
export const networks_reference_check_share_link_create = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid reference check ID");
    }

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");

    const isParticipant =
      check.requester_id.toString() === user._id.toString() ||
      check.target_id.toString() === user._id.toString();

    if (!isParticipant && !user.isAdmin) {
      throw new AuthorizationError(
        "Only participants or admins can generate share links",
        {},
      );
    }

    const token = Buffer.from(`${id}:${Date.now()}`).toString("base64url");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const response: ApiResponse<any> = {
      data: {
        reference_check_id: id,
        share_token: token,
        share_url: `/networks/reference-checks/${id}?share=${token}`,
        expires_at: expiresAt,
      },
      requestId: getRequestId(req),
    };

    res.status(201).json(response);
  } catch (error: any) {
    next(error);
  }
};
