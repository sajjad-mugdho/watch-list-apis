import { messageService } from '../../../src/services/message/MessageService';
import { messageRepository, channelRepository, userRepository } from '../../../src/repositories';
import { chatService } from '../../../src/services/ChatService';
import { events } from '../../../src/utils/events';
import { Types } from 'mongoose';
import { MarketplaceListingChannel } from '../../../src/models/MarketplaceListingChannel';
import { MarketplaceListing } from '../../../src/models/Listings';
import { User } from '../../../src/models/User';

describe('MessageService', () => {
  let buyerId: string;
  let sellerId: string;
  let channelId: string;
  let getstreamChannelId = 'gs_channel_123';
  let listingId: string;

  beforeEach(async () => {
    // Clear DB
    await MarketplaceListing.deleteMany({});
    await MarketplaceListingChannel.deleteMany({});
    await User.deleteMany({});
    await (messageRepository as any).model.deleteMany({});

    // Setup basic entities
    const buyer = await User.create({
      clerk_id: 'buyer_clerk',
      email: 'buyer@test.com',
      first_name: 'Buyer',
      last_name: 'One'
    });
    buyerId = buyer._id.toString();

    const seller = await User.create({
      clerk_id: 'seller_clerk',
      email: 'seller@test.com',
      first_name: 'Seller',
      last_name: 'Two'
    });
    sellerId = seller._id.toString();

    const listing = await MarketplaceListing.create({
      dialist_id: seller._id,
      clerk_id: 'seller_clerk',
      watch_id: new Types.ObjectId(),
      brand: 'Rolex',
      model: 'Submariner',
      reference: '126610LN',
      diameter: '41mm',
      bezel: 'Ceramic',
      materials: 'Oystersteel',
      bracelet: 'Oyster',
      ships_from: { country: 'US' },
      watch_snapshot: {
        brand: 'Rolex',
        model: 'Submariner',
        reference: '126610LN',
        diameter: '41mm',
        bezel: 'Ceramic',
        materials: 'Oystersteel',
        bracelet: 'Oyster',
      },
      price: 15000,
      status: 'active',
      allow_offers: true,
      author: {
        _id: seller._id,
        name: 'Seller'
      }
    });
    listingId = listing._id.toString();

    const channel = await MarketplaceListingChannel.create({
      buyer_id: buyer._id,
      seller_id: seller._id,
      listing_id: listing._id,
      getstream_channel_id: getstreamChannelId,
      status: 'open',
      created_from: 'inquiry',
      buyer_snapshot: { _id: buyer._id, name: 'Buyer' },
      seller_snapshot: { _id: seller._id, name: 'Seller' },
      listing_snapshot: { brand: 'Rolex', model: 'Submariner', reference: '126610LN' },
    });
    channelId = (channel as any)._id.toString();
  });

  describe('sendMessage', () => {
    it('should successfully send a message and deliver to Stream', async () => {
      // Mock Stream delivery
      const mockSendMessage = jest.fn().mockResolvedValue({ 
        message: { id: 'stream_msg_123' } 
      });
      const mockChannel = { sendMessage: mockSendMessage };
      const mockClient = { channel: jest.fn().mockReturnValue(mockChannel) };
      
      jest.spyOn(chatService, 'getClient').mockReturnValue(mockClient as any);
      jest.spyOn(chatService, 'ensureConnected').mockResolvedValue();
      const emitSpy = jest.spyOn(events, 'emit');

      // Execute
      const response = await messageService.sendMessage({
        channelId,
        getstreamChannelId,
        userId: buyerId,
        clerkId: 'buyer_clerk',
        platform: 'marketplace',
        text: 'Hello, is this available?'
      });

      // Verify DB
      const dbMsg = await messageRepository.findOne({ text: 'Hello, is this available?' });
      expect(dbMsg).toBeDefined();
      expect(dbMsg?.stream_message_id).toBe('stream_msg_123');
      expect(dbMsg?.status).toBe('delivered');

      // Verify Stream call
      expect(mockClient.channel).toHaveBeenCalledWith('messaging', getstreamChannelId);
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: 'Hello, is this available?',
        user_id: buyerId
      }));

      // Verify side effects
      expect(emitSpy).toHaveBeenCalledWith('message:sent', expect.objectContaining({
        senderId: buyerId,
        type: 'regular'
      }));

      expect(response.status).toBe('delivered');
      expect(response.streamMessageId).toBe('stream_msg_123');
    });

    it('should set status to pending if Stream delivery fails', async () => {
      // Mock Stream failure
      jest.spyOn(chatService, 'ensureConnected').mockRejectedValue(new Error('Stream down'));
      
      // Execute
      const response = await messageService.sendMessage({
        channelId,
        getstreamChannelId,
        userId: buyerId,
        clerkId: 'buyer_clerk',
        platform: 'marketplace',
        text: 'Failing message'
      });

      // Verify DB
      const dbMsg = await messageRepository.findOne({ text: 'Failing message' });
      expect(dbMsg?.status).toBe('pending_delivery');
      expect(response.status).toBe('pending_delivery');
    });

    it('should throw error if channel is closed', async () => {
      await MarketplaceListingChannel.findByIdAndUpdate(channelId, { status: 'closed' });

      await expect(messageService.sendMessage({
        channelId,
        getstreamChannelId,
        userId: buyerId,
        clerkId: 'buyer_clerk',
        platform: 'marketplace',
        text: 'Blocked message'
      })).rejects.toThrow('Cannot send messages to a closed channel');
    });
  });

  describe('markAsRead', () => {
    it('should mark messages as read and notify Stream', async () => {
      // Setup: Create an unread message from seller
      await (messageRepository as any).model.create({
        stream_channel_id: getstreamChannelId,
        sender_id: new Types.ObjectId(sellerId),
        sender_clerk_id: 'seller_clerk',
        text: 'Seller message',
        is_read: false,
        listing_id: new Types.ObjectId(listingId),
      });

      // Mock Stream markRead
      const mockMarkRead = jest.fn().mockResolvedValue({});
      const mockChannel = { markRead: mockMarkRead };
      const mockClient = { channel: jest.fn().mockReturnValue(mockChannel) };
      jest.spyOn(chatService, 'getClient').mockReturnValue(mockClient as any);
      jest.spyOn(chatService, 'ensureConnected').mockResolvedValue();

      // Execute
      const count = await messageService.markAsRead(getstreamChannelId, buyerId, 'marketplace');

      // Verify
      expect(count).toBe(1);
      expect(mockMarkRead).toHaveBeenCalledWith({ user_id: buyerId });
      
      const unreadCount = await messageService.getUnreadCount(getstreamChannelId, buyerId);
      expect(unreadCount).toBe(0);
    });
  });
});
