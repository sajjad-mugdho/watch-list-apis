/**
 * Friendship Service (Gap Fill Phase 4)
 * 
 * Business logic for friend requests and relationships
 * Handles request/accept/decline flow and user stats updates
 */

import { Types } from "mongoose";
import { Friendship, IFriendship, FriendshipStatus } from "../../models/Friendship";
import { User } from "../../models/User";
import { NotificationService } from "../notification/NotificationService";
import logger from "../../utils/logger";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export interface SendFriendRequestInput {
  requester_id: string;
  addressee_id: string;
}

export interface FriendRequestResponse {
  friendship_id: string;
  status: FriendshipStatus;
}

// ----------------------------------------------------------
// Service Class
// ----------------------------------------------------------

export class FriendshipService {
  private notificationService: NotificationService;
  
  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }
  
  /**
   * Send a friend request
   */
  async sendRequest(input: SendFriendRequestInput): Promise<IFriendship> {
    const { requester_id, addressee_id } = input;
    
    // Can't friend yourself
    if (requester_id === addressee_id) {
      throw new Error("Cannot send friend request to yourself");
    }
    
    // Check if addressee exists
    const addressee = await User.findById(addressee_id);
    if (!addressee) {
      throw new Error("User not found");
    }
    
    // Check if friendship already exists (in either direction)
    const existingFriendship = await Friendship.findOne({
      $or: [
        { requester_id, addressee_id },
        { requester_id: addressee_id, addressee_id: requester_id },
      ],
    });
    
    if (existingFriendship) {
      if (existingFriendship.status === "accepted") {
        throw new Error("You are already friends with this user");
      } else if (existingFriendship.status === "pending") {
        // Check if they sent a request to us - auto-accept
        if (existingFriendship.requester_id.toString() === addressee_id) {
          return this.acceptRequest(existingFriendship._id.toString(), requester_id);
        }
        throw new Error("Friend request already pending");
      } else if (existingFriendship.status === "declined") {
        // Re-send request by updating status to pending
        existingFriendship.status = "pending";
        existingFriendship.requester_id = new Types.ObjectId(requester_id);
        existingFriendship.addressee_id = new Types.ObjectId(addressee_id);
        await existingFriendship.save();
        
        // Send notification
        await this.sendFriendRequestNotification(requester_id, addressee_id, existingFriendship._id.toString());
        
        return existingFriendship;
      }
    }
    
    // Create new friend request
    const friendship = await Friendship.create({
      requester_id: new Types.ObjectId(requester_id),
      addressee_id: new Types.ObjectId(addressee_id),
      status: "pending",
    });
    
    // Send notification
    await this.sendFriendRequestNotification(requester_id, addressee_id, friendship._id.toString());
    
    logger.info("Friend request sent", { 
      friendship_id: friendship._id, 
      requester_id, 
      addressee_id 
    });
    
    return friendship;
  }
  
  /**
   * Accept a friend request
   */
  async acceptRequest(friendshipId: string, userId: string): Promise<IFriendship> {
    const friendship = await Friendship.findById(friendshipId);
    
    if (!friendship) {
      throw new Error("Friend request not found");
    }
    
    // Only the addressee can accept
    if (friendship.addressee_id.toString() !== userId) {
      throw new Error("You cannot accept this friend request");
    }
    
    if (friendship.status !== "pending") {
      throw new Error(`Cannot accept: request is ${friendship.status}`);
    }
    
    // Update to accepted
    friendship.status = "accepted";
    friendship.accepted_at = new Date();
    await friendship.save();
    
    // Update friend counts for both users
    await this.updateFriendCounts(
      friendship.requester_id.toString(),
      friendship.addressee_id.toString()
    );
    
    // Notify the requester
    try {
      const accepter = await User.findById(userId).select("display_name");
      await this.notificationService.create({
        userId: friendship.requester_id.toString(),
        type: "friend_request_accepted",
        title: "Friend Request Accepted",
        body: `${accepter?.display_name || "Someone"} accepted your friend request`,
        data: {
          friendship_id: friendship._id.toString(),
          friend_id: userId,
        },
      });
    } catch (err) {
      logger.warn("Failed to send friend accepted notification", { err });
    }
    
    logger.info("Friend request accepted", { friendship_id: friendshipId });
    
    return friendship;
  }
  
  /**
   * Decline a friend request
   */
  async declineRequest(friendshipId: string, userId: string): Promise<void> {
    const friendship = await Friendship.findById(friendshipId);
    
    if (!friendship) {
      throw new Error("Friend request not found");
    }
    
    // Only the addressee can decline
    if (friendship.addressee_id.toString() !== userId) {
      throw new Error("You cannot decline this friend request");
    }
    
    if (friendship.status !== "pending") {
      throw new Error(`Cannot decline: request is ${friendship.status}`);
    }
    
    // Update to declined
    friendship.status = "declined";
    await friendship.save();
    
    // Optionally notify the requester
    try {
      await this.notificationService.create({
        userId: friendship.requester_id.toString(),
        type: "friend_request_declined",
        title: "Friend Request",
        body: "Your friend request was not accepted",
        data: {
          friendship_id: friendship._id.toString(),
        },
      });
    } catch (err) {
      logger.warn("Failed to send friend declined notification", { err });
    }
    
    logger.info("Friend request declined", { friendship_id: friendshipId });
  }
  
  /**
   * Remove a friend (unfriend)
   */
  async removeFriend(friendshipId: string, userId: string): Promise<void> {
    const friendship = await Friendship.findById(friendshipId);
    
    if (!friendship) {
      throw new Error("Friendship not found");
    }
    
    // Either party can unfriend
    const isParticipant = 
      friendship.requester_id.toString() === userId ||
      friendship.addressee_id.toString() === userId;
    
    if (!isParticipant) {
      throw new Error("You are not part of this friendship");
    }
    
    if (friendship.status !== "accepted") {
      throw new Error("Not currently friends");
    }
    
    // Delete the friendship
    await friendship.deleteOne();
    
    // Update friend counts
    await this.updateFriendCounts(
      friendship.requester_id.toString(),
      friendship.addressee_id.toString()
    );
    
    logger.info("Friendship removed", { friendship_id: friendshipId, by_user: userId });
  }
  
  /**
   * Get list of friends for a user
   */
  async getFriends(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ friends: any[]; total: number }> {
    const { limit = 50, offset = 0 } = options;
    const objId = new Types.ObjectId(userId);
    
    // Get friendships where user is either requester or addressee
    const query = {
      $or: [
        { requester_id: objId, status: "accepted" },
        { addressee_id: objId, status: "accepted" },
      ],
    };
    
    const [friendships, total] = await Promise.all([
      Friendship.find(query)
        .sort({ accepted_at: -1 })
        .skip(offset)
        .limit(limit)
        .populate("requester_id", "display_name avatar")
        .populate("addressee_id", "display_name avatar")
        .lean(),
      Friendship.countDocuments(query),
    ]);
    
    // Extract the friend info (the other user in each friendship)
    const friends = friendships.map((f: any) => {
      const isRequester = f.requester_id._id?.toString() === userId;
      return {
        friendship_id: f._id.toString(),
        user: isRequester ? f.addressee_id : f.requester_id,
        since: f.accepted_at,
      };
    });
    
    return { friends, total };
  }
  
  /**
   * Get pending friend requests for a user
   */
  async getPendingRequests(userId: string): Promise<any[]> {
    return Friendship.getPendingRequests(userId);
  }
  
  /**
   * Check if two users are friends
   */
  async areFriends(userIdA: string, userIdB: string): Promise<boolean> {
    return Friendship.areFriends(userIdA, userIdB);
  }

  /**
   * Get mutual friends between two users
   */
  async getMutualFriends(
    userIdA: string,
    userIdB: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ friends: any[]; total: number }> {
    const { limit = 50, offset = 0 } = options;
    
    // Get common IDs
    const mutualIds = await Friendship.getMutualFriends(userIdA, userIdB);
    const total = mutualIds.length;

    // Fetch user profiles for the subset
    const paginatedIds = mutualIds.slice(offset, offset + limit);
    const friends = await User.find({ _id: { $in: paginatedIds } })
      .select("display_name avatar")
      .lean();

    return { friends, total };
  }
  
  // ----------------------------------------------------------
  // Private Helpers
  // ----------------------------------------------------------
  
  private async sendFriendRequestNotification(
    requesterId: string,
    addresseeId: string,
    friendshipId: string
  ): Promise<void> {
    try {
      const requester = await User.findById(requesterId).select("display_name");
      await this.notificationService.create({
        userId: addresseeId,
        type: "friend_request_received",
        title: "New Friend Request",
        body: `${requester?.display_name || "Someone"} wants to be your friend`,
        data: {
          friendship_id: friendshipId,
          requester_id: requesterId,
        },
      });
    } catch (err) {
      logger.warn("Failed to send friend request notification", { err });
    }
  }
  
  private async updateFriendCounts(userId1: string, userId2: string): Promise<void> {
    // Get and update counts for both users
    const [count1, count2] = await Promise.all([
      Friendship.getFriendCount(userId1),
      Friendship.getFriendCount(userId2),
    ]);
    
    await Promise.all([
      User.findByIdAndUpdate(userId1, { $set: { "stats.friend_count": count1 } }),
      User.findByIdAndUpdate(userId2, { $set: { "stats.friend_count": count2 } }),
    ]);
    
    logger.info("Friend counts updated", { 
      user1: { id: userId1, count: count1 },
      user2: { id: userId2, count: count2 },
    });
  }
}

// ----------------------------------------------------------
// Export singleton
// ----------------------------------------------------------

export const friendshipService = new FriendshipService();
