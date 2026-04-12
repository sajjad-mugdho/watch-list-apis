# Networks Chat System: Complete Documentation

**Full End-to-End Guide for Real-Time Chat, GetStream Integration, & Commerce Communication**

Version: 1.0 · April 2026

---

# ⚡ Quick Start Overview

## What Is It? (One Paragraph)

The Networks Chat System enables real-time peer-to-peer messaging between buyers and sellers using **GetStream Chat**. Users can inquire about listings, send offers, accept deals, and track orders—all within a unified chat interface.

## Core Features

| Feature       | What It Does                            |
| ------------- | --------------------------------------- |
| **1:1 Chat**  | Buyer-seller conversations per listing  |
| **Real-Time** | WebSocket for instant message delivery  |
| **Offers**    | Send/accept offers within chat context  |
| **Orders**    | Track order status without leaving chat |
| **Webhooks**  | Async event processing from GetStream   |
| **Presence**  | See who's online, typing indicators     |

## Getting Started (5 Minutes)

### For Developers

**1. Get Chat Token**

```bash
curl -X GET http://localhost:3000/api/v1/networks/chat/token \
  -H "Authorization: Bearer YOUR_CLERK_JWT"
# Response: { token, userId, apiKey }
```

**2. Connect WebSocket (Frontend)**

```javascript
import { StreamChat } from "stream-chat";
const client = new StreamChat(apiKey);
await client.connectUser({ id: userId }, token);
```

**3. Send Message**

```bash
curl -X POST http://localhost:3000/api/v1/networks/messages/send \
  -H "Authorization: Bearer JWT" \
  -d '{
    "channel_id": "messaging:abc123...",
    "text": "Is this still available?"
  }'
```

**That's it!** You now have:

- ✅ Real-time messaging
- ✅ Read receipts
- ✅ Typing indicators

### For DevOps

**1. Configure Environment**

```bash
GETSTREAM_API_KEY=b5z5jt844r2xf
GETSTREAM_API_SECRET=xxxx...
MONGODB_URI=mongodb://...
REDIS_HOST=localhost
```

**2. Set Webhook URL in GetStream Dashboard**

```
https://api.yourdomain.com/api/v1/webhooks/getstream
```

**3. Start Services**

```bash
# Terminal 1
mongod

# Terminal 2
redis-server

# Terminal 3
npm run dev  # Webhook processor starts automatically
```

## Common Tasks

| Task                     | How                                |
| ------------------------ | ---------------------------------- |
| **Load message history** | `GET /messages/channel/:id`        |
| **Mark as read**         | `POST /messages/:id/read`          |
| **Send offer**           | `POST /listings/:id/offers`        |
| **Accept offer**         | `POST /offers/:id/accept`          |
| **Subscribe to channel** | `channel.watch()` in GetStream SDK |

## Key Concepts

**User-to-User Channels:** One channel per buyer-seller pair (not per listing). This means conversations span multiple listings naturally.

**Dual Storage:** Messages live in both GetStream (real-time) and MongoDB (persistence). GetStream webhooks keep them in sync.

**Async Webhooks:** GetStream events are validated, enqueued to Redis, then processed by background worker. Always returns 200 OK fast.

**Deterministic IDs:** Channel IDs are MD5 hashes of buyer+seller, ensuring same pair = same channel every time.

## Architecture at a Glance

```
Client (WebSocket)
    ↓
Express API Layer (Routes, Handlers, Services)
    ↓
┌──────────────┬─────────────────────────┐
│ MongoDB      │ GetStream Cloud         │
│ (Business)   │ (Real-time Delivery)    │
└──────────────┴────────────┬────────────┘
                             ↓
                     Webhook Events
                             ↓
                    /webhooks/getstream
                             ↓
                    Bull Queue (Redis)
                             ↓
                  Background Worker Process
```

## Where to Go From Here

- **Want to understand the complete flow?** → [Complete Inquiry Journey](#getting-started-tutorial)
- **Need specific how-to?** → [How-To Guides](#how-to-guides)
- **Looking for API specs?** → [API Reference](#api-reference)
- **Debugging an issue?** → [Error Handling & Troubleshooting](#error-handling--troubleshooting)
- **Understand system design?** → [Deep Dives](#deep-dives-how-it-works)

---

## Table of Contents

1. [⚡ Quick Start Overview](#-quick-start-overview) ← Start here for a 5-minute summary
2. [System Architecture](#system-architecture)
3. [Getting Started Tutorial](#getting-started-tutorial)
4. [How-To Guides](#how-to-guides)
5. [API Reference](#api-reference)
6. [Data Models & Schemas](#data-models--schemas)
7. [Configuration & Setup](#configuration--setup)
8. [Deep Dives: How It Works](#deep-dives-how-it-works)
9. [Error Handling & Troubleshooting](#error-handling--troubleshooting)

---

# System Architecture

## High-Level Data Flow

### 1. Authentication & Token Generation

```
Client Request
  ↓
GET /api/v1/networks/chat/token
  ↓ [Clerk JWT Validated]
ChatService.createUserToken(userId)
  ↓ [GetStream token generated]
Response: { token, userId, apiKey }
  ↓
Client connects WebSocket
  ↓
Real-time connection established
```

### 2. Channel Management

```
Channel Creation Request
  ↓ [Deterministic ID: MD5_HASH(buyerId + sellerId)]
GET /api/v1/networks/chat/channel
  ↓
Search MongoDB NetworkListingChannel
  ├─ If exists: REUSE (Networks = user-to-user)
  └─ If new: CREATE both in GetStream + MongoDB
  ↓
Return channelId + metadata
```

### 3. Message Flow

```
Client sends message
  ↓
POST /api/v1/networks/messages/send
  ↓ [Validate membership]
GetStream receives message
  ↓
Message delivered to WebSocket subscribers
  ↓
Webhook: message.new fired
  ↓
Bull Queue enqueues job
  ↓
Worker process: Update stats, emit events
```

### 4. Webhook Pipeline

```
GetStream Cloud Event
  ↓
POST /api/v1/webhooks/getstream
  ↓ [HMAC signature verification]
  ↓ [Idempotency check]
Persist to GetstreamWebhookEvent (MongoDB)
  ↓
Enqueue to Bull Queue (Redis)
  ↓ [Return 200 OK immediately]
Worker picks up job (async)
  ↓ [Process event]
  ├─ message.new → Update user stats
  ├─ message.read → Track read receipts
  ├─ reaction.new → Log engagement
  └─ channel.* → Log channel events
  ↓
Mark processed, emit events
```

## Key Components

| Component                   | File                                              | Purpose                                                           |
| --------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| **ChatService**             | `src/services/ChatService.ts`                     | GetStream client operations, token generation, channel management |
| **ChannelContextService**   | `src/services/ChannelContextService.ts`           | Enriches GetStream channels with MongoDB business logic           |
| **NetworksChannelService**  | `src/networks/services/NetworksChannelService.ts` | Networks-specific channel operations (platform-locked)            |
| **NetworksMessageService**  | `src/networks/services/NetworksMessageService.ts` | Networks message operations (facade pattern)                      |
| **getstreamWebhookHandler** | `src/handlers/getstreamWebhookHandler.ts`         | Receives and verifies webhook events, enqueues jobs               |
| **webhookProcessor**        | `src/workers/webhookProcessor.ts`                 | Bull worker that processes webhook events asynchronously          |
| **webhookQueue**            | `src/queues/webhookQueue.ts`                      | Bull queue configuration (Redis backend)                          |

---

# Getting Started Tutorial

## The Complete Inquiry-to-Order Journey

This tutorial walks you through the entire journey from buyer inquiry to successful order, showing how the chat system enables commerce.

### Prerequisites

- Backend Express server running
- GetStream account configured (API key + secret)
- MongoDB connection active
- Redis for Bull queue
- Frontend client with StreamChat SDK

### Step 1: User Authenticates

**What happens:**
A user logs in through the app (Clerk authentication).

**What you need to know:**

- Clerk JWT is generated by the frontend
- JWT contains user ID
- This JWT is sent with API requests

**Code context:** `src/middleware/customClerkMw.ts` validates the JWT and extracts user context.

### Step 2: Frontend Gets Chat Token

**What happens:**

```
Frontend calls: GET /api/v1/networks/chat/token
With header: Authorization: Bearer <CLERK_JWT>
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user_36IcC3uo7Ch1Go4qYTZexUeWoZM",
  "apiKey": "b5z5jt844r2xf"
}
```

**What happens on the server:**

1. Clerk JWT validated
2. User fetched/created in MongoDB
3. User synced to GetStream (name, avatar)
4. GetStream token generated (1-hour expiration)
5. Token returned to client

**Code:** `src/networks/handlers/NetworksChatHandlers.ts` → `generateToken`

### Step 3: Frontend Connects to GetStream

**What happens:**

```javascript
// Frontend code
const client = new StreamChat(apiKey);
await client.connectUser({ id: userId }, token);

// Now listen to events
client.on("message.new", (e) => {
  // Update UI with new message
});
```

**What you should know:**

- WebSocket connection is established
- Client is ready to receive real-time messages
- Token expires in 1 hour (client should refresh)

### Step 4: Buyer Creates Inquiry on Listing

**What happens:**

```
Buyer clicks "Inquire" on listing
  ↓
POST /api/v1/networks/listings/:listingId/inquire
Body: { "message": "Is this still available?" }
```

**Behind the scenes:**

1. ✅ Validate buyer is not seller
2. ✅ Search for existing user-to-user channel
   - If exists: REUSE it (Networks policy)
   - If new: Create both in GetStream + MongoDB
3. ✅ Create GetStream channel with listing metadata
4. ✅ Save NetworkListingChannel document
5. ✅ Send system message: "inquiry" type
6. ✅ Return channel ID to client

**Response:**

```json
{
  "data": {
    "channel_id": "a1b2c3d4e5f6g7h8...",
    "listing_id": "lst_001",
    "buyer_id": "buyer_001",
    "seller_id": "seller_001",
    "status": "open",
    "inquiries": [
      {
        "sender_id": "buyer_001",
        "message": "Is this still available?",
        "createdAt": "2026-03-27T10:30:00Z"
      }
    ]
  }
}
```

**Code:** `src/networks/handlers/NetworksInquiryHandlers.ts` → `networks_listing_inquire`

### Step 5: Webhook: GetStream Sends message.new Event

**What happens:**

GetStream detects the inquiry message and sends a webhook:

```
POST /api/v1/webhooks/getstream
X-Webhook-Id: getstream_msg_001
X-Signature: HMAC_SHA256(payload, secret)

Body: {
  "type": "message.new",
  "message": {
    "id": "msg_sys_001",
    "text": "Is this still available?",
    "user": { "id": "buyer_001", "name": "John Buyer" }
  },
  "channel_id": "a1b2c3d4e5f6g7h8...",
  "created_at": "2026-03-27T10:30:00Z"
}
```

**Response:** Webhook handler returns 200 OK immediately (async processing)

**Code:** `src/handlers/getstreamWebhookHandler.ts` → `webhook_getstream_post`

### Step 6: Webhook Processing (Async)

**What happens:**

1. ✅ HMAC signature verified (security check)
2. ✅ Idempotency checked (is this a duplicate?)
3. ✅ Event persisted to MongoDB (audit trail)
4. ✅ Job enqueued to Bull queue
5. Worker picks up job and:
   - Updates user stats (message_count++)
   - Emits events for integration
   - Marks webhook as processed

**Code:** `src/workers/webhookProcessor.ts` → `handleGetstreamMessageNew`

### Step 7: Real-Time Update: Seller Gets Notification

**What happens:**

Seller has WebSocket connected to the same channel:

```javascript
// Seller's client automatically receives:
client.on("message.new", (event) => {
  console.log("Inquiry from John:", event.message.text);
  // UI updates:
  // - Badge shows +1 unread
  // - Message appears in inbox
  // - Notification toast appears
});
```

**No additional API call needed** - WebSocket delivers instantly.

### Step 8: Seller Responds with Offer

**What happens:**

```
Seller clicks "Send Offer"
  ↓
POST /api/v1/networks/listings/:listingId/offers
Body: {
  "amount": 13000,
  "message": "I can do $13k for you"
}
```

**Behind the scenes:**

1. ✅ Create Offer document (canonical)
2. ✅ Update NetworkListingChannel.last_offer
3. ✅ Send system message type: "offer"
4. ✅ Create in-app notification
5. ✅ Return offer details

**Response:**

```json
{
  "data": {
    "channel": {
      "last_offer": {
        "_id": "offer_456",
        "amount": 13000,
        "status": "CREATED",
        "expires_at": "2026-03-29T10:30:00Z"
      }
    }
  }
}
```

**Code:** `src/networks/handlers/NetworksOfferHandlers.ts` → `networks_offer_send`

### Step 9: Buyer Accepts Offer

**What happens:**

```
Buyer clicks "Accept Offer"
  ↓
POST /api/v1/networks/offers/:offerId/accept
```

**Behind the scenes:**

1. ✅ Validate offer still active
2. ✅ Transition offer state: CREATED → ACCEPTED
3. ✅ Create Order document (canonical)
4. ✅ Send system message: "offer_accepted"
5. ✅ Create notifications for both parties
6. ✅ Emit "order:created" event

**Response:**

```json
{
  "data": {
    "offer": { "status": "ACCEPTED" },
    "order": {
      "_id": "order_789",
      "amount": 13000,
      "status": "PENDING_PAYMENT",
      "expires_at": "2026-03-30T10:30:00Z"
    }
  }
}
```

### Step 10: Chat Becomes Order Workspace

**What happens:**

The same chat channel now serves as the workspace for the order:

```json
{
  "type": "personal_chat",
  "context": {
    "listing": { ... },
    "offer": {
      "amount": 13000,
      "status": "ACCEPTED"
    },
    "order": {
      "status": "PENDING_PAYMENT",
      "amount": 13000
    }
  }
}
```

Buyer and seller can:

- Message about payment/shipping
- Share tracking numbers
- Request refunds/modifications
- Leave reviews/ratings

---

# How-To Guides

## How to Generate a Chat Token

### Goal

Get a GetStream token so your frontend can connect to real-time chat.

### Prerequisites

- User must be authenticated (Clerk JWT)
- User must exist in MongoDB

### Steps

**1. Call the token endpoint from frontend:**

```javascript
const response = await fetch("/api/v1/networks/chat/token", {
  method: "GET",
  headers: {
    Authorization: `Bearer ${clerkJwt}`,
  },
});

const { token, userId, apiKey } = await response.json();
```

**2. Store the token:**

```javascript
// Save for 50-minute duration
localStorage.setItem("getstream_token", token);
localStorage.setItem("getstream_token_expiry", Date.now() + 50 * 60 * 1000);
```

**3. Connect to GetStream:**

```javascript
import { StreamChat } from "stream-chat";

const client = new StreamChat(apiKey);
await client.connectUser({ id: userId }, token);

console.log("Connected to GetStream");
```

### Troubleshooting

**401 Unauthorized:**

- Check if Clerk JWT is valid
- Verify JWT has `userId` property

**User not found:**

- User must exist in MongoDB before generating token
- Check User collection in MongoDB

**Token expired:**

- Tokens expire after 1 hour
- Call the endpoint again to get a fresh token

---

## How to Create a 1:1 Chat Channel

### Goal

Create a buyer-seller chat channel when a user inquires about a listing.

### Prerequisites

- Both users must exist in MongoDB
- Listing must exist and be active
- User must be authenticated

### Steps

**1. Send inquiry request:**

```json
POST /api/v1/networks/listings/:listingId/inquire
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "message": "Is this available?"
}
```

**2. Server creates channel:**

The server automatically:

- Checks if user-to-user channel already exists
- If exists: Reuses it (Networks policy)
- If new: Creates in GetStream + MongoDB
- Sets up listing metadata

**3. Client receives channel ID:**

```json
{
  "data": {
    "channel_id": "a1b2c3d4e5f6g7h8...",
    "listing_id": "lst_001",
    "status": "open",
    "inquiries": [...]
  }
}
```

**4. Subscribe to channel on frontend:**

```javascript
const channel = client.channel("messaging", "a1b2c3d4e5f6g7h8...");

await channel.watch();

channel.on("message.new", (event) => {
  console.log("New message:", event.message.text);
});
```

### Why User-to-User Channels?

Networks uses **user-to-user channels** (not listing-to-user). This means:

- One buyer-seller pair = one channel (across all listings)
- If they inquire on multiple listings: Same channel is reused
- Listing context is stored as metadata, not channel identity
- More efficient, cleaner conversation history

---

## How to Send a Message

### Goal

Send a text message or system message in a chat channel.

### Prerequisites

- User is authenticated
- User is a member of the channel (buyer or seller)
- Channel is not closed

### Steps

**1. Send message to API:**

```json
POST /api/v1/networks/messages/send
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "channel_id": "messaging:a1b2c3d4e5f6g7h8...",
  "text": "This looks great! What's the best price you can do?",
  "type": "regular",
  "attachments": [],
  "custom_data": {}
}
```

**2. Server validates:**

- ✅ User membership in channel
- ✅ Channel is not closed
- ✅ Message has text or attachments

**3. GetStream receives message:**

Message is posted immediately to GetStream.

**4. Response:**

```json
{
  "id": "msg_abc123",
  "channel_id": "messaging:a1b2c3d4e5f6g7h8...",
  "text": "This looks great!...",
  "user_id": "buyer_001",
  "created_at": "2026-03-27T15:30:00Z",
  "status": "delivered"
}
```

**5. Real-time delivery:**

WebSocket subscribers get instant notification:

```javascript
channel.on("message.new", (event) => {
  console.log("Message from", event.message.user.name);
  console.log("Text:", event.message.text);
});
```

### Alternative: System Messages

For commerce events (offers, orders), use system messages:

**Backend code:**

```typescript
await chatService.sendSystemMessage(
  channel_id,
  {
    type: "offer",
    amount: 13000,
    offer_id: "offer_456",
    message: "New offer received",
  },
  senderId,
);
```

**Message appears as:**

```
💰 New offer: $13,000
```

---

## How to Load Message History

### Goal

Fetch previous messages when user opens a chat.

### Prerequisites

- User is authenticated
- Channel ID is known

### Steps

**1. Call message history endpoint:**

```json
GET /api/v1/networks/messages/channel/messaging:a1b2c3d4e5f6g7h8?limit=50&offset=0
Authorization: Bearer <JWT>
```

**Query parameters:**

- `limit` - Max messages (default: 20, max: 100)
- `offset` - For pagination

**2. Response:**

```json
{
  "messages": [
    {
      "id": "msg_001",
      "text": "Is this still available?",
      "sender_id": "buyer_001",
      "created_at": "2026-03-27T10:30:00Z",
      "type": "regular",
      "status": "read"
    },
    {
      "id": "msg_sys_002",
      "text": "💰 New offer: $13,000",
      "custom": {
        "system_message": true,
        "type": "offer",
        "amount": 13000
      },
      "created_at": "2026-03-27T11:00:00Z"
    }
  ],
  "hasMore": true
}
```

**3. Display in UI:**

```javascript
const messages = response.messages;
messages.forEach((msg) => {
  if (msg.custom?.system_message) {
    // Display system message (offer, order, etc.)
    showSystemMessage(msg.text);
  } else {
    // Display regular message
    showChatMessage(msg.sender_id, msg.text);
  }
});
```

### Pagination Example

```javascript
// Load first page
let offset = 0;
const limit = 50;

async function loadMoreMessages() {
  const response = await fetch(
    `/api/v1/networks/messages/channel/${channelId}?limit=${limit}&offset=${offset}`,
  );
  const data = await response.json();

  addMessagesToUI(data.messages);

  if (data.hasMore) {
    offset += limit;
    // Can load more
  }
}
```

---

## How to Mark Messages as Read

### Goal

Update read status so sender knows you've seen messages.

### Prerequisites

- User is authenticated
- Message ID is known

### Steps

**1. Mark single message as read:**

```json
POST /api/v1/networks/messages/:messageId/read
Authorization: Bearer <JWT>
```

**2. Or mark entire channel as read:**

```json
POST /api/v1/networks/messages/channel/:channelId/read-all
Authorization: Bearer <JWT>
```

**3. Real-time update:**

Sender receives webhook event `message.read`:

```javascript
// Sender's client
channel.on("message.read", (event) => {
  console.log(event.user.name, "read message", event.read_up_to);
});
```

---

## How to Connect to GetStream Real-Time

### Goal

Set up WebSocket connection and listen to real-time events.

### Prerequisites

- GetStream token obtained
- GetStream API key available

### Steps

**1. Import StreamChat:**

```javascript
import { StreamChat } from "stream-chat";
```

**2. Initialize client:**

```javascript
const client = new StreamChat("b5z5jt844r2xf");
```

**3. Connect user:**

```javascript
await client.connectUser({ id: userId, name: "John Doe" }, token);

console.log("Connected to GetStream");
```

**4. Subscribe to specific channel:**

```javascript
const channel = client.channel("messaging", "channel_id");
await channel.watch();
```

**5. Listen to events:**

```javascript
// New message
channel.on("message.new", (event) => {
  console.log("Message:", event.message.text);
});

// User typing
channel.on("typing.start", (event) => {
  console.log(`${event.user.name} is typing...`);
});

channel.on("typing.stop", (event) => {
  console.log(`${event.user.name} stopped typing`);
});

// Message edited
channel.on("message.updated", (event) => {
  console.log("Message updated:", event.message.text);
});

// Message deleted
channel.on("message.deleted", (event) => {
  console.log("Message deleted");
});

// User read message
channel.on("message.read", (event) => {
  console.log("Read by:", event.user.name);
});

// User came online
channel.on("user.presence.changed", (event) => {
  if (event.user.online) {
    console.log(`${event.user.name} came online`);
  } else {
    console.log(`${event.user.name} went offline`);
  }
});
```

**6. Send typing indicator:**

```javascript
// Start typing
channel.keystroke();

// Stop typing
channel.stopTyping();
```

**7. Disconnect (cleanup):**

```javascript
await client.disconnectUser();
console.log("Disconnected from GetStream");
```

### Connection Lifecycle

```
connectUser()
  ↓
WebSocket connects
  ↓
Listening to events
  ↓
[User interacts]
  ↓
disconnectUser()
  ↓
Connection closed
```

---

## How to Validate Webhook Signatures

### Goal

Ensure webhook events from GetStream are authentic and haven't been tampered with.

### Prerequisites

- GetStream secret configured in environment
- Webhook event received

### Steps

**1. Extract signature from headers:**

```typescript
const signature = req.headers["x-signature"] as string;
const rawBody = req.rawBody; // Must use raw string, not parsed JSON
```

**2. Verify signature:**

```typescript
import { StreamChat } from "stream-chat";

const client = StreamChat.getInstance(
  process.env.GETSTREAM_API_KEY,
  process.env.GETSTREAM_API_SECRET,
);

const isValid = client.verifyWebhook(rawBody, signature);

if (!isValid) {
  return res.status(401).json({ error: "Invalid signature" });
}
```

**3. Continue processing:**

```typescript
// Signature is valid, safe to process
const payload = JSON.parse(rawBody);
console.log("Event type:", payload.type);
```

### Why This Matters

GetStream signs every webhook with HMAC-SHA256. Verification ensures:

- ✅ Event came from GetStream (not an attacker)
- ✅ Event wasn't modified in transit
- ✅ You can trust the data

---

## How to Handle Webhook Events

### Goal

Process webhook events from GetStream (messages, reactions, channel updates).

### Prerequisites

- Webhook endpoint registered in GetStream dashboard
- Webhook handler implemented

### Steps

**1. Handler receives event:**

```typescript
POST /api/v1/webhooks/getstream

Headers:
  X-Webhook-Id: getstream_event_123
  X-Signature: sha256=HMAC_VALUE
  X-Webhook-Attempt: 1

Body:
{
  "type": "message.new",
  "message": { ... },
  "channel": { ... },
  "created_at": "2026-03-27T15:30:00Z"
}
```

**2. Handler validates and enqueues:**

```typescript
// 1. Verify signature
const isValid = client.verifyWebhook(rawBody, signature);
if (!isValid) return res.status(401).json(...);

// 2. Check for duplicates (idempotency)
const existing = await GetstreamWebhookEvent.findOne({
  eventId: req.headers['x-webhook-id']
});
if (existing?.status === 'processed') {
  return res.status(200).json({ skip: true });
}

// 3. Persist raw event
await GetstreamWebhookEvent.create({
  eventId: req.headers['x-webhook-id'],
  eventType: req.body.type,
  payload: req.body,
  status: 'pending'
});

// 4. Enqueue for async processing
await webhookQueue.add({
  eventId: req.headers['x-webhook-id'],
  type: req.body.type,
  payload: req.body
});

// 5. Return 200 OK immediately
return res.status(200).json({ success: true });
```

**3. Worker processes event:**

```typescript
// Bull worker picks up job
webhookQueue.process(async (job) => {
  const { eventId, type, payload } = job.data;

  try {
    // Process based on type
    if (type === "message.new") {
      await handleMessageNew(payload);
    } else if (type === "message.read") {
      await handleMessageRead(payload);
    } else if (type === "reaction.new") {
      await handleReaction(payload);
    }

    // Mark processed
    await GetstreamWebhookEvent.updateOne(
      { eventId },
      { status: "processed", processedAt: new Date() },
    );
  } catch (error) {
    // Bull will retry (up to 10 times with exponential backoff)
    throw error;
  }
});
```

**4. Handle specific event types:**

### Event Type: message.new

```typescript
async function handleMessageNew(payload) {
  const { message, channel } = payload;

  // Update user activity
  await User.findByIdAndUpdate(message.user.id, {
    $set: { last_activity: new Date() },
    $inc: { message_count: 1 },
  });

  // Emit event for rest of system
  events.emit("getstream:message.new", {
    messageId: message.id,
    channelId: channel.id,
    userId: message.user.id,
  });
}
```

### Event Type: message.read

```typescript
async function handleMessageRead(payload) {
  const { user, channel } = payload;

  // Log for analytics
  logger.info("Message read", {
    userId: user.id,
    channelId: channel.id,
    timestamp: new Date(),
  });

  // Could emit event for read receipt tracking
  events.emit("getstream:message.read", {
    userId: user.id,
    channelId: channel.id,
  });
}
```

### Event Type: reaction.new

```typescript
async function handleReaction(payload) {
  const { reaction, message, user } = payload;

  logger.info("Reaction added", {
    emoji: reaction.type,
    messageId: message.id,
    userId: user.id,
  });

  // Optional: track engagement metrics
  events.emit("getstream:reaction", {
    emoji: reaction.type,
    messageId: message.id,
  });
}
```

---

## How to Implement Retry Logic for Failed Webhooks

### Goal

Automatically retry failed webhook processing with exponential backoff.

### Prerequisites

- Bull queue configured
- Redis running

### How It Works

**Configuration (built-in):**

```typescript
const webhookQueue = new Queue("webhook-processing", {
  redis: config.redis,
  defaultJobOptions: {
    attempts: 10, // Max 10 retries
    backoff: {
      type: "exponential",
      delay: 2000, // Start: 2s, then 4s, 8s, 16s...
    },
  },
});
```

**Automatic retry flow:**

```
Job enqueued
  ↓
Worker picks up job
  ↓
Processing fails (error thrown)
  ↓
Bull catches error
  ↓
Wait 2 seconds (attempt 1 failed)
  ↓
Retry attempt 2...
  ↓
(repeats until attempt 10 or success)
  ↓
Success: Job removed from queue
Failed: Job marked as failed (kept for debugging)
```

**Monitor retries:**

```typescript
webhookQueue.on("failed", (job, error) => {
  webhookLogger.error("Job failed", {
    jobId: job.id,
    attempt: job.attemptsMade + 1,
    maxAttempts: job.opts.attempts,
    error: error.message,
  });

  // Send alert if max attempts reached
  if (job.attemptsMade >= 9) {
    alerts.send("Webhook processing failed after max retries", {
      jobId: job.id,
      eventType: job.data.type,
    });
  }
});
```

---

## How to Create an Offer Through Chat

### Goal

Send an offer to a potential buyer within an active chat channel.

### Prerequisites

- Buyer and seller must have active chat channel
- Listing must be active
- Seller must own the listing

### Steps

**1. Seller sends offer request:**

```json
POST /api/v1/networks/listings/:listingId/offers
Authorization: Bearer <SELLER_JWT>
Content-Type: application/json

{
  "amount": 12500,
  "message": "Would $12.5k work for you?",
  "shipping_region": "CA",
  "request_free_shipping": false
}
```

**2. Server validates:**

- ✅ Listing is active
- ✅ Offers are enabled
- ✅ Seller owns listing
- ✅ No pending offer already exists
- ✅ Amount is valid (positive)

**3. Server creates offer:**

```typescript
// 1. Create canonical Offer document
const offer = await Offer.create({
  listing_id: listingId,
  channel_id: channel._id,
  sender_id: sellerId,
  receiver_id: buyerId,
  amount: 12500,
  message: "Would $12.5k work for you?",
  state: "CREATED",
  status: "sent",
  expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
  platform: "networks",
});

// 2. Update channel with last offer
channel.last_offer = {
  amount: 12500,
  sender_id: sellerId,
  status: "sent",
  expiresAt: offer.expires_at,
};
await channel.save();

// 3. Send system message to GetStream
await chatService.sendSystemMessage(
  channel.getstream_channel_id,
  {
    type: "offer",
    amount: 12500,
    offer_id: offer._id,
  },
  sellerId,
);

// 4. Create notification
await notificationService.create({
  userId: buyerId,
  type: "offer_received",
  title: "Offer Received",
  body: `$${amount.toLocaleString()} offer for ${listing.brand}`,
  actionUrl: `/networks/offers/${offer._id}`,
});
```

**4. Response:**

```json
{
  "data": {
    "offer": {
      "_id": "offer_456",
      "amount": 12500,
      "status": "sent",
      "expires_at": "2026-03-29T15:30:00Z",
      "message": "Would $12.5k work for you?"
    },
    "channel": {
      "last_offer": { ... }
    }
  }
}
```

**5. Buyer sees offer in chat:**

```javascript
// Via WebSocket
channel.on("message.new", (event) => {
  if (event.message.custom?.type === "offer") {
    // Show offer UI with accept/decline buttons
    showOfferCard({
      amount: event.message.custom.amount,
      expiresAt: event.message.custom.expires_at,
      message: event.message.text,
    });
  }
});
```

---

## How to Accept or Decline an Offer

### Goal

Respond to an offer as the buyer.

### Prerequisites

- Offer exists and is still active (not expired)
- User is the offer receiver
- Channel is open

### Accept Offer

**1. Buyer clicks "Accept":**

```json
POST /api/v1/networks/offers/:offerId/accept
Authorization: Bearer <BUYER_JWT>
```

**2. Server processes:**

```typescript
// 1. Validate offer
const offer = await Offer.findById(offerId);
if (offer.state !== "CREATED") {
  throw new ValidationError("Offer is not in accepted state");
}
if (offer.expires_at < new Date()) {
  throw new ValidationError("Offer has expired");
}

// 2. Transition offer state
offer.state = "ACCEPTED";
offer.status = "accepted";
await offer.save();

// 3. Create Order (canonical document)
const order = await Order.create({
  listing_id: offer.listing_id,
  buyer_id: offer.receiver_id,
  seller_id: offer.sender_id,
  amount: offer.amount,
  status: "PENDING_PAYMENT",
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
});

// 4. Update channel
channel.last_offer.status = "accepted";
channel.order_id = order._id;
await channel.save();

// 5. Send system messages
await chatService.sendSystemMessage(
  channel.getstream_channel_id,
  { type: "offer_accepted", amount: offer.amount },
  buyerId,
);

// 6. Emit events
events.emit("order:created", { orderId: order._id });
```

**3. Response:**

```json
{
  "data": {
    "offer": { "status": "accepted" },
    "order": {
      "_id": "order_789",
      "amount": 12500,
      "status": "PENDING_PAYMENT"
    }
  }
}
```

### Decline Offer

**1. Buyer clicks "Decline":**

```json
POST /api/v1/networks/offers/:offerId/decline
Authorization: Bearer <BUYER_JWT>
```

**2. Server processes:**

```typescript
// Similar to accept, but:
offer.state = "DECLINED";
offer.status = "declined";

// Send message
await chatService.sendSystemMessage(
  channel.getstream_channel_id,
  { type: "offer_rejected" },
  buyerId,
);

// Don't create order
```

---

## How to Debug Undelivered Messages

### Goal

Identify and fix messages that aren't appearing in chat.

### Steps

**1. Check message status in database:**

```typescript
// Look up message in GetStream (if cached)
const msg = await chatService
  .getChannel(channelId)
  .then((ch) => ch.state.messages.find((m) => m.id === messageId));

if (!msg) {
  console.log("Message not in GetStream");
}
```

**2. Check channel membership:**

```typescript
// Verify user is member of channel
const channel = await NetworkListingChannel.findById(channelId);
const isMember =
  channel.buyer_id.toString() === userId ||
  channel.seller_id.toString() === userId;

if (!isMember) {
  console.log("User is not a member of this channel");
}
```

**3. Verify channel is open:**

```typescript
if (channel.status === "closed") {
  console.log("Channel is closed - cannot send messages");
}
```

**4. Check GetStream client status:**

```typescript
// Verify WebSocket is connected
if (!client.isConnected) {
  console.log("WebSocket disconnected - reconnecting...");
  await client.connectUser({ id: userId }, token);
}
```

**5. Retry sending:**

```typescript
try {
  const response = await fetch("/api/v1/networks/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      channel_id: channelId,
      text: messageText,
    }),
  });

  const result = await response.json();
  if (response.ok) {
    console.log("Message sent:", result.id);
  } else {
    console.error("Error:", result.error);
  }
} catch (error) {
  console.error("Network error:", error);
}
```

---

## How to Debug WebSocket Disconnections

### Goal

Diagnose why real-time connection is dropping.

### Steps

**1. Check token expiration:**

```javascript
const expiryTime = localStorage.getItem("getstream_token_expiry");
const isExpired = Date.now() > expiryTime;

if (isExpired) {
  console.log("Token expired - refreshing...");
  // Get new token and reconnect
  const newToken = await fetchNewToken();
  await client.connectUser({ id: userId }, newToken);
}
```

**2. Check network connectivity:**

```javascript
if (!navigator.onLine) {
  console.log("No internet connection");
  // Queue messages locally until reconnected
}

window.addEventListener("offline", () => {
  console.log("Went offline");
});

window.addEventListener("online", () => {
  console.log("Back online - reconnecting...");
  client.connectUser({ id: userId }, token);
});
```

**3. Check browser console for errors:**

```javascript
client.on("connection.changed", (event) => {
  console.log("Connection status:", event.online);
});

client.on("connection.recovered", () => {
  console.log("Connection recovered");
});

client.on("error", (error) => {
  console.error("GetStream error:", error);
});
```

**4. Manual reconnect:**

```javascript
async function reconnect() {
  try {
    console.log("Disconnecting...");
    await client.disconnectUser();

    console.log("Getting new token...");
    const { token } = await fetch("/api/v1/networks/chat/token").then((r) =>
      r.json(),
    );

    console.log("Reconnecting...");
    await client.connectUser({ id: userId }, token);

    console.log("Connected!");
  } catch (error) {
    console.error("Reconnect failed:", error);
    setTimeout(reconnect, 5000); // Retry in 5 seconds
  }
}
```

---

## How to Handle Expired Tokens

### Goal

Refresh GetStream token before it expires.

### Steps

**1. Set up auto-refresh (recommended):**

```javascript
// Refresh token 10 minutes before expiry
const TOKEN_REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes

async function startTokenRefresh() {
  setInterval(async () => {
    try {
      console.log("Refreshing token...");
      const response = await fetch("/api/v1/networks/chat/token", {
        headers: { Authorization: `Bearer ${clerkJwt}` },
      });

      const { token } = await response.json();

      // Reconnect with new token
      await client.disconnectUser();
      await client.connectUser({ id: userId }, token);

      localStorage.setItem("getstream_token", token);
      localStorage.setItem(
        "getstream_token_expiry",
        Date.now() + 60 * 60 * 1000,
      );

      console.log("Token refreshed");
    } catch (error) {
      console.error("Token refresh failed:", error);
    }
  }, TOKEN_REFRESH_INTERVAL);
}

// Start on app load
startTokenRefresh();
```

**2. Handle 401 responses:**

```javascript
client.on("error", async (error) => {
  if (error.status === 401) {
    console.log("Token expired - refreshing...");
    try {
      const { token } = await fetch("/api/v1/networks/chat/token").then((r) =>
        r.json(),
      );

      await client.connectUser({ id: userId }, token);
      console.log("Reconnected with new token");
    } catch (e) {
      console.error("Failed to refresh token:", e);
    }
  }
});
```

---

## How to Investigate Missing Webhooks

### Goal

Debug why a webhook event wasn't processed.

### Steps

**1. Check webhook delivery logs:**

```typescript
// Query webhook events in MongoDB
const events = await GetstreamWebhookEvent.find({
  eventType: "message.new",
  createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
}).sort({ createdAt: -1 });

events.forEach((e) => {
  console.log(`
    Event: ${e.eventId}
    Type: ${e.eventType}
    Status: ${e.status}
    Received: ${e.receivedAt}
    Attempts: ${e.attemptCount}
  `);
});
```

**2. Check Bull queue status:**

```typescript
// Check queued jobs
const waitingJobs = await webhookQueue.getWaiting();
const failedJobs = await webhookQueue.getFailed();

console.log("Waiting jobs:", waitingJobs.length);
console.log("Failed jobs:", failedJobs.length);

failedJobs.forEach((job) => {
  console.log(`Job ${job.id}: ${job.failedReason}`);
});
```

**3. Check GetStream webhook configuration:**

In GetStream dashboard:

- ✅ Webhook URL is correct
- ✅ Endpoint is accessible
- ✅ API configuration includes correct events
- ✅ No IP restrictions blocking the request

**4. Enable debug logging:**

```typescript
logger.info 'Webhook received', {
  eventId: req.headers['x-webhook-id'],
  eventType: req.body.type,
  signature: req.headers['x-signature'] ? '[PRESENT]' : '[MISSING]'
});
```

**5. Manually retry a failed webhook:**

```typescript
// Find failed event
const failedEvent = await GetstreamWebhookEvent.findOne({
  eventId: "getstream_msg_123",
  status: "failed",
});

if (failedEvent) {
  // Requeue
  await webhookQueue.add({
    eventId: failedEvent.eventId,
    type: failedEvent.eventType,
    payload: failedEvent.payload,
  });

  // Update status
  failedEvent.status = "pending";
  await failedEvent.save();

  console.log("Event requeued for processing");
}
```

---

# API Reference

## Authentication

### Get Chat Token

```
GET /api/v1/networks/chat/token
Authorization: Bearer <CLERK_JWT>
```

**Response (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user_36IcC3uo7Ch1Go4qYTZexUeWoZM",
  "apiKey": "b5z5jt844r2xf"
}
```

**Errors:**

- `401 Unauthorized` - Invalid or missing JWT
- `404 Not Found` - User not found in MongoDB

---

## Chat Channels

### Create or Get Channel

```
POST /api/v1/networks/chat/channel
Authorization: Bearer <CLERK_JWT>
Content-Type: application/json

{
  "listing_id": "lst_001",
  "seller_id": "seller_001",
  "listing_title": "Rolex Submariner",
  "listing_price": 14500,
  "listing_thumbnail": "https://..."
}
```

**Response (200 OK):**

```json
{
  "channelId": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "channel": {
    "id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "type": "messaging",
    "cid": "messaging:a1b2c3d4e5f6...",
    "listing_id": "lst_001",
    "members": ["buyer_001", "seller_001"],
    "created_at": "2026-03-27T10:30:00Z"
  }
}
```

**Errors:**

- `400 Bad Request` - Missing required fields or self-messaging
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Seller not found

### Get User Channels

```
GET /api/v1/networks/chat/channels?limit=20&offset=0
Authorization: Bearer <CLERK_JWT>
```

**Response (200 OK):**

```json
{
  "channels": [
    {
      "id": "a1b2c3d4e5f6...",
      "type": "messaging",
      "cid": "messaging:a1b2c3d4e5f6...",
      "listing_id": "lst_001",
      "listing_title": "Rolex Submariner",
      "listing_price": 14500,
      "members": ["buyer_001", "seller_001"],
      "last_message_at": "2026-03-27T15:30:00Z",
      "unread_count": 2
    }
  ],
  "limit": 20,
  "offset": 0
}
```

### Get Unread Counts

```
GET /api/v1/networks/chat/unread
Authorization: Bearer <CLERK_JWT>
```

**Response (200 OK):**

```json
{
  "channels": [
    {
      "cid": "messaging:a1b2c3d4e5f6...",
      "unread_count": 2
    }
  ]
}
```

---

## Messages

### Send Message

```
POST /api/v1/networks/messages/send
Authorization: Bearer <CLERK_JWT>
Content-Type: application/json

{
  "channel_id": "messaging:a1b2c3d4e5f6...",
  "text": "Is this still available?",
  "type": "regular",
  "attachments": [],
  "custom_data": {}
}
```

**Valid Types:**

- `regular` - Plain text conversation
- `inquiry` - Question about listing
- `offer` - Price proposal
- `counter_offer` - Response to offer
- `offer_accepted` - Buyer accepted offer
- `offer_rejected` - Buyer rejected offer
- `order_created` - Order initiated
- `order_paid` - Payment confirmed
- `order_shipped` - Item sent
- `order_delivered` - Item received
- `system` - Internal notification
- `image`, `file`, `link` - Media messages

**Response (200 OK):**

```json
{
  "id": "msg_abc123",
  "channel_id": "messaging:a1b2c3d4e5f6...",
  "text": "Is this still available?",
  "user_id": "buyer_001",
  "created_at": "2026-03-27T15:30:00Z",
  "status": "delivered"
}
```

**Errors:**

- `400 Bad Request` - Missing text/attachments or invalid type
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not a channel member
- `404 Not Found` - Channel not found

### Get Message History

```
GET /api/v1/networks/messages/channel/:channelId?limit=50&offset=0
Authorization: Bearer <CLERK_JWT>
```

**Query Parameters:**

- `limit` - Max messages (min: 1, max: 100, default: 20)
- `offset` - For pagination (default: 0)

**Response (200 OK):**

```json
{
  "messages": [
    {
      "id": "msg_001",
      "text": "Is this still available?",
      "sender_id": "buyer_001",
      "created_at": "2026-03-27T10:30:00Z",
      "type": "regular",
      "status": "read"
    }
  ],
  "hasMore": true
}
```

### Mark Message as Read

```
POST /api/v1/networks/messages/:messageId/read
Authorization: Bearer <CLERK_JWT>
```

**Response (200 OK):**

```json
{ "success": true }
```

### Mark Channel as Read

```
POST /api/v1/networks/messages/channel/:channelId/read-all
Authorization: Bearer <CLERK_JWT>
```

### Delete Message

```
DELETE /api/v1/networks/messages/:messageId
Authorization: Bearer <CLERK_JWT>
```

### React to Message

```
POST /api/v1/networks/messages/:messageId/react
Authorization: Bearer <CLERK_JWT>
Content-Type: application/json

{ "emoji": "👍" }
```

---

## Conversations

### Get All Conversations

```
GET /api/v1/networks/conversations?limit=20&offset=0
Authorization: Bearer <CLERK_JWT>
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "messaging:a1b2c3d4e5f6...",
      "type": "messaging",
      "listing_id": "lst_001",
      "listing_title": "Rolex Submariner",
      "listing_price": 14500,
      "members": ["buyer_001", "seller_001"],
      "last_message": {
        "id": "msg_xyz",
        "text": "Sounds good!",
        "created_at": "2026-03-27T15:30:00Z"
      },
      "unread_count": 0,
      "created_at": "2026-03-27T10:30:00Z"
    }
  ],
  "limit": 20,
  "offset": 0,
  "total": 5,
  "_metadata": {
    "limit": 20,
    "offset": 0,
    "total": 5
  }
}
```

### Search Conversations

```
GET /api/v1/networks/conversations/search?q=rolex
Authorization: Bearer <CLERK_JWT>
```

**Searches in:**

- Listing titles
- Listing descriptions
- Message text

### Get Conversation Context

```
GET /api/v1/networks/conversations/:conversationId
Authorization: Bearer <CLERK_JWT>
```

**Response (200 OK):**

```json
{
  "data": {
    "id": "messaging:a1b2c3d4e5f6...",
    "participants": [
      {
        "id": "buyer_001",
        "name": "John Buyer",
        "avatar": "https://..."
      },
      {
        "id": "seller_001",
        "name": "Jane Seller",
        "avatar": "https://..."
      }
    ],
    "listing": { ... },
    "recent_messages": [ ... ],
    "context": {
      "last_offer": { ... },
      "order": { ... }
    }
  }
}
```

### Get Shared Media

```
GET /api/v1/networks/conversations/:conversationId/media?type=media&limit=20
Authorization: Bearer <CLERK_JWT>
```

**Type Options:**

- `media` - Images and videos
- `files` - Documents
- `links` - Shared URLs

---

## Inquiries

### Create Inquiry

```
POST /api/v1/networks/listings/:listingId/inquire
Authorization: Bearer <CLERK_JWT>
Content-Type: application/json

{ "message": "Is this still available?" }
```

**Response (201 Created):**

```json
{
  "data": {
    "_id": "channel_123",
    "listing_id": "lst_001",
    "buyer_id": "buyer_001",
    "seller_id": "seller_001",
    "status": "open",
    "inquiries": [
      {
        "sender_id": "buyer_001",
        "message": "Is this still available?",
        "createdAt": "2026-03-27T10:30:00Z"
      }
    ]
  }
}
```

---

## Offers

### Send Offer

```
POST /api/v1/networks/listings/:listingId/offers
Authorization: Bearer <CLERK_JWT>
Content-Type: application/json

{
  "amount": 12500,
  "message": "Would you accept this?",
  "shipping_region": "CA",
  "request_free_shipping": false
}
```

**Response (201 Created):**

```json
{
  "data": {
    "channel": { ... },
    "offer": {
      "_id": "offer_456",
      "amount": 12500,
      "status": "sent",
      "expires_at": "2026-03-29T10:30:00Z"
    }
  }
}
```

### Accept Offer

```
POST /api/v1/networks/offers/:offerId/accept
Authorization: Bearer <CLERK_JWT>
```

**Response (200 OK):**

```json
{
  "data": {
    "offer": { "status": "ACCEPTED" },
    "order": {
      "_id": "order_789",
      "amount": 12500,
      "status": "PENDING_PAYMENT"
    }
  }
}
```

### Decline Offer

```
POST /api/v1/networks/offers/:offerId/decline
Authorization: Bearer <CLERK_JWT>
```

---

# Data Models & Schemas

## NetworkListingChannel (MongoDB)

**Purpose:** Stores buyer-seller channel data with commerce context

```typescript
{
  _id: ObjectId,

  // References
  listing_id: ObjectId,
  buyer_id: ObjectId,
  seller_id: ObjectId,
  order_id: ObjectId | null,

  // GetStream integration
  getstream_channel_id: string,  // Deterministic hash

  // Status
  status: "open" | "closed",
  created_from: "inquiry" | "offer" | "order",
  last_event_type: "inquiry" | "offer" | "order" | null,

  // Snapshots (immutable at time of creation)
  buyer_snapshot: {
    _id: ObjectId,
    name: string,
    avatar: string | null
  },
  seller_snapshot: {
    _id: ObjectId,
    name: string,
    avatar: string | null
  },
  listing_snapshot: {
    brand: string,
    model: string,
    reference: string,
    price: number,
    condition: string | null,
    thumbnail: string | null
  },

  // Conversation history
  inquiries: [{
    sender_id: ObjectId,
    message: string,
    createdAt: Date
  }],

  offer_history: [{
    _id: ObjectId,
    sender_id: ObjectId,
    amount: number,
    message: string | null,
    status: "sent" | "accepted" | "declined" | "superseded",
    expiresAt: Date,
    createdAt: Date
  }],

  last_offer: {
    sender_id: ObjectId,
    amount: number,
    message: string | null,
    status: "sent" | "accepted" | "declined",
    expiresAt: Date
  } | null,

  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

- `(buyer_id, seller_id)` - Unique index for user-to-user uniqueness
- `getstream_channel_id` - For lookup by GetStream ID
- `status` - For filtering open/closed channels

## GetstreamWebhookEvent (MongoDB)

**Purpose:** Stores raw webhook events for audit trail and idempotency

```typescript
{
  _id: ObjectId,

  // Event identification
  eventId: string,            // X-Webhook-Id header
  eventType: string,          // "message.new", "reaction.new", etc.

  // Raw data
  payload: any,               // Full GetStream payload
  headers: Record<string, string>,

  // Processing status
  status: "pending" | "processing" | "processed" | "failed",
  error: string | null,
  attemptCount: number,

  // Timestamps
  receivedAt: Date,
  processedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

- `eventId` - Unique, for idempotency
- `status` - For finding pending/failed events
- `eventType` - For event type filtering
- `(status, receivedAt)` - For query optimization

## Offer (MongoDB)

**Canonical offer record (shared across platforms)**

```typescript
{
  _id: ObjectId,

  // Listing & parties
  listing_id: ObjectId,
  channel_id: ObjectId,
  sender_id: ObjectId,        // Who made the offer
  receiver_id: ObjectId,      // Who receives the offer

  // Amount & terms
  amount: number,
  message: string | null,
  reservation_terms: any | null,
  shipping_region: string | null,
  request_free_shipping: boolean,

  // Status
  state: "CREATED" | "COUNTERED" | "ACCEPTED" | "DECLINED" | "EXPIRED",
  status: "sent" | "accepted" | "declined" | "superseded",

  // Expiration
  expires_at: Date,

  // Platform
  platform: "networks" | "marketplace",

  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

## Order (MongoDB)

**Canonical order record after offer acceptance**

```typescript
{
  _id: ObjectId,

  // References
  listing_id: ObjectId,
  offer_id: ObjectId,
  channel_id: ObjectId,
  buyer_id: ObjectId,
  seller_id: ObjectId,

  // Order details
  amount: number,

  // Status
  status: "PENDING_PAYMENT" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED",

  // Fulfillment
  tracking_number: string | null,
  carrier: string | null,

  // Timestamps
  createdAt: Date,
  updatedAt: Date,
  expires_at: Date
}
```

---

# Configuration & Setup

## Environment Variables

**GetStream Configuration:**

```
GETSTREAM_API_KEY=b5z5jt844r2xf
GETSTREAM_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GETSTREAM_APP_ID=1234567
```

**Database:**

```
MONGODB_URI=mongodb://localhost:27017/dialist
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Server:**

```
PORT=3000
NODE_ENV=development
```

## GetStream Setup

**1. Create GetStream App**

- Go to https://getstream.io/
- Create account and app
- Get API key and secret

**2. Configure Webhook**

In GetStream dashboard:

- Go to **Webhooks**
- Add webhook URL: `https://api.dialist.app/api/v1/webhooks/getstream`
- Subscribe to event types:
  - `message.new`
  - `message.updated`
  - `message.deleted`
  - `message.read`
  - `channel.created`
  - `channel.updated`
  - `reaction.new`
  - `reaction.deleted`

**3. Test Webhook**

```bash
curl -X POST https://api.dialist.app/api/v1/webhooks/getstream \
  -H "Content-Type: application/json" \
  -H "X-Signature: test" \
  -d '{ "type": "test_event" }'
```

## Redis & Bull Queue Setup

**1. Install Redis**

```bash
# macOS
brew install redis

# Ubuntu
sudo apt-get install redis-server
```

**2. Start Redis**

```bash
redis-server
```

**3. Verify connection**

```bash
redis-cli ping
# Output: PONG
```

## Running the System

**1. Start MongoDB**

```bash
mongod
```

**2. Start Redis**

```bash
redis-server
```

**3. Start backend**

```bash
npm run dev
```

**4. Start webhook processor worker**

The worker starts automatically when the server boots:

```typescript
// In src/index.ts
import { startWebhookWorker } from "./workers/webhookProcessor";
startWebhookWorker();
```

---

# Deep Dives: How It Works

## The Complete Inquiry Journey

### Step-by-Step Flow

**Timeline:**

```
T+0s   Buyer views listing
T+1s   Buyer clicks "Inquire"
       ↓
T+1.1s POST /api/v1/networks/listings/:id/inquire
       ↓ [Server validation]
T+1.2s Search for existing user-to-user channel
       Result: Not found (new channel)
       ↓
T+1.3s Create GetStream channel
       - ID: MD5_HASH(buyer + seller)
       - Members: [buyer_id, seller_id]
       - Metadata: listing info
       ↓
T+1.4s Create MongoDB document (NetworkListingChannel)
       ↓
T+1.5s Send system message to GetStream
       Message text: "Is this still available?"
       ↓
T+1.6s Response returns to client
       channelId: "a1b2c3d4..."
       ↓
T+1.7s Buyer's WebSocket receives confirmation
       ✓ Channel ready for messaging
       ↓
[Network latency: ~50-500ms for webhook]
       ↓
T+2.1s GetStream webhook sent to backend:
       POST /api/v1/webhooks/getstream
       type: "message.new"
       ↓ [HMAC verified, idempotency checked]
T+2.2s Raw event persisted to MongoDB
       ↓
T+2.3s Job enqueued to Bull queue
       ↓
T+2.4s Response 200 OK sent to GetStream
       (async processing continues)
       ↓
T+2.5s Worker picks up job from queue
       ↓
T+2.6s Update user stats (message_count++)
       Emit events for integration
       ↓
T+2.7s Mark webhook as processed
       ✓ Async chain complete
       ↓
[Seller's client checks for new messages]
       ↓
T+5.0s Seller opens app
       WebSocket subscribed to channels
       ↓
T+5.1s GetStream sends queued messages:
       message.new event for inquiry
       ↓
T+5.2s Seller's UI updates
       - Chat inbox shows new message
       - Badge: +1 unread
       - Notification toast
       ↓
T+5.3s Seller reads inquiry message
       Clicks "Reply with Offer"
       ↓
T+5.4s POST /api/v1/networks/listings/:id/offers
       amount: 13000
       ↓
[Full offer processing begins...]
```

### Key Architectural Decisions

**1. User-to-User Channels (not Listing-to-User)**

```
WRONG (Listing-to-User):
  Channel per listing per buyer
  Buyer inquires 5 listings → 5 separate conversations

CORRECT (User-to-User):
  One channel per buyer-seller pair
  Multiple listing contexts in same conversation
  Listing metadata stored as channel data
```

**Why?**

- ✅ Maintains conversation history
- ✅ Cleaner UX
- ✅ Better relationship context
- ✅ Supports multiple listing discussions

**2. Deterministic Channel IDs**

```
Why hash?
  MD5_HASH(buyerId + sellerId)

Benefits:
  ✅ Same input = same ID (idempotent)
  ✅ No UUID collisions
  ✅ Repeatable (useful for migrations)
  ✅ Fits GetStream 64-char limit
```

**3. Dual Storage (MongoDB + GetStream)**

```
MongoDB Stores:
  ✅ Business logic (offers, orders)
  ✅ User snapshots (for immutability)
  ✅ Listing context (schema structured)
  ✅ Audit trail (who did what)

GetStream Stores:
  ✅ Real-time message delivery
  ✅ WebSocket persistence
  ✅ Read receipts
  ✅ Presence (online/offline)

Sync:
  MongoDB ← GetStream (via webhook processor)
```

**4. Async Webhook Processing**

```
Synchronous (BAD):
  POST /webhook
    → Process immediately
    → Takes 2-5 seconds
    → If slow: GetStream retries (worst!)

Asynchronous (GOOD):
  POST /webhook
    → Validate signature (10ms)
    → Check idempotency (5ms)
    → Enqueue job (5ms)
    → Return 200 OK (30ms total)

  Worker (async, background):
    → Process at own pace
    → Retries with exponential backoff
    → No blocking impact
```

---

## Authentication & Token Management

### JWT Flow Overview

```
Clerk Issues JWT
  ├─ Standard JWT format
  ├─ HS256 or RS256 signature
  ├─ Contains: userId, email, metadata
  └─ Expiry: ~1 hour

Frontend sends JWT
  ├─ With every API request
  ├─ Header: Authorization: Bearer <JWT>
  └─ Over HTTPS only

Backend validates JWT
  ├─ Signature verification (using Clerk public key)
  ├─ Expiry check
  ├─ Extract userId
  └─ Attach to req.auth

Server generates GetStream token
  ├─ Uses userId (MongoDB ID)
  ├─ Signed with GetStream secret
  ├─ 1-hour expiry
  └─ Sent to client

Frontend connects to GetStream
  ├─ Uses GetStream token (not Clerk JWT)
  ├─ WebSocket establishes
  └─ Real-time ready
```

### Why Two Tokens?

```
Clerk JWT:
  ✅ User authentication (who are you?)
  ❌ Not trusted by GetStream

GetStream Token:
  ✅ Trusted by GetStream
  ✅ Proves you have valid Clerk JWT
  ❌ Only valid for 1 hour
  ❌ Must be constantly refreshed
```

---

## Real-Time Communication Model

### WebSocket Event Types

**Automatic (user doesn't explicitly send):**

```
typing.start
  │ User presses key
  │ Channel emits event
  └─→ Others see "User is typing..."

typing.stop
  │ User stops typing for 3 seconds
  │ Channel emits event
  └─→ Typing indicator disappears

user.presence.changed
  │ User comes online or goes offline
  │ Client emits event
  └─→ Others see online status

message.read
  │ Receiver reads message
  │ Client calls channel.markRead()
  │ GetStream fires webhook
  └─→ Sender gets read receipt
```

**Triggered by API calls:**

```
message.new
  │ API call: POST /messages/send
  │ GetStream stores message
  │ WebSocket subscribers get event
  └─→ Message appears in UI

message.updated
  │ API call: PUT /messages/:id
  │ GetStream updates message
  │ WebSocket event fired
  └─→ Message text changed in UI

message.deleted
  │ API call: DELETE /messages/:id
  │ GetStream marks deleted
  │ WebSocket event fired
  └─→ Message removed from UI

reaction.new
  │ API call: POST /messages/:id/react
  │ GetStream stores reaction
  │ WebSocket event fired
  └─→ Emoji appears on message

channel.updated
  │ Channel metadata changes
  │ GetStream fires event
  └─→ Channel info updates
```

### Message Lifecycle States

```
DRAFT (client only)
  │ User composing message
  │ Not sent yet
  └─ No submission

SENT
  │ User clicks send
  │ API receives message
  │ Saved to MongoDB
  └─ Response: { status: "sent" }

DELIVERED
  │ Posted to GetStream
  │ WebSocket delivery started
  │ Receiver notified
  └─ Via: message.new webhook

READ
  │ Receiver opened message
  │ Called: channel.markRead()
  │ GetStream recorded read
  └─ Sender sees read receipt

States across platforms:
  HTML5: message.read()
  Native: message.markRead()
  Web: channel.getState().reads[userId]
```

---

## Webhook & Event Architecture

### Three-Tier Webhook Processing

```
TIER 1: Validation & Acceptance (Fast Path)
  │
  ├─ 1. Signature verification (HMAC-SHA256)
  │ ├─ Extract X-Signature header
  │ ├─ Get raw request body
  │ ├─ Compute HMAC using GetStream secret
  │ └─ Compare: submitted vs. computed
  │     ┌─ Match: ✅ Continue
  │     └─ No match: ❌ Return 401
  │
  ├─ 2. Idempotency check
  │ ├─ Extract X-Webhook-Id header
  │ ├─ Query MongoDB: GetstreamWebhookEvent.findOne({ eventId })
  │ ├─ If found & status === "processed": Return 200 (skip)
  │ └─ If not found: Continue to persist
  │
  ├─ 3. Persist raw event
  │ ├─ Save to GetstreamWebhookEvent collection
  │ ├─ Status: "pending"
  │ ├─ Store: eventId, eventType, payload, headers
  │ └─ Index for quick lookup
  │
  ├─ 4. Enqueue job
  │ ├─ Add to Bull Redis queue
  │ ├─ Queue name: "webhook-processing"
  │ ├─ Max attempts: 10
  │ └─ Exponential backoff: 2s → 4s → 8s...
  │
  └─ 5. Response (fast)
    ├─ Move to next request
    ├─ Return 200 OK (<100ms target)
    └─ Processing continues async

═══════════════════════════════════════════════════════════════

TIER 2: Async Processing (Worker)
  │
  ├─ Worker monitors Bull queue
  │ ├─ Pulls job from queue
  │ ├─ Acquires job lock
  │ └─ Begins processing
  │
  ├─ Update status
  │ ├─ Set: status = "processing"
  │ ├─ Save attempt count
  │ └─ Record timestamp
  │
  ├─ Dispatch by event type
  │ ├─ message.new → handleMessageNew()
  │ ├─ message.read → handleMessageRead()
  │ ├─ reaction.new → handleReaction()
  │ ├─ channel.* → handleChannelEvent()
  │ └─ [other types]
  │
  ├─ Execute business logic
  │ ├─ Update user stats
  │ ├─ Update listings (analytics)
  │ ├─ Emit events for integration
  │ └─ Call external services if needed
  │
  └─ Mark completion
    ├─ SUCCESS:
    │ ├─ Set: status = "processed"
    │ ├─ Record processedAt timestamp
    │ ├─ Remove from queue
    │ └─ Done
    │
    └─ FAILURE:
      ├─ Throw error
      ├─ Bull catches error
      ├─ Increment attempt count
      ├─ Calculate backoff: 2000 * Math.pow(2, attempt - 1)
      ├─ Schedule retry
      └─ If attempt >= 10: Mark status = "failed"

═══════════════════════════════════════════════════════════════

TIER 3: Monitoring & Retry
  │
  ├─ Bull events
  │ ├─ webhookQueue.on('completed', ...)
  │ ├─ webhookQueue.on('failed', ...)
  │ ├─ webhookQueue.on('stalled', ...)
  │ └─ webhookQueue.on('active', ...)
  │
  ├─ Logging
  │ ├─ Record success/failure
  │ ├─ Log processing time
  │ ├─ Track retry attempts
  │ └─ Alert if max attempts exceeded
  │
  └─ Manual intervention (if needed)
    ├─ Query failed jobs
    ├─ Inspect error
    ├─ Fix root cause
    └─ Requeue manually
```

---

## Offer Flow & Commerce Integration

### Complete Offer State Machine

```
Initial State: NO OFFER
  │
  └─→ POST /listings/:id/offers
      (Seller sends offer)
      │
      └─→ Offer.state: "CREATED"
         Offer.status: "sent"
         ExpiresAt: now + 48 hours
         │
         ├─→ [Offer expires]
         │   └─→ Offer.state: "EXPIRED"
         │       Webhook: offer_expired
         │       Message: "Offer expired"
         │
         ├─→ POST /offers/:id/decline
         │   (Buyer declines)
         │   └─→ Offer.state: "DECLINED"
         │       Message: "Offer declined"
         │       Back to: NO OFFER
         │
         └─→ POST /offers/:id/accept
             (Buyer accepts)
             │
             └─→ Offer.state: "ACCEPTED"
                Order.create()
                Order.status: "PENDING_PAYMENT"
                Channel.order_id = order._id
                Message: "💰 Offer accepted!"
                │
                └─→ [Payment processing]
                    │
                    ├─ Via Finix webhook
                    ├─ Webhook: transfer created
                    ├─ Order.status: "PAID"
                    └─ Message: "Payment received"
                       │
                       └─→ [Seller ships]
                           │
                           └─→ POST /orders/:id/ship
                               Order.status: "SHIPPED"
                               Message: "Order shipped"
                               │
                               └─→ [Buyer receives]
                                   │
                                   └─→ POST /orders/:id/complete
                                       Order.status: "DELIVERED"
                                       Message: "Order complete"
                                       │
                                       └─→ [Party interactions end]
                                          Channel.status: "closed"
```

### Why Offers Expire

```
Problem:
  Seller makes offer at T=0
  Buyer doesn't respond for 2 weeks
  Seller changes mind
  Item is sold
  Buyer accepts old offer
  → Conflict!

Solution: Expiration
  Offer expires after 48 hours
  Buyer must accept within window
  After expiry:
    ├─ Offer.state: "EXPIRED"
    ├─ Cannot be accepted
    └─ Seller can make new offer
```

---

## Error Handling & Resilience

### Graceful Degradation Scenarios

**Scenario 1: GetStream is Down**

```
Normal path:
  POST /messages/send
    ├─ Create in GetStream
    └─ WebSocket delivery

When GetStream is down:
  POST /messages/send
    ├─ Attempt GetStream call → FAILS
    ├─ Message already saved to MongoDB
    ├─ Return response with queued_for_sync: true
    ├─ Client shows: "Message sent (pending sync)"
    └─ Retry mechanism (background):
        └─ When GetStream recovers:
           ├─ Query pending messages
           ├─ Batch sync to GetStream
           └─ Mark synced
```

**Scenario 2: Redis/Bull Queue Down**

```
Normal path:
  Webhook received
    ├─ Validate
    ├─ Enqueue to Bull
    ├─ Return 200 OK
    └─ Worker processes

When Redis is down:
  Webhook received
    ├─ Validate
    ├─ Attempt enqueue → FAILS
    ├─ Log error (alert ops)
    ├─ Persist to GetstreamWebhookEvent with status="pending"
    ├─ Return 200 OK (so GetStream doesn't retry)
    └─ Manual recovery:
        ├─ Redis comes back online
        ├─ Query pending events
        ├─ Re-enqueue
```

**Scenario 3: Database Connection Lost**

```
During webhook processing:
  Worker picks up job
    ├─ Attempt DB operations → FAILS
    ├─ Catch error
    ├─ Throw error (Bull logs it)
    ├─ Schedule retry with backoff
    └─ After 2s: Retry attempt 2
       (By then, connection hopefully restored)
```

### Idempotency Pattern

```
Why needed?
  GetStream webhook sent
  Network timeout (500ms)
  GetStream doesn't receive 200 OK response
  GetStream retries (send same event again)
  → Would be processed twice!

Solution: Idempotency check

Webhook handler:
  1. Extract eventId from X-Webhook-Id header
  2. Query MongoDB: GetstreamWebhookEvent.findOne({ eventId })
  3. If exists:
     ├─ If status === "processed":
     │  └─ Return 200 OK (skip reprocessing)
     └─ If status === "pending" or "processing":
        └─ Return 200 OK (already queued)
  4. If not exists:
     └─ Continue with normal flow

Result:
  ✅ Event processed exactly once
  ✅ Safe to retry without side effects
  ✅ No duplicate messages, duplicate stats updates, etc.
```

---

## Best Practices

### For Frontend Developers

1. **Always refresh token before expiry**
   - Token expires every 1 hour
   - Refresh at 50-minute mark
   - Don't wait for 401 error

2. **Handle disconnections gracefully**
   - Listen to `connection.changed` events
   - Auto-reconnect with exponential backoff
   - Show "offline" UI state

3. **Validate membership before messaging**
   - Check if user is still member of channel
   - Verify channel is not closed
   - Catch 403 Forbidden errors

4. **Batch read receipts**
   - Don't call markRead() for every message
   - Mark all as read when user closes chat
   - Reduces API calls

### For Backend Developers

1. **Always validate HMAC signatures**
   - Never trust webhook source without verification
   - Use Stream SDK's verifyWebhook()
   - Return 401 for invalid signatures

2. **Implement idempotency**
   - Store eventId in database
   - Check before processing
   - Safe to replay webhooks

3. **Use async for webhooks**
   - Never process synchronously
   - Use Bull queue or similar
   - Return 200 OK <200ms
   - Process in background worker

4. **Log everything**
   - Webhook timing (received, enqueued, processed)
   - Processing duration
   - Errors and retries
   - Helps debug production issues

### For DevOps/SRE

1. **Monitor webhook processing**
   - Queue length (alert if > 100 jobs)
   - Failed jobs (alert immediately)
   - Processing latency (alert if > 5s)

2. **Set up alerts for common failures**
   - GetStream connection errors
   - Redis connection errors
   - MongoDB write failures
   - Webhook processing timeouts

3. **Regular backups**
   - BackupGetstreamWebhookEvent collection
   - Backup MongoDB (for audit trail)
   - Store backups in separate region

4. **Load testing**
   - Test webhook throughput
   - Test message throughput
   - Identify bottlenecks
   - Plan capacity scaling

---

# Error Handling & Troubleshooting

## Common Errors & Solutions

### 401 Unauthorized - Invalid Token

**Symptoms:**

- Chat operations return 401
- WebSocket connection fails

**Root Causes:**

1. Clerk JWT invalid or expired
2. GetStream token expired
3. User session ended

**Solutions:**

```typescript
// Refresh token
const response = await fetch("/api/v1/networks/chat/token", {
  headers: { Authorization: `Bearer ${clerkJwt}` },
});
const { token } = await response.json();

// Reconnect
await client.connectUser({ id: userId }, token);
```

### 403 Forbidden - Not a Channel Member

**Symptoms:**

- Cannot send message
- Cannot load message history
- User appears to lose access suddenly

**Root Causes:**

1. User was removed from channel
2. Channel was transferred to different user
3. Buyer-seller relationship ended (refund, dispute)

**Solutions:**

```typescript
// Check membership
const channel = await NetworkListingChannel.findById(channelId);
const isMember =
  channel.buyer_id.toString() === userId ||
  channel.seller_id.toString() === userId;

if (!isMember) {
  // Reload channels list
  const userChannels = await fetch("/api/v1/networks/chat/channels", {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
}
```

### 404 Not Found - Channel or Listing Not Found

**Symptoms:**

- Cannot create inquiry
- Channel ID is invalid
- 404 error on chat operations

**Root Causes:**

1. Listing was deleted
2. Channel ID is incorrect
3. User trying to access another user's channel

**Solutions:**

```typescript
// Validate listing exists
const listing = await fetch(`/api/v1/networks/listings/${listingId}`, {
  headers: { Authorization: `Bearer ${token}` },
});

if (listing.status === 404) {
  console.log("Listing not found or deleted");
}
```

### Undelivered Messages

**Symptoms:**

- Message sent but doesn't appear
- No real-time notification received
- Message appears after page refresh

**Diagnosis:**

```bash
# 1. Check message in GetStream
# Use GetStream API/Dashboard to verify message exists

# 2. Verify WebSocket connection
javascript:
  console.log(client.isConnected);  // Should be true

# 3. Check channel state
javascript:
  console.log(channel.state.messages);  // Should include your message

# 4. Query MongoDB
db.getCollection('chatmessages').find({ _id: ObjectId(...) })
```

**Common Causes & Fixes:**

1. **WebSocket disconnected**

   ```javascript
   // Auto-reconnect
   if (!client.isConnected) {
     await client.connectUser({ id: userId }, token);
   }
   ```

2. **User not member of channel**

   ```typescript
   // Verify membership
   await channelService.verifyMembership(channelId, userId);
   ```

3. **Channel closed**
   ```typescript
   // Check status
   if (channel.status === "closed") {
     throw new Error("Channel is closed");
   }
   ```

### Webhook Processing Failures

**Symptoms:**

- Webhooks not being processed
- Stats not being updated
- Messages visible in GetStream but not reflected in app

**Diagnosis:**

```typescript
// Check webhook event status
const event = await GetstreamWebhookEvent.findOne({
  eventId: "getstream_msg_123",
});

console.log({
  eventId: event.eventId,
  status: event.status,
  attemptCount: event.attemptCount,
  error: event.error,
});
```

**Common Causes & Fixes:**

1. **HMAC signature invalid**

   ```
   ❌ GetStream sent webhook with invalid signature
   ✅ Check: GETSTREAM_API_SECRET is correct
   ✅ Verify: Using raw body, not parsed JSON
   ```

2. **Duplicate event (already processed)**

   ```
   ✅ This is normal! Webhook handler returns 200 OK
   ✅ Idempotency prevents duplicate processing
   ```

3. **Bull queue stuck**

   ```bash
   # Check queue status
   redis-cli
   > KEYS "bull:webhook-processing:*"

   # Check job status
   > HGETALL "bull:webhook-processing:jobs:1"
   ```

4. **Worker process not running**

   ```bash
   # Verify worker started
   ps aux | grep node

   # Check logs for: "[Worker] Webhook processor worker started"
   ```

### WebSocket Disconnection Issues

**Symptoms:**

- No real-time message delivery
- Typing indicators don't appear
- User appears offline to others

**Diagnosis:**

```javascript
// Check connection status
console.log("Connected:", client.isConnected);
console.log("User ID:", client.userID);

// Listen to connection events
client.on("connection.changed", (event) => {
  console.log("Connection changed:", event.online ? "online" : "offline");
});

client.on("connection.recovered", () => {
  console.log("Connection recovered");
});

client.on("error", (error) => {
  console.error("GetStream error:", error);
});
```

**Common Causes & Fixes:**

1. **Network failure**

   ```javascript
   // Browser will auto-reconnect
   // Check: window.navigator.onLine
   ```

2. **Token expired**

   ```javascript
   // Auto-refresh token before expiry
   // Refresh at 50-minute mark (token is 1 hour)
   ```

3. **GetStream service down**
   ```
   ✅ GetStream posts status at: https://status.getstream.io/
   ✅ Wait for service recovery
   ✅ Messages queue locally until connection restored
   ```

---

## Monitoring & Debugging

### Key Metrics to Monitor

**Real-Time Metrics:**

- Message delivery latency (target: <100ms)
- WebSocket connection success rate (target: >99.9%)
- Token generation rate (should spike at user login)

**Background Job Metrics:**

- Webhook processing queue length (alert if >100)
- Failed job count (alert if >5)
- Average processing latency (target: <1s)
- Max retry count (alert if any job exceeds 5 retries)

**System Health:**

- GetStream API latency (alert if >500ms)
- MongoDB query latency (alert if >100ms)
- Redis connection availability (alert if offline)

### Debugging Commands

**Check MongoDB:**

```bash
# List all channels
db.networklist channelchannels.find().limit(10)

# Check webhook events
db.getstreamwebhookevents.find({ status: 'failed' }).limit(10)

# Count pending webhooks
db.getstreamwebhookevents.countDocuments({ status: 'pending' })
```

**Check Redis/Bull:**

```bash
redis-cli
> KEYS "bull:webhook-*"
> HGETALL "bull:webhook-processing:jobs:1"
> LLEN "bull:webhook-processing:wait"
```

**GetStream API Check:**

```bash
curl -X GET "https://api.stream-io-api.com/api/v1/channels" \
  -H "X-API-Key: YOUR_API_KEY"
```

---

## Summary

The Networks Chat System is a production-ready platform for real-time peer-to-peer commerce communication. It combines GetStream's real-time delivery with MongoDB's structured data to create a seamless experience for buyers and sellers negotiating transactions.

**Key Takeaways:**

- ✅ User-to-user channels (not listing-specific)
- ✅ Deterministic channel IDs for idempotency
- ✅ Dual storage (GetStream + MongoDB)
- ✅ Async webhook processing with retries
- ✅ Full commerce integration (offers, orders)
- ✅ Graceful degradation on failures
- ✅ Comprehensive error handling
- ✅ Monitoring and debugging tools

For questions or issues, refer back to the How-To guides or contact your platform architect.

---

**© 2026 Dialist. All Rights Reserved.**
