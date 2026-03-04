import { NextFunction, Request, Response } from "express";
import {AppError, ConflictError, DatabaseError} from "../utils/errors";
import {finalizeOnboarding, getOnboardingProgress} from "../utils/user";
import {loadCurrentUser} from "../utils/frequentQueries";
import {
    PatchAcksStepInput,
    PatchAvatarStepInput,
    PatchDisplayNameStepInput,
    PatchLocationStepInput
} from "../validation/schemas";
import {ApiResponse} from "../types";
import { imageService, ImageContext } from "../services/ImageService";
import { ValidationError } from "../utils/errors";

// ----------------------------------------------------------
// Handler Functions
// ----------------------------------------------------------

/**
 * Get onboarding status
 * GET /api/v1/onboarding
 */
export const onboarding_status_get = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = await loadCurrentUser(req);
        const progress = getOnboardingProgress(user);

        const response: ApiResponse<any> = {
            data: {
                status: user.onboarding.status,
                version: user.onboarding.version,
                steps: user.onboarding.steps,
                progress,
            },
            requestId: req.headers['x-request-id'] as string,
        };

        res.json(response);
    } catch (err) {
        next(err);
    }
};

/**
 * Handle location step of onboarding
 * PATCH /api/v1/onboarding/location
 */
export const onboarding_location_patch = async (
    req: Request<{}, {}, PatchLocationStepInput['body']>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = await loadCurrentUser(req);
        if (user.onboarding.status === "completed") {
            throw new ConflictError("Onboarding already completed");
        }

        const { country, postal_code, region, currency } = req.body;

        const now = new Date();
        user.set("onboarding.steps.location", {
            country,
            postal_code,
            region: region ?? null,
            currency: currency ?? null,
            updated_at: now,
        });
        user.set("onboarding.last_step", "location");

        const progress = getOnboardingProgress(user);
        if (progress.is_finished) await finalizeOnboarding(user);
        else await user.save();

        const loc = user.onboarding.steps.location;

        const response: ApiResponse<any> = {
            data: loc,
            _metadata: {
                onboarding: { ...progress }
            },
            requestId: req.headers['x-request-id'] as string,
        };

        res.json(response);
    } catch (err) {
        console.error(err);
        next(err instanceof AppError ? err : new DatabaseError("Failed to save location", err));
    }
};

/**
 * Handle display name step of onboarding
 * PATCH /api/v1/onboarding/display-name
 */
export const onboarding_display_name_patch = async (
    req: Request<{}, {}, PatchDisplayNameStepInput['body']>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = await loadCurrentUser(req);
        if (user.onboarding.status === "completed") {
            throw new ConflictError("Onboarding already completed");
        }

        const inputs = req.body;
        const now = new Date();
        const isCustom = inputs.mode === "custom";

        user.set("onboarding.steps.display_name", {
            user_provided: isCustom,
            value: isCustom ? inputs.value : null,
            confirmed: true,
            updated_at: now,
        });
        user.set("onboarding.last_step", "display_name");

        const progress = getOnboardingProgress(user);
        if (progress.is_finished) await finalizeOnboarding(user);
        else await user.save();

        const response: ApiResponse<any> = {
            data: user.onboarding.steps.display_name,
            _metadata: {
                onboarding: { ...progress },
            },
            requestId: req.headers['x-request-id'] as string,
        };

        res.status(200).json(response);
    } catch (err) {
        next(err instanceof AppError ? err : new DatabaseError("Failed to save display name", err));
    }
};

/**
 * Handle avatar step of onboarding (manual URL setting)
 * PATCH /api/v1/onboarding/avatar
 */
export const onboarding_avatar_patch = async (
    req: Request<{}, {}, PatchAvatarStepInput["body"]>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = await loadCurrentUser(req);
        if (user.onboarding.status === "completed") {
            throw new ConflictError("Onboarding already completed");
        }

        const inputs = req.body;
        const now = new Date();
        const isCustom = inputs.mode === "custom";

        user.set("onboarding.steps.avatar", {
            user_provided: isCustom,
            url: isCustom ? inputs.url : null,
            confirmed: true,
            updated_at: now,
        });
        user.set("onboarding.last_step", "avatar");

        const progress = getOnboardingProgress(user);
        if (progress.is_finished) await finalizeOnboarding(user);
        else await user.save();

        const response: ApiResponse<any> = {
            data: user.onboarding.steps.avatar,
            _metadata: {
                onboarding: { ...progress }
            },
            requestId: req.headers['x-request-id'] as string,
        };

        res.status(200).json(response);
    } catch (err) {
        next(err instanceof AppError ? err : new DatabaseError("Failed to save avatar", err));
    }
};

/**
 * Handle avatar upload step of onboarding
 * POST /api/v1/onboarding/steps/avatar/upload
 */
export const onboarding_avatar_upload_post = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = await loadCurrentUser(req);
        if (user.onboarding.status === "completed") {
            throw new ConflictError("Onboarding already completed");
        }

        if (!req.file) {
            throw new ValidationError("No avatar file provided");
        }

        const now = new Date();
        
        // Upload image using ImageService
        const metadata = await imageService.uploadImage(req.file, {
            context: ImageContext.AVATAR,
            entityId: user._id.toString(),
            generateThumbnail: true, // We could use thumbnails for avatars too
            optimize: true,
            maxWidth: 800,
            maxHeight: 800
        });

        user.set("onboarding.steps.avatar", {
            user_provided: true,
            url: metadata.url,
            confirmed: true,
            updated_at: now,
        });
        user.set("onboarding.last_step", "avatar");

        const progress = getOnboardingProgress(user);
        if (progress.is_finished) await finalizeOnboarding(user);
        else await user.save();

        const response: ApiResponse<any> = {
            data: user.onboarding.steps.avatar,
            _metadata: {
                onboarding: { ...progress }
            },
            requestId: req.headers['x-request-id'] as string,
        };

        res.status(200).json(response);
    } catch (err) {
        next(err instanceof AppError ? err : new DatabaseError("Failed to upload avatar", err));
    }
};

/**
 * Handle acknowledgements step of onboarding
 * PATCH /api/v1/onboarding/acknowledgements
 */
export const onboarding_acknowledgements_patch = async (
    req: Request<{}, {}, PatchAcksStepInput["body"]>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = await loadCurrentUser(req);
        if (user.onboarding.status === "completed") {
            throw new ConflictError("Onboarding already completed");
        }

        const now = new Date();
        // zod guarantees tos/privacy/rules are true and version is present
        user.set("onboarding.steps.acknowledgements", {
            tos: true,
            privacy: true,
            rules: true,
            updated_at: now,
        });
        user.set("onboarding.last_step", "acknowledgements");

        const progress = getOnboardingProgress(user);
        if (progress.is_finished) await finalizeOnboarding(user);
        else await user.save();

        const response: ApiResponse<any> = {
            data: user.onboarding.steps.acknowledgements,
            _metadata: {
                onboarding: { ...progress }
            },
            requestId: req.headers['x-request-id'] as string,
        };

        res.status(200).json(response);
    } catch (err) {
        console.error(err);
        next(err instanceof AppError ? err : new DatabaseError("Failed to save acknowledgements", err));
    }
};

