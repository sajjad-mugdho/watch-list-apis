import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Order } from "../../models/Order";
import { ReferenceCheck } from "../../models/ReferenceCheck";

import {
  AppError,
  NotFoundError,
  ValidationError,
  AuthorizationError,
  MissingUserContextError,
  DatabaseError,
} from "../../utils/errors";
import { ApiResponse } from "../../types";
import logger from "../../utils/logger";

/**
 * Get order details for Networks platform
 * GET /api/v1/networks/orders/:id
 */
export const networks_order_get = async (
  req: Request<{ id: string }, {}, {}>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id: orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError("Invalid order ID");
    }

    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError("Order not found");

    // Authorization check: must be buyer or seller
    if (
      String(order.buyer_id) !== String(userId) &&
      String(order.seller_id) !== String(userId)
    ) {
      throw new AuthorizationError("Not authorized to view this order", {});
    }

    // Ensure it's a Networks order — do not expose non-Network orders via Networks routes
    if (order.listing_type !== "NetworkListing") {
      throw new NotFoundError("Order not found");
    }

    const referenceChecks = await ReferenceCheck.find({ order_id: order._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const activeReferenceCheck = referenceChecks.find(
      (c: any) => c.status !== "completed" && c.status !== "declined",
    );

    const completionStatus = {
      buyer_confirmed: Boolean(order.buyer_confirmed_complete),
      seller_confirmed: Boolean(order.seller_confirmed_complete),
      waiting_for:
        order.buyer_confirmed_complete && !order.seller_confirmed_complete
          ? "seller"
          : order.seller_confirmed_complete && !order.buyer_confirmed_complete
            ? "buyer"
            : null,
      completed:
        order.buyer_confirmed_complete && order.seller_confirmed_complete,
    };

    res.json({
      data: {
        ...order.toJSON(),
        reference_check: {
          status: activeReferenceCheck
            ? activeReferenceCheck.status
            : referenceChecks.length > 0
              ? "completed"
              : "not_started",
          current_check_id: activeReferenceCheck?._id?.toString?.() || null,
          total_checks: referenceChecks.length,
        },
        completion_status: completionStatus,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    logger.error("Error fetching networks order:", err);
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch order", err));
    }
  }
};

/**
 * Get user orders for Networks
 * GET /api/v1/networks/user/orders
 */
export const networks_user_orders_get = async (
  req: Request<
    {},
    {},
    {},
    { type?: "buy" | "sell"; status?: string; limit?: string; offset?: string }
  >,
  res: Response<ApiResponse<any[]>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { type, status, limit = "20", offset = "0" } = req.query;

    const query: any = {
      listing_type: "NetworkListing",
    };

    if (type === "buy") {
      query.buyer_id = userId;
    } else if (type === "sell") {
      query.seller_id = userId;
    } else {
      query.$or = [{ buyer_id: userId }, { seller_id: userId }];
    }

    if (status && status !== "all") {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await Order.countDocuments(query);

    res.json({
      data: orders.map((o) => o.toJSON()),
      _metadata: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    logger.error("Error fetching networks user orders:", err);
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch user orders", err));
    }
  }
};

/**
 * Confirm order completion (dual confirmation)
 * POST /api/v1/networks/orders/:id/complete
 *
 * Both buyer and seller must call this endpoint.
 * On the second confirmation, the order transitions to "completed".
 */
export const networks_order_complete = async (
  req: Request<{ id: string }, {}, {}>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id: orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError("Invalid order ID");
    }

    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError("Order not found");

    if (order.listing_type !== "NetworkListing") {
      throw new NotFoundError("Order not found");
    }

    const isBuyer = String(order.buyer_id) === String(userId);
    const isSeller = String(order.seller_id) === String(userId);
    if (!isBuyer && !isSeller) {
      throw new AuthorizationError("Not authorized to confirm this order", {});
    }

    // Must be in a confirmable state
    const confirmableStatuses = ["reserved", "pending", "paid"];
    if (!confirmableStatuses.includes(order.status)) {
      throw new ValidationError(
        `Order cannot be confirmed in status: ${order.status}`,
      );
    }

    // Check if already confirmed by this user
    const alreadyConfirmed = order.confirmed_by?.some(
      (c: any) => String(c.user_id) === String(userId),
    );
    if (alreadyConfirmed) {
      throw new ValidationError("You have already confirmed this order");
    }

    // Record this user's confirmation
    if (isBuyer) {
      order.buyer_confirmed_complete = true;
    } else {
      order.seller_confirmed_complete = true;
    }
    order.confirmed_by.push({
      user_id: new mongoose.Types.ObjectId(userId),
      confirmed_at: new Date(),
    });

    // Check if both parties have confirmed
    const bothConfirmed =
      order.buyer_confirmed_complete && order.seller_confirmed_complete;

    if (bothConfirmed) {
      order.status = "completed" as any;

      // Contracted side-effect: complete active reference checks linked to this order.
      const activeChecks = await ReferenceCheck.find({
        order_id: order._id,
        status: {
          $in: [
            "pending",
            "active",
            "waiting_requester_confirm",
            "waiting_target_confirm",
          ],
        },
      });

      const now = new Date();
      for (const check of activeChecks) {
        check.status = "completed";
        check.completed_at = now;
        if (!(check as any).requester_confirmed_at) {
          (check as any).requester_confirmed_at = now;
        }
        if (!(check as any).target_confirmed_at) {
          (check as any).target_confirmed_at = now;
        }
        await check.save();
      }

      logger.info("Order completion triggered reference-check completion", {
        orderId: order._id.toString(),
        referenceChecksCompleted: activeChecks.length,
      });
    }

    await order.save();

    // Notify the other party (notifications pending platform-specific service)
    try {
      if (bothConfirmed) {
        // TODO: Notify both parties of completion when notification service is ready
      } else {
        // TODO: Notify the other party to confirm completion when notification service is ready
      }
    } catch (notifErr) {
      logger.warn("Failed to create order completion notification", {
        notifErr,
      });
    }

    res.json({
      data: {
        order: order.toJSON(),
        buyer_confirmed: order.buyer_confirmed_complete,
        seller_confirmed: order.seller_confirmed_complete,
        completed: bothConfirmed,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err: any) {
    logger.error("Error confirming order completion:", err);
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to confirm order completion", err));
    }
  }
};

/**
 * Get order completion rail status
 * GET /api/v1/networks/orders/:id/completion-status
 */
export const networks_order_completion_status_get = async (
  req: Request<{ id: string }, {}, {}>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id: orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError("Invalid order ID");
    }

    const order = await Order.findById(orderId);
    if (!order || order.listing_type !== "NetworkListing") {
      throw new NotFoundError("Order not found");
    }

    const isBuyer = String(order.buyer_id) === String(userId);
    const isSeller = String(order.seller_id) === String(userId);
    if (!isBuyer && !isSeller) {
      throw new AuthorizationError("Not authorized to view this order", {});
    }

    const response: ApiResponse<any> = {
      data: {
        order_id: order._id.toString(),
        status: order.status,
        buyer_confirmed: Boolean(order.buyer_confirmed_complete),
        seller_confirmed: Boolean(order.seller_confirmed_complete),
        waiting_for:
          order.buyer_confirmed_complete && !order.seller_confirmed_complete
            ? "seller"
            : order.seller_confirmed_complete && !order.buyer_confirmed_complete
              ? "buyer"
              : null,
        completed:
          Boolean(order.buyer_confirmed_complete) &&
          Boolean(order.seller_confirmed_complete),
      },
      requestId: req.headers["x-request-id"] as string,
    };

    res.json(response);
  } catch (err: any) {
    logger.error("Error fetching order completion status:", err);
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to fetch order completion status", err));
    }
  }
};

/**
 * Initiate a reference check from order details flow
 * POST /api/v1/networks/orders/:id/reference-check/initiate
 */
export const networks_order_reference_check_initiate = async (
  req: Request<{ id: string }, {}, { reason?: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id: orderId } = req.params;
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError("Invalid order ID");
    }

    const order = await Order.findById(orderId);
    if (!order || order.listing_type !== "NetworkListing") {
      throw new NotFoundError("Order not found");
    }

    const isBuyer = String(order.buyer_id) === String(userId);
    const isSeller = String(order.seller_id) === String(userId);
    if (!isBuyer && !isSeller) {
      throw new AuthorizationError(
        "Not authorized to create reference check",
        {},
      );
    }

    const targetId = isBuyer
      ? order.seller_id.toString()
      : order.buyer_id.toString();

    const existingActive = await ReferenceCheck.findOne({
      order_id: order._id,
      requester_id: new mongoose.Types.ObjectId(userId),
      target_id: new mongoose.Types.ObjectId(targetId),
      status: {
        $in: [
          "pending",
          "active",
          "waiting_requester_confirm",
          "waiting_target_confirm",
        ],
      },
    });

    if (existingActive) {
      res.json({
        data: existingActive.toJSON(),
        requestId: req.headers["x-request-id"] as string,
        message: "Active reference check already exists for this order",
      });
      return;
    }

    const created = await ReferenceCheck.create({
      requester_id: new mongoose.Types.ObjectId(userId),
      target_id: new mongoose.Types.ObjectId(targetId),
      order_id: order._id,
      reason: reason || null,
      status: "pending",
      transaction_value: order.amount,
      reservation_terms_snapshot: order.reservation_terms_snapshot ?? null,
    });

    res.status(201).json({
      data: created.toJSON(),
      requestId: req.headers["x-request-id"] as string,
      message: "Reference check initiated",
    });
  } catch (err: any) {
    logger.error("Error initiating reference check from order:", err);
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new DatabaseError("Failed to initiate reference check", err));
    }
  }
};

/**
 * Get audit trail for an order
 * GET /api/v1/networks/orders/:id/audit-trail
 */
export const networks_order_audit_trail_get = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id: orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError("Invalid order ID");
    }

    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError("Order not found");

    // Verify user is buyer or seller
    const isBuyer = String(order.buyer_id) === String(userId);
    const isSeller = String(order.seller_id) === String(userId);
    if (!isBuyer && !isSeller) {
      res.status(403).json({
        error: { message: "Not authorized to view this order's audit trail" },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    // Get audit logs for this order
    const { AuditLog } = require("../../models/AuditLog");
    const auditLogs = await AuditLog.find({ order_id: orderId })
      .sort({ createdAt: -1 })
      .lean();

    const auditTrail = auditLogs.map((log: any) => ({
      action: log.action,
      actor_id: log.actor_id,
      timestamp: log.createdAt,
      details: {
        previous_state: log.previous_state,
        new_state: log.new_state,
        finix_transfer_id: log.finix_transfer_id || null,
        finix_auth_id: log.finix_auth_id || null,
      },
      notes: log.notes || "",
    }));

    res.json({
      data: auditTrail,
      _metadata: {
        orderId,
        total: auditTrail.length,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};
