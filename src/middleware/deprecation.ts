/**
 * Deprecation Middleware
 * 
 * Adds deprecation headers to routes that are being phased out.
 * Per Michael's requirements - routes should be deprecated before removal.
 */

import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/**
 * Middleware to mark routes as deprecated
 * Adds Deprecation and Sunset headers per RFC 8594
 */
export const deprecatedRoute = (options: {
  message: string;
  replacement?: string;
  sunsetDate?: string;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add deprecation header
    res.setHeader("Deprecation", "true");
    
    // Add sunset date if provided
    if (options.sunsetDate) {
      res.setHeader("Sunset", options.sunsetDate);
    }
    
    // Add Link header pointing to replacement
    if (options.replacement) {
      res.setHeader(
        "Link", 
        `<${options.replacement}>; rel="successor-version"`
      );
    }
    
    // Add custom warning header
    res.setHeader(
      "X-Deprecation-Notice",
      options.message
    );

    // Log deprecation access
    logger.warn("Deprecated route accessed", {
      path: req.path,
      method: req.method,
      message: options.message,
      replacement: options.replacement,
    });

    next();
  };
};

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
