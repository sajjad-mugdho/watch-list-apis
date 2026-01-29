/**
 * API Response Utilities
 * 
 * Standardized response format helpers for consistent API responses.
 * All endpoints should use these helpers to ensure uniform response structure.
 */

import { Request } from "express";
import { ApiResponse, ApiError, PagingMeta } from "../types";

/**
 * Get request ID from headers or generate a fallback
 */
function getRequestId(req: Request): string {
  return (req.headers["x-request-id"] as string) || `req_${Date.now()}`;
}

/**
 * Create a standard success response
 */
export function successResponse<T>(
  req: Request,
  data: T,
  options?: {
    message?: string;
    paging?: PagingMeta;
    filters?: Record<string, any>;
    sort?: { field: string; order: "asc" | "desc" };
  }
): ApiResponse<T> {
  const response: ApiResponse<T> = {
    data,
    requestId: getRequestId(req),
  };

  if (options?.message) {
    response.message = options.message;
  }

  // Add _metadata if any metadata fields are provided
  if (options?.paging || options?.filters || options?.sort) {
    response._metadata = {};
    
    if (options.paging) {
      response._metadata.paging = options.paging;
    }
    if (options.filters) {
      response._metadata.filters = options.filters;
    }
    if (options.sort) {
      response._metadata.sort = options.sort;
    }
  }

  return response;
}

export function paginatedResponse<T>(
  req: Request,
  data: T[],
  options: {
    total: number;
    limit: number;
    offset: number;
    filters?: Record<string, any>;
    sort?: { field: string; order: "asc" | "desc" };
  }
): ApiResponse<T[]> {
  const { total, limit, offset, filters, sort } = options;
  
  // Build options object conditionally to avoid passing undefined
  const successOpts: {
    paging: PagingMeta;
    filters?: Record<string, any>;
    sort?: { field: string; order: "asc" | "desc" };
  } = {
    paging: {
      count: data.length,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
  
  if (filters) successOpts.filters = filters;
  if (sort) successOpts.sort = sort;
  
  return successResponse(req, data, successOpts);
}

export function pageBasedResponse<T>(
  req: Request,
  data: T[],
  options: {
    total: number;
    page: number;
    limit: number;
    filters?: Record<string, any>;
    sort?: { field: string; order: "asc" | "desc" };
  }
): ApiResponse<T[]> {
  const { total, page, limit, filters, sort } = options;
  
  // Build options object conditionally to avoid passing undefined
  const successOpts: {
    paging: PagingMeta;
    filters?: Record<string, any>;
    sort?: { field: string; order: "asc" | "desc" };
  } = {
    paging: {
      count: data.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
  
  if (filters) successOpts.filters = filters;
  if (sort) successOpts.sort = sort;
  
  return successResponse(req, data, successOpts);
}

/**
 * Create a standard error response
 */
export function errorResponse(
  req: Request,
  message: string,
  code: string,
  details?: unknown
): ApiError {
  return {
    error: {
      message,
      code,
      ...(details ? { details } : {}),
    },
    requestId: getRequestId(req),
  };
}

/**
 * Create a single-item success response with message
 */
export function createdResponse<T>(
  req: Request,
  data: T,
  message: string = "Created successfully"
): ApiResponse<T> {
  return successResponse(req, data, { message });
}

/**
 * Create a deletion/update confirmation response
 */
export function actionResponse(
  req: Request,
  success: boolean,
  message: string
): ApiResponse<{ success: boolean }> {
  return successResponse(req, { success }, { message });
}
