// src/networks/handlers/SocialInviteHandlers.ts
import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../types";
import {
  MissingUserContextError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors";
import SocialInvite from "../../models/SocialInvite";

import crypto from "crypto";

/**
 * Create a social invite link
 * POST /api/v1/networks/social/invites
 */
export const social_invite_create = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user) throw new MissingUserContextError();
    const inviterId = (req as any).user.dialist_id;
    const { target_email } = req.body;

    // Generate a secure unique token
    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invite = await SocialInvite.create({
      inviter_id: inviterId,
      token,
      target_email,
      expiresAt,
    });

    res.status(201).json({
      data: {
        token: invite.token,
        expiresAt: invite.expiresAt,
        inviteUrl: `https://networks.dialist.com/invite/${invite.token}`,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Consume/Validate an invite token
 * GET /api/v1/networks/social/invites/:token
 */
export const social_invite_get = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.params;

    const invite = await SocialInvite.findOne({ token, status: "pending" })
      .populate("inviter_id", "display_name avatar");

    if (!invite) throw new NotFoundError("Invite not found or already used");

    if (invite.expiresAt < new Date()) {
      invite.status = "expired";
      await invite.save();
      throw new ValidationError("Invite has expired");
    }

    res.json({
      data: invite,
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (err) {
    next(err);
  }
};
