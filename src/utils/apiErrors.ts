/**
 * Standardized API Error Responses
 *
 * Provides consistent error response formatting across all routes.
 * Use these helpers instead of inline error responses.
 */

import { Response } from 'express';

/**
 * Standard error codes
 */
export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORKS_ONLY: 'NETWORKS_ONLY',
  MARKETPLACE_ONLY: 'MARKETPLACE_ONLY',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: any;
  };
  requestId?: string;
}

/**
 * Send standardized error response
 */
export const sendError = (
  res: Response,
  status: number,
  message: string,
  code?: ErrorCode,
  details?: any
): void => {
  const response: ApiErrorResponse = {
    error: {
      message,
      ...(code && { code }),
      ...(details && { details }),
    },
    requestId: (res.req as any)?.requestId,
  };

  res.status(status).json(response);
};

// Convenience methods for common errors

export const badRequest = (res: Response, message: string, details?: any): void => {
  sendError(res, 400, message, ErrorCodes.BAD_REQUEST, details);
};

export const unauthorized = (res: Response, message = 'Unauthorized'): void => {
  sendError(res, 401, message, ErrorCodes.UNAUTHORIZED);
};

export const forbidden = (res: Response, message = 'Forbidden'): void => {
  sendError(res, 403, message, ErrorCodes.FORBIDDEN);
};

export const notFound = (res: Response, message = 'Resource not found'): void => {
  sendError(res, 404, message, ErrorCodes.NOT_FOUND);
};

export const conflict = (res: Response, message: string): void => {
  sendError(res, 409, message, ErrorCodes.CONFLICT);
};

export const validationError = (res: Response, details: any): void => {
  sendError(res, 400, 'Validation failed', ErrorCodes.VALIDATION_ERROR, details);
};

export const internalError = (res: Response, message = 'Internal server error'): void => {
  sendError(res, 500, message, ErrorCodes.INTERNAL_ERROR);
};

/**
 * Validation error from Zod or similar
 */
export class ValidationError extends Error {
  public readonly errors: Array<{ field: string; message: string }>;
  public readonly statusCode = 400;

  constructor(message: string, errors: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * API Error for throwing from services
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: any;

  constructor(
    statusCode: number,
    message: string,
    code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
    details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: any): ApiError {
    return new ApiError(400, message, ErrorCodes.BAD_REQUEST, details);
  }

  static notFound(message: string): ApiError {
    return new ApiError(404, message, ErrorCodes.NOT_FOUND);
  }

  static forbidden(message: string): ApiError {
    return new ApiError(403, message, ErrorCodes.FORBIDDEN);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, message, ErrorCodes.CONFLICT);
  }
}
