/**
 * Reservation Terms Routes
 *
 * CRUD endpoints for versioned reservation/legal terms.
 * Public endpoints for reading current terms, admin endpoints for management.
 *
 * Routes: /api/v1/reservation-terms/*
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ReservationTerms } from "../models/ReservationTerms";
import { User } from "../models/User";
import { requirePlatformAuth } from "../middleware/authentication";
import { validateRequest } from "../middleware/validation";
import logger from "../utils/logger";
import mongoose from "mongoose";

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================
const createTermsSchema = z.object({
  body: z.object({
    version: z
      .string()
      .regex(
        /^\d{4}\.\d{2}\.\d{2}(-\d+)?$/,
        "Version must be in format YYYY.MM.DD or YYYY.MM.DD-N"
      ),
    content: z.string().min(10, "Content must be at least 10 characters"),
    effective_date: z.string().datetime({ message: "Must be a valid ISO date" }),
    set_as_current: z.boolean().default(false),
  }),
});

const getByVersionSchema = z.object({
  params: z.object({
    version: z.string().min(1),
  }),
});

const listTermsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    include_archived: z.coerce.boolean().default(false),
  }),
});

// ============================================================
// Public Routes (no auth required for reading current terms)
// ============================================================

/**
 * @swagger
 * /api/v1/reservation-terms/current:
 *   get:
 *     summary: Get the current active reservation terms
 *     tags: [ReservationTerms]
 *     responses:
 *       200:
 *         description: Current terms retrieved
 *       404:
 *         description: No current terms found
 */
router.get(
  "/current",
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const terms = await ReservationTerms.getCurrent();

      if (!terms) {
        res.status(404).json({ error: { message: "No current terms found" } });
        return;
      }

      res.json({ data: terms.toJSON() });
    } catch (error) {
      logger.error("[ReservationTerms] Failed to get current terms", { error });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/reservation-terms/{version}:
 *   get:
 *     summary: Get reservation terms by version
 *     tags: [ReservationTerms]
 *     parameters:
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Terms retrieved
 *       404:
 *         description: Version not found
 */
router.get(
  "/:version",
  validateRequest(getByVersionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { version } = req.params;
      const terms = await ReservationTerms.getByVersion(version);

      if (!terms) {
        res
          .status(404)
          .json({ error: { message: `Terms version "${version}" not found` } });
        return;
      }

      res.json({ data: terms.toJSON() });
    } catch (error) {
      logger.error("[ReservationTerms] Failed to get terms by version", { error });
      next(error);
    }
  }
);

// ============================================================
// Authenticated Routes
// ============================================================

/**
 * @swagger
 * /api/v1/reservation-terms:
 *   get:
 *     summary: List all reservation terms versions
 *     tags: [ReservationTerms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: include_archived
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Terms list retrieved
 */
router.get(
  "/",
  requirePlatformAuth(),
  validateRequest(listTermsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit, offset, include_archived } = req.query as any;

      const filter: any = {};
      if (!include_archived) {
        filter.is_archived = false;
      }

      const [terms, total] = await Promise.all([
        ReservationTerms.find(filter)
          .sort({ effective_date: -1 })
          .skip(offset)
          .limit(limit)
          .lean(),
        ReservationTerms.countDocuments(filter),
      ]);

      res.json({
        data: terms,
        total,
        limit,
        offset,
      });
    } catch (error) {
      logger.error("[ReservationTerms] Failed to list terms", { error });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/reservation-terms:
 *   post:
 *     summary: Create new reservation terms version (admin only)
 *     tags: [ReservationTerms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - version
 *               - content
 *               - effective_date
 *             properties:
 *               version:
 *                 type: string
 *                 description: "Version in YYYY.MM.DD format"
 *               content:
 *                 type: string
 *                 description: "The full terms text"
 *               effective_date:
 *                 type: string
 *                 format: date-time
 *               set_as_current:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Terms created successfully
 */
router.post(
  "/",
  requirePlatformAuth(),
  validateRequest(createTermsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

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

      // Admin check
      if (!user.isAdmin) {
        res.status(403).json({ error: { message: "Forbidden: Admin access required" } });
        return;
      }

      const { version, content, effective_date, set_as_current } = req.body;

      // If setting as current, unset the previous current terms
      if (set_as_current) {
        await ReservationTerms.updateMany(
          { is_current: true },
          { $set: { is_current: false } },
          { session }
        );
      }

      const [terms] = await ReservationTerms.create(
        [
          {
            version,
            content,
            effective_date: new Date(effective_date),
            created_by: user._id,
            is_current: set_as_current,
            is_archived: false,
          },
        ],
        { session }
      );

      await session.commitTransaction();

      logger.info("[ReservationTerms] New terms created", {
        version,
        isCurrent: set_as_current,
        createdBy: user._id.toString(),
      });

      res.status(201).json({
        data: terms.toJSON(),
        message: set_as_current
          ? "Terms created and set as current"
          : "Terms created successfully",
      });
    } catch (error) {
      await session.abortTransaction();

      if ((error as any)?.code === 11000) {
        res
          .status(409)
          .json({ error: { message: "Terms version already exists" } });
        return;
      }

      logger.error("[ReservationTerms] Failed to create terms", { error });
      next(error);
    } finally {
      session.endSession();
    }
  }
);

/**
 * @swagger
 * /api/v1/reservation-terms/{version}/archive:
 *   post:
 *     summary: Archive a terms version (admin only)
 *     tags: [ReservationTerms]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:version/archive",
  requirePlatformAuth(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user || !user.isAdmin) {
        res.status(403).json({ error: { message: "Forbidden: Admin access required" } });
        return;
      }

      const { version } = req.params;
      const terms = await ReservationTerms.getByVersion(version);

      if (!terms) {
        res
          .status(404)
          .json({ error: { message: `Terms version "${version}" not found` } });
        return;
      }

      if (terms.is_current) {
        res.status(400).json({
          error: {
            message:
              "Cannot archive current terms. Set another version as current first.",
          },
        });
        return;
      }

      terms.is_archived = true;
      await terms.save();

      logger.info("[ReservationTerms] Terms archived", { version });

      res.json({
        data: terms.toJSON(),
        message: "Terms archived successfully",
      });
    } catch (error) {
      logger.error("[ReservationTerms] Failed to archive terms", { error });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/reservation-terms/{version}/set-current:
 *   post:
 *     summary: Set a terms version as the current active version (admin only)
 *     tags: [ReservationTerms]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:version/set-current",
  requirePlatformAuth(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        res.status(401).json({ error: { message: "Unauthorized" } });
        return;
      }

      const user = await User.findOne({ external_id: auth.userId });
      if (!user || !user.isAdmin) {
        res.status(403).json({ error: { message: "Forbidden: Admin access required" } });
        return;
      }

      const { version } = req.params;
      
      // READ INSIDE TRANSACTION to prevent race conditions
      const terms = await ReservationTerms.findOne({ version }, null, { session });

      if (!terms) {
        res
          .status(404)
          .json({ error: { message: `Terms version "${version}" not found` } });
        return;
      }

      if (terms.is_archived) {
        res.status(400).json({
          error: { message: "Cannot set archived terms as current" },
        });
        return;
      }

      // Unset previous current
      await ReservationTerms.updateMany(
        { is_current: true },
        { $set: { is_current: false } },
        { session }
      );

      // Set this as current
      terms.is_current = true;
      await terms.save({ session });

      await session.commitTransaction();

      logger.info("[ReservationTerms] Terms set as current", { version });

      res.json({
        data: terms.toJSON(),
        message: `Version "${version}" is now the current terms`,
      });
    } catch (error) {
      await session.abortTransaction();
      logger.error("[ReservationTerms] Failed to set current terms", { error });
      next(error);
    } finally {
      session.endSession();
    }
  }
);

export { router as reservationTermsRoutes };
