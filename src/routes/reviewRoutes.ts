/**
 * Review Routes (Gap Fill Phase 3)
 * 
 * Endpoints for the review/rating system
 * 
 * Mounted at: /api/v1/reviews
 */

import { Router, Request, Response, NextFunction } from "express";
import { getUserId } from "../middleware/attachUser";
import { validateRequest } from "../middleware/validation";
import {
  createReviewSchema,
  getUserReviewsSchema,
  getReviewSummarySchema,
} from "../validation/schemas";
import { reviewService } from "../services/review/ReviewService";
import { ReviewRole } from "../models/Review";
import { requirePlatformAuth } from "../middleware/authentication";

const router = Router();

// ----------------------------------------------------------
// Create Review
// ----------------------------------------------------------

/**
 * @route POST /api/v1/reviews
 * @desc Create a review for a completed order
 * @access Private (authenticated users only)
 */
router.post(
  "/",
  requirePlatformAuth(),
  validateRequest(createReviewSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reviewer_id = getUserId(req);
      const { order_id, rating, feedback, is_anonymous } = req.body;

      const review = await reviewService.createReview({
        reviewer_id,
        order_id,
        rating,
        feedback,
        is_anonymous,
      });

      res.status(201).json({
        data: review.toJSON(),
        message: "Review created successfully",
      });
    } catch (err) {
      if (err instanceof Error) {
        // Known business logic errors
        if (
          err.message.includes("not found") ||
          err.message.includes("already reviewed") ||
          err.message.includes("not a participant") ||
          err.message.includes("Cannot review order")
        ) {
          res.status(400).json({
            error: {
              message: err.message,
              code: "BAD_REQUEST",
            },
          });
          return;
        }
      }
      next(err);
    }
  }
);

// ----------------------------------------------------------
// Get Reviews for User
// ----------------------------------------------------------

/**
 * @route GET /api/v1/reviews/users/:user_id
 * @desc Get reviews for a specific user
 * @access Public
 */
router.get(
  "/users/:user_id",
  validateRequest(getUserReviewsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user_id } = req.params;
      const { role, limit = 20, offset = 0 } = req.query;

      const { reviews, total } = await reviewService.getReviewsForUser(
        user_id,
        {
          ...(role ? { role: role as ReviewRole } : {}),
          limit: Number(limit),
          offset: Number(offset),
        }
      );

      res.json({
        data: reviews,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route GET /api/v1/reviews/users/:user_id/summary
 * @desc Get rating summary for a specific user
 * @access Public
 */
router.get(
  "/users/:user_id/summary",
  validateRequest(getReviewSummarySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user_id } = req.params;

      const summary = await reviewService.getReviewSummary(user_id);

      res.json({
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------------
// Get My Reviews (as reviewer)
// ----------------------------------------------------------

/**
 * @route GET /api/v1/reviews/me
 * @desc Get reviews written by the current user
 * @access Private
 */
router.get(
  "/me",
  requirePlatformAuth(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reviewer_id = getUserId(req);
      const { limit = 20, offset = 0 } = req.query;

      const { reviews, total } = await reviewService.getReviewsByUser(
        reviewer_id,
        {
          limit: Number(limit),
          offset: Number(offset),
        }
      );

      res.json({
        data: reviews,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export { router as reviewRoutes };
