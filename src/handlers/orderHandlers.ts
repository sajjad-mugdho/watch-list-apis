import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { Order } from "../models/Order";
import { MarketplaceListing } from "../models/Listings";
import { User } from "../models/User";
import { IWatch } from "../models/Watches";
import { RefundRequest } from "../models/RefundRequest";
import { createAuditLog } from "../models/AuditLog";
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
  PaymentError,
} from "../utils/errors";
import {
  createTransferReversal,
  getTransfer,
  getPaymentInstrument,
  createPaymentInstrument,
  createTransfer,
  authorizePayment,
  capturePayment,
} from "../utils/finix";

import { config } from "../config";
import { createBuyerIdentity } from "../utils/finix";
import logger from "../utils/logger";
import { validateAndFormatPostalCode } from "../utils/location";
import { chatService } from "../services/ChatService";
import { Notification } from "../models/Notification";

/**
 *  STEP 1: RESERVE LISTING (45-minute window)
 * POST /api/v1/marketplace/orders/reserve
 *
 * Per requirement #1: Temporary 45-min reservation
 * Per requirement #2: Auto-release if not completed
 */
export const reserveListing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { listing_id } = req.body;
    const buyer_user_id = req.user?.dialist_id;
    const buyer_clerk_id = req.user!.userId;

    logger.info("[Order] Reserve listing request started", {
      listing_id,
      buyer_user_id,
      buyer_clerk_id,
    });

    if (!listing_id) {
      logger.warn("[Order] Reserve failed: missing listing_id", {
        buyer_user_id,
      });
      throw new ValidationError("listing_id is required");
    }

    const listing = await MarketplaceListing.findById(listing_id)
      .populate<{ watch_id: IWatch }>("watch_id")
      .lean();

    if (!listing) {
      logger.warn("[Order] Reserve failed: listing not found", {
        listing_id,
        buyer_user_id,
      });
      throw new NotFoundError("Listing not found");
    }

    logger.info("[Order] Listing found", {
      listing_id,
      status: listing.status,
      price: listing.price,
      seller_id: listing.dialist_id,
    });

    // Check if listing is already reserved
    if (listing.reserved_until && listing.reserved_until > new Date()) {
      const theMinutesLeft = Math.ceil(
        (listing.reserved_until.getTime() - Date.now()) / 60000
      );

      logger.warn("[Order] Reserve failed: listing already reserved", {
        listing_id,
        buyer_user_id,
        reserved_by: listing.reserved_by_user_id,
        minutes_left: theMinutesLeft,
      });

      throw new ValidationError(
        `Listing is already reserved for another buyer. Please try again in ${theMinutesLeft} minutes.`
      );
    }

    // Can't buy own listing
    if (listing.clerk_id === buyer_clerk_id) {
      logger.warn("[Order] Reserve failed: cannot buy own listing", {
        listing_id,
        buyer_clerk_id,
      });
      throw new AuthorizationError("You cannot purchase your own listing", {
        listing_id,
        buyer_clerk_id,
      });
    }

    // Create 2 hour reservation (increased from 45 minutes for better UX)
    const now = new Date();
    const reservation_expires_at = new Date(now.getTime() + 2 * 60 * 60000); // 2 hours from now

    // Generate fraud_session_id
    const fraud_session_id = `fs_${crypto.randomBytes(16).toString("hex")}`;

    const watch = listing.watch_id;

    logger.info("[Order] Creating order with reservation", {
      listing_id,
      buyer_user_id,
      seller_id: listing.dialist_id,
      price: listing.price,
      reservation_expires_at,
      fraud_session_id,
    });

    // Create order with snapshot of listing data
    const order = await Order.create({
      listing_id: listing._id,
      buyer_id: buyer_user_id,
      seller_id: listing.dialist_id, // ✅ Use dialist_id, not seller_user_id
      listing_snapshot: {
        brand: watch.brand,
        model: watch.model,
        reference: watch.reference,
        condition: listing.condition,
        price: listing.price,
        images: listing.images || [],
        thumbnail: listing.thumbnail || listing.images?.[0],
      },
      amount: listing.price,
      currency: "USD",
      status: "reserved",
      reserved_at: now,
      reservation_expires_at,
      fraud_session_id,
    });

    logger.info("[Order] Order created successfully", {
      order_id: order._id,
      listing_id,
      buyer_user_id,
      status: order.status,
    });

    // Reserve listing atomically
    const update = await MarketplaceListing.findOneAndUpdate(
      {
        _id: listing._id,
        $or: [
          { reserved_until: { $exists: false } },
          { reserved_until: null },
          { reserved_until: { $lt: new Date() } },
        ],
      },
      {
        reserved_until: reservation_expires_at,
        reserved_by_user_id: buyer_user_id,
        reserved_by_order_id: order._id,
      },
      {
        new: true,
      }
    );

    if (!update) {
      logger.warn("[Order] Atomic reservation failed (race condition)", {
        listing_id,
        buyer_user_id,
        order_id: order._id,
      });
      await order.deleteOne();
      throw new ValidationError(
        "Failed to reserve listing; it may have just been reserved by another buyer. Please try again."
      );
    }

    logger.info("[Order] Listing reserved successfully", {
      order_id: order._id,
      listing_id,
      buyer_user_id,
      reservation_expires_at,
    });

    // Send system message to Stream Chat channel if it exists
    if (order.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          order.getstream_channel_id,
          { 
            type: "listing_reserved", 
            order_id: order._id.toString() 
          },
          buyer_user_id || ""
        );
      } catch (chatError) {
        logger.warn("Failed to send reservation message to Stream", { chatError });
      }
    }

    // Notification for Seller
    try {
      await Notification.create({
        user_id: order.seller_id,
        type: "listing_reserved",
        title: "Listing Reserved",
        body: `Your ${listing.brand} ${listing.model} has been reserved by a buyer.`,
        data: {
          listing_id: listing_id,
          order_id: order._id.toString(),
        },
        action_url: `/orders/${order._id}`,
      });
    } catch (notifError) {
      logger.warn("Failed to create reservation notification", { notifError });
    }

    res.status(200).json({
      success: true,
      data: {
        order_id: order._id.toString(),
        status: order.status,
        reservation_expires_at: order.reservation_expires_at,
        fraud_session_id: fraud_session_id,
        listing: {
          title: `${watch.brand || "Watch"} ${watch.model || ""}`.trim(),
          image: listing.images?.[0] || null,
          price: listing.price,
          condition: listing.condition,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 *  STEP 2: GET TOKENIZATION FORM CONFIG
 * POST /api/v1/marketplace/orders/:id/tokenize
 *
 * Finix Certification Requirements:
 * - Creates buyer identity with full profile (name, email, phone, address)
 * - Returns Finix config for tokenization form
 * - Supports prefill customization - user can override profile data
 * - Supports both USD and CAD currencies based on buyer location
 */

export const getTokenizationForm = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const buyer_user_id = req.user?.dialist_id; // ✅ Fixed: use dialist_id to match order.buyer_id
    const buyer_clerk_id = req.user?.userId;
    const buyer_location_country = req.user?.location_country; // US or CA

    logger.info("[Order] Tokenization form request started", {
      order_id: id,
      order_id_length: id.length,
      order_id_type: typeof id,
      buyer_user_id,
      buyer_clerk_id,
    });

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.warn("[Order] Invalid ObjectId format", {
        order_id: id,
        buyer_user_id,
      });
      throw new ValidationError("Invalid order ID format");
    }

    const order = await Order.findById(id);

    if (!order) {
      logger.warn("[Order] Tokenization failed: order not found", {
        order_id: id,
        order_id_length: id.length,
        buyer_user_id,
      });
      throw new NotFoundError("Order not found");
    }

    logger.info("[Order] Order found", {
      order_id: id,
      order_status: order.status,
      order_buyer_id: order.buyer_id.toString(),
      request_buyer_user_id: buyer_user_id,
      request_buyer_clerk_id: buyer_clerk_id,
      reservation_expires_at: order.reservation_expires_at,
    });

    // Verify buyer (compare dialist_id stored in order.buyer_id)
    if (order.buyer_id.toString() !== buyer_user_id) {
      logger.warn("[Order] Tokenization failed: not authorized", {
        order_id: id,
        order_buyer_id: order.buyer_id.toString(),
        request_buyer_user_id: buyer_user_id,
        request_buyer_clerk_id: buyer_clerk_id,
      });
      throw new AuthorizationError(
        "You are not authorized to access this order",
        {
          order_id: id,
          buyer_user_id,
        }
      );
    }

    if (
      order.reservation_expires_at &&
      order.reservation_expires_at < new Date()
    ) {
      logger.warn("[Order] Tokenization failed: reservation expired", {
        order_id: id,
        buyer_user_id,
        expired_at: order.reservation_expires_at,
      });
      await order.updateOne({
        status: "expired",
      });
      await MarketplaceListing.findByIdAndUpdate(order.listing_id, {
        $unset: {
          reserved_until: 1,
          reserved_by_user_id: 1,
          reserved_by_order_id: 1,
        },
      });
      throw new ValidationError("Reservation has expired for this order");
    }

    // Create Buyer Identity in finix
    let finix_buyer_identity_id = order.finix_buyer_identity_id;

    // Extract all possible prefill fields from request body
    // Users can customize these to override profile data
    const {
      idempotency_id: tokenization_id,
      // Personal info prefill (override user profile)
      first_name: body_first_name,
      last_name: body_last_name,
      email: body_email,
      phone: body_phone,
      // Address prefill
      postal_code: body_postal_code,
      country: body_country,
      address_line1: body_line1,
      address_line2: body_line2,
      city: body_city,
      region: body_region,
      // Currency override (USD or CAD)
      currency: body_currency,
      // Payment instrument type hint (card, bank) - stored in order metadata
      payment_type: body_payment_type,
    } = (req.body as any) || {};

    // Store payment type hint in order metadata if provided
    if (body_payment_type && ["card", "bank"].includes(body_payment_type)) {
      await Order.findByIdAndUpdate(id, {
        $set: { "metadata.payment_type_hint": body_payment_type },
      });
    }
    const rawBodyTokenize = req.body as any;
    const effective_body_line1_tokenize =
      (body_line1 as string) ||
      rawBodyTokenize.addressLine1 ||
      rawBodyTokenize.address?.line1 ||
      rawBodyTokenize.billing?.address_line1 ||
      rawBodyTokenize.card?.address_line1 ||
      rawBodyTokenize.bank?.address_line1 ||
      "";
    const effective_body_line2_tokenize =
      (body_line2 as string) ||
      rawBodyTokenize.addressLine2 ||
      rawBodyTokenize.address?.line2 ||
      rawBodyTokenize.billing?.address_line2 ||
      rawBodyTokenize.card?.address_line2 ||
      rawBodyTokenize.bank?.address_line2 ||
      "";
    const effective_body_city_tokenize =
      (body_city as string) ||
      rawBodyTokenize.city ||
      rawBodyTokenize.address?.city ||
      rawBodyTokenize.billing?.city ||
      rawBodyTokenize.card?.city ||
      rawBodyTokenize.bank?.city ||
      "";
    const effective_body_region_tokenize =
      (body_region as string) ||
      rawBodyTokenize.region ||
      rawBodyTokenize.address?.region ||
      rawBodyTokenize.billing?.region ||
      rawBodyTokenize.card?.region ||
      rawBodyTokenize.bank?.region ||
      "";
    const effective_body_postal_tokenize =
      (body_postal_code as string) ||
      rawBodyTokenize.postalCode ||
      rawBodyTokenize.postal_code ||
      rawBodyTokenize.address?.postal_code ||
      rawBodyTokenize.card?.postal_code ||
      rawBodyTokenize.card?.postalCode ||
      rawBodyTokenize.bank?.postal_code ||
      rawBodyTokenize.bank?.postalCode ||
      "";
    if (!tokenization_id) {
      logger.warn("[Order] Tokenization request missing idempotency_id", {
        order_id: id,
        buyer_user_id,
      });
      throw new ValidationError("idempotency_id is required");
    }

    if (!finix_buyer_identity_id) {
      // Fetch full user profile from database to get onboarding address data
      const fullUser = await User.findById(buyer_user_id)
        .select("first_name last_name email phone location onboarding")
        .lean();

      if (!fullUser) {
        logger.warn("[Order] User not found for buyer identity creation", {
          order_id: id,
          buyer_user_id,
        });
        throw new ValidationError("User not found");
      }

      // Extract user's onboarding address data
      const onboardingLocation = fullUser.onboarding?.steps?.location;
      const userLocation = fullUser.location;

      // Priority: request body > onboarding.steps.location > user.location
      const firstName = String(body_first_name || fullUser.first_name || "");
      const lastName = String(body_last_name || fullUser.last_name || "");
      const email = String(body_email || fullUser.email || "");
      const phone = String(body_phone || fullUser.phone || "");

      // Address fields: prioritize request body, then onboarding location, then user.location
      const finalPostalCode =
        effective_body_postal_tokenize ||
        body_postal_code ||
        onboardingLocation?.postal_code ||
        userLocation?.postal_code ||
        undefined;

      const finalLine1 =
        effective_body_line1_tokenize ||
        body_line1 ||
        onboardingLocation?.line1 ||
        userLocation?.line1 ||
        undefined;

      const finalLine2 =
        effective_body_line2_tokenize ||
        body_line2 ||
        onboardingLocation?.line2 ||
        userLocation?.line2 ||
        undefined;

      const finalCity =
        effective_body_city_tokenize ||
        body_city ||
        onboardingLocation?.city ||
        userLocation?.city ||
        undefined;

      const finalRegion =
        effective_body_region_tokenize ||
        body_region ||
        onboardingLocation?.region ||
        userLocation?.region ||
        undefined;

      const finalCountry = String(
        body_country ||
          onboardingLocation?.country ||
          userLocation?.country ||
          "USA"
      );

      logger.info("[Order] Creating Finix buyer identity with full profile", {
        order_id: id,
        buyer_user_id,
        has_first_name: !!firstName,
        has_last_name: !!lastName,
        has_email: !!email,
        has_phone: !!phone,
        has_postal_code: !!finalPostalCode,
        has_line1: !!finalLine1,
        has_city: !!finalCity,
        has_region: !!finalRegion,
        country: finalCountry,
        source: {
          name: body_first_name ? "request" : "user_profile",
          address: effective_body_line1_tokenize
            ? "request"
            : onboardingLocation?.line1
            ? "onboarding"
            : "user_location",
        },
      });

      const identity = await createBuyerIdentity({
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        postal_code: finalPostalCode || undefined,
        line1: finalLine1 || undefined,
        line2: finalLine2 || undefined,
        city: finalCity || undefined,
        region: finalRegion || undefined,
        country: finalCountry,
        idempotencyKey: tokenization_id,
        idempotency_id: tokenization_id,
      });

      finix_buyer_identity_id = identity.identity_id;
      await order.updateOne({ finix_buyer_identity_id });

      logger.info("[Order] Finix buyer identity created", {
        order_id: id,
        buyer_user_id,
        finix_buyer_identity_id,
      });
    } else {
      logger.info("[Order] Using existing Finix buyer identity", {
        order_id: id,
        buyer_user_id,
        finix_buyer_identity_id,
      });
    }

    // Determine currency based on buyer location or explicit override
    // CAD for Canadian buyers, USD for everyone else
    let effectiveCurrency = order.currency;
    if (body_currency && ["USD", "CAD"].includes(body_currency.toUpperCase())) {
      effectiveCurrency = body_currency.toUpperCase();
    } else if (buyer_location_country === "CA") {
      effectiveCurrency = "CAD";
    }

    // Update order currency if changed
    if (effectiveCurrency !== order.currency) {
      await order.updateOne({ currency: effectiveCurrency });
      logger.info("[Order] Currency updated", {
        order_id: id,
        old_currency: order.currency,
        new_currency: effectiveCurrency,
        reason: body_currency ? "explicit_override" : "buyer_location",
      });
    }

    // Determine Finix application based on currency/location
    const finixApplicationId =
      effectiveCurrency === "CAD"
        ? config.finixCaApplicationId
        : config.finixUsApplicationId;

    logger.info("[Order] Tokenization form config ready", {
      order_id: id,
      order_id_from_db: order._id.toString(),
      buyer_user_id,
      finix_buyer_identity_id,
      application_id: finixApplicationId,
      amount: order.amount,
      currency: effectiveCurrency,
      buyer_location_country,
    });

    res.json({
      success: true,
      data: {
        order_id: order._id.toString(),
        application_id: finixApplicationId,
        buyer_identity_id: finix_buyer_identity_id,
        fraud_session_id: order.fraud_session_id as string | undefined,
        amount: order.amount,
        currency: effectiveCurrency,
        // Backwards-compat: advise client to collect postal code (AVS) during tokenization
        require_address: true,
        // Additional info for client
        payment_types: ["card", "bank"], // Supported payment instrument types
        prefill_customizable: true, // Indicates client can override profile data
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 3: Process payment authorization
 * POST /api/v1/marketplace/orders/:id/payment
 */

export const processPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      payment_token,
      payment_instrument_id,
      card,
      bank,
      postal_code,
      idempotency_id,
      fraud_session_id,
      address_line1: body_line1,
      address_line2: body_line2,
      city: body_city,
      region: body_region,
      country: body_country,
    } = req.body;

    // Normalize address fields: accept snake_case and camelCase, or nested formats
    const rawBody = req.body as any;
    const effective_body_line1 =
      (body_line1 as string) ||
      rawBody.addressLine1 ||
      rawBody.address?.line1 ||
      rawBody.billing?.address_line1 ||
      rawBody.billing?.address?.line1 ||
      rawBody.card?.address_line1 ||
      rawBody.card?.address?.line1 ||
      rawBody.bank?.address_line1 ||
      rawBody.bank?.address?.line1 ||
      "";
    const effective_body_line2 =
      (body_line2 as string) ||
      rawBody.addressLine2 ||
      rawBody.address?.line2 ||
      rawBody.billing?.address_line2 ||
      rawBody.billing?.address?.line2 ||
      rawBody.card?.address_line2 ||
      rawBody.card?.address?.line2 ||
      rawBody.bank?.address_line2 ||
      rawBody.bank?.address?.line2 ||
      "";
    const effective_body_city =
      (body_city as string) ||
      rawBody.city ||
      rawBody.address?.city ||
      rawBody.billing?.city ||
      rawBody.billing?.address?.city ||
      rawBody.card?.city ||
      rawBody.card?.address?.city ||
      rawBody.bank?.city ||
      rawBody.bank?.address?.city ||
      "";
    const effective_body_region =
      (body_region as string) ||
      rawBody.region ||
      rawBody.address?.region ||
      rawBody.billing?.region ||
      rawBody.billing?.address?.region ||
      rawBody.card?.region ||
      rawBody.card?.address?.region ||
      rawBody.bank?.region ||
      rawBody.bank?.address?.region ||
      "";
    const effective_body_country =
      (body_country as string) ||
      rawBody.country ||
      rawBody.address?.country ||
      rawBody.billing?.country ||
      rawBody.card?.country ||
      rawBody.card?.address?.country ||
      rawBody.bank?.country ||
      rawBody.bank?.address?.country ||
      "";
    const effective_postal =
      (postal_code as string) ||
      rawBody.postalCode ||
      rawBody.postal_code ||
      rawBody.card?.postal_code ||
      rawBody.card?.postalCode ||
      rawBody.card?.address?.postal_code ||
      rawBody.bank?.postal_code ||
      rawBody.bank?.postalCode ||
      rawBody.address?.postal_code ||
      rawBody.address?.postalCode ||
      "";
    let authorizationId: string | undefined = undefined;
    const buyer_user_id = req.user?.dialist_id;
    const buyer_clerk_id = req.user?.userId;

    logger.info("[Order] Payment processing started", {
      order_id: id,
      buyer_user_id,
      buyer_clerk_id,
      has_payment_token: !!payment_token,
      has_card_data: !!card,
    });

    // validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.warn("[Order] Invalid ObjectId format", {
        order_id: id,
        buyer_user_id,
      });
      throw new ValidationError("Invalid order ID format");
    }

    if (!payment_token && !card && !bank && !payment_instrument_id) {
      logger.warn("[Order] Payment failed: no payment method provided", {
        order_id: id,
        buyer_user_id,
      });
      throw new ValidationError(
        "payment_token is required for payment processing"
      );
    }

    // get order
    const order = await Order.findById(id);

    if (!order) {
      logger.warn("[Order] Payment failed: order not found", {
        order_id: id,
        buyer_user_id,
      });
      throw new ValidationError("Order not found");
    }

    logger.info("[Order] Order found for payment", {
      order_id: id,
      order_status: order.status,
      order_buyer_id: order.buyer_id.toString(),
      current_user_id: buyer_user_id,
    });

    // verify buyer
    if (order.buyer_id.toString() !== buyer_user_id) {
      logger.warn("[Order] Payment failed: not authorized", {
        order_id: id,
        order_buyer_id: order.buyer_id.toString(),
        current_user_id: buyer_user_id,
      });
      throw new AuthorizationError(
        "You are not authorized to access this order",
        {
          order_id: id,
          buyer_user_id,
        }
      );
    }

    // Check reservation expired
    if (
      order.reservation_expires_at &&
      order.reservation_expires_at < new Date()
    ) {
      logger.warn("[Order] Payment failed: reservation expired", {
        order_id: id,
        expired_at: order.reservation_expires_at,
      });

      await order.updateOne({
        status: "expired",
      });
      await MarketplaceListing.findByIdAndUpdate(order.listing_id, {
        $unset: {
          reserved_until: 1,
          reserved_by_user_id: 1,
          reserved_by_order_id: 1,
        },
      });

      throw new ValidationError("Reservation has expired for this order");
    }

    // check if already paid
    if (order.status === "paid" || order.status === "completed") {
      logger.info("[Order] Payment skipped: order already paid", {
        order_id: id,
        order_status: order.status,
        buyer_user_id,
      });
      throw new ValidationError("Order has already been paid");
    }

    // Get seller's merchant account
    const { MerchantOnboarding } = await import("../models/MerchantOnboarding");

    const listing = await MarketplaceListing.findById(order.listing_id);

    if (!listing) {
      logger.error("[Order] Payment failed: listing not found", {
        order_id: id,
        listing_id: order.listing_id.toString(),
      });
      throw new NotFoundError("Associated listing not found");
    }

    const merchantOnboarding = await MerchantOnboarding.findOne({
      dialist_user_id: listing.dialist_id,
      onboarding_state: "APPROVED",
    });

    if (!merchantOnboarding) {
      logger.error("[Order] Payment failed: seller has no merchant account", {
        order_id: id,
        seller_id: order.seller_id,
      });
      throw new ValidationError(
        "Seller does not have a valid merchant account to process payments"
      );
    }
    logger.info("[Order] Merchant account found", {
      merchant_id: merchantOnboarding.merchant_id,
    });

    // Finix functions already imported statically at top

    // Validate buyer identity exists before payment processing
    if (!order.finix_buyer_identity_id) {
      logger.error("[Order] Missing buyer identity", {
        order_id: id,
        buyer_user_id,
      });
      throw new ValidationError(
        "Buyer identity not found. Please request tokenization config first."
      );
    }

    // Determine effective fraud_session_id to use for Finix API calls
    let effectiveFraudSessionId = order.fraud_session_id as string | undefined;
    if (fraud_session_id) {
      effectiveFraudSessionId = fraud_session_id;
      await order.updateOne({ fraud_session_id: fraud_session_id });
      // also update local order object so subsequent use reflects the new value
      order.fraud_session_id = fraud_session_id as any;
    }

    // Step 1: Create Payment Instrument (choose method based on input)
    let paymentInstrument: {
      payment_instrument_id: string;
      card_type?: string;
      last_four?: string;
      brand?: string;
      instrument_type?: string;
    };

    // FINIX CERTIFICATION: For token-based payments, address is embedded in the token
    // and validated by Finix during tokenization. No need for separate address validation.

    if (payment_token) {
      // FINIX CERTIFICATION: Token-based payments (Finix.js with showAddress: true)
      // The address is already collected and embedded in the token during tokenization.
      // Finix validates the address when creating the token. We do NOT require
      // address fields separately - they're optional overrides.
      logger.info("[Order] Creating payment instrument from token", {
        order_id: id,
        buyer_identity_id: order.finix_buyer_identity_id,
      });

      // Normalize postal code if provided (optional - address is in token)
      const finixCountry = req.user?.location_country === "CA" ? "CAN" : "USA";
      let normalizedPostal: string | null = null;
      if (effective_postal) {
        normalizedPostal = validateAndFormatPostalCode(
          effective_postal,
          finixCountry
        );
        if (!normalizedPostal) {
          logger.warn(
            "[Order] Payment warning: invalid postal_code format provided",
            {
              order_id: id,
              postal_code,
            }
          );
          // Don't throw - address is in token, this is just an optional override
        }
      }

      // FINIX CERTIFICATION: For token-based payments (Finix.js with showAddress: true),
      // the address is already collected and embedded in the token during tokenization.
      // Finix validates the address when the token is created. We do NOT need to
      // re-validate or require the address separately here.
      // See: https://finix.com/docs/guides/online-payments/payment-tokenization
      logger.info(
        "[Order] Token-based payment: address validated by Finix during tokenization",
        {
          order_id: id,
          token_prefix: payment_token?.substring(0, 10) + "...",
          has_explicit_address: !!(effective_body_line1 || effective_postal),
        }
      );

      paymentInstrument = await createPaymentInstrument({
        token: payment_token,
        identity_id: order.finix_buyer_identity_id!,
        fraud_session_id: effectiveFraudSessionId, // FINIX CERTIFICATION: Always pass fraud_session_id
        postal_code: normalizedPostal || null,
        address_line1: effective_body_line1 || body_line1 || undefined,
        address_line2: effective_body_line2 || body_line2 || undefined,
        address_city: effective_body_city || body_city || undefined,
        address_region: effective_body_region || body_region || undefined,
        address_country: effective_body_country || body_country || undefined,
        idempotencyKey: idempotency_id,
        idempotency_id: idempotency_id,
      });

      // FINIX CERTIFICATION: Log token → PI conversion for audit trail
      logger.info(
        "[Order] ✅ Payment Instrument created FROM TOKEN (Finix Certification)",
        {
          order_id: id,
          payment_instrument_id: paymentInstrument.payment_instrument_id,
          token_used: payment_token,
          source: "finix_tokenization",
          has_fraud_session_id: !!effectiveFraudSessionId,
          fraud_session_id_prefix: effectiveFraudSessionId?.substring(0, 20),
        }
      );
    } else if (payment_instrument_id) {
      // Use existing payment instrument
      // FINIX CERTIFICATION: Support reused payment instruments (saved cards)
      logger.info(
        "[Order] Using existing Payment Instrument",
        {
          order_id: id,
          payment_instrument_id,
        }
      );
      
      const piDetails = await getPaymentInstrument(payment_instrument_id);
      
      // Map to local structure if needed, or simply use the ID
      paymentInstrument = {
        payment_instrument_id: piDetails.id, 
        // We might not have all PI details here like card_type unless we fetch it, 
        // but the downstream logic relies mostly on the ID.
        // We should ensure getPaymentInstrument returns expected format or fetch logic is solid.
        // Assuming getPaymentInstrument returns the Finix PI object.
      };
      
    } else {
      throw new ValidationError(
        "payment_token or payment_instrument_id is required for payment processing"
      );
    }

    // Validate AVS/CVV checks via Finix payment instrument
    // FINIX CERTIFICATION: Properly handle and return AVS/CVV verification failures
    let avsResult: string | undefined;
    let cvvResult: string | undefined;
    try {
      const pi = await getPaymentInstrument(
        paymentInstrument.payment_instrument_id
      );
      avsResult = pi.address_verification;
      cvvResult = pi.security_code_verification;
      const bankCheck = pi.bank_account_validation_check;
      const instrumentTypeFromPi = pi.type;

      logger.info("[Order] Payment instrument verification status", {
        order_id: id,
        payment_instrument_id: paymentInstrument.payment_instrument_id,
        avs: avsResult,
        cvv: cvvResult,
      });

      // Address verification: NO_MATCH -> failed
      if (avsResult === "NO_MATCH") {
        logger.warn("[Order] Payment blocked: AVS no-match", { order_id: id });
        throw new PaymentError("Address verification failed for this card", {
          failure_code: "AVS_MISMATCH",
          failure_message:
            "The billing address does not match the card issuer records",
          avs_result: avsResult,
          payment_instrument_id: paymentInstrument.payment_instrument_id,
        });
      }

      // Security code verification: UNMATCHED -> failed
      if (cvvResult === "UNMATCHED") {
        logger.warn("[Order] Payment blocked: CVV mismatch", { order_id: id });
        throw new PaymentError("Security code verification failed", {
          failure_code: "CVV_MISMATCH",
          failure_message: "The CVV/CVC code does not match",
          cvv_result: cvvResult,
          payment_instrument_id: paymentInstrument.payment_instrument_id,
        });
      }

      // FINIX CERTIFICATION: Bank account validation checks
      // Per Finix docs: bank_account_validation_check can be VALID, INVALID, INCONCLUSIVE, or NOT_ATTEMPTED
      if (instrumentTypeFromPi === "BANK_ACCOUNT") {
        logger.info("[Order] Bank validation check", {
          bankCheck,
          payment_instrument_id: paymentInstrument.payment_instrument_id,
        });

        // Reject INVALID bank accounts immediately
        if (bankCheck === "INVALID") {
          logger.warn("[Order] Bank account validation INVALID", {
            payment_instrument_id: paymentInstrument.payment_instrument_id,
          });
          throw new PaymentError(
            "The provided bank account failed validation. Please provide a different bank account.",
            {
              failure_code: "INVALID_BANK_ACCOUNT_VALIDATION_CHECK",
              failure_message:
                "The provided bank account failed validation. Please verify your routing and account numbers, or use a different bank account.",
              payment_instrument_id: paymentInstrument.payment_instrument_id,
              raw_error: {
                bank_account_validation_check: bankCheck,
                hint: "In sandbox, use Bank Code: 122105278, Account Number: 0000000016 for valid test accounts",
              },
            }
          );
        }

        // Warn about INCONCLUSIVE status (allow to proceed but may fail at Transfer creation)
        if (bankCheck === "INCONCLUSIVE" || bankCheck === "NOT_ATTEMPTED") {
          logger.warn(
            "[Order] Bank account validation inconclusive or not attempted",
            {
              bankCheck,
              payment_instrument_id: paymentInstrument.payment_instrument_id,
              note: "Transfer creation may fail if bank account is invalid",
            }
          );
        }

        // Log successful VALID check
        if (bankCheck === "VALID") {
          logger.info("[Order] Bank account validation VALID", {
            payment_instrument_id: paymentInstrument.payment_instrument_id,
          });
        }
      }
    } catch (err) {
      // Re-throw PaymentError as-is
      if (err instanceof PaymentError) throw err;

      // Any other Finix lookup error should be treated as a payment failure
      logger.error("[Order] Failed to validate payment instrument", {
        error: err,
      });
      throw new PaymentError("Unable to validate payment instrument", {
        failure_code: "PROCESSING_ERROR",
        failure_message:
          "Failed to validate payment instrument with payment processor",
        payment_instrument_id: paymentInstrument.payment_instrument_id,
        raw_error: (err as Error).message,
      });
    }

    // Track payment method type for order record
    const paymentMethodType: "card" | "bank" | "token" = "token";
    
    // Determine source_type for Finix tags (token vs saved_instrument)
    const sourceType = (payment_instrument_id && !payment_token) ? "saved_instrument" : "token";

    // Decide flow based on instrument type
    // If it's a bank payment instrument (ACH/EFT), we create a Transfer directly
    let captureResult: any = null;
    const instrumentType = paymentInstrument.instrument_type || "PAYMENT_CARD";

    // FINIX CERTIFICATION: Log instrument type for audit trail
    logger.info("[Order] Payment instrument type detected", {
      order_id: id,
      instrument_type: instrumentType,
      payment_method: paymentMethodType,
      source_type: sourceType,
      payment_instrument_id: paymentInstrument.payment_instrument_id,
    });

    // FINIX CERTIFICATION: Wrap payment operations with PaymentError handling
    try {
      if (instrumentType === "BANK_ACCOUNT") {
        logger.info("[Order] Creating ACH/EFT transfer (direct debit)", {
          order_id: id,
          amount: order.amount,
          currency: order.currency,
          merchant_id: merchantOnboarding.merchant_id,
          payment_method: paymentMethodType,
        });

        // ACH Direct Debit (USD) / EFT (CAD): Just provide amount, currency, merchant, source
        // Finix automatically determines the operation based on instrument type
        // Do NOT include operation_key for ACH/EFT transfers
        // Per Finix docs: Transfer can return PENDING, SUCCEEDED, FAILED, CANCELED, or UNKNOWN
        const transfer = await createTransfer({
          amount: order.amount,
          merchant_id: merchantOnboarding.merchant_id!,
          source: paymentInstrument.payment_instrument_id,
          currency: order.currency, // USD or CAD
          // Note: operation_key is NOT used for ACH/EFT - Finix determines automatically
          idempotencyKey: idempotency_id || `transfer-${id}-${Date.now()}`,
          idempotency_id: idempotency_id || `transfer-${id}-${Date.now()}`,
          tags: {
            order_id: id,
            payment_method: paymentMethodType,
            source_type: sourceType,
          },
          fraud_session_id: effectiveFraudSessionId,
        });

        // FINIX CERTIFICATION: Validate ACH/EFT transfer state
        // ACH transfers typically start as PENDING and update via webhook
        logger.info("[Order] ACH/EFT Transfer created", {
          transfer_id: transfer.transfer_id,
          state: transfer.state,
          amount: transfer.amount,
          currency: order.currency,
        });

        captureResult = transfer;
      } else {
        // Step 2: Authorize Payment (card flow)
        logger.info("[Order] Authorizing payment", {
          amount: order.amount,
          merchant_id: merchantOnboarding.merchant_id,
        });

        const authorization = await authorizePayment({
          amount: order.amount,
          merchant_id: merchantOnboarding.merchant_id!,
          payment_instrument_id: paymentInstrument.payment_instrument_id,
          fraud_session_id: effectiveFraudSessionId!,
          idempotencyKey: idempotency_id,
          idempotency_id: idempotency_id,
          currency: order.currency,
          tags: {
            order_id: id,
            payment_method: paymentMethodType,
            source_type: sourceType,
          },
        });

        authorizationId = authorization.authorization_id;
        logger.info("[Order] Payment authorized", {
          authorization_id: authorizationId,
          status: authorization.state,
        });

        // Capture payment immediately (full amount)
        logger.info("[Order] Capturing payment", {
          authorization_id: authorizationId,
          amount: order.amount,
        });

        // Capture the full authorization amount
        // Note: Finix will create a Transfer synchronously (sent via transfer.created webhook)
        captureResult = await capturePayment({
          authorization_id: authorizationId,
          merchant_id: merchantOnboarding.merchant_id!,
          idempotencyKey: idempotency_id,
          idempotency_id: idempotency_id,
        });
      }
    } catch (err: any) {
      // Convert Finix errors to PaymentError with detailed failure info
      // FINIX CERTIFICATION: Extract unique failure codes for each decline scenario

      // Extract Finix failure details from error response
      const finixData = err.response?.data;
      let failureCode: string | undefined;
      let failureMessage: string | undefined;
      let transferId: string | undefined;

      // Log the full error for debugging
      logger.error(
        "[Order] Payment processing failed - extracting Finix details",
        {
          order_id: id,
          error_message: err.message,
          has_response_data: !!finixData,
          embedded_authorizations: !!finixData?._embedded?.authorizations,
          embedded_transfers: !!finixData?._embedded?.transfers,
          embedded_errors: !!finixData?._embedded?.errors,
        }
      );

      // Check for embedded authorization errors (card payments)
      if (finixData?._embedded?.authorizations?.[0]) {
        const auth = finixData._embedded.authorizations[0];
        failureCode = auth.failure_code;
        failureMessage =
          auth.failure_message || auth.messages?.[0]?.description;
        authorizationId = auth.id;

        logger.warn(
          "[Order] Card authorization failed with Finix failure_code",
          {
            order_id: id,
            authorization_id: auth.id,
            failure_code: failureCode,
            failure_message: failureMessage,
            state: auth.state,
            messages: auth.messages,
          }
        );
      }
      // Check for embedded transfer errors (ACH/EFT payments)
      else if (finixData?._embedded?.transfers?.[0]) {
        const transfer = finixData._embedded.transfers[0];
        failureCode = transfer.failure_code;
        failureMessage =
          transfer.failure_message || transfer.messages?.[0]?.description;
        transferId = transfer.id;

        logger.warn("[Order] Transfer failed with Finix failure_code", {
          order_id: id,
          transfer_id: transfer.id,
          failure_code: failureCode,
          failure_message: failureMessage,
          state: transfer.state,
          messages: transfer.messages,
        });
      }
      // Check for generic Finix API errors
      else if (finixData?._embedded?.errors?.[0]) {
        const error = finixData._embedded.errors[0];
        failureCode = error.code;
        failureMessage = error.message;

        logger.warn("[Order] Finix API error", {
          order_id: id,
          error_code: failureCode,
          error_message: failureMessage,
        });
      }
      // Fallback to direct message
      else if (finixData?.message) {
        failureMessage = finixData.message;

        logger.warn("[Order] Finix error message", {
          order_id: id,
          message: failureMessage,
        });
      }

      // FINIX CERTIFICATION: Map error message patterns to specific failure codes
      // This ensures we get a unique failure_code even when Finix doesn't provide one
      if (!failureCode) {
        const errorMsg = (err.message || failureMessage || "").toLowerCase();

        // Card decline patterns
        if (
          errorMsg.includes("generic_decline") ||
          errorMsg.includes("generic decline")
        ) {
          failureCode = "GENERIC_DECLINE";
        } else if (
          errorMsg.includes("insufficient") ||
          errorMsg.includes("nsf")
        ) {
          failureCode = "INSUFFICIENT_FUNDS";
        } else if (errorMsg.includes("fraud") && errorMsg.includes("finix")) {
          failureCode = "FRAUD_DETECTED_BY_FINIX";
        } else if (errorMsg.includes("fraud") && errorMsg.includes("issuer")) {
          failureCode = "FRAUD_DETECTED_BY_ISSUER";
        } else if (errorMsg.includes("fraud")) {
          failureCode = "FRAUD_DETECTED";
        } else if (errorMsg.includes("expired")) {
          failureCode = "EXPIRED_CARD";
        } else if (
          errorMsg.includes("invalid card") ||
          errorMsg.includes("invalid number")
        ) {
          failureCode = "INVALID_CARD_NUMBER";
        } else if (
          errorMsg.includes("do not honor") ||
          errorMsg.includes("do_not_honor")
        ) {
          failureCode = "DO_NOT_HONOR";
        } else if (
          errorMsg.includes("call issuer") ||
          errorMsg.includes("call_issuer")
        ) {
          failureCode = "CALL_ISSUER";
        } else if (errorMsg.includes("exceeds") && errorMsg.includes("limit")) {
          failureCode = "EXCEEDS_APPROVAL_LIMIT";
        } else if (errorMsg.includes("restricted")) {
          failureCode = "RESTRICTED_CARD";
        } else if (errorMsg.includes("lost") || errorMsg.includes("stolen")) {
          failureCode = "LOST_OR_STOLEN_CARD";
        } else if (
          errorMsg.includes("pick up") ||
          errorMsg.includes("pickup")
        ) {
          failureCode = "PICK_UP_CARD";
        } else if (
          errorMsg.includes("not activated") ||
          errorMsg.includes("blocked")
        ) {
          failureCode = "CARD_NOT_ACTIVATED_OR_BLOCKED";
        } else if (
          errorMsg.includes("invalid cvv") ||
          errorMsg.includes("cvv")
        ) {
          failureCode = "INVALID_CVV";
        } else if (errorMsg.includes("policy violation")) {
          failureCode = "ISSUER_POLICY_VIOLATION";
        }
        // ACH/Bank patterns
        else if (
          errorMsg.includes("account closed") ||
          errorMsg.includes("r02")
        ) {
          failureCode = "BANK_ACCOUNT_CLOSED";
        } else if (
          errorMsg.includes("no account") ||
          errorMsg.includes("r03")
        ) {
          failureCode = "NO_BANK_ACCOUNT_FOUND";
        } else if (
          errorMsg.includes("invalid account") ||
          errorMsg.includes("r04")
        ) {
          failureCode = "INVALID_BANK_ACCOUNT_NUMBER";
        } else if (errorMsg.includes("invalid routing")) {
          failureCode = "INVALID_ROUTING_NUMBER";
        } else if (errorMsg.includes("unauthorized")) {
          failureCode = "UNAUTHORIZED_DEBIT";
        }
        // Generic fallback
        else if (errorMsg.includes("decline")) {
          failureCode = "GENERIC_DECLINE";
        } else {
          failureCode = "PROCESSING_ERROR";
        }

        logger.info("[Order] Mapped error message to failure_code", {
          order_id: id,
          original_message: errorMsg.substring(0, 100),
          mapped_failure_code: failureCode,
        });
      }

      // Build PaymentError with proper typing
      const errorDetails: {
        failure_code: string;
        failure_message?: string;
        avs_result?: string;
        cvv_result?: string;
        authorization_id?: string;
        transfer_id?: string;
        payment_instrument_id: string;
        raw_error?: unknown;
      } = {
        failure_code: failureCode,
        payment_instrument_id: paymentInstrument.payment_instrument_id,
      };

      // Only add optional fields if they have values
      if (failureMessage) errorDetails.failure_message = failureMessage;
      if (avsResult) errorDetails.avs_result = avsResult;
      if (cvvResult) errorDetails.cvv_result = cvvResult;
      if (authorizationId) errorDetails.authorization_id = authorizationId;
      if (transferId) errorDetails.transfer_id = transferId;
      if (finixData || err.message)
        errorDetails.raw_error = finixData || err.message;

      // Log the final PaymentError details being thrown
      logger.error(
        "[Order] Throwing PaymentError with unique failure details",
        {
          order_id: id,
          failure_code: failureCode,
          failure_message: failureMessage,
          authorization_id: authorizationId,
          transfer_id: transferId,
          avs_result: avsResult,
          cvv_result: cvvResult,
        }
      );

      throw new PaymentError(
        failureMessage || err.message || "Payment processing failed",
        errorDetails
      );
    }

    logger.info(
      "[Order] Payment captured - transfer created, waiting for webhook",
      {
        authorization_id: authorizationId,
        transfer_id: captureResult.transfer_id,
        transfer_state: captureResult.state,
        trace_id: captureResult.trace_id,
      }
    );

    // FINIX CERTIFICATION: Validate transfer state per Finix documentation
    // States: PENDING (async), SUCCEEDED (instant), FAILED, CANCELED, UNKNOWN
    // Most sandboxes return SUCCEEDED instantly, but production may return PENDING
    if (captureResult.state === "FAILED") {
      logger.error("[Order] Transfer FAILED immediately after capture", {
        order_id: id,
        transfer_id: captureResult.transfer_id,
        failure_code: captureResult.failure_code,
        failure_message: captureResult.failure_message,
      });
      throw new PaymentError(
        captureResult.failure_message || "Transfer failed",
        {
          failure_code: captureResult.failure_code || "TRANSFER_FAILED",
          failure_message:
            captureResult.failure_message || "The transfer was declined",
          transfer_id: captureResult.transfer_id,
          payment_instrument_id: paymentInstrument.payment_instrument_id,
        }
      );
    } else if (captureResult.state === "CANCELED") {
      logger.error("[Order] Transfer CANCELED by processor", {
        order_id: id,
        transfer_id: captureResult.transfer_id,
      });
      throw new PaymentError(
        "Payment was canceled by the processor. Please contact support.",
        {
          failure_code: "TRANSFER_CANCELED",
          failure_message: "Transfer canceled by payment processor",
          transfer_id: captureResult.transfer_id,
          payment_instrument_id: paymentInstrument.payment_instrument_id,
        }
      );
    } else if (captureResult.state === "UNKNOWN") {
      logger.warn("[Order] Transfer state UNKNOWN - connection issue", {
        order_id: id,
        transfer_id: captureResult.transfer_id,
      });
      // Don't throw - UNKNOWN means we should retry or wait for webhook
      // Mark as processing and let webhook update the final state
    }

    // ✅ Mark order as "processing" - transfer.created webhook will update to "paid"
    await order.updateOne({
      status: "processing",
      finix_payment_instrument_id: paymentInstrument.payment_instrument_id,
      ...(captureResult.authorization_id && {
        finix_authorization_id: captureResult.authorization_id,
      }),
      finix_transfer_id: captureResult.transfer_id,
      payment_method: paymentMethodType, // Track payment method (card, bank, token)
      metadata: {
        ...order.metadata,
        transfer_state: captureResult.state,
        transfer_created_at: new Date().toISOString(),
        instrument_type: instrumentType,
        currency: order.currency,
      },
    });

    logger.info(
      "[Order] Payment capture successful - awaiting transfer confirmation",
      {
        order_id: id,
        authorization_id: authorizationId,
      }
    );

    // Send system message to Stream Chat channel if it exists
    if (order.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          order.getstream_channel_id,
          { 
            type: "order_paid", 
            amount: order.amount, 
            order_id: order._id.toString() 
          },
          buyer_user_id
        );
      } catch (chatError) {
        logger.warn("Failed to send payment message to Stream", { chatError });
      }
    }

    // Notification for Seller
    try {
      await Notification.create({
        user_id: order.seller_id,
        type: "order_paid",
        title: "Payment Received",
        body: `Payment of $${(order.amount / 100).toLocaleString()} received for ${order.listing_snapshot.brand} ${order.listing_snapshot.model}`,
        data: {
          order_id: order._id.toString(),
          amount: order.amount,
        },
        action_url: `/orders/${order._id}`,
      });
    } catch (notifError) {
      logger.warn("Failed to create payment notification", { notifError });
    }

    res.json({
      success: true,
      data: {
        order_id: order._id.toString(),
        status: "processing",
        finix_payment_instrument_id: paymentInstrument.payment_instrument_id,
        finix_authorization_id: captureResult.authorization_id || undefined,
        finix_transfer_id: captureResult.transfer_id || undefined,
        payment_details: {
          instrument_type: paymentInstrument.instrument_type,
          payment_method: paymentMethodType,
          card_type: paymentInstrument.card_type,
          last_four: paymentInstrument.last_four,
          brand: paymentInstrument.brand,
          currency: order.currency,
        },
        // ACH/EFT confirmation message with authorization language
        message:
          instrumentType === "BANK_ACCOUNT"
            ? `Bank payment authorized for ${order.currency} ${(
                order.amount / 100
              ).toFixed(
                2
              )}. By completing this payment, you authorize Dialist to debit your bank account for this transaction.`
            : "Payment is processing. You'll receive confirmation shortly.",
        ach_authorization:
          instrumentType === "BANK_ACCOUNT"
            ? {
                authorized: true,
                authorization_text: `I authorize Dialist to electronically debit my account and, if necessary, electronically credit my account to correct erroneous debits.`,
                amount: order.amount,
                currency: order.currency,
              }
            : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 4: Upload tracking (Seller Only)
 * POST /api/v1/marketplace/orders/:id/tracking
 */

export const uploadTracking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    // Accept both "carrier" and "tracking_carrier" for flexibility
    const { tracking_number, carrier, tracking_carrier } = req.body;
    const carrierValue = carrier || tracking_carrier;
    const seller_clerk_id = req.user?.dialist_id;

    logger.info("[Order] Upload tracking request started", {
      order_id: id,
      tracking_number,
      carrier: carrierValue,
    });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid order ID format");
    }

    if (!tracking_number) {
      throw new ValidationError("tracking_number is required");
    }

    // Further implementation goes here...

    const order = await Order.findById(id);

    if (!order) {
      logger.warn("[Order] Upload tracking failed: order not found", {
        order_id: id,
      });
      throw new NotFoundError("Order not found");
    }

    logger.info("[Order] Order found for tracking upload", {
      order_id: id,
      order_seller_id: order.seller_id.toString(),
      current_seller_id: seller_clerk_id,
    });

    // verify seller
    if (order.seller_id.toString() !== seller_clerk_id) {
      logger.warn("[Order] Upload tracking failed: not authorized", {
        order_id: id,
        order_seller_id: order.seller_id.toString(),
        current_seller_id: seller_clerk_id,
      });
      throw new AuthorizationError(
        "Only the seller can upload tracking information",
        { order_id: id, seller_id: seller_clerk_id }
      );
    }

    // Must be paid first (or processing - payment initiated)
    if (!["paid", "processing"].includes(order.status)) {
      logger.warn("[Order] Tracking upload failed: order not paid", {
        order_id: id,
        current_status: order.status,
      });
      throw new ValidationError("Order must be paid before shipping");
    }

    await order.updateOne({
      status: "shipped",
      tracking_number,
      ...(carrierValue && { tracking_carrier: carrierValue }),
      shipped_at: new Date(),
    });

    logger.info("[Order] Tracking uploaded successfully", {
      order_id: id,
      tracking_number,
      carrier: carrierValue,
    });

    // Send system message to Stream Chat channel if it exists
    if (order.getstream_channel_id) {
      try {
        await chatService.sendSystemMessage(
          order.getstream_channel_id,
          { 
            type: "order_shipped", 
            order_id: order._id.toString() 
          },
          seller_clerk_id
        );
      } catch (chatError) {
        logger.warn("Failed to send shipping message to Stream", { chatError });
      }
    }

    // Notification for Buyer
    try {
      await Notification.create({
        user_id: order.buyer_id,
        type: "order_shipped",
        title: "Order Shipped!",
        body: `Your order for ${order.listing_snapshot.brand} ${order.listing_snapshot.model} has been shipped.`,
        data: {
          order_id: order._id.toString(),
          tracking_number,
          carrier: carrierValue,
        },
        action_url: `/orders/${order._id}`,
      });
    } catch (notifError) {
      logger.warn("Failed to create shipping notification", { notifError });
    }

    res.json({
      success: true,
      data: {
        order_id: order._id.toString(),
        status: "shipped",
        tracking_number,
        ...(carrierValue && { tracking_carrier: carrierValue }),
        shipped_at: new Date(),
        message: "Tracking information uploaded successfully",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * STEP 5: CONFIRM DELIVERY (Buyer Only)
 * POST /api/v1/marketplace/orders/:id/confirm-delivery
 */

export const confirmDelivery = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const buyer_user_id = req.user?.dialist_id;

    logger.info("[Order] Confirm delivery request", {
      order_id: id,
      buyer_user_id,
    });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid order ID format");
    }

    const order = await Order.findById(id);
    if (!order) {
      logger.warn("[Order] Confirm delivery failed: order not found", {
        order_id: id,
      });
      throw new NotFoundError("Order not found");
    }

    logger.info("[Order] Order found for delivery confirmation", {
      order_id: id,
      order_status: order.status,
      order_buyer_id: order.buyer_id.toString(),
      current_user_id: buyer_user_id,
    });

    // Verify buyer
    if (order.buyer_id.toString() !== buyer_user_id) {
      logger.warn("[Order] Confirm delivery failed: not authorized", {
        order_id: id,
        order_buyer_id: order.buyer_id.toString(),
        current_user_id: buyer_user_id,
      });
      throw new AuthorizationError("Only the buyer can confirm delivery", {
        order_id: id,
        buyer_id: buyer_user_id,
      });
    }

    // Must be shipped first
    if (order.status !== "shipped") {
      logger.warn("[Order] Confirm delivery failed: not shipped", {
        order_id: id,
        current_status: order.status,
      });
      throw new ValidationError(
        "Order must be shipped before confirming delivery"
      );
    }

    await order.updateOne({
      status: "completed",
      delivered_at: new Date(),
    });

    logger.info("[Order] Delivery confirmed successfully", {
      order_id: id,
    });

    // Send system message to Stream Chat channel if it exists
    if (order.getstream_channel_id) {
      try {
        // First send order completed
        await chatService.sendSystemMessage(
          order.getstream_channel_id,
          { 
            type: "order_completed", 
            order_id: order._id.toString() 
          },
          buyer_user_id
        );

        // Then send listing sold
        await chatService.sendSystemMessage(
          order.getstream_channel_id,
          { 
            type: "listing_sold", 
            order_id: order._id.toString() 
          },
          buyer_user_id
        );
      } catch (chatError) {
        logger.warn("Failed to send completion messages to Stream", { chatError });
      }
    }

    // Notification for Seller
    try {
      await Notification.create({
        user_id: order.seller_id,
        type: "order_completed",
        title: "Order Completed",
        body: `Buyer has confirmed delivery for ${order.listing_snapshot.brand} ${order.listing_snapshot.model}. Funds will be released.`,
        data: {
          order_id: order._id.toString(),
        },
        action_url: `/orders/${order._id}`,
      });
    } catch (notifError) {
      logger.warn("Failed to create completion notification", { notifError });
    }

    res.json({
      success: true,
      data: {
        order_id: order._id.toString(),
        status: "completed",
        delivered_at: new Date(),
        message: "Delivery confirmed. Funds will be released to the seller.",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * CANCEL ORDER (Buyer Only, Before Payment)
 * POST /api/v1/marketplace/orders/:id/cancel
 */

export const cancelOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const buyer_user_id = req.user?.dialist_id;

    logger.info("[Order] Cancel order request", {
      order_id: id,
      buyer_user_id,
    });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid order ID format");
    }

    const order = await Order.findById(id);
    if (!order) {
      logger.warn("[Order] Cancel failed: order not found", {
        order_id: id,
      });
      throw new NotFoundError("Order not found");
    }

    logger.info("[Order] Order found for cancellation", {
      order_id: id,
      order_status: order.status,
      order_buyer_id: order.buyer_id.toString(),
      current_user_id: buyer_user_id,
    });

    // Verify buyer
    if (order.buyer_id.toString() !== buyer_user_id) {
      logger.warn("[Order] Cancel failed: not authorized", {
        order_id: id,
        order_buyer_id: order.buyer_id.toString(),
        current_user_id: buyer_user_id,
      });
      throw new AuthorizationError("Only the buyer can cancel this order", {
        order_id: id,
        buyer_id: buyer_user_id,
      });
    }

    // Can only cancel if reserved or pending
    if (!["reserved", "pending"].includes(order.status)) {
      logger.warn("[Order] Cancel failed: invalid status", {
        order_id: id,
        current_status: order.status,
      });
      throw new ValidationError(
        "Cannot cancel order after payment has been processed"
      );
    }

    await order.updateOne({ status: "cancelled" });

    // Release listing
    await MarketplaceListing.findByIdAndUpdate(order.listing_id, {
      $unset: {
        reserved_until: 1,
        reserved_by_user_id: 1,
        reserved_by_order_id: 1,
      },
    });

    logger.info("[Order] Order cancelled successfully", {
      order_id: id,
    });

    res.json({
      success: true,
      data: {
        order_id: order._id.toString(),
        status: "cancelled",
        message: "Order cancelled successfully. Listing is now available.",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * REQUEST REFUND (Buyer submits refund request with reason)
 * POST /api/v1/marketplace/orders/:id/refund-request
 *
 * FINIX CERTIFICATION - Buyer Request / Seller Approval Flow:
 * 1. BUYER requests a refund with a valid reason
 * 2. SELLER reviews the request and reason
 * 3. BUYER returns the product (provides tracking number)
 * 4. SELLER confirms product return received
 * 5. SELLER approves the refund
 * 6. BUYER receives the refund
 */
export const requestRefund = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { refund_amount, reason, idempotency_id } = req.body || {};
    const requester_user_id = req.user?.dialist_id;

    logger.info("[Order] Refund request initiated", {
      order_id: id,
      requester_user_id,
      reason,
    });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid order ID format");
    }

    // Reason is required for refund requests
    if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
      throw new ValidationError(
        "A valid reason (minimum 10 characters) is required for refund requests"
      );
    }

    const order = await Order.findById(id);
    if (!order) {
      logger.warn("[Order] Refund request failed: order not found", {
        order_id: id,
      });
      throw new NotFoundError("Order not found");
    }

    // Only buyer can request refunds
    if (order.buyer_id.toString() !== requester_user_id) {
      logger.warn("[Order] Refund request failed: not buyer", {
        order_id: id,
        buyer_id: order.buyer_id.toString(),
        requester_user_id,
      });
      throw new AuthorizationError(
        "Only the buyer can request refunds for their purchased items",
        { order_id: id }
      );
    }

    // Check if there's already a pending refund request
    const existingRequest = await RefundRequest.findOne({
      order_id: order._id,
      status: "pending",
    });

    if (existingRequest) {
      throw new ValidationError(
        "A refund request is already pending for this order. Wait for seller review or cancellation."
      );
    }

    if (!order.finix_transfer_id) {
      logger.warn("[Order] Refund request failed: no transfer associated", {
        order_id: id,
      });
      throw new ValidationError("No transfer found for this order to refund");
    }

    // Fetch transfer to validate status and amount
    const transfer = await getTransfer(order.finix_transfer_id);

    if (!transfer) {
      logger.error(
        "[Order] Refund request failed: transfer not found in Finix",
        {
          order_id: id,
          transfer_id: order.finix_transfer_id,
        }
      );
      throw new ValidationError("Transfer not found");
    }

    // Only refunds on SUCCEEDED transfers
    if (transfer.state !== "SUCCEEDED") {
      logger.warn("[Order] Refund request failed: transfer not SUCCEEDED", {
        order_id: id,
        transfer_id: order.finix_transfer_id,
        state: transfer.state,
      });
      throw new ValidationError(
        "Transfer must be SUCCEEDED before requesting refund"
      );
    }

    // Calculate refund amount in cents
    let refundAmountCents: number;
    if (refund_amount === undefined || refund_amount === null) {
      refundAmountCents = transfer.amount;
    } else {
      const parsed =
        typeof refund_amount === "string"
          ? parseFloat(refund_amount as string)
          : (refund_amount as number);

      if (Number.isNaN(parsed) || !isFinite(parsed)) {
        throw new ValidationError("Invalid refund_amount value");
      }

      if (Number.isInteger(parsed)) {
        refundAmountCents = parsed as number;
      } else {
        refundAmountCents = Math.round(parsed * 100);
      }
    }

    if (!Number.isInteger(refundAmountCents) || refundAmountCents < 1) {
      throw new ValidationError(
        "refund_amount must be an integer >= 1 (in cents)"
      );
    }

    if (refundAmountCents > transfer.amount) {
      throw new ValidationError(
        `Refund amount cannot exceed original transfer amount (${transfer.amount} cents)`
      );
    }

    // Create refund request (pending seller review and approval)
    const refundRequest = new RefundRequest({
      order_id: order._id,
      seller_id: order.seller_id,
      buyer_id: order.buyer_id,
      requested_amount: refundAmountCents,
      original_transfer_amount: transfer.amount,
      buyer_reason: reason.trim(),
      status: "pending",
      product_returned: false,
      product_return_confirmed: false,
      finix_transfer_id: order.finix_transfer_id,
      idempotency_id: idempotency_id || crypto.randomUUID(),
    });

    await refundRequest.save();

    // Create audit log
    await createAuditLog({
      action: "REFUND_REQUESTED",
      user_id: requester_user_id!,
      resource_type: "order",
      resource_id: order._id.toString(),
      details: {
        refund_request_id: refundRequest._id.toString(),
        requested_amount: refundAmountCents,
        reason: reason.trim(),
        transfer_id: order.finix_transfer_id,
      },
      ip_address: req.ip,
      user_agent: req.get("user-agent"),
    });

    // Update order with pending refund request reference
    order.metadata = {
      ...order.metadata,
      pending_refund_request: {
        request_id: refundRequest._id.toString(),
        requested_at: new Date().toISOString(),
        amount: refundAmountCents,
      },
    };
    await order.save();

    logger.info("[Order] Refund request created, awaiting seller review", {
      order_id: id,
      refund_request_id: refundRequest._id.toString(),
      amount: refundAmountCents,
    });

    res.status(201).json({
      success: true,
      data: {
        refund_request_id: refundRequest._id.toString(),
        order_id: order._id.toString(),
        status: "pending",
        requested_amount: refundAmountCents,
        buyer_reason: reason.trim(),
        message:
          "Refund request submitted. Please return the product and await seller approval.",
        next_steps: [
          "1. Return the product to the seller",
          "2. Provide tracking number via /submit-return endpoint",
          "3. Seller will confirm product receipt",
          "4. Seller will approve the refund",
        ],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * SUBMIT PRODUCT RETURN (Buyer provides return tracking info)
 * POST /api/v1/marketplace/refund-requests/:id/submit-return
 *
 * After requesting a refund, buyer must return the product before
 * the seller can approve the refund.
 */
export const submitProductReturn = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { tracking_number, return_notes } = req.body || {};
    const requester_user_id = req.user?.dialist_id;

    logger.info("[Refund] Submit product return", {
      refund_request_id: id,
      requester_user_id,
      tracking_number,
    });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid refund request ID format");
    }

    const refundRequest = await RefundRequest.findById(id);
    if (!refundRequest) {
      throw new NotFoundError("Refund request not found");
    }

    // Only buyer can submit return info
    if (refundRequest.buyer_id.toString() !== requester_user_id) {
      throw new AuthorizationError(
        "Only the buyer can submit return information",
        { refund_request_id: id }
      );
    }

    if (refundRequest.status !== "pending") {
      throw new ValidationError(
        `Cannot submit return for this request. Current status: ${refundRequest.status}`
      );
    }

    if (refundRequest.product_returned) {
      throw new ValidationError(
        "Return information has already been submitted"
      );
    }

    // Update refund request with return info
    refundRequest.product_returned = true;
    refundRequest.return_tracking_number = tracking_number?.trim();
    refundRequest.status = "return_requested";
    if (return_notes) {
      refundRequest.buyer_reason = `${
        refundRequest.buyer_reason
      }\n\nReturn Notes: ${return_notes.trim()}`;
    }
    await refundRequest.save();

    // Create audit log
    await createAuditLog({
      action: "PRODUCT_RETURN_SUBMITTED",
      user_id: requester_user_id!,
      resource_type: "refund_request",
      resource_id: refundRequest._id.toString(),
      details: {
        order_id: refundRequest.order_id.toString(),
        tracking_number: tracking_number?.trim(),
      },
      ip_address: req.ip,
      user_agent: req.get("user-agent"),
    });

    logger.info("[Refund] Product return submitted", {
      refund_request_id: id,
      tracking_number: tracking_number?.trim(),
    });

    res.json({
      success: true,
      data: {
        refund_request_id: refundRequest._id.toString(),
        status: "return_requested",
        tracking_number: tracking_number?.trim(),
        message:
          "Return information submitted. Awaiting seller confirmation of product receipt.",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * CONFIRM PRODUCT RETURN (Seller confirms product received)
 * POST /api/v1/marketplace/refund-requests/:id/confirm-return
 *
 * Seller confirms they have received the returned product.
 * Only after this can the seller approve the refund.
 */
export const confirmProductReturn = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { confirmation_notes } = req.body || {};
    const requester_user_id = req.user?.dialist_id;

    logger.info("[Refund] Confirm product return", {
      refund_request_id: id,
      requester_user_id,
    });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid refund request ID format");
    }

    const refundRequest = await RefundRequest.findById(id);
    if (!refundRequest) {
      throw new NotFoundError("Refund request not found");
    }

    // Only seller can confirm product return
    if (refundRequest.seller_id.toString() !== requester_user_id) {
      throw new AuthorizationError(
        "Only the seller can confirm product return",
        { refund_request_id: id }
      );
    }

    if (
      refundRequest.status !== "return_requested" &&
      refundRequest.status !== "pending"
    ) {
      throw new ValidationError(
        `Cannot confirm return for this request. Current status: ${refundRequest.status}`
      );
    }

    if (!refundRequest.product_returned) {
      throw new ValidationError(
        "Buyer has not submitted return information yet. Please wait for the buyer to return the product."
      );
    }

    // Update refund request
    refundRequest.product_return_confirmed = true;
    refundRequest.status = "return_received";
    if (confirmation_notes) {
      refundRequest.seller_response_reason = confirmation_notes.trim();
    }
    await refundRequest.save();

    // Create audit log
    await createAuditLog({
      action: "PRODUCT_RETURN_CONFIRMED",
      user_id: requester_user_id!,
      resource_type: "refund_request",
      resource_id: refundRequest._id.toString(),
      details: {
        order_id: refundRequest.order_id.toString(),
        tracking_number: refundRequest.return_tracking_number,
      },
      ip_address: req.ip,
      user_agent: req.get("user-agent"),
    });

    logger.info("[Refund] Product return confirmed by seller", {
      refund_request_id: id,
      order_id: refundRequest.order_id.toString(),
    });

    res.json({
      success: true,
      data: {
        refund_request_id: refundRequest._id.toString(),
        status: "return_received",
        message: "Product return confirmed. You can now approve the refund.",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * APPROVE REFUND REQUEST (Seller approves buyer's refund request)
 * POST /api/v1/marketplace/refund-requests/:id/approve
 *
 * FINIX CERTIFICATION - Seller Approval:
 * Only the seller can approve a refund request.
 * Product must be returned and confirmed before approval.
 * Once approved, the refund is executed automatically.
 */
export const approveRefundRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { approval_notes } = req.body || {};
    const requester_user_id = req.user?.dialist_id;

    logger.info("[Refund] Approve request", {
      refund_request_id: id,
      requester_user_id,
    });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid refund request ID format");
    }

    const refundRequest = await RefundRequest.findById(id);
    if (!refundRequest) {
      throw new NotFoundError("Refund request not found");
    }

    // Only seller can approve refund requests
    if (refundRequest.seller_id.toString() !== requester_user_id) {
      logger.warn("[Refund] Approve failed: not seller", {
        refund_request_id: id,
        seller_id: refundRequest.seller_id.toString(),
        requester_user_id,
      });
      throw new AuthorizationError(
        "Only the seller can approve refund requests",
        { refund_request_id: id }
      );
    }

    // Check if product has been returned and confirmed
    if (!refundRequest.product_return_confirmed) {
      if (!refundRequest.product_returned) {
        throw new ValidationError(
          "Cannot approve refund: Buyer has not returned the product yet. Please wait for product return."
        );
      }
      throw new ValidationError(
        "Cannot approve refund: You must confirm product receipt first using /confirm-return endpoint."
      );
    }

    if (refundRequest.status === "executed") {
      // Idempotency check: If already executed, return the existing result
      // This prevents errors on retries (network timeouts, etc.)
      logger.info("[Refund] Idempotent retry for executed refund", {
        refund_request_id: id,
        status: "executed",
      });
      res.status(200).json(refundRequest);
      return;
    }

    if (
      refundRequest.status !== "return_received" &&
      refundRequest.status !== "pending"
    ) {
      throw new ValidationError(
        `Refund request cannot be approved. Current status: ${refundRequest.status}`
      );
    }

    const order = await Order.findById(refundRequest.order_id);
    if (!order) {
      throw new NotFoundError("Associated order not found");
    }

    // Ensure we have a valid transfer ID
    if (!refundRequest.finix_transfer_id) {
      throw new ValidationError(
        "No transfer ID associated with this refund request"
      );
    }

    // Execute the actual refund via Finix
    const reversal = await createTransferReversal({
      transfer_id: refundRequest.finix_transfer_id,
      refund_amount: refundRequest.requested_amount,
      idempotencyKey: refundRequest.idempotency_id,
      idempotency_id: refundRequest.idempotency_id,
    });

    // Update refund request
    refundRequest.status = "executed";
    refundRequest.approved_by = requester_user_id;
    refundRequest.approved_at = new Date();
    refundRequest.executed_at = new Date();
    refundRequest.finix_reversal_id = reversal.reversal_id;
    refundRequest.finix_reversal_state = reversal.state;
    if (approval_notes) {
      refundRequest.seller_response_reason = approval_notes.trim();
    }
    await refundRequest.save();

    // Update order status
    const isFullRefund =
      refundRequest.requested_amount >= refundRequest.original_transfer_amount;
    if (isFullRefund) {
      order.status = "refunded" as any;
      order.refunded_at = new Date();
    }
    order.metadata = {
      ...order.metadata,
      last_refund: {
        reversal_id: reversal.reversal_id,
        amount: refundRequest.requested_amount,
        state: reversal.state,
        approved_at: new Date().toISOString(),
      },
      pending_refund_request: undefined,
    };
    await order.save();

    // Release listing if full refund
    if (isFullRefund) {
      await MarketplaceListing.findByIdAndUpdate(order.listing_id, {
        status: "active",
        $unset: {
          reserved_until: 1,
          reserved_by_user_id: 1,
          reserved_by_order_id: 1,
        },
      });
    }

    // Create audit log
    await createAuditLog({
      action: "REFUND_APPROVED",
      user_id: requester_user_id!,
      resource_type: "refund_request",
      resource_id: refundRequest._id.toString(),
      details: {
        order_id: order._id.toString(),
        reversal_id: reversal.reversal_id,
        amount: refundRequest.requested_amount,
        reversal_state: reversal.state,
      },
      ip_address: req.ip,
      user_agent: req.get("user-agent"),
    });

    logger.info("[Refund] Request approved and executed", {
      refund_request_id: id,
      order_id: order._id.toString(),
      reversal_id: reversal.reversal_id,
      amount: refundRequest.requested_amount,
    });

    res.json({
      success: true,
      data: {
        refund_request_id: refundRequest._id.toString(),
        order_id: order._id.toString(),
        status: "executed",
        refund_id: reversal.reversal_id,
        refund_state: reversal.state,
        amount: refundRequest.requested_amount,
        message: "Refund approved and executed successfully",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DENY REFUND REQUEST (Seller denies buyer's refund request)
 * POST /api/v1/marketplace/refund-requests/:id/deny
 *
 * FINIX CERTIFICATION - Seller Denial:
 * Only the seller can deny a refund request.
 * A reason must be provided for denial.
 */
export const denyRefundRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const requester_user_id = req.user?.dialist_id;

    logger.info("[Refund] Deny request", {
      refund_request_id: id,
      requester_user_id,
    });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid refund request ID format");
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
      throw new ValidationError(
        "A valid reason (minimum 10 characters) is required to deny a refund request"
      );
    }

    const refundRequest = await RefundRequest.findById(id);
    if (!refundRequest) {
      throw new NotFoundError("Refund request not found");
    }

    // Only seller can deny refund requests
    if (refundRequest.seller_id.toString() !== requester_user_id) {
      logger.warn("[Refund] Deny failed: not seller", {
        refund_request_id: id,
        seller_id: refundRequest.seller_id.toString(),
        requester_user_id,
      });
      throw new AuthorizationError("Only the seller can deny refund requests", {
        refund_request_id: id,
      });
    }

    if (
      !(
        ["pending", "return_requested", "return_received"] as string[]
      ).includes(refundRequest.status)
    ) {
      throw new ValidationError(
        `Refund request cannot be denied. Current status: ${refundRequest.status}`
      );
    }

    // Update refund request to denied
    refundRequest.status = "denied";
    refundRequest.denied_by = requester_user_id;
    refundRequest.denied_at = new Date();
    refundRequest.seller_response_reason = reason.trim();
    await refundRequest.save();

    // Update order metadata
    const order = await Order.findById(refundRequest.order_id);
    if (order) {
      order.metadata = {
        ...order.metadata,
        pending_refund_request: undefined,
        last_denied_refund: {
          request_id: refundRequest._id.toString(),
          denied_at: new Date().toISOString(),
          reason: reason.trim(),
        },
      };
      await order.save();
    }

    // Create audit log
    await createAuditLog({
      action: "REFUND_DENIED",
      user_id: requester_user_id!,
      resource_type: "refund_request",
      resource_id: refundRequest._id.toString(),
      details: {
        order_id: refundRequest.order_id.toString(),
        requested_amount: refundRequest.requested_amount,
        denial_reason: reason.trim(),
      },
      ip_address: req.ip,
      user_agent: req.get("user-agent"),
    });

    logger.info("[Refund] Request denied", {
      refund_request_id: id,
      order_id: refundRequest.order_id.toString(),
      reason: reason.trim(),
    });

    res.json({
      success: true,
      data: {
        refund_request_id: refundRequest._id.toString(),
        order_id: refundRequest.order_id.toString(),
        status: "denied",
        denial_reason: reason.trim(),
        message: "Refund request denied",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET REFUND REQUESTS (for buyer or seller)
 * GET /api/v1/marketplace/refund-requests
 *
 * Returns refund requests where user is either buyer or seller
 */
export const getRefundRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user_id = req.user?.dialist_id;
    const { status, role } = req.query;

    logger.info("[Refund] Get refund requests", { user_id, status, role });

    const query: any = {
      $or: [{ buyer_id: user_id }, { seller_id: user_id }],
    };

    // Filter by status if provided (including new return-related statuses)
    const validStatuses = [
      "pending",
      "return_requested",
      "return_received",
      "approved",
      "denied",
      "executed",
      "cancelled",
    ];
    if (status && validStatuses.includes(status as string)) {
      query.status = status;
    }

    // Filter by role if provided
    if (role === "buyer") {
      delete query.$or;
      query.buyer_id = user_id;
    } else if (role === "seller") {
      delete query.$or;
      query.seller_id = user_id;
    }

    const refundRequests = await RefundRequest.find(query)
      .sort({ created_at: -1 })
      .populate("order_id", "listing_id total_amount")
      .populate("buyer_id", "first_name last_name email")
      .populate("seller_id", "first_name last_name email")
      .lean();

    res.json({
      success: true,
      data: {
        refund_requests: refundRequests,
        count: refundRequests.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET SINGLE REFUND REQUEST
 * GET /api/v1/marketplace/refund-requests/:id
 */
export const getRefundRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user_id = req.user?.dialist_id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid refund request ID format");
    }

    const refundRequest = await RefundRequest.findById(id)
      .populate("order_id", "listing_id total_amount status")
      .populate("buyer_id", "first_name last_name email")
      .populate("seller_id", "first_name last_name email")
      .lean();

    if (!refundRequest) {
      throw new NotFoundError("Refund request not found");
    }

    // Only buyer or seller can view
    if (
      refundRequest.buyer_id?._id?.toString() !== user_id &&
      refundRequest.seller_id?._id?.toString() !== user_id
    ) {
      throw new AuthorizationError(
        "Not authorized to view this refund request",
        { refund_request_id: id }
      );
    }

    res.json({
      success: true,
      data: refundRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * CANCEL REFUND REQUEST (Buyer cancels their own pending request)
 * POST /api/v1/marketplace/refund-requests/:id/cancel
 */
export const cancelRefundRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const requester_user_id = req.user?.dialist_id;

    logger.info("[Refund] Cancel request", {
      refund_request_id: id,
      requester_user_id,
    });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid refund request ID format");
    }

    const refundRequest = await RefundRequest.findById(id);
    if (!refundRequest) {
      throw new NotFoundError("Refund request not found");
    }

    // Only buyer can cancel their own request
    if (refundRequest.buyer_id.toString() !== requester_user_id) {
      throw new AuthorizationError(
        "Only the buyer can cancel their refund request",
        { refund_request_id: id }
      );
    }

    if (
      !(["pending", "return_requested"] as string[]).includes(
        refundRequest.status
      )
    ) {
      throw new ValidationError(
        `Cannot cancel refund request. Current status: ${refundRequest.status}`
      );
    }

    // Delete the pending request
    await refundRequest.deleteOne();

    // Update order metadata
    const order = await Order.findById(refundRequest.order_id);
    if (order) {
      order.metadata = {
        ...order.metadata,
        pending_refund_request: undefined,
      };
      await order.save();
    }

    // Create audit log
    await createAuditLog({
      action: "REFUND_CANCELLED",
      user_id: requester_user_id!,
      resource_type: "refund_request",
      resource_id: id,
      details: {
        order_id: refundRequest.order_id.toString(),
        requested_amount: refundRequest.requested_amount,
      },
      ip_address: req.ip,
      user_agent: req.get("user-agent"),
    });

    logger.info("[Refund] Request cancelled", {
      refund_request_id: id,
      order_id: refundRequest.order_id.toString(),
    });

    res.json({
      success: true,
      data: {
        message: "Refund request cancelled successfully",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET ORDER DETAILS
 * GET /api/v1/marketplace/orders/:id
 */
export const getOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user_id = req.user?.dialist_id;

    logger.info("[Order] Get order request", {
      order_id: id,
      user_id,
    });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid order ID format");
    }

    const order = await Order.findById(id)
      .populate("buyer_id", "first_name last_name email avatar display_name")
      .populate("seller_id", "first_name last_name email avatar display_name")
      .lean();

    if (!order) {
      logger.warn("[Order] Get order failed: not found", {
        order_id: id,
      });
      throw new NotFoundError("Order not found");
    }

    // Verify buyer or seller
    const buyerId = (order.buyer_id as any)._id.toString();
    const sellerId = (order.seller_id as any)._id.toString();

    if (buyerId !== user_id && sellerId !== user_id) {
      logger.warn("[Order] Get order failed: not authorized", {
        order_id: id,
        user_id,
        buyer_id: buyerId,
        seller_id: sellerId,
      });
      throw new AuthorizationError("Not authorized to view this order", {
        order_id: id,
        user_id,
      });
    }

    logger.info("[Order] Order retrieved successfully", {
      order_id: id,
      status: order.status,
    });

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET BUYER'S ORDERS
 * GET /api/v1/marketplace/orders/buyer/list
 */
export const getBuyerOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const buyer_id = req.user?.dialist_id;

    logger.info("[Order] Get buyer orders request", {
      buyer_id,
    });

    const orders = await Order.find({ buyer_id })
      .populate("seller_id", "first_name last_name avatar display_name")
      .sort({ createdAt: -1 })
      .lean();

    logger.info("[Order] Buyer orders retrieved", {
      buyer_id,
      count: orders.length,
    });

    res.json({
      data: orders,
      _metadata: {
        count: orders.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET SELLER'S ORDERS
 * GET /api/v1/marketplace/orders/seller/list
 */
export const getSellerOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const seller_id = req.user?.dialist_id;

    logger.info("[Order] Get seller orders request", {
      seller_id,
    });

    const orders = await Order.find({ seller_id })
      .populate("buyer_id", "first_name last_name avatar display_name")
      .sort({ createdAt: -1 })
      .lean();

    logger.info("[Order] Seller orders retrieved", {
      seller_id,
      count: orders.length,
    });

    res.json({
      data: orders,
      _metadata: {
        count: orders.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ⚠️ TEMPORARY DEV ENDPOINT - CLEAR ALL RESERVATIONS
 * POST /api/v1/marketplace/orders/dev/clear-reservations
 *
 * This endpoint clears all active reservations from listings and orders.
 * Useful for development and testing purposes.
 * ⚠️ REMOVE THIS IN PRODUCTION!
 */
export const clearAllReservations = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.warn("[Order] ⚠️ DEV: Clearing all reservations!");

    // Clear reservation fields from all listings
    const listingsResult = await MarketplaceListing.updateMany(
      {
        $or: [
          { reserved_until: { $exists: true } },
          { reserved_by_user_id: { $exists: true } },
          { reserved_by_order_id: { $exists: true } },
        ],
      },
      {
        $unset: {
          reserved_until: 1,
          reserved_by_user_id: 1,
          reserved_by_order_id: 1,
        },
      }
    );

    // Cancel all reserved orders (not yet paid)
    const ordersResult = await Order.updateMany(
      { status: "reserved" },
      {
        $set: {
          status: "cancelled",
          cancelled_at: new Date(),
          cancellation_reason: "DEV: Reservation cleared",
        },
      }
    );

    logger.info("[Order] ✅ DEV: Reservations cleared", {
      listings_updated: listingsResult.modifiedCount,
      orders_cancelled: ordersResult.modifiedCount,
    });

    res.json({
      success: true,
      message: "All reservations cleared successfully",
      data: {
        listings_cleared: listingsResult.modifiedCount,
        orders_cancelled: ordersResult.modifiedCount,
      },
    });
  } catch (error) {
    logger.error("[Order] ❌ DEV: Failed to clear reservations", { error });
    next(error);
  }
};

/**
 * DEV: Reset listing payment/state to allow re-listing after a test purchase
 * POST /api/v1/marketplace/orders/dev/reset-listing
 * body: { listing_id?: string, order_id?: string }
 * Note: This endpoint is for development/testing only. It will unset reservation fields,
 * set listing status to 'active', and cancel any related orders to make the listing available again.
 */
export const resetListing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { listing_id, order_id } = req.body || {};

    logger.warn("[Order - DEV] Reset listing request started", {
      listing_id,
      order_id,
    });
    if (!listing_id && !order_id) {
      throw new ValidationError("listing_id or order_id is required");
    }

    // Find listing from listing id or order
    let listing: any = null;
    if (listing_id) {
      listing = await MarketplaceListing.findById(listing_id);
    } else if (order_id) {
      const order = await Order.findById(order_id);
      if (!order) throw new NotFoundError("Order not found");
      listing = await MarketplaceListing.findById(order.listing_id);
    }

    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Update the listing to be active/published and clear reservation fields
    await listing.updateOne({
      status: "active",
      $unset: {
        reserved_until: 1,
        reserved_by_user_id: 1,
        reserved_by_order_id: 1,
      },
    });

    // Cancel or clear orders associated with this listing to allow repeat testing
    const orders = await Order.find({
      listing_id: listing._id,
      status: { $in: ["reserved", "processing", "paid"] },
    });
    for (const o of orders) {
      await o.updateOne({
        status: "cancelled",
        cancelled_at: new Date(),
        cancellation_reason: "DEV: Reset by admin",
      });
    }

    logger.info("[Order - DEV] Reset completed", {
      listing_id: listing._id,
      orders_cancelled: orders.length,
    });
    res.json({
      success: true,
      data: {
        listing_id: listing._id.toString(),
        orders_cancelled: orders.length,
      },
    });
  } catch (err) {
    console.log("DEBUG: reserveListing error:", err);
    next(err);
  }
};

/**
 * Get dispute details for an order
 * GET /api/v1/marketplace/orders/:id/dispute
 * FINIX CERTIFICATION REQUIREMENT
 */
export const getOrderDispute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (!order.dispute_id) {
      res.json({
        success: true,
        data: {
          has_dispute: false,
          order_id: order._id.toString(),
        },
      });
      return;
    }

    logger.info("[Order] Dispute details requested", {
      order_id: id,
      dispute_id: order.dispute_id,
      dispute_state: order.dispute_state,
    });

    res.json({
      success: true,
      data: {
        has_dispute: true,
        order_id: order._id.toString(),
        dispute_id: order.dispute_id,
        dispute_state: order.dispute_state,
        dispute_reason: order.dispute_reason,
        dispute_amount: order.dispute_amount,
        respond_by: order.dispute_respond_by,
        created_at: order.dispute_created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};
