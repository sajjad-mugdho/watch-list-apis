import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import {
  MissingUserContextError,
  NotFoundError,
  ValidationError,
  AuthorizationError,
} from "../../utils/errors";
import { Appeal } from "../../models/Appeal";
import { User } from "../../models/User";
import mongoose from "mongoose";

/**
 * Create an appeal for a user
 * POST /api/v1/networks/users/:id/appeals
 */
export const networks_user_appeal_create = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id: targetUserId } = req.params;
    const { reason, description, appealType, evidence, relatedOrderId } =
      req.body;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new ValidationError("Invalid user ID");
    }

    if (!reason || reason.trim().length === 0) {
      throw new ValidationError("Appeal reason is required");
    }

    if (!appealType) {
      throw new ValidationError("Appeal type is required");
    }

    const validTypes = [
      "account_suspension",
      "account_restriction",
      "transaction_dispute",
      "other",
    ];
    if (!validTypes.includes(appealType)) {
      throw new ValidationError(
        `Invalid appeal type. Must be one of: ${validTypes.join(", ")}`,
      );
    }

    // Verify target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw new NotFoundError("User not found");

    // User can only create appeals for themselves
    if (String(userId) !== String(targetUserId)) {
      throw new AuthorizationError(
        "You can only create appeals for yourself",
        {},
      );
    }

    // Check if there's already an active appeal
    const existingActive = await Appeal.findOne({
      user_id: targetUserId,
      status: { $in: ["pending", "under_review"] },
    });

    if (existingActive) {
      res.status(400).json({
        error: {
          message:
            "You already have an active appeal. Please wait for it to be resolved before submitting a new one.",
        },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    // Create the appeal
    const appeal = await Appeal.create({
      user_id: new mongoose.Types.ObjectId(targetUserId),
      reason: reason.trim(),
      description: description || "",
      appealType,
      evidence: evidence || [],
      relatedOrderId: relatedOrderId
        ? new mongoose.Types.ObjectId(relatedOrderId)
        : undefined,
      status: "pending",
      submittedAt: new Date(),
      notes: [],
    });

    res.status(201).json({
      data: {
        appeal_id: appeal._id,
        user_id: appeal.user_id,
        reason: appeal.reason,
        appealType: appeal.appealType,
        status: appeal.status,
        submitted_at: appeal.submittedAt,
      },
      requestId: req.headers["x-request-id"] as string,
      message: "Appeal submitted successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get current appeal status for a user
 * GET /api/v1/networks/users/:id/appeal-status
 */
export const networks_user_appeal_status_get = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id: targetUserId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new ValidationError("Invalid user ID");
    }

    // Verify target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw new NotFoundError("User not found");

    // User can only check their own appeal status
    if (String(userId) !== String(targetUserId)) {
      res.status(403).json({
        error: { message: "You can only view your own appeal status" },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    // Get the most recent appeal
    const appeal = (await Appeal.findOne({ user_id: targetUserId })
      .sort({ submittedAt: -1 })
      .lean()) as any;

    if (!appeal) {
      res.json({
        data: null,
        message: "No appeals found",
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    const response = {
      appeal_id: appeal._id,
      user_id: appeal.user_id,
      status: appeal.status,
      appealType: appeal.appealType,
      reason: appeal.reason,
      submitted_at: appeal.submittedAt,
      resolved_at: appeal.resolvedAt || null,
      resolution: appeal.resolution || null,
      notes_count: appeal.notes?.length || 0,
    };

    res.json({
      data: response,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List user appeals (get all appeals or filter by status)
 * GET /api/v1/networks/users/:id/appeals
 */
export const networks_user_appeals_list = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<any>>,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const userId = (req as any).user.dialist_id;
    const { id: targetUserId } = req.params;
    const { status, limit: limitQ = "20", offset: offsetQ = "0" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new ValidationError("Invalid user ID");
    }

    // Verify target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw new NotFoundError("User not found");

    // User can only list their own appeals
    if (String(userId) !== String(targetUserId)) {
      res.status(403).json({
        error: { message: "You can only view your own appeals" },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    const offset = Number(offsetQ);
    const limit = Number(limitQ);

    const query: any = { user_id: targetUserId };
    if (status) {
      query.status = status;
    }

    const appeals = (await Appeal.find(query)
      .sort({ submittedAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()) as any[];

    const data = appeals.map((appeal: any) => ({
      appeal_id: appeal._id,
      status: appeal.status,
      appealType: appeal.appealType,
      reason: appeal.reason,
      submitted_at: appeal.submittedAt,
      resolved_at: appeal.resolvedAt || null,
    }));

    res.json({
      data,
      _metadata: {
        total: data.length,
        offset,
        limit,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};
