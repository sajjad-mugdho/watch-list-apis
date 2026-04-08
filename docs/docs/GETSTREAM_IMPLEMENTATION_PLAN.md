# GetStream End-to-End Implementation Plan

## Executive Summary

This document provides a comprehensive gap analysis and implementation plan for the GetStream-powered messaging and real-time features in the Dialist platform. The goal is to achieve **zero-latency real-time communication** while maintaining full backend control and data ownership.

---

## Current State Assessment

### ✅ What's Already Implemented

| Feature | Status | Location |
|---------|--------|----------|
| Chat Token Generation | ✅ Working | `/api/v1/chat/token` |
| Channel Creation (Listing-unique) | ✅ Working | `ChatService.getOrCreateChannel()` |
| User-to-User Channels (Networks) | ✅ Working | `listingUnique: false` parameter |
| GetStream Webhooks | ✅ Configured | `/api/v1/webhooks/getstream` |
| System Messages | ✅ Working | `ChatService.sendSystemMessage()` |
| In-App Notifications | ✅ Working | `Notification` model + routes |
| Message Storage in MongoDB | ✅ Working | `ChatMessage` model |
| Backend-Controlled Messaging | ✅ Working | `/api/v1/messages/send` |
| Channel Archiving | ✅ Working | `POST /messages/channel/:id/archive` |
| Unread Counts | ✅ Working | `/api/v1/chat/unread` |
| Activity Feeds | ✅ Working | `FeedService` + `/api/v1/feeds` |
| Follow System | ✅ Working | `/api/v1/users/:id/follow` |
| Offer System Messages | ✅ Working | Integrated in offer handlers |
| Order Lifecycle Messages | ✅ Working | Integrated in order handlers |

### ❌ Gaps Identified (To Be Fixed)

| Gap | Priority | Impact |
|-----|----------|--------|
| Inquiry creates channel IMMEDIATELY | HIGH | Required per spec |
| Network channels not truly user-unique | HIGH | Channels still reference listings |
| No typing indicators backend support | MEDIUM | UX feature |
| No presence tracking backend | MEDIUM | UX feature |
| Read receipts not synced to MongoDB | MEDIUM | Analytics |
| No push notification bridge | MEDIUM | Mobile requirement |
| No message search endpoint | LOW | Discovery feature |
| No mute channel backend | LOW | User preference |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           DIALIST MESSAGING ARCHITECTURE                         │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────┐                                      ┌─────────────────────┐   │
│   │   MOBILE    │◄──────── WebSocket ─────────────────►│   GETSTREAM CLOUD   │   │
│   │   (React    │                                      │                     │   │
│   │   Native)   │                                      │  ┌───────────────┐  │   │
│   └──────┬──────┘                                      │  │ Chat Engine   │  │   │
│          │                                             │  └───────────────┘  │   │
│          │ REST API                                    │  ┌───────────────┐  │   │
│          │                                             │  │ Activity Feeds│  │   │
│          ▼                                             │  └───────────────┘  │   │
│   ┌─────────────────────────────────────────────────┐  │  ┌───────────────┐  │   │
│   │           YOUR BACKEND (Express.js)             │  │  │ Presence      │  │   │
│   │                                                 │  │  └───────────────┘  │   │
│   │  ┌──────────────┐  ┌──────────────────────────┐ │  └─────────┬───────────┘   │
│   │  │ Chat Routes  │  │   Message Routes         │ │            │              │
│   │  │ /chat/*      │  │   /messages/*            │ │            │ Webhooks     │
│   │  └──────────────┘  └──────────────────────────┘ │            │              │
│   │                                                 │◄───────────┘              │
│   │  ┌──────────────┐  ┌──────────────────────────┐ │                           │
│   │  │ ChatService  │  │   NotificationService    │ │                           │
│   │  └──────────────┘  └──────────────────────────┘ │                           │
│   │                                                 │                           │
│   │  ┌──────────────┐  ┌──────────────────────────┐ │                           │
│   │  │ FeedService  │  │   Offer/Order Handlers   │ │                           │
│   │  └──────────────┘  └──────────────────────────┘ │                           │
│   └───────────────────────┬─────────────────────────┘                           │
│                           │                                                     │
│                           ▼                                                     │
│   ┌─────────────────────────────────────────────────┐                           │
│   │                  MONGODB                        │                           │
│   │                                                 │                           │
│   │  ┌─────────────┐  ┌─────────────────────────┐   │                           │
│   │  │ ChatMessage │  │ NetworkListingChannel   │   │                           │
│   │  └─────────────┘  └─────────────────────────┘   │                           │
│   │  ┌─────────────┐  ┌─────────────────────────┐   │                           │
│   │  │ Notification│  │ MarketplaceListingChannel│   │                           │
│   │  └─────────────┘  └─────────────────────────┘   │                           │
│   │  ┌─────────────┐  ┌─────────────────────────┐   │                           │
│   │  │ User        │  │ Order                   │   │                           │
│   │  └─────────────┘  └─────────────────────────┘   │                           │
│   └─────────────────────────────────────────────────┘                           │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Core Messaging Fixes (Priority: CRITICAL)

#### 1.1 Fix Inquiry Channel Creation

**Requirement**: When a buyer inquires on a listing, the chat channel is created IMMEDIATELY.

**Current State**: Channels are only created when offers are made.

**Fix**:
```typescript
// NEW: src/routes/inquiryRoutes.ts
POST /api/v1/marketplace/listings/:id/inquire
POST /api/v1/networks/listings/:id/inquire

// Flow:
// 1. Validate user and listing
// 2. Check if channel already exists (reuse if yes)
// 3. Create GetStream channel IMMEDIATELY
// 4. Store in MarketplaceListingChannel or NetworkListingChannel
// 5. Send inquiry as first system message
// 6. Return channel ID to client
```

#### 1.2 True User-to-User Channels for Networks

**Requirement**: On Networks app, channels are user-unique, NOT listing-unique.

**Current State**: NetworkListingChannel has `listing_id` as unique key.

**Fix**:
- Already partially implemented with `listingUnique: false`
- Need to update NetworkListingChannel to:
  1. Use `(buyer_id, seller_id)` as unique index (already done)
  2. Store `listing_history` array instead of single `listing_id`
  3. Update channel metadata when switching listings

#### 1.3 Add Inquiry Endpoint

**Files to Create/Modify**:
- `src/routes/marketplaceListingRoutes.ts` - Add `POST /:id/inquire`
- `src/routes/networksListingRoutes.ts` - Add `POST /:id/inquire`
- `src/handlers/inquiryHandlers.ts` - New handler file

---

### Phase 2: System Messages Enhancement

#### 2.1 Required System Message Types

| Type | Trigger | Emoji | Action Buttons |
|------|---------|-------|----------------|
| `inquiry` | User sends inquiry | 💬 | Reply |
| `offer` | New offer sent | 💰 | Accept / Counter / Decline |
| `counter_offer` | Counter offer sent | 🔄 | Accept / Counter / Decline |
| `offer_accepted` | Offer accepted | ✅ | View Order |
| `offer_rejected` | Offer declined | ❌ | Send New Offer |
| `offer_expired` | 48h passed | ⏰ | Send New Offer |
| `listing_reserved` | Checkout started | 🔒 | View Order |
| `listing_sold` | Sale completed | 🏷️ | - |
| `reference_check_initiated` | Ref check started | 🔍 | View Check |
| `order_paid` | Payment confirmed | 💳 | View Order |
| `order_shipped` | Tracking uploaded | 🚚 | Track Package |
| `order_completed` | Delivery confirmed | 🎉 | Leave Review |

#### 2.2 System Message Data Structure

```typescript
interface SystemMessagePayload {
  type: SystemMessageType;
  
  // Offer context
  offer_id?: string;
  amount?: number;
  expires_at?: Date;
  
  // Order context
  order_id?: string;
  tracking_number?: string;
  
  // Reference check
  reference_check_id?: string;
  
  // Actions (for frontend buttons)
  actions?: Array<{
    label: string;
    action: 'accept' | 'counter' | 'decline' | 'view_order' | 'track';
    endpoint: string;
  }>;
}
```

---

### Phase 3: Notification System

#### 3.1 Current Notification Types

| Type | Implemented | Push Ready |
|------|-------------|------------|
| `new_message` | ✅ | ❌ |
| `new_inquiry` | ✅ | ❌ |
| `offer_received` | ✅ | ❌ |
| `counter_offer` | ✅ | ❌ |
| `offer_accepted` | ✅ | ❌ |
| `offer_rejected` | ✅ | ❌ |
| `order_paid` | ✅ | ❌ |
| `order_shipped` | ✅ | ❌ |
| `order_completed` | ✅ | ❌ |
| `new_follower` | ✅ | ❌ |
| `reference_check_request` | ✅ | ❌ |
| `reference_check_response` | ✅ | ❌ |
| `iso_match` | ✅ | ❌ |

#### 3.2 Push Notification Integration

**Required**: Firebase Cloud Messaging (FCM) + Apple Push Notification Service (APNs)

**Implementation**:
```typescript
// src/services/PushNotificationService.ts
class PushNotificationService {
  async sendPush(userId: string, notification: Notification): Promise<void> {
    const user = await User.findById(userId);
    if (!user.push_tokens?.length) return;
    
    for (const token of user.push_tokens) {
      if (token.platform === 'ios') {
        await this.sendAPNs(token.token, notification);
      } else {
        await this.sendFCM(token.token, notification);
      }
    }
  }
}
```

---

### Phase 4: Presence & Read Receipts

#### 4.1 User Presence

**Requirement**: Show online/offline status.

**Implementation**: GetStream handles this automatically via `presence: true` on channel watch.

**Backend Tasks**:
1. Store `last_seen` timestamp in User model
2. Update on any API activity
3. Expose in user profile responses

#### 4.2 Read Receipts

**Requirement**: Show "seen by user" status.

**Implementation**:
```typescript
// Already handled by GetStream
// Backend webhook handler stores in MongoDB for analytics:

async function handleMessageRead(event: any): Promise<void> {
  const { user, channel_id, last_read_message_id } = event;
  
  // Store in ChatMessage
  await ChatMessage.updateMany(
    { 
      stream_channel_id: channel_id,
      sender_id: { $ne: user.id },
      read_by: { $nin: [user.id] }
    },
    { $addToSet: { read_by: user.id } }
  );
}
```

#### 4.3 Typing Indicators

**Status**: Fully handled by GetStream SDK on client side.
**Backend**: No action required.

---

### Phase 5: Channel Lifecycle Management

#### 5.1 Channel States

| State | Description | User Actions |
|-------|-------------|--------------|
| `active` | Normal conversation | Send messages, make offers |
| `reserved` | Listing being purchased | View only, no new offers |
| `sold` | Transaction complete | Open for post-sale chat |
| `archived` | User hid channel | Unhide to restore |

#### 5.2 Post-Sale Communication

**Requirement**: Channels remain open after sale.

**Current**: ✅ Already implemented - channels don't auto-close.

#### 5.3 Archive vs Leave

**Requirement**: Users can archive but NOT leave 1:1 chats.

**Implementation**:
```typescript
// Archive (hide) - ALLOWED
POST /api/v1/messages/channel/:id/archive
// Uses GetStream channel.hide()

// Leave - NOT ALLOWED for 1:1
DELETE /api/v1/messages/channel/:id/leave
// Returns 400: "Cannot leave 1:1 chats"
```

---

### Phase 6: Offer Rules

#### 6.1 Current Rules

| Rule | Status |
|------|--------|
| One active offer per buyer per channel | ✅ Implemented |
| Counter-offer invalidates previous | ✅ Implemented |
| 48-hour expiry | ✅ Implemented |
| Cannot offer on reserved listing | ✅ Implemented |
| Can inquire on reserved listing | ❌ Need to verify |

#### 6.2 Offer Expiry Automation

**Requirement**: Offers expire automatically after 48 hours.

**Current**: Expiry timestamp is set, but no background job to auto-expire.

**Fix**:
```typescript
// Add to worker/jobs
async function expireOffers(): Promise<void> {
  const expired = await MarketplaceListingChannel.find({
    'last_offer.status': 'sent',
    'last_offer.expiresAt': { $lt: new Date() }
  });
  
  for (const channel of expired) {
    await channel.resolveLastOffer('expired');
    
    // Send system message
    await chatService.sendSystemMessage(
      channel.getstream_channel_id,
      { type: 'offer_expired' },
      'system'
    );
    
    // Notify buyer
    await Notification.create({
      user_id: channel.last_offer.sender_id,
      type: 'offer_expired',
      title: 'Offer Expired',
      body: `Your offer has expired.`
    });
  }
}
```

---

### Phase 7: Reference Checks

#### 7.1 Current Implementation

- ✅ ReferenceCheck model with responses
- ✅ Dedicated chat channels per check
- ✅ Notifications for check requests
- ✅ Link to orders via `order_id`

#### 7.2 Public Voting

**Requirement**: Reference check votes are PUBLIC.

**Current**: ✅ Implemented - `is_anonymous` defaults to false.

---

### Phase 8: Activity Feeds

#### 8.1 Feed Events

| Event | Appears in Feed |
|-------|-----------------|
| New listing posted | ✅ Yes |
| ISO created | ✅ Yes |
| Reference check initiated | ✅ Yes |
| Chat messages | ❌ No (correct) |
| Offer sent/received | ❌ No (private) |
| Order created | ❌ No (private) |

#### 8.2 Muting Users in Feed

**Requirement**: "To be addressed with Parth"

**Implementation (When Ready)**:
```typescript
// User model addition
muted_feed_users: [{ type: Schema.Types.ObjectId, ref: 'User' }]

// Feed query filter
const feed = await feedService.getTimeline(userId);
const mutedUsers = user.muted_feed_users.map(u => u.toString());
const filtered = feed.filter(a => !mutedUsers.includes(a.actor.id));
```

---

## API Endpoints Summary

### Chat APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/chat/token` | Get Stream Chat token |
| GET | `/api/v1/chat/channels` | List user's channels |
| GET | `/api/v1/chat/unread` | Get unread counts |
| POST | `/api/v1/chat/channel` | Create/get channel |

### Message APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/messages/send` | Send message (backend-controlled) |
| GET | `/api/v1/messages/channel/:id` | Get message history |
| PUT | `/api/v1/messages/:id` | Edit message |
| DELETE | `/api/v1/messages/:id` | Delete message |
| POST | `/api/v1/messages/:id/read` | Mark as read |
| POST | `/api/v1/messages/:id/react` | Add reaction |
| POST | `/api/v1/messages/channel/:id/archive` | Archive channel |

### Notification APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/notifications` | Get notifications |
| GET | `/api/v1/notifications/unread-count` | Get unread count |
| POST | `/api/v1/notifications/mark-all-read` | Mark all read |
| POST | `/api/v1/notifications/:id/read` | Mark specific read |
| DELETE | `/api/v1/notifications/:id` | Delete notification |

### Feed APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/feeds/token` | Get Stream Feeds token |
| GET | `/api/v1/feeds/timeline` | Get timeline feed |
| GET | `/api/v1/feeds/user/:id` | Get user's feed |
| GET | `/api/v1/feeds/following` | Get following list |
| GET | `/api/v1/feeds/followers` | Get followers list |

---

## Testing Checklist

### Chat Flow Tests
- [ ] Generate chat token
- [ ] Create channel for listing
- [ ] Send message via backend
- [ ] Verify message in MongoDB
- [ ] Verify real-time delivery via GetStream
- [ ] Test channel archiving
- [ ] Test unread counts

### Offer Flow Tests
- [ ] Send offer → channel created → system message sent
- [ ] Counter offer → previous offer invalidated
- [ ] Accept offer → listing reserved → notifications sent
- [ ] Reject offer → notification sent
- [ ] Offer expires after 48h

### Order Flow Tests
- [ ] Reserve listing → system message
- [ ] Payment received → system message + notification
- [ ] Tracking uploaded → system message + notification
- [ ] Delivery confirmed → system message + notification

### Notification Tests
- [ ] All notification types created
- [ ] Unread count accurate
- [ ] Mark as read works
- [ ] Delete notification works

---

## Environment Variables Required

```bash
# GetStream Chat
GETSTREAM_API_KEY=your_api_key
GETSTREAM_API_SECRET=your_api_secret
GETSTREAM_APP_ID=your_app_id
GETSTREAM_WEBHOOK_SECRET=optional_separate_secret

# Push Notifications (Phase 3)
FIREBASE_PROJECT_ID=your_project
FIREBASE_PRIVATE_KEY=your_key
FIREBASE_CLIENT_EMAIL=your_email
APNS_KEY_ID=your_key_id
APNS_TEAM_ID=your_team_id
APNS_KEY_FILE=path_to_p8_file
```

---

## Success Criteria

1. **Zero Latency Gap**: Messages appear instantly via GetStream while being stored in MongoDB in parallel
2. **Full Data Ownership**: Every message, channel, and notification stored in our database
3. **Business Logic Control**: All offers, orders, and moderation flow through our backend first
4. **Platform Differentiation**: Marketplace = listing-unique channels, Networks = user-unique channels
5. **Real-Time Features**: Presence, typing indicators, read receipts all working
6. **Notification Coverage**: In-app notifications for all critical events
7. **Webhook Processing**: All GetStream events captured and processed

---

## Next Immediate Actions

1. **Create Inquiry Endpoints** - Allow channel creation without offer
2. **Add Offer Expiry Job** - Background worker to auto-expire offers
3. **Test All API Endpoints** - Verify current implementation
4. **Update Swagger Docs** - Ensure all endpoints documented
5. **Push Notification Setup** - Firebase/APNs integration

---

*Document Version: 1.0*
*Last Updated: 2026-01-08*
