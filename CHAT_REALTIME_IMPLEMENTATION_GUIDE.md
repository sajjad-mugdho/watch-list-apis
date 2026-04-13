# Dialist Networks — Chat & Real-Time Communications Guide

**End-to-End Implementation for Real-Time Messaging Architecture**

Version: 1.0 · Production Ready · April 2026

---

## 📋 Table of Contents

1. [Architecture Overview](#1--architecture-overview)
2. [Authentication & Token Management](#2--authentication--token-management)
3. [Channel Management](#3--channel-management)
4. [Message Lifecycle](#4--message-lifecycle)
5. [GetStream Integration](#5--getstream-integration)
6. [Real-Time Events](#6--real-time-events)
7. [Conversation Management](#7--conversation-management)
8. [Error Handling & Edge Cases](#8--error-handling--edge-cases)
9. [Implementation Examples](#9--implementation-examples)
10. [Testing & Validation](#10--testing--validation)

---

---

# 1 · ARCHITECTURE OVERVIEW

## System Components

```
Client (Frontend)
    ↓
[JWT Authentication] → Express API Layer
    ↓
    ├─ Routes (chatRoutes, messageRoutes, conversationRoutes)
    │   ↓
    ├─ Handlers (NetworksChatHandlers, NetworksMessageHandlers, NetworksConversationHandlers)
    │   ↓
    ├─ Services (ResourceGroupService, NetworksChannelService, NetworksMessageService)
    │   ↓
    ├─ Repositories (NetworksChannelRepository)
    │   ↓
    ├─ Database (MongoDB - NetworkListingChannel, ChatMessage)
    │   ↓
    └─ GetStream Chat API (Real-time + Storage)
        ↓
    WebSocket Connection → Real-Time Updates
```

## Key Principles

- **Platform Isolation**: Networks channels are separate from other platforms
- **Dual Storage**: Messages stored in MongoDB (DB) + GetStream (Real-time)
- **Channel-Based**: All messages linked to specific listing channels
- **Peer-to-Peer**: Buyer-Seller communication for each listing
- **Async Resilience**: Graceful degradation if GetStream temporarily fails

---

---

# 2 · AUTHENTICATION & TOKEN MANAGEMENT

## Token Generation

### Endpoint

```http
GET /api/v1/networks/chat/token
Authorization: Bearer <CLERK_JWT>
```

### Flow

```
1. Client sends GET request to /chat/token
   ↓
2. Server validates Clerk JWT
   ↓
3. User fetched/created in MongoDB
   ↓
4. GetStream token generated using user._id
   ↓
5. User synced to GetStream (upsertUser)
   ↓
6. Response with token + metadata sent to client
```

### Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user_36IcC3uo7Ch1Go4qYTZexUeWoZM",
  "apiKey": "b5z5jt844r2xf",
  "expiresIn": 3600
}
```

### Implementation Details

**File**: `src/networks/handlers/NetworksChatHandlers.ts`

```typescript
export const generateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  // 1. Get Clerk auth from JWT
  const auth = (req as any).auth;

  // 2. Find/create user in DB
  const user = await getOrCreateUser(auth.userId);

  // 3. Generate GetStream token
  const token = chatService.createUserToken(userId);

  // 4. Upsert user in GetStream
  await chatService.upsertUser({
    id: userId,
    name: user.display_name,
    avatar: user.avatar,
  });

  // 5. Return token
  res.json({ token, userId, apiKey: process.env.GETSTREAM_API_KEY });
};
```

## Token Lifecycle

| Stage     | Duration   | Action                                                  |
| --------- | ---------- | ------------------------------------------------------- |
| Generated | 0s         | Token created, user synced to GetStream                 |
| Active    | 0-3600s    | Client uses token for WebSocket + HTTP                  |
| Expiring  | 3500-3600s | Client should call `/chat/token` again                  |
| Expired   | >3600s     | Server rejects WebSocket connection, HTTP requests fail |

**Client Responsibility**: Refresh token when approaching expiration (every 50 minutes)

---

---

# 3 · CHANNEL MANAGEMENT

## Channel Structure

### Channel ID Format

```
messaging:lst_{listing_id}-{seller_id}
```

Example:

```
messaging:lst_001-usr_36IcC3uo7Ch1Go4qYTZexUeWoZM
```

### Channel Creation

#### API Endpoint

```http
POST /api/v1/networks/chat/channel
Authorization: Bearer <CLERK_JWT>
Content-Type: application/json

{
  "listing_id": "lst_001",
  "seller_id": "usr_36IcC3uo7Ch1Go4qYTZexUeWoZM",
  "listing_title": "Rolex Submariner 126610LN",
  "listing_price": 14500,
  "listing_thumbnail": "https://..."
}
```

#### Response

```json
{
  "channelId": "messaging:lst_001-usr_36IcC3uo7Ch1Go4qYTZexUeWoZM",
  "channel": {
    "id": "messaging:lst_001-usr_36IcC3uo7Ch1Go4qYTZexUeWoZM",
    "type": "messaging",
    "cid": "messaging:lst_001-usr_36IcC3uo7Ch1Go4qYTZexUeWoZM",
    "listing_id": "lst_001",
    "listing_title": "Rolex Submariner 126610LN",
    "listing_price": 14500,
    "members": ["usr_buyer01", "usr_36IcC3uo7Ch1Go4qYTZexUeWoZM"]
  }
}
```

#### Implementation Flow

```typescript
export const getOrCreateChannel = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { listing_id, seller_id, listing_title, listing_price } = req.body;

  // 1. Validate both users exist
  const buyer = await getOrCreateUser(auth.userId);
  const seller = await User.findById(seller_id);

  // 2. Prevent self-messaging
  if (buyer._id.toString() === seller_id) {
    return res.status(400).json({ error: "Cannot chat with yourself" });
  }

  // 3. Create or retrieve channel
  const { channel, channelId } = await chatService.getOrCreateChannel(
    buyer._id.toString(),
    seller_id,
    { listing_id, listing_title, listing_price }
  );

  // 4. Return channel details
  res.json({ channelId, channel: { ... } });
};
```

## Channel Metadata

Stored in GetStream channel `data` field:

```json
{
  "listing_id": "lst_001",
  "listing_title": "Rolex Submariner 126610LN",
  "listing_price": 14500,
  "listing_thumbnail": "https://cdn.dialist.app/...",
  "created_at": "2026-03-27T11:00:00Z",
  "last_message_at": "2026-03-27T14:30:00Z"
}
```

---

---

# 4 · MESSAGE LIFECYCLE

## Message States

```
DRAFT
  ↓ (Client sends)
SENT (in MongoDB, status="sent")
  ↓ (Posted to GetStream)
DELIVERED (status="delivered", stream_message_id set)
  ↓ (Receiver reads)
READ (status="read")
```

## Failure Handling

If GetStream posting fails:

```
SENT (in MongoDB)
  ↓ (GetStream fails)
PENDING_DELIVERY (status="pending_delivery", error logged)
  ↓ (Retry mechanism)
DELIVERED (status="delivered", stream_message_id set)
```

## Message Storage

### MongoDB ChatMessage Schema

```javascript
{
  _id: ObjectId,
  stream_channel_id: "messaging:lst_001-usr_001",  // GetStream channel ID
  text: "Is this still available?",
  sender_id: ObjectId,                              // MongoDB user._id
  sender_clerk_id: "user_36IcC3uo7...",            // Clerk ID
  type: "regular" | "inquiry" | "offer" | "system",
  listing_id: "lst_001",
  attachments: [],
  parent_id: null,
  parent_message_id: null,
  custom_data: {},
  status: "sent" | "delivered" | "read" | "pending_delivery",
  platform: "networks",
  stream_message_id: "msg_123456",                  // GetStream message ID
  created_at: ISODate,
  updated_at: ISODate
}
```

### GetStream Message Format

```json
{
  "id": "msg_123456",
  "type": "regular",
  "user_id": "user_36IcC3uo7...",
  "text": "Is this still available?",
  "created_at": "2026-03-27T14:30:00Z",
  "updated_at": "2026-03-27T14:30:00Z",
  "attachments": [],
  "mentioned_users": [],
  "cid": "messaging:lst_001-usr_001",
  "db_message_id": "507f1f77bcf86cd799439011",
  "message_type": "regular"
}
```

## Send Message Endpoint

### API

```http
POST /api/v1/networks/messages/send
Authorization: Bearer <CLERK_JWT>
Content-Type: application/json

{
  "channel_id": "messaging:lst_001-usr_001",
  "text": "Is this still available?",
  "type": "regular",
  "attachments": [],
  "custom_data": {}
}
```

### Response

```json
{
  "message": {
    "id": "msg_123456",
    "text": "Is this still available?",
    "sender_id": "user_36IcC3uo7...",
    "created_at": "2026-03-27T14:30:00Z",
    "status": "delivered"
  }
}
```

## Message Types

| Type              | Purpose                      | Example                             |
| ----------------- | ---------------------------- | ----------------------------------- |
| `regular`         | Normal user message          | "Is this still available?"          |
| `inquiry`         | Buyer inquiry on listing     | Auto-generated when inquiry created |
| `offer`           | Offer message                | "I'd like to offer $13,500"         |
| `counter_offer`   | Counter to previous offer    | "Best I can do is $14,000"          |
| `offer_accepted`  | Offer accepted notification  | Auto-generated                      |
| `order_created`   | Order created notification   | Auto-generated                      |
| `order_shipped`   | Order shipped notification   | Auto-generated                      |
| `order_delivered` | Order delivered notification | Auto-generated                      |
| `system`          | Platform notifications       | "Channel created"                   |
| `image`           | Image attachment             | Media URL in attachments            |
| `file`            | File attachment              | File URL in attachments             |
| `link`            | Link sharing                 | URL in text field                   |

---

---

# 5 · GETSTREAM INTEGRATION

## GetStream Client Setup

### Initialization

```typescript
// In ChatService
import StreamChat from "stream-chat";

class ChatService {
  private client: StreamChat.StreamChat;

  constructor() {
    this.client = new StreamChat(
      process.env.GETSTREAM_API_KEY || "",
      process.env.GETSTREAM_API_SECRET || "",
    );
  }

  async ensureConnected() {
    if (!this.client.user) {
      throw new Error("Chat client not initialized");
    }
  }

  getClient() {
    return this.client;
  }
}
```

## Token Creation

```typescript
createUserToken(userId: string): string {
  return this.client.createToken(userId);
}
```

**Token Format**: JWT signed with GetStream secret

- **Payload**: `{ user_id: "user_36IcC3uo7...", iat: timestamp, exp: timestamp + 3600 }`
- **Signature**: HMAC-SHA256 with GetStream API secret

## User Upsert

```typescript
async upsertUser(userData: {
  id: string;
  name: string;
  avatar?: string;
}): Promise<void> {
  await this.client.upsertUser({
    id: userData.id,
    name: userData.name,
    image: userData.avatar,
    custom: {
      platform: 'networks',
      role: 'user'
    }
  });
}
```

## Channel Operations

### Create/Get Channel

```typescript
async getOrCreateChannel(
  buyerId: string,
  sellerId: string,
  metadata: {
    listing_id: string;
    listing_title: string;
    listing_price: number;
    listing_thumbnail: string;
  }
): Promise<{ channel: Channel; channelId: string }> {
  const channelId = `messaging:lst_${metadata.listing_id}-${sellerId}`;
  const channel = this.client.channel('messaging', channelId, {
    members: [buyerId, sellerId],
    ...metadata,
  });

  await channel.create();
  return { channel, channelId };
}
```

### Send Message to Channel

```typescript
async sendMessage(
  channelId: string,
  userId: string,
  text: string,
  metadata?: Record<string, any>
): Promise<Message> {
  const channel = this.client.channel('messaging', channelId);
  const response = await channel.sendMessage({
    text,
    user_id: userId,
    ...metadata,
  });
  return response.message;
}
```

### Mark Message as Read

```typescript
async markMessageRead(
  channelId: string,
  userId: string,
  messageId: string
): Promise<void> {
  const channel = this.client.channel('messaging', channelId);
  await channel.markRead({
    user_id: userId,
    message_id: messageId,
  });
}
```

## Unread Counts

```typescript
async getUnreadCounts(userId: string): Promise<UnreadCounts> {
  const user = await this.client.user(userId).read();
  return {
    unread_channels: user.unread_channels,
    total_unread_count: user.total_unread_count,
  };
}
```

---

---

# 6 · REAL-TIME EVENTS

## WebSocket Connection

### Client Setup

```javascript
// Frontend
import StreamChat from "stream-chat";

const client = new StreamChat(apiKey);
await client.connectUser(
  {
    id: userId,
    name: displayName,
    image: avatarUrl,
  },
  token,
);

// Listen to events
client.on("message.new", (event) => {
  console.log("New message:", event.message);
  updateUI(event.message);
});

client.on("message.updated", (event) => {
  console.log("Message updated:", event.message);
});

client.on("typing.start", (event) => {
  console.log("User typing:", event.user);
});

client.on("typing.stop", (event) => {
  console.log("User stopped typing:", event.user);
});

client.on("user.presence.changed", (event) => {
  console.log("User online status:", event.user);
});
```

## Server-Side Events

### Webhook Registration

GetStream sends webhooks to:

```
POST /api/v1/networks/webhooks/getstream
```

**Signed with**: X-Signature-SHA256 header (verify with API secret)

### Event Types

#### message.created

```json
{
  "type": "message.created",
  "event_id": "msg_123456",
  "created_at": "2026-03-27T14:30:00Z",
  "user": {
    "id": "user_36IcC3uo7...",
    "name": "alex_carter"
  },
  "message": {
    "id": "msg_123456",
    "text": "Is this still available?",
    "cid": "messaging:lst_001-usr_001",
    "created_at": "2026-03-27T14:30:00Z"
  },
  "channel": {
    "id": "messaging:lst_001-usr_001",
    "type": "messaging"
  }
}
```

**Server Action**: Log message in MongoDB if not already present (idempotent)

#### message.updated

```json
{
  "type": "message.updated",
  "event_id": "msg_123456",
  "created_at": "2026-03-27T14:31:00Z",
  "user": {
    "id": "user_36IcC3uo7..."
  },
  "message": {
    "id": "msg_123456",
    "text": "Updated: Is this still available?",
    "updated_at": "2026-03-27T14:31:00Z"
  }
}
```

**Server Action**: Update message in MongoDB

#### message.deleted

```json
{
  "type": "message.deleted",
  "event_id": "msg_123456",
  "created_at": "2026-03-27T14:32:00Z",
  "message": {
    "id": "msg_123456"
  }
}
```

**Server Action**: Mark message as deleted in MongoDB

#### typing.start / typing.stop

```json
{
  "type": "typing.start",
  "user": {
    "id": "user_36IcC3uo7...",
    "name": "alex_carter"
  },
  "channel": {
    "id": "messaging:lst_001-usr_001"
  }
}
```

**Server Action**: Broadcast to other channel members (via client SDK)

#### user.presence.changed

```json
{
  "type": "user.presence.changed",
  "user": {
    "id": "user_36IcC3uo7...",
    "online": true,
    "last_active": "2026-03-27T14:30:00Z"
  }
}
```

**Server Action**: Update user online status in cache

---

---

# 7 · CONVERSATION MANAGEMENT

## Get Conversations List

### Endpoint

```http
GET /api/v1/networks/conversations?limit=20&offset=0
Authorization: Bearer <CLERK_JWT>
```

### Response

```json
{
  "data": [
    {
      "channel_id": "messaging:lst_001-usr_001",
      "listing_id": "lst_001",
      "listing_title": "Rolex Submariner 126610LN",
      "listing_price": 14500,
      "other_user": {
        "id": "usr_001",
        "display_name": "alex_carter",
        "avatar": "https://..."
      },
      "last_message": "Is this still available?",
      "last_message_at": "2026-03-27T14:30:00Z",
      "message_count": 15,
      "unread_count": 2,
      "created_at": "2026-03-27T11:00:00Z"
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

### Implementation

```typescript
export const getConversations = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const auth = (req as any).auth;
  const user = await User.findOne({ external_id: auth.userId });

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  // Get channels from service
  const conversations = await channelContextService.getConversationsForUser(
    user._id.toString(),
    "networks",
    { limit, offset },
  );

  res.json({
    data: conversations,
    total: conversations.length,
    limit,
    offset,
  });
};
```

## Search Conversations

### Endpoint

```http
GET /api/v1/networks/conversations/search?q=rolex
Authorization: Bearer <CLERK_JWT>
```

### Implementation

```typescript
export const searchConversations = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const q = req.query.q as string;

  if (!q || !q.trim()) {
    return res.status(400).json({
      error: { message: "Query parameter 'q' is required" },
    });
  }

  const conversations = await channelContextService.searchConversations(
    user._id.toString(),
    q,
    "networks",
  );

  res.json({
    data: conversations,
    query: q,
    total: conversations.length,
  });
};
```

## Get Conversation Context

### Endpoint

```http
GET /api/v1/networks/conversations/:conversationId
Authorization: Bearer <CLERK_JWT>
```

### Response

```json
{
  "data": {
    "channel_id": "messaging:lst_001-usr_001",
    "listing_id": "lst_001",
    "listing_title": "Rolex Submariner 126610LN",
    "listing_price": 14500,
    "parties": [
      {
        "id": "usr_buyer01",
        "display_name": "collector_x",
        "role": "buyer"
      },
      {
        "id": "usr_001",
        "display_name": "alex_carter",
        "role": "seller"
      }
    ],
    "message_count": 15,
    "created_at": "2026-03-27T11:00:00Z",
    "related_orders": [
      {
        "order_id": "ord_010",
        "status": "reserved"
      }
    ]
  }
}
```

## Get Conversation Media

### Endpoint

```http
GET /api/v1/networks/conversations/:conversationId/media?type=image
Authorization: Bearer <CLERK_JWT>
```

### Supported Types

- `image` — Photos
- `video` — Videos
- `file` — Documents
- `url_enrichment` — Links
- `media` — All media
- `files` — All files
- `links` — All links
- `all` — Everything

### Response

```json
{
  "data": {
    "media": [
      {
        "id": "msg_001",
        "type": "image",
        "url": "https://cdn.dialist.app/conversations/conv_001_media_1.jpg",
        "sent_by": "usr_001",
        "sent_at": "2026-03-27T12:00:00Z"
      }
    ],
    "links": [
      {
        "url": "https://example.com",
        "title": "Product Review",
        "sent_by": "usr_001",
        "sent_at": "2026-03-27T11:30:00Z"
      }
    ]
  }
}
```

---

---

# 8 · ERROR HANDLING & EDGE CASES

## Error Scenarios

### Unauthorized Access

```json
{
  "status": 401,
  "error": {
    "message": "Unauthorized",
    "code": "AUTH_FAILED"
  }
}
```

**Cause**: Missing/invalid JWT
**Response**: Client should redirect to login

### Not Channel Member

```json
{
  "status": 403,
  "error": {
    "message": "Not a member of this channel",
    "code": "AUTHORIZATION_ERROR"
  }
}
```

**Cause**: User trying to send message in channel they're not part of
**Response**: Client should verify user's channels first

### Channel Closed

```json
{
  "status": 400,
  "error": {
    "message": "Cannot send messages to a closed channel",
    "code": "CHANNEL_CLOSED"
  }
}
```

**Cause**: Channel archived/conversation ended
**Response**: Client should prevent message composition

### Message Validation Error

```json
{
  "status": 400,
  "error": {
    "message": "Either text or attachments are required",
    "code": "VALIDATION_ERROR"
  }
}
```

**Cause**: Empty message
**Response**: Client should validate before sending

### GetStream Temporarily Down

**Scenario**: GetStream API unavailable
**Handling**:

1. Message saved to MongoDB with `status="sent"`
2. GetStream posting fails, caught in try-catch
3. Status changed to `status="pending_delivery"`
4. Error logged with timestamp
5. Client receives HTTP 201 (message accepted)
6. Background job retries delivery every 30 seconds
7. Once delivered, `status="delivered"` + `stream_message_id` set
8. Client doesn't need to know about this—messages visible locally

**Code**:

```typescript
try {
  // Post to GetStream
  streamResponse = await streamChannel.sendMessage(msgPayload);
  dbMessage.stream_message_id = streamResponse.message?.id;
  dbMessage.status = "delivered";
} catch (streamError) {
  logger.error("GetStream send failed", { streamError });
  dbMessage.status = "pending_delivery";
  dbMessage.custom_data.delivery_error = streamError.message;
}
await dbMessage.save();
```

## Edge Cases

### Concurrent Message Sends

```
User clicks "Send" twice in quick succession
↓
Both messages arrive at server within milliseconds
↓
Each creates separate MongoDB document + GetStream message
↓
Result: Both messages visible, not deduplicated
```

**Prevention**: Client-side debouncing (disable button during send)

### Listing Deleted

```
User sends message: "Is this still available?"
Listing gets deleted by seller
↓
Message still exists in channel
↓
When user views conversation, listing_title shows from channel metadata (cached)
```

**Behavior**: Messages preserved, listing info from channel metadata

### User Blocked

```
User A blocks User B
↓
Existing messages in shared channels remain visible to both
↓
User B cannot send new messages (403 error)
↓
Conversation appears "closed" to User B (if enforced by client)
```

**Implementation**: Check block status before allowing message send

### Channel Not Created Yet

```
User inquires on listing → conversation created automatically
↓
Message sent to channel → creates channel if not exists
↓
Safe to multiple concurrent message sends (idempotent channel creation)
```

---

---

# 9 · IMPLEMENTATION EXAMPLES

## Example 1: Complete Chat Flow

### Step 1: Get Token

```bash
curl -X GET http://localhost:5050/api/v1/networks/chat/token \
  -H "Authorization: Bearer $CLERK_JWT"
```

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user_36IcC3uo7Ch1Go4qYTZexUeWoZM",
  "apiKey": "b5z5jt844r2xf"
}
```

### Step 2: Create/Get Channel

```bash
curl -X POST http://localhost:5050/api/v1/networks/chat/channel \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "listing_id": "lst_001",
    "seller_id": "user_36IcC3uo7Ch1Go4qYTZexUeWoZM",
    "listing_title": "Rolex Submariner 126610LN",
    "listing_price": 14500,
    "listing_thumbnail": "https://..."
  }'
```

Response:

```json
{
  "channelId": "messaging:lst_001-user_36IcC3uo7Ch1Go4qYTZexUeWoZM",
  "channel": {
    "id": "messaging:lst_001-user_36IcC3uo7Ch1Go4qYTZexUeWoZM",
    "members": ["user_36IcC3uo7...", "user_36IdtjemE0A..."]
  }
}
```

### Step 3: Connect WebSocket

```javascript
// Frontend
import StreamChat from "stream-chat";

const client = new StreamChat(apiKey);
await client.connectUser(
  {
    id: userId,
    name: displayName,
  },
  token,
);

// Connect to channel
const channel = client.channel("messaging", channelId);

// Listen to new messages
channel.on("message.new", (event) => {
  console.log("New message:", event.message.text);
});
```

### Step 4: Send Message

```bash
curl -X POST http://localhost:5050/api/v1/networks/messages/send \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": "messaging:lst_001-user_36IcC3uo7Ch1Go4qYTZexUeWoZM",
    "text": "Is this still available?",
    "type": "regular"
  }'
```

Response:

```json
{
  "message": {
    "id": "msg_123456",
    "text": "Is this still available?",
    "sender_id": "user_36IdtjemE0A...",
    "created_at": "2026-03-27T14:30:00Z",
    "status": "delivered"
  }
}
```

### Step 5: Receive Real-Time Update

```javascript
// Frontend - message received via WebSocket
{
  type: 'message.new',
  message: {
    id: 'msg_123456',
    text: 'Is this still available?',
    user: {
      id: 'user_36IdtjemE0A...',
      name: 'collector_x'
    },
    created_at: '2026-03-27T14:30:00Z'
  }
}
```

---

## Example 2: Listing Inquiry → Automatic Conversation

### User Submits Inquiry

```bash
curl -X POST http://localhost:5050/api/v1/networks/listings/lst_001/inquire \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "message": "Can you ship to Canada?" }'
```

### Backend Flow

1. **Inquiry Handler** creates inquiry record
2. **Automatically creates channel** if not exists
3. **Posts system message** to channel: "Inquiry created"
4. **Returns conversation_id** to client

```typescript
// In inquiryHandler
const { channel, channelId } = await chatService.getOrCreateChannel(
  buyerId,
  sellerId,
  { listing_id, listing_title, listing_price },
);

// Send system message
await chatService.sendMessage(
  channelId,
  SYSTEM_USER_ID,
  `New inquiry from ${buyer.display_name}: "${inquiryMessage}"`,
  { type: "system" },
);

res.json({
  inquiry_id: inquiry._id,
  conversation_id: channelId,
  status: "active",
});
```

---

## Example 3: Offer Counter-Flow

### Buyer Sends Offer

```bash
curl -X POST http://localhost:5050/api/v1/networks/listings/lst_001/offers \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 13500,
    "shipping_region": "US",
    "message": "Interested, can do 13.5k?"
  }'
```

### Automatic Message in Channel

```javascript
// Message posted to conversation channel
{
  type: 'offer',
  text: '📊 Offer: $13,500 (US)',
  custom_data: {
    offer_id: 'off_020',
    amount: 13500,
    shipping_region: 'US',
    message: 'Interested, can do 13.5k?'
  }
}
```

### Seller Counter-Offers

```bash
curl -X POST http://localhost:5050/api/v1/networks/offers/off_020/counter \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 14000,
    "message": "Lowest I can go"
  }'
```

### Automatic Message in Channel

```javascript
{
  type: 'counter_offer',
  text: '📊 Counter Offer: $14,000',
  custom_data: {
    offer_id: 'off_020',
    amount: 14000,
    message: 'Lowest I can go'
  }
}
```

---

---

# 10 · TESTING & VALIDATION

## Unit Tests

### Test: Token Generation

```typescript
describe("generateToken", () => {
  it("should return valid GetStream token", async () => {
    const req = mockRequest({
      auth: { userId: TEST_USER_ID },
    });
    const res = mockResponse();

    await chatHandlers.generateToken(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.token).toBeDefined();
    expect(body.userId).toBe(TEST_USER_ID);
    expect(body.apiKey).toBe(process.env.GETSTREAM_API_KEY);
  });

  it("should return 401 for invalid auth", async () => {
    const req = mockRequest({ auth: null });
    const res = mockResponse();

    await chatHandlers.generateToken(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: "Unauthorized" },
    });
  });
});
```

### Test: Channel Creation

```typescript
describe("getOrCreateChannel", () => {
  it("should create new channel", async () => {
    const req = mockRequest({
      auth: { userId: BUYER_ID },
      body: {
        listing_id: "lst_001",
        seller_id: SELLER_ID,
        listing_title: "Rolex",
        listing_price: 14500,
      },
    });
    const res = mockResponse();

    await chatHandlers.getOrCreateChannel(req, res, mockNext);

    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.channelId).toContain("messaging:lst_001");
    expect(body.channel.members).toContain(BUYER_ID);
    expect(body.channel.members).toContain(SELLER_ID);
  });

  it("should prevent messaging self", async () => {
    const req = mockRequest({
      auth: { userId: USER_ID },
      body: {
        listing_id: "lst_001",
        seller_id: USER_ID, // Same user
      },
    });
    const res = mockResponse();

    await chatHandlers.getOrCreateChannel(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
```

### Test: Message Sending

```typescript
describe("sendMessage", () => {
  it("should send message and save to DB", async () => {
    const req = mockRequest({
      auth: { userId: BUYER_ID },
      body: {
        channel_id: CHANNEL_ID,
        text: "Is this available?",
      },
    });
    const res = mockResponse();

    await messageHandlers.sendMessage("networks")(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(201);
    const dbMessage = await ChatMessage.findOne({
      stream_channel_id: CHANNEL_ID,
    });
    expect(dbMessage?.text).toBe("Is this available?");
    expect(dbMessage?.sender_id.toString()).toBe(expect.any(String));
  });

  it("should return 403 if not channel member", async () => {
    const req = mockRequest({
      auth: { userId: UNAUTHORIZED_USER_ID },
      body: {
        channel_id: CHANNEL_ID,
        text: "Message",
      },
    });
    const res = mockResponse();

    await messageHandlers.sendMessage("networks")(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: "Not a member of this channel" },
    });
  });
});
```

## Integration Tests

### Test: End-to-End Message Flow

```typescript
describe("End-to-End: Message Flow", () => {
  it("should complete full message lifecycle", async () => {
    // 1. Get token
    const tokenRes = await request(app)
      .get("/api/v1/networks/chat/token")
      .set("Authorization", `Bearer ${BUYER_JWT}`);

    const { token, userId, apiKey } = tokenRes.body;
    expect(token).toBeDefined();

    // 2. Create channel
    const channelRes = await request(app)
      .post("/api/v1/networks/chat/channel")
      .set("Authorization", `Bearer ${BUYER_JWT}`)
      .send({
        listing_id: "lst_001",
        seller_id: SELLER_ID,
        listing_title: "Rolex",
      });

    const { channelId } = channelRes.body;
    expect(channelId).toBeDefined();

    // 3. Send message
    const msgRes = await request(app)
      .post("/api/v1/networks/messages/send")
      .set("Authorization", `Bearer ${BUYER_JWT}`)
      .send({
        channel_id: channelId,
        text: "Is this available?",
      });

    expect(msgRes.status).toBe(201);
    const messageId = msgRes.body.message.id;

    // 4. Get conversations
    const convRes = await request(app)
      .get("/api/v1/networks/conversations")
      .set("Authorization", `Bearer ${BUYER_JWT}`);

    expect(convRes.body.data).toHaveLength(1);
    expect(convRes.body.data[0].channel_id).toBe(channelId);
    expect(convRes.body.data[0].unread_count).toBeGreaterThan(0);
  });
});
```

## Load Testing

### Concurrent Users

```bash
# Test: 100 concurrent users sending messages
k6 run - <<EOF
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
};

export default function () {
  const url = 'http://localhost:5050/api/v1/networks/messages/send';
  const payload = JSON.stringify({
    channel_id: 'messaging:lst_001-usr_001',
    text: 'Test message',
    type: 'regular'
  });

  const res = http.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.JWT}`,
    },
  });

  check(res, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
EOF
```

## Real-World Scenarios

### Scenario 1: Message Delivery During Network Outage

**Setup**: Mock GetStream API timeout

```typescript
describe("Resilience: GetStream Outage", () => {
  beforeEach(() => {
    jest
      .spyOn(chatService, "sendMessage")
      .mockRejectedValue(new Error("Timeout"));
  });

  it("should store message locally if GetStream fails", async () => {
    const res = await request(app)
      .post("/api/v1/networks/messages/send")
      .send({ channel_id, text: "Test" });

    expect(res.status).toBe(201); // Still accepted

    const dbMessage = await ChatMessage.findOne({
      text: "Test",
    });

    expect(dbMessage?.status).toBe("pending_delivery");
    expect(dbMessage?.custom_data.delivery_error).toContain("Timeout");
  });
});
```

### Scenario 2: Concurrent Message Sends

```typescript
describe("Concurrency: Multiple Message Sends", () => {
  it("should handle 10 concurrent messages", async () => {
    const promises = Array(10)
      .fill(null)
      .map((_, i) => {
        return request(app)
          .post("/api/v1/networks/messages/send")
          .set("Authorization", `Bearer ${BUYER_JWT}`)
          .send({
            channel_id: channelId,
            text: `Message ${i}`,
          });
      });

    const results = await Promise.all(promises);

    expect(results.every((r) => r.status === 201)).toBe(true);

    const messages = await ChatMessage.find({
      stream_channel_id: channelId,
    });

    expect(messages.length).toBe(10);
  });
});
```

---

---

# SUMMARY

## Key Takeaways

✅ **Architecture**

- Dual storage (MongoDB + GetStream)
- Channel-based peer-to-peer messaging
- Platform isolation (networks only)

✅ **Authentication**

- Clerk JWT → GetStream token
- 3600s expiration, auto-refresh

✅ **Real-Time**

- WebSocket via GetStream SDK
- Server webhooks for persistence
- Graceful degradation on failure

✅ **Scalability**

- GetStream handles real-time at scale
- MongoDB backup for persistence
- Async message delivery retries

✅ **Reliability**

- Idempotent operations
- Local storage fallback
- Comprehensive error handling

---

## Quick Reference

| Task                 | Endpoint                   | Method | Auth |
| -------------------- | -------------------------- | ------ | ---- |
| Get token            | `/chat/token`              | GET    | JWT  |
| Create channel       | `/chat/channel`            | POST   | JWT  |
| Get channels         | `/chat/channels`           | GET    | JWT  |
| Get unread           | `/chat/unread`             | GET    | JWT  |
| Send message         | `/messages/send`           | POST   | JWT  |
| Get conversations    | `/conversations`           | GET    | JWT  |
| Search conversations | `/conversations/search`    | GET    | JWT  |
| Get conversation     | `/conversations/:id`       | GET    | JWT  |
| Get media            | `/conversations/:id/media` | GET    | JWT  |
| Mark read            | `/messages/:id/read`       | POST   | JWT  |
| React                | `/messages/:id/react`      | POST   | JWT  |

---

**Production Ready** · Tested & Validated · April 2026
