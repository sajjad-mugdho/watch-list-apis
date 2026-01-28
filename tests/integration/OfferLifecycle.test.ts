import { Types } from 'mongoose';
import { offerService } from '../../src/services/offer/OfferService';
import { channelService } from '../../src/services/channel/ChannelService';
import { messageService } from '../../src/services/message/MessageService';
import { notificationService } from '../../src/services/notification/NotificationService';
import { chatService } from '../../src/services/ChatService';
import { registerEventHandlers } from '../../src/bootstrap/eventHandlers';
import { User } from '../../src/models/User';
import { MarketplaceListing } from '../../src/models/Listings';
import { MarketplaceListingChannel } from '../../src/models/MarketplaceListingChannel';
import { Notification } from '../../src/models/Notification';
import { ChatMessage } from '../../src/models/ChatMessage';
import { Order } from '../../src/models/Order';

describe('Offer Lifecycle Integration', () => {
  let buyer: any;
  let seller: any;
  let listing: any;
  let channel: any;

  beforeEach(async () => {
    // Register event listeners
    registerEventHandlers();

    // 1. Setup Data
    buyer = await User.create({
      clerk_id: 'buyer_clerk',
      email: 'buyer@test.com',
      first_name: 'Buyer',
      last_name: 'One',
      display_name: 'BuyerOne'
    });

    seller = await User.create({
      clerk_id: 'seller_clerk',
      email: 'seller@test.com',
      first_name: 'Seller',
      last_name: 'Two',
      display_name: 'SellerTwo'
    });

    listing = await MarketplaceListing.create({
      dialist_id: seller._id,
      clerk_id: seller.clerk_id,
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

    const mockChannel = {
      sendMessage: jest.fn().mockImplementation(async (data) => {
        // Simulate persistence (as if webhook worked)
        if (data.custom && data.custom.system_message) {
             try {
                 await ChatMessage.create({
                     stream_channel_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                     stream_message_id: `sys_${Date.now()}`,
                     text: data.text,
                     sender_id: data.user_id,
                     sender_clerk_id: 'system',
                     type: data.custom.type,
                     custom_data: data.custom,
                     status: 'sent',
                     is_read: false,
                     read_by: []
                 });
             } catch (e) {
                 console.error('Mock Persistence Failed:', e);
             }
        }
        return { message: { id: 'stream_msg_123' } };
      }),
      updatePartial: jest.fn().mockResolvedValue({}),
      addMembers: jest.fn().mockResolvedValue({}),
      watch: jest.fn().mockResolvedValue({}),
    };
    const mockClient = {
      channel: jest.fn().mockReturnValue(mockChannel),
      createToken: jest.fn().mockReturnValue('mock_token'),
      upsertUser: jest.fn().mockResolvedValue({}),
    };
    // Inject mock client directly into service instance (bypass private property)
    (chatService as any).client = mockClient;
    jest.spyOn(chatService, 'ensureConnected').mockResolvedValue();
    jest.spyOn(chatService, 'getOrCreateChannel').mockResolvedValue({ 
      channel: mockChannel as any, 
      channelId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' 
    });
  });

  it('should complete a full offer flow: Inquiry -> Offer -> Accept -> Order', async () => {
    // --------------------------------------------------------
    // Step 1: Buyer starts inquiry (creates channel)
    // --------------------------------------------------------
    const channelResult = await channelService.createChannel({
      buyerId: buyer._id.toString(),
      sellerId: seller._id.toString(),
      listingId: listing._id.toString(),
      platform: 'marketplace',
      createdFrom: 'inquiry', 
      listingSnapshot: {
        brand: listing.watch_snapshot.brand,
        model: listing.watch_snapshot.model,
        reference: listing.watch_snapshot.reference,
        price: listing.price,
        thumbnail: 'thumb.jpg'
      }
    });
    
    expect(channelResult).toBeDefined();
    channel = channelResult.channel;

    // Verify channel created in DB
    const dbChannel = await MarketplaceListingChannel.findById(channel._id);
    expect(dbChannel).toBeDefined();
    expect(dbChannel?.status).toBe('open');

    // --------------------------------------------------------
    // Step 2: Buyer sends a message
    // --------------------------------------------------------
    await messageService.sendMessage({
      channelId: channel._id.toString(),
      getstreamChannelId: channel.getstream_channel_id,
      userId: buyer._id.toString(),
      clerkId: buyer.clerk_id,
      platform: 'marketplace',
      text: 'Is this still available?'
    });

    // Verify message and notification
    const messages = await ChatMessage.find({ stream_channel_id: channel.getstream_channel_id });
    expect(messages.length).toBe(2); // 1 system inquiry message + 1 user message
    expect(messages.some(m => m.text === 'Is this still available?')).toBe(true);

    // --------------------------------------------------------
    // Step 3: Buyer makes an offer
    // --------------------------------------------------------
    const offerAmt = 14000;
    const offerResult = await offerService.sendOffer({
      channelId: channel._id.toString(),
      listingId: listing._id.toString(),
      senderId: buyer._id.toString(),
      amount: offerAmt,
      platform: 'marketplace',
    });

    expect(offerResult.status).toBe('sent');
    expect(offerResult.amount).toBe(offerAmt);

    // Verify notification to seller (async event)
    let offerNotif;
    for (let i = 0; i < 5; i++) {
        const notifications = await Notification.find({ user_id: seller._id });
        offerNotif = notifications.find(n => n.type === 'offer_received');
        if (offerNotif) break;
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    expect(offerNotif).toBeDefined();
    expect(offerNotif?.title).toContain('New Offer Received');

    // Verify system message in chat
    const sysMessages = await ChatMessage.find({ 
      stream_channel_id: channel.getstream_channel_id,
      type: 'offer'
    });
    expect(sysMessages.length).toBe(1);
    expect(sysMessages[0].custom_data?.amount).toBe(offerAmt);

    // --------------------------------------------------------
    // Step 4: Seller accepts offer
    // --------------------------------------------------------
    const acceptResult = await offerService.acceptOffer(
      channel._id.toString(),
      seller._id.toString(),
      'marketplace'
    );

    expect(acceptResult.orderId).toBeDefined();

    // Verify channel updated to 'deal_pending' (or similar, depending on logic)
    // Actually OfferService.acceptOffer creates an order and might update status
    
    // Verify Order created
    const order = await Order.findById(acceptResult.orderId);
    expect(order).not.toBeNull();
    expect(order?.status).toBe('pending');
    expect(order?.amount).toBe(offerAmt);

    // Verify notification to buyer (async event)
    let acceptNotif;
    for (let i = 0; i < 5; i++) {
        const buyerNotifs = await Notification.find({ user_id: buyer._id });
        acceptNotif = buyerNotifs.find(n => n.type === 'offer_accepted');
        if (acceptNotif) break;
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    expect(acceptNotif).toBeDefined();
    expect(acceptNotif?.title).toContain('Offer Accepted');
  });
});
