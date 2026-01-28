export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

// fails clerk validation
export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required", details?: unknown) {
    super(message, 401, "UNAUTHENTICATED", details, true);
  }
}
// internal business rules, eg. No networks access granted
export class AuthorizationError extends AppError {
  constructor(
    message: string = "Forbidden. Contact support",
    details: unknown
  ) {
    super(message, 403, "FORBIDDEN", details, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 500, "DATABASE_ERROR", details);
  }
}
export class MissingUserContextError extends AppError {
  constructor(details?: unknown) {
    super(
      "Missing user context on request",
      500,
      "MISSING_USER_CONTEXT",
      details,
      false
    );
  }
}
export class InvalidUserClaimsError extends AppError {
  constructor(details?: unknown) {
    super(
      "Invalid user claims on request",
      500,
      "INVALID_USER_CLAIMS",
      details,
      false
    );
  }
}

/**
 * Payment Error - For Finix payment failures
 * Returns detailed error info for frontend display
 * FINIX CERTIFICATION: Properly handle failed payment responses
 */
export interface PaymentErrorDetails {
  failure_code?: string | undefined;
  failure_message?: string | undefined;
  avs_result?: string | undefined;
  cvv_result?: string | undefined;
  authorization_id?: string | undefined;
  transfer_id?: string | undefined;
  payment_instrument_id?: string | undefined;
  raw_error?: unknown;
}

export class PaymentError extends AppError {
  public readonly failure_code: string | undefined;
  public readonly failure_message: string | undefined;
  public readonly avs_result: string | undefined;
  public readonly cvv_result: string | undefined;

  constructor(
    message: string,
    details?: PaymentErrorDetails,
    statusCode?: number
  ) {
    // Map Finix failure codes to user-friendly messages
    const userMessage = PaymentError.mapFailureCode(
      details?.failure_code,
      message
    );

    // Use appropriate status code based on failure code
    const finalStatusCode =
      statusCode ?? PaymentError.getStatusCode(details?.failure_code);

    super(userMessage, finalStatusCode, "PAYMENT_FAILED", details);
    this.failure_code = details?.failure_code;
    this.failure_message = details?.failure_message;
    this.avs_result = details?.avs_result;
    this.cvv_result = details?.cvv_result;
  }

  /**
   * Map Finix failure codes to user-friendly messages
   * Per Finix documentation: https://docs.finix.com/guides/testing-integration
   * COMPLETE FINIX FAILURE CODE MAPPING - All documented failure scenarios
   */
  static mapFailureCode(
    code?: string,
    fallback: string = "Payment failed"
  ): string {
    if (!code) return fallback;

    const codeMap: Record<string, string> = {
      // ===== CARD DECLINE CODES =====
      GENERIC_DECLINE:
        "Your card was declined. Please try a different payment method.",
      INSUFFICIENT_FUNDS:
        "Insufficient funds. Please try a different payment method.",
      CARD_NOT_SUPPORTED:
        "This card type is not supported. Please try a different card.",
      EXPIRED_CARD: "This card has expired. Please use a different card.",
      INVALID_CARD_NUMBER: "Invalid card number. Please check and try again.",
      INVALID_EXPIRATION_DATE:
        "Invalid expiration date. Please check and try again.",
      INVALID_CVV: "Invalid security code (CVV). Please check and try again.",
      CVV_MISMATCH: "Security code verification failed. Please check your CVV.",
      AVS_MISMATCH:
        "Address verification failed. Please verify your billing address.",
      AVS_NOT_SUPPORTED: "Address verification is not available for this card.",
      LOST_OR_STOLEN_CARD: "This card has been reported lost or stolen.",
      CARD_DECLINED: "Your card was declined by the issuing bank.",
      TRANSACTION_NOT_ALLOWED: "This transaction is not allowed for this card.",
      RESTRICTED_CARD: "This card is restricted. Please try a different card.",
      WITHDRAWAL_LIMIT_EXCEEDED:
        "Withdrawal limit exceeded. Please try a smaller amount.",
      SECURITY_VIOLATION: "Security check failed. Please contact your bank.",
      SERVICE_NOT_ALLOWED: "This service is not allowed for your card.",
      INVALID_TRANSACTION: "Invalid transaction. Please try again.",
      TRANSACTION_DECLINED:
        "Transaction declined. Please try a different payment method.",

      // ===== FINIX DOCUMENTED FAILURE CODES (Test Cards) =====
      // Per Finix Testing Guide - Failure Code Test Cards
      CALL_ISSUER: "Please contact your card issuer for assistance.",
      CARD_NOT_ACTIVATED_OR_BLOCKED:
        "This card is not activated or is blocked. Please contact your bank.",
      DO_NOT_HONOR:
        "Your bank declined the transaction. Please contact your bank.",
      EXCEEDS_APPROVAL_LIMIT:
        "This transaction exceeds your approval limit. Try a smaller amount.",
      EXCEEDS_ISSUER_AMOUNT_LIMIT:
        "This transaction exceeds your issuer's amount limit.",
      EXCEEDS_ISSUER_COUNT_LIMIT:
        "Too many transactions. Please wait and try again later.",
      FRAUD_DETECTED: "This transaction was flagged for fraud prevention.",
      FRAUD_DETECTED_BY_FINIX: "Transaction blocked by Finix fraud detection.",
      FRAUD_DETECTED_BY_ISSUER:
        "Transaction blocked by your card issuer's fraud detection.",
      INVALID_INSTRUMENT:
        "This payment method is invalid. Please try a different one.",
      ISSUER_POLICY_VIOLATION:
        "This transaction violates your issuer's policy. Contact your bank.",
      PICK_UP_CARD: "Please contact your bank regarding this card immediately.",
      PICKUP_CARD: "Please contact your bank regarding this card immediately.",
      EXCEEDS_LIMIT:
        "This transaction exceeds your card limit. Try a smaller amount.",

      // ===== PUSH-TO-CARD FAILURE CODES =====
      SUSPECTED_FRAUD: "Transaction blocked due to suspected fraud.",
      COMPLIANCE_VIOLATION: "Transaction blocked due to compliance violation.",
      CARD_ISSUER_ERROR:
        "Card issuer error. Please try again or use a different card.",
      INVALID_CARD_DATA: "Invalid card data. Please verify your card details.",
      CARD_ISSUER_TIMEOUT: "Card issuer timeout. Please try again.",
      INVALID_ACCOUNT: "Invalid account. Please verify your payment method.",
      EXCEEDS_COUNT_LIMIT: "Transaction count limit exceeded. Try again later.",
      PROCESSING_NOT_ALLOWED_AT_THIS_TIME:
        "Processing not allowed at this time. Try again later.",
      TRANSACTION_NOT_PERMITTED:
        "This transaction is not permitted for this card.",
      FORMAT_ERROR: "Transaction format error. Please try again.",
      SYSTEM_ERROR: "System error. Please try again.",
      INVALID_AMOUNT: "Invalid amount. Please check and try again.",
      BALANCE_NOT_AVAILABLE: "Balance not available. Please try again.",

      // ===== ACH/BANK RETURN CODES =====
      // R01 - Insufficient Funds
      R01: "Insufficient funds in bank account. Payment was returned.",
      RETURN_NSF: "Insufficient funds in bank account. Payment was returned.",
      // R02 - Account Closed
      R02: "Bank account is closed. Payment was returned.",
      ACCOUNT_CLOSED:
        "This bank account is closed. Please use a different account.",
      RETURN_ACCOUNT_CLOSED: "Bank account is closed. Payment was returned.",
      BANK_ACCOUNT_CLOSED:
        "This bank account is closed. Please use a different account.",
      // R03 - No Account/Unable to Locate Account
      R03: "Bank account not found. Payment was returned.",
      NO_ACCOUNT: "Bank account not found. Please verify your account details.",
      RETURN_NO_ACCOUNT: "Bank account not found. Payment was returned.",
      NO_BANK_ACCOUNT_FOUND:
        "Bank account not found. Please verify your account details.",
      // R04 - Invalid Account Number
      R04: "Invalid bank account number. Payment was returned.",
      INVALID_ACCOUNT_NUMBER:
        "Invalid bank account number. Please verify and try again.",
      INVALID_BANK_ACCOUNT_NUMBER:
        "Invalid bank account number. Please verify and try again.",
      // Other ACH codes
      INVALID_ROUTING_NUMBER:
        "Invalid routing number. Please verify and try again.",
      ACCOUNT_FROZEN: "This bank account is frozen. Please contact your bank.",
      INVALID_ACCOUNT_TYPE: "Invalid account type. Please verify your account.",
      UNAUTHORIZED_DEBIT: "This account is not authorized for debits.",
      RETURN_STOP_PAYMENT: "Stop payment placed on this transaction.",
      RETURN_UNAUTHORIZED: "Unauthorized transaction. Payment was returned.",

      // ===== BANK VALIDATION CODES =====
      VALID: "Bank account validation successful.",
      INVALID:
        "Bank account validation failed. Please verify your account details.",
      INCONCLUSIVE:
        "Bank account validation inconclusive. Please verify your account details.",

      // Bank validation specific codes used by Finix sandbox
      INVALID_BANK_ACCOUNT_VALIDATION_CHECK:
        "The provided bank account failed validation. Please provide a different bank account.",
      INVALID_BANK_ACCOUNT_VALIDATION:
        "The provided bank account failed validation. Please provide a different bank account.",

      // ===== ACCOUNT UPDATER RESPONSE CODES =====
      CLOSED_CARD: "This card account is closed. Please use a different card.",
      CONTACT_CARDHOLDER:
        "Please contact the cardholder for updated card information.",
      EXPIRATION_UPDATED: "Card expiration has been updated.",
      NO_CHANGE: "No changes to card information.",
      NO_MATCH: "Card information could not be matched.",
      PARTICIPATING: "Card is participating in account updater.",
      PAN_UPDATED: "Card number has been updated.",

      // ===== NETWORK TOKEN STATE CODES =====
      TOKEN_CLOSED:
        "Network token is closed. Please use a different payment method.",
      TOKEN_FAILED: "Network token failed. Please try again.",
      TOKEN_SUSPENDED: "Network token is suspended. Please contact support.",

      // ===== REFUND FAILURE CODES =====
      REFUND_FAILED: "Refund failed. Please try again or contact support.",
      REFUND_NOT_ALLOWED: "Refund not allowed for this transaction.",
      PARTIAL_REFUND_NOT_ALLOWED:
        "Partial refund not allowed for this transaction.",

      // ===== 3D SECURE / AUTHENTICATION =====
      AUTHENTICATION_REQUIRED:
        "3D Secure authentication required. Please complete verification.",
      AUTHENTICATION_FAILED:
        "3D Secure authentication failed. Please try again.",
      "3DS_REQUIRED": "3D Secure authentication is required.",
      "3DS_FAILED": "3D Secure authentication failed.",

      // ===== AVS/CVV RESULT CODES =====
      AVS_DECLINED:
        "Address verification declined. Please verify your billing address.",
      CVV_DECLINED:
        "Security code verification declined. Please check your CVV.",

      // ===== GENERAL PROCESSING ERRORS =====
      PROCESSING_ERROR: "A processing error occurred. Please try again.",
      SERVICE_UNAVAILABLE:
        "Payment service temporarily unavailable. Please try again later.",
      TIMEOUT: "Payment request timed out. Please try again.",
      NETWORK_ERROR:
        "Network error. Please check your connection and try again.",
      API_ERROR: "API error occurred. Please try again.",
      CONFIGURATION_ERROR: "Configuration error. Please contact support.",
      MERCHANT_ERROR: "Merchant configuration error. Please contact support.",
      DUPLICATE_TRANSACTION:
        "Duplicate transaction detected. This payment may have already been processed.",
      // Unknown fallback code - return a clearer message instead of showing raw code
      UNKNOWN:
        "An unknown payment error occurred. Please try again or contact support.",
    };

    const upper = code.toUpperCase();
    // Prefer a mapped message, then the provided fallback (usually Finix's failure_message),
    // finally show a generic string including the failure code.
    if (codeMap[upper]) return codeMap[upper];
    if (fallback && fallback.trim().length > 0) return fallback;
    return `Payment failed: ${code}`;
  }

  /**
   * Get the appropriate HTTP status code for a failure code
   */
  static getStatusCode(failureCode?: string): number {
    if (!failureCode) return 402;

    // Map certain failure codes to specific HTTP status codes
    const statusMap: Record<string, number> = {
      // 400 - Bad Request (validation issues)
      INVALID_CARD_NUMBER: 400,
      INVALID_EXPIRATION_DATE: 400,
      INVALID_CVV: 400,
      INVALID_ACCOUNT_NUMBER: 400,
      INVALID_ROUTING_NUMBER: 400,
      // 'INVALID_BANK_ACCOUNT_NUMBER' already declared earlier
      INVALID_ACCOUNT_TYPE: 400,
      INVALID_INSTRUMENT: 400,
      INVALID_CARD_DATA: 400,
      INVALID_AMOUNT: 400,
      FORMAT_ERROR: 400,

      // 402 - Payment Required (most payment failures)
      // Default

      // 403 - Forbidden (fraud/blocked)
      FRAUD_DETECTED: 403,
      FRAUD_DETECTED_BY_FINIX: 403,
      FRAUD_DETECTED_BY_ISSUER: 403,
      SUSPECTED_FRAUD: 403,
      LOST_OR_STOLEN_CARD: 403,
      RESTRICTED_CARD: 403,
      COMPLIANCE_VIOLATION: 403,

      // 429 - Too Many Requests
      EXCEEDS_ISSUER_COUNT_LIMIT: 429,
      EXCEEDS_COUNT_LIMIT: 429,

      // 503 - Service Unavailable
      SERVICE_UNAVAILABLE: 503,
      TIMEOUT: 503,
      CARD_ISSUER_TIMEOUT: 503,
      SYSTEM_ERROR: 503,
      NETWORK_ERROR: 503,
      PROCESSING_NOT_ALLOWED_AT_THIS_TIME: 503,
      // Bank validation error codes - treat as client errors
      INVALID_BANK_ACCOUNT_VALIDATION_CHECK: 400,
      INVALID_BANK_ACCOUNT_NUMBER: 400,
      INVALID_BANK_ACCOUNT_VALIDATION: 400,
      // Unknown/Generic fallback mapping
      UNKNOWN: 402,
    };

    return statusMap[failureCode.toUpperCase()] || 402;
  }

  /**
   * Parse Finix API error response and create PaymentError
   */
  static fromFinixResponse(error: any, context?: string): PaymentError {
    let failureCode: string | undefined;
    let failureMessage: string | undefined;
    let authId: string | undefined;
    let transferId: string | undefined;

    // Extract from Finix error response
    if (error.response?.data) {
      const data = error.response.data;

      // Check for embedded authorization errors
      if (data._embedded?.authorizations?.[0]) {
        const auth = data._embedded.authorizations[0];
        failureCode = auth.failure_code;
        failureMessage =
          auth.failure_message || auth.messages?.[0]?.description;
        authId = auth.id;
      }

      // Check for embedded transfer errors
      if (data._embedded?.transfers?.[0]) {
        const transfer = data._embedded.transfers[0];
        failureCode = failureCode || transfer.failure_code;
        failureMessage = failureMessage || transfer.failure_message;
        transferId = transfer.id;
      }

      // Check for direct error messages
      if (data._embedded?.errors?.[0]) {
        const err = data._embedded.errors[0];
        // Prefer explicit failure_code when present, fallback to the generic code
        failureCode = failureCode || err.failure_code || err.code;
        failureMessage = failureMessage || err.message;
      }

      // Fallback to direct message
      if (!failureMessage && data.message) {
        failureMessage = data.message;
      }
    }

    const message = context
      ? `${context}: ${failureMessage || error.message}`
      : failureMessage || error.message || "Payment processing failed";

    return new PaymentError(message, {
      failure_code: failureCode,
      failure_message: failureMessage,
      authorization_id: authId,
      transfer_id: transferId,
      raw_error: error.response?.data || error.message,
    });
  }
}
