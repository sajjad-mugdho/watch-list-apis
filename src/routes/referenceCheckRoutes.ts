/**
 * Reference Check Routes
 *
 * Endpoints for reference check operations:
 * - Create reference check request
 * - Respond to reference checks
 * - Get reference checks
 * - Complete reference checks
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  ReferenceCheck,
  REFERENCE_RATING_VALUES,
} from "../models/ReferenceCheck";
import { User } from "../models/User";
import { Notification } from "../models/Notification";
import { feedService } from "../services/FeedService";
import { chatService } from "../services/ChatService";
import { Order } from "../models/Order";
import logger from "../utils/logger";
import mongoose from "mongoose";

const router = Router();

/**
 * @swagger
 * /api/v1/reference-checks:
 *   post:
 *     summary: Create a reference check request
 *     tags: [ReferenceCheck]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { target_id, network_id, order_id, reason } = req.body;

      if (!target_id) {
        res.status(400).json({ error: { message: "target_id is required" } });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(target_id)) {
        res.status(400).json({ error: { message: "Invalid target_id" } });
        return;
      }

      // P0 FIX: order_id is REQUIRED per Michael's requirements
      // Reference checks can ONLY be created through an ACTIVE Order
      if (!order_id) {
        res.status(400).json({ 
          error: { message: "order_id is required. Reference checks can only be created for completed orders." } 
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(order_id)) {
        res.status(400).json({ error: { message: "Invalid order_id" } });
        return;
      }

      // Validate order exists and is in a valid state
      const order = await Order.findById(order_id);
      if (!order) {
        res.status(404).json({ error: { message: "Order not found" } });
        return;
      }

      // Order must be completed or delivered for reference check
      const validOrderStatuses = ['completed', 'delivered'];
      if (!validOrderStatuses.includes(order.status)) {
        res.status(400).json({ 
          error: { message: `Order must be completed or delivered. Current status: ${order.status}` } 
        });
        return;
      }

      // User must be buyer OR seller in the order
      const isBuyer = order.buyer_id.toString() === user._id.toString();
      const isSeller = order.seller_id.toString() === user._id.toString();
      if (!isBuyer && !isSeller) {
        res.status(403).json({ 
          error: { message: "You must be a participant in the order to create a reference check" } 
        });
        return;
      }

      // Target must be the OTHER party in the order
      const expectedTarget = isBuyer ? order.seller_id.toString() : order.buyer_id.toString();
      if (target_id !== expectedTarget) {
        res.status(400).json({ 
          error: { message: "Reference check target must be the other party in the order" } 
        });
        return;
      }

      // Cannot check yourself
      if (user._id.toString() === target_id) {
        res.status(400).json({
          error: { message: "Cannot create reference check for yourself" },
        });
        return;
      }

      // Verify target user exists
      const targetUser = await User.findById(target_id);
      if (!targetUser) {
        res.status(404).json({ error: { message: "Target user not found" } });
        return;
      }

      // Check for existing pending check for this order
      const existingCheck = await ReferenceCheck.findOne({
        requester_id: user._id,
        target_id,
        order_id,
        status: "pending",
      });

      if (existingCheck) {
        res.status(400).json({
          error: { message: "You already have a pending reference check for this order" },
        });
        return;
      }

      const referenceCheck = await ReferenceCheck.create({
        requester_id: user._id,
        target_id,
        network_id: network_id || null,
        order_id: order._id,
        reason: reason?.trim() || null,
      });

      // 1. Create dedicated chat channel for this reference check
      try {
        const { channelId } = await chatService.getOrCreateChannel(
          user._id.toString(),
          target_id,
          {
            listing_id: (referenceCheck._id as any).toString(), // using reference check ID as listing ID for metadata
            listing_title: `Reference Check: ${user.display_name} -> ${targetUser.display_name}`,
          },
          true // Dedicated for this check
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

      // 2. If order_id provided, notify the order chat
      if (order_id && mongoose.Types.ObjectId.isValid(order_id)) {
        try {
          const order = await Order.findById(order_id);
          if (order && order.getstream_channel_id) {
            await chatService.sendSystemMessage(
              order.getstream_channel_id,
              { 
                type: "reference_check_initiated", 
                order_id: order_id.toString(),
                message: `Reference check initiated for ${targetUser.display_name}`
              },
              user._id.toString()
            );
          }
        } catch (orderChatError) {
          logger.warn("Failed to notify order chat about reference check", { orderChatError });
        }
      }

      // Add to activity feed
      try {
        await feedService.addReferenceCheckActivity(
          user._id.toString(),
          referenceCheck._id.toString(),
          target_id
        );
      } catch (feedError) {
        logger.warn("Failed to add reference check to activity feed", { feedError });
      }

      // Add notification for target user
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

      res.status(201).json({
        data: referenceCheck.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/reference-checks:
 *   get:
 *     summary: Get reference checks (requested by or pending for user)
 *     tags: [ReferenceCheck]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const type = req.query.type as string;
      let checks;

      if (type === "requested") {
        // Checks I requested
        checks = await ReferenceCheck.getRequestedByUser(user._id.toString());
      } else if (type === "pending") {
        // Checks I can respond to
        checks = await ReferenceCheck.getPendingForUser(user._id.toString());
      } else if (type === "about-me") {
        // Completed checks about me
        checks = await ReferenceCheck.getChecksAboutUser(user._id.toString());
      } else {
        // Default: all checks I requested
        checks = await ReferenceCheck.getRequestedByUser(user._id.toString());
      }

      res.json({
        data: checks.map((c) => c.toJSON()),
        total: checks.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/reference-checks/{id}:
 *   get:
 *     summary: Get a specific reference check
 *     tags: [ReferenceCheck]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: { message: "Invalid reference check ID" } });
        return;
      }

      const check = await ReferenceCheck.findById(id)
        .populate("requester_id", "_id display_name avatar first_name last_name")
        .populate("target_id", "_id display_name avatar first_name last_name");

      if (!check) {
        res.status(404).json({ error: { message: "Reference check not found" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      const isRequester = user && check.requester_id._id.toString() === user._id.toString();
      const isTarget = user && check.target_id._id.toString() === user._id.toString();

      // Filter anonymous responses if not requester
      const responseData = check.responses.map((r: any) => ({
        responder_id: r.is_anonymous && !isRequester ? null : r.responder_id.toString(),
        rating: r.rating,
        comment: r.comment,
        is_anonymous: r.is_anonymous,
        responded_at: r.responded_at,
      }));

      // EDGE CASE FIX #4: Expose order details per Michael's requirements
      // Reference checks should expose: order_price, user_roles, private_contract
      let orderDetails: {
        order_price?: number;
        requester_role?: 'buyer' | 'seller';
        target_role?: 'buyer' | 'seller';
        private_contract?: string;
      } = {};

      if (check.order_id) {
        const order = await Order.findById(check.order_id);
        if (order) {
          const requesterId = check.requester_id._id.toString();
          const targetId = check.target_id._id.toString();
          
          orderDetails = {
            order_price: order.amount,
            requester_role: order.buyer_id.toString() === requesterId ? 'buyer' : 'seller',
            target_role: order.buyer_id.toString() === targetId ? 'buyer' : 'seller',
            private_contract: (order as any).private_contract_text || undefined,
          };
        }
      }

      res.json({
        data: {
          ...check.toJSON(),
          responses: responseData,
          // Include order details per Michael's requirements
          order_details: orderDetails,
        },
        is_requester: isRequester,
        is_target: isTarget,
        can_respond:
          user &&
          !isRequester &&
          !isTarget &&
          check.status === "pending" &&
          !check.responses.find((r: any) => r.responder_id.toString() === user._id.toString()),
      });
    } catch (error) {
      next(error);
    }
  }
);


/**
 * @swagger
 * /api/v1/reference-checks/{id}/respond:
 *   post:
 *     summary: Respond to a reference check
 *     tags: [ReferenceCheck]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:id/respond",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { id } = req.params;
      const { rating, comment, is_anonymous } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: { message: "Invalid reference check ID" } });
        return;
      }

      if (!rating || !REFERENCE_RATING_VALUES.includes(rating)) {
        res.status(400).json({
          error: { message: "Valid rating is required (positive, neutral, negative)" },
        });
        return;
      }

      const check = await ReferenceCheck.findById(id);
      if (!check) {
        res.status(404).json({ error: { message: "Reference check not found" } });
        return;
      }

      if (check.status !== "pending") {
        res.status(400).json({ error: { message: "Reference check is not pending" } });
        return;
      }

      // Cannot respond to own request or about yourself
      if (check.requester_id.toString() === user._id.toString()) {
        res.status(400).json({
          error: { message: "Cannot respond to your own reference check" },
        });
        return;
      }

      if (check.target_id.toString() === user._id.toString()) {
        res.status(400).json({
          error: { message: "Cannot respond to reference check about yourself" },
        });
        return;
      }

      // Check if already responded
      const alreadyResponded = check.responses.find(
        (r: any) => r.responder_id.toString() === user._id.toString()
      );

      if (alreadyResponded) {
        res.status(400).json({
          error: { message: "You have already responded to this reference check" },
        });
        return;
      }

      // Add response
      check.responses.push({
        responder_id: user._id,
        rating,
        comment: comment?.trim() || null,
        is_anonymous: is_anonymous === true,
        responded_at: new Date(),
      });

      await check.save();

      // Notify requester about the response
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

      logger.info("Reference check response added", {
        checkId: id,
        responderId: user._id,
      });

      res.json({
        message: "Response added successfully",
        data: check.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/reference-checks/{id}/complete:
 *   post:
 *     summary: Complete a reference check (requester only)
 *     tags: [ReferenceCheck]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:id/complete",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: { message: "Invalid reference check ID" } });
        return;
      }

      const check = await ReferenceCheck.findById(id);
      if (!check) {
        res.status(404).json({ error: { message: "Reference check not found" } });
        return;
      }

      // Must be requester
      if (check.requester_id.toString() !== user._id.toString()) {
        res.status(403).json({
          error: { message: "Only the requester can complete this reference check" },
        });
        return;
      }

      if (check.status !== "pending") {
        res.status(400).json({ error: { message: "Reference check is not pending" } });
        return;
      }

      // Calculate summary and complete
      const summary = {
        total_responses: check.responses.length,
        positive_count: check.responses.filter((r: any) => r.rating === "positive").length,
        neutral_count: check.responses.filter((r: any) => r.rating === "neutral").length,
        negative_count: check.responses.filter((r: any) => r.rating === "negative").length,
      };

      check.summary = summary;
      check.status = "completed";
      check.completed_at = new Date();

      await check.save();

      logger.info("Reference check completed", { checkId: id });

      res.json({
        message: "Reference check completed",
        data: check.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/reference-checks/{id}:
 *   delete:
 *     summary: Cancel/delete a reference check (requester only, pending only)
 *     tags: [ReferenceCheck]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: { message: "Invalid reference check ID" } });
        return;
      }

      const check = await ReferenceCheck.findById(id);
      if (!check) {
        res.status(404).json({ error: { message: "Reference check not found" } });
        return;
      }

      // Must be requester
      if (check.requester_id.toString() !== user._id.toString()) {
        res.status(403).json({
          error: { message: "Only the requester can delete this reference check" },
        });
        return;
      }

      if (check.status !== "pending") {
        res.status(400).json({
          error: { message: "Only pending reference checks can be deleted" },
        });
        return;
      }

      await check.deleteOne();

      logger.info("Reference check deleted", { checkId: id });

      res.json({
        message: "Reference check deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as referenceCheckRoutes };
