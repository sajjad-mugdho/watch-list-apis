import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { apiLogger } from "../utils/logger";

// Request ID middleware - adds unique identifier to each request
export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction
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
  next: NextFunction
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
      }
    );

    if (duration > 1000) {
      apiLogger.warn(
        `🐌 Slow request detected: ${req.method} ${req.url} took ${duration}ms`,
        {
          requestId,
          threshold: "1000ms",
          userId: (req as any).user?.dialist_id,
        }
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
  next: NextFunction
): void => {
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
    Math.max(0, RATE_LIMIT_MAX - clientData.count)
  );
  res.setHeader(
    "X-RateLimit-Reset",
    Math.ceil((clientData.resetTime + RATE_LIMIT_WINDOW) / 1000)
  );

  if (clientData.count > RATE_LIMIT_MAX) {
    const requestId = req.headers["x-request-id"] as string;

    apiLogger.warn(`🚦 Rate limit exceeded for client ${clientId}`, {
      requestId,
      clientId,
      count: clientData.count,
      limit: RATE_LIMIT_MAX,
      userId: (req as any).user?.dialist_id,
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
