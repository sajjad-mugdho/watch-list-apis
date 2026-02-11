/**
 * Idempotency Middleware
 *
 * Ensures critical operations (offer-accept, order-create) are not processed
 * more than once when the same X-Idempotency-Key header is sent.
 *
 * Uses an in-memory cache with TTL. In production, swap to Redis.
 */

import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

// ============================================================
// In-memory idempotency store (swap for Redis in production)
// ============================================================
interface CacheEntry {
  status: "processing" | "completed";
  response?: { statusCode: number; body: any };
  createdAt: number;
}

const idempotencyCache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache.entries()) {
    if (now - entry.createdAt > DEFAULT_TTL_MS) {
      idempotencyCache.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

// ============================================================
// Middleware Factory
// ============================================================

/**
 * Creates idempotency middleware for a specific route.
 *
 * Usage:
 *   router.post('/orders', idempotency(), createOrderHandler);
 *   router.put('/offers/:id/accept', idempotency(), acceptOfferHandler);
 *
 * Client sends: X-Idempotency-Key: <unique-uuid>
 *
 * Behavior:
 *   - No header → pass through (no idempotency check)
 *   - First request with key → store "processing", let request through
 *   - Subsequent request with same key while processing → 409 Conflict
 *   - Subsequent request with same key after completed → return cached response
 */
export function idempotency(options?: { required?: boolean }) {
  const { required = false } = options || {};

  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const idempotencyKey = req.headers["x-idempotency-key"] as string;

    if (!idempotencyKey) {
      if (required) {
        res.status(400).json({
          error: {
            code: "IDEMPOTENCY_KEY_REQUIRED",
            message:
              "X-Idempotency-Key header is required for this operation",
          },
        });
        return;
      }
      // Not required, proceed without idempotency
      return next();
    }

    // Build a unique key scoped to user + operation + idempotency key
    const auth = (req as any).auth;
    const userId = auth?.userId || "anonymous";
    const cacheKey = `${userId}:${req.method}:${req.baseUrl}${req.path}:${idempotencyKey}`;

    const existing = idempotencyCache.get(cacheKey);

    if (existing) {
      if (existing.status === "processing") {
        logger.warn("[Idempotency] Duplicate request while processing", {
          key: idempotencyKey,
        });
        res.status(409).json({
          error: {
            code: "IDEMPOTENCY_CONFLICT",
            message:
              "A request with this idempotency key is already being processed",
          },
        });
        return;
      }

      if (existing.status === "completed" && existing.response) {
        logger.info("[Idempotency] Returning cached response", {
          key: idempotencyKey,
        });
        res
          .status(existing.response.statusCode)
          .json(existing.response.body);
        return;
      }
    }

    // Mark as processing
    idempotencyCache.set(cacheKey, {
      status: "processing",
      createdAt: Date.now(),
    });

    // Intercept res.json to capture the response
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      idempotencyCache.set(cacheKey, {
        status: "completed",
        response: { statusCode: res.statusCode, body },
        createdAt: Date.now(),
      });
      return originalJson(body);
    };

    // If the request errors out, clean up the processing entry
    res.on("close", () => {
      const entry = idempotencyCache.get(cacheKey);
      if (entry?.status === "processing") {
        // Request ended without calling res.json — remove stale entry
        idempotencyCache.delete(cacheKey);
      }
    });

    next();
  };
}
