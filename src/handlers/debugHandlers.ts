import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Order } from "../models/Order";
import { MarketplaceListing } from "../models/Listings";
import { MerchantOnboarding } from "../models/MerchantOnboarding";
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
} from "../utils/errors";
import { config } from "../config";

/**
 * Dev/Demo endpoint to build the Finix payloads that would be sent for a given order
 * This does NOT call Finix. It's intended for auditors/reviewers to inspect payloads
 * during certification. ONLY enabled when NODE_ENV !== 'production'.
 */
export const getFinixDebugPayloads = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (config.nodeEnv === "production") {
      throw new ValidationError(
        "Finix debug endpoint is not allowed in production"
      );
    }

    const { id } = req.params;
    const { method } = req.query; // token|saved|card|bank|all

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid order ID format");
    }

    const order = await Order.findById(id);
    if (!order) throw new NotFoundError("Order not found");

    // Verify buyer is the requester
    const buyer_user_id = req.user?.dialist_id;
    if (!buyer_user_id)
      throw new AuthorizationError("Unauthenticated user", { route: req.path });
    if (order.buyer_id.toString() !== buyer_user_id) {
      throw new AuthorizationError(
        "You are not authorized to access that order",
        {
          order_id: id,
          request_buyer_user_id: buyer_user_id,
        }
      );
    }

    const listing = await MarketplaceListing.findById(order.listing_id);
    if (!listing) throw new NotFoundError("Listing not found");

    const merchantOnboarding = await MerchantOnboarding.findOne({
      dialist_user_id: listing.dialist_id,
    });

    // Decide merchant id
    const merchant_id = merchantOnboarding?.merchant_id || "MUmockMerchantId";

    const effectiveFraudSessionId = order.fraud_session_id as
      | string
      | undefined;

    const base = {
      order_id: id,
      amount: order.amount,
      currency: order.currency,
      identity_id: order.finix_buyer_identity_id,
      merchant_id,
      fraud_session_id: effectiveFraudSessionId,
    } as any;

    const payloads: any = {};
    const m = String(method || "all");

    if (m === "all" || m === "token") {
      payloads.createPaymentInstrumentFromToken = {
        token: "TK_example_token_123",
        identity_id: base.identity_id,
        fraud_session_id: base.fraud_session_id || "fs_example_123",
        idempotencyKey: `idemp-${id}-tk`,
        idempotency_id: `idemp-${id}-tk`,
        tags: {
          order_id: id,
          source_type: "tokenized",
          token_id: "TK_example_token_123",
        },
        postal_code: "94114",
        address_line1: "1 Market St",
        address_city: "San Francisco",
        address_region: "CA",
        address_country: "USA",
      };

      payloads.authorizeFromToken = {
        amount: base.amount,
        merchant_id: base.merchant_id,
        payment_instrument_id: "PI_from_token_example",
        fraud_session_id: base.fraud_session_id || "fs_example_123",
        idempotencyKey: `idemp-${id}-auth-tk`,
        idempotency_id: `idemp-${id}-auth-tk`,
        currency: base.currency,
        tags: {
          order_id: id,
          source_type: "token",
        },
      };
    }

    if (m === "all" || m === "saved") {
      payloads.authorizeFromSaved = {
        amount: base.amount,
        merchant_id: base.merchant_id,
        payment_instrument_id: "PIsaved_123",
        fraud_session_id: base.fraud_session_id || undefined,
        idempotencyKey: `idemp-${id}-auth-saved`,
        idempotency_id: `idemp-${id}-auth-saved`,
        currency: base.currency,
        tags: {
          order_id: id,
          source_type: "saved_instrument",
        },
      };
    }

    if (m === "all" || m === "card") {
      payloads.createPaymentInstrumentFromCard = {
        identity_id: base.identity_id,
        card_number: "4895142232120006",
        exp_month: "12",
        exp_year: "2025",
        cvv: "123",
        name: "Test Buyer",
        postal_code: "94114",
        address_line1: "1 Market St",
        address_city: "San Francisco",
        address_region: "CA",
        idempotencyKey: `idemp-${id}-card`,
        idempotency_id: `idemp-${id}-card`,
        fraud_session_id: base.fraud_session_id || undefined,
        tags: {
          order_id: id,
          source_type: "raw_card",
          payment_method: "card",
        },
      };

      payloads.authorizeFromCard = {
        amount: base.amount,
        merchant_id: base.merchant_id,
        payment_instrument_id: "PI_card_example",
        fraud_session_id: base.fraud_session_id || undefined,
        idempotencyKey: `idemp-${id}-auth-card`,
        idempotency_id: `idemp-${id}-auth-card`,
        currency: base.currency,
        tags: {
          order_id: id,
          source_type: "raw_card",
          payment_method: "card",
        },
      };
    }

    if (m === "all" || m === "bank") {
      payloads.createPaymentInstrumentFromBank = {
        identity_id: base.identity_id,
        account_number: "0000000016",
        bank_code: "122105278",
        account_type: "CHECKING",
        name: "Test Buyer",
        postal_code: "94114",
        address_line1: "123 Market St",
        idempotencyKey: `idemp-${id}-bank`,
        idempotency_id: `idemp-${id}-bank`,
        fraud_session_id: base.fraud_session_id || undefined,
        tags: {
          order_id: id,
          source_type: "raw_bank",
          payment_method: "bank",
        },
      };

      payloads.createTransferFromBank = {
        amount: base.amount,
        merchant_id: base.merchant_id,
        source: "PI_bank_example",
        currency: base.currency,
        idempotencyKey: `idemp-${id}-transfer-bank`,
        idempotency_id: `idemp-${id}-transfer-bank`,
        tags: {
          order_id: id,
          payment_method: "bank",
          source_type: "bank",
        },
        fraud_session_id: base.fraud_session_id || undefined,
      };
    }

    res.json({ success: true, data: { payloads } });
  } catch (err) {
    next(err);
  }
};
