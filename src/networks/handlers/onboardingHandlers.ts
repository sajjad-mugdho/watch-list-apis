import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import {
  AppError,
  ConflictError,
  DatabaseError,
  MissingUserContextError,
  ValidationError,
} from "../../utils/errors";
import { ApiResponse } from "../../types";
import { User } from "../../models/User";
import { CompleteOnboardingInput } from "../../validation/schemas";
import logger from "../../utils/logger";

// ----------------------------------------------------------
// Handler Functions
// ----------------------------------------------------------

/**
 * Get network onboarding status
 * GET /api/v1/networks/onboarding/status
 *
 * Returns the current onboarding status for an authenticated user.
 * Useful for checking on app launch whether to show onboarding flow
 * or skip directly to home screen.
 */
export const networks_onboarding_status_get = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const dialist_id = req.user?.dialist_id;
    if (!dialist_id) {
      throw new MissingUserContextError({ route: req.path });
    }

    // Load user document
    const user = await User.findById(dialist_id);
    if (!user) {
      throw new ValidationError("User not found");
    }

    // Count completed steps
    const stepsCompleted = [
      user.onboarding.steps.location &&
        Object.keys(user.onboarding.steps.location).length > 0,
      user.onboarding.steps.avatar &&
        Object.keys(user.onboarding.steps.avatar).length > 0,
      user.onboarding.steps.acknowledgements &&
        Object.keys(user.onboarding.steps.acknowledgements).length > 0,
    ].filter(Boolean).length;

    const totalSteps = 3;
    const progressPercentage = Math.round((stepsCompleted / totalSteps) * 100);

    // Build response
    const response: ApiResponse<any> = {
      data: {
        status: user.onboarding.status,
        completed_at: user.onboarding.completed_at || null,
        steps: {
          location: user.onboarding.steps.location
            ? { confirmed: true }
            : { confirmed: false },
          avatar: user.onboarding.steps.avatar
            ? { confirmed: true }
            : { confirmed: false },
          acknowledgements: user.onboarding.steps.acknowledgements
            ? { confirmed: true }
            : { confirmed: false },
          payment: user.onboarding.steps.payment
            ? { confirmed: true }
            : { confirmed: false },
        },
        progress: {
          is_finished: user.onboarding.status === "completed",
          percentage: progressPercentage,
          steps_completed: stepsCompleted,
          total_steps: totalSteps,
        },
        user: {
          user_id: user._id,
          dialist_id: user.dialist_id,
          first_name: user.first_name,
          last_name: user.last_name,
          display_name: user.display_name,
        },
      },
      _metadata: {
        message: "Onboarding status retrieved successfully",
        timestamp: new Date(),
      },
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error("Error retrieving onboarding status", { error });
    next(
      error instanceof AppError
        ? error
        : new DatabaseError("Failed to retrieve onboarding status", error),
    );
  }
};

/**
 * Complete network onboarding atomically
 * PATCH /api/v1/networks/onboarding/complete
 *
 * Receives complete onboarding payload and saves all fields in a single transaction.
 * Frontend prepares all data (location, profile, avatar, payment, acknowledgements)
 * and backend validates + saves atomically to prevent partial state.
 *
 * Data Persistence:
 * - All fields saved together (atomic transaction)
 * - If any validation fails, entire update is rollback
 * - Payment token is stored securely (never raw card data)
 * - Timestamps recorded for audit trail
 * - Status changed to "completed" on success only
 */
export const networks_onboarding_complete_patch = async (
  req: Request<{}, {}, CompleteOnboardingInput["body"]>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  let session: mongoose.ClientSession | null = null;

  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const dialist_id = req.user?.dialist_id;
    if (!dialist_id) {
      throw new MissingUserContextError({ route: req.path });
    }

    // Load user within transaction
    const user = await User.findById(dialist_id).session(session);
    if (!user) {
      throw new ValidationError("User not found");
    }

    // Guard: prevent re-completion
    if (user.onboarding.status === "completed") {
      throw new ConflictError("Onboarding already completed");
    }

    // Extract payload
    const { location, profile, avatar, acknowledgements, payment } = req.body;

    // Update user fields atomically
    user.first_name = profile.first_name;
    user.last_name = profile.last_name;

    // Auto-generate display_name from first + last name
    user.display_name = `${profile.first_name} ${profile.last_name}`.trim();

    // Update display_name step so onboarding progress reflects completion
    user.onboarding.steps.display_name = {
      value: user.display_name,
      confirmed: true,
      user_provided: true,
      updated_at: new Date(),
    };

    // Update location
    user.onboarding.steps.location = {
      country: location.country,
      region: location.region,
      postal_code: location.postal_code,
      city: location.city,
      line1: location.line1,
      line2: location.line2 || null,
      currency: location.currency || null,
      updated_at: new Date(),
    };

    // Keep canonical user.location in sync with onboarding location
    user.location = {
      country: location.country,
      region: location.region,
      postal_code: location.postal_code,
      city: location.city,
      line1: location.line1,
      line2: location.line2 || null,
      currency: location.currency || null,
    };

    // Update avatar
    if (avatar.type === "monogram") {
      const avatarUpdatedAt = new Date();
      user.onboarding.steps.avatar = {
        type: "monogram",
        monogram_initials: avatar.monogram_initials,
        monogram_color: avatar.monogram_color,
        monogram_style: avatar.monogram_style,
        confirmed: true,
        user_provided: true,
        updated_at: avatarUpdatedAt,
      };
      // For monogram avatars, generate display_avatar URL dynamically
      // (avatar string field is used for display, but monograms are generated client/server-side)
    } else if (avatar.type === "upload") {
      const avatarUpdatedAt = new Date();
      user.onboarding.steps.avatar = {
        type: "upload",
        url: avatar.url,
        confirmed: true,
        user_provided: true,
        updated_at: avatarUpdatedAt,
      };
      // Persist uploaded avatar URL to canonical avatar field used across the app
      user.avatar = avatar.url;
    }

    // Update payment (if provided)
    if (payment) {
      if (payment.payment_method === "card") {
        user.onboarding.steps.payment = {
          payment_method: "card",
          last_four: payment.last_four,
          status: "pending_verification",
          updated_at: new Date(),
          // NOTE: card_token is NOT stored - it's passed only for backend to verify/process
          // Backend should forward to payment processor (Stripe/Finix) in separate transaction
        };
      } else if (payment.payment_method === "bank_account") {
        user.onboarding.steps.payment = {
          payment_method: "bank_account",
          last_four: payment.last_four,
          status: "pending_verification",
          updated_at: new Date(),
          // NOTE: bank_account_token is NOT stored
        };
      }
    }

    // Update acknowledgements
    user.onboarding.steps.acknowledgements = {
      tos: acknowledgements.tos,
      privacy: acknowledgements.privacy,
      rules: acknowledgements.rules,
      updated_at: new Date(),
    };

    // Keep canonical legal acknowledgements in sync
    user.legal_acks = {
      tos_ack: acknowledgements.tos,
      privacy_ack: acknowledgements.privacy,
      rules_ack: acknowledgements.rules,
    };

    // Mark onboarding as completed
    user.onboarding.status = "completed";
    user.onboarding.completed_at = new Date();
    user.onboarding.last_step = "complete";
    user.onboarding.version = "2.0"; // Atomic flow version

    // Save within transaction
    await user.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Return success response with complete onboarding data
    const response: ApiResponse<any> = {
      data: {
        user: {
          user_id: user._id,
          dialist_id: user.dialist_id,
          first_name: user.first_name,
          last_name: user.last_name,
          display_name: user.display_name,
        },
        onboarding: {
          status: user.onboarding.status,
          completed_at: user.onboarding.completed_at,
          steps: {
            location: {
              country: user.onboarding.steps.location?.country || null,
              region: user.onboarding.steps.location?.region || null,
              postal_code: user.onboarding.steps.location?.postal_code || null,
              city: user.onboarding.steps.location?.city || null,
              line1: user.onboarding.steps.location?.line1 || null,
              line2: user.onboarding.steps.location?.line2 || null,
              currency: user.onboarding.steps.location?.currency || null,
            },
            avatar: {
              type: user.onboarding.steps.avatar?.type || "monogram",
              ...(user.onboarding.steps.avatar?.type === "monogram" && {
                monogram_initials:
                  user.onboarding.steps.avatar?.monogram_initials || null,
                monogram_color:
                  user.onboarding.steps.avatar?.monogram_color || null,
                monogram_style:
                  user.onboarding.steps.avatar?.monogram_style || null,
              }),
              ...(user.onboarding.steps.avatar?.type === "upload" && {
                url: user.onboarding.steps.avatar?.url || null,
              }),
            },
            payment: user.onboarding.steps.payment?.payment_method
              ? {
                  payment_method: user.onboarding.steps.payment.payment_method,
                  last_four: user.onboarding.steps.payment.last_four ?? null,
                  status: user.onboarding.steps.payment.status ?? null,
                }
              : null,
            acknowledgements: {
              tos: user.onboarding.steps.acknowledgements?.tos || false,
              privacy: user.onboarding.steps.acknowledgements?.privacy || false,
              rules: user.onboarding.steps.acknowledgements?.rules || false,
            },
          },
        },
      },
      _metadata: {
        message: "Onboarding completed successfully",
        timestamp: new Date(),
      },
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(200).json(response);
  } catch (error) {
    // Rollback transaction on any error
    if (session && session.inTransaction()) {
      await session.abortTransaction();
    }

    // Log error and delegate to error handler
    logger.error("Error completing network onboarding", { error });
    next(
      error instanceof AppError
        ? error
        : new DatabaseError("Failed to complete onboarding", error),
    );
  } finally {
    await session?.endSession();
  }
};
