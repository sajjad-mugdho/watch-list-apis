/**
 * Networks Offer Routes
 * 
 * API endpoints for managing offers on networks listings.
 * Routes: /api/v1/networks/offers/*
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { offerService } from "../../services";
import { validateRequest } from "../../middleware/validation";
import { User } from "../../models/User";

const router = Router();

// Validation Schemas
const offerIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

const counterOfferSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    amount: z.number().positive(),
    message: z.string().optional(),
  }),
});

const getOffersSchema = z.object({
  query: z.object({
    type: z.enum(["sent", "received"]).optional(),
    status: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  }),
});

/**
 * GET /api/v1/networks/offers
 * Get current user's networks offers (sent or received)
 */
router.get(
  "/",
  validateRequest(getOffersSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { type, limit, offset, status } = req.query as any;
      const role = type === "sent" ? "buyer" : type === "received" ? "seller" : undefined;

      const channels = await (offerService as any).channelRepository?.findForUser(
        user._id.toString(),
        "networks"
      );
      
      let filtered = channels || [];
      if (role === "buyer") filtered = filtered.filter((c: any) => c.buyer_id.toString() === user._id.toString());
      if (role === "seller") filtered = filtered.filter((c: any) => c.seller_id.toString() === user._id.toString());
      if (status && status !== "all") {
        filtered = filtered.filter((c: any) => c.last_offer?.status === status);
      }

      res.json({
        data: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
        platform: "networks",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/networks/offers/:id
 * Get details of a specific networks offer channel
 */
router.get(
  "/:id",
  validateRequest(offerIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { id } = req.params;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const channel = await (offerService as any).channelRepository?.findById(id, "networks");
      if (!channel) {
        res.status(404).json({ error: { message: "Offer not found" } });
        return;
      }

      // Verify membership
      const isMember = channel.buyer_id.toString() === user._id.toString() || 
                       channel.seller_id.toString() === user._id.toString();
      if (!isMember) {
        res.status(403).json({ error: { message: "Not authorized" } });
        return;
      }

      res.json({
        data: channel,
        platform: "networks",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/networks/offers/:id/accept
 * Accept a networks offer
 */
router.post(
  "/:id/accept",
  validateRequest(offerIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { id } = req.params;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const { orderId } = await offerService.acceptOffer(
        id,
        user._id.toString(),
        "networks"
      );

      res.json({
        success: true,
        order_id: orderId,
        message: "Offer accepted",
        platform: "networks",
      });
    } catch (error) {
      if (error instanceof Error && (error.message.includes("No active offer") || error.message.includes("is no longer available"))) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/networks/offers/:id/reject
 */
router.post(
  "/:id/reject",
  validateRequest(offerIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { id } = req.params;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      await offerService.rejectOffer(
        id,
        user._id.toString(),
        "networks"
      );

      res.json({
        success: true,
        message: "Offer rejected",
        platform: "networks",
      });
    } catch (error) {
       if (error instanceof Error && error.message.includes("No active offer")) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/networks/offers/:id/counter
 */
router.post(
  "/:id/counter",
  validateRequest(counterOfferSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      const { id } = req.params;
      const { amount, message: text } = req.body;

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const offer = await offerService.counterOffer({
        channelId: id,
        senderId: user._id.toString(),
        amount,
        message: text,
        platform: "networks",
      });

      res.status(201).json({
        data: offer,
        message: "Counter offer sent",
        platform: "networks",
      });
    } catch (error) {
      if (error instanceof Error && (error.message.includes("must not exceed") || error.message.includes("must not be below"))) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  }
);

export { router as networksOfferRoutes };
