import axios from "axios";
import crypto from "crypto";
import { config } from "../config";
import { finixLogger, logFinixApiCall } from "./logger";
import { normalizeRegionCode, validateAndFormatPostalCode } from "./location";

export const finix = axios.create({
  baseURL: config.finixBaseUrl.replace(/\/+$/, ""),
  auth: {
    username: config.finixUsername,
    password: config.finixPassword,
  },
  headers: {
    "Finix-Version": "2022-02-01",
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 30000, // Increased from 10s to 30s for Finix API reliability
});

export type MerchantAccountStatus =
  | "PROVISIONING"
  | "UPDATE_REQUESTED"
  | "REJECTED"
  | "APPROVED";
export type MerchantVerificationStatus = "PENDING" | "SUCCEEDED" | "FAILED";

// ---- Basic Auth check (username + password) ----
export function verifyBasic(req: any) {
  const auth = String(req.headers["authorization"] || "");
  if (!auth.startsWith("Basic ")) {
    const err = new Error("Missing or invalid Basic Authorization header");
    (err as any).isAuth = true;
    throw err;
  }
  const b64 = auth.slice("Basic ".length);
  let user = "",
    pass = "";
  try {
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    [user, pass] = decoded.split(":");
  } catch {
    const err = new Error("Malformed Basic Authorization header");
    (err as any).isAuth = true;
    throw err;
  }

  if (
    user !== config.finixWebhookUsername ||
    pass !== config.finixWebhookPassword
  ) {
    const err = new Error("Invalid Finix Basic credentials");
    (err as any).isAuth = true;
    throw err;
  }
}

/**
 * Verify Finix webhook HMAC-SHA256 signature
 *
 * Finix webhooks include an HMAC signature in the `Finix-Signature` header.
 * This function verifies the signature using constant-time comparison to prevent timing attacks.
 *
 * @param payload - Raw request body as string (must be unparsed JSON)
 * @param signature - Value from the `Finix-Signature` header
 * @param secret - Webhook secret from config (FINIX_WEBHOOK_SECRET)
 * @returns true if signature is valid, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = verifyFinixSignature(
 *   JSON.stringify(req.body),
 *   req.headers['finix-signature'],
 *   config.finixWebhookSecret
 * );
 * if (!isValid) {
 *   throw new Error('Invalid webhook signature');
 * }
 * ```
 */
export function verifyFinixSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  // If no secret configured, only allow in development mode
  if (!secret || secret.trim() === "") {
    if (config.nodeEnv === "production") {
      finixLogger.error(
        "FINIX_WEBHOOK_SECRET not configured in production - rejecting webhook for security"
      );
      return false;
    }
    finixLogger.warn(
      "FINIX_WEBHOOK_SECRET not configured - skipping signature verification (development mode only)"
    );
    return true;
  }

  // Require signature header
  if (!signature || signature.trim() === "") {
    finixLogger.error("Missing Finix-Signature header");
    return false;
  }

  try {
    // Compute expected signature using HMAC-SHA256
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload, "utf8");
    const expectedSignature = hmac.digest("hex");

    // Use constant-time comparison to prevent timing attacks
    // crypto.timingSafeEqual requires equal-length buffers
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    const signatureBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    const err = error as Error;
    finixLogger.error("Error verifying Finix signature", {
      error: err.message,
      stack: err.stack,
    });
    return false;
  }
}

// ---- Types for Onboarding Form ----
export interface CreateOnboardingFormParams {
  dialist_user_id: string; // ← CRITICAL: Used to link form → user in webhooks
  user_location: "US" | "CA";
  link_expiration_minutes?: number;
  // Location prefill data (from user onboarding)
  country?: "USA" | "CAN";
  region?: string;
  postal_code?: string;
  city?: string;
  line1?: string;
  line2?: string;
  // Personal/Business information prefill
  first_name?: string;
  last_name?: string;
  business_name?: string;
  email?: string;
  phone?: string;
  business_phone?: string;
  website?: string;
  title?: string;
  date_of_birth?: { year?: number; month?: number; day?: number };
  business_type?: string;
  idempotencyKey?: string;
}

export interface OnboardingFormResponse {
  form_id: string;
  form_link: string;
  expires_at: string;
  identity_id: string | null; // null until form submitted
}

/**
 * Create a Finix Onboarding Form for merchant KYC
 * Docs: https://docs.finix.com/guides/platform-payments/onboarding-sellers/seller-onboarding-forms#creating-onboarding-forms-1
 *
 * CRITICAL: Tags with dialist_user_id - this is the ONLY way to link the form to our user
 * identity_id will be populated after the user completes the form
 */
export async function createOnboardingForm(
  params: CreateOnboardingFormParams
): Promise<OnboardingFormResponse> {
  const {
    dialist_user_id,
    user_location,
    link_expiration_minutes = 1000,
    country,
    region,
    postal_code,
    city,
    line1,
    line2,
    first_name,
    last_name,
    business_name,
    email,
    phone,
    business_phone,
    website,
    title,
    date_of_birth,
    business_type,
  } = params;

  // Determine which Finix application to use based on location
  const application_id =
    user_location === "CA"
      ? config.finixCaApplicationId
      : config.finixUsApplicationId;

  if (!application_id) {
    throw new Error(
      `No Finix application cfinixUsApplicationIdonfigured for location: ${user_location}`
    );
  }

  // Normalize location data for Finix
  const finixCountry = country || (user_location === "CA" ? "CAN" : "USA");
  const normalizedRegion = region
    ? normalizeRegionCode(region, finixCountry)
    : null;
  const normalizedPostalCode = postal_code
    ? validateAndFormatPostalCode(postal_code, finixCountry)
    : null;

  finixLogger.info(
    `Creating Finix onboarding form for user ${dialist_user_id}`,
    {
      dialist_user_id,
      user_location,
      application_id,
      prefill_location: {
        country: finixCountry,
        region: normalizedRegion,
        postal_code: normalizedPostalCode,
        city,
      },
      prefill_personal: {
        first_name,
        last_name,
        business_name,
      },
    }
  );

  // First, validate the application exists
  try {
    const appCheck = await finix.get(`/applications/${application_id}`);
    logFinixApiCall("GET", `/applications/${application_id}`, appCheck.status);
    finixLogger.info(`Application ${application_id} exists`, {
      application_id: appCheck.data.id,
      dialist_user_id,
      user_location,
    });
  } catch (error: any) {
    logFinixApiCall(
      "GET",
      `/applications/${application_id}`,
      error.response?.status,
      error
    );
    finixLogger.error(`Application ${application_id} not found`, {
      application_id,
      error: error.response?.data || error.message,
      dialist_user_id,
      user_location,
    });
    throw new Error(`Invalid Finix application ID: ${application_id}`);
  }

  try {
    // Build onboarding_data with location and personal info prefill
    const onboarding_data: any = {
      max_transaction_amount: 1000000, // $10,000 default
    };

    // Prefill country if available
    if (finixCountry) {
      onboarding_data.country = finixCountry;
    }

    // Build entity object with personal/business info and location
    const hasPersonalInfo =
      first_name ||
      last_name ||
      business_name ||
      email ||
      phone ||
      business_phone ||
      title ||
      website ||
      business_type;
    const hasLocationInfo =
      normalizedRegion || normalizedPostalCode || city || line1;
    const hasDOB =
      date_of_birth &&
      (date_of_birth.year || date_of_birth.month || date_of_birth.day);

    if (hasPersonalInfo || hasLocationInfo || hasDOB) {
      onboarding_data.entity = {
        mcc: "5094", // Jewelry and watch business category
      };

      // Prefill personal/business information
      if (first_name) {
        onboarding_data.entity.first_name = first_name;
      }
      if (last_name) {
        onboarding_data.entity.last_name = last_name;
      }
      if (business_name) {
        onboarding_data.entity.business_name = business_name;
      }
      if (email) {
        onboarding_data.entity.email = email;
      }
      if (phone) {
        onboarding_data.entity.phone = phone;
      }
      if (business_phone) {
        onboarding_data.entity.business_phone = business_phone;
      }
      if (title) {
        onboarding_data.entity.title = title;
      }
      if (website) {
        onboarding_data.entity.url = website;
      }
      if (business_type) {
        onboarding_data.entity.business_type = business_type;
      }

      // Prefill date of birth if available
      if (hasDOB) {
        onboarding_data.entity.dob = {};
        if (date_of_birth.year)
          onboarding_data.entity.dob.year = date_of_birth.year;
        if (date_of_birth.month)
          onboarding_data.entity.dob.month = date_of_birth.month;
        if (date_of_birth.day)
          onboarding_data.entity.dob.day = date_of_birth.day;
      }

      // Build business_address if we have location data
      if (hasLocationInfo) {
        const business_address: any = {};
        if (finixCountry) business_address.country = finixCountry;
        if (normalizedRegion) business_address.region = normalizedRegion;
        if (normalizedPostalCode)
          business_address.postal_code = normalizedPostalCode;
        if (city) business_address.city = city;
        if (line1) business_address.line1 = line1;
        if (line2) business_address.line2 = line2;

        if (Object.keys(business_address).length > 0) {
          onboarding_data.entity.business_address = business_address;
        }
      }
    }

    const requestData = {
      // CRITICAL: Tag with our user ID (only way to link form → user)
      tags: {
        dialist_user_id,
      },

      // Application determines location-specific compliance
      application: application_id,

      // Link expiration settings
      onboarding_link_details: {
        expires_in: link_expiration_minutes * 60, // Convert to seconds
        return_url:
          process.env.FINIX_RETURN_URL ||
          "https://dialist.app/merchant/onboarding-complete",
        expired_session_url:
          process.env.FINIX_EXPIRED_SESSION_URL ||
          "https://dialist.app/merchant/session-expired",
        fee_details_url:
          process.env.FINIX_FEE_DETAILS_URL ||
          "https://dialist.app/merchant/fees",
        terms_of_service_url:
          process.env.FINIX_TOS_URL || "https://dialist.app/terms-of-service",
      },

      //  REQUIRED: Merchant processors (sandbox uses DUMMY_V2)
      merchant_processors: [
        {
          processor: "DUMMY_V2",
        },
      ],

      //  REQUIRED: Onboarding data (with location prefill)
      onboarding_data,
    };

    // Log the request data for debugging prefill issues
    finixLogger.info("Creating onboarding form with prefill data", {
      dialist_user_id,
      user_location,
      prefilled_country: onboarding_data.country,
      prefilled_entity: onboarding_data.entity
        ? {
            has_first_name: !!onboarding_data.entity.first_name,
            has_last_name: !!onboarding_data.entity.last_name,
            has_business_name: !!onboarding_data.entity.business_name,
            has_email: !!onboarding_data.entity.email,
            has_phone: !!onboarding_data.entity.phone,
            has_business_phone: !!onboarding_data.entity.business_phone,
            has_title: !!onboarding_data.entity.title,
            has_website: !!onboarding_data.entity.url,
            has_business_type: !!onboarding_data.entity.business_type,
            has_dob: !!onboarding_data.entity.dob,
            has_business_address: !!onboarding_data.entity.business_address,
            business_address_has_line1:
              !!onboarding_data.entity.business_address?.line1,
            mcc: onboarding_data.entity.mcc,
          }
        : null,
      full_request: JSON.stringify(requestData, null, 2),
    });

    const idempotencyKey =
      params.idempotencyKey ||
      `onboard-${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;

    const response = await finix.post("/onboarding_forms", requestData, {
      headers: {
        "Finix-Idempotency-Key": idempotencyKey,
        "Finix-Version": config.finixVersion,
      },
    });

    const form = response.data;

    logFinixApiCall("POST", "/onboarding_forms", response.status);

    // Log the response to see what Finix actually saved
    finixLogger.info(
      `Created Finix form ${form.id} for user ${dialist_user_id}`,
      {
        form_id: form.id,
        dialist_user_id,
        user_location,
        form_link: form.onboarding_link?.link_url,
        expires_at: form.onboarding_link?.expires_at,
        response_entity: form.onboarding_data?.entity
          ? {
              first_name: form.onboarding_data.entity.first_name,
              last_name: form.onboarding_data.entity.last_name,
              business_name: form.onboarding_data.entity.business_name,
              email: form.onboarding_data.entity.email,
              phone: form.onboarding_data.entity.phone,
              business_phone: form.onboarding_data.entity.business_phone,
              title: form.onboarding_data.entity.title,
              url: form.onboarding_data.entity.url,
              business_type: form.onboarding_data.entity.business_type,
              dob: form.onboarding_data.entity.dob,
              business_address: form.onboarding_data.entity.business_address,
            }
          : null,
      }
    );

    return {
      form_id: form.id,
      form_link: form.onboarding_link.link_url, // Extract the URL from the object
      expires_at: form.onboarding_link.expires_at, // Extract expires_at from the object
      identity_id: form.identity_id, // null until user submits form
    };
  } catch (error: any) {
    logFinixApiCall("POST", "/onboarding_forms", error.response?.status, error);
    finixLogger.error("Finix API Error (createOnboardingForm)", {
      error: error.response?.data || error.message,
      dialist_user_id,
      user_location,
    });
    throw new Error(
      `Failed to create Finix onboarding form: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 * Provision a merchant from a completed onboarding form
 * This must be called AFTER the form is completed (status: COMPLETED)
 * Finix requires explicit merchant provisioning in sandbox environment
 *
 * Process:
 * 1. Fetch onboarding form to get payment instrument (bank account) data
 * 2. Create Payment Instrument via POST /payment_instruments
 * 3. Create Merchant via POST /identities/{identity_id}/merchants
 *
 * Docs: https://docs.finix.com/guides/platform-payments/onboarding-sellers/seller-onboarding-via-api
 */

export async function provisionMerchant(
  identity_id: string,
  onboarding_form_id: string,
  idempotencyKey?: string
): Promise<{
  merchant_id: string;
  verification_id: string | null;
  onboarding_state: MerchantAccountStatus;
}> {
  try {
    finixLogger.info(`Provisioning merchant for identity: ${identity_id}`, {
      identity_id,
      onboarding_form_id,
    });

    // Step 1: Fetch the onboarding form to get bank account details
    finixLogger.info(`Fetching onboarding form: ${onboarding_form_id}`, {
      identity_id,
      onboarding_form_id,
    });
    const formResponse = await finix.get(
      `/onboarding_forms/${onboarding_form_id}`
    );
    logFinixApiCall(
      "GET",
      `/onboarding_forms/${onboarding_form_id}`,
      formResponse.status
    );
    const formData = formResponse.data;

    const paymentInstrument = formData.onboarding_data?.payment_instruments;
    if (!paymentInstrument) {
      throw new Error("No payment instrument found in onboarding form");
    }

    finixLogger.info(`Bank account found in form`, {
      identity_id,
      onboarding_form_id,
      has_payment_instrument: true,
    });

    // Step 2: Create Payment Instrument (bank account)
    finixLogger.info(`Creating payment instrument`, {
      identity_id,
      onboarding_form_id,
      instrument_type: "BANK_ACCOUNT",
    });
    const piPayload: any = {
      identity: identity_id,
      type: "BANK_ACCOUNT",
      name: paymentInstrument.name,
      account_type: paymentInstrument.account_type,
      country: paymentInstrument.country,
      currency: paymentInstrument.currency,
    };

    // Add routing details based on country
    if (paymentInstrument.country === "USA") {
      piPayload.bank_code = paymentInstrument.bank_code;
      piPayload.account_number = paymentInstrument.account_number;
    } else if (paymentInstrument.country === "CAN") {
      piPayload.institution_number = paymentInstrument.institution_number;
      piPayload.transit_number = paymentInstrument.transit_number;
      piPayload.account_number = paymentInstrument.account_number;
    }

    const piIdempotency =
      idempotencyKey ||
      `pi-prov-${identity_id}-${Date.now()}_${crypto
        .randomBytes(8)
        .toString("hex")}`;
    const piResponse = await finix.post("/payment_instruments", piPayload, {
      headers: {
        "Finix-Idempotency-Key": piIdempotency,
        "Finix-Version": config.finixVersion,
      },
    });
    const paymentInstrumentId = piResponse.data.id;
    logFinixApiCall("POST", "/payment_instruments", piResponse.status);
    finixLogger.info(`Payment instrument created: ${paymentInstrumentId}`, {
      identity_id,
      onboarding_form_id,
      payment_instrument_id: paymentInstrumentId,
      instrument_type: "BANK_ACCOUNT",
    });

    // Step 3: Create Merchant account via /identities/{id}/merchants
    finixLogger.info(`Creating merchant account`, {
      identity_id,
      onboarding_form_id,
      payment_instrument_id: paymentInstrumentId,
      processor: "DUMMY_V1",
    });

    // Determine processor - use DUMMY_V1 for sandbox
    const processor = "DUMMY_V1";

    const merchantIdempotency =
      idempotencyKey ||
      `merchant-prov-${identity_id}-${Date.now()}_${crypto
        .randomBytes(8)
        .toString("hex")}`;
    const merchantResponse = await finix.post(
      `/identities/${identity_id}/merchants`,
      {
        processor: processor,
        tags: {
          auto_provisioned: "true",
          provisioned_at: new Date().toISOString(),
          onboarding_form_id: onboarding_form_id,
        },
      },
      {
        headers: {
          "Finix-Idempotency-Key": merchantIdempotency,
          "Finix-Version": config.finixVersion,
        },
      }
    );

    const merchant = merchantResponse.data;
    logFinixApiCall(
      "POST",
      `/identities/${identity_id}/merchants`,
      merchantResponse.status
    );

    finixLogger.info(`Merchant created: ${merchant.id}`, {
      identity_id,
      onboarding_form_id,
      merchant_id: merchant.id,
      onboarding_state: merchant.onboarding_state,
      processing_enabled: merchant.processing_enabled,
      verification_id: merchant.verification,
    });

    return {
      merchant_id: merchant.id,
      verification_id: merchant.verification || null,
      onboarding_state: merchant.onboarding_state as MerchantAccountStatus,
    };
  } catch (error: any) {
    if (error.response?.data) {
      logFinixApiCall(
        "POST",
        `/identities/${identity_id}/merchants`,
        error.response.status,
        error
      );
      finixLogger.error("Finix API Error (provisionMerchant)", {
        identity_id,
        onboarding_form_id,
        error: error.response.data,
      });
      throw new Error(
        `Failed to provision merchant: ${
          error.response.data.message || error.message
        }`
      );
    }
    finixLogger.error(`Unexpected error in provisionMerchant`, {
      identity_id,
      onboarding_form_id,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Create a new link from an existing form (when link expires)
 * Docs: https://docs.finix.com/guides/platform-payments/onboarding-sellers/seller-onboarding-forms#fetching-an-onboarding-form-link
 */
export async function createFormLink(
  form_id: string,
  link_expiration_minutes: number = 10080,
  idempotencyKey?: string
): Promise<{ form_link: string; expires_at: string }> {
  finixLogger.info(`Creating new link for form ${form_id}`, {
    form_id,
    link_expiration_minutes,
  });

  try {
    const idempotency =
      idempotencyKey ||
      `formlink-${form_id}-${Date.now()}_${crypto
        .randomBytes(8)
        .toString("hex")}`;
    const response = await finix.post(
      `/onboarding_forms/${form_id}/links`,
      {
        expiration_in_minutes: link_expiration_minutes,
        return_url:
          process.env.FINIX_RETURN_URL ||
          "https://dialist.app/merchant/onboarding-complete",
        expired_session_url:
          process.env.FINIX_EXPIRED_SESSION_URL ||
          "https://dialist.app/merchant/session-expired",
        fee_details_url:
          process.env.FINIX_FEE_DETAILS_URL ||
          "https://dialist.app/merchant/fees",
        terms_of_service_url:
          process.env.FINIX_TOS_URL || "https://dialist.app/terms-of-service",
      },
      {
        headers: {
          "Finix-Idempotency-Key": idempotency,
          "Finix-Version": config.finixVersion,
        },
      }
    );

    logFinixApiCall(
      "POST",
      `/onboarding_forms/${form_id}/links`,
      response.status
    );
    finixLogger.info(`Form link created`, {
      form_id,
      link_url: response.data.link_url,
      expires_at: response.data.expires_at,
    });

    return {
      form_link: response.data.link_url,
      expires_at: response.data.expires_at,
    };
  } catch (error: any) {
    logFinixApiCall(
      "POST",
      `/onboarding_forms/${form_id}/links`,
      error.response?.status,
      error
    );
    finixLogger.error("Finix API Error (createFormLink)", {
      form_id,
      link_expiration_minutes,
      error: error.response?.data || error.message,
    });
    throw new Error(
      `Failed to create form link: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 * Create Buyer Identity
 * Creates a Finix buyer identity with full contact and address information
 * per requirements #3
 *
 * @param params - Buyer information including name, contact, and address
 * @returns identity_id - The created Finix identity ID
 */

export async function createBuyerIdentity(params: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  postal_code?: string;
  city?: string;
  region?: string;
  country?: string; // 'USA' | 'CAN'
  line1?: string;
  line2?: string;
  idempotencyKey?: string;
  // Optional idempotency id value that will be added to the request body as idempotency_id
  idempotency_id?: string;
}): Promise<{ identity_id: string }> {
  const maxRetries = 3;
  let lastError: any;

  // Log what we're creating for debugging
  finixLogger.info("Creating buyer identity with data", {
    has_first_name: !!params.first_name,
    has_last_name: !!params.last_name,
    has_email: !!params.email,
    has_phone: !!params.phone,
    has_line1: !!params.line1,
    has_city: !!params.city,
    has_region: !!params.region,
    has_postal_code: !!params.postal_code,
    country: params.country,
  });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const idempotencyKey =
        params.idempotencyKey ||
        `buyer-${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;

      // Build entity with all available information
      const entity: any = {};

      // Always include name fields (even if empty, Finix may require them)
      if (params.first_name) entity.first_name = params.first_name;
      if (params.last_name) entity.last_name = params.last_name;
      if (params.phone) entity.phone = params.phone;
      if (params.email) entity.email = params.email;

      // Build personal_address if ANY address field is provided
      const hasAddressData =
        params.postal_code ||
        params.city ||
        params.region ||
        params.country ||
        params.line1 ||
        params.line2;

      if (hasAddressData) {
        entity.personal_address = {};
        if (params.line1) entity.personal_address.line1 = params.line1;
        if (params.line2) entity.personal_address.line2 = params.line2;
        if (params.city) entity.personal_address.city = params.city;
        if (params.region) entity.personal_address.region = params.region;
        if (params.postal_code)
          entity.personal_address.postal_code = params.postal_code;
        // Default to USA if not specified
        entity.personal_address.country =
          params.country === "CAN" ? "CAN" : "USA";
      }

      const requestBody = {
        entity,
        identity_roles: ["BUYER"],
        tags: {
          dialist_buyer: "true",
          created_at: new Date().toISOString(),
        },
      };

      // If a body idempotency is provided include it in the body
      if (params.idempotency_id) {
        (requestBody as any).idempotency_id = params.idempotency_id;
      }

      // Log the full request for debugging
      finixLogger.info("Sending buyer identity request to Finix", {
        entity_keys: Object.keys(entity),
        has_personal_address: !!entity.personal_address,
        personal_address_keys: entity.personal_address
          ? Object.keys(entity.personal_address)
          : [],
      });

      const response = await finix.post("identities", requestBody, {
        headers: {
          "Finix-Idempotency-Key": idempotencyKey,
          "Finix-Version": config.finixVersion,
        },
      });

      finixLogger.info("Buyer identity created successfully", {
        identity_id: response.data.id,
        entity_first_name: response.data.entity?.first_name,
        entity_last_name: response.data.entity?.last_name,
        entity_email: response.data.entity?.email,
        has_personal_address: !!response.data.entity?.personal_address,
      });

      return { identity_id: response.data.id };
    } catch (error: any) {
      lastError = error;

      // Check if it's a timeout or network error that we should retry
      const isRetryableError =
        error.code === "ECONNABORTED" || // Timeout
        error.code === "ENOTFOUND" || // DNS resolution failed
        error.code === "ECONNREFUSED" || // Connection refused
        error.response?.status >= 500; // Server errors

      if (isRetryableError && attempt < maxRetries) {
        finixLogger.warn(
          `Finix API error (attempt ${attempt}/${maxRetries}), retrying...`,
          {
            error: error.message,
            code: error.code,
            status: error.response?.status,
          }
        );

        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
        continue;
      }

      // Not retryable or max attempts reached
      break;
    }
  }

  // All retries failed
  console.error(
    "[Finix] Error creating buyer identity after retries:",
    lastError
  );

  finixLogger.error("Finix API Error (createBuyerIdentity)", {
    error: lastError.response?.data || lastError.message,
    attempts: maxRetries,
  });
  throw new Error(
    `Failed to create buyer identity: ${
      lastError.response?.data?.message || lastError.message
    }`
  );
}

/**
 * CREATE PAYMENT INSTRUMENT FROM TOKEN
 * Creates a payment instrument from a tokenized card/bank account
 * Per Finix documentation: https://docs.finix.com/guides/online-payments/payment-tokenization/tokenization-forms
 *
 * @param params.token - Token ID from Finix.js (prefix: TK)
 * @param params.identity_id - Buyer identity ID to associate with payment instrument
 * @returns Payment instrument details including ID, card type, last 4 digits, and brand
 *
 * @security
 * - Tokens expire in 30 minutes and must be used immediately
 * - Never log or store full card numbers
 * - Always use PCI-compliant tokenization (Finix.js)
 * - Token can only be used once to create a payment instrument
 */

export async function createPaymentInstrument(params: {
  token: string;
  identity_id: string;
  postal_code?: string | null;
  // full address fields to increase AVS matching
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_region?: string | null;
  address_country?: string | null; // USA / CAN
  fraud_session_id?: string | undefined; // FINIX CERTIFICATION: fraud detection session ID
  idempotencyKey?: string;
  // optional idempotency id to include in the payload
  idempotency_id?: string;
}): Promise<{
  payment_instrument_id: string;
  card_type?: string;
  last_four?: string;
  brand?: string;
  instrument_type?: string;
}> {
  try {
    // FINIX CERTIFICATION: For token-based Payment Instruments, address is OPTIONAL
    // When using Finix.js tokenization forms (with showAddress: true), the address
    // is already collected and embedded in the token during tokenization.
    // Finix validates and uses the address from the token for AVS verification.
    // Address fields passed here are optional overrides.
    // See: https://finix.com/docs/guides/online-payments/payment-tokenization

    const idempotencyKey =
      params.idempotencyKey ||
      `pi-${params.token}-${Date.now()}_${crypto
        .randomBytes(8)
        .toString("hex")}`;

    const payload: any = {
      token: params.token,
      type: "TOKEN",
      identity: params.identity_id,
    };

    // FINIX CERTIFICATION: Always include address object for AVS matching
    // Per Finix docs: "Including an address when tokenizing a card can lower interchange"
    // Even if address is optional, always build the address object from provided params
    // to ensure Finix receives full address information for verification
    payload.address = {
      line1: params.address_line1 || undefined,
      line2: params.address_line2 || undefined,
      city: params.address_city || undefined,
      region: params.address_region || undefined,
      postal_code: params.postal_code || undefined,
      country: params.address_country || undefined,
    };

    // Remove undefined fields to keep payload clean but still send what's available
    Object.keys(payload.address).forEach((key) => {
      if (payload.address[key] === undefined) {
        delete payload.address[key];
      }
    });

    // FINIX CERTIFICATION: Always include fraud_session_id for fraud detection (REQUIRED)
    payload.fraud_session_id = params.fraud_session_id;

    // FINIX CERTIFICATION: Add tags to show this PI was created from a token
    payload.tags = {
      source_type: "tokenized",
      token_id: params.token,
      created_at: new Date().toISOString(),
      environment: "api_backend",
    };

    // Include idempotency in the request body where supported
    if (params.idempotency_id) payload.idempotency_id = params.idempotency_id;

    // FINIX CERTIFICATION: Log payment instrument creation with fraud_session_id
    finixLogger.info("[Finix] Creating Payment Instrument from token", {
      token_prefix: params.token.substring(0, 10),
      identity_id: params.identity_id,
      has_fraud_session_id: !!params.fraud_session_id,
      fraud_session_id_prefix: params.fraud_session_id?.substring(0, 20),
      has_address: !!payload.address && Object.keys(payload.address).length > 0,
      address_fields: payload.address ? Object.keys(payload.address) : [],
    });

    const response = await finix.post("payment_instruments", payload, {
      headers: {
        "Finix-Idempotency-Key": idempotencyKey,
        "Finix-Version": config.finixVersion,
      },
    });
    const data = response.data;
    return {
      payment_instrument_id: data.id,
      card_type: data.card_type,
      last_four: data.last_four,
      brand: data.brand,
      instrument_type: data.type,
    };
  } catch (error) {
    console.error("[Finix] Error creating payment instrument:", error);
    finixLogger.error("Finix API Error (createPaymentInstrument)", {
      error: (error as any).response?.data || (error as Error).message,
    });
    throw new Error(
      `Failed to create payment instrument: ${
        (error as any).response?.data?.message || (error as Error).message
      }`
    );
  }
}

/**
 * CREATE TRANSFER
 * Generic helper to create a Finix transfer for debit/credit operations
 */
/**
 * CREATE TRANSFER
 * Creates a direct sale transfer or ACH/EFT debit
 * Per Finix docs: Transfer states include PENDING, SUCCEEDED, FAILED, CANCELED, UNKNOWN
 *
 * @param params.amount - Amount in cents
 * @param params.merchant_id - Merchant receiving payment
 * @param params.source - Payment instrument ID (for debits)
 * @param params.destination - Optional destination payment instrument
 * @param params.currency - Currency code (USD, CAD)
 * @param params.operation_key - Optional operation key (e.g., CARD_NOT_PRESENT_SALE)
 * @param params.fraud_session_id - Fraud detection session ID
 * @param params.idempotencyKey - Idempotency key for request header
 * @param params.idempotency_id - Idempotency ID for request body
 * @param params.tags - Optional metadata tags
 * @returns Transfer details including state, amount, and any failure information
 */
export async function createTransfer(params: {
  amount: number;
  merchant_id: string;
  source?: string; // payment_instrument_id for buyer
  destination?: string; // optional destination PI
  currency?: string;
  operation_key?: string;
  fraud_session_id?: string | undefined;
  idempotencyKey?: string;
  tags?: Record<string, any>;
  // optional API idempotency id to include in the body
  idempotency_id?: string;
}): Promise<{
  transfer_id: string;
  state: string;
  amount: number;
  failure_code?: string;
  failure_message?: string;
}> {
  try {
    const idempotencyKey =
      params.idempotencyKey || `transfer-${params.merchant_id}-${Date.now()}`;
    const payload: any = {
      amount: params.amount,
      currency: params.currency || "USD",
      merchant: params.merchant_id,
    };
    if (params.source) payload.source = params.source;
    if (params.destination) payload.destination = params.destination;
    if (params.operation_key) payload.operation_key = params.operation_key;
    // FINIX CERTIFICATION: Always include fraud_session_id for fraud detection (REQUIRED)
    payload.fraud_session_id = params.fraud_session_id;
    if (params.tags) payload.tags = params.tags;
    // Include idempotency_id in the payload so Finix returns a consistent response on retries
    if (params.idempotency_id) payload.idempotency_id = params.idempotency_id;

    const response = await finix.post("/transfers", payload, {
      headers: {
        "Finix-Idempotency-Key": idempotencyKey,
        "Finix-Version": config.finixVersion,
      },
    });

    logFinixApiCall("POST", "/transfers", response.status);

    const transferData = response.data;

    // FINIX CERTIFICATION: Log all transfer states per Finix documentation
    // States: PENDING, SUCCEEDED, FAILED, CANCELED, UNKNOWN
    if (transferData.state === "PENDING") {
      finixLogger.warn(
        "[Finix] Transfer PENDING - will resolve asynchronously",
        {
          transfer_id: transferData.id,
          state: transferData.state,
          amount: transferData.amount,
          ready_to_settle_at: transferData.ready_to_settle_at,
          messages: transferData.messages,
        }
      );
    } else if (transferData.state === "SUCCEEDED") {
      finixLogger.info("[Finix] Transfer SUCCEEDED", {
        transfer_id: transferData.id,
        state: transferData.state,
        amount: transferData.amount,
        ready_to_settle_at: transferData.ready_to_settle_at,
      });
    } else if (transferData.state === "UNKNOWN") {
      finixLogger.warn("[Finix] Transfer UNKNOWN - connection/timeout issue", {
        transfer_id: transferData.id,
        state: transferData.state,
        amount: transferData.amount,
        message: "Reattempt the Transfer.",
      });
    }

    // FINIX CERTIFICATION: Check for FAILED state even on 201 response
    // ACH/EFT transfers can return 201 with state=FAILED
    if (transferData.state === "FAILED") {
      const failureCode = transferData.failure_code || "PROCESSING_ERROR";
      const failureMessage =
        transferData.failure_message ||
        transferData.messages?.[0]?.description ||
        "Transfer failed";

      finixLogger.error("[Finix] Transfer FAILED", {
        transfer_id: transferData.id,
        state: transferData.state,
        failure_code: failureCode,
        failure_message: failureMessage,
        messages: transferData.messages,
        amount: transferData.amount,
      });

      // Throw an error with Finix failure details so orderHandler can extract them
      const err: any = new Error(`Transfer failed: ${failureMessage}`);
      err.response = {
        data: {
          _embedded: {
            transfers: [
              {
                id: transferData.id,
                state: transferData.state,
                failure_code: failureCode,
                failure_message: failureMessage,
                messages: transferData.messages,
              },
            ],
          },
        },
      };
      throw err;
    } else if (transferData.state === "CANCELED") {
      finixLogger.error("[Finix] Transfer CANCELED - processor issue", {
        transfer_id: transferData.id,
        state: transferData.state,
        message: "Contact Finix Support for assistance",
      });

      const err: any = new Error("Transfer was canceled - processor issue");
      err.response = {
        data: {
          _embedded: {
            transfers: [
              {
                id: transferData.id,
                state: transferData.state,
                failure_code: "TRANSFER_CANCELED",
                failure_message: "Transfer was canceled due to processor issue",
              },
            ],
          },
        },
      };
      throw err;
    }

    return {
      transfer_id: transferData.id,
      state: transferData.state,
      amount: transferData.amount,
      failure_code: transferData.failure_code,
      failure_message: transferData.failure_message,
    };
  } catch (error: any) {
    logFinixApiCall("POST", "/transfers", error.response?.status, error);

    // Enhanced error logging for debugging
    const errorData = error.response?.data;
    console.error(
      "🔴 FINIX TRANSFER ERROR DETAILS:",
      JSON.stringify(
        {
          status: error.response?.status,
          statusText: error.response?.statusText,
          errorData: errorData,
          errorMessage: errorData?.message,
          errorDetails:
            errorData?._embedded?.errors ||
            errorData?._embedded?.transfers ||
            errorData?.errors,
          requestPayload: params,
        },
        null,
        2
      )
    );

    finixLogger.error("[Finix] API Error (createTransfer)", {
      error: errorData || error.message,
      payload: params,
    });

    // Re-throw with enriched error for orderHandler to extract failure details
    throw error;
  }
}

/**
 * CREATE TRANSFER REVERSAL (REFUND)
 * Creates a reversal transfer (refund) for a given transfer id
 * Per Finix: POST /transfers/{id}/reversals
 */
export async function createTransferReversal(params: {
  transfer_id: string;
  refund_amount?: number;
  idempotencyKey?: string;
  idempotency_id?: string;
}): Promise<{ reversal_id: string; state: string; amount: number }> {
  try {
    const idempotencyKey =
      params.idempotencyKey || `reversal-${params.transfer_id}-${Date.now()}`;

    const response = await finix.post(
      `/transfers/${params.transfer_id}/reversals`,
      {
        refund_amount: params.refund_amount,
        // add payload idempotency
        ...(params.idempotency_id
          ? { idempotency_id: params.idempotency_id }
          : {}),
      },
      {
        headers: {
          "Finix-Idempotency-Key": idempotencyKey,
          "Finix-Version": config.finixVersion,
        },
      }
    );

    logFinixApiCall(
      "POST",
      `/transfers/${params.transfer_id}/reversals`,
      response.status
    );

    return {
      reversal_id: response.data.id,
      state: response.data.state,
      amount: response.data.amount,
    };
  } catch (error: any) {
    logFinixApiCall(
      "POST",
      `/transfers/${params.transfer_id}/reversals`,
      error.response?.status,
      error
    );
    finixLogger.error("Finix API Error (createTransferReversal)", {
      error: error.response?.data || error.message,
      transfer_id: params.transfer_id,
    });
    throw new Error(
      `Failed to create transfer reversal: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 *  AUTHORIZE PAYMENT
 * Creates authorization (hold) on payment method
 * Per requirement #3 - funds held until delivery
 */

/**
 * AUTHORIZE PAYMENT
 * Creates an authorization (card hold) for a payment
 * Per Finix documentation: https://docs.finix.com/guides/online-payments/payment-features/auth-and-captures
 *
 * Authorization expires after 7 days and must be captured before expiration.
 *
 * @param params.amount - Amount in cents (e.g., 8500 for $85.00)
 * @param params.merchant_id - Merchant ID receiving the payment
 * @param params.payment_instrument_id - Payment instrument (card/bank) to charge
 * @param params.currency - Currency code (defaults to USD)
 * @param params.fraud_session_id - Fraud detection session ID (recommended for security)
 * @returns Authorization details including authorization_id, state, and amount
 *
 * @security
 * - Always include fraud_session_id for fraud detection
 * - Use idempotency key to prevent duplicate charges
 * - Authorization expires in 7 days
 */
export async function authorizePayment(params: {
  amount: number;
  merchant_id: string;
  payment_instrument_id: string;
  currency?: string;
  fraud_session_id?: string | undefined;
  idempotencyKey?: string;
  idempotency_id?: string;
  tags?: Record<string, any>;
}): Promise<{
  authorization_id: string;
  state: string;
  amount: number;
  failure_code?: string;
  failure_message?: string;
}> {
  try {
    // Use provided idempotency key or generate one to prevent duplicate authorizations
    const idempotencyKey =
      params.idempotencyKey ||
      `auth_${params.payment_instrument_id}-${Date.now()}`;

    // Security: Log warning if fraud detection is not enabled
    if (!params.fraud_session_id) {
      finixLogger.warn(
        "Authorization without fraud_session_id - fraud detection disabled",
        {
          payment_instrument_id: params.payment_instrument_id,
        }
      );
    }

    const payload: any = {
      merchant: params.merchant_id,
      amount: params.amount,
      currency: params.currency || "USD",
      source: params.payment_instrument_id,
      fraud_session_id: params.fraud_session_id,
      tags: {
        order_type: "marketplace_listing",
        created_at: new Date().toISOString(),
        // merge any provided tags (source_type, order_id, etc.)
        ...(params.tags || {}),
      },
    };

    if (params.idempotency_id) payload.idempotency_id = params.idempotency_id;

    const response = await finix.post(`authorizations`, payload, {
      headers: {
        "Finix-Idempotency-Key": idempotencyKey,
        "Finix-Version": config.finixVersion,
      },
    });

    const authData = response.data;

    // FINIX CERTIFICATION: Check for FAILED state even on 201 response
    // Finix returns 201 with state=FAILED for declined cards, so we need to check
    // Per Finix docs: Authorizations can be PENDING, SUCCEEDED, FAILED, CANCELED, or UNKNOWN
    if (authData.state === "FAILED") {
      const failureCode = authData.failure_code || "GENERIC_DECLINE";
      const failureMessage =
        authData.failure_message ||
        authData.messages?.[0]?.description ||
        "Payment was declined";

      finixLogger.error("[Finix] Authorization FAILED (card declined)", {
        authorization_id: authData.id,
        state: authData.state,
        failure_code: failureCode,
        failure_message: failureMessage,
        messages: authData.messages,
        amount: authData.amount,
      });

      // Throw an error with Finix failure details so orderHandler can extract them
      const err: any = new Error(`Payment declined: ${failureMessage}`);
      err.response = {
        data: {
          _embedded: {
            authorizations: [
              {
                id: authData.id,
                state: authData.state,
                failure_code: failureCode,
                failure_message: failureMessage,
                messages: authData.messages,
              },
            ],
          },
        },
      };
      throw err;
    }

    // FINIX CERTIFICATION: Validate authorization state before returning
    // Per Finix docs: Only SUCCEEDED authorizations should proceed to capture
    if (authData.state !== "SUCCEEDED" && authData.state !== "PENDING") {
      finixLogger.warn("[Finix] Authorization returned unexpected state", {
        authorization_id: authData.id,
        state: authData.state,
        expected_states: ["SUCCEEDED", "PENDING"],
      });
    }

    return {
      authorization_id: authData.id,
      state: authData.state,
      amount: authData.amount,
      failure_code: authData.failure_code,
      failure_message: authData.failure_message,
    };
  } catch (error: any) {
    console.error("[Finix] Error authorizing payment:", error);

    // Extract detailed error from Finix response
    let errorMessage = error.message;
    let failureCode: string | undefined;
    let failureMessage: string | undefined;

    if (error.response?.data) {
      const responseData = error.response.data;

      // Check for embedded authorization with failure details
      if (responseData._embedded?.authorizations?.[0]) {
        const auth = responseData._embedded.authorizations[0];
        failureCode = auth.failure_code;
        failureMessage =
          auth.failure_message || auth.messages?.[0]?.description;
        errorMessage =
          failureMessage || `Payment declined (state: ${auth.state})`;

        finixLogger.error("[Finix] Payment Authorization Declined", {
          authorization_id: auth.id,
          state: auth.state,
          failure_code: failureCode,
          failure_message: failureMessage,
          messages: auth.messages,
          amount: auth.amount,
        });
      } else if (responseData.message) {
        errorMessage = responseData.message;
      }
    }

    finixLogger.error("[Finix] API Error (authorizePayment)", {
      error: error.response?.data || error.message,
      status: error.response?.status,
      failure_code: failureCode,
      failure_message: failureMessage,
    });

    // Re-throw with structured data for orderHandler to extract
    const enrichedError: any = new Error(
      `Failed to authorize payment: ${errorMessage}`
    );
    enrichedError.response = error.response;
    throw enrichedError;
  }
}

/**
 * CAPTURE PAYMENT
 * Creates a transfer directly from an authorization instead of capturing it
 * Per Finix documentation: https://docs.finix.com/api-reference/transfers/transfers
 * Use POST /transfers with source as authorization_id
 *
 * @param params.authorization_id - The authorization ID to create transfer from
 * @param params.capture_amount - Amount to transfer (optional, defaults to full authorization amount)
 * @returns Transfer details including transfer_id, state, and amount
 */

/**
 * Capture an authorization and trigger transfer creation
 * According to Finix docs: Capturing an authorization automatically creates a Transfer.
 * We should use PUT /authorizations/{id} endpoint, not manually create transfers.
 *
 * @see https://docs.finixpayments.com/guides/online-payments/payment-features/auth-and-captures#capturing-an-authorization
 */
export async function capturePayment(params: {
  authorization_id: string;
  merchant_id?: string;
  capture_amount?: number;
  idempotencyKey?: string;
  idempotency_id?: string;
}): Promise<{
  authorization_id: string;
  transfer_id: string;
  state: string;
  amount: number;
  trace_id?: string;
}> {
  console.log("[DEBUG] capturePayment called with params:", params);

  try {
    // First get the authorization details to validate state and get amount
    const authorization = await getAuthorization(params.authorization_id);

    if (!authorization) {
      throw new Error(`Authorization ${params.authorization_id} not found`);
    }

    if (authorization.state !== "SUCCEEDED") {
      throw new Error(
        `Authorization is not in SUCCEEDED state: ${authorization.state}`
      );
    }

    // Use the capture_amount if provided, otherwise use the full authorization amount
    const captureAmount = params.capture_amount || authorization.amount;

    // Validate merchant if provided
    if (params.merchant_id) {
      const merchant = await getMerchant(params.merchant_id);
      if (merchant.onboarding_state !== "APPROVED") {
        throw new Error(
          `Merchant ${params.merchant_id} is not approved for transfers. Current state: ${merchant.onboarding_state}`
        );
      }
    }

    console.log("[DEBUG] Capturing authorization:", {
      authorization_id: params.authorization_id,
      capture_amount: captureAmount,
      original_amount: authorization.amount,
      merchant: authorization.merchant,
    });

    // Capture the authorization - Finix will automatically create the transfer
    // Per Finix API docs: PUT /authorizations/{id} with capture_amount
    const idempotencyKey =
      params.idempotencyKey ||
      `capture_${params.authorization_id}_${Date.now()}`;
    const body: any = {
      capture_amount: captureAmount,
      tags: {
        order_type: "marketplace_listing",
        captured_at: new Date().toISOString(),
        // FINIX CERTIFICATION: Store idempotency_id in tags for audit trail
        // Note: idempotency_id in Authorization capture body doesn't transfer to the auto-created Transfer
        ...(params.idempotency_id && { idempotency_id: params.idempotency_id }),
      },
    };

    // FINIX CERTIFICATION: Include idempotency_id in Authorization capture body
    // This ensures the Authorization capture operation is idempotent
    if (params.idempotency_id) body.idempotency_id = params.idempotency_id;

    const response = await finix.put(
      `/authorizations/${params.authorization_id}`,
      body,
      {
        headers: {
          "Finix-Idempotency-Key": idempotencyKey,
          "Finix-Version": config.finixVersion,
        },
      }
    );

    console.log("[DEBUG] Authorization capture response:", {
      status: response.status,
      authorization_id: response.data.id,
      state: response.data.state,
      transfer_id: response.data.transfer,
      amount: response.data.amount,
      // FINIX CERTIFICATION: Log whether idempotency_id was echoed back
      idempotency_id_in_auth: response.data.idempotency_id,
    });

    // Extract the transfer ID from the captured authorization
    const transferId = response.data.transfer;

    if (!transferId) {
      throw new Error(
        "Authorization captured but no transfer ID returned. This should not happen."
      );
    }

    // FINIX CERTIFICATION: Fetch the created Transfer to verify idempotency_id
    let transferIdempotencyId = null;
    try {
      const transferDetails = await getTransfer(transferId);
      transferIdempotencyId = transferDetails.idempotency_id;
      finixLogger.info("[Finix] Transfer idempotency_id check", {
        transfer_id: transferId,
        transfer_idempotency_id: transferIdempotencyId,
        requested_idempotency_id: params.idempotency_id,
        idempotency_preserved: transferIdempotencyId === params.idempotency_id,
      });
    } catch (err) {
      finixLogger.warn(
        "[Finix] Could not fetch transfer details to verify idempotency_id",
        { transfer_id: transferId, error: (err as Error).message }
      );
    }

    // FINIX CERTIFICATION: Log capture success with all relevant IDs for audit trail
    // Per Finix docs: Capturing creates a Transfer with state (PENDING, SUCCEEDED, FAILED, CANCELED, UNKNOWN)
    finixLogger.info("[Finix] Authorization captured successfully", {
      authorization_id: params.authorization_id,
      transfer_id: transferId,
      authorization_state: response.data.state,
      amount: response.data.amount,
      trace_id: response.data.trace_id,
      capture_amount: params.capture_amount || response.data.amount,
      authorization_idempotency_id: response.data.idempotency_id,
      transfer_idempotency_id: transferIdempotencyId,
    });

    // Return transfer info
    // Note: The transfer.created webhook will fire automatically from Finix
    return {
      authorization_id: params.authorization_id,
      transfer_id: transferId,
      state: response.data.state,
      amount: response.data.amount,
      trace_id: response.data.trace_id,
    };
  } catch (error: any) {
    console.error("[DEBUG] capturePayment error:", error);
    console.error("[DEBUG] Error response:", error.response?.data);

    // Log specific Finix errors if available
    if (error.response?.data?._embedded?.errors) {
      console.error("[DEBUG] Finix validation errors:");
      for (const err of error.response.data._embedded.errors) {
        console.error(
          `[DEBUG] - ${err.code}: ${err.message} (field: ${err.field || "N/A"})`
        );
      }
    }

    finixLogger.error("Finix API Error (capturePayment)", {
      authorization_id: params.authorization_id,
      merchant_id: params.merchant_id,
      error: error.response?.data || error.message,
      status: error.response?.status,
    });
    throw new Error(
      `Failed to capture authorization: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 * GET IDENTITY DETAILS
 * Fetch buyer/seller identity info
 */

export async function getIdentity(identity_id: string) {
  try {
    const response = await finix.get(`/identities/${identity_id}`, {
      headers: {
        "Finix-Version": config.finixVersion,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error("[Finix] Error fetching identity:", error);
    finixLogger.error("Finix API Error (getIdentity)", {
      error: error.response?.data || error.message,
    });
    throw new Error(
      `Failed to fetch identity: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 *  GET PAYMENT INSTRUMENT DETAILS
 * Fetch payment method info
 */

export async function getPaymentInstrument(payment_instrument_id: string) {
  try {
    const response = await finix.get(
      `/payment_instruments/${payment_instrument_id}`,
      {
        headers: {
          "Finix-Version": config.finixVersion,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("[Finix] Error fetching payment instrument:", error);
    finixLogger.error("Finix API Error (getPaymentInstrument)", {
      error: error.response?.data || error.message,
    });
    throw new Error(
      `Failed to fetch payment instrument: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 *  GET AUTHORIZATION DETAILS
 * Fetch authorization status
 */

export const getAuthorization = async (authorization_id: string) => {
  try {
    const response = await finix.get(`/authorizations/${authorization_id}`, {
      headers: {
        "Finix-Version": config.finixVersion,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error("[Finix] Error fetching authorization:", error);
    finixLogger.error("Finix API Error (getAuthorization)", {
      error: error.response?.data || error.message,
    });
    throw new Error(
      `Failed to fetch authorization: ${
        error.response?.data?.message || error.message
      }`
    );
  }
};

/**
 *  GET TRANSFER DETAILS
 * Fetch transfer (capture) status
 */

export const getTransfer = async (transfer_id: string) => {
  try {
    const response = await finix.get(`/transfers/${transfer_id}`, {
      headers: {
        "Finix-Version": config.finixVersion,
      },
    });
    return response.data;
  } catch (error: any) {
    console.error("[Finix] Error fetching transfer:", error);
    finixLogger.error("Finix API Error (getTransfer)", {
      error: error.response?.data || error.message,
    });
    throw new Error(
      `Failed to fetch transfer: ${
        error.response?.data?.message || error.message
      }`
    );
  }
};

/**
 * GET MERCHANT DETAILS
 * Fetch merchant account info and status
 */
export const getMerchant = async (merchant_id: string) => {
  try {
    const response = await finix.get(`/merchants/${merchant_id}`, {
      headers: {
        "Finix-Version": config.finixVersion,
      },
    });
    return response.data;
  } catch (error: any) {
    console.error("[Finix] Error fetching merchant:", error);
    finixLogger.error("Finix API Error (getMerchant)", {
      error: error.response?.data || error.message,
    });
    throw new Error(
      `Failed to fetch merchant: ${
        error.response?.data?.message || error.message
      }`
    );
  }
};

/**
 * VOID AUTHORIZATION
 * Voids an existing authorization that has not been captured
 * Per Finix documentation: https://docs.finix.com/guides/online-payments/payment-features/auth-and-captures#void-an-authorization
 *
 * Use this to:
 * - Cancel an authorization that will not be captured
 * - Release held funds back to the cardholder
 * - Void unsuccessful or expired authorizations
 *
 * @param params.authorization_id - The authorization ID to void
 * @param params.idempotencyKey - Optional idempotency key for the request
 * @returns Voided authorization details including void_state
 *
 * @security
 * - Only SUCCEEDED authorizations can be voided
 * - Already captured authorizations cannot be voided (use refund instead)
 * - Voiding releases the hold on cardholder funds immediately
 */
export async function voidAuthorization(params: {
  authorization_id: string;
  idempotencyKey?: string;
  idempotency_id?: string;
}): Promise<{
  authorization_id: string;
  state: string;
  void_state: string;
  is_void: boolean;
  amount: number;
}> {
  try {
    // First check if authorization exists and is in a voidable state
    const authorization = await getAuthorization(params.authorization_id);

    if (!authorization) {
      throw new Error(`Authorization ${params.authorization_id} not found`);
    }

    // Can only void authorizations that haven't been captured
    if (authorization.transfer) {
      throw new Error(
        `Authorization ${params.authorization_id} has already been captured (transfer: ${authorization.transfer}). Use refund instead.`
      );
    }

    // Can only void SUCCEEDED authorizations
    if (authorization.state !== "SUCCEEDED") {
      throw new Error(
        `Cannot void authorization in state: ${authorization.state}. Only SUCCEEDED authorizations can be voided.`
      );
    }

    // Check if already voided
    if (authorization.is_void || authorization.void_state === "SUCCEEDED") {
      finixLogger.info(
        `Authorization ${params.authorization_id} is already voided`,
        {
          authorization_id: params.authorization_id,
          void_state: authorization.void_state,
          is_void: authorization.is_void,
        }
      );
      return {
        authorization_id: authorization.id,
        state: authorization.state,
        void_state: authorization.void_state,
        is_void: authorization.is_void,
        amount: authorization.amount,
      };
    }

    const idempotencyKey =
      params.idempotencyKey ||
      `void_${params.authorization_id}_${Date.now()}_${crypto
        .randomBytes(8)
        .toString("hex")}`;

    finixLogger.info(`Voiding authorization ${params.authorization_id}`, {
      authorization_id: params.authorization_id,
      current_state: authorization.state,
      amount: authorization.amount,
    });

    // Void the authorization using PUT with void_me: true
    const body: any = {
      void_me: true,
    };

    if (params.idempotency_id) body.idempotency_id = params.idempotency_id;

    const response = await finix.put(
      `/authorizations/${params.authorization_id}`,
      body,
      {
        headers: {
          "Finix-Idempotency-Key": idempotencyKey,
          "Finix-Version": config.finixVersion,
        },
      }
    );

    logFinixApiCall(
      "PUT",
      `/authorizations/${params.authorization_id}`,
      response.status
    );

    const voidedAuth = response.data;

    finixLogger.info(
      `Authorization ${params.authorization_id} voided successfully`,
      {
        authorization_id: voidedAuth.id,
        state: voidedAuth.state,
        void_state: voidedAuth.void_state,
        is_void: voidedAuth.is_void,
        amount: voidedAuth.amount,
      }
    );

    return {
      authorization_id: voidedAuth.id,
      state: voidedAuth.state,
      void_state: voidedAuth.void_state,
      is_void: voidedAuth.is_void,
      amount: voidedAuth.amount,
    };
  } catch (error: any) {
    logFinixApiCall(
      "PUT",
      `/authorizations/${params.authorization_id}`,
      error.response?.status,
      error
    );

    finixLogger.error("Finix API Error (voidAuthorization)", {
      authorization_id: params.authorization_id,
      error: error.response?.data || error.message,
      status: error.response?.status,
    });

    throw new Error(
      `Failed to void authorization: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 * GET ONBOARDING FORM
 * Fetches the details of an onboarding form
 */
export async function getOnboardingForm(form_id: string) {
  try {
    const response = await finix.get(`/onboarding_forms/${form_id}`, {
      headers: {
        "Finix-Version": config.finixVersion,
      },
    });
    logFinixApiCall("GET", `/onboarding_forms/${form_id}`, response.status);
    return response.data;
  } catch (error: any) {
    logFinixApiCall(
      "GET",
      `/onboarding_forms/${form_id}`,
      error.response?.status,
      error
    );
    finixLogger.error("Finix API Error (getOnboardingForm)", {
      form_id,
      error: error.response?.data || error.message,
    });
    throw new Error(
      `Failed to fetch onboarding form: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}
