# GetStream Chat Integration — Simple Explanation for Everyone

**Understanding Real-Time Chat, Webhooks & How Messages Work**

Version: 1.0 · Easy to Understand · April 2026

---

## 📚 Table of Contents

1. [What is GetStream? (In Simple Terms)](#1--what-is-getstream-in-simple-terms)
2. [How Real-Time Chat Works](#2--how-real-time-chat-works)
3. [What are Webhooks?](#3--what-are-webhooks)
4. [The Chat Flow — Step by Step](#4--the-chat-flow--step-by-step)
5. [The Codebase Structure](#5--the-codebase-structure)
6. [Database Storage (MongoDB)](#6--database-storage-mongodb)
7. [How Messages are Synced](#7--how-messages-are-synced)
8. [Real-World Examples](#8--real-world-examples)
9. [Troubleshooting Common Issues](#9--troubleshooting-common-issues)

---

---

# 1 · WHAT IS GETSTREAM? (IN SIMPLE TERMS)

## Think of It Like a Postal Service for Messages

Imagine you're at home and you want to send a letter to your friend:

- **Without GetStream**: You write a letter → put it in mailbox → mailman picks it up → delivers to friend → friend reads it
- **With GetStream**: GetStream is like having a super-smart postal service that delivers letters INSTANTLY and tells you when your friend reads it

## GetStream is a Service That Does Three Things

### 1️⃣ **Sends Messages Instantly**

- When you type "Hello!" and press SEND
- GetStream delivers it to your friend's phone **instantly** (not waiting for minutes)
- Like sending a message via WhatsApp instead of email

### 2️⃣ **Stores Messages Forever**

- All messages are saved in GetStream's database
- Your chat history is kept safe
- You can scroll back and read old messages anytime

### 3️⃣ **Notifies When Someone is Online**

- Shows if your friend is currently online (green dot)
- Shows "typing..." when they're writing
- Tells you when they read your message

## Why Not Just Build Our Own?

Building a real-time chat system from scratch is **really hard** because:

- 🔌 Managing thousands of live connections is complex
- ⚡ Delivering messages instantly requires special technology
- 💾 Storing and retrieving messages efficiently is tricky
- 🔐 Keeping messages secure is important
- 📈 When you have 1 million users, you need special servers

**GetStream already solved all this**, so we use it instead of building it ourselves.

---

---

# 2 · HOW REAL-TIME CHAT WORKS

## The Magic: WebSocket (Like an Always-Open Telephone Line)

Normally, the internet works like this:

```
You: "Send a letter"  →  ← Reply after 5 seconds
```

But with real-time chat, it works like a phone call:

```
You: "Hello"
     └─ Connection stays OPEN ─→
Friend hears instantly ←──────
```

## What Happens Behind the Scenes

### Step 1: You Open The App

```
Your Phone
├─ Opens Dialist App
├─ You get a "Token" (like a password for the chat service)
└─ Connects to GetStream (like calling a friend)
```

### Step 2: You Send a Message

```
You type: "Hi seller, is this still available?"

The app:
├─ Sends message to our Server
├─ Server saves to Database (in case GetStream needs it later)
├─ Server sends to GetStream instantly
└─ GetStream delivers to seller's phone in real-time
```

### Step 3: Seller Receives Message

```
Seller's Phone
├─ GetStream says "New message from collector_x"
├─ Phone vibrates/notifies
├─ Message appears on screen instantly
└─ Seller reads it

Seller's app tells GetStream: "I read the message"
└─ Your phone shows a checkmark or "read" badge
```

## The Two-Storage System

We store messages in **TWO** places:

```
┌─────────────────────────────────────────────────────────┐
│ Message: "Is this available?"                           │
├─────────────────┬───────────────────────────────────────┤
│                 │                                       │
│  Server         │  GetStream                           │
│  (Database)     │  (Real-Time Service)                 │
│                 │                                       │
│  ✅ Backup      │  ✅ Instant delivery                  │
│  ✅ Search      │  ✅ Online status                     │
│  ✅ Long-term   │  ✅ Typing indicators                 │
│     storage     │  ✅ Read receipts                     │
│                 │                                       │
└─────────────────┴───────────────────────────────────────┘
```

**Why two places?**

- If GetStream is slow: Message still reaches user from server backup
- If server is down: User still gets instant delivery from GetStream
- It's like having Plan A and Plan B

---

---

# 3 · WHAT ARE WEBHOOKS?

## Think of Webhooks Like a Doorbell

Imagine you're standing outside someone's house:

**Without Webhook**: You keep knocking repeatedly: _knock knock knock_ "Is anyone home?"
**With Webhook**: You ring the doorbell once → **Ding Dong!** → They come to the door

## Webhook = Automatic Notification System

GetStream has thousands of messages happening. Instead of our server asking "Did anything new happen?" every second:

```
❌ Bad way:
Server: "Did someone send a message?"  (every 1 second)
GetStream: "No..."
Server: "How about now?"
GetStream: "No..."
(This is SLOW and WASTEFUL)

✅ Good way:
GetStream: "Hey! Someone just sent a message!" (rings the bell)
Server: "Got it! Let me save it to database."
```

## How Webhooks Work in Our Chat System

```
1. Message sent on GetStream
   │
   ├─ GetStream automatically calls our server
   │  (doesn't wait for permission)
   │
   ├─ It says: "Hey! Here's a new message"
   │  Message: {
   │    id: "msg_123",
   │    text: "Is this still available?",
   │    sender: "collector_x",
   │    timestamp: "2026-03-27 14:30:00"
   │  }
   │
   └─ Our server receives it and saves to Database
```

## Webhook Event Examples

### When Someone Sends a Message

```json
GetStream says: "NEW MESSAGE EVENT"
{
  "type": "message.created",
  "message": {
    "text": "Hello seller!",
    "user_id": "user_36IdtjemE0A...",
    "created_at": "2026-03-27T14:30:00Z"
  }
}

Our server: "Got it! Saving to database..."
```

### When Someone Reads Your Message

```json
GetStream says: "READ EVENT"
{
  "type": "message.read",
  "user": {
    "id": "user_36IcC3uo7...",
    "name": "alex_carter"
  },
  "message_id": "msg_123"
}

Our server: "Message was read! Update status..."
```

### When Someone is Typing

```json
GetStream says: "TYPING EVENT"
{
  "type": "typing.start",
  "user": {
    "name": "alex_carter"
  },
  "channel_id": "messaging:lst_001-user_seller"
}

Our server: "Tell other users: 'alex_carter is typing...'"
```

---

---

# 4 · THE CHAT FLOW — STEP BY STEP

## Real-World Scenario: Buyer Interests in a Watch Listing

### STEP 1: Buyer Asks Questions

**What the buyer does:**

```
Opens Dialist App
    ↓
Finds a Rolex listing
    ↓
Clicks "Ask a Question"
    ↓
Types: "Can you ship to Canada?"
    ↓
Presses SEND
```

**What happens behind the scenes:**

```
Frontend sends:
{
  "channel_id": "messaging:lst_001-user_36IcC3uo7Ch...",
  "text": "Can you ship to Canada?",
  "type": "inquiry"
}
     ↓
Server receives request
     ↓
✅ Saves message to MongoDB (Database) with status="sent"
     ↓
✅ Sends to GetStream
     ↓
GetStream status: "delivered"
     ↓
Server updates Database: status="delivered"
```

### STEP 2: Seller Gets Instant Notification

**What seller experiences:**

```
Seller's phone vibrates/notification sound
     ↓
"New message in: Rolex Submariner 126610LN"
     ↓
Seller opens app
     ↓
Sees message: "Can you ship to Canada?"
     ↓
GetStream shows it as UNREAD
```

**Behind the scenes:**

```
GetStream webhook calls our server:

POST /api/v1/networks/webhooks/getstream

{
  "type": "message.created",
  "message": {
    "id": "msg_123456",
    "text": "Can you ship to Canada?",
    "sender": "user_36IdtjemE0A...",
    "channel": "messaging:lst_001-user_36IcC3uo7Ch..."
  }
}

Our server:
├─ Verifies webhook signature (it's really from GetStream)
├─ Inserts message to Database if not already there
└─ Updates unread counts
```

### STEP 3: Seller Types Reply

**What seller does:**

```
Seller starts typing: "Yes, I ship..."
     ↓
Buyer's phone gets instant update:
"alex_carter is typing..."
Note: Typing happens LIVE, no waiting!
```

**Behind the scenes:**

```
When seller types, GetStream detects it
     ↓
GetStream broadcasts to buyer's phone via WebSocket:
{
  "type": "typing.start",
  "user": "alex_carter"
}
     ↓
Buyer's app shows: "alex_carter is typing..."
     (This is instant! No delay!)
```

### STEP 4: Seller Sends Reply

**What seller does:**

```
Seller sends: "Yes, I ship worldwide! Cost is $50 to Canada"
```

**Behind the scenes:**

```
Server:
├─ Creates new message object
├─ Saves to Database: status="sent"
├─ Sends to GetStream: "Please deliver this"
├─ GetStream confirms: "Delivered and stored"
└─ Updates Database: status="delivered"

GetStream broadcasts to buyer:
⚡ Instant delivery via WebSocket
├─ Buyer's phone: "New message from alex_carter"
├─ Message appears on screen instantly
└─ Green checkmark shows it's delivered
```

### STEP 5: Buyer Reads Message

**What buyer does:**

```
Opens the message, reads it
```

**Behind the scenes:**

```
Buyer's app tells GetStream: "I read this message"
     ↓
GetStream webhook calls our server:
{
  "type": "message.read",
  "message_id": "msg_123456",
  "user_id": "user_36IdtjemE0A..."
}
     ↓
Our server updates Database: status="read"
     ↓
Seller's phone gets update: Double checkmark ✓✓
     Meaning: "Seller read your message"
```

## Complete Flow Diagram

```
BUYER                          SELLER
  │                              │
  │─── Opens app ────────────────│
  │                              │
  │─── Gets Token ────────────────│
  │    (Permission to chat)       │
  │                              │
  │─── Sends message ────────────┤
  │    ├─ Saves locally          │
  │    ├─ Saves to Server        │
  │    └─ Sends to GetStream ────→ GetStream
  │                              │
  │                              │ GetStream
  │                              │   ├─ Stores message
  │                              │   ├─ Delivers instantly
  │                              │   └─ Webhook: tells server
  │                              │
  │                         ← Received!
  │                              │
  │                         Seller reads
  │                              │
  │                              │ GetStream
  │                              │   └─ Webhook: "Message read"
  │                              │       Tells server
  │                              │
  │ ← Server updates             │
  │   Double checkmark ✓✓        │
  │                              │
```

---

---

# 5 · THE CODEBASE STRUCTURE

## Where Everything Lives

```
src/networks/  (The Chat System)
│
├─ routes/
│  ├─ chatRoutes.ts ..................... URL paths for chat actions
│  ├─ messageRoutes.ts .................. URL paths for messages
│  └─ conversationRoutes.ts ............. URL paths for conversation list
│
├─ handlers/
│  ├─ NetworksChatHandlers.ts ........... Handles: "Get token", "Create channel"
│  ├─ NetworksMessageHandlers.ts ........ Handles: "Send message", "Mark read"
│  └─ NetworksConversationHandlers.ts ... Handles: "Get conversations", "Search"
│
├─ services/
│  ├─ NetworksChannelService.ts ......... Creates and manages chat channels
│  ├─ NetworksMessageService.ts ......... Sends and stores messages
│  └─ NotificationService.ts ............ Handles notifications
│
├─ models/
│  ├─ NetworkListingChannel.ts .......... Data structure for a chat channel
│  │                                    (stores: buyer, seller, messages)
│  │
│  └─ (MongoDB database records)
│
├─ repositories/
│  └─ NetworksChannelRepository.ts ...... Talks to database
│                                      (saves, loads, updates channels)
│
└─ middleware/
   └─ (Authentication, validation, etc.)
```

## What Each Layer Does

### 🌐 Routes Layer (URLs)

```
User clicks "Send message"
    ↓
Request goes to: POST /api/v1/networks/messages/send
    ↓
Router looks at routes/messageRoutes.ts
    ↓
Finds handler: "sendMessage"
```

**File**: `routes/messageRoutes.ts`

```typescript
router.post("/send", messageHandlers.sendMessage);
```

This means: "When someone POSTs to /messages/send, run sendMessage function"

### 🛠️ Handlers Layer (The Logic)

```
sendMessage function gets the request
    ↓
Does the actual work:
├─ Check if user is authenticated
├─ Validate the message content
├─ Verify user is in the channel
└─ Call the service to send
```

**File**: `handlers/NetworksMessageHandlers.ts`

```typescript
export const sendMessage = async (req, res) => {
  // 1. Get auth info from JWT
  const auth = req.auth;

  // 2. Extract message from request
  const { channel_id, text } = req.body;

  // 3. Find user in database
  const user = await User.findOne({ external_id: auth.userId });

  // 4. Verify user is in channel
  const channel = await networksChannelService.getChannel(channel_id, user._id);

  // 5. Call service to send
  const result = await sendMessage({
    channel_id,
    sender_id: user._id,
    text,
  });

  // 6. Return result to user
  res.json({ success: true, message_id: result.id });
};
```

### 📦 Services Layer (The Workers)

```
Service receives: "Send this message to this channel"
    ↓
├─ Create message object
├─ Save to MongoDB (Database)
├─ Send to GetStream
├─ Wait for GetStream response
└─ Return success/failure
```

**File**: `services/NetworksMessageService.ts`

```typescript
async sendMessage(params) {
  // 1. Create new message
  const message = new ChatMessage({
    channel_id: params.channel_id,
    sender_id: params.sender_id,
    text: params.text,
    status: "sent"  // Saved but not delivered yet
  });

  // 2. Save to MongoDB
  await message.save();

  // 3. Send to GetStream
  try {
    const streamResult = await getStreamClient
      .channel('messaging', params.channel_id)
      .sendMessage({ text: params.text });

    // 4. Update status to "delivered"
    message.status = "delivered";
    message.stream_message_id = streamResult.message.id;
    await message.save();

  } catch (error) {
    // 5. If GetStream fails, keep status as "sent"
    // (we'll retry later)
    console.error("GetStream failed", error);
  }

  return message;
}
```

### 💾 Repositories Layer (Database Helpers)

```
Service says: "I need to save this to database"
    ↓
Repository handles the actual database operation
```

**File**: `repositories/NetworksChannelRepository.ts`

```typescript
class NetworksChannelRepository {
  // Save channel
  async save(channel) {
    return await NetworkListingChannel.create(channel);
  }

  // Find channel by ID
  async findById(id) {
    return await NetworkListingChannel.findById(id);
  }

  // Check if user is in channel
  async isMember(channelId, userId) {
    const channel = await this.findById(channelId);
    return channel.buyer_id === userId || channel.seller_id === userId;
  }
}
```

### 📊 Models Layer (Data Structures)

```
What does a channel look like?
What does a message look like?
```

**File**: `models/NetworkListingChannel.ts`

```typescript
interface INetworkListingChannel {
  _id: ID; // Unique ID
  listing_id: ID; // Which listing (watch, car, etc.)
  buyer_id: ID; // Who's buying
  seller_id: ID; // Who's selling
  status: "open" | "closed"; // Is chat active?
  created_at: Date; // When was channel created?
  inquiry: {
    // Initial question
    sender_id: ID;
    message: string;
    createdAt: Date;
  };
  offer_history: [
    // All offers sent
    {
      sender_id: ID;
      amount: number;
      message: string;
      createdAt: Date;
    },
  ];
}
```

---

---

# 6 · DATABASE STORAGE (MONGODB)

## What Gets Stored in Our Database?

We save **two types** of documents to MongoDB:

### Type 1: Channels (Chat Rooms)

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "listing_id": "lst_001",
  "buyer_id": "user_36IdtjemE0A...",
  "seller_id": "user_36IcC3uo7Ch...",
  "status": "open",
  "created_at": "2026-03-27T11:00:00Z",

  "listing_snapshot": {
    "title": "Rolex Submariner 126610LN",
    "price": 14500,
    "condition": "Used - Very Good",
    "thumbnail": "https://..."
  },

  "inquiry": {
    "sender_id": "user_36IdtjemE0A...",
    "message": "Can you ship to Canada?",
    "createdAt": "2026-03-27T11:05:00Z"
  },

  "offer_history": [
    {
      "sender_id": "user_36IdtjemE0A...",
      "amount": 13000,
      "message": "Can you do $13k?",
      "status": "sent",
      "createdAt": "2026-03-27T12:00:00Z"
    },
    {
      "sender_id": "user_36IcC3uo7Ch...",
      "amount": 14000,
      "message": "Best I can do",
      "status": "sent",
      "createdAt": "2026-03-27T12:30:00Z"
    }
  ]
}
```

**What We Use This For:**

- 📜 Show chat history even if GetStream is down
- 🔍 Search conversations by keyword
- 📊 Show list of all chats in user's inbox
- 💾 Permanent backup of all messages

### Type 2: Messages

```json
{
  "_id": "msg_507f1f77bcf86cd799439012",
  "stream_channel_id": "messaging:lst_001-user_36IcC3uo7Ch...",
  "text": "Can you ship to Canada?",

  "sender_id": "user_36IdtjemE0A...",
  "sender_clerk_id": "user_36IdtjemE0A...",

  "type": "inquiry", // Types: inquiry, offer, regular, system
  "status": "delivered", // sent → delivered → read

  "listing_id": "lst_001",
  "stream_message_id": "msg_123456", // GetStream's message ID

  "created_at": "2026-03-27T11:05:00Z",
  "updated_at": "2026-03-27T11:05:30Z"
}
```

**What We Use This For:**

- ✅ Backup if GetStream is slow
- 🔐 Proving messages were sent/received (legal protection)
- 🔍 Searching messages by content
- 📈 Analytics (message counts, activity)

## How GetStream and MongoDB Work Together

```
Message Flow:

User sends: "Is this available?"
    ↓
├─ Save to MongoDB immediately (status="sent")
│  └─ "We have this message, it's saved"
│
├─ Send to GetStream (status="delivering")
│  └─ "Trying to deliver..."
│
└─ GetStream responds (status="delivered")
   └─ "Got it! Message delivered to recipient"
   └─ Update MongoDB: status="delivered"

If something goes wrong:
────────────────────────

GetStream is slow:
├─ Message still in MongoDB
├─ Message delivered later from database
└─ User doesn't notice any delay

GetStream is down:
├─ Message saved in MongoDB (status="sent")
├─ Server uses retry system
├─ Tries GetStream again every minute
└─ When GetStream comes back Online: All messages delivered

Both systems down:
├─ Message NOT sent (user sees error)
└─ "Network error - please try again"
```

---

---

# 7 · HOW MESSAGES ARE SYNCED

## The Two-Way Sync System

### 🔄 Frontend → GetStream → Database

When you send a message:

```
1️⃣ Your phone sends:
   POST /api/v1/networks/messages/send
   { channel_id, text }

2️⃣ Server (Handler):
   ├─ Gets request
   ├─ Checks if you're authenticated
   ├─ Checks if you're in the channel
   └─ Calls the Service

3️⃣ Service:
   ├─ Creates message object
   ├─ Saves to MongoDB (Backup)
   ├─ Sends to GetStream
   ├─ Waits for response
   └─ Returns success

4️⃣ GetStream:
   ├─ Receives message
   ├─ Stores in its database
   ├─ Delivers to recipient (instant via WebSocket)
   ├─ Sends webhook to our server
   └─ Returns message with ID

5️⃣ Server updates MongoDB:
   ├─ Gets webhook from GetStream
   ├─ Confirms message was delivered
   ├─ Updates status to "delivered"
   └─ Updates stream_message_id
```

### 🔄 GetStream → Webhook → Database

When a message is sent:

```
GetStream detects new message
    ↓
GetStream calls our webhook: POST /api/v1/networks/webhooks/getstream
    ↓
Sends JSON:
{
  "type": "message.created",
  "message": {
    "id": "msg_123456",
    "text": "Can you ship to Canada?",
    "user_id": "user_36IdtjemE0A...",
    "channel": "messaging:lst_001-..."
  }
}
    ↓
Our server receives it:
├─ Verifies it's really from GetStream (signature check)
├─ Checks: Is this message already in database?
│   ├─ If NO: Insert new message
│   └─ If YES: Do nothing (idempotent)
├─ Updates unread counts
└─ Returns: { success: true }
```

## The "Idempotent" System (Never Duplicate)

**Problem**: What if GetStream calls the webhook twice?

```
GetStream: "New message from collector_x"
Webhook called TWICE by mistake
    ↓
Without Idempotent:
└─ Message appears TWICE in database (Oops!)

With Idempotent:
├─ First call: "Message doesn't exist → Save it"
├─ Second call: "Message already exists → Do nothing"
└─ Result: Message appears ONCE (Correct!)
```

**Our code does this:**

```typescript
export const webhookHandler = async (req, res) => {
  const message = req.body.message;

  // Check if message already in database
  const existing = await ChatMessage.findOne({
    stream_message_id: message.id, // GetStream's unique ID
  });

  if (existing) {
    // Already have it, do nothing
    return res.json({ success: true, action: "skipped" });
  }

  // Don't have it, save it
  await ChatMessage.create({
    stream_message_id: message.id,
    text: message.text,
    sender_id: message.user_id,
    status: "delivered",
  });

  return res.json({ success: true, action: "created" });
};
```

---

---

# 8 · REAL-WORLD EXAMPLES

## Example 1: Buyer Asks a Question

### What Happens:

```
1. Buyer opens listing for "Rolex Watch"
2. Clicks "Ask a Question"
3. Types: "Is it still available?"
4. Clicks SEND
```

### Behind the Scenes (Technical Flow):

```
FRONTEND (Buyer's Phone)
│
├─ User taps SEND
│
├─ App creates request:
│  POST /api/v1/networks/messages/send
│  Body: {
│    channel_id: "messaging:lst_001-seller123",
│    text: "Is it still available?"
│  }
│
└─ Sends to Server

BACKEND (Our Server)
│
├─ Message Handler receives request
│
├─ Validates:
│  ├─ Is buyer logged in? ✓ Yes
│  ├─ Is channel_id valid? ✓ Yes
│  ├─ Is buyer in this channel? ✓ Yes
│  └─ Is message not empty? ✓ Yes
│
├─ Service: Send Message
│  ├─ Create message in MongoDB:
│  │  {
│  │    text: "Is it still available?",
│  │    sender: buyer_id,
│  │    status: "sent",
│  │    channel: "messaging:lst_001-..."
│  │  }
│  │
│  ├─ Send to GetStream:
│  │  "Please deliver this message to seller123"
│  │
│  └─ GetStream responds:
│     "Got it! ID is msg_abc123"
│
├─ Update MongoDB:
│  status: "delivered"
│  stream_message_id: "msg_abc123"
│
└─ Send response to frontend:
   {
     success: true,
     message: {
       id: "msg_abc123",
       text: "Is it still available?",
       status: "delivered"
     }
   }

GETSTREAM (Chat Service)
│
├─ Receives message
│
├─ Stores in GetStream database
│
├─ Broadcasts to seller's phone:
│  "New message from collector_x: Is it still available?"
│
└─ Calls our webhook:
   POST /api/v1/networks/webhooks/getstream
   {
     type: "message.created",
     message: { ... }
   }

SELLER'S PHONE
│
├─ GetStream SDK receives broadcast
│
├─ Phone vibrates/sounds notification
│
├─ Message appears in chat:
│  "collector_x: Is it still available?"
│
└─ Status: UNREAD (blue dot)

SELLER SEES:
┌─────────────────────────────────┐
│ Rolex Submariner (listing)        │
│                                  │
│ collector_x: Is it still available? │
│ ← unread (blue dot)             │
│                                  │
│ [type reply...]                 │
└─────────────────────────────────┘
```

## Example 2: Seller Replies and Buyer Reads It

### What Happens:

```
1. Seller reads the question
2. Types reply: "Yes, still available! Free shipping!"
3. Presses SEND
4. Buyer's phone notifies instantly
5. Buyer opens message
6. Seller sees ✓✓ (read receipt)
```

### Behind the Scenes:

```
SELLER SENDS MESSAGE
════════════════════

Seller types: "Yes, still available! Free shipping!"
                    ↓
Same flow as before:
├─ Save to MongoDB
├─ Send to GetStream
├─ GetStream delivers to buyer
└─ Webhook confirms

BUYER RECEIVES (Instant!)
═════════════════════════

Buyer's phone gets WebSocket message from GetStream:
"New message from alex_carter"
                    ↓
Buyer opens chat, sees:
"alex_carter: Yes, still available! Free shipping!"
                    ↓
Message shows: ✓ (delivered, but not read yet)


BUYER READS MESSAGE
═══════════════════

Buyer taps on message to read it
                    ↓
Frontend calls:
POST /api/v1/networks/messages/{messageId}/read
                    ↓
Server:
├─ Updates MongoDB: status="read"
├─ Tells GetStream: "This user read message"
└─ GetStream broadcasts to seller

SELLER SEES ✓✓
═════════════

Seller's phone gets update from GetStream:
"buyer read your message"
                    ↓
Seller's chat now shows:
"alex_carter: Yes, still available! Free shipping!"
✓✓ ← Double checkmark (message read!)
```

---

---

# 9 · TROUBLESHOOTING COMMON ISSUES

## Issue 1: Message Not Sending

**What user sees:**

```
"Sending..."
(spinner keeps spinning)
```

**Possible Causes & Fixes:**

| Problem                 | Why                          | Fix                                |
| ----------------------- | ---------------------------- | ---------------------------------- |
| **No internet**         | Phone not connected          | Check WiFi/data                    |
| **GetStream down**      | Service unavailable          | Wait 5 minutes, try again          |
| **User not in channel** | Kicked out or channel closed | Ask seller to create new channel   |
| **Token expired**       | JWT token only lasts 1 hour  | Close app, reopen to refresh token |
| **App bug**             | Glitch in frontend code      | Refresh app or restart phone       |

**What's happening technically:**

```
Message saved to Database: ✓
Message sent to GetStream: ✗ (FAILED)
├─ GetStream not responding
├─ Server catches error
├─ Message status = "sent" (not yet delivered)
└─ App shows spinner (waiting for delivery)

Solution:
├─ GetStream comes back online
├─ Retry system sends message again
├─ Gets delivered within 1-5 minutes
└─ App updates spinner → checkmark
```

## Issue 2: Can't See Old Messages

**What user sees:**

```
"No messages found"
(but should have chat history)
```

**Possible Causes & Fixes:**

| Problem                  | Why                        | Fix                            |
| ------------------------ | -------------------------- | ------------------------------ |
| **Channel deleted**      | Seller closed conversation | Ask to reopen or create new    |
| **Wrong listing**        | Viewing different item     | Make sure you're in right chat |
| **Browser/app cache**    | Old data showing           | Clear app cache, restart       |
| **GetStream sync issue** | Messages not synced        | Refresh page (messages in DB)  |

**What's happening technically:**

```
User requests old messages:
GET /api/v1/networks/messages/{channelId}
                    ↓
Server checks:
├─ GetStream for recent messages (fast)
├─ MongoDB for old messages (backup)
└─ Merges both lists

If GetStream slow:
├─ Server loads from MongoDB
├─ Returns to user
└─ GetStream catches up later

If both empty:
├─ Channel has no messages
└─ Maybe wrong channel?
```

## Issue 3: Notifications Not Working

**What user experiences:**

```
Messages received but no notification sound/vibration
```

**Possible Causes & Fixes:**

| Problem                     | Why                  | Fix                                   |
| --------------------------- | -------------------- | ------------------------------------- |
| **Phone notifications OFF** | OS-level setting     | Settings → Notifications → Enable     |
| **App notifications OFF**   | App-level setting    | App Settings → Notifications → Enable |
| **Muted channel**           | User muted this chat | Unmute in channel settings            |
| **Do Not Disturb on**       | Phone in quiet mode  | Toggle off Do Not Disturb             |

**What's happening technically:**

```
Message received by phone:
GetStream → WebSocket → Browser/App
                    ↓
App checks:
├─ Are notifications enabled in OS?
├─ Are notifications enabled in app?
├─ Is channel muted?
└─ Is Do Not Disturb on?

All must be YES to show notification

If any is NO:
└─ Message received but silent
```

## Issue 4: Message Showing as Unread When I Read It

**What user sees:**

```
"alex_carter: Hello!"
(blue dot: unread)

User clicks to read it, but dot stays blue
```

**Possible Causes & Fixes:**

| Problem                   | Why                                  | Fix                |
| ------------------------- | ------------------------------------ | ------------------ |
| **Read receipt not sent** | Phone couldn't connect               | Refresh page       |
| **Offline read**          | Read offline, can't sync when online | Go back online     |
| **App bug**               | Frontend not updating UI             | Close & reopen app |

**Technical explanation:**

```
When you read a message:

Frontend:
├─ User clicks message
├─ Shows message content
└─ Calls: POST /messages/{id}/read

Server:
├─ Updates MongoDB: status="read"
├─ Tells GetStream: "Mark as read"
└─ Returns: { success: true }

GetStream:
├─ Updates its database
├─ Broadcasts to sender: "Message read"
└─ Sends webhook to us

Sender's phone:
├─ Gets update from GetStream
├─ Shows ✓✓ (read receipt)
└─ Shows blue dot gone

If it doesn't work:
├─ WebSocket connection weak
├─ /read endpoint not called
└─ Fix: Refresh page or restart app
```

## Issue 5: One Message is Missing

**What user sees:**

```
Message #1: "Hello seller"
Message #3: "Are you there?"
(Message #2 is missing!)
```

**Possible Causes & Fixes:**

| Problem             | Why                              | Fix                            |
| ------------------- | -------------------------------- | ------------------------------ |
| **Message deleted** | Sender deleted it                | It's gone (by sender's choice) |
| **Message flagged** | System hid inappropriate content | Contact support                |
| **Sync glitch**     | Temporary sync issue             | Refresh page (should reappear) |

**Technical explanation:**

```
GetStream and MongoDB sync flow:

Normal:
GetStream ↔ Webhook → MongoDB
Both have same messages ✓

Glitch:
GetStream ↔ [Webhook fails]
│          ↑
└────────── (message not in MongoDB)

Result:
├─ GetStream shows message ✓
├─ MongoDB doesn't have it ✗
└─ Depending on load, user might miss it

Fix:
├─ Retry webhook system runs
├─ Webhook succeeds
├─ MongoDB now has message
└─ Next refresh shows message
```

---

---

# SUMMARY: SIMPLE VERSION

## How Chat Works (In 30 Seconds)

1. **You send message** → Saved to our database
2. **Sent to GetStream** → Delivers instantly to other person
3. **Other person gets it** → Notification appears on their phone
4. **They read it** → You see checkmark on your end
5. **All stored safely** → In both database and GetStream

## The Two Storage System (Why?)

```
Database (MongoDB)     GetStream (Real-Time Service)
├─ Slow but safe       ├─ Fast and responsive
├─ Long-term storage   ├─ Instant delivery
├─ Can search          ├─ Shows typing, online status
└─ Backup              └─ Handles WebSocket connection
```

## Webhooks (Simple Version)

```
Instead of: "Is anything new?" every second (annoying, slow)
We use: GetStream says "Hey, message arrived!" (one-time event)
```

## The Task & The Code

```
User Action          Route                          Handler
────────────────────────────────────────────────────
Send message    → /messages/send            → sendMessage()
Get token       → /chat/token               → generateToken()
Create channel  → /chat/channel             → getOrCreateChannel()
List chats      → /conversations            → getConversations()
Search chats    → /conversations/search     → searchConversations()
```

Each handler:

1. Checks if user is logged in
2. Does the action (save, send, fetch)
3. Returns result to frontend

## Files You Need to Know

| File                                  | What It Does                                             |
| ------------------------------------- | -------------------------------------------------------- |
| `routes/chatRoutes.ts`                | Defines URL paths `/chat/token`, `/chat/channel`         |
| `routes/messageRoutes.ts`             | Defines URL paths `/messages/send`, `/messages/:id/read` |
| `handlers/NetworksChatHandlers.ts`    | The logic for getting tokens and channels                |
| `handlers/NetworksMessageHandlers.ts` | The logic for sending and reading messages               |
| `services/NetworksChannelService.ts`  | Worker that creates/manages channels                     |
| `services/NetworksMessageService.ts`  | Worker that sends/manages messages                       |
| `models/NetworkListingChannel.ts`     | What a channel looks like in database                    |

---

## 🎯 Key Insight

**GetStream handles the hard technical stuff:**

- ✅ Real-time delivery
- ✅ Online/offline status
- ✅ Typing indicators
- ✅ Read receipts
- ✅ Scaling to millions of users

**Our database handles the practical stuff:**

- ✅ Permanent storage
- ✅ Search & history
- ✅ Backup if GetStream is slow
- ✅ Legal/compliance records

**Together they're powerful**: **Instant AND Reliable**

---

**Made Simple** · No Jargon · April 2026
