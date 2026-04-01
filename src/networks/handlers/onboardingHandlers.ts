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
      user.onboarding.steps.display_name?.confirmed,
      user.onboarding.steps.avatar?.confirmed,
    ].filter(Boolean).length;

    const marketplaceComplete =
      user.marketplace_onboarding?.status === "completed";
    const marketplaceProfile = user.marketplace_onboarding?.steps?.profile;
    const marketplaceLocation = user.marketplace_onboarding?.steps?.location;

    const hasPrefillProfile =
      marketplaceComplete &&
      !!marketplaceProfile?.first_name?.trim() &&
      !!marketplaceProfile?.last_name?.trim();

    const hasPrefillLocation =
      marketplaceComplete &&
      !!marketplaceLocation?.country &&
      !!marketplaceLocation?.region?.trim() &&
      !!marketplaceLocation?.currency?.trim();

    const pre_populated =
      user.onboarding.status !== "completed" &&
      (hasPrefillProfile || hasPrefillLocation)
        ? {
            ...(hasPrefillProfile && {
              first_name: marketplaceProfile?.first_name ?? null,
              last_name: marketplaceProfile?.last_name ?? null,
            }),
            ...(hasPrefillLocation && {
              location: {
                country: marketplaceLocation?.country ?? null,
                region: marketplaceLocation?.region ?? null,
                postal_code: marketplaceLocation?.postal_code ?? null,
                city: marketplaceLocation?.city ?? null,
                line1: marketplaceLocation?.line1 ?? null,
                line2: marketplaceLocation?.line2 ?? null,
                currency: marketplaceLocation?.currency ?? null,
              },
            }),
            source: "marketplace",
          }
        : null;

    const requires =
      user.onboarding.status === "completed"
        ? []
        : [
            ...(hasPrefillProfile ? [] : ["profile"]),
            ...(hasPrefillLocation ? [] : ["location"]),
            "avatar",
          ];

    const totalSteps = 3;
    const progressPercentage = Math.round((stepsCompleted / totalSteps) * 100);

    // Build response
    const response: ApiResponse<any> = {
      data: {
        status: user.onboarding.status,
        completed_at: user.onboarding.completed_at || null,
        steps: {
          location: {
            confirmed: !!(
              user.onboarding.steps.location &&
              Object.keys(user.onboarding.steps.location).length > 0
            ),
          },
          display_name: {
            confirmed: !!user.onboarding.steps.display_name?.confirmed,
          },
          avatar: {
            confirmed: !!user.onboarding.steps.avatar?.confirmed,
          },
        },
        progress: {
          is_finished: user.onboarding.status === "completed",
          percentage: progressPercentage,
          steps_completed: stepsCompleted,
          total_steps: totalSteps,
        },
        ...(user.onboarding.status !== "completed" && {
          requires,
          ...(pre_populated && { pre_populated }),
        }),
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
 * Frontend prepares all data (location, profile, avatar)
 * and backend validates + saves atomically to prevent partial state.
 *
 * Data Persistence:
 * - All fields saved together (atomic transaction)
 * - If any validation fails, entire update is rollback
 * - Timestamps recorded for audit trail
 * - Status changed to "completed" on success only
 * - Payment is NOT collected during onboarding (handled separately by Marketplace)
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

    // Extract payload (payment not accepted for Networks onboarding)
    const { location, profile, avatar } = req.body;

    // Update user fields atomically
    user.first_name = profile.first_name;
    user.last_name = profile.last_name;

    // Auto-generate display_name from first + last name
    user.display_name = `${profile.first_name} ${profile.last_name}`.trim();
    user.networks_display_name = user.display_name;

    user.onboarding.steps.profile = {
      first_name: profile.first_name,
      last_name: profile.last_name,
      confirmed: true,
      updated_at: new Date(),
    };

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
      postal_code: location.postal_code ?? null,
      city: location.city ?? null,
      line1: location.line1 ?? null,
      line2: location.line2 ?? null,
      currency: location.currency ?? null,
      updated_at: new Date(),
    };

    // Keep canonical user.location in sync with onboarding location
    user.location = {
      country: location.country,
      region: location.region,
      postal_code: location.postal_code ?? null,
      city: location.city ?? null,
      line1: location.line1 ?? null,
      line2: location.line2 ?? null,
      currency: location.currency ?? null,
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
      user.networks_avatar = null;
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
      user.networks_avatar = avatar.url;
      // Persist uploaded avatar URL to canonical avatar field used across the app
      user.avatar = avatar.url;
    }

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
