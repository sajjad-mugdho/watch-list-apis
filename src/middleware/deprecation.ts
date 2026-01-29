/**
 * Platform Middleware
 * 
 * Contains platform-specific access control middleware.
 */

import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/**
 * Networks-only middleware
 * Gates routes to only work when x-platform header is "networks"
 * Per Michael: Marketplace does NOT support follow functionality
 */
export const networksOnly = (req: Request, res: Response, next: NextFunction) => {
  const platform = req.headers["x-platform"] as string;
  
  // If no platform header, assume networks for backward compatibility
  // but log a warning
  if (!platform) {
    logger.warn("Request without x-platform header on Networks-only route", {
      path: req.path,
      method: req.method,
    });
    next();
    return;
  }
  
  if (platform !== "networks") {
    res.status(400).json({
      error: {
        message: "This endpoint is only available on the Networks platform",
        code: "NETWORKS_ONLY",
      },
    });
    return;
  }
  
  next();
};
