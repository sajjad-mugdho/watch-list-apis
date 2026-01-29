/**
 * ISO Routes
 *
 * Endpoints for ISO (In Search Of) operations:
 * - Create ISO
 * - Update ISO
 * - Get ISOs
 * - Delete ISO
 *
 * Note: All routes are protected by requirePlatformAuth() at the router level
 */

import { Router, Request, Response, NextFunction } from "express";
import { ISO } from "../models/ISO";
import { feedService } from "../services/FeedService";
import logger from "../utils/logger";
import { attachUser, getUserId, getUser } from "../middleware/attachUser";
import { validateRequest } from "../middleware/validation";
import {
  createISOSchema,
  updateISOSchema,
  getISOsSchema,
  getMyISOsSchema,
  fulfillISOSchema,
  deleteISOSchema,
  getISOBIDSchema,
} from "../validation/schemas/index";

const router = Router();

// Maximum active ISOs per user
const MAX_ACTIVE_ISOS = 10;

/**
 * @swagger
 * /api/v1/isos:
 *   post:
 *     summary: Create a new ISO
 */
router.post(
  "/",
  validateRequest(createISOSchema),
  attachUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getUser(req);
      const userId = getUserId(req);

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

      const iso = await ISO.create({
        user_id: userId,
        clerk_id: user.external_id,
        title: title.trim(),
        description: description?.trim() || null,
        criteria: criteria || {},
        urgency: urgency || "medium",
        is_public: is_public !== false,
        expires_at: expires_at ? new Date(expires_at) : null,
      });

      // Add to activity feed if public
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

      logger.info("ISO created", { isoId: iso._id, userId });

      res.status(201).json({
        data: iso.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/isos:
 *   get:
 *     summary: Get public ISOs
 */
router.get(
  "/",
  validateRequest(getISOsSchema),
  attachUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const offset = Number(req.query.offset) || 0;

      const isos = await ISO.getPublicActive(limit, offset);
      const total = await ISO.countDocuments({
        status: "active",
        is_public: true,
        $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
      });

      res.json({
        data: isos.map((iso) => iso.toJSON()),
        total,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/isos/my:
 *   get:
 *     summary: Get current user's ISOs
 */
router.get(
  "/my",
  validateRequest(getMyISOsSchema),
  attachUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const status = req.query.status as string;
      const query: Record<string, any> = { user_id: userId };

      if (status && status !== "all") {
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
 * @swagger
 * /api/v1/isos/{id}:
 *   get:
 *     summary: Get ISO by ID
 */
router.get(
  "/:id",
  validateRequest(getISOBIDSchema),
  attachUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const iso = await ISO.findById(id);
      if (!iso) {
        res.status(404).json({ error: { message: "ISO not found" } });
        return;
      }

      // Check access - must be public or owned by user
      if (
        !iso.is_public &&
        iso.user_id.toString() !== userId
      ) {
        res.status(403).json({ error: { message: "Access denied" } });
        return;
      }

      res.json({
        data: iso.toJSON(),
        is_owner: iso.user_id.toString() === userId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/isos/{id}:
 *   put:
 *     summary: Update an ISO
 */
router.put(
  "/:id",
  validateRequest(updateISOSchema),
  attachUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const iso = await ISO.findById(id);
      if (!iso) {
        res.status(404).json({ error: { message: "ISO not found" } });
        return;
      }

      // Must own the ISO
      if (iso.user_id.toString() !== userId) {
        res.status(403).json({ error: { message: "Not authorized to update this ISO" } });
        return;
      }

      const { title, description, criteria, urgency, is_public, expires_at, status } =
        req.body;

      // Update fields
      if (title !== undefined) iso.title = title.trim();
      if (description !== undefined) iso.description = description?.trim() || null;
      if (criteria !== undefined) iso.criteria = criteria;
      if (urgency !== undefined) iso.urgency = urgency;
      if (is_public !== undefined) iso.is_public = is_public;
      if (expires_at !== undefined) {
        (iso as any).expires_at = expires_at ? new Date(expires_at) : null;
      }
      if (status !== undefined) {
        iso.status = status;
      }

      await iso.save();

      logger.info("ISO updated", { isoId: iso._id });

      res.json({
        data: iso.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/isos/{id}:
 *   delete:
 *     summary: Delete an ISO
 */
router.delete(
  "/:id",
  validateRequest(deleteISOSchema),
  attachUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const iso = await ISO.findById(id);
      if (!iso) {
        res.status(404).json({ error: { message: "ISO not found" } });
        return;
      }

      // Must own the ISO
      if (iso.user_id.toString() !== userId) {
        res.status(403).json({ error: { message: "Not authorized to delete this ISO" } });
        return;
      }

      // Remove from activity feed
      try {
        await feedService.removeActivity(
          userId,
          `iso:${iso._id}`
        );
      } catch (feedError) {
        logger.warn("Failed to remove ISO from activity feed", { feedError });
      }

      await iso.deleteOne();

      logger.info("ISO deleted", { isoId: id });

      res.json({
        message: "ISO deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/isos/{id}/fulfill:
 *   post:
 *     summary: Mark ISO as fulfilled
 */
router.post(
  "/:id/fulfill",
  validateRequest(fulfillISOSchema),
  attachUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const iso = await ISO.findById(id);
      if (!iso) {
        res.status(404).json({ error: { message: "ISO not found" } });
        return;
      }

      // Must own the ISO
      if (iso.user_id.toString() !== userId) {
        res.status(403).json({ error: { message: "Not authorized" } });
        return;
      }

      if (iso.status !== "active") {
        res.status(400).json({ error: { message: "ISO is not active" } });
        return;
      }

      iso.status = "fulfilled";
      await iso.save();

      logger.info("ISO marked as fulfilled", { isoId: id });

      res.json({
        data: iso.toJSON(),
        message: "ISO marked as fulfilled",
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as isoRoutes };
