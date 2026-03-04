import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import {
  ReferenceCheck,
  REFERENCE_RATING_VALUES,
} from "../../models/ReferenceCheck";
import { User } from "../../models/User";
import { Notification } from "../../models/Notification";
import { feedService } from "../../services/FeedService";
import { chatService } from "../../services/ChatService";
import { Order } from "../../models/Order";
import { auditService } from "../../services/AuditService";
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
  if (!auth?.userId) throw new MissingUserContextError({ route: req.path, note: "auth.userId missing" });

  const user = await User.findOne({ external_id: auth.userId });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

// ----------------------------------------------------------
// Handlers
// ----------------------------------------------------------

/**
 * Create a reference check request
 * POST /api/v1/networks/reference-checks
 */
export const networks_reference_check_create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { target_id, network_id, order_id, reason } = req.body;

    if (!target_id) throw new ValidationError("target_id is required");
    if (!mongoose.Types.ObjectId.isValid(target_id)) throw new ValidationError("Invalid target_id");
    if (!order_id) throw new ValidationError("order_id is required. Reference checks can only be created for completed orders.");
    if (!mongoose.Types.ObjectId.isValid(order_id)) throw new ValidationError("Invalid order_id");

    const order = await Order.findById(order_id);
    if (!order) throw new NotFoundError("Order not found");

    const validOrderStatuses = ["completed", "delivered", "reserved"];
    if (!validOrderStatuses.includes(order.status)) {
      throw new ValidationError(`Reference checks can be initiated once an order is reserved or completed. Current status: ${order.status}`);
    }

    const isBuyer = order.buyer_id.toString() === user._id.toString();
    const isSeller = order.seller_id.toString() === user._id.toString();
    if (!isBuyer && !isSeller) {
      throw new AuthorizationError("You must be a participant in the order to create a reference check", {});
    }

    const expectedTarget = isBuyer ? order.seller_id.toString() : order.buyer_id.toString();
    if (target_id !== expectedTarget) {
      throw new ValidationError("Reference check target must be the other party in the order");
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
      throw new ValidationError("You already have a pending reference check for this order");
    }

    const referenceCheck = await ReferenceCheck.create({
      requester_id: user._id,
      target_id,
      network_id: network_id || null,
      order_id: order._id,
      reason: reason?.trim() || null,
      status: "active",
      transaction_value: order.amount,
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
        true
      );
      referenceCheck.getstream_channel_id = channelId;
      await referenceCheck.save();

      await chatService.sendSystemMessage(
        channelId,
        { type: "reference_check_initiated", message: reason || "New reference check started" },
        user._id.toString()
      );
    } catch (chatError) {
      logger.warn("Failed to create chat channel for reference check", { chatError });
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
            user._id.toString()
          );
        }
      } catch (orderChatError) {
        logger.warn("Failed to notify order chat about reference check", { orderChatError });
      }
    }

    try {
      await feedService.addReferenceCheckActivity(
        user._id.toString(),
        referenceCheck._id.toString(),
        target_id
      );
    } catch (feedError) {
      logger.warn("Failed to add reference check to activity feed", { feedError });
    }

    try {
      await Notification.create({
        user_id: target_id,
        type: "reference_check_request",
        title: "Reference Check Request",
        body: `${user.display_name || "Someone"} has requested a reference check for you.`,
        data: {
          reference_check_id: referenceCheck._id.toString(),
          requester_id: user._id.toString(),
        },
        action_url: `/reference-checks/${referenceCheck._id}`,
      });
    } catch (notifError) {
      logger.warn("Failed to create reference check notification", { notifError });
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
 * Get reference checks
 * GET /api/v1/networks/reference-checks
 */
export const networks_reference_checks_get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const type = req.query.type as string;
    let checks;

    if (type === "requested") {
      checks = await ReferenceCheck.getRequestedByUser(user._id.toString());
    } else if (type === "pending") {
      checks = await ReferenceCheck.getPendingForUser(user._id.toString());
    } else if (type === "about-me") {
      checks = await ReferenceCheck.getChecksAboutUser(user._id.toString());
    } else {
      checks = await ReferenceCheck.getRequestedByUser(user._id.toString());
    }

    const response: ApiResponse<any> = {
      data: checks.map((c) => c.toJSON()),
      requestId: getRequestId(req),
      _metadata: { total: checks.length },
    };
    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get a specific reference check
 * GET /api/v1/networks/reference-checks/:id
 */
export const networks_reference_check_get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError("Invalid reference check ID");

    const check = await ReferenceCheck.findById(id)
      .populate("requester_id", "_id display_name avatar first_name last_name")
      .populate("target_id", "_id display_name avatar first_name last_name");

    if (!check) throw new NotFoundError("Reference check not found");

    const isRequester = check.requester_id._id.toString() === user._id.toString();
    const isTarget = check.target_id._id.toString() === user._id.toString();

    const responseData = check.responses.map((r: any) => ({
      responder_id: r.is_anonymous && !isRequester ? null : r.responder_id.toString(),
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
          requester_role: order.buyer_id.toString() === requesterId ? "buyer" : "seller",
          target_role: order.buyer_id.toString() === targetId ? "buyer" : "seller",
          private_contract: (order as any).private_contract_text || undefined,
        };
      }
    }

    const response: ApiResponse<any> = {
      data: {
        ...check.toJSON(),
        responses: responseData,
        order_details: orderDetails,
        timeRemaining: check.expires_at ? Math.max(0, check.expires_at.getTime() - Date.now()) : null,
      },
      requestId: getRequestId(req),
      _metadata: {
        is_requester: isRequester,
        is_target: isTarget,
        confirmed_by_me: check.confirmed_by.includes(user._id as any),
        can_respond:
          !isRequester &&
          !isTarget &&
          check.status === "active" &&
          !check.responses.find((r: any) => r.responder_id.toString() === user._id.toString()),
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
export const networks_reference_check_respond = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;
    const { rating, comment, is_anonymous } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError("Invalid reference check ID");
    if (!rating || !REFERENCE_RATING_VALUES.includes(rating)) {
      throw new ValidationError("Valid rating is required (positive, neutral, negative)");
    }

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");
    if (check.status !== "pending") throw new ValidationError("Reference check is not pending");
    if (check.requester_id.toString() === user._id.toString()) {
      throw new ValidationError("Cannot respond to your own reference check");
    }
    if (check.target_id.toString() === user._id.toString()) {
      throw new ValidationError("Cannot respond to reference check about yourself");
    }

    const alreadyResponded = check.responses.find(
      (r: any) => r.responder_id.toString() === user._id.toString()
    );
    if (alreadyResponded) throw new ValidationError("You have already responded to this reference check");

    check.responses.push({
      responder_id: user._id,
      rating,
      comment: comment?.trim() || null,
      is_anonymous: is_anonymous === true,
      responded_at: new Date(),
    });
    await check.save();

    try {
      await Notification.create({
        user_id: check.requester_id,
        type: "reference_check_response",
        title: "New Reference Check Response",
        body: `${user.display_name || "Someone"} has responded to your reference check request.`,
        data: {
          reference_check_id: check._id.toString(),
          responder_id: user._id.toString(),
        },
        action_url: `/reference-checks/${check._id}`,
      });
    } catch (notifError) {
      logger.warn("Failed to create reference response notification", { notifError });
    }

    logger.info("Reference check response added", { checkId: id, responderId: user._id });

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
export const networks_reference_check_complete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError("Invalid reference check ID");

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");
    if (check.status !== "active") throw new ValidationError("Reference check is not active");

    if (check.requester_id.toString() !== user._id.toString() && check.target_id.toString() !== user._id.toString()) {
      throw new AuthorizationError("Only order participants can confirm completion", {});
    }

    if (!check.confirmed_by.includes(user._id as any)) {
      check.confirmed_by.push(user._id as any);
    }

    // Check if both parties confirmed
    const hasRequesterConfirmed = check.confirmed_by.includes(check.requester_id as any);
    const hasTargetConfirmed = check.confirmed_by.includes(check.target_id as any);

    if (hasRequesterConfirmed && hasTargetConfirmed) {
      const summary = {
        total_responses: check.responses.length,
        positive_count: check.responses.filter((r: any) => r.rating === "positive").length,
        neutral_count: check.responses.filter((r: any) => r.rating === "neutral").length,
        negative_count: check.responses.filter((r: any) => r.rating === "negative").length,
      };

      check.summary = summary;
      check.status = "completed";
      check.completed_at = new Date();
    }
    
    await check.save();

    logger.info("Reference check completed", { checkId: id });

    const response: ApiResponse<any> = {
      data: check.toJSON(),
      requestId: getRequestId(req),
      message: "Reference check completed",
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
export const networks_reference_check_delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError("Invalid reference check ID");

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");
    if (check.requester_id.toString() !== user._id.toString()) {
      throw new AuthorizationError("Only the requester can delete this reference check", {});
    }
    if (check.status !== "pending") throw new ValidationError("Only pending reference checks can be deleted");

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
export const networks_reference_check_vouch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;
    const { vouch_for_user_id, comment, legal_consent_accepted } = req.body;

    if (!legal_consent_accepted) {
      throw new ValidationError("You must accept the legal terms before vouching");
    }

    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError("Invalid reference check ID");
    if (!vouch_for_user_id || !mongoose.Types.ObjectId.isValid(vouch_for_user_id)) {
      throw new ValidationError("Valid vouch_for_user_id is required");
    }

    const { vouchService } = await import("../../services/vouch/VouchService");

    const eligibility = await vouchService.checkEligibility(id, vouch_for_user_id, user._id.toString());
    if (!eligibility.eligible) {
      throw new ValidationError(eligibility.reason || "Not eligible to vouch");
    }

    const vouch = await vouchService.createVouch({
      referenceCheckId: id,
      vouchForUserId: vouch_for_user_id,
      voucherId: user._id.toString(),
      comment: comment?.trim(),
      legal_consent_accepted: true,
    });

    logger.info("Vouch created via API", {
      vouchId: vouch.id,
      referenceCheckId: id,
      voucherId: user._id,
      vouchForUserId: vouch_for_user_id,
    });

    auditService.logVouchEvent({
      action: "VOUCH_CREATED",
      actorId: user._id.toString(),
      actorRole: "buyer",
      vouchId: vouch.id,
      referenceCheckId: id,
      vouchForUserId: vouch_for_user_id,
      ...(vouch.weight !== undefined && { weight: vouch.weight }),
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
export const networks_reference_check_vouches_get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await resolveUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError("Invalid reference check ID");

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");

    const { vouchService } = await import("../../services/vouch/VouchService");

    const vouches = await vouchService.getVouchesForReferenceCheck(id);
    const totalWeight = await vouchService.getTotalWeight(id);

    const response: ApiResponse<any> = {
      data: vouches,
      requestId: getRequestId(req),
      _metadata: { total_weight: totalWeight },
    };
    res.json(response);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Suspend a reference check
 * POST /api/v1/networks/reference-checks/:id/suspend
 */
export const networks_reference_check_suspend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params;

    // Admin/Moderator check
    if (user.role !== "admin" && user.role !== "moderator") {
      throw new AuthorizationError("Only admins or moderators can suspend reference checks", {});
    }

    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError("Invalid reference check ID");

    const check = await ReferenceCheck.findById(id);
    if (!check) throw new NotFoundError("Reference check not found");
    
    check.status = "suspended";
    await check.save();

    logger.info("Reference check suspended by admin", { checkId: id, adminId: user._id });

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
