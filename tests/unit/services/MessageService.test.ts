import {
  messageRepository,
  channelRepository,
  userRepository,
} from "../../../src/repositories";
import { chatService } from "../../../src/services/ChatService";
import { events } from "../../../src/utils/events";
import { Types } from "mongoose";
import { MarketplaceListingChannel } from "../../../src/models/MarketplaceListingChannel";
import { MarketplaceListing } from "../../../src/models/Listings";
import { User } from "../../../src/models/User";
import { messageService } from "../../../src/services";

describe("MessageService", () => {
  let buyerId: string;
  let sellerId: string;
  let channelId: string;
  let getstreamChannelId = "gs_channel_123";
  let listingId: string;

  beforeEach(async () => {
    // Clear DB
    await MarketplaceListing.deleteMany({});
    await MarketplaceListingChannel.deleteMany({});
    await User.deleteMany({});
    await (messageRepository as any).model.deleteMany({});

    // Setup basic entities
    const buyer = await User.create({
      clerk_id: "buyer_clerk",
      email: "buyer@test.com",
      first_name: "Buyer",
      last_name: "One",
    });
    buyerId = buyer._id.toString();

    const seller = await User.create({
      clerk_id: "seller_clerk",
      email: "seller@test.com",
      first_name: "Seller",
      last_name: "Two",
    });
    sellerId = seller._id.toString();

    const listing = await MarketplaceListing.create({
      dialist_id: seller._id,
      clerk_id: "seller_clerk",
      watch_id: new Types.ObjectId(),
      title: "Rolex Submariner 126610LN",
      brand: "Rolex",
      model: "Submariner",
      reference: "126610LN",
      diameter: "41mm",
      bezel: "Ceramic",
      materials: "Oystersteel",
      bracelet: "Oyster",
      ships_from: { country: "US" },
      watch_snapshot: {
        brand: "Rolex",
        model: "Submariner",
        reference: "126610LN",
        diameter: "41mm",
        bezel: "Ceramic",
        materials: "Oystersteel",
        bracelet: "Oyster",
      },
      price: 15000,
      status: "active",
      allow_offers: true,
      author: {
        _id: seller._id,
        name: "Seller",
      },
    });
    listingId = listing._id.toString();

    const channel = await MarketplaceListingChannel.create({
      buyer_id: buyer._id,
      seller_id: seller._id,
      listing_id: listing._id,
      getstream_channel_id: getstreamChannelId,
      status: "open",
      created_from: "inquiry",
      buyer_snapshot: { _id: buyer._id, name: "Buyer" },
      seller_snapshot: { _id: seller._id, name: "Seller" },
      listing_snapshot: {
        brand: "Rolex",
        model: "Submariner",
        reference: "126610LN",
      },
    });
    channelId = (channel as any)._id.toString();
  });

  describe("sendMessage", () => {
    it("should successfully send a message via GetStream and return delivered response", async () => {
      // Mock Stream delivery
      const mockSendMessage = jest.fn().mockResolvedValue({
        message: { id: "stream_msg_123", created_at: new Date().toISOString() },
      });
      const mockChannel = { sendMessage: mockSendMessage };
      const mockClient = { channel: jest.fn().mockReturnValue(mockChannel) };

      jest.spyOn(chatService, "getClient").mockReturnValue(mockClient as any);
      jest.spyOn(chatService, "ensureConnected").mockResolvedValue();
      const emitSpy = jest.spyOn(events, "emit");

      const response = await messageService.sendMessage({
        channelId: getstreamChannelId,
        userId: buyerId,
        platform: "marketplace",
        text: "Hello, is this available?",
      });

      // Verify Stream call
      expect(mockClient.channel).toHaveBeenCalledWith(
        "messaging",
        getstreamChannelId,
      );
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Hello, is this available?",
          user_id: buyerId,
        }),
      );

      // Verify event emitted
      expect(emitSpy).toHaveBeenCalledWith(
        "message:sent",
        expect.objectContaining({ senderId: buyerId, type: "regular" }),
      );

      // Verify response
      expect(response.status).toBe("delivered");
      expect(response.streamMessageId).toBe("stream_msg_123");
      expect(response.text).toBe("Hello, is this available?");
    });

    it("should throw when Stream delivery fails", async () => {
      jest
        .spyOn(chatService, "ensureConnected")
        .mockRejectedValue(new Error("Stream down"));

      await expect(
        messageService.sendMessage({
          channelId: getstreamChannelId,
          userId: buyerId,
          platform: "marketplace",
          text: "Failing message",
        }),
      ).rejects.toThrow("Failed to deliver message to chat service");
    });

    it("should throw error if channel is closed", async () => {
      await MarketplaceListingChannel.findByIdAndUpdate(channelId, {
        status: "closed",
      });

      await expect(
        messageService.sendMessage({
          channelId: getstreamChannelId,
          userId: buyerId,
          platform: "marketplace",
          text: "Blocked message",
        }),
      ).rejects.toThrow("Cannot send messages to a closed channel");
    });

    it("should throw if sender is not a channel member", async () => {
      const outsider = await User.create({
        clerk_id: "outsider_send_clerk",
        email: "outsider3@test.com",
        first_name: "Out",
        last_name: "Sider",
      });

      await expect(
        messageService.sendMessage({
          channelId: getstreamChannelId,
          userId: outsider._id.toString(),
          platform: "marketplace",
          text: "Sneaky message",
        }),
      ).rejects.toThrow("Not a member of this channel");
    });
  });

  describe("markAsRead", () => {
    it("should mark messages as read and notify Stream", async () => {
      // Setup: Create an unread message from seller
      await (messageRepository as any).model.create({
        stream_channel_id: getstreamChannelId,
        sender_id: new Types.ObjectId(sellerId),
        sender_clerk_id: "seller_clerk",
        text: "Seller message",
        is_read: false,
        listing_id: new Types.ObjectId(listingId),
      });

      // Mock Stream markRead
      const mockMarkRead = jest.fn().mockResolvedValue({});
      const mockChannel = { markRead: mockMarkRead };
      const mockClient = { channel: jest.fn().mockReturnValue(mockChannel) };
      jest.spyOn(chatService, "getClient").mockReturnValue(mockClient as any);
      jest.spyOn(chatService, "ensureConnected").mockResolvedValue();

      // Execute
      const count = await messageService.markAsRead(
        getstreamChannelId,
        buyerId,
        "marketplace",
      );

      // markAsRead delegates unread counting to GetStream frontend SDK, returns 0
      expect(count).toBe(0);
      expect(mockMarkRead).toHaveBeenCalledWith({ user_id: buyerId });

      const unreadCount = await messageService.getUnreadCount(
        getstreamChannelId,
        buyerId,
      );
      expect(unreadCount).toBe(0);
    });

    it("should throw if user is not a channel member", async () => {
      const outsider = await User.create({
        clerk_id: "outsider_clerk",
        email: "outsider@test.com",
        first_name: "Out",
        last_name: "Sider",
      });

      await expect(
        messageService.markAsRead(
          getstreamChannelId,
          outsider._id.toString(),
          "marketplace",
        ),
      ).rejects.toThrow("Not a member of this channel");
    });
  });

  describe("deleteMessage", () => {
    it("should delete a message the user owns from GetStream", async () => {
      const streamMsgId = "stream_msg_del_123";

      const mockDeleteMessage = jest.fn().mockResolvedValue({});
      const mockGetMessage = jest.fn().mockResolvedValue({
        message: { id: streamMsgId, user: { id: buyerId } },
      });
      const mockClient = {
        getMessage: mockGetMessage,
        deleteMessage: mockDeleteMessage,
      };
      jest.spyOn(chatService, "getClient").mockReturnValue(mockClient as any);
      jest.spyOn(chatService, "ensureConnected").mockResolvedValue();

      await messageService.deleteMessage(streamMsgId, buyerId);

      expect(mockGetMessage).toHaveBeenCalledWith(streamMsgId);
      expect(mockDeleteMessage).toHaveBeenCalledWith(streamMsgId, true);
    });

    it("should throw when user tries to delete another user's message", async () => {
      const streamMsgId = "stream_msg_other_123";

      const mockGetMessage = jest.fn().mockResolvedValue({
        message: { id: streamMsgId, user: { id: sellerId } },
      });
      const mockClient = {
        getMessage: mockGetMessage,
        deleteMessage: jest.fn(),
      };
      jest.spyOn(chatService, "getClient").mockReturnValue(mockClient as any);
      jest.spyOn(chatService, "ensureConnected").mockResolvedValue();

      await expect(
        messageService.deleteMessage(streamMsgId, buyerId),
      ).rejects.toThrow("Can only delete your own messages");
    });
  });

  describe("getMessages", () => {
    it("should throw if channel not found", async () => {
      await expect(
        messageService.getMessages({
          channelId: "nonexistent_channel",
          userId: buyerId,
          platform: "marketplace",
        }),
      ).rejects.toThrow("Channel not found");
    });

    it("should throw if user is not a channel member", async () => {
      const outsider = await User.create({
        clerk_id: "outsider_get_clerk",
        email: "outsider2@test.com",
        first_name: "Out",
        last_name: "Sider",
      });

      jest.spyOn(chatService, "getChannelMessages").mockResolvedValue([]);

      await expect(
        messageService.getMessages({
          channelId: getstreamChannelId,
          userId: outsider._id.toString(),
          platform: "marketplace",
        }),
      ).rejects.toThrow("Not a member of this channel");
    });

    it("should return messages from GetStream for channel member", async () => {
      const streamMessages = [
        {
          id: "msg_1",
          text: "Hello there",
          type: "regular",
          user: { id: buyerId, name: "Buyer" },
          attachments: [],
          custom: {},
          created_at: new Date().toISOString(),
        },
      ];

      jest
        .spyOn(chatService, "getChannelMessages")
        .mockResolvedValue(streamMessages as any);

      const result = await messageService.getMessages({
        channelId: getstreamChannelId,
        userId: buyerId,
        platform: "marketplace",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].text).toBe("Hello there");
      expect(result.messages[0].streamMessageId).toBe("msg_1");
      expect(result.hasMore).toBe(false);
    });
  });
});
