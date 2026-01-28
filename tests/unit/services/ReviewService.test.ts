/**
 * ReviewService Unit Tests
 * Gap Fill Phase 3
 */

import { ReviewService } from '../../../src/services/review/ReviewService';
import { Review } from '../../../src/models/Review';
import { Order } from '../../../src/models/Order';
import { User } from '../../../src/models/User';
import { Types } from 'mongoose';

// Mock the dependencies
jest.mock('../../../src/models/Review');
jest.mock('../../../src/models/Order');
jest.mock('../../../src/models/User');
jest.mock('../../../src/services/notification/NotificationService');

describe('ReviewService', () => {
  let reviewService: ReviewService;
  const mockNotificationService = {
    create: jest.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reviewService = new ReviewService(mockNotificationService as any);
  });

  describe('createReview', () => {
    const validInput = {
      reviewer_id: new Types.ObjectId().toString(),
      order_id: new Types.ObjectId().toString(),
      rating: 5,
      feedback: 'Great seller, fast shipping!',
      is_anonymous: false,
    };

    it('should create a review for a delivered order', async () => {
      // Mock order lookup
      const mockOrder = {
        _id: new Types.ObjectId(validInput.order_id),
        buyer_id: new Types.ObjectId(validInput.reviewer_id),
        seller_id: new Types.ObjectId(),
        status: 'delivered',
        listing_id: new Types.ObjectId(),
      };
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      
      // Mock hasReviewed check
      (Review.hasReviewed as jest.Mock).mockResolvedValue(false);
      
      // Mock review creation
      const mockReview = {
        _id: new Types.ObjectId(),
        ...validInput,
        target_user_id: mockOrder.seller_id,
        role: 'buyer',
        toJSON: jest.fn().mockReturnThis(),
      };
      (Review.create as jest.Mock).mockResolvedValue(mockReview);
      
      // Mock stats update
      (Review.getRatingSummary as jest.Mock).mockResolvedValue({
        avg_rating: 5,
        rating_count: 1,
        review_count_as_buyer: 0,
        review_count_as_seller: 1,
        breakdown: { 5: 1 },
      });
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      // Execute
      const result = await reviewService.createReview(validInput);

      // Verify
      expect(Order.findById).toHaveBeenCalledWith(validInput.order_id);
      expect(Review.hasReviewed).toHaveBeenCalledWith(validInput.order_id, validInput.reviewer_id);
      expect(Review.create).toHaveBeenCalled();
      expect(mockNotificationService.create).toHaveBeenCalled();
      expect(result.rating).toBe(5);
    });

    it('should throw error for non-existent order', async () => {
      (Order.findById as jest.Mock).mockResolvedValue(null);

      await expect(reviewService.createReview(validInput))
        .rejects.toThrow('Order not found');
    });

    it('should throw error for pending order', async () => {
      const mockOrder = {
        _id: new Types.ObjectId(validInput.order_id),
        buyer_id: new Types.ObjectId(validInput.reviewer_id),
        seller_id: new Types.ObjectId(),
        status: 'pending',
      };
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);

      await expect(reviewService.createReview(validInput))
        .rejects.toThrow('Cannot review order with status: pending');
    });

    it('should throw error for non-participant reviewer', async () => {
      const mockOrder = {
        _id: new Types.ObjectId(validInput.order_id),
        buyer_id: new Types.ObjectId(), // Different from reviewer
        seller_id: new Types.ObjectId(), // Different from reviewer
        status: 'delivered',
      };
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);

      await expect(reviewService.createReview(validInput))
        .rejects.toThrow('You are not a participant of this order');
    });

    it('should throw error for duplicate review', async () => {
      const mockOrder = {
        _id: new Types.ObjectId(validInput.order_id),
        buyer_id: new Types.ObjectId(validInput.reviewer_id),
        seller_id: new Types.ObjectId(),
        status: 'delivered',
      };
      (Order.findById as jest.Mock).mockResolvedValue(mockOrder);
      (Review.hasReviewed as jest.Mock).mockResolvedValue(true);

      await expect(reviewService.createReview(validInput))
        .rejects.toThrow('You have already reviewed this order');
    });
  });

  describe('getReviewsForUser', () => {
    it('should return paginated reviews', async () => {
      const userId = new Types.ObjectId().toString();
      const mockReviews = [
        { _id: new Types.ObjectId(), rating: 5, feedback: 'Great!' },
        { _id: new Types.ObjectId(), rating: 4, feedback: 'Good.' },
      ];

      // Mock chain: find().sort().skip().limit().populate().lean()
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockReviews),
      };
      (Review.find as jest.Mock).mockReturnValue(mockFind);
      (Review.countDocuments as jest.Mock).mockResolvedValue(10);

      const result = await reviewService.getReviewsForUser(userId, { limit: 2, offset: 0 });

      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(10);
    });

    it('should filter by role when provided', async () => {
      const userId = new Types.ObjectId().toString();
      
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      (Review.find as jest.Mock).mockReturnValue(mockFind);
      (Review.countDocuments as jest.Mock).mockResolvedValue(0);

      await reviewService.getReviewsForUser(userId, { role: 'buyer' });

      expect(Review.find).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'buyer' })
      );
    });
  });

  describe('getReviewSummary', () => {
    it('should return aggregated rating summary', async () => {
      const userId = new Types.ObjectId().toString();
      const mockSummary = {
        avg_rating: 4.5,
        rating_count: 20,
        review_count_as_buyer: 8,
        review_count_as_seller: 12,
        breakdown: { 5: 10, 4: 5, 3: 3, 2: 1, 1: 1 },
      };

      (Review.getRatingSummary as jest.Mock).mockResolvedValue(mockSummary);

      const result = await reviewService.getReviewSummary(userId);

      expect(result.avg_rating).toBe(4.5);
      expect(result.rating_count).toBe(20);
      expect(result.breakdown[5]).toBe(10);
    });
  });

  describe('updateUserStats', () => {
    it('should update user stats with rating summary', async () => {
      const userId = new Types.ObjectId().toString();
      const mockSummary = {
        avg_rating: 4.5,
        rating_count: 10,
        review_count_as_buyer: 4,
        review_count_as_seller: 6,
        breakdown: {},
      };

      (Review.getRatingSummary as jest.Mock).mockResolvedValue(mockSummary);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await reviewService.updateUserStats(userId);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        {
          $set: {
            'stats.avg_rating': 4.5,
            'stats.rating_count': 10,
            'stats.review_count_as_buyer': 4,
            'stats.review_count_as_seller': 6,
          },
        }
      );
    });
  });
});
