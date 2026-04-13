import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { apiLogger } from "../utils/logger";

// Request ID middleware - adds unique identifier to each request
export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const id = (req.headers["x-request-id"] as string) || randomUUID();
  req.headers["x-request-id"] = id;
  res.setHeader("x-request-id", id);

  req.metrics = {
    startTime: Date.now(),
    requestId: id,
  };

  next();
};

// Enhanced request logging with performance metrics
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const requestId = req.headers["x-request-id"];

  apiLogger.info(`📨 ${req.method} ${req.url}`, {
    requestId,
    userAgent: req.headers["user-agent"],
    ip: req.ip || req.socket.remoteAddress,
    contentLength: req.headers["content-length"] || 0,
    userId: (req as any).user?.dialist_id,
  });

  res.on("finish", () => {
    const duration = req.metrics ? Date.now() - req.metrics.startTime : 0;
    const level = res.statusCode >= 400 ? "warn" : "info";
    const emoji = res.statusCode >= 400 ? "❌" : "✅";

    apiLogger.log(
      level,
      `${emoji} ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`,
      {
        requestId,
        statusCode: res.statusCode,
        duration,
        contentLength: res.getHeader("content-length") || 0,
        userId: (req as any).user?.dialist_id,
      },
    );

    if (duration > 1000) {
      apiLogger.warn(
        `🐌 Slow request detected: ${req.method} ${req.url} took ${duration}ms`,
        {
          requestId,
          threshold: "1000ms",
          userId: (req as any).user?.dialist_id,
        },
      );
    }
  });

  res.on("error", (error) => {
    apiLogger.error(`💥 Response error for ${req.method} ${req.url}`, {
      requestId,
      error: error.message,
      stack: error.stack,
      userId: (req as any).user?.dialist_id,
    });
  });

  next();
};

// Rate limiting helper
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // requests per window

export const rateLimit = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Skip rate limiting in non-production environments
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  const clientId = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  for (const [key, value] of requestCounts.entries()) {
    if (value.resetTime < windowStart) {
      requestCounts.delete(key);
    }
  }

  const clientData = requestCounts.get(clientId) || {
    count: 0,
    resetTime: now,
  };

  if (clientData.resetTime < windowStart) {
    clientData.count = 1;
    clientData.resetTime = now;
  } else {
    clientData.count++;
  }

  requestCounts.set(clientId, clientData);

  res.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX);
  res.setHeader(
    "X-RateLimit-Remaining",
    Math.max(0, RATE_LIMIT_MAX - clientData.count),
  );
  res.setHeader(
    "X-RateLimit-Reset",
    Math.ceil((clientData.resetTime + RATE_LIMIT_WINDOW) / 1000),
  );

  if (clientData.count > RATE_LIMIT_MAX) {
    const requestId = req.headers["x-request-id"] as string;

    apiLogger.warn(`🚦 Rate limit exceeded for client ${clientId}`, {
      requestId,
      clientId,
      count: clientData.count,
      limit: RATE_LIMIT_MAX,
    });

    res.status(429).json({
      error: {
        message: "Too many requests, please try again later",
        code: "RATE_LIMIT_EXCEEDED",
      },
      requestId,
    });
    return;
  }

  next();
};

// ============================================================
// Per-Endpoint Rate Limiter Factory
// ============================================================

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string; // Prefix for the rate limit key
  useUserId?: boolean; // Use authenticated user ID instead of IP
  message?: string; // Custom error message
}

const endpointRateLimits = new Map<
  string,
  { count: number; resetTime: number }
>();

/**
 * Creates a configurable rate limiter middleware
 *
 * @example
 * // 5 offers per hour per user
 * router.post("/offers", createRateLimiter({
 *   windowMs: 60 * 60 * 1000,
 *   maxRequests: 5,
 *   keyPrefix: "offer_create",
 *   useUserId: true
 * }), createOfferHandler);
 */
export const createRateLimiter = (config: RateLimitConfig) => {
  const {
    windowMs,
    maxRequests,
    keyPrefix,
    useUserId = true,
    message = "Rate limit exceeded. Please try again later.",
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Build rate limit key
    let keyIdentifier: string;
    if (useUserId && (req as any).auth?.userId) {
      keyIdentifier = (req as any).auth.userId;
    } else {
      keyIdentifier = req.ip || req.socket.remoteAddress || "unknown";
    }
    const key = `${keyPrefix}:${keyIdentifier}`;
    const now = Date.now();

    // Probabilistic cleanup (every ~100 requests) to avoid linear scan on hot path
    if (Math.random() < 0.01) {
      for (const [k, value] of endpointRateLimits.entries()) {
        if (value.resetTime < now - windowMs) {
          endpointRateLimits.delete(k);
        }
      }
    }

    // Get or create entry
    let entry = endpointRateLimits.get(key);
    if (!entry || entry.resetTime < now - windowMs) {
      entry = { count: 0, resetTime: now };
    }

    entry.count++;
    endpointRateLimits.set(key, entry);

    // Set rate limit headers
    const remaining = Math.max(0, maxRequests - entry.count);
    res.setHeader(`X-RateLimit-Limit-${keyPrefix}`, maxRequests);
    res.setHeader(`X-RateLimit-Remaining-${keyPrefix}`, remaining);
    res.setHeader(
      `X-RateLimit-Reset-${keyPrefix}`,
      Math.ceil((entry.resetTime + windowMs) / 1000),
    );

    // Check if exceeded
    if (entry.count > maxRequests) {
      const requestId = req.headers["x-request-id"] as string;
      const userId = (req as any).auth?.userId;

      apiLogger.warn(`🚦 Rate limit exceeded for ${keyPrefix}`, {
        requestId,
        key,
        count: entry.count,
        limit: maxRequests,
        windowMs,
        userId,
      });

      res.status(429).json({
        error: {
          message,
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: Math.ceil((entry.resetTime + windowMs - now) / 1000),
        },
        requestId,
      });
      return;
    }

    next();
  };
};

// Pre-configured rate limiters for common use cases
export const rateLimiters = {
  // Offer creation: 10 offers per hour
  offerCreate: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: "offer_create",
    useUserId: true,
    message:
      "You have reached the maximum number of offers per hour. Please try again later.",
  }),

  // Counter offers: 20 per hour
  offerCounter: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 20,
    keyPrefix: "offer_counter",
    useUserId: true,
    message: "You have reached the maximum number of counter offers per hour.",
  }),

  // Vouch creation: 5 vouches per hour
  vouchCreate: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: "vouch_create",
    useUserId: true,
    message:
      "You have reached the maximum number of vouches per hour. Please try again later.",
  }),

  // Reference check creation: 3 per hour
  referenceCheckCreate: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    keyPrefix: "refcheck_create",
    useUserId: true,
    message:
      "You have reached the maximum number of reference checks per hour.",
  }),

  // Auth token generation: 10 per minute
  authToken: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: "auth_token",
    useUserId: false,
    message: "Too many token requests. Please wait before trying again.",
  }),
};

// Health check with system metrics
export const healthCheck = (req: Request, res: Response): void => {
  const requestId = req.headers["x-request-id"] as string;

  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
    },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid,
    },
    requestId,
  };

  res.json(healthData);
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId = req.headers["x-request-id"] as string;

  apiLogger.warn(`🗺️ Route not found: ${req.method} ${req.path}`, {
    requestId,
    userAgent: req.headers["user-agent"],
    ip: req.ip || req.socket.remoteAddress,
    userId: (req as any).user?.dialist_id,
  });

  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: "ROUTE_NOT_FOUND",
      suggestion: "Check the API documentation for available endpoints",
    },
    requestId,
  });
};

// Readiness check for Kubernetes readiness probes
// Unlike healthCheck, this verifies external dependencies are ready
export const readinessCheck = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const requestId = req.headers["x-request-id"] as string;

  try {
    // Check MongoDB connection
    const dbState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting

    const isDbReady = dbState === 1;

    if (!isDbReady) {
      apiLogger.warn("Readiness check failed: Database not connected", {
        requestId,
        dbState,
      });

      res.status(503).json({
        status: "not_ready",
        reason: "Database connection not established",
        checks: {
          database: {
            status: "unhealthy",
            state: dbState,
          },
        },
        requestId,
      });
      return;
    }

    res.json({
      status: "ready",
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: "healthy",
          state: "connected",
        },
      },
      requestId,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    apiLogger.error("Readiness check error", {
      requestId,
      error: errorMessage,
    });

    res.status(503).json({
      status: "not_ready",
      reason: "Readiness check failed",
      error: errorMessage,
      requestId,
    });
  }
};
