/**
 * Admin Trust Case Routes
 *
 * Admin-only endpoints for managing Trust & Safety cases.
 * All routes require authentication (admin role check in handlers).
 *
 * Routes: /api/v1/admin/trust-cases/*
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { trustCaseService } from "../../services/trustCase/trustCaseService";
import { User } from "../../models/User";
import { validateRequest } from "../../middleware/validation";
import logger from "../../utils/logger";
import mongoose from "mongoose";

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================
const createCaseSchema = z.object({
  body: z.object({
    reported_user_id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId"),
    order_id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    reference_check_id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    category: z.enum(["fraud", "dispute", "safety", "abuse", "other"]),
    priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    reason: z.string().min(5, "Reason must be at least 5 characters"),
  }),
});

const listCasesSchema = z.object({
  query: z.object({
    status: z
      .enum(["OPEN", "INVESTIGATING", "ESCALATED", "RESOLVED", "CLOSED"])
      .optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    category: z.enum(["fraud", "dispute", "safety", "abuse", "other"]).optional(),
    assigned_to: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  }),
});

const addNoteSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid case ID"),
  }),
  body: z.object({
    content: z.string().min(1).max(5000),
  }),
});

const assignCaseSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid case ID"),
  }),
  body: z.object({
    assignee_id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid assignee ID"),
  }),
});

const escalateCaseSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid case ID"),
  }),
  body: z.object({
    escalate_to_id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user ID"),
    reason: z.string().min(5),
  }),
});

const resolveCaseSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid case ID"),
  }),
  body: z.object({
    resolution: z.string().min(5),
  }),
});

const suspendUserSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid case ID"),
  }),
  body: z.object({
    user_id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user ID"),
    duration_days: z.number().int().min(1).max(365),
    reason: z.string().min(5),
  }),
});

// ============================================================
// Helper: Get admin user from auth
// ============================================================
async function getAdminUser(req: Request, res: Response): Promise<any | null> {
  const auth = (req as any).auth;
  if (!auth?.userId) {
    res.status(401).json({ error: { message: "Unauthorized" } });
    return null;
  }

  const user = await User.findOne({ external_id: auth.userId });
  if (!user) {
    res.status(404).json({ error: { message: "User not found" } });
    return null;
  }

  // TODO: Add proper admin role check when RBAC is implemented
  // For now, all authenticated users with platform auth can access
  return user;
}

// ============================================================
// Routes
// ============================================================

/**
 * @swagger
 * /api/v1/admin/trust-cases:
 *   get:
 *     summary: List trust cases with filters
 *     tags: [TrustCases]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/",
  validateRequest(listCasesSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await getAdminUser(req, res);
      if (!user) return;

      const { status, priority, category, assigned_to, limit, offset } =
        req.query as any;

      const result = await trustCaseService.listCases({
        status,
        priority,
        category,
        assignedTo: assigned_to,
        limit,
        offset,
      });

      res.json({
        data: result.cases,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      logger.error("[TrustCaseRoutes] Failed to list cases", { error });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/trust-cases:
 *   post:
 *     summary: Create a new trust case
 *     tags: [TrustCases]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/",
  validateRequest(createCaseSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await getAdminUser(req, res);
      if (!user) return;

      const {
        reported_user_id,
        order_id,
        reference_check_id,
        category,
        priority,
        reason,
      } = req.body;

      const trustCase = await trustCaseService.createCase({
        reporterUserId: user._id.toString(),
        reportedUserId: reported_user_id,
        orderId: order_id,
        referenceCheckId: reference_check_id,
        category,
        priority,
        reason,
      });

      res.status(201).json({
        data: trustCase.toJSON(),
        message: `Trust case ${trustCase.case_number} created`,
      });
    } catch (error) {
      logger.error("[TrustCaseRoutes] Failed to create case", { error });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/trust-cases/{id}:
 *   get:
 *     summary: Get a specific trust case
 *     tags: [TrustCases]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await getAdminUser(req, res);
      if (!user) return;

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: { message: "Invalid case ID" } });
        return;
      }

      const trustCase = await trustCaseService.getCaseById(id);
      if (!trustCase) {
        res.status(404).json({ error: { message: "Trust case not found" } });
        return;
      }

      res.json({ data: trustCase.toJSON() });
    } catch (error) {
      logger.error("[TrustCaseRoutes] Failed to get case", { error });
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/trust-cases/{id}/assign:
 *   put:
 *     summary: Assign a case to an admin
 *     tags: [TrustCases]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id/assign",
  validateRequest(assignCaseSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await getAdminUser(req, res);
      if (!user) return;

      const { id } = req.params;
      const { assignee_id } = req.body;

      const trustCase = await trustCaseService.assignCase(
        id,
        assignee_id,
        user._id.toString()
      );

      res.json({
        data: trustCase.toJSON(),
        message: "Case assigned successfully",
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/trust-cases/{id}/note:
 *   post:
 *     summary: Add a note to a case
 *     tags: [TrustCases]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:id/note",
  validateRequest(addNoteSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await getAdminUser(req, res);
      if (!user) return;

      const { id } = req.params;
      const { content } = req.body;

      const trustCase = await trustCaseService.addNote({
        caseId: id,
        authorId: user._id.toString(),
        content,
      });

      res.json({
        data: trustCase.toJSON(),
        message: "Note added successfully",
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/trust-cases/{id}/escalate:
 *   put:
 *     summary: Escalate a case
 *     tags: [TrustCases]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id/escalate",
  validateRequest(escalateCaseSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await getAdminUser(req, res);
      if (!user) return;

      const { id } = req.params;
      const { escalate_to_id, reason } = req.body;

      const trustCase = await trustCaseService.escalateCase(
        id,
        escalate_to_id,
        user._id.toString(),
        reason
      );

      res.json({
        data: trustCase.toJSON(),
        message: "Case escalated successfully",
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/trust-cases/{id}/resolve:
 *   put:
 *     summary: Resolve a case
 *     tags: [TrustCases]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id/resolve",
  validateRequest(resolveCaseSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await getAdminUser(req, res);
      if (!user) return;

      const { id } = req.params;
      const { resolution } = req.body;

      const trustCase = await trustCaseService.resolveCase({
        caseId: id,
        resolvedById: user._id.toString(),
        resolution,
      });

      res.json({
        data: trustCase.toJSON(),
        message: "Case resolved successfully",
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/trust-cases/{id}/close:
 *   put:
 *     summary: Close a resolved case
 *     tags: [TrustCases]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id/close",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await getAdminUser(req, res);
      if (!user) return;

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: { message: "Invalid case ID" } });
        return;
      }

      const trustCase = await trustCaseService.closeCase(
        id,
        user._id.toString()
      );

      res.json({
        data: trustCase.toJSON(),
        message: "Case closed successfully",
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/trust-cases/{id}/suspend-user:
 *   post:
 *     summary: Suspend a user as part of a trust case
 *     tags: [TrustCases]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:id/suspend-user",
  validateRequest(suspendUserSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await getAdminUser(req, res);
      if (!user) return;

      const { id } = req.params;
      const { user_id, duration_days, reason } = req.body;

      const trustCase = await trustCaseService.suspendUser({
        caseId: id,
        userId: user_id,
        durationDays: duration_days,
        reason,
        suspendedById: user._id.toString(),
      });

      res.json({
        data: trustCase.toJSON(),
        message: `User suspended for ${duration_days} days`,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: { message: error.message } });
        return;
      }
      next(error);
    }
  }
);

export { router as trustCaseRoutes };
