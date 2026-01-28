/**
 * FriendshipService Unit Tests
 * Gap Fill Phase 4
 */

import { FriendshipService } from '../../../src/services/friendship/FriendshipService';
import { Friendship } from '../../../src/models/Friendship';
import { User } from '../../../src/models/User';
import { Types } from 'mongoose';

// Mock the dependencies
jest.mock('../../../src/models/Friendship');
jest.mock('../../../src/models/User');
jest.mock('../../../src/services/notification/NotificationService');

describe('FriendshipService', () => {
  let friendshipService: FriendshipService;
  const mockNotificationService = {
    create: jest.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    friendshipService = new FriendshipService(mockNotificationService as any);
  });

  describe('sendRequest', () => {
    const requesterId = new Types.ObjectId().toString();
    const addresseeId = new Types.ObjectId().toString();

    it('should create a new friend request', async () => {
      // Mock user exists
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: addresseeId, display_name: 'Test User' }),
      });
      
      // Mock no existing friendship
      (Friendship.findOne as jest.Mock).mockResolvedValue(null);
      
      // Mock create
      const mockFriendship = {
        _id: new Types.ObjectId(),
        requester_id: new Types.ObjectId(requesterId),
        addressee_id: new Types.ObjectId(addresseeId),
        status: 'pending',
      };
      (Friendship.create as jest.Mock).mockResolvedValue(mockFriendship);

      const result = await friendshipService.sendRequest({
        requester_id: requesterId,
        addressee_id: addresseeId,
      });

      expect(result.status).toBe('pending');
      expect(Friendship.create).toHaveBeenCalled();
    });

    it('should throw error when friending yourself', async () => {
      await expect(friendshipService.sendRequest({
        requester_id: requesterId,
        addressee_id: requesterId,
      })).rejects.toThrow('Cannot send friend request to yourself');
    });

    it('should throw error when user not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(friendshipService.sendRequest({
        requester_id: requesterId,
        addressee_id: addresseeId,
      })).rejects.toThrow('User not found');
    });

    it('should throw error when already friends', async () => {
      (User.findById as jest.Mock).mockResolvedValue({ _id: addresseeId });
      
      (Friendship.findOne as jest.Mock).mockResolvedValue({
        status: 'accepted',
        requester_id: new Types.ObjectId(requesterId),
        addressee_id: new Types.ObjectId(addresseeId),
      });

      await expect(friendshipService.sendRequest({
        requester_id: requesterId,
        addressee_id: addresseeId,
      })).rejects.toThrow('You are already friends with this user');
    });

    it('should throw error when request already pending', async () => {
      (User.findById as jest.Mock).mockResolvedValue({ _id: addresseeId });
      
      (Friendship.findOne as jest.Mock).mockResolvedValue({
        status: 'pending',
        requester_id: new Types.ObjectId(requesterId),
        addressee_id: new Types.ObjectId(addresseeId),
      });

      await expect(friendshipService.sendRequest({
        requester_id: requesterId,
        addressee_id: addresseeId,
      })).rejects.toThrow('Friend request already pending');
    });
  });

  describe('acceptRequest', () => {
    it('should accept a pending request', async () => {
      const friendshipId = new Types.ObjectId().toString();
      const addresseeId = new Types.ObjectId().toString();
      const requesterId = new Types.ObjectId().toString();

      const mockFriendship = {
        _id: new Types.ObjectId(friendshipId),
        requester_id: new Types.ObjectId(requesterId),
        addressee_id: new Types.ObjectId(addresseeId),
        status: 'pending',
        save: jest.fn().mockResolvedValue(true),
      };
      (Friendship.findById as jest.Mock).mockResolvedValue(mockFriendship);
      
      // Mock friend count updates
      (Friendship.getFriendCount as jest.Mock).mockResolvedValue(1);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ display_name: 'Test User' }),
      });

      const result = await friendshipService.acceptRequest(friendshipId, addresseeId);

      expect(mockFriendship.status).toBe('accepted');
      expect(mockFriendship.save).toHaveBeenCalled();
      expect(mockNotificationService.create).toHaveBeenCalled();
    });

    it('should throw error if not the addressee', async () => {
      const friendshipId = new Types.ObjectId().toString();
      const wrongUserId = new Types.ObjectId().toString();

      const mockFriendship = {
        _id: new Types.ObjectId(friendshipId),
        requester_id: new Types.ObjectId(),
        addressee_id: new Types.ObjectId(), // Different from wrongUserId
        status: 'pending',
      };
      (Friendship.findById as jest.Mock).mockResolvedValue(mockFriendship);

      await expect(friendshipService.acceptRequest(friendshipId, wrongUserId))
        .rejects.toThrow('You cannot accept this friend request');
    });

    it('should throw error for non-pending request', async () => {
      const friendshipId = new Types.ObjectId().toString();
      const addresseeId = new Types.ObjectId().toString();

      const mockFriendship = {
        _id: new Types.ObjectId(friendshipId),
        requester_id: new Types.ObjectId(),
        addressee_id: new Types.ObjectId(addresseeId),
        status: 'declined',
      };
      (Friendship.findById as jest.Mock).mockResolvedValue(mockFriendship);

      await expect(friendshipService.acceptRequest(friendshipId, addresseeId))
        .rejects.toThrow('Cannot accept: request is declined');
    });
  });

  describe('declineRequest', () => {
    it('should decline a pending request', async () => {
      const friendshipId = new Types.ObjectId().toString();
      const addresseeId = new Types.ObjectId().toString();

      const mockFriendship = {
        _id: new Types.ObjectId(friendshipId),
        requester_id: new Types.ObjectId(),
        addressee_id: new Types.ObjectId(addresseeId),
        status: 'pending',
        save: jest.fn().mockResolvedValue(true),
      };
      (Friendship.findById as jest.Mock).mockResolvedValue(mockFriendship);

      await friendshipService.declineRequest(friendshipId, addresseeId);

      expect(mockFriendship.status).toBe('declined');
      expect(mockFriendship.save).toHaveBeenCalled();
    });
  });

  describe('removeFriend', () => {
    it('should remove an accepted friendship', async () => {
      const friendshipId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      const otherId = new Types.ObjectId().toString();

      const mockFriendship = {
        _id: new Types.ObjectId(friendshipId),
        requester_id: new Types.ObjectId(userId),
        addressee_id: new Types.ObjectId(otherId),
        status: 'accepted',
        deleteOne: jest.fn().mockResolvedValue(true),
      };
      (Friendship.findById as jest.Mock).mockResolvedValue(mockFriendship);
      (Friendship.getFriendCount as jest.Mock).mockResolvedValue(0);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await friendshipService.removeFriend(friendshipId, userId);

      expect(mockFriendship.deleteOne).toHaveBeenCalled();
    });

    it('should throw error if not part of friendship', async () => {
      const friendshipId = new Types.ObjectId().toString();
      const wrongUserId = new Types.ObjectId().toString();

      const mockFriendship = {
        _id: new Types.ObjectId(friendshipId),
        requester_id: new Types.ObjectId(),
        addressee_id: new Types.ObjectId(),
        status: 'accepted',
      };
      (Friendship.findById as jest.Mock).mockResolvedValue(mockFriendship);

      await expect(friendshipService.removeFriend(friendshipId, wrongUserId))
        .rejects.toThrow('You are not part of this friendship');
    });
  });

  describe('getFriends', () => {
    it('should return paginated friends list', async () => {
      const userId = new Types.ObjectId().toString();
      const mockFriendships = [
        {
          _id: new Types.ObjectId(),
          requester_id: { _id: new Types.ObjectId(userId), display_name: 'User' },
          addressee_id: { _id: new Types.ObjectId(), display_name: 'Friend 1' },
          accepted_at: new Date(),
        },
      ];

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockFriendships),
      };
      (Friendship.find as jest.Mock).mockReturnValue(mockFind);
      (Friendship.countDocuments as jest.Mock).mockResolvedValue(1);

      const result = await friendshipService.getFriends(userId);

      expect(result.friends).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('areFriends', () => {
    it('should return true for friends', async () => {
      (Friendship.areFriends as jest.Mock).mockResolvedValue(true);

      const result = await friendshipService.areFriends('user1', 'user2');

      expect(result).toBe(true);
    });

    it('should return false for non-friends', async () => {
      (Friendship.areFriends as jest.Mock).mockResolvedValue(false);

      const result = await friendshipService.areFriends('user1', 'user2');

      expect(result).toBe(false);
    });
  });
});
