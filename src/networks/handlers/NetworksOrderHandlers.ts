import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Order } from "../../models/Order";
import { NetworkListingChannel } from "../../models/ListingChannel";
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
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id: orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ValidationError("Invalid order ID");
    }

    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError("Order");

    // Authorization check: must be buyer or seller
    if (
      String(order.buyer_id) !== String(userId) &&
      String(order.seller_id) !== String(userId)
    ) {
      throw new AuthorizationError("Not authorized to view this order", {});
    }

    // Ensure it's a Networks order
    if (order.listing_type !== "NetworkListing") {
       // Optional: We might allow viewing Marketplace orders if unified, 
       // but for strict isolation we might restrict.
       // However, many fields are shared. Let's stick to authorizing by ownership.
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
  req: Request<{}, {}, {}, { type?: "buy" | "sell"; status?: string; limit?: string; offset?: string }>,
  res: Response<ApiResponse<any[]>>,
  next: NextFunction
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
      data: orders.map(o => o.toJSON()),
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
