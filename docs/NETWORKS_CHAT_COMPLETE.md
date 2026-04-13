# Networks Chat System: Complete Documentation

**Production-Ready Guide for Real-Time Chat, GetStream Integration, & Commerce Communication**

Version: 2.0 · April 2026

---

## 📚 Documentation Structure

This documentation follows the **Diátaxis Framework** for clarity:

- **[Tutorials](#tutorials)** - Get started with step-by-step lessons
- **[How-To Guides](#how-to-guides)** - Solve specific problems
- **[Reference](#reference)** - Complete API specifications
- **[Explanation](#explanation)** - Understand how it all works

---

# ⚡ Quick Reference

The Networks Chat System enables real-time peer-to-peer messaging between buyers and sellers using **GetStream Chat**.

| Feature            | Purpose                                                 |
| ------------------ | ------------------------------------------------------- |
| **1:1 Chat**       | Buyer-seller conversations per user pair                |
| **Real-Time**      | WebSocket: <100ms delivery to all connected clients     |
| **Offers**         | Buyers/sellers send offers within chat                  |
| **Order Tracking** | Track status without leaving conversation               |
| **Webhooks**       | Async event processing (Bull Queue + Redis)             |
| **Presence**       | See who's online, typing indicators                     |
| **Message Types**  | regular, inquiry, offer, order updates, system messages |
| **Persistence**    | MongoDB + GetStream dual storage                        |

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

---

# 🎓 Tutorials

Learn the Networks Chat System through practical, step-by-step lessons.

## Tutorial 1: Your First Message (5 minutes)

**Goal:** Send and receive your first message between two users.

### Prerequisites

- Two user accounts (buyer + seller)
- Backend running locally
- Postman or curl installed

### Steps

**Step 1: Get Authentication Token**

```bash
# For the buyer
curl -X GET http://localhost:3000/api/v1/networks/chat/token \
  -H "Authorization: Bearer $BUYER_JWT"

# Save the response
export TOKEN="eyJhbGciOiJIUzI1NiIs..."
export API_KEY="b5z5jt844r2xf"
export USER_ID="user_ABC123"
```

**Step 2: Create a Chat Channel**

```bash
# Buyer initiates inquiry on a listing
curl -X POST http://localhost:3000/api/v1/networks/chat/channel \
  -H "Authorization: Bearer $BUYER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "listing_id": "lst_123"
  }'

# Response includes channelId
export CHANNEL_ID="messaging:65a1b2c3d4e5f6g7h8i9j0"
```

**Step 3: Send a Message**

```bash
# Buyer sends message via API (NOT via GetStream SDK)
curl -X POST http://localhost:3000/api/v1/networks/messages/send \
  -H "Authorization: Bearer $BUYER_JWT" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel_id\": \"$CHANNEL_ID\",
    \"text\": \"Is this Rolex still available?\",
    \"type\": \"inquiry\"
  }"

# Response: Message saved to MongoDB + delivered to GetStream
```

**Step 4: Connect WebSocket (Frontend)**

```javascript
// Browser code
import { StreamChat } from "stream-chat";

const client = new StreamChat(API_KEY);
await client.connectUser({ id: USER_ID }, TOKEN);

const channel = client.channel("messaging", CHANNEL_ID);
await channel.watch();

// Listen for messages in real-time
channel.on("message.new", (event) => {
  console.log("New message:", event.message.text);
  // Update UI
});
```

**Step 5: Seller Responds**

```bash
# Seller gets message via WebSocket (real-time, <100ms)
# Seller can reply via API
curl -X POST http://localhost:3000/api/v1/networks/messages/send \
  -H "Authorization: Bearer $SELLER_JWT" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel_id\": \"$CHANNEL_ID\",
    \"text\": \"Yes, it's in excellent condition!\",
    \"type\": \"regular\"
  }"
```

**Result:** Both users see messages instantly via WebSocket. ✅

### Key Learning Points

- ✅ **Always use** `POST /messages/send` (backend API)
- ✅ **Never use** `channel.sendMessage()` (GetStream SDK)
- ✅ **Listen via** WebSocket for real-time updates
- ✅ **Messages saved** to MongoDB first, then delivered to GetStream
- ✅ **Webhook processes** asynchronously after delivery

---

## Tutorial 2: Send an Offer (10 minutes)

**Goal:** Create and accept an offer through chat.

### Steps

**Step 1: Seller Sends Offer**

```bash
# Seller creates offer with custom type
curl -X POST http://localhost:3000/api/v1/networks/messages/send \
  -H "Authorization: Bearer $SELLER_JWT" \
  -d '{
    "channel_id": "'$CHANNEL_ID'",
    "text": "I can accept $14,500 for this watch",
    "type": "offer",
    "custom_data": {
      "amount": 14500,
      "expires_at": "2026-03-28T10:00:00Z"
    }
  }'
```

**Step 2: Buyer Sees Offer (Real-Time)**

```javascript
// Buyer's browser (connected via WebSocket)
channel.on("message.new", (event) => {
  if (event.message.custom?.type === "offer") {
    console.log("Offer received:", event.message.custom.amount);
    // Show offer UI
  }
});
```

**Step 3: Buyer Responds with Counter-Offer**

```bash
# Buyer sends counter-offer
curl -X POST http://localhost:3000/api/v1/networks/messages/send \
  -H "Authorization: Bearer $BUYER_JWT" \
  -d '{
    "channel_id": "'$CHANNEL_ID'",
    "text": "Can you do $14,000?",
    "type": "counter_offer",
    "custom_data": {
      "amount": 14000
    }
  }'
```

**Step 4: Seller Accepts**

```bash
# Seller accepts the counter-offer
curl -X POST http://localhost:3000/api/v1/networks/messages/send \
  -H "Authorization: Bearer $SELLER_JWT" \
  -d '{
    "channel_id": "'$CHANNEL_ID'",
    "text": "Deal! I accept $14,000",
    "type": "offer_accepted",
    "custom_data": {
      "accepted_amount": 14000,
      "accepted_at": "2026-03-27T15:30:00Z"
    }
  }'
```

**Result:** Order is created, payment flow begins. ✅

---

## Tutorial 3: Group Chat for Support (15 minutes)

**Goal:** Create a support channel with multiple team members.

### Steps

**Step 1: Create Group Channel**

```bash
# Admin creates support group
curl -X POST http://localhost:3000/api/v1/networks/chat/channel \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{
    "type": "group",
    "name": "Support: Order #123 - Shipping Issue",
    "members": [
      "user_buyer_001",
      "user_seller_001",
      "user_support_001",
      "user_support_002"
    ],
    "image": "https://...",
    "description": "Discussing shipping delay"
  }'

# Returns: groupChannelId
export GROUP_CHANNEL="messaging:75b2c3d4e5f6g7h8i9j0k1"
```

**Step 2: Add Another Support Agent**

```bash
# Later, add another support member
curl -X POST \
  http://localhost:3000/api/v1/networks/chat/channel/$GROUP_CHANNEL/add-member \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{ "user_id": "user_support_003" }'
```

**Step 3: All Members Can Message**

```javascript
// All 4 members connected to group via GetStream
channel.on("message.new", (event) => {
  console.log(`${event.user.name}: ${event.message.text}`);
});

// Support agent responds
fetch("/api/v1/networks/messages/send", {
  method: "POST",
  body: JSON.stringify({
    channel_id: GROUP_CHANNEL,
    text: "We found the tracking info. It arrived at local hub.",
    type: "regular",
  }),
});
```

**Result:** All 4 users see messages in real-time. Problem solved collaboratively. ✅

---

# 📖 How-To Guides

Solve specific problems with recipes and step-by-step instructions.

## How To: Load Chat History on App Startup

**Problem:** When user opens app, you need to show previous messages.

**Solution:**

```javascript
async function loadChatHistory(channelId, userId) {
  // 1. Get all channels user is member of
  const channelsResponse = await fetch(
    "/api/v1/networks/chat/channels?limit=20&offset=0",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const { channels } = await channelsResponse.json();

  // 2. For each channel, load recent messages
  for (const channel of channels) {
    const messagesResponse = await fetch(
      `/api/v1/networks/messages/channel/${channel.id}?limit=20&offset=0`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const { messages } = await messagesResponse.json();

    // 3. Display in UI
    displayMessages(messages);
  }

  // 4. Subscribe to real-time updates
  const wsChannel = client.channel("messaging", channelId);
  await wsChannel.watch();
}
```

---

## How To: Display Unread Badge Count

**Problem:** Show number of unread messages on chat icon.

**Solution:**

```javascript
async function setupUnreadBadge() {
  // 1. Get unread counts
  const unreadResponse = await fetch("/api/v1/networks/chat/unread", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { total_unread } = await unreadResponse.json();

  // 2. Update badge
  document.getElementById("chat-badge").textContent = total_unread;

  // 3. Listen for real-time updates via WebSocket
  client.on("notification.mark_unread", (event) => {
    const newCount = event.unread_messages;
    document.getElementById("chat-badge").textContent = newCount;
  });

  // 4. Poll every 30 seconds as fallback
  setInterval(async () => {
    const response = await fetch("/api/v1/networks/chat/unread", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { total_unread } = await response.json();
    document.getElementById("chat-badge").textContent = total_unread;
  }, 30000);
}
```

---

## How To: Implement Typing Indicators

**Problem:** Show "X is typing..." feedback.

**Solution:**

```javascript
let typingTimeout;

const messageInput = document.getElementById("message-input");

messageInput.addEventListener("input", () => {
  // Start typing
  channel.keystroke();

  // Clear previous timeout
  clearTimeout(typingTimeout);

  // Stop typing after 3 seconds of no input
  typingTimeout = setTimeout(() => {
    channel.stopTyping();
  }, 3000);
});

// Listen for typing from others
channel.on("typing.start", (event) => {
  console.log(`${event.user.name} is typing...`);
  showTypingIndicator(event.user.name);
});

channel.on("typing.stop", (event) => {
  hideTypingIndicator(event.user.name);
});
```

---

## How To: Search for Messages in a Conversation

**Problem:** User wants to find past message about payment method.

**Solution:**

```javascript
async function searchMessages(channelId, searchTerm) {
  // 1. Load all messages in conversation
  const allMessages = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `/api/v1/networks/messages/channel/${channelId}?limit=50&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const { messages, has_more } = await response.json();

    allMessages.push(...messages);
    hasMore = has_more;
    offset += 50;
  }

  // 2. Client-side search (or use /conversations/search endpoint)
  const results = allMessages.filter((msg) =>
    msg.text.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // 3. Display results
  return results;
}
```

---

## How To: Handle Connection Errors

**Problem:** WebSocket disconnection, need to gracefully recover.

**Solution:**

```javascript
async function handleConnectionError() {
  client.on("connection.changed", (event) => {
    if (!event.online) {
      console.log("Disconnected from GetStream");
      showErrorBanner("Connection lost. Reconnecting...");
    } else {
      console.log("Reconnected!");
      hideErrorBanner();
    }
  });

  client.on("error", async (error) => {
    console.error("GetStream error:", error);

    if (error.status === 401) {
      // Token expired, get new one
      const tokenResponse = await fetch("/api/v1/networks/chat/token", {
        headers: { Authorization: `Bearer ${appToken}` },
      });
      const { token, userId } = await tokenResponse.json();

      // Reconnect
      await client.connectUser({ id: userId }, token);
    }
  });

  // Manual reconnect if needed
  async function manualReconnect() {
    try {
      await client.disconnectUser();
      await client.connectUser({ id: userId }, token);
      console.log("Manually reconnected");
    } catch (err) {
      console.error("Reconnect failed:", err);
    }
  }
}
```

---

# 📡 Reference

Complete technical specifications for all APIs and features.

## API Endpoints

### Authentication

**GET /api/v1/networks/chat/token**

Generate WebSocket authentication token.

```
REQUEST:
  Headers: Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "token": "eyJhbGci...",
  "userId": "user_ABC123",
  "apiKey": "b5z5jt844r2xf"
}

RESPONSE (401):
{ "error": { "message": "Unauthorized" } }
```

---

### Channels

**GET /api/v1/networks/chat/channels**

List channels user is member of.

```
REQUEST:
  GET /api/v1/networks/chat/channels?limit=20&offset=0
  Headers: Authorization: Bearer <CLERK_JWT>

QUERY PARAMS:
  limit (number): 1-50, default 20
  offset (number): pagination, default 0

RESPONSE (200):
{
  "channels": [
    {
      "id": "messaging:...",
      "type": "messaging",
      "listing_id": "lst_123",
      "listing_title": "Rolex Submariner",
      "listing_price": 15000,
      "members": ["user_1", "user_2"],
      "last_message_at": "2026-03-27T15:30:00Z",
      "unread_count": 3
    }
  ],
  "limit": 20,
  "offset": 0
}
```

---

**POST /api/v1/networks/chat/channel**

Create or retrieve buyer-seller channel (1:1 or group).

```
REQUEST:
  POST /api/v1/networks/chat/channel
  Headers: Authorization: Bearer <CLERK_JWT>

  For 1:1:
  {
    "listing_id": "lst_123"
  }

  For Group:
  {
    "type": "group",
    "name": "Support Team",
    "members": ["user_1", "user_2", "user_3"],
    "image": "https://...",
    "description": "..."
  }

RESPONSE (201):
{
  "channelId": "messaging:65a1b2c3d4e5f6g7h8i9j0",
  "channel": {
    "id": "messaging:...",
    "type": "messaging|group",
    "members": 2
  }
}

ERROR (409):
{ "error": { "message": "Channel already exists" } }
```

---

**GET /api/v1/networks/chat/unread**

Get unread message counts.

```
REQUEST:
  GET /api/v1/networks/chat/unread
  Headers: Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "total_unread": 5,
  "unread_by_channel": {
    "messaging:...": 3,
    "messaging:...": 2
  }
}
```

---

### Messages

**POST /api/v1/networks/messages/send**

Send message to channel.

```
REQUEST:
  POST /api/v1/networks/messages/send
  Headers: Authorization: Bearer <CLERK_JWT>

  {
    "channel_id": "messaging:...",
    "text": "Hello!",
    "type": "regular",
    "attachments": [/* optional */],
    "custom_data": {/* optional */},
    "parent_id": "msg_123" /* optional: for threads */
  }

MESSAGE TYPES:
  regular, inquiry, offer, counter_offer,
  offer_accepted, offer_rejected,
  order_created, order_paid, order_shipped, order_delivered,
  system, image, file, link

RESPONSE (201):
{
  "id": "msg_ABC123",
  "channel_id": "messaging:...",
  "user_id": "user_ABC123",
  "text": "Hello!",
  "type": "regular",
  "created_at": "2026-03-27T15:30:00Z",
  "status": "delivered"
}

ERROR (400):
{ "error": { "message": "channel_id and text are required" } }

ERROR (403):
{ "error": { "message": "Not a member of this channel" } }

ERROR (400):
{ "error": { "message": "Channel is closed" } }
```

---

**GET /api/v1/networks/messages/channel/:channelId**

Get message history.

```
REQUEST:
  GET /api/v1/networks/messages/channel/messaging:...?limit=20&offset=0
  Headers: Authorization: Bearer <CLERK_JWT>

QUERY PARAMS:
  limit (number): 1-100, default 20
  offset (number): pagination, default 0

RESPONSE (200):
{
  "messages": [
    {
      "id": "msg_ABC123",
      "channel_id": "messaging:...",
      "user_id": "user_ABC123",
      "user": {
        "id": "user_ABC123",
        "name": "John Doe",
        "avatar": "https://..."
      },
      "text": "Is this available?",
      "type": "inquiry",
      "created_at": "2026-03-27T15:30:00Z",
      "read_by": [
        { "user_id": "user_XYZ789", "read_at": "2026-03-27T15:35:00Z" }
      ],
      "reactions": {
        "love": [{ "user": "user_XYZ789", "created_at": "..." }]
      }
    }
  ],
  "has_more": true,
  "total": 150
}
```

---

**PUT /api/v1/networks/messages/:id**

Edit message.

```
REQUEST:
  PUT /api/v1/networks/messages/msg_ABC123
  Headers: Authorization: Bearer <CLERK_JWT>

  {
    "text": "Is this still available?",
    "attachments": [/* optional */]
  }

RESPONSE (200):
{
  "id": "msg_ABC123",
  "text": "Is this still available?",
  "updated_at": "2026-03-27T15:35:00Z"
}

ERROR (403):
{ "error": { "message": "Can only edit your own messages" } }

ERROR (400):
{ "error": { "message": "Cannot edit messages older than 24 hours" } }
```

---

**DELETE /api/v1/networks/messages/:id**

Delete message (soft delete).

```
REQUEST:
  DELETE /api/v1/networks/messages/msg_ABC123
  Headers: Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "success": true,
  "message_id": "msg_ABC123"
}
```

---

**POST /api/v1/networks/messages/:id/read**

Mark message as read.

```
REQUEST:
  POST /api/v1/networks/messages/msg_ABC123/read
  Headers: Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "success": true,
  "read_at": "2026-03-27T15:40:00Z"
}
```

---

**POST /api/v1/networks/messages/channel/:channelId/read-all**

Mark all channel messages as read.

```
REQUEST:
  POST /api/v1/networks/messages/channel/messaging:.../read-all
  Headers: Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "success": true,
  "marked_as_read": 5
}
```

---

**POST /api/v1/networks/messages/:id/react**

Add emoji reaction.

```
REQUEST:
  POST /api/v1/networks/messages/msg_ABC123/react
  Headers: Authorization: Bearer <CLERK_JWT>

  { "type": "love" }

VALID REACTIONS:
  like, love, laugh, wow, sad, angry, fire, thumbsup

RESPONSE (200):
{
  "success": true,
  "reaction": {
    "type": "love",
    "user_id": "user_ABC123",
    "created_at": "2026-03-27T15:42:00Z"
  }
}
```

---

**POST /api/v1/networks/messages/:id/unreact**

Remove emoji reaction.

```
REQUEST:
  POST /api/v1/networks/messages/msg_ABC123/unreact
  Headers: Authorization: Bearer <CLERK_JWT>

  { "type": "love" }

RESPONSE (200):
{
  "success": true,
  "removed_reaction": "love"
}
```

---

**POST /api/v1/networks/messages/channel/:channelId/archive**

Archive channel (hide from list).

```
REQUEST:
  POST /api/v1/networks/messages/channel/messaging:.../archive
  Headers: Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "success": true,
  "channel_id": "messaging:..."
}
```

---

### Conversations

**GET /api/v1/networks/conversations**

List all conversations.

```
REQUEST:
  GET /api/v1/networks/conversations?limit=20&offset=0&type=all
  Headers: Authorization: Bearer <CLERK_JWT>

QUERY PARAMS:
  limit (number): default 20
  offset (number): default 0
  type (string): 'all', 'unread', 'active'

RESPONSE (200):
{
  "conversations": [
    {
      "id": "messaging:...",
      "channel_id": "messaging:...",
      "listing_id": "lst_ABC123",
      "listing_title": "Rolex Submariner 2020",
      "last_message": {
        "text": "Great deal!",
        "user_id": "user_XYZ789",
        "created_at": "2026-03-27T15:45:00Z"
      },
      "unread_count": 2,
      "members": 2,
      "created_at": "2026-03-27T10:00:00Z"
    }
  ],
  "has_more": true
}
```

---

**GET /api/v1/networks/conversations/:id**

Get conversation context with full details.

```
REQUEST:
  GET /api/v1/networks/conversations/messaging:...
  Headers: Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "conversation": {
    "id": "messaging:...",
    "channel_id": "messaging:...",
    "listing": {
      "id": "lst_...",
      "title": "Rolex Submariner",
      "price": 15000,
      "thumbnail": "https://...",
      "condition": "Excellent"
    },
    "participants": [
      {
        "user_id": "user_...",
        "name": "John Doe",
        "avatar": "https://...",
        "is_seller": false,
        "rating": 4.8
      }
    ],
    "status": "active",
    "created_at": "2026-03-27T10:00:00Z",
    "last_message_at": "2026-03-27T15:45:00Z"
  },
  "recent_messages": [/* last 5 messages */],
  "offers": [/* active offers */],
  "orders": [/* created orders */]
}
```

---

**GET /api/v1/networks/conversations/search**

Search conversations.

```
REQUEST:
  GET /api/v1/networks/conversations/search?query=john
  Headers: Authorization: Bearer <CLERK_JWT>

QUERY PARAMS:
  query (string): search term
  limit (number): default 20

RESPONSE (200):
{
  "results": [
    {
      "id": "messaging:...",
      "score": 0.95,
      ...conversation object...
    }
  ]
}
```

---

**GET /api/v1/networks/conversations/:id/media**

Get shared media/files/links.

```
REQUEST:
  GET /api/v1/networks/conversations/messaging:.../media?type=media&limit=50
  Headers: Authorization: Bearer <CLERK_JWT>

QUERY PARAMS:
  type (string): 'media', 'files', 'links', 'all'
  limit (number): default 50
  offset (number): default 0

RESPONSE (200):
{
  "items": [
    {
      "id": "msg_ABC123",
      "type": "image",
      "url": "https://...",
      "filename": "watch.jpg",
      "size": 2048000,
      "mime_type": "image/jpeg",
      "created_at": "2026-03-27T14:30:00Z"
    }
  ]
}
```

---

### Group Chat Management

**POST /api/v1/networks/chat/channel/:channelId/add-member**

Add member to group.

```
REQUEST:
  POST /api/v1/networks/chat/channel/messaging:.../add-member
  Headers: Authorization: Bearer <CLERK_JWT>

  { "user_id": "user_NEW123" }

RESPONSE (200):
{
  "success": true,
  "user_id": "user_NEW123",
  "members_count": 4
}

ERROR (403):
{ "error": { "message": "Only owner can add members" } }
```

---

**DELETE /api/v1/networks/chat/channel/:channelId/remove-member**

Remove member from group.

```
REQUEST:
  DELETE /api/v1/networks/chat/channel/messaging:.../remove-member?user_id=user_XYZ789
  Headers: Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "success": true,
  "removed_user_id": "user_XYZ789",
  "members_count": 2
}
```

---

## Message Types

The system supports these message types beyond regular text:

| Type              | Purpose                        | Custom Data                        |
| ----------------- | ------------------------------ | ---------------------------------- |
| `regular`         | Normal conversation            | -                                  |
| `inquiry`         | Buyer asks about listing       | -                                  |
| `offer`           | Seller/buyer sends price offer | `{ amount, expires_at }`           |
| `counter_offer`   | Counter to offer               | `{ amount }`                       |
| `offer_accepted`  | Deal accepted                  | `{ accepted_amount, accepted_at }` |
| `offer_rejected`  | Offer declined                 | `{ reason }`                       |
| `order_created`   | Order initiated                | `{ order_id, total }`              |
| `order_paid`      | Payment received               | `{ order_id, amount }`             |
| `order_shipped`   | Item shipped                   | `{ order_id, tracking }`           |
| `order_delivered` | Item delivered                 | `{ order_id, delivered_at }`       |
| `system`          | Internal system message        | depends                            |
| `image`           | Message with image             | `{ image_url, caption }`           |
| `file`            | Message with file              | `{ file_url, filename, size }`     |
| `link`            | Message with link              | `{ link_url, title, preview }`     |

---

## WebSocket Events

Listen to these events via GetStream SDK:

```javascript
channel.on("message.new", (event) => {
  // event.message: new message object
});

channel.on("message.updated", (event) => {
  // event.message: updated message
});

channel.on("message.deleted", (event) => {
  // event.message.id: deleted message ID
});

channel.on("message.read", (event) => {
  // event.user: user who read
  // event.read_up_to: message ID
});

channel.on("reaction.new", (event) => {
  // event.reaction: { type, user, created_at }
});

channel.on("reaction.deleted", (event) => {
  // event.reaction: removed reaction
});

channel.on("typing.start", (event) => {
  // event.user: user typing
});

channel.on("typing.stop", (event) => {
  // event.user: user stopped typing
});

channel.on("user.presence.changed", (event) => {
  // event.user.online: true/false
  // event.user.last_active: timestamp
});

client.on("connection.changed", (event) => {
  // event.online: WebSocket connected/disconnected
});

client.on("connection.recovered", () => {
  // WebSocket reconnected after disconnect
});
```

---

# 🔍 Explanation

Understand how the chat system works in detail.

## SDK vs API: The Critical Distinction

### Why Two Channels?

The system uses GetStream for **real-time delivery** and MongoDB for **persistence**. They serve different purposes:

| Aspect           | Backend API (`POST /send`)         | GetStream SDK (WebSocket)   |
| ---------------- | ---------------------------------- | --------------------------- |
| **Purpose**      | Save to DB, apply business logic   | Real-time UI delivery       |
| **Storage**      | MongoDB (permanent)                | GetStream cache (temporary) |
| **Latency**      | ~200-500ms (HTTP)                  | <100ms (WebSocket)          |
| **Who calls it** | Frontend, other services, webhooks | Frontend only (listening)   |
| **Example**      | POST /messages/send                | channel.on('message.new')   |

### Wrong vs Right Approach

```javascript
// ❌ WRONG - Frontend should NEVER do this
channel.sendMessage({ text: "Hello" });
// Why? Bypasses backend logic, moderation, database persistence

// ✅ CORRECT - Frontend calls backend
POST / api / v1 / networks / messages / send;
// Why? Backend saves to MongoDB, validates, applies business rules

// ✅ CORRECT - Frontend listens via SDK
channel.on("message.new", (event) => {
  // Real-time UI update
});
```

---

## Complete Message Flow

When a user sends a message, here's exactly what happens:

### 1. Frontend → Backend (HTTP, ~5ms)

```
User types: "Is this still available?"
Clicks Send button
↓
POST /api/v1/networks/messages/send
{
  "channel_id": "messaging:...",
  "text": "Is this still available?",
  "type": "inquiry"
}
```

### 2. Backend Validation (Express Handler, ~10ms)

```typescript
// NetworksMessageHandlers.sendMessage()
1. Extract JWT auth
2. Validate user exists
3. Check if user is channel member
4. Check if channel is open
5. Validate message not empty
6. Validate message type is legal
```

### 3. Save to MongoDB (Database Query, ~5ms)

```typescript
// ChatMessage.create()
{
  _id: new ObjectId(),
  stream_channel_id: "messaging:...",
  text: "Is this still available?",
  sender_id: ObjectId(user_id),
  sender_clerk_id: "user_ABC123",
  type: "inquiry",
  listing_id: ObjectId(listing_id),
  status: "sent",
  created_at: now(),
  read_by: [],
  reactions: {}
}
```

### 4. Deliver to GetStream (Network Call, ~150ms)

```typescript
// chatService.sendMessage()
streamChannel.sendMessage({
  text: "Is this still available?",
  user_id: "user_ABC123",
  db_message_id: mongoId,
  message_type: "inquiry",
});
```

### 5. Real-Time Broadcast (WebSocket, <100ms)

GetStream broadcasts to all connected clients:

```
Buyer's browser         Seller's browser
    ↓ ws.on("message.new") ↓ ws.on("message.new")
    Show message UI        Show notification
    <100ms                 <100ms
```

### 6. Webhook Event (Posted by GetStream)

```
POST /api/v1/webhooks/getstream
{
  "type": "message.new",
  "channel": {...},
  "message": {...},
  "created_at": "2026-03-27T15:30:00Z"
}
```

### 7. Backend Processes Webhook (Bull Queue, async)

```typescript
// webhookProcessor.ts
1. Verify HMAC signature
2. Check idempotency (not duplicate)
3. Persist raw event to MongoDB
4. Enqueue job to Bull Queue (Redis)
5. Return 200 OK immediately
↓
Worker picks up job (can be delayed)
6. Update ChatMessage.status = "confirmed"
7. Update channel.last_message_at
8. Increment user stats
9. Emit app-level events
```

### Total Latency Breakdown

| Step                | Duration | Notes                    |
| ------------------- | -------- | ------------------------ |
| HTTP POST /send     | ~5ms     | Network round-trip       |
| Backend validation  | ~10ms    | JWT, membership check    |
| Save to MongoDB     | ~5ms     | Database write           |
| GetStream delivery  | ~150ms   | Network + processing     |
| WebSocket broadcast | <100ms   | Real-time to subscribers |
| **Total to UI**     | ~260ms   | Full message delivery    |
| Webhook processing  | variable | Async, can retry         |

**User perceives <100ms** because WebSocket delivers before HTTP response completes.

---

## Channel Determinism

### Why Same User Pair = Same Channel?

```
Buyer: user_ABC123
Seller: user_XYZ789

First inquiry on Listing #1:
  Channel ID = MD5(user_ABC123 + user_XYZ789) = "abc123..."

Later inquiry on Listing #5 (same seller):
  Channel ID = MD5(user_ABC123 + user_XYZ789) = "abc123..." ← Same!
```

**Benefit:** All conversations with one person in one place. User doesn't see fragmented chats.

**Special case:** Group channels have different IDs, allowing multiple separate conversations.

---

## Dual Storage Strategy

### MongoDB (Persistent)

Why we store in MongoDB:

- ✅ Full audit trail (immutable)
- ✅ Search by date, user, listing
- ✅ Analytics and reporting
- ✅ Compliance (message retention)
- ✅ Business context (listing_id, offer amounts)

### GetStream (Real-Time Cache)

Why we use GetStream:

- ✅ <100ms real-time delivery
- ✅ WebSocket infrastructure
- ✅ Presence tracking
- ✅ Typing indicators
- ✅ Rich message reactions
- ✅ Temporary storage only

### Sync Between Them

GetStream webhooks keep them in sync:

```
Message sent → GetStream broadcasts → Webhook fires → Worker updates MongoDB stats
```

If GetStream fails, we still have MongoDB. If MongoDB fails, user still sees message via GetStream (but stats won't update).

---

## Error Recovery

### When Backend Fails (400, 401, 403)

```javascript
// Frontend catches error
fetch("/messages/send").catch((error) => {
  if (error.status === 403) {
    // User not member - show permission error
  } else if (error.status === 400) {
    // Validation failed - show validation error
  } else {
    // Network error - queue for retry
    queueMessageForRetry(message);
  }
});
```

### When GetStream Fails (delivery error)

```
Message saved to MongoDB with status: "pending_delivery"
↓
Retry loop in backend
↓
Eventually succeeds or marked as failed
↓
User can resend manually
```

### When WebSocket Disconnects

```javascript
client.on("connection.changed", (event) => {
  if (!event.online) {
    // Show "reconnecting..." indicator
    // Queue outgoing messages locally
  }
  if (event.online) {
    // Reconnected!
    // Load any missed messages
    // Sync queued messages
  }
});
```

---

## Webhook Processing Reliability

```
GetStream sends webhook
↓
Handler: Verify signature (HMAC-SHA256)
↓
Handler: Check idempotency (event seen before?)
↓
Handler: Enqueue to Bull Queue (Redis)
↓
Handler: Return 200 OK (fast!)
↓
[Async - may happen later]
Worker: Process event
Worker: Apply business logic
Worker: Retry on failure (up to 10 attempts)
```

**Key:** Always return 200 OK fast, process async. This prevents webhooks from timing out.

---

## Presence & Typing Without GetStream SDK

If you don't use GetStream SDK, you can implement manually:

```javascript
// User starts typing
setInterval(async () => {
  await fetch("/api/v1/networks/messages/channel/:id/user-typing", {
    method: "POST",
    body: { user_id, is_typing: true },
  });
}, 2000); // Every 2 seconds while typing

// Other users poll
setInterval(async () => {
  const { typing_users } = await fetch(
    "/api/v1/networks/messages/channel/:id/typing-users",
  );
  showTypingIndicators(typing_users);
}, 1000); // Every second
```

**But:** This is wasteful. Use GetStream SDK for typing - it's designed for this.

---

## Rate Limiting

Standard rate limits per user:

| Operation           | Limit  | Window      |
| ------------------- | ------ | ----------- |
| Send message        | 10/min | Per channel |
| Reactions           | 20/min | Per channel |
| Read status updates | 20/min | Per channel |
| Typing indicators   | 30/min | Per channel |

---

# ⚠️ Common Mistakes

### Mistake 1: Calling GetStream sendMessage from Frontend

```javascript
// ❌ WRONG
const response = await channel.sendMessage({ text: "Hello" });

// ✅ CORRECT
const response = await fetch("/api/v1/networks/messages/send", {
  method: "POST",
  body: JSON.stringify({ channel_id, text: "Hello" }),
});
```

**Why:** Backend needs to validate, save to DB, apply moderation.

---

### Mistake 2: Not Handling Disconnections

```javascript
// ❌ WRONG - No error handling
channel.on("message.new", handler);

// ✅ CORRECT - Handle disconnections
client.on("connection.changed", (event) => {
  if (!event.online) {
    // Show offline indicator
    // Queue messages for retry
  }
});
```

---

### Mistake 3: Loading All Messages at Once

```javascript
// ❌ WRONG - Loads 1000s of messages
GET /messages/channel/:id?limit=10000

// ✅ CORRECT - Paginate
GET /messages/channel/:id?limit=20&offset=0
// Then load more on scroll
```

---

### Mistake 4: Polling Instead of WebSocket

```javascript
// ❌ WRONG - Wasteful polling
setInterval(async () => {
  const messages = await fetch("/messages/channel/:id");
  // Parse and update UI
}, 5000);

// ✅ CORRECT - WebSocket is real-time
channel.on("message.new", (event) => {
  // Update UI immediately
});
```

---

# 🚀 Deployment Checklist

- ✅ GetStream API key configured
- ✅ GetStream API secret configured
- ✅ Webhook URL registered in GetStream dashboard
- ✅ MongoDB connection string set
- ✅ Redis connection for Bull Queue
- ✅ CORS configured for WebSocket domains
- ✅ JWT signing key configured
- ✅ Webhook signature verification enabled
- ✅ Bull worker process monitoring
- ✅ Message archive/cleanup jobs scheduled
- ✅ Monitoring for webhook failures
- ✅ Error tracking setup (Sentry, etc.)

---

# 📞 Troubleshooting

## WebSocket Not Connecting

**Symptom:** `channel.watch()` hangs

**Causes:**

1. Token expired (check timestamp)
2. CORS not configured
3. Backend firewall blocking WebSocket
4. Invalid API key

**Solution:**

```javascript
// 1. Refresh token
const { token } = await fetch("/chat/token").then((r) => r.json());

// 2. Reconnect
await client.disconnectUser();
await client.connectUser({ id: userId }, token);
```

---

## Messages Not Appearing

**Symptom:** Message sent but not visible

**Causes:**

1. Not subscribed to channel (`channel.watch()`)
2. User not member of channel
3. Channel closed/archived
4. Webhook failed

**Solution:**

```javascript
// 1. Verify subscription
const isWatching = channel.state.watcher_count > 0;

// 2. Check membership
const isMemb = channel.state.members[userId];

// 3. Load history
GET /messages/channel/:id?limit=50&offset=0
```

---

## Token Expired

**Symptom:** `401 Unauthorized` errors

**Causes:**

1. Token older than 1 hour
2. Clock skew between server/client

**Solution:**

```javascript
// Refresh before expiry
const tokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
const refreshAt = tokenExpiry - 10 * 60 * 1000; // 10 min buffer

setTimeout(async () => {
  const { token } = await fetch("/chat/token").then((r) => r.json());
  await client.connectUser({ id: userId }, token);
}, refreshAt);
```

---

## High Latency

**Symptom:** Messages take >500ms to appear

**Causes:**

1. Network congestion
2. GetStream regional latency
3. Backend overload (slow DB queries)
4. MongoDB indexes missing

**Solution:**

```typescript
// Add index to ChatMessage.stream_channel_id
db.chat_messages.createIndex({ stream_channel_id: 1, created_at: -1 });

// Monitor endpoint latency
logger.info("Message send latency", { duration_ms });
```

---

## Channel Quota Exceeded

**Symptom:** Can't create new channels (HTTP 429)

**Causes:**

1. Over rate limit
2. Over channel limit for plan

**Solution:**

```javascript
// Check rate limit headers
const remaining = response.headers["x-rate-limit-remaining"];
if (remaining < 5) {
  // Implement backoff
  await sleep(1000);
}
```

---

That's everything! Documentation is now fully enhanced, organized by Diátaxis framework, focused on user goals, and stays in one file. ✅

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

---

# 📡 SDK vs API: When to Use What

## The Core Distinction

The Networks Chat System uses **TWO separate channels** for messaging:

1. **GetStream SDK (WebSocket)** - For real-time events in the browser
2. **Backend API** - For persistence, validation, and business logic

| Aspect           | GetStream SDK (WebSocket)                      | Backend API (/send)                                    |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------ |
| **What it does** | Delivers messages instantly to browsers        | Saves messages to MongoDB, triggers GetStream delivery |
| **Who uses it**  | Frontend JavaScript/React code                 | Anywhere (frontend, backend, webhooks, apps)           |
| **Latency**      | <100ms (real-time WebSocket)                   | ~200-500ms (over HTTP)                                 |
| **Purpose**      | Real-time UI updates, presence, typing         | Business logic, persistence, moderation                |
| **When to use**  | Listening to events, sending typing indicators | Sending actual messages, storing data                  |
| **Returns**      | Event objects (message, reaction, presence)    | Success/error response with DB status                  |

## Complete Message Lifecycle (Both Channels Work Together)

```
┌─────────────────────────────────────────────────────────────┐
│ USER TYPES MESSAGE IN BROWSER                               │
└──────────────┬──────────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: FRONTEND CALLS POST /messages/send API              │
│ (Not to GetStream directly, but to YOUR BACKEND)            │
└──────────────┬──────────────────────────────────────────────┘
               ↓
        ┌──────────────────┐
        │ BACKEND VALIDATION│
        ├──────────────────┤
        │ ✓ User logged in?│
        │ ✓ Is member?     │
        │ ✓ Channel open?  │
        │ ✓ Valid message? │
        └────────┬─────────┘
                 ↓
        ┌──────────────────┐
        │ SAVE TO MONGODB  │
        │ (ChatMessage)    │
        │ Status: "sent"   │
        └────────┬─────────┘
                 ↓
    ┌─────────────────────────────────┐
    │ DELIVER TO GETSTREAM CLOUD      │
    │ (via chatService.sendMessage)   │
    └────────┬────────────────────────┘
             ↓
 ┌───────────────────────────────────────────────┐
 │ GETSTREAM BROADCASTS TO ALL WEBSOCKET CLIENTS │
 │ (Buyer + Seller browsers get instant update)  │
 └───────────────┬───────────────────────────────┘
                 ↓
 ┌───────────────────────────────────────────────┐
 │ WEBHOOK: GetStream fires message.new event    │
 │ (calls /webhooks/getstream endpoint)          │
 └───────────────┬───────────────────────────────┘
                 ↓
 ┌───────────────────────────────────────────────┐
 │ BACKGROUND WORKER PROCESSES WEBHOOK           │
 │ (Updates stats: message count, last seen, etc)│
 └───────────────────────────────────────────────┘
```

### Key Points

**You NEVER call GetStream SDK's sendMessage()** - The backend does that. Frontend only listens via SDK.

```javascript
// ❌ WRONG - Don't do this
channel.sendMessage({ text: "Hello" });

// ✅ CORRECT - Frontend calls API
const response = await fetch("/api/v1/networks/messages/send", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    channel_id: "messaging:abc123",
    text: "Hello",
  }),
});

// ✅ CORRECT - GetStream SDK only listens for events
channel.on("message.new", (event) => {
  console.log("New message:", event.message.text);
});
```

### Why This Architecture?

| Benefit                    | Explanation                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| **Persistence First**      | Every message is saved to MongoDB before delivery                      |
| **Business Logic Control** | Backend validates: is user member? Is listing active? Can they afford? |
| **Moderation**             | Backend can reject messages before they're broadcast                   |
| **Audit Trail**            | Every message in MongoDB with full context (listing, user, time)       |
| **Offline Support**        | Load history from MongoDB, not just GetStream cache                    |
| **Real-Time UI**           | GetStream WebSocket still delivers instantly for UI updates            |
| **Analytics**              | Analyze message patterns, detect spam, measure engagement              |

---

# 📋 Complete API Endpoint Reference

## Authentication & Setup

### **GET /api/v1/networks/chat/token**

```
Generates a GetStream JWT token for WebSocket connection

REQUEST:
  GET /api/v1/networks/chat/token
  Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user_ABC123",
  "apiKey": "b5z5jt844r2xf"
}

WHEN TO USE:
  - On app startup (before connecting WebSocket)
  - When token expires (max 1-hour validity)
  - When user logs in

FRONTEND CODE:
  const { token, userId, apiKey } = await fetch(
    '/api/v1/networks/chat/token',
    { headers: { Authorization: `Bearer ${jwtToken}` } }
  ).then(r => r.json());

  const client = new StreamChat(apiKey);
  await client.connectUser({ id: userId }, token);
```

---

## Channel Management

### **GET /api/v1/networks/chat/channels**

```
List all chat channels the user is a member of

REQUEST:
  GET /api/v1/networks/chat/channels?limit=20&offset=0
  Authorization: Bearer <CLERK_JWT>

QUERY PARAMS:
  limit   - Max channels to return (1-50, default: 20)
  offset  - Pagination offset (default: 0)

RESPONSE (200):
{
  "channels": [
    {
      "id": "messaging:65a1b2c3d4e5f6g7h8i9j0",
      "type": "messaging",
      "cid": "messaging:65a1b2c3d4e5f6g7h8i9j0",
      "listing_id": "lst_ABC123",
      "listing_title": "Rolex Submariner 2020",
      "listing_price": 15000,
      "listing_thumbnail": "https://...",
      "members": ["user_ABC123", "user_XYZ789"],
      "last_message_at": "2026-03-27T15:30:00Z",
      "created_at": "2026-03-27T10:00:00Z",
      "unread_count": 3
    },
    ...
  ],
  "limit": 20,
  "offset": 0
}

WHEN TO USE:
  - Load list of all conversations (chat home)
  - Check unread message counts
  - Sync data on app startup
  - Re-render conversation list
```

### **POST /api/v1/networks/chat/channel**

```
Create or retrieve a buyer-seller channel for a listing

REQUEST:
  POST /api/v1/networks/chat/channel
  Authorization: Bearer <CLERK_JWT>
  Content-Type: application/json

  {
    "listing_id": "69cc568de174dbd07eae5bba",
    "seller_id": "user_xyz789" (optional - defaults to listing's seller)
  }

RESPONSE (200):
{
  "channelId": "messaging:65a1b2c3d4e5f6g7h8i9j0",
  "channel": {
    "id": "messaging:65a1b2c3d4e5f6g7h8i9j0",
    "type": "messaging",
    "cid": "messaging:65a1b2c3d4e5f6g7h8i9j0",
    "listing_id": "lst_ABC123",
    "listing_title": "Rolex Submariner 2020",
    "listing_price": 15000,
    "listing_thumbnail": "https://...",
    "members": ["user_ABC123", "user_XYZ789"]
  }
}

BEHAVIOR (Important!):
  - If buyer and seller already have a channel: REUSES IT
  - Each buyer-seller pair shares ONE channel (even if inquiring on multiple listings)
  - This is by design: all conversations with one person in one place

WHEN TO USE:
  - Before sending an inquiry ("Is this available?")
  - When opening a conversation
  - When initiating a new inquiry on a listing
```

### **GET /api/v1/networks/chat/unread**

```
Get total unread message counts

REQUEST:
  GET /api/v1/networks/chat/unread
  Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "total_unread": 5,
  "unread_by_channel": {
    "messaging:65a1b2c3d4e5f6g7h8i9j0": 3,
    "messaging:75b2c3d4e5f6g7h8i9j0k1": 2
  }
}

WHEN TO USE:
  - Display unread badge counts
  - Check for new messages on app startup
  - Determine if to show "new messages" indicator
  - Poll every 10-30 seconds in chat list view
```

---

## Message Operations

### **POST /api/v1/networks/messages/send**

```
Send a message to a chat channel (PRIMARY WAY TO SEND MESSAGES)

REQUEST:
  POST /api/v1/networks/messages/send
  Authorization: Bearer <CLERK_JWT>
  Content-Type: application/json

  {
    "channel_id": "messaging:65a1b2c3d4e5f6g7h8i9j0",
    "text": "Is this still available?",
    "type": "regular",                           [optional]
    "attachments": [...],                        [optional - images, files]
    "custom_data": { "listing_id": "..." },     [optional - custom metadata]
    "parent_id": "parent_msg_id"                [optional - for threads]
  }

MESSAGE TYPES (type field):
  "regular"          - Normal user message
  "inquiry"          - Buyer asking about listing
  "offer"            - Seller sending price offer
  "counter_offer"    - Buyer responding with different price
  "offer_accepted"   - Deal accepted, moving to order
  "offer_rejected"   - Buyer declined offer
  "order_created"    - System: order created
  "order_paid"       - System: payment received
  "order_shipped"    - System: item shipped
  "order_delivered"  - System: item delivered
  "system"           - Internal system message
  "image"            - Message with image attachment
  "file"             - Message with file attachment
  "link"             - Message with link preview

RESPONSE (201):
{
  "id": "msg_ABC123",
  "user_id": "user_ABC123",
  "text": "Is this still available?",
  "type": "regular",
  "channel_id": "messaging:65a1b2c3d4e5f6g7h8i9j0",
  "created_at": "2026-03-27T15:30:00Z",
  "status": "delivered"
}

ERRORS:
  400 Bad Request: Missing channel_id or message text
  401 Unauthorized: User not authenticated
  403 Forbidden: User is not a member of this channel
  400 Bad Request: Channel is closed - cannot send messages

WHEN TO USE:
  - Sending ANY message (inquiry, offer, regular chat, etc.)
  - Always call this before GetStream sendMessage()
  - This is THE ONLY way messages get saved to database

EXAMPLE FLOW:
  1. User types message and clicks "Send" button
  2. Frontend calls POST /messages/send
  3. Backend validates, saves to MongoDB
  4. Backend delivers to GetStream
  5. WebSocket listeners get real-time event
  6. UI updates optimistically/confirmed
```

### **GET /api/v1/networks/messages/channel/:channelId**

```
Fetch message history for a channel (pagination)

REQUEST:
  GET /api/v1/networks/messages/channel/messaging:65a1b2c3d4e5f6g7h8i9j0
  ?limit=20&offset=0
  Authorization: Bearer <CLERK_JWT>

QUERY PARAMS:
  limit   - Messages per page (1-100, default: 20)
  offset  - Pagination offset (default: 0)

RESPONSE (200):
{
  "messages": [
    {
      "id": "msg_ABC123",
      "user_id": "user_ABC123",
      "user": {
        "id": "user_ABC123",
        "name": "John Doe",
        "avatar": "https://..."
      },
      "text": "Is this still available?",
      "type": "regular",
      "created_at": "2026-03-27T15:30:00Z",
      "updated_at": "2026-03-27T15:30:00Z",
      "read_by": [
        { "user_id": "user_XYZ789", "read_at": "2026-03-27T15:35:00Z" }
      ],
      "reactions": {
        "laugh": [{ "user": "user_XYZ789", "created_at": "..." }]
      },
      "attachments": [],
      "custom_data": {}
    },
    ...
  ],
  "has_more": true,
  "total": 150
}

PAGINATION:
  First page:  offset=0
  Next page:   offset=20  (offset += limit)
  Last page:   has_more will be false

WHEN TO USE:
  - Load message history when opening a conversation
  - Infinite scroll: fetch next page when scrolling up
  - Search conversation: search these results
  - Reload sent messages after reconnect

EXAMPLE:
  // Load more messages when user scrolls up
  if (isNearTop) {
    const response = await fetch(
      `/api/v1/networks/messages/channel/${channelId}?offset=40`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    messages = [...(await response.json()).messages, ...messages];
  }
```

### **PUT /api/v1/networks/messages/:id**

```
Edit a message (for user corrections/typos)

REQUEST:
  PUT /api/v1/networks/messages/msg_ABC123
  Authorization: Bearer <CLERK_JWT>
  Content-Type: application/json

  {
    "text": "Is this item still available?",
    "attachments": [...]
  }

RESPONSE (200):
{
  "id": "msg_ABC123",
  "text": "Is this item still available?",
  "updated_at": "2026-03-27T15:35:00Z",
  "edited_by_id": "user_ABC123"
}

RESTRICTIONS:
  - User can only edit their own messages
  - Cannot edit system/offer/order messages
  - Cannot edit messages older than 24 hours

WHEN TO USE:
  - User manually clicks "Edit" on their message
  - Correct a typo or mistake
  - Update message content (user-initiated only)

REAL-TIME UPDATE:
  GetStream webhook fires message.updated event
  WebSocket subscribers see change instantly
```

### **DELETE /api/v1/networks/messages/:id**

```
Delete a message (soft delete - history stays)

REQUEST:
  DELETE /api/v1/networks/messages/msg_ABC123
  Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "success": true,
  "message": "Message deleted",
  "message_id": "msg_ABC123"
}

BEHAVIOR:
  - Message text replaced with "[Deleted]"
  - Timestamp preserved for sorting
  - Attachments removed from storage
  - Other user can still see it was deleted
  - Soft delete: can be recovered by admins

WHEN TO USE:
  - User clicks "Delete" on their message
  - Remove from chat but keep conversation history
  - Admin content moderation
```

### **POST /api/v1/networks/messages/:id/read**

```
Mark a single message as read

REQUEST:
  POST /api/v1/networks/messages/msg_ABC123/read
  Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "success": true,
  "message_id": "msg_ABC123",
  "read_at": "2026-03-27T15:40:00Z"
}

WHEN TO USE:
  - Mark important message as read
  - Single message read receipt
  - Usually handled automatically (see read-all below)
```

### **POST /api/v1/networks/messages/channel/:channelId/read-all**

```
Mark all messages in a channel as read (common operation)

REQUEST:
  POST /api/v1/networks/messages/channel/messaging:65a1b2c3d4e5f6g7h8i9j0/read-all
  Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "success": true,
  "channel_id": "messaging:65a1b2c3d4e5f6g7h8i9j0",
  "marked_as_read": 5
}

WHEN TO USE:
  - When user opens a conversation
  - After user scrolls to latest message
  - Clear the unread badge
  - Update read receipt for sender

RECOMMENDED:
  Call this automatically when user views messages, not every message open
```

### **POST /api/v1/networks/messages/:id/react**

```
Add emoji reaction to a message

REQUEST:
  POST /api/v1/networks/messages/msg_ABC123/react
  Authorization: Bearer <CLERK_JWT>
  Content-Type: application/json

  {
    "type": "laugh"    // or "love", "wow", "sad", "angry", etc.
  }

SUPPORTED EMOJI REACTIONS:
  "like", "love", "laugh", "wow", "sad", "angry", "fire", "thumbsup"

RESPONSE (200):
{
  "success": true,
  "message_id": "msg_ABC123",
  "reaction": {
    "type": "laugh",
    "user_id": "user_ABC123",
    "created_at": "2026-03-27T15:42:00Z"
  }
}

WHEN TO USE:
  - Quick reactions without typing
  - Show engagement (heart for good deal, laugh for joke)
  - Lightweight conversation feedback
  - Same user can add multiple different reactions
```

### **POST /api/v1/networks/messages/:id/unreact**

```
Remove emoji reaction from a message

REQUEST:
  POST /api/v1/networks/messages/msg_ABC123/unreact
  Authorization: Bearer <CLERK_JWT>
  Content-Type: application/json

  {
    "type": "laugh"
  }

RESPONSE (200):
{
  "success": true,
  "message_id": "msg_ABC123",
  "removed_reaction": "laugh"
}

WHEN TO USE:
  - User changes their mind about emoji
  - Remove incorrect reaction
  - Clicking emoji again
```

### **POST /api/v1/networks/messages/channel/:channelId/archive**

```
Archive a channel (hide from conversation list)

REQUEST:
  POST /api/v1/networks/messages/channel/messaging:65a1b2c3d4e5f6g7h8i9j0/archive
  Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "success": true,
  "channel_id": "messaging:65a1b2c3d4e5f6g7h8i9j0",
  "message": "Channel archived"
}

BEHAVIOR:
  - Channel hidden from main list
  - Messages not deleted
  - Can be unarchived later
  - Reappears if new message received

WHEN TO USE:
  - User clicks archive on old conversation
  - Clean up completed transactions
  - Reduce visual clutter in chat list
```

---

## Conversation/Chat Listing

### **GET /api/v1/networks/conversations**

```
Get user's conversations (all chat threads)

REQUEST:
  GET /api/v1/networks/conversations?limit=20&offset=0&type=all
  Authorization: Bearer <CLERK_JWT>

QUERY PARAMS:
  limit  - Results per page (default: 20)
  offset - Pagination offset (default: 0)
  type   - Filter type: 'all', 'unread', 'active' (default: 'all')

RESPONSE (200):
{
  "conversations": [
    {
      "id": "messaging:65a1b2c3d4e5f6g7h8i9j0",
      "channel_id": "messaging:65a1b2c3d4e5f6g7h8i9j0",
      "type": "messaging",
      "listing_id": "lst_ABC123",
      "listing_title": "Rolex Submariner 2020",
      "listing_price": 15000,
      "listing_thumbnail": "https://...",
      "last_message": {
        "text": "Great, I'll send payment tomorrow",
        "user_id": "user_XYZ789",
        "created_at": "2026-03-27T15:45:00Z"
      },
      "unread_count": 2,
      "members": 2,
      "created_at": "2026-03-27T10:00:00Z",
      "last_activity": "2026-03-27T15:45:00Z"
    },
    ...
  ],
  "has_more": true
}

WHEN TO USE:
  - Load conversation list on chat home
  - Show recent conversations at top
  - Display unread badges
  - Sort by last activity
```

### **GET /api/v1/networks/conversations/search**

```
Search conversations by text or participant name

REQUEST:
  GET /api/v1/networks/conversations/search
  ?query=john&type=all
  Authorization: Bearer <CLERK_JWT>

QUERY PARAMS:
  query - Search term (participant name, listing title, message text)
  type  - Filter type (default: 'all')
  limit - Results per page (default: 20)

RESPONSE (200):
{
  "results": [
    {
      "id": "messaging:...",
      "score": 0.95,  // relevance score
      ...conversation object...
    }
  ]
}

WHEN TO USE:
  - User types in search box
  - Find old conversation with specific person
  - Search for listing they talked about
  - Fuzzy match on name/listing/text
```

### **GET /api/v1/networks/conversations/:id**

```
Get detailed context for a specific conversation

REQUEST:
  GET /api/v1/networks/conversations/messaging:65a1b2c3d4e5f6g7h8i9j0
  Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "conversation": {
    "id": "messaging:65a1b2c3d4e5f6g7h8i9j0",
    "channel_id": "messaging:65a1b2c3d4e5f6g7h8i9j0",
    "listing_id": "lst_ABC123",
    "listing": {
      "id": "lst_ABC123",
      "title": "Rolex Submariner 2020",
      "price": 15000,
      "thumbnail": "https://...",
      "condition": "Excellent",
      "location": "New York, NY"
    },
    "participants": [
      {
        "user_id": "user_ABC123",
        "name": "John Doe",
        "avatar": "https://...",
        "is_seller": false,
        "rating": 4.8
      },
      {
        "user_id": "user_XYZ789",
        "name": "Jane Smith",
        "avatar": "https://...",
        "is_seller": true,
        "rating": 4.9
      }
    ],
    "status": "active",  // or "closed", "archived"
    "created_at": "2026-03-27T10:00:00Z",
    "last_message_at": "2026-03-27T15:45:00Z"
  },
  "recent_messages": [
    // Last 5-10 messages (preview)
  ],
  "offers": [
    // Related offers in this conversation
  ],
  "orders": [
    // Related orders from this conversation
  ]
}

WHEN TO USE:
  - Open conversation detail view
  - Show full context (listing, offers, orders)
  - Display participant info/ratings
  - Load conversation header info
```

### **GET /api/v1/networks/conversations/:id/media**

```
Get shared media/files/links from a conversation

REQUEST:
  GET /api/v1/networks/conversations/messaging:65a1b2c3d4e5f6g7h8i9j0/media
  ?type=media&limit=50
  Authorization: Bearer <CLERK_JWT>

QUERY PARAMS:
  type   - Filter: 'media', 'files', 'links', 'all' (default: 'all')
  limit  - Results per page (default: 50)
  offset - Pagination offset (default: 0)

RESPONSE (200):
{
  "items": [
    {
      "id": "msg_ABC123",
      "type": "image",
      "url": "https://...",
      "filename": "watch.jpg",
      "size": 2048000,
      "mime_type": "image/jpeg",
      "created_at": "2026-03-27T14:30:00Z",
      "uploaded_by": "user_ABC123"
    },
    {
      "id": "msg_ABC124",
      "type": "file",
      "url": "https://...",
      "filename": "invoice.pdf",
      "size": 512000,
      "mime_type": "application/pdf"
    },
    {
      "id": "msg_ABC125",
      "type": "link",
      "url": "https://www.example.com",
      "title": "Watch Authentication Guide",
      "domain": "example.com"
    }
  ]
}

WHEN TO USE:
  - Show "Photos" tab in conversation
  - Gallery view of images shared
  - File/document archive
  - Quick reference to shared links
```

---

# 🌐 Group Chat Functionality

## What Is Group Chat?

Group chat enables **multiple users to chat together in one channel** - not just 1:1 buyer-seller conversations.

### Use Cases

1. **Support/Concierge Channels** - Multiple team members + buyer discussing issue
2. **Community Groups** - Multiple members discussing specific topics
3. **Company Channels** - Internal team coordination
4. **Moderated Channels** - Admins + community discussing content

## Creating Group Channels

### **POST /api/v1/networks/chat/channel (with members)**

```
Create a group channel with multiple members

REQUEST:
  POST /api/v1/networks/chat/channel
  Authorization: Bearer <CLERK_JWT>
  Content-Type: application/json

  {
    "type": "group",                    // NEW: specify group
    "name": "Support Team - Order 123", // Group name (required for groups)
    "members": [
      "user_ABC123",
      "user_XYZ789",
      "user_DEF456"
    ],
    "image": "https://...",             // Optional group image
    "description": "Discussing shipping issue"
  }

RESPONSE (201):
{
  "channelId": "messaging:65a1b2c3d4e5f6g7h8i9j0",
  "channel": {
    "id": "messaging:65a1b2c3d4e5f6g7h8i9j0",
    "type": "group",
    "name": "Support Team - Order 123",
    "members": 3,
    "created_by": "user_ABC123",
    "created_at": "2026-03-27T16:00:00Z"
  }
}

BEHAVIOR:
  - Channel is group-based (not user-pair based)
  - All members have equal access (unless roles defined)
  - Messages visible to all members
  - Can add/remove members after creation
```

## Managing Group Members

### **POST /api/v1/networks/chat/channel/:channelId/add-member**

```
Add a member to an existing group channel

REQUEST:
  POST /api/v1/networks/chat/channel/messaging:65a1b2c3d4e5f6g7h8i9j0/add-member
  Authorization: Bearer <CLERK_JWT>
  Content-Type: application/json

  {
    "user_id": "user_NEW123"
  }

RESPONSE (200):
{
  "success": true,
  "user_id": "user_NEW123",
  "members_count": 4
}

RESTRICTIONS:
  - Only group owner/admins can add members
  - User must exist in system
  - Cannot add user twice
  - System message sent to channel announcing new member
```

### **DELETE /api/v1/networks/chat/channel/:channelId/remove-member**

```
Remove a member from group channel

REQUEST:
  DELETE /api/v1/networks/chat/channel/messaging:65a1b2c3d4e5f6g7h8i9j0/remove-member
  ?user_id=user_XYZ789
  Authorization: Bearer <CLERK_JWT>

RESPONSE (200):
{
  "success": true,
  "removed_user_id": "user_XYZ789",
  "members_count": 2
}

BEHAVIOR:
  - User removed from channel
  - Cannot see new messages
  - History still visible to them (they can view)
  - System message announces removal
```

## Group Chat Messaging

**Sending messages is IDENTICAL to 1:1 chat:**

```javascript
// Works the same for group channels
const response = await fetch("/api/v1/networks/messages/send", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    channel_id: "messaging:abc123", // Group channel ID
    text: "We're here to help!",
    type: "regular",
  }),
});
```

**Reading messages is ALSO identical:**

```javascript
// Same endpoint, works for groups too
const response = await fetch(
  "/api/v1/networks/messages/channel/messaging:abc123?limit=20",
  { headers: { Authorization: `Bearer ${token}` } },
);
```

## Group Channel Features

| Feature                | Support   | Notes                     |
| ---------------------- | --------- | ------------------------- |
| **Multiple members**   | ✅ Yes    | Any number of members     |
| **Add/remove members** | ✅ Yes    | Owner/admin controlled    |
| **Message history**    | ✅ Yes    | Shared with all, indexed  |
| **Read receipts**      | ✅ Yes    | See who read each message |
| **Reactions**          | ✅ Yes    | Same as 1:1               |
| **Typing indicators**  | ✅ Yes    | See who's typing          |
| **Presence awareness** | ✅ Yes    | See who's online          |
| **Pinned messages**    | ✅ Yes    | Important announcement    |
| **Role management**    | ⚠️ Custom | Admin/member roles        |
| **Thread/topics**      | ✅ Yes    | via parent_id parameter   |

---

# 🎯 Advanced Features

## Message Threads (Replies)

Keep conversations organized with message threads:

```javascript
// Send a reply to specific message (creates thread)
const response = await fetch("/api/v1/networks/messages/send", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    channel_id: "messaging:abc123",
    text: "Yes, I agree with your point!",
    parent_id: "msg_ABC123", // Reply to this message
    type: "regular",
  }),
});
```

**Frontend display:**

```
John: "What's the lowest you'll go?"
  └─ Jane: "Can't go lower than $12k"
    └─ John: "That works for me!"
Matthew: "Is it still available?"
```

## Typing Indicators

Show who's currently typing (GetStream SDK handles this):

```javascript
// Start typing (frontend - GetStream SDK)
channel.keystroke();

// Listener sees typing indicator
channel.on("typing.start", (event) => {
  console.log(`${event.user.name} is typing...`);
});

channel.on("typing.stop", (event) => {
  console.log(`${event.user.name} stopped typing`);
});
```

## Presence & Online Status

See who's online right now:

```javascript
// Backend tracks online status via GetStream
const channel = await chatService.getChannel(channelId);

// Front-end connected users
Object.values(channel.state.members).forEach((member) => {
  console.log(
    `${member.user.name}: ${member.user.online ? "online" : "offline"}`,
  );
});

// Listen for presence changes
channel.on("user.presence.changed", (event) => {
  if (event.user.online) {
    console.log(`${event.user.name} came online`);
  } else {
    console.log(`${event.user.name} went offline`);
  }
});
```

## Message Attachments

Send images, documents, and file attachments:

```javascript
const response = await fetch("/api/v1/networks/messages/send", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    channel_id: "messaging:abc123",
    text: "Here's proof of authentication",
    attachments: [
      {
        type: "image",
        asset_url: "https://storage.example.com/watch.jpg",
        image_url: "https://storage.example.com/watch.jpg",
        mime_type: "image/jpeg",
      },
      {
        type: "file",
        asset_url: "https://storage.example.com/invoice.pdf",
        file_url: "https://storage.example.com/invoice.pdf",
        mime_type: "application/pdf",
        title: "Invoice",
      },
    ],
  }),
});
```

## Unread Status Tracking

Track which messages are unread for better UX:

```javascript
// Get unread count badge for conversation list
const unreadData = await fetch("/api/v1/networks/chat/unread", {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

console.log(`Total unread: ${unreadData.total_unread}`);
console.log(`Channel unread:`, unreadData.unread_by_channel);

// Mark all as read when user opens conversation
await fetch(`/api/v1/networks/messages/channel/${channelId}/read-all`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
});
```

## Search Conversations

Find conversations by participant, listing, or content:

```javascript
const searchResults = await fetch(
  `/api/v1/networks/conversations/search?query=john&type=all`,
  { headers: { Authorization: `Bearer ${token}` } },
).then((r) => r.json());

searchResults.results.forEach((result) => {
  console.log(`${result.score.toFixed(2)} - ${result.listing_title}`);
});
```

---

## Where to Go From Here

- **Want to understand the complete flow?** → [Complete Inquiry Journey](#getting-started-tutorial)
- **Need specific how-to?** → [How-To Guides](#how-to-guides)
- **Looking for detailed examples?** → [Deep Dives](#deep-dives-how-it-works)
- **Debugging an issue?** → [Error Handling & Troubleshooting](#error-handling--troubleshooting)

---

## Table of Contents

1. [⚡ Quick Start Overview](#-quick-start-overview)
2. [📡 SDK vs API: When to Use What](#-sdk-vs-api-when-to-use-what) ← **Key Section!**
3. [📋 Complete API Endpoint Reference](#-complete-api-endpoint-reference) ← **All Endpoints Here**
4. [🌐 Group Chat Functionality](#-group-chat-functionality) ← **Multi-User Chats**
5. [🎯 Advanced Features](#-advanced-features) ← **Threads, Typing, Presence**
6. [System Architecture](#system-architecture)
7. [Getting Started Tutorial](#getting-started-tutorial)
8. [How-To Guides](#how-to-guides)
9. [Deep Dives: How It Works](#deep-dives-how-it-works)
10. [Error Handling & Troubleshooting](#error-handling--troubleshooting)

---

# System Architecture

## Complete Real-Time Communication Pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (React/Browser)                                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐          ┌──────────────────┐                    │
│  │ Chat Component   │          │ GetStream SDK    │                    │
│  │ (UI, Input)      │          │ (WebSocket Conn) │                    │
│  └────────┬─────────┘          └────────┬─────────┘                    │
│           │                             │                              │
│           │ POST /messages/send         │ Listens to:                  │
│           │ (HTTP)                      │ - message.new                │
│           │                             │ - typing.start/stop          │
│           │                             │ - user.presence              │
│           │                             │ - message.updated            │
│           │                             │ - reaction.new               │
│           └────────────────────────────────────────┐                   │
│                                                    │                    │
└────────────────────────────────────────────────────┼────────────────────┘
                                                     │
                                    ┌────────────────▼─────────────────┐
                                    │ BACKEND (Express/Node.js)        │
                                    ├──────────────────────────────────┤
                                    │                                  │
                                    │  POST /messages/send Handler:    │
                                    │  1. Validate user (JWT)          │
                                    │  2. Check channel membership     │
                                    │  3. Save to MongoDB (ChatMsg)    │
                                    │  4. Call GetStream sendMessage   │
                                    │  5. Return success to frontend   │
                                    │                                  │
                                    └────────────┬─────────────────────┘
                                                 │
                          ┌──────────────────────┴──────────────────────┐
                          │                                             │
                ┌─────────▼────────────┐               ┌────────────────▼──┐
                │ MongoDB (Persistence)│               │ GetStream (Real-  │
                ├─────────────────────┤               │  time Delivery)   │
                │                     │               ├───────────────────┤
                │ Collections:        │               │                  │
                │ • ChatMessage       │               │ Channels & Users: │
                │ • NetworkListing    │               │ • messaging:...   │
                │ • ChatMessage       │               │                  │
                │ • User              │               │ WebSocket         │
                │                     │               │ Subscribers:      │
                │ ✓ Full index        │               │ • Browser A       │
                │ ✓ Business logic    │               │ • Browser B       │
                │ ✓ Audit trail       │               │ (Same user-pair)  │
                │                     │               │                  │
                └────────┬────────────┘               └────────┬──────────┘
                         │                                    │
                         │                    ┌───────────────┘
                         │                    │
                         │      ┌─────────────▼────────────────┐
                         │      │ WebSocket Broadcast          │
                         │      │ All subscribed clients get   │
                         │      │ real-time message event      │
                         │      └──────────┬───────────────────┘
                         │                 │
                         │      ┌──────────▼────────────┐
                         │      │ Buyer's Browser       │
                         │      │ Shows new message UI  │
                         │      │ (instant, <100ms)     │
                         │      └──────────────────────┘
                         │
                         │
          ┌──────────────▼────────────────────────┐
          │ GetStream Webhook Event                │
          │ (message.new fired)                    │
          │ POST /webhooks/getstream               │
          └────────────┬─────────────────────────┘
                       │
             ┌─────────▼──────────────┐
             │ Backend Webhook Handler│
             │ 1. Verify signature    │
             │ 2. Check idempotency   │
             │ 3. Persist raw event   │
             │ 4. Enqueue to Bull     │
             │ 5. Return 200 OK       │
             └─────────┬──────────────┘
                       │
          ┌────────────▼────────────────┐
          │ Bull Queue (Redis)          │
          │ Job: { event, payload }   │
          └────────────┬────────────────┘
                       │
          ┌────────────▼────────────────┐
          │ Background Worker           │
          │ Processes:                  │
          │ • Update user stats         │
          │ • Update channel metadata   │
          │ • Emit app events           │
          │ • Update caches             │
          │ • Notify other services     │
          └────────────────────────────┘
```

## Key Architectural Decisions

| Component              | Choice                        | Why                                                       |
| ---------------------- | ----------------------------- | --------------------------------------------------------- |
| **Message Save**       | MongoDB first, then GetStream | Ensures persistence before delivery                       |
| **Real-time Delivery** | GetStream WebSocket           | Instant <100ms delivery to all browsers                   |
| **Business Logic**     | Backend API (/send)           | Validate, moderate, audit before broadcast                |
| **Webhook Processing** | Bull Queue + Redis            | Async processing, retry logic, scalability                |
| **Channel IDs**        | Hash of user pair             | Deterministic - same pair always = same channel           |
| **Dual Storage**       | MongoDB + GetStream           | Both needed: MongoDB for history, GetStream for real-time |
| **Token Generation**   | JWT signed by GetStream       | Secure, implements expiration, per-user auth              |

## Component Responsibilities

### Frontend (Browser)

- ✅ Call POST /messages/send (user's message submission)
- ✅ Listen via GetStream SDK (real-time events)
- ✅ Show typing indicators (keystroke events)
- ✅ Display presence (online/offline status)
- ✅ Update UI on message.new, message.updated, etc.
- ❌ Does NOT call GetStream sendMessage directly
- ❌ Does NOT save messages to database

### Backend Express Server

- ✅ Validate JWT tokens (Clerk auth)
- ✅ Save messages to MongoDB (persistent storage)
- ✅ Call GetStream API (send message to cloud)
- ✅ Validate membership (is user in this channel?)
- ✅ Apply business logic (is listing active? Can they message?)
- ✅ Moderate content (flagging, blocking)
- ✅ Return success/error responses

### GetStream Cloud

- ✅ Deliver message via WebSocket (real-time <100ms)
- ✅ Store temporary message cache
- ✅ Broadcast to all subscribed clients
- ✅ Fire webhook events (message.new, message.read, etc.)
- ✅ Track presence/typing / reactions
- ✅ Generate read receipts
- ❌ Not primary persistent storage

### MongoDB

- ✅ Persistently store ChatMessage documents
- ✅ Index by channel, user, date for queries
- ✅ Support message search and history
- ✅ Keep audit trail forever
- ✅ Allow analysis/analytics on message data
- ❌ Not for real-time delivery

### Redis (Bull Queue)

- ✅ Queue webhook jobs async
- ✅ Manage retries with exponential backoff
- ✅ Persist failed jobs for debugging
- ✅ Scale to handle high webhook volume
- ❌ Not for persistent storage

## High-Level Data Flow

### 1. Authentication & Token Generation

```
Client Request
  ↓
GET /api/v1/networks/chat/token
  ↓ [Clerk JWT Validated]
ChatService.createUserToken(userId)
  ↓ [GetStream token generated + signed]
Response: { token, userId, apiKey }
  ↓
Client connects WebSocket
  ↓
getstream.StreamChat.connectUser({ id: userId }, token)
  ↓
WebSocket connected (ready for real-time events)
```

### 2. Channel Creation/Retrieval

```
Channel Request
  ↓ [Deterministic ID: MD5_HASH(buyerId + sellerId)]
POST /api/v1/networks/chat/channel
  ↓
Query MongoDB NetworkListingChannel.findOne(...)
  ├─ Found: REUSE existing channel
  │   └─ (Networks policy: one channel per user pair)
  └─ Not found: CREATE both in GetStream + MongoDB
  ↓
GetStream: channel.create({ members, data })
MongoDB: NetworkListingChannel.create({ stream_id, listing_id, ... })
  ↓
Return channelId + metadata to frontend
  ↓
Frontend can now subscribe: channel.watch()
```

### 3. Message Send Flow (Complete)

```
┌──────────────────────────────────────────────────┐
│ USER CLICKS "SEND" BUTTON IN BROWSER             │
└────────────┬─────────────────────────────────────┘
             │
   ┌─────────▼──────────┐
   │ Frontend calls:    │
   │ POST /messages/send│
   │ with {channel_id,  │
   │       text}        │
   └─────────┬──────────┘
             │
   ┌─────────▼──────────────────────┐
   │ BACKEND PROCESSING              │
   ├─────────────────────────────────┤
   │ 1. Extract & validate JWT       │
   │ 2. Find user in MongoDB         │
   │ 3. Check channel exists         │
   │ 4. Check user is member         │
   │ 5. Check channel not closed     │
   │ 6. Validate message not empty   │
   └─────────┬──────────────────────┘
             │
   ┌─────────▼──────────────────────┐
   │ CREATE MESSAGE IN MONGODB       │
   ├─────────────────────────────────┤
   │ ChatMessage.create({            │
   │   _id: new ObjectId,            │
   │   stream_channel_id,            │
   │   text,                         │
   │   sender_id,                    │
   │   listing_id,                   │
   │   status: "sent",               │
   │   createdAt: now()              │
   │ })                              │
   │ (DB Write: ~5ms)                │
   └─────────┬──────────────────────┘
             │
   ┌─────────▼──────────────────────┐
   │ SEND TO GETSTREAM               │
   ├─────────────────────────────────┤
   │ streamChannel.sendMessage({     │
   │   text: message.text,           │
   │   user_id: userId,              │
   │   db_message_id: mongoId,       │
   │   custom_data: {...}            │
   │ })                              │
   │ (Network: ~100-200ms)           │
   └─────────┬──────────────────────┘
             │
   ┌─────────▼──────────────────────┐
   │ UPDATE MESSAGE STATUS           │
   │ status: "delivered"             │
   │ stream_message_id: msg_id       │
   │ (DB Update: ~5ms)               │
   └─────────┬──────────────────────┘
             │
   ┌─────────▼──────────────────────┐
   │ RESPOND TO FRONTEND             │
   │ HTTP 201 Created                │
   │ Total latency: ~250ms           │
   └─────────────────────────────────┘
             │
   ┌─────────▼───────────────────────────────────────────────┐
   │ NOW GETSTREAM BROADCASTS (Real-Time <100ms):            │
   │                                                           │
   │ WebSocket Event: message.new                            │
   │ Sent to: All connected channel members                  │
   │ Subscriber A (Buyer browser): Gets event instantly     │
   │ Subscriber B (Seller browser): Gets event instantly    │
   │                                                           │
   │ React/Vue updates UI immediately                        │
   │ Shows: "John: Is this still available?"                 │
   └───────────────────────────────────────────────────────────┘
             │
   ┌─────────▼──────────────────────────┐
   │ GETSTREAM FIRES WEBHOOK EVENT      │
   │ (After 1-2 seconds)                │
   │ HTTP POST /webhooks/getstream      │
   │ Body: {                            │
   │   type: "message.new",             │
   │   channel: {...},                  │
   │   message: {...},                  │
   │   created_at: ISO8601              │
   │ }                                  │
   └──────────┬───────────────────────┘
              │
   ┌──────────▼────────────────────────────┐
   │ WEBHOOK HANDLER (Backend)              │
   ├────────────────────────────────────────┤
   │ 1. Verify HMAC signature               │
   │ 2. Check idempotency (event seen?)     │
   │ 3. Persist GetstreamWebhookEvent       │
   │ 4. Enqueue to Bull Queue (Redis)       │
   │ 5. Response: HTTP 200 OK (instantly)   │
   │ (All in <50ms)                         │
   └──────────┬────────────────────────────┘
              │
   ┌──────────▼────────────────────────────┐
   │ BULL WORKER (Async Processing)        │
   ├────────────────────────────────────────┤
   │ 1. Fetch job from queue                │
   │ 2. Extract event data                  │
   │ 3. Update ChatMessage.status           │
   │    = "confirmed"                       │
   │ 4. Update channel.last_message_at      │
   │ 5. Increment user.message_count stat   │
   │ 6. Emit app events                     │
   │ 7. Mark job completed                  │
   │ (Can be delayed if queue backlogged)   │
   └────────────────────────────────────────┘
```

### 4. WebSocket (Real-Time) Event Subscription

```
Frontend Setup:

const client = new StreamChat(apiKey);
await client.connectUser({ id: userId }, token);

const channel = client.channel('messaging', channelId);
await channel.watch();  // Subscribe to events

// Now listening to real-time events:
channel.on('message.new', (event) => {
  // <100ms after sendMessage completes
  console.log('New message:', event.message.text);
  updateUI();
});

channel.on('message.updated', (event) => {
  // User edited message
  updateMessage(event.message);
});

channel.on('message.deleted', (event) => {
  // User deleted message
  removeMessage(event.message.id);
});

channel.on('typing.start', (event) => {
  // "Jane is typing..."
  showTypingIndicator(event.user);
});

channel.on('typing.stop', (event) => {
  hideTypingIndicator(event.user);
});

channel.on('user.presence.changed', (event) => {
  // Jane came online / Jane went offline
  updatePresence(event.user);
});

channel.on('reaction.new', (event) => {
  // User added emoji reaction
  addReaction(event.reaction);
});

channel.on('message.read', (event) => {
  // User read message (read receipt)
  markAsReadBy(event.user);
});
```

### 5. Webhook Processing Pipeline

```
GetStream Webhook Event
  ↓ [HTTP POST to /webhooks/getstream]
┌─────────────────────────────────────────┐
│ Webhook Signature Verification (HMAC)   │
│ - Compare X-Signature header             │
│ - With HMAC-SHA256(payload, secret)      │
│ - If invalid: return 401 Unauthorized    │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│ Idempotency Check                       │
│ - Look up event by X-Webhook-Id header  │
│ - If already processed: return 200 OK   │
│ - Prevents duplicate processing         │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│ Persist Raw Webhook Event               │
│ GetstreamWebhookEvent.create({          │
│   eventId: X-Webhook-Id,                │
│   type: event.type,                     │
│   payload: event,                       │
│   status: 'pending'                     │
│ })                                      │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│ Enqueue to Bull Queue                   │
│ webhookQueue.add({                      │
│   eventId,                              │
│   type,                                 │
│   payload                               │
│ }, { attempts: 10, backoff: ... })     │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│ Return 200 OK to GetStream               │
│ (Don't wait for processing)              │
│ Frontend user sees message instantly    │
│ via WebSocket (not waiting for backend) │
└────────────────────────────────────────┘
                 │
    [Async Processing Below]
                 │
    ┌───────────▼──────────────┐
    │ Bull Worker Picks Up Job │
    │ (from Redis queue)        │
    └───────────┬──────────────┘
                │
    ┌───────────▼──────────────────────┐
    │ Handle Event Based on Type       │
    ├──────────────────────────────────┤
    │ If message.new:                  │
    │ • Update message status          │
    │ • Update channel.last_message_at │
    │ • Increment sender.message_count │
    │                                  │
    │ If message.read:                 │
    │ • Mark message as read           │
    │ • Update read_by array           │
    │ • Update unread_count stat       │
    │                                  │
    │ If reaction.new:                 │
    │ • Add emoji to message.reactions │
    │ • Update engagement stats        │
    │                                  │
    │ If user.present.changed:         │
    │ • Update user.last_online        │
    │ • Emit presence event            │
    └───────────┬──────────────────────┘
                │
    ┌───────────▼──────────────────────┐
    │ Mark Job Processed               │
    │ GetstreamWebhookEvent.update({   │
    │   status: 'processed',           │
    │   processed_at: now()            │
    │ })                               │
    └──────────────────────────────────┘
```

## Key Architectural Principles

### 1. **Dual Persistence**

- **MongoDB**: Primary storage, full audit trail, business logic
- **GetStream**: Real-time cache, WebSocket delivery, temporary storage

### 2. **Backend-First Message Handling**

- Messages MUST go through backend API (/send) first
- Backend validates, persists, then delivers to GetStream
- Frontend NEVER calls GetStream sendMessage directly

### 3. **Real-Time + Reliable**

- WebSocket provides <100ms real-time delivery
- MongoDB persists in case WebSocket client refreshes
- Webhook confirms delivery and allows async processing

### 4. **Async Webhook Processing**

- Webhooks return 200 OK immediately (don't wait)
- Jobs enqueued to Bull Queue (Redis)
- Background worker processes asynchronously
- Ensures main HTTP response is fast

### 5. **Deterministic Channel IDs**

- Same buyer-seller pair ALWAYS gets same channel
- Calculated as MD5Hash(buyerId + sellerId)
- Enables channel reuse across multiple inquiries

## Key Components

| Component                        | File                                                    | Purpose                            |
| -------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| **ChatService**                  | `src/services/ChatService.ts`                           | GetStream client operations        |
| **NetworksChatHandlers**         | `src/networks/handlers/NetworksChatHandlers.ts`         | Token generation, channel creation |
| **NetworksMessageHandlers**      | `src/networks/handlers/NetworksMessageHandlers.ts`      | Send, read, react operations       |
| **NetworksConversationHandlers** | `src/networks/handlers/NetworksConversationHandlers.ts` | List, search conversations         |
| **ChatMessage Model**            | `src/models/ChatMessage.ts`                             | MongoDB schema for messages        |
| **NetworkListingChannel Model**  | `src/networks/models/NetworkListingChannel.ts`          | MongoDB schema for channels        |
| **getstreamWebhookHandler**      | `src/handlers/getstreamWebhookHandler.ts`               | Receive webhook events             |
| **webhookProcessor**             | `src/workers/webhookProcessor.ts`                       | Bull worker for async processing   |
| **webhookQueue**                 | `src/queues/webhookQueue.ts`                            | Bull queue configuration           |

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
└─ channel.\* → Log channel events
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

````

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user_36IcC3uo7Ch1Go4qYTZexUeWoZM",
  "apiKey": "b5z5jt844r2xf"
}
````

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
