# BATCH 4 API INTEGRATION BIBLE

**Complete API Reference & Integration Guide** | Dialist Networks Platform

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [API Categories](#api-categories)
4. [Chat System Flow](#chat-system-flow)
5. [Webhook Integration](#webhook-integration)
6. [Error Handling](#error-handling)
7. [Rate Limits](#rate-limits)
8. [Code Examples](#code-examples)

---

## Quick Start

### Base URL

```
http://localhost:5050/api/v1/networks
```

### Authentication

All requests require Clerk JWT token:

```bash
Authorization: Bearer <JWT_TOKEN>
```

### Test Token Generation

```bash
# Get your platform tokens
curl http://localhost:5050/api/v1/user/tokens \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response includes:
{
  "getstream": {
    "api_key": "...",
    "user_id": "...",
    "token": "...",  // Use this token for chat
    "expires": 3600
  }
}
```

---

## Authentication

### Clerk JWT Token

Every request requires a valid Clerk JWT:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  http://localhost:5050/api/v1/networks/listings
```

### GetStream Chat Token

Used separately for real-time chat:

```bash
# Get chat token from API
GET /api/v1/user/tokens

# Use in client SDK
import { StreamChat } from 'stream-chat';
const client = new StreamChat('api_key');
const token = response.getstream.token;
await client.connectUser({ id: userId }, token);
```

### Token Expiration

- JWT: 1 hour standard
- GetStream: 3600 seconds (customizable)
- Each token refresh requires new API call

---

## API Categories

### 1️⃣ SOCIAL & GROUPS

**Base**: `/social`

| Method | Endpoint             | Purpose                    |
| ------ | -------------------- | -------------------------- |
| GET    | `/social/groups`     | List all groups            |
| POST   | `/social/groups`     | Create new group           |
| GET    | `/social/groups/:id` | Get group details          |
| GET    | `/social/status`     | Hub status (online/unread) |
| GET    | `/social/discover`   | Discover traders & groups  |
| GET    | `/social/search`     | Multi-entity search        |

**Example: Create Group**

```bash
POST /api/v1/networks/social/groups
{
  "name": "B2B Traders",
  "description": "For bulk sellers",
  "visibility": "public"
}

Response: HTTP 201
{
  "_id": "69d6588f084124893f96bd08",
  "name": "B2B Traders",
  "created_at": "2026-04-08T10:30:00Z",
  "member_count": 1
}
```

---

### 2️⃣ LISTINGS

**Base**: `/listings`

| Method | Endpoint                | Purpose             |
| ------ | ----------------------- | ------------------- |
| GET    | `/listings`             | List all listings   |
| POST   | `/listings`             | Create new listing  |
| GET    | `/listings/:id`         | Get listing details |
| PATCH  | `/listings/:id`         | Update listing      |
| DELETE | `/listings/:id`         | Delete listing      |
| POST   | `/listings/:id/publish` | Publish listing     |
| POST   | `/listings/:id/images`  | Upload images       |

**Example: Create Listing**

```bash
POST /api/v1/networks/listings
{
  "brand": "Sony",
  "model": "WH-1000XM5",
  "reference": "Headphones",
  "description": "Noise-cancelling headphones, excellent condition",
  "price": 250.00,
  "status": "draft",
  "shipping": [
    {
      "region": "US",
      "shippingIncluded": true,
      "shippingCost": 0
    },
    {
      "region": "CA",
      "shippingIncluded": false,
      "shippingCost": 15.00
    }
  ]
}

Response: HTTP 201
{
  "_id": "69cc568de174dbd07eae5bba",
  "brand": "Sony",
  "status": "draft",
  "created_at": "2026-04-08T09:00:00Z"
}
```

---

### 3️⃣ OFFERS

**Base**: `/offers` (GET only), `/listings/:id/offers` (POST)

| Method | Endpoint               | Purpose                     |
| ------ | ---------------------- | --------------------------- |
| GET    | `/offers`              | List offers (sent/received) |
| POST   | `/listings/:id/offers` | Send offer on listing       |
| GET    | `/offers/:id`          | Get offer details           |
| POST   | `/offers/:id/accept`   | Accept offer                |
| POST   | `/offers/:id/counter`  | Send counter offer          |
| POST   | `/offers/:id/reject`   | Reject offer                |

**Example: Send Offer**

```bash
POST /api/v1/networks/listings/69cc568de174dbd07eae5bba/offers
{
  "amount": 230.00,
  "shipping_region": "US",
  "message": "Great condition, interested in this item"
}

Response: HTTP 200
{
  "offer_id": "69cc5159cf0fca3e239f7808",
  "status": "pending",
  "created_at": "2026-04-08T10:15:00Z",
  "expires_at": "2026-04-09T10:15:00Z"
}
```

**Shipping Region Enum**: `US` | `CA` | `International`

---

### 4️⃣ ORDERS

**Base**: `/orders` (GET), `/listings/:id/reserve` (POST)

| Method | Endpoint                               | Purpose                   |
| ------ | -------------------------------------- | ------------------------- |
| GET    | `/orders`                              | List orders (buy/sell)    |
| GET    | `/orders/:id`                          | Get order details         |
| POST   | `/listings/:id/reserve`                | Buy Now (direct purchase) |
| POST   | `/orders/:id/complete`                 | Confirm order complete    |
| GET    | `/orders/:id/completion-status`        | Check dual-confirm status |
| POST   | `/orders/:id/reference-check/initiate` | Start vouching            |

**Example: Buy Now (Reserve)**

```bash
POST /api/v1/networks/listings/69cc568de174dbd07eae5bba/reserve
{
  "shipping_region": "US"
}

Response: HTTP 201
{
  "order_id": "69cc515bcf0fca3e239f7811",
  "status": "reserved",
  "amount": 250.00,
  "expires_at": "2026-04-08T11:15:00Z"
}
```

**Order Status**: `reserved` → `pending` → `completed` → `delivered`

---

### 5️⃣ REFERENCE CHECKS (VOUCHING)

**Base**: `/reference-checks`

| Method | Endpoint                         | Purpose                   |
| ------ | -------------------------------- | ------------------------- |
| GET    | `/reference-checks`              | List reference checks     |
| POST   | `/reference-checks`              | Create reference check    |
| GET    | `/reference-checks/:id`          | Get check details         |
| POST   | `/reference-checks/:id/respond`  | Answer vouching questions |
| POST   | `/reference-checks/:id/vouch`    | Submit vouch              |
| POST   | `/reference-checks/:id/complete` | Mark complete             |
| GET    | `/reference-checks/:id/summary`  | Get trust score summary   |

**Example: Create Reference Check**

```bash
POST /api/v1/networks/reference-checks
{
  "target_id": "507f1f77bcf86cd799439011",  // MongoDB User _id
  "order_id": "69cc515bcf0fca3e239f7811",  // Completed order
  "reason": "Great seller, shipped on time"
}

Response: HTTP 201
{
  "check_id": "69d55b179f198eb7ba33ce7f",
  "target": "John Seller",
  "status": "pending_response",
  "created_at": "2026-04-08T10:45:00Z"
}
```

**Requirements**:

- Order must exist and be `reserved`, `delivered`, or `completed`
- target_id must be the OTHER party in the order
- Rate limit: 5 per hour per user

---

### 6️⃣ INQUIRIES & QUESTIONS

**Base**: `/listings/:id/inquire` (POST), `/conversations` (GET)

| Method | Endpoint                     | Purpose                    |
| ------ | ---------------------------- | -------------------------- |
| POST   | `/listings/:id/inquire`      | Ask question on listing    |
| GET    | `/conversations`             | View inquiry conversations |
| GET    | `/conversations/:id/content` | Get shared content         |
| GET    | `/conversations/:id/search`  | Search in conversation     |

**Example: Ask Inquiry**

```bash
POST /api/v1/networks/listings/69cc568de174dbd07eae5bba/inquire
{
  "message": "Can you ship to Canada? Still available?"
}

Response: HTTP 201
{
  "conversation_id": "69d562a89f198eb7ba33ce7e",
  "status": "active",
  "created_at": "2026-04-08T11:00:00Z"
}
```

---

### 7️⃣ CONVERSATIONS & CHAT

**Base**: `/conversations`, `/chat`, `/messages`

| Method | Endpoint              | Purpose            |
| ------ | --------------------- | ------------------ |
| GET    | `/conversations`      | List conversations |
| GET    | `/chats`              | List chats         |
| POST   | `/chat/channel`       | Get/create channel |
| POST   | `/messages/send`      | Send message       |
| POST   | `/messages/:id/read`  | Mark as read       |
| POST   | `/messages/:id/react` | Add emoji reaction |

**Example: Send Message**

```bash
# First get/create channel
POST /api/v1/networks/chat/channel
{
  "listing_id": "69cc568de174dbd07eae5bba",
  "seller_id": "user_36IcC3uo7Ch1Go4qYTZexUeWoZM"
}

# Then send message
POST /api/v1/networks/messages/send
{
  "channel_id": "messaging:69cc568de174dbd07eae5bba-123",
  "text": "Interested in this item. Is it still available?"
}

Response: HTTP 201
{
  "message_id": "msg_123456",
  "text": "Interested in this item. Is it still available?",
  "created_at": "2026-04-08T11:15:00Z"
}
```

---

## Chat System Flow

### Message Flow Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT SIDE                       │
│  (Web/Mobile App with GetStream JavaScript SDK)    │
└────────────────┬────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
  Send        Listen       Receive
  Message     (WebSocket)  Updates
    │            │            │
    └────────┬───┴────┬───────┘
             │        │
    ┌────────▼────────▼──────────────────────────────┐
    │      GetStream Cloud Infrastructure            │
    │  - Real-time message syncing                   │
    │  - WebSocket connections                       │
    │  - Message delivery guarantees                 │
    │  - User presence tracking                      │
    └────────┬──────────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────────┐
    │      Dialist API - Message Handler            │
    │  POST /api/v1/networks/messages/send          │
    │  - Validate user membership                   │
    │  - Store message in MongoDB                   │
    │  - Trigger webhooks                           │
    │  - Send notifications                         │
    └────────┬──────────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────────┐
    │   GetStream Webhooks (Async Processing)       │
    │  - Message created events                     │
    │  - Typing indicators                          │
    │  - Read receipts                              │
    │  - Presence updates                           │
    └────────┬──────────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────────┐
    │      MongoDB & Bull Queue                     │
    │  - Persist events                             │
    │  - Queue async jobs                           │
    │  - Analytics tracking                         │
    │  - Business logic processing                  │
    └──────────────────────────────────────────────┘
```

### Conversation Lifecycle

```
1. USER INITIATES
   └─ Sends inquiry: POST /listings/:id/inquire
   └─ Creates conversation channel
   └─ Initial message stored

2. GETSTREAM RECEIVES
   └─ Message synced to GetStream Cloud
   └─ WebSocket broadcast to participants
   └─ Presence updated (user online)

3. WEBHOOK TRIGGERED
   └─ GetStream sends webhook: message.created
   └─ Persisted to MongoDB
   └─ Triggers Bull job processing

4. NOTIFICATIONS SENT
   └─ Recipient gets push notification
   └─ Email notification (if enabled)
   └─ In-app notification badge

5. CONVERSATION PERSISTS
   └─ Full history searchable
   └─ Content indexing for discovery
   └─ Analytics & reporting

6. ORDER FLOWS INTO
   └─ Accept offer → Order created
   └─ Conversation tagged with order
   └─ Notifications escalate to delivery tracking
```

---

## Webhook Integration

### GetStream Webhook Setup

#### 1. Register Webhook in GetStream Dashboard

```
https://console.getstream.io/

Events to subscribe:
✓ message.created
✓ message.updated
✓ message.deleted
✓ user.presence.changed
✓ typing.start
✓ typing.stop
✓ channel.updated
✓ member_added
✓ member_removed
```

#### 2. Configure Webhook URL

```
Endpoint: https://api.yoursite.com/api/v1/webhooks/getstream
Method: POST
Content-Type: application/json
Headers:
  - X-Signature: HMAC-SHA256 signature (added by GetStream)
  - X-Webhook-ID: Unique event ID
  - X-Webhook-Attempt: Retry attempt number
```

#### 3. Webhook Signature Verification

GetStream signs all webhooks. Verify before processing:

```javascript
// Server receives webhook
POST / api / v1 / webhooks / getstream;

// Server verifies signature
import StreamChat from "getstream";

const streamClient = StreamChat.getInstance(apiKey, apiSecret);
const isValid = streamClient.verifyWebhook(JSON.stringify(body), signature);

if (!isValid) {
  return res.status(401).json({ error: "Invalid signature" });
}
```

### Webhook Event Types

#### Message Created Event

```json
{
  "type": "message.created",
  "event_id": "msg_123456",
  "user": {
    "id": "user_36IcC3uo7Ch1Go4qYTZexUeWoZM",
    "name": "John Seller"
  },
  "message": {
    "id": "msg_123456",
    "text": "Great item! When can you ship?",
    "created_at": "2026-04-08T11:15:00Z",
    "channel": {
      "id": "messaging:listing_69cc568de174dbd07eae5bba",
      "type": "messaging"
    }
  }
}
```

**Server Processing**:

```typescript
switch (event.type) {
  case "message.created":
    // 1. Store message in MongoDB
    const message = await Message.create({
      getstream_id: event.message.id,
      user_id: event.user.id,
      channel_id: event.message.channel.id,
      text: event.message.text,
      created_at: event.message.created_at,
    });

    // 2. Update conversation
    await Conversation.findByIdAndUpdate(event.message.channel.id, {
      last_message: message._id,
      updated_at: new Date(),
    });

    // 3. Send notifications
    await notificationService.sendMessageNotification(message);
    break;
}
```

#### Typing Indicator Event

```json
{
  "type": "typing.start",
  "user": {
    "id": "user_36IcC3uo7Ch1Go4qYTZexUeWoZM"
  },
  "channel": {
    "id": "messaging:listing_69cc568de174dbd07eae5bba"
  }
}
```

**Client Display**:

```javascript
// WebSocket receives typing indicator
socket.on("typing.start", (event) => {
  // Show "John Seller is typing..." indicator
  displayTypingIndicator(event.user.id);

  // Clear after 3 seconds
  setTimeout(() => clearTypingIndicator(), 3000);
});
```

#### User Presence Event

```json
{
  "type": "user.presence.changed",
  "user": {
    "id": "user_36IcC3uo7Ch1Go4qYTZexUeWoZM",
    "online": true,
    "last_active": "2026-04-08T11:15:00Z"
  }
}
```

**Server Processing**:

```typescript
case 'user.presence.changed':
  await User.findByIdAndUpdate(
    event.user.id,
    {
      is_online: event.user.online,
      last_active: event.user.last_active
    }
  );
  // Broadcast to all connected clients
  io.emit('user.online', { userId: event.user.id, online: event.user.online });
  break;
```

### Webhook Processing Flow

```
┌──────────────────────────────────────────────┐
│  GetStream Sends Webhook Event (Async)      │
└────────────┬─────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────┐
    │  1. Verify HMAC Signature                 │
    │     - streamClient.verifyWebhook()        │
    │     - Reject if invalid (401)             │
    └────────┬──────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────┐
    │  2. Check for Duplicates (Idempotency)   │
    │     - Database: GetstreamWebhookEvent   │
    │     - Return 200 if already processed     │
    └────────┬──────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────┐
    │  3. Persist Raw Webhook                   │
    │     - Store full event payload            │
    │     - Keep for audit trail                │
    └────────┬──────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────┐
    │  4. Enqueue Async Processing (Bull)      │
    │     - webhookQueue.add(event)             │
    │     - Return 200 OK immediately           │
    └────────┬──────────────────────────────────┘
             │
             │ (Async, non-blocking)
             │
    ┌────────▼──────────────────────────────────┐
    │  5. Process in Background Worker          │
    │     - Apply business logic                │
    │     - Update MongoDB                      │
    │     - Send notifications                  │
    │     - Trigger side effects                │
    └────────┬──────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────┐
    │  6. Mark Event as Processed               │
    │     - Update status to 'processed'        │
    │     - Log completion metrics             │
    └──────────────────────────────────────────┘
```

### Webhook Retry Logic

GetStream retries failed webhooks with exponential backoff:

```
Attempt 1: Immediate
Attempt 2: After 5 seconds
Attempt 3: After 25 seconds
Attempt 4: After 2 minutes
Attempt 5: After 13 minutes
Attempt 6: After 65 minutes
...up to 10 attempts total (24 hour window)
```

**Your server must**:

- Return HTTP 200-299 for success
- Return HTTP 500+ for retry-able error
- Return HTTP 400 for non-retry-able error
- Process within 200ms (fetch user token async)
- Be idempotent (handle duplicate events)

---

## Error Handling

### HTTP Status Codes

| Code | Meaning      | Action                                                |
| ---- | ------------ | ----------------------------------------------------- |
| 200  | Success      | Request completed                                     |
| 201  | Created      | Resource created (offers, orders, messages)           |
| 400  | Bad Request  | Fix payload (missing fields, enum values)             |
| 401  | Unauthorized | Verify JWT token                                      |
| 403  | Forbidden    | Check permissions (channel membership, listing owner) |
| 404  | Not Found    | Verify resource ID & endpoint path                    |
| 429  | Rate Limited | Wait before retrying (see rate limits)                |
| 500  | Server Error | Retry with exponential backoff                        |

### Common Error Responses

**Missing Required Field**:

```json
{
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "path": "body.shipping_region",
      "field": "shipping_region",
      "message": "Required"
    }
  ]
}
```

**Invalid Enum Value**:

```json
{
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "path": "body.shipping_region",
      "message": "Invalid enum value. Expected 'US' | 'CA' | 'International', received 'us'"
    }
  ]
}
```

**Resource Inactive**:

```json
{
  "message": "Listing is no longer active and cannot be reserved",
  "code": "VALIDATION_ERROR"
}
```

**Rate Limited**:

```json
{
  "message": "You have reached the maximum number of reference checks per hour",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 2942
}
```

**Not Channel Member**:

```json
{
  "message": "Not a member of this channel",
  "code": "AUTHORIZATION_ERROR"
}
```

---

## Rate Limits

| Operation        | Limit         | Window  |
| ---------------- | ------------- | ------- |
| Create offer     | 20 per hour   | User    |
| Create offer     | 5 per listing | 24 hour |
| Create order     | 20 per hour   | User    |
| Reference checks | 5 per hour    | User    |
| Messages         | 100 per hour  | User    |
| Search           | 1000 per hour | User    |
| List operations  | Unlimited     | -       |
| Get operations   | Unlimited     | -       |

**Rate Limit Headers**:

```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 18
X-RateLimit-Reset: 1712602800
```

**When Rate Limited**:

```bash
# Response
HTTP 429 Too Many Requests
X-RateLimit-RetryAfter: 3600

{
  "message": "Rate limit exceeded",
  "retryAfter": 3600
}

# Client should wait
await new Promise(r => setTimeout(r, 3600000)); // 1 hour
```

---

## Code Examples

### Node.js/Express Client

```javascript
const axios = require("axios");

const client = axios.create({
  baseURL: "http://localhost:5050/api/v1/networks",
  headers: {
    Authorization: `Bearer ${JWT_TOKEN}`,
  },
});

// GET - List Listings
async function listListings(query = {}) {
  const response = await client.get("/listings", { params: query });
  return response.data;
}

// POST - Create Listing
async function createListing(data) {
  const response = await client.post("/listings", data);
  return response.data;
}

// POST - Send Offer
async function sendOffer(listingId, offering) {
  const response = await client.post(`/listings/${listingId}/offers`, offering);
  return response.data;
}

// POST - Send Message
async function sendMessage(channelId, text) {
  const response = await client.post("/messages/send", {
    channel_id: channelId,
    text: text,
  });
  return response.data;
}

// POST - Create Reference Check
async function createReferenceCheck(userId, orderId, reason) {
  const response = await client.post("/reference-checks", {
    target_id: userId,
    order_id: orderId,
    reason: reason,
  });
  return response.data;
}

// Usage
(async () => {
  try {
    const listings = await listListings({ limit: 10 });
    console.log("Listings:", listings);

    const offer = await sendOffer("69cc568de174dbd07eae5bba", {
      amount: 230,
      shipping_region: "US",
      message: "Interested",
    });
    console.log("Offer created:", offer);
  } catch (error) {
    if (error.response?.status === 429) {
      console.log(
        "Rate limited, retry after:",
        error.response.headers["x-ratelimit-reset"],
      );
    } else {
      console.error("Error:", error.response?.data || error.message);
    }
  }
})();
```

### React Chat Component

```javascript
import {
  useChat,
  Channel,
  ChannelHeader,
  MessageList,
  MessageInput,
} from "stream-chat-react";

function ChatWindow({ channelId, userId, token, apiKey }) {
  const chatClient = useMemo(() => {
    const client = StreamChat.getInstance(apiKey);
    client.connectUser({ id: userId }, token);
    return client;
  }, [userId, token, apiKey]);

  const channel = useMemo(() => {
    return chatClient.channel("messaging", channelId);
  }, [chatClient, channelId]);

  return (
    <Chat client={chatClient} theme="light">
      <Channel channel={channel}>
        <ChannelHeader />
        <MessageList />
        <MessageInput />
      </Channel>
    </Chat>
  );
}
```

### Webhook Handler (Express)

```javascript
const express = require("express");
const StreamChat = require("getstream").StreamChat;

const router = express.Router();
const streamClient = StreamChat.getInstance(apiKey, apiSecret);

router.post("/getstream", async (req, res) => {
  try {
    // 1. Verify signature
    const signature = req.headers["x-signature"];
    const rawBody = req.body;

    const isValid = streamClient.verifyWebhook(
      JSON.stringify(rawBody),
      signature,
    );

    if (!isValid) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // 2. Check for duplicates
    const { eventId } = req.headers["x-webhook-id"];
    const existing = await WebhookEvent.findOne({ eventId });
    if (existing?.status === "processed") {
      return res.status(200).json({ ok: true, cached: true });
    }

    // 3. Enqueue for async processing
    await webhookQueue.add({
      eventId,
      type: rawBody.type,
      payload: rawBody,
    });

    // 4. Return immediately
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Worker (background process)
webhookQueue.process(async (job) => {
  const { eventId, type, payload } = job.data;

  switch (type) {
    case "message.created":
      // Store message
      await Message.create({
        getstream_id: payload.message.id,
        text: payload.message.text,
        user_id: payload.user.id,
      });
      break;

    case "user.presence.changed":
      // Update user online status
      await User.updateOne(
        { _id: payload.user.id },
        { is_online: payload.user.online },
      );
      break;
  }

  // Mark as processed
  await WebhookEvent.updateOne({ eventId }, { status: "processed" });
});

module.exports = router;
```

---

## Summary

### Essential Concepts

1. **Authentication**: Every request needs Clerk JWT token
2. **Resources**: Built around listings, offers, orders, messages
3. **Real-time**: GetStream powers live chat & presence
4. **Webhooks**: GetStream sends async notifications via webhooks
5. **Async Processing**: Webhooks enqueued with Bull for non-blocking processing
6. **Idempotency**: Always check for duplicate webhook events
7. **Rate Limits**: Reference checks & offers have hourly limits
8. **Error Handling**: Validate schemas, handle rate limits, retry transient failures

### Quick Reference

```bash
# Get tokens
curl -H "Authorization: Bearer JWT" http://localhost:5050/api/v1/user/tokens

# List listings
curl -H "Authorization: Bearer JWT" http://localhost:5050/api/v1/networks/listings

# Send offer
curl -X POST -H "Authorization: Bearer JWT" -H "Content-Type: application/json" \
  -d '{"amount":230,"shipping_region":"US"}' \
  http://localhost:5050/api/v1/networks/listings/ID/offers

# Send message
curl -X POST -H "Authorization: Bearer JWT" -H "Content-Type: application/json" \
  -d '{"channel_id":"ID","text":"Message"}' \
  http://localhost:5050/api/v1/networks/messages/send

# Register webhook in GetStream console
https://console.getstream.io/ → Webhooks → Add: https://api.yoursite.com/api/v1/webhooks/getstream
```

---

**Last Updated**: April 8, 2026
**Status**: Production Ready ✅
**Test Coverage**: 80% (17/21 endpoints)
