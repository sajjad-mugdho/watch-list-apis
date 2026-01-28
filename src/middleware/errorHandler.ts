import { Request, Response, NextFunction } from "express";
import { AppError, PaymentError } from "../utils/errors";
import { ApiError } from "../types";
import logger from "../utils/logger";

// Error classification for better handling
const isOperationalError = (error: Error): boolean => {
  if (error instanceof AppError) return error.isOperational;

  const operationalErrors = [
    "ValidationError",
    "CastError",
    "MongoServerError",
    "ZodError",
  ];

  return operationalErrors.includes(error.name);
};

const sanitizeError = (error: Error): string => {
  const safeErrors = ["ValidationError", "CastError", "ZodError"];

  if (
    process.env.NODE_ENV === "production" &&
    !safeErrors.includes(error.name)
  ) {
    return "Internal server error";
  }

  return error.message;
};

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = (req.headers["x-request-id"] as string) || "unknown";

  const logContext = {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    userAgent: req.headers["user-agent"],
    ip: req.ip || req.socket.remoteAddress,
    userId: (req as any).user?.dialist_id || (req as any).user?.userId,
    timestamp: new Date().toISOString(),
    errorName: error.name,
    errorMessage: error.message,
    isOperational: isOperationalError(error),
    ...(error instanceof AppError && error.details
      ? { details: error.details }
      : {}),
  };

  if (isOperationalError(error)) {
    logger.warn(`[Error] Operational error: ${error.message}`, logContext);
  } else {
    logger.error(`[Error] System error: ${error.message}`, {
      ...logContext,
      stack: error.stack,
    });
  }

  // Handle Axios timeout errors specifically
  if (
    error.message?.includes("timeout") ||
    (error as any).code === "ECONNABORTED"
  ) {
    const response: ApiError = {
      error: {
        message: "Request timed out. Please try again.",
        code: "TIMEOUT_ERROR",
      },
      requestId,
    };

    res.status(408).json(response);
    return;
  }

  // Handle network/connection errors
  if (
    (error as any).code === "ENOTFOUND" ||
    (error as any).code === "ECONNREFUSED"
  ) {
    const response: ApiError = {
      error: {
        message: "Service temporarily unavailable. Please try again.",
        code: "SERVICE_UNAVAILABLE",
      },
      requestId,
    };

    res.status(503).json(response);
    return;
  }

  // Handle Mongoose validation errors
  if (error.name === "ValidationError" && "errors" in error) {
    const details = Object.values((error as any).errors).map((err: any) => ({
      field: err.path,
      message: err.message,
    }));

    const response: ApiError = {
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details,
      },
      requestId,
    };

    res.status(400).json(response);
    return;
  }

  // Handle Mongoose cast errors
  if (error.name === "CastError") {
    const response: ApiError = {
      error: {
        message: "Invalid resource ID format",
        code: "INVALID_ID",
      },
      requestId,
    };

    res.status(400).json(response);
    return;
  }

  // Handle duplicate key errors
  if (
    error.name === "MongoServerError" &&
    "code" in error &&
    (error as any).code === 11000
  ) {
    const response: ApiError = {
      error: {
        message: "Resource already exists",
        code: "DUPLICATE_RESOURCE",
      },
      requestId,
    };

    res.status(409).json(response);
    return;
  }

  // Handle PaymentError specifically - FINIX CERTIFICATION REQUIREMENT
  // Return detailed error info for frontend to display proper decline messages
  if (error instanceof PaymentError) {
    // Prefer a human-readable failure_message from Finix if the mapped message
    // looks generic or simply contains the raw code like 'Payment failed: CODE'.
    const altMessage =
      error.message.startsWith("Payment failed:") && error.failure_message
        ? error.failure_message
        : error.message;

    const paymentResponse = {
      error: {
        message: altMessage,
        code: error.code,
        failure_code: error.failure_code,
        failure_message: error.failure_message,
        avs_result: error.avs_result,
        cvv_result: error.cvv_result,
        ...(error.details ? { details: error.details } : {}),
      },
      requestId,
    };

    logger.warn(`[Payment Error] ${error.failure_code}: ${error.message}`, {
      ...logContext,
      failure_code: error.failure_code,
      failure_message: error.failure_message,
      avs_result: error.avs_result,
      cvv_result: error.cvv_result,
    });

    res.status(error.statusCode).json(paymentResponse);
    return;
  }

  // Handle unexpected errors
  // Handle AppError subclassing - return the error's own status and code
  if (error instanceof AppError) {
    const response: ApiError = {
      error: {
        message: sanitizeError(error),
        code: (error as AppError).code,
        ...(error.details ? { details: error.details } : {}),
      },
      requestId,
    };

    res.status((error as AppError).statusCode).json(response);
    return;
  }

  const response: ApiError = {
    error: {
      message: sanitizeError(error),
      code: "INTERNAL_ERROR",
    },
    requestId,
  };

  res.status(500).json(response);
};
