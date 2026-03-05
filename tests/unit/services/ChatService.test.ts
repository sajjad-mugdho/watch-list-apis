import { chatService } from "../../../src/services/ChatService";
import { StreamChat } from "stream-chat";

// stream-chat is mocked globally via tests/setup.ts

describe("ChatService", () => {
  describe("createUserToken", () => {
    it("should return a token for a valid user ID", () => {
      const token = chatService.createUserToken("user_abc123");
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });

    it("should throw when userId is empty", () => {
      expect(() => chatService.createUserToken("")).toThrow(
        "User ID is required",
      );
    });
  });

  describe("ensureConnected", () => {
    it("should resolve without error (server-side client)", async () => {
      await expect(chatService.ensureConnected()).resolves.toBeUndefined();
    });

    it("should be idempotent — safe to call multiple times", async () => {
      await chatService.ensureConnected();
      await expect(chatService.ensureConnected()).resolves.toBeUndefined();
    });
  });

  describe("upsertUser", () => {
    it("should call StreamChat.upsertUser with the correct payload", async () => {
      const client = chatService.getClient();
      const spy = jest.spyOn(client, "upsertUser").mockResolvedValue({} as any);

      await chatService.upsertUser({
        id: "user_123",
        name: "Alice",
        avatar: "https://example.com/a.jpg",
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "user_123",
          name: "Alice",
          image: "https://example.com/a.jpg",
        }),
      );
    });
  });

  describe("getOrCreateChannel", () => {
    const validBuyerId = "buyer_abc_1234567890"; // 20 chars - valid
    const validSellerId = "seller_xyz_987654321"; // 20 chars - valid

    it("should return a channel and channelId", async () => {
      const result = await chatService.getOrCreateChannel(
        validBuyerId,
        validSellerId,
        {
          listing_id: "listing_001_abc",
          listing_title: "Rolex Submariner",
          listing_price: 15000,
        },
      );

      expect(result).toHaveProperty("channel");
      expect(result).toHaveProperty("channelId");
      expect(typeof result.channelId).toBe("string");
      expect(result.channelId).toHaveLength(32); // MD5 hex
    });

    it("should throw when buyerId is empty", async () => {
      await expect(
        chatService.getOrCreateChannel("", validSellerId, {
          listing_id: "listing_001",
        }),
      ).rejects.toThrow();
    });

    it("should throw when sellerId is empty", async () => {
      await expect(
        chatService.getOrCreateChannel(validBuyerId, "", {
          listing_id: "listing_001",
        }),
      ).rejects.toThrow();
    });

    it("should throw when metadata is missing listing_id", async () => {
      await expect(
        chatService.getOrCreateChannel(validBuyerId, validSellerId, {
          listing_id: "",
        }),
      ).rejects.toThrow();
    });

    it("should generate identical channel IDs for the same buyer/seller/listing", async () => {
      const first = await chatService.getOrCreateChannel(
        validBuyerId,
        validSellerId,
        { listing_id: "listing_abc_001" },
      );
      const second = await chatService.getOrCreateChannel(
        validBuyerId,
        validSellerId,
        { listing_id: "listing_abc_001" },
      );
      expect(first.channelId).toBe(second.channelId);
    });

    it("should generate same channel ID regardless of buyer/seller order", async () => {
      const normal = await chatService.getOrCreateChannel(
        validBuyerId,
        validSellerId,
        { listing_id: "listing_abc_002" },
      );
      const reversed = await chatService.getOrCreateChannel(
        validSellerId,
        validBuyerId,
        { listing_id: "listing_abc_002" },
      );
      expect(normal.channelId).toBe(reversed.channelId);
    });
  });

  describe("sendSystemMessage", () => {
    const validChannelId = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"; // 32-char hex

    it("should throw when channelId is empty", async () => {
      await expect(
        chatService.sendSystemMessage(
          "",
          { type: "offer", message: "Offer sent" },
          "user_abc_1234567",
        ),
      ).rejects.toThrow();
    });

    it("should throw when senderId is empty", async () => {
      await expect(
        chatService.sendSystemMessage(
          validChannelId,
          { type: "offer", message: "Offer sent" },
          "",
        ),
      ).rejects.toThrow();
    });

    it("should throw when data.type is missing", async () => {
      await expect(
        chatService.sendSystemMessage(
          validChannelId,
          { type: "" as any },
          "user_abc_1234567",
        ),
      ).rejects.toThrow("data.type is required");
    });
  });
});
