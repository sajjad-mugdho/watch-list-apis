import { NextFunction, Request, Response } from "express";
import {
  createOnboardingForm,
  createFormLink,
  CreateOnboardingFormParams,
} from "../utils/finix";
import { User } from "../models/User";
import { MerchantOnboarding } from "../models/MerchantOnboarding";
import { ApiResponse } from "../types";
import {
  DatabaseError,
  MissingUserContextError,
  ValidationError,
} from "../utils/errors";
import { merchantLogger } from "../utils/logger";
import { getCountryName } from "../utils/location";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export interface MerchantOnboardResponse {
  onboarding_url: string;
  form_id: string;
  expires_at: string;
  existing_form?: boolean;
}

// ----------------------------------------------------------
// Handler Functions
// ----------------------------------------------------------

/**
 * Create Finix merchant onboarding session
 * POST /api/v1/marketplace/merchant/onboard
 */
export const marketplace_merchant_onboard_post = async (
  req: Request,
  res: Response<ApiResponse<MerchantOnboardResponse>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new MissingUserContextError({ route: req.path });
    }

    const user = await User.findById(req.user.dialist_id).select(
      [
        "merchant",
        "onboarding",
        "first_name",
        "last_name",
        "display_name",
        "email",
        "phone",
      ].join(" ")
    );

    if (!user) {
      throw new ValidationError("User not found");
    }

    // ✅ Validate platform onboarding is complete
    if (user.onboarding.status !== "completed") {
      throw new ValidationError(
        "Please complete platform onboarding before merchant registration"
      );
    }

    // ✅ Validate location is set
    const userLocation = user.onboarding.steps?.location?.country;
    if (!userLocation) {
      throw new ValidationError(
        "User location is required for merchant onboarding. Please complete platform onboarding."
      );
    }

    // ✅ Check if user already has merchant onboarding record
    const existingOnboarding = await MerchantOnboarding.findOne({
      dialist_user_id: user._id,
    });

    if (existingOnboarding) {
      merchantLogger.info(`User already has onboarding record`, {
        user_id: user._id.toString(),
        form_id: existingOnboarding.form_id,
        onboarding_state: existingOnboarding.onboarding_state,
        requestId: req.headers["x-request-id"],
      });

      // Check if existing link is still valid
      const linkExpired = existingOnboarding.last_form_link_expires_at
        ? new Date() > existingOnboarding.last_form_link_expires_at
        : true;

      if (linkExpired) {
        merchantLogger.info(`Creating new link for existing form`, {
          user_id: user._id.toString(),
          form_id: existingOnboarding.form_id,
          requestId: req.headers["x-request-id"],
        });

        const { idempotency_id: refreshId } = req.body as any;
        const { form_link, expires_at } = await createFormLink(
          existingOnboarding.form_id,
          undefined,
          refreshId
        );

        existingOnboarding.last_form_link = form_link;
        existingOnboarding.last_form_link_expires_at = new Date(expires_at);
        await existingOnboarding.save();

        res.json({
          data: {
            onboarding_url: form_link,
            form_id: existingOnboarding.form_id,
            expires_at,
            existing_form: true,
          },
          requestId: req.headers["x-request-id"] as string,
        });
        return;
      } else {
        // Link still valid, return it
        res.json({
          data: {
            onboarding_url: existingOnboarding.last_form_link!,
            form_id: existingOnboarding.form_id,
            expires_at:
              existingOnboarding.last_form_link_expires_at!.toISOString(),
            existing_form: true,
          },
          requestId: req.headers["x-request-id"] as string,
        });
        return;
      }
    }

    // ✅ Create new onboarding form (first time)
    merchantLogger.info(`Creating new onboarding form for user`, {
      user_id: user._id.toString(),
      user_location: userLocation,
      requestId: req.headers["x-request-id"],
    });

    const requestBusinessName = req.body?.business_name as string | undefined;
    const onboardingLocation = user.onboarding.steps?.location;
    const businessInfo = user.onboarding.steps?.business_info;
    const personalInfo = user.onboarding.steps?.personal_info;

    const onboardingParams: CreateOnboardingFormParams = {
      dialist_user_id: user._id.toString(),
      user_location: userLocation as "US" | "CA",
    };

    if (user.first_name) onboardingParams.first_name = user.first_name;
    if (user.last_name) onboardingParams.last_name = user.last_name;

    if (requestBusinessName) {
      onboardingParams.business_name = requestBusinessName;
    } else if (businessInfo?.business_name) {
      onboardingParams.business_name = businessInfo.business_name;
    } else if (user.display_name) {
      onboardingParams.business_name = user.display_name;
    }

    if (user.email) onboardingParams.email = user.email;
    if (user.phone) onboardingParams.phone = user.phone;

    if (businessInfo) {
      if (businessInfo.business_phone)
        onboardingParams.business_phone = businessInfo.business_phone;
      if (businessInfo.website) onboardingParams.website = businessInfo.website;
      if (businessInfo.business_type)
        onboardingParams.business_type = businessInfo.business_type;
    }

    if (personalInfo) {
      if (personalInfo.title) onboardingParams.title = personalInfo.title;
      if (personalInfo.date_of_birth) {
        const dob: { year?: number; month?: number; day?: number } = {};
        if (personalInfo.date_of_birth.year)
          dob.year = personalInfo.date_of_birth.year;
        if (personalInfo.date_of_birth.month)
          dob.month = personalInfo.date_of_birth.month;
        if (personalInfo.date_of_birth.day)
          dob.day = personalInfo.date_of_birth.day;

        if (Object.keys(dob).length > 0) {
          onboardingParams.date_of_birth = dob;
        }
      }
    }

    if (onboardingLocation) {
      if (onboardingLocation.country) {
        onboardingParams.country = getCountryName(onboardingLocation.country);
      }
      if (onboardingLocation.region)
        onboardingParams.region = onboardingLocation.region;
      if (onboardingLocation.postal_code)
        onboardingParams.postal_code = onboardingLocation.postal_code;
      if (onboardingLocation.city)
        onboardingParams.city = onboardingLocation.city;
      if (onboardingLocation.line1)
        onboardingParams.line1 = onboardingLocation.line1;
      if (onboardingLocation.line2)
        onboardingParams.line2 = onboardingLocation.line2;
    }
    const { idempotency_id: onboardIdempotency } = req.body as any;
    if (onboardIdempotency)
      onboardingParams.idempotencyKey = onboardIdempotency;
    const { form_id, form_link, expires_at } = await createOnboardingForm(
      onboardingParams
    );

    merchantLogger.info(`Creating MerchantOnboarding record`, {
      user_id: user._id.toString(),
      form_id,
      requestId: req.headers["x-request-id"],
    });

    // Create MerchantOnboarding record
    const merchantOnboarding = await MerchantOnboarding.create({
      dialist_user_id: user._id,
      form_id,
      last_form_link: form_link,
      last_form_link_expires_at: new Date(expires_at),
      onboarding_state: "PENDING",
    });

    merchantLogger.info(`✅ Created MerchantOnboarding record`, {
      user_id: user._id.toString(),
      form_id,
      merchant_onboarding_id: merchantOnboarding._id.toString(),
      requestId: req.headers["x-request-id"],
    });

    res.status(201).json({
      data: {
        onboarding_url: form_link,
        form_id,
        expires_at,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (error: any) {
    if (
      error instanceof ValidationError ||
      error instanceof MissingUserContextError
    ) {
      return next(error);
    }

    // Log detailed error for debugging
    console.error("❌ DETAILED ERROR:", {
      message: error.message,
      name: error.name,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue,
      errors: error.errors,
      stack: error.stack,
    });

    merchantLogger.error(`Merchant onboard error`, {
      user_id: req.user?.dialist_id,
      error: error.message,
      errorName: error.name,
      errorCode: error.code,
      errorDetails: error,
      stack: error.stack,
      requestId: req.headers["x-request-id"],
    });
    next(
      new DatabaseError("Failed to create merchant onboarding session", error)
    );
  }
};

/**
 * Get current user's merchant status
 * GET /api/v1/marketplace/merchant/status
 */
export const marketplace_merchant_status_get = async (
  req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new MissingUserContextError({ route: req.path });
    }

    const merchantOnboarding = await MerchantOnboarding.findOne({
      dialist_user_id: req.user.dialist_id,
    });

    if (!merchantOnboarding) {
      res.json({
        data: {
          is_merchant: false,
          status: "NOT_STARTED",
          identity_id: null,
          merchant_id: null,
          form_id: null,
          onboarding_state: null,
          verification_state: null,
          onboarded_at: null,
          verified_at: null,
        },
        requestId: req.headers["x-request-id"] as string,
      });
      return;
    }

    // ✅ Return correct fields from MerchantOnboarding collection
    res.json({
      data: {
        is_merchant: merchantOnboarding.onboarding_state === "APPROVED",
        status: merchantOnboarding.onboarding_state,
        identity_id: merchantOnboarding.identity_id || null,
        merchant_id: merchantOnboarding.merchant_id || null,
        form_id: merchantOnboarding.form_id,
        onboarding_state: merchantOnboarding.onboarding_state,
        verification_state: merchantOnboarding.verification_state || null,
        onboarded_at: merchantOnboarding.onboarded_at || null,
        verified_at: merchantOnboarding.verified_at || null,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof MissingUserContextError
    ) {
      return next(error);
    }
    next(new DatabaseError("Failed to fetch merchant status", error));
  }
};

/**
 * Refresh expired onboarding form link
 * POST /api/v1/marketplace/merchant/onboard/refresh-link
 */
export const marketplace_merchant_refresh_link_post = async (
  req: Request,
  res: Response<ApiResponse<{ onboarding_url: string; expires_at: string }>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new MissingUserContextError({ route: req.path });
    }

    const merchantOnboarding = await MerchantOnboarding.findOne({
      dialist_user_id: req.user.dialist_id,
    });

    if (!merchantOnboarding) {
      throw new ValidationError("No onboarding form found. Create one first.");
    }

    // Create new link for existing form
    merchantLogger.info(`Refreshing link for onboarding form`, {
      user_id: req.user.dialist_id,
      form_id: merchantOnboarding.form_id,
      requestId: req.headers["x-request-id"],
    });

    const { idempotency_id: refreshId } = req.body as any;
    const { form_link, expires_at } = await createFormLink(
      merchantOnboarding.form_id,
      undefined,
      refreshId
    );

    // Update stored link
    merchantOnboarding.last_form_link = form_link;
    merchantOnboarding.last_form_link_expires_at = new Date(expires_at);
    await merchantOnboarding.save();

    res.json({
      data: {
        onboarding_url: form_link,
        expires_at,
      },
      requestId: req.headers["x-request-id"] as string,
    });
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof MissingUserContextError
    ) {
      return next(error);
    }
    merchantLogger.error(`Refresh link error`, {
      user_id: req.user?.dialist_id,
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId: req.headers["x-request-id"],
    });
    next(new DatabaseError("Failed to refresh onboarding link", error));
  }
};
