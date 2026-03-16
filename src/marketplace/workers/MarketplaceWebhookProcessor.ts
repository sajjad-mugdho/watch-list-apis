/**
 * Webhook Processor Worker
 *
 * Background worker that processes webhooks from the Bull queue.
 * Extracts processing logic from webhook handlers to enable async processing.
 */

import { FinixWebhookEvent } from "../models/FinixWebhookEvent";
import { User } from "../../models/User";
import { MerchantOnboarding } from "../models/MerchantOnboarding";
import { Order } from "../../models/Order";
import { MarketplaceListing } from "../models/MarketplaceListing";
import { finixLogger, userLogger, merchantLogger } from "../../utils/logger";
import { config } from "../../config";
import { provisionMerchant } from "../../utils/finix";

/**
 * Process Finix webhook events
 *
 * Handles FOUR key events in the merchant onboarding flow:
 * 1. onboarding_form.updated (COMPLETED) OR onboarding_form.created - Stores identity_id
 * 2. merchant.created/updated/underwritten - Finds user by identity_id, updates merchant_id and onboarding_state
 * 3. verification.updated - Finds user by identity_id, updates verification_state
 *
 * Uses identity_id as the linking key across all events.
 * Implements retry logic for out-of-order event delivery.
 *
 * @param type - Event type (e.g., "updated", "created", "underwritten")
 * @param payload - Webhook payload from Finix
 * @param eventId - Unique event ID for logging
 */
async function processFinixWebhook(
  type: string,
  payload: any,
  eventId: string,
): Promise<string> {
  const { entity, _embedded } = payload;

  finixLogger.info(`📥 Processing Finix webhook: ${entity}.${type}`, {
    eventId,
    entity,
    type,
    hasEmbedded: !!_embedded,
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENT 1: onboarding_form.updated (status: COMPLETED) OR onboarding_form.created
  // This is the FIRST event - establishes the identity_id → user link
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (
    entity === "onboarding_form" &&
    (type === "updated" || type === "created")
  ) {
    const form = _embedded?.onboarding_forms?.[0];

    if (!form) {
      finixLogger.error("❌ Missing onboarding_form data in webhook", {
        eventId,
        entity,
        type,
        payloadKeys: Object.keys(payload),
      });
      throw new Error("Missing onboarding_form data");
    }

    finixLogger.info(`📋 Onboarding form ${type}`, {
      eventId,
      formId: form.id,
      status: form.status,
      identityId: form.identity_id || "not set",
      tags: form.tags || {},
    });

    // For "created" events, check if the form has identity_id (meaning it was completed)
    // For "updated" events, check status === "COMPLETED"
    const isCompleted =
      type === "updated" ? form?.status === "COMPLETED" : !!form?.identity_id;

    if (!isCompleted) {
      finixLogger.info(
        `⏭️ Onboarding form not completed yet (${type} event, status: ${form.status}), skipping`,
        {
          eventId,
          formId: form.id,
          status: form.status,
          type,
        },
      );
      return `Onboarding form not completed (${type}, status: ${form.status})`;
    }

    // Extract BOTH our ID and Finix's ID
    const dialistUserId = form?.tags?.dialist_user_id;
    const identityId = form?.identity_id;

    finixLogger.info(`🔍 Extracted from form`, {
      eventId,
      dialistUserId: dialistUserId || "MISSING!",
      identityId: identityId || "MISSING!",
      formId: form.id,
    });

    // 🔧 FIX: Better error messages for debugging
    if (!dialistUserId) {
      finixLogger.error("❌ Missing dialist_user_id in form tags", {
        eventId,
        formId: form.id,
        tags: form.tags || {},
      });
      throw new Error(
        `Missing dialist_user_id tag in completed form. Form ID: ${form.id}. ` +
          `Make sure you include tags: { dialist_user_id: user._id } when creating the form.`,
      );
    }

    if (!identityId) {
      finixLogger.error("❌ Missing identity_id in completed form", {
        eventId,
        formId: form.id,
        status: form.status,
      });
      throw new Error(
        `Missing identity_id in completed form ${form.id}. ` +
          `This should be populated by Finix when status is COMPLETED.`,
      );
    }

    // Find user by OUR internal ID
    finixLogger.info(`🔍 Looking for user with _id: ${dialistUserId}`, {
      eventId,
      dialistUserId,
    });
    const user = await User.findById(dialistUserId);

    if (!user) {
      finixLogger.error(`❌ User not found: ${dialistUserId}`, {
        eventId,
        dialistUserId,
        formId: form.id,
      });
      throw new Error(
        `User not found: ${dialistUserId}. ` +
          `Verify the user exists before creating the onboarding form.`,
      );
    }

    userLogger.info(`✅ Found user: ${user.email}`, {
      eventId,
      userId: user._id,
      email: user.email,
    });

    // ✅ UPDATE MerchantOnboarding table with identity_id (SINGLE SOURCE OF TRUTH)
    await MerchantOnboarding.findOneAndUpdate(
      { form_id: form.id },
      {
        identity_id: identityId,
        onboarding_state: "PROVISIONING",
        onboarded_at: new Date(),
      },
      { new: true },
    );

    finixLogger.info(`✅ Event 1: Stored identity_id in MerchantOnboarding`, {
      eventId,
      userId: dialistUserId,
      email: user.email,
      identityId,
      formId: form.id,
      onboardingState: "PROVISIONING",
    });

    // 🔧 FIX: Auto-provision merchant in sandbox (Finix doesn't do this automatically)
    // In production, Finix may auto-provision, but sandbox requires explicit call
    try {
      // Determine application ID based on user's location
      const application_id =
        user.location?.country === "CA"
          ? config.finixCaApplicationId
          : config.finixUsApplicationId;

      if (!application_id) {
        throw new Error(
          `No Finix application configured for location: ${user.location?.country}`,
        );
      }

      merchantLogger.info(`🏭 Auto-provisioning merchant for identity`, {
        eventId,
        identityId,
        userId: dialistUserId,
        applicationId: application_id,
      });
      const merchantData = await provisionMerchant(
        identityId,
        form.id, // Pass onboarding_form_id to fetch payment instrument data
      );

      // Update user with merchant data
      // ✅ UPDATE MerchantOnboarding table (SINGLE SOURCE OF TRUTH)
      await MerchantOnboarding.findOneAndUpdate(
        { identity_id: identityId },
        {
          merchant_id: merchantData.merchant_id,
          onboarding_state: merchantData.onboarding_state,
          verification_id: merchantData.verification_id || undefined,
        },
        { new: true },
      );

      merchantLogger.info(`✅ Auto-provisioned merchant successfully`, {
        eventId,
        userId: dialistUserId,
        identityId,
        merchantId: merchantData.merchant_id,
        verificationId: merchantData.verification_id || "not set",
        onboardingState: merchantData.onboarding_state,
      });

      return `Stored identity_id ${identityId} and provisioned merchant ${merchantData.merchant_id} for user ${dialistUserId} (${user.email})`;
    } catch (provisionError: any) {
      merchantLogger.warn(`⚠️ Failed to auto-provision merchant`, {
        eventId,
        userId: dialistUserId,
        identityId,
        error: provisionError.message,
      });

      // Don't fail the webhook - just log the warning
      // The merchant webhook might arrive later or manual provisioning may be needed
      return `Stored identity_id ${identityId} for user ${dialistUserId} (${user.email}) - merchant provisioning pending`;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENT 2: merchant.created OR merchant.updated OR merchant.underwritten
  // Finix automatically creates merchant after form completion
  // Then sends updates when onboarding_state changes
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (
    entity === "merchant" &&
    (type === "created" || type === "updated" || type === "underwritten")
  ) {
    const merchant = _embedded?.merchants?.[0];

    if (!merchant) {
      finixLogger.error("❌ Missing merchant data in webhook", {
        eventId,
        entity,
        type,
      });
      throw new Error("Missing merchant data");
    }

    //  FIND USER BY IDENTITY_ID (not by tags!)
    // The merchant.identity field contains the Identity ID that links to our user
    const identityId = merchant.identity;

    if (!identityId) {
      finixLogger.error("Missing identity field in merchant webhook", {
        eventId,
        entity,
        type,
      });
      throw new Error("Missing identity field in merchant data");
    }

    finixLogger.info("Looking for merchant onboarding with identity_id", {
      identityId,
      eventId,
    });
    const merchantOnboarding = await MerchantOnboarding.findOne({
      identity_id: identityId,
    });

    if (!merchantOnboarding) {
      finixLogger.warn(
        "No merchant onboarding found for identity_id - possible out-of-order delivery",
        {
          identityId,
          eventId,
        },
      );

      // Mark webhook for retry
      const finixEvent = await FinixWebhookEvent.findOne({ eventId });
      if (finixEvent) {
        finixEvent.status = "failed";
        finixEvent.error =
          "MerchantOnboarding not found - possible out-of-order delivery";
        finixEvent.attemptCount = (finixEvent.attemptCount || 0) + 1;
        await finixEvent.save();
      }

      throw new Error("MerchantOnboarding not found - will retry");
    }

    // Get user for logging purposes
    const user = await User.findById(merchantOnboarding.dialist_user_id);

    // ✅ UPDATE MerchantOnboarding table (SINGLE SOURCE OF TRUTH)
    const updateData: any = {
      merchant_id: merchant.id,
      onboarding_state: merchant.onboarding_state,
    };

    // Only update verification_id if it exists in the webhook
    // merchant.created events may not have verification yet
    if (merchant.verification) {
      updateData.verification_id = merchant.verification;
      finixLogger.info("Setting verification_id", {
        verificationId: merchant.verification,
        eventId,
      });
    }

    await MerchantOnboarding.findOneAndUpdate(
      { identity_id: identityId },
      updateData,
      { new: true },
    );

    finixLogger.info(`Merchant ${type} processed`, {
      userId: merchantOnboarding.dialist_user_id.toString(),
      userEmail: user?.email || "unknown",
      merchantId: merchant.id,
      onboardingState: merchant.onboarding_state,
      identityId,
      eventId,
    });

    // ✅ Sync merchant status to Clerk session claims
    if (user && user.external_id) {
      try {
        const { buildClaimsFromDbUser } = await import("../../utils/user");
        const claims = await buildClaimsFromDbUser(user);

        const { clerkClient } = await import("@clerk/express");
        const { config } = await import("../../config");

        if (config.featureClerkMutations) {
          await clerkClient.users.updateUserMetadata(user.external_id, {
            publicMetadata: claims,
          });
          finixLogger.info("Synced merchant status to Clerk", {
            userId: user._id.toString(),
            external_id: user.external_id,
            onboarding_state: merchant.onboarding_state,
            isMerchant: merchant.onboarding_state === "APPROVED",
          });
        }
      } catch (err) {
        finixLogger.error("Failed to sync merchant status to Clerk", {
          userId: user._id.toString(),
          external_id: user.external_id,
          error: (err as Error).message,
        });
        // Don't throw - this is best-effort
      }
    }

    return `Updated merchant onboarding for user ${merchantOnboarding.dialist_user_id} with merchant_id ${merchant.id} (${type})`;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENT 3: verification.updated
  // Finix verifies the merchant (KYC/underwriting)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (entity === "verification" && type === "updated") {
    const verification = _embedded?.verifications?.[0];

    if (!verification) {
      finixLogger.error("Missing verification data in webhook");
      throw new Error("Missing verification data");
    }

    finixLogger.info("Verification updated", {
      verificationId: verification.id,
      state: verification.state,
      merchant: verification.merchant || "not set",
      identity: verification.identity || "not set",
      eventId,
    });

    const identityId = verification.identity || verification.merchant_identity;

    if (!identityId) {
      finixLogger.error("Missing identity field in verification webhook", {
        verification: verification,
        eventId,
      });
      throw new Error("Missing identity field in verification data");
    }

    finixLogger.info("Looking for merchant onboarding with identity_id", {
      identityId,
      eventId,
    });
    const merchantOnboarding = await MerchantOnboarding.findOne({
      identity_id: identityId,
    });

    if (!merchantOnboarding) {
      finixLogger.warn(
        "No merchant onboarding found for identity_id - possible out-of-order delivery",
        {
          identityId,
          eventId,
        },
      );

      const finixEvent = await FinixWebhookEvent.findOne({ eventId });
      if (finixEvent) {
        finixEvent.status = "failed";
        finixEvent.error =
          "MerchantOnboarding not found - possible out-of-order delivery";
        finixEvent.attemptCount = (finixEvent.attemptCount || 0) + 1;
        await finixEvent.save();
      }

      throw new Error("MerchantOnboarding not found - will retry");
    }

    // Get user for logging purposes
    const user = await User.findById(merchantOnboarding.dialist_user_id);

    finixLogger.info("Found merchant onboarding for verification update", {
      userId: merchantOnboarding.dialist_user_id.toString(),
      email: user?.email || "unknown",
      eventId,
    });

    // Update verification status
    const isVerified = verification.state === "SUCCEEDED";
    const isFailed = verification.state === "FAILED";

    // ✅ UPDATE MerchantOnboarding table (SINGLE SOURCE OF TRUTH)
    const merchantOnboardingUpdate: any = {
      verification_id: verification.id,
      verification_state: verification.state,
    };
    if (isVerified) {
      merchantOnboardingUpdate.verified_at = new Date();
    } else if (isFailed) {
      merchantOnboardingUpdate.verified_at = null;
    }
    await MerchantOnboarding.findOneAndUpdate(
      { identity_id: identityId },
      merchantOnboardingUpdate,
      { new: true },
    );

    finixLogger.info("Verification updated in MerchantOnboarding", {
      userId: merchantOnboarding.dialist_user_id.toString(),
      email: user?.email || "unknown",
      verificationId: verification.id,
      verificationState: verification.state,
      verifiedAt: merchantOnboardingUpdate.verified_at,
      identityId,
      eventId,
    });

    return `Updated verification for user ${
      merchantOnboarding.dialist_user_id
    } (${user?.email || "unknown"}) to ${verification.state}`;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENT 4: transfer.created
  // Payment transfer initiated (PENDING state)
  // This happens immediately after authorization is captured
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (entity === "transfer" && type === "created") {
    const transfer = _embedded?.transfers?.[0];

    if (!transfer) {
      finixLogger.error("Missing transfer data in transfer.created", {
        eventId,
      });
      return "Missing transfer data";
    }

    const transferId = transfer.id;
    const amount = transfer.amount;
    const state = transfer.state; // Usually "PENDING"
    const merchantId = transfer.merchant;
    const sourceId = transfer.source; // Payment instrument ID
    const authorizationId = transfer.tags?.authorization_id;

    finixLogger.info(`💸 Transfer created: ${transferId}`, {
      eventId,
      transferId,
      amount,
      state,
      merchantId,
      sourceId,
    });

    // Find order by authorization_id or payment_instrument_id
    let order = null;

    if (authorizationId) {
      order = await Order.findOne({ finix_authorization_id: authorizationId });
    }

    if (!order && sourceId) {
      order = await Order.findOne({ finix_payment_instrument_id: sourceId });
    }

    if (order) {
      // Update order with transfer information
      order.finix_transfer_id = transferId;

      // ✅ Check if transfer is already SUCCEEDED (common in sandbox)
      // In production, transfers start as PENDING and update via transfer.updated
      if (state === "SUCCEEDED") {
        order.status = "paid";
        order.paid_at = new Date();
        await order.save();

        // Update listing to sold
        await MarketplaceListing.findByIdAndUpdate(order.listing_id, {
          status: "sold",
          $unset: {
            reserved_until: 1,
            reserved_by_user_id: 1,
            reserved_by_order_id: 1,
          },
        });

        finixLogger.info(
          `✅ Payment completed immediately (transfer SUCCEEDED)`,
          {
            orderId: order._id.toString(),
            transferId,
            amount,
          },
        );

        return `Payment completed for order ${order._id} (transfer: ${transferId})`;
      } else {
        // Transfer is PENDING - wait for transfer.updated webhook
        // Use 'pending' for order.status to align with Order model and tests
        order.status = "pending";
        await order.save();

        finixLogger.info(`⏳ Transfer PENDING - awaiting confirmation`, {
          orderId: order._id.toString(),
          transferId,
          state,
        });

        return `Transfer ${transferId} linked to order ${order._id} (state: ${state})`;
      }
    } else {
      finixLogger.warn(`⚠️ No order found for transfer ${transferId}`, {
        authorizationId,
        sourceId,
      });
      return `Transfer created but order not found`;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENT 5: transfer.updated ⭐ MOST CRITICAL EVENT
  // Payment status changed: PENDING → SUCCEEDED/FAILED
  // This is the authoritative confirmation that payment completed
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (entity === "transfer" && type === "updated") {
    const transfer = _embedded?.transfers?.[0];

    if (!transfer) {
      finixLogger.error("Missing transfer data in transfer.updated", {
        eventId,
      });
      return "Missing transfer data";
    }

    const transferId = transfer.id;
    const state = transfer.state; // SUCCEEDED, FAILED, CANCELED, PENDING
    const amount = transfer.amount;
    const readyToSettleAt = transfer.ready_to_settle_at;
    const failureCode = transfer.failure_code;
    const failureMessage = transfer.failure_message;

    finixLogger.info(`🔄 Transfer updated: ${transferId}`, {
      eventId,
      transferId,
      state,
      amount,
      readyToSettleAt,
      failureCode,
      failureMessage,
    });

    // Find order by transfer_id
    const order = await Order.findOne({ finix_transfer_id: transferId });

    if (!order) {
      finixLogger.error(`❌ No order found for transfer: ${transferId}`, {
        eventId,
      });
      return `Order not found for transfer ${transferId}`;
    }

    // Handle different transfer states
    if (state === "SUCCEEDED") {
      // Detect reversal (refund) - Finix uses type 'REVERSAL' for refunds
      if (transfer.type === "REVERSAL" || transfer.subtype === "REVERSAL") {
        // Refund: mark order refunded and store refund details
        order.status = "refunded" as any;
        order.refunded_at = new Date();
        order.metadata = {
          ...order.metadata,
          refund: {
            transferId,
            failureCode,
            failureMessage,
            amount,
          },
        };
        await order.save();

        finixLogger.info(
          `✅ Refund (reversal) SUCCEEDED for order ${order._id}`,
          {
            orderId: order._id.toString(),
            transferId,
            amount,
          },
        );

        // Re-open listing if needed
        await MarketplaceListing.findByIdAndUpdate(order.listing_id, {
          status: "active",
          $unset: {
            reserved_until: 1,
            reserved_by_user_id: 1,
            reserved_by_order_id: 1,
          },
        });

        return `Refund (reversal) succeeded for order ${order._id}`;
      }
      // ✅ PAYMENT SUCCESS (non-reversal)
      order.status = "paid";
      order.paid_at = new Date();
      await order.save();

      // Update listing to sold
      await MarketplaceListing.findByIdAndUpdate(order.listing_id, {
        status: "sold",
        $unset: {
          reserved_until: 1,
          reserved_by_user_id: 1,
          reserved_by_order_id: 1,
        },
      });

      finixLogger.info(`✅ Payment SUCCEEDED for order ${order._id}`, {
        orderId: order._id.toString(),
        transferId,
        amount,
        buyerId: order.buyer_id.toString(),
        sellerId: order.seller_id.toString(),
      });

      // TODO: Send payment confirmation emails
      // TODO: Notify seller to ship the item
      // TODO: Trigger real-time notification to frontend via WebSocket/SSE

      return `Payment succeeded for order ${order._id}`;
    } else if (state === "FAILED") {
      // ❌ PAYMENT FAILED
      order.status = "cancelled";
      order.cancelled_at = new Date();
      order.metadata = {
        ...order.metadata,
        payment_failure: {
          code: failureCode,
          message: failureMessage,
          failed_at: new Date().toISOString(),
        },
      };
      await order.save();

      finixLogger.error(`❌ Payment FAILED for order ${order._id}`, {
        orderId: order._id.toString(),
        transferId,
        failureCode,
        failureMessage,
        buyerId: order.buyer_id.toString(),
      });

      // TODO: Send payment failure notification to buyer
      // TODO: Release listing reservation
      // TODO: Refund any platform fees if applicable
      // TODO: Trigger real-time notification to frontend

      return `Payment failed for order ${order._id}: ${failureMessage}`;
    } else if (state === "PENDING") {
      // Payment still processing (rare for updates)
      finixLogger.info(`⏳ Transfer still pending: ${transferId}`, {
        orderId: order._id.toString(),
      });
      return `Transfer ${transferId} still pending`;
    } else if (state === "CANCELED") {
      // Payment was cancelled
      order.status = "cancelled";
      order.cancelled_at = new Date();
      await order.save();

      finixLogger.warn(`⚠️ Transfer CANCELED: ${transferId}`, {
        orderId: order._id.toString(),
      });

      // TODO: Notify buyer about cancellation
      // TODO: Release listing reservation

      return `Transfer ${transferId} was cancelled`;
    }

    return `Transfer ${transferId} updated to state: ${state}`;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENT 6: dispute.created / dispute.updated
  // Handle payment disputes (chargebacks) - FINIX CERTIFICATION REQUIREMENT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (entity === "dispute" && (type === "created" || type === "updated")) {
    const dispute = _embedded?.disputes?.[0];

    if (!dispute) {
      finixLogger.error("Missing dispute data in webhook", { eventId });
      return "Missing dispute data";
    }

    const disputeId = dispute.id;
    const transferId = dispute.transfer;
    const state = dispute.state; // INQUIRY, PENDING, WON, LOST
    const amount = dispute.amount;
    const reason = dispute.reason;
    const respondBy = dispute.respond_by;

    finixLogger.info(`⚠️ Dispute ${type}: ${disputeId}`, {
      eventId,
      disputeId,
      transferId,
      state,
      amount,
      reason,
      respondBy,
    });

    // Find order by transfer_id
    const order = await Order.findOne({ finix_transfer_id: transferId });

    if (order) {
      // Update order with dispute information
      order.dispute_state = state as any;
      order.dispute_id = disputeId;
      order.dispute_reason = reason;
      order.dispute_amount = amount;
      order.dispute_respond_by = respondBy ? new Date(respondBy) : undefined;

      if (type === "created") {
        order.dispute_created_at = new Date();
      }

      await order.save();

      finixLogger.info(`Updated order ${order._id} with dispute info`, {
        orderId: order._id.toString(),
        disputeId,
        disputeState: state,
        respondBy,
      });

      // TODO: Send notification to seller about dispute
      // TODO: Create audit log entry

      return `Dispute ${type} processed for order ${order._id}`;
    } else {
      finixLogger.warn(`Order not found for dispute transfer: ${transferId}`, {
        eventId,
        disputeId,
        transferId,
      });
      return `Order not found for dispute transfer: ${transferId}`;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENT 7: authorization.3ds_authentication_complete
  // Handle 3D Secure authentication completion
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (entity === "authorization" && type === "3ds_authentication_complete") {
    const auth = _embedded?.authorizations?.[0];

    if (!auth) {
      finixLogger.error("Missing authorization data in 3DS webhook", {
        eventId,
      });
      return "Missing authorization data";
    }

    finixLogger.info(`🔐 3DS authentication complete: ${auth.id}`, {
      eventId,
      authorizationId: auth.id,
      state: auth.state,
    });

    const order = await Order.findOne({ finix_authorization_id: auth.id });

    if (order) {
      order.three_ds_completed_at = new Date();

      if (auth.state === "SUCCEEDED") {
        // 3DS passed, authorization is now valid
        order.status = "authorized";
        order.authorized_at = new Date();
      } else {
        // 3DS failed
        order.status = "cancelled";
        order.cancelled_at = new Date();
      }

      await order.save();

      finixLogger.info(`3DS complete for order ${order._id}`, {
        orderId: order._id.toString(),
        state: auth.state,
      });

      return `3DS authentication ${auth.state} for order ${order._id}`;
    } else {
      finixLogger.warn(`Order not found for 3DS authorization: ${auth.id}`, {
        eventId,
      });
      return `Order not found for authorization ${auth.id}`;
    }
  }

  finixLogger.info(`Unhandled Finix event: ${entity}.${type}`, { eventId });
  return `Unhandled entity: ${entity}.${type}`;
}

export { processFinixWebhook };
