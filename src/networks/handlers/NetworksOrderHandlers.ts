import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Order } from "../../models/Order";

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

    res.json({
      data: order.toJSON(),
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
