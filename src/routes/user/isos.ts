/**
 * User ISO Routes
 *
 * Current-user ISO endpoints under /api/v1/user/isos
 * ISO/WTB Routes for Current User
 * - Move /api/v1/isos/my → /api/v1/user/isos
 * 
 * Mounted at: /api/v1/user/isos
 */

import { Router, Request, Response, NextFunction } from "express";
import { ISO, ISO_STATUS_VALUES, ISO_URGENCY_VALUES } from "../../models/ISO";
import { User } from "../../models/User";
import { feedService } from "../../services/FeedService";
import logger from "../../utils/logger";
import mongoose from "mongoose";

const router = Router();

const MAX_ACTIVE_ISOS = 10;

/**
 * GET /api/v1/user/isos
 * Get current user's ISOs (replaces /api/v1/isos/my)
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

      const status = req.query.status as string;
      const query: Record<string, any> = { user_id: user._id };

      if (status && status !== "all" && ISO_STATUS_VALUES.includes(status as any)) {
        query.status = status;
      }

      const isos = await ISO.find(query).sort({ createdAt: -1 });

      res.json({
        data: isos.map((iso) => iso.toJSON()),
        total: isos.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/user/isos
 * Create a new ISO for current user
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

      const userId = user._id.toString();

      // Check user's active ISO count
      const activeCount = await ISO.countDocuments({
        user_id: userId,
        status: "active",
      });

      if (activeCount >= MAX_ACTIVE_ISOS) {
        res.status(400).json({
          error: {
            message: `Maximum of ${MAX_ACTIVE_ISOS} active ISOs allowed`,
          },
        });
        return;
      }

      const { title, description, criteria, urgency, is_public, expires_at } =
        req.body;

      if (!title || title.trim().length === 0) {
        res.status(400).json({ error: { message: "Title is required" } });
        return;
      }

      if (urgency && !ISO_URGENCY_VALUES.includes(urgency)) {
        res.status(400).json({ error: { message: "Invalid urgency value" } });
        return;
      }

      const iso = await ISO.create({
        user_id: userId,
        clerk_id: auth.userId,
        title: title.trim(),
        description: description?.trim() || null,
        criteria: criteria || {},
        urgency: urgency || "medium",
        is_public: is_public !== false,
        expires_at: expires_at ? new Date(expires_at) : null,
      });

      if (iso.is_public) {
        try {
          await feedService.addISOActivity(userId, iso._id.toString(), {
            criteria: iso.title,
            urgency: iso.urgency,
          });
        } catch (feedError) {
          logger.warn("Failed to add ISO to activity feed", { feedError });
        }
      }

      logger.info("ISO created via user route", { isoId: iso._id, userId });

      res.status(201).json({
        data: iso.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/user/isos/:id
 * Get specific ISO owned by current user
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
        res.status(400).json({ error: { message: "Invalid ISO ID" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const iso = await ISO.findOne({ _id: id, user_id: user._id });
      if (!iso) {
        res.status(404).json({ error: { message: "ISO not found" } });
        return;
      }

      res.json({
        data: iso.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/user/isos/:id
 * Update ISO owned by current user
 */
router.put(
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
        res.status(400).json({ error: { message: "Invalid ISO ID" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const iso = await ISO.findOne({ _id: id, user_id: user._id });
      if (!iso) {
        res.status(404).json({ error: { message: "ISO not found or not owned by you" } });
        return;
      }

      const { title, description, criteria, urgency, is_public, expires_at, status } =
        req.body;

      if (title !== undefined) iso.title = title.trim();
      if (description !== undefined) iso.description = description?.trim() || null;
      if (criteria !== undefined) iso.criteria = criteria;
      if (urgency !== undefined && ISO_URGENCY_VALUES.includes(urgency)) {
        iso.urgency = urgency;
      }
      if (is_public !== undefined) iso.is_public = is_public;
      if (expires_at !== undefined) {
        (iso as any).expires_at = expires_at ? new Date(expires_at) : null;
      }
      if (status !== undefined && ISO_STATUS_VALUES.includes(status)) {
        iso.status = status;
      }

      await iso.save();

      logger.info("ISO updated via user route", { isoId: iso._id });

      res.json({
        data: iso.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/user/isos/:id
 * Delete ISO owned by current user
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

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: { message: "Invalid ISO ID" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const iso = await ISO.findOne({ _id: id, user_id: user._id });
      if (!iso) {
        res.status(404).json({ error: { message: "ISO not found or not owned by you" } });
        return;
      }

      try {
        await feedService.removeActivity(
          user._id.toString(),
          `iso:${iso._id}`
        );
      } catch (feedError) {
        logger.warn("Failed to remove ISO from activity feed", { feedError });
      }

      await iso.deleteOne();

      logger.info("ISO deleted via user route", { isoId: id });

      res.json({
        success: true,
        message: "ISO deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/user/isos/:id/fulfill
 * Mark ISO as fulfilled
 */
router.post(
  "/:id/fulfill",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: { message: "Invalid ISO ID" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user) {
        res.status(404).json({ error: { message: "User not found" } });
        return;
      }

      const iso = await ISO.findOne({ _id: id, user_id: user._id });
      if (!iso) {
        res.status(404).json({ error: { message: "ISO not found or not owned by you" } });
        return;
      }

      if (iso.status !== "active") {
        res.status(400).json({ error: { message: "ISO is not active" } });
        return;
      }

      iso.status = "fulfilled";
      await iso.save();

      logger.info("ISO marked as fulfilled via user route", { isoId: id });

      res.json({
        data: iso.toJSON(),
        message: "ISO marked as fulfilled",
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as userIsoRoutes };
