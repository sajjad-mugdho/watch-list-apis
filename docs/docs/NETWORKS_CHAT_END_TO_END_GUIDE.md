# Networks Chat System — End-to-End Implementation Guide

**Date:** April 7, 2026  
**Audience:** Frontend developers integrating Networks chat functionality  
**Architecture:** GetStream Chat + MongoDB + Express backend

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture & Data Flow](#architecture--data-flow)
3. [Frontend Implementation Steps](#frontend-implementation-steps)
4. [API Reference](#api-reference)
5. [Real-Time Integration](#real-time-integration)
6. [Context & Metadata](#context--metadata)
7. [Shared Content (Media/Files/Links)](#shared-content-mediaffiles-links)
8. [Error Handling & Recovery](#error-handling--recovery)
9. [Code Examples](#code-examples)

---

## System Overview

The Networks chat system is built on three layers:

```
┌─────────────────────────────────────────┐
│         Frontend (React/Web)             │
│  - GetStream SDK client                  │
│  - Message UI, thread rendering          │
└──────────────┬──────────────────────────┘
                │
┌──────────────┴──────────────────────────┐
│      Backend Express API (Port 3001)     │
│  - Token generation                      │
│  - Channel management                    │
│  - Context enrichment                    │
│  - Message history                       │
└──────────────┬──────────────────────────┘
                │
        ┌───────┴────────┬────────────┐
        │                │            │
    ┌───▼────┐      ┌───▼────┐  ┌──▼───┐
    │GetStream│      │MongoDB │  │Redis │
    │  Chat   │      │  Msgs  │  │Cache │
    │ (Real   │      │Orders  │  │      │
    │-time)   │      │Offers  │  │      │
    └────────┘      └────────┘  └──────┘
```

**Key Components:**

- **GetStream Chat:** Real-time messaging, presence, read states, reactions
- **MongoDB:** Message persistence, business context (orders, offers, listings)
- **Redis:** Caching channel lists, unread counts
- **ChannelContextService:** Enriches channels with business logic (order status, offer details, etc.)

---

## Architecture & Data Flow

### Step 1: Authentication & Token Exchange

```
Frontend                Backend               GetStream
   │                      │                      │
   ├─ POST /chat/token ──>│                      │
   │                      ├─ createUserToken ──> │
   │                      │ (JWT + user sync)    │
   │ <─ {token, userId} ──┤                      │
   │                      │                      │
```

**Backend:**

- Endpoint: `POST /networks/chat/token`
- Validates auth token from JWT middleware
- Creates/updates user in GetStream
- Returns JWT token for client-side authentication

**Frontend:**

- Call on app load/login
- Pass token to GetStream client initialization
- Store userId for subsequent API calls

### Step 2: Fetch Conversation List

```
Frontend                Backend               MongoDB/Redis
   │                      │                      │
   ├ GET /messages/chats ─>│                     │
   │                      ├─ queryChannels ────> │
   │                      │ (GetStream API)      │
   │                      │                      │
   │                      │ <─ [channels] ──────┤
   │                      │                      │
   │ <─ {data: chats} ────┤                      │
   │    (paginated)       │                      │
```

**Backend:**

- Route: `GET /messages/chats?limit=20&offset=0`
- Calls GetStream `queryChannels` filtered by user membership
- Returns minimal channel data for list view

**Response:**

```json
{
  "data": [
    {
      "id": "channel_hash_1",
      "type": "messaging",
      "cid": "messaging:channel_hash_1",
      "listing_id": "listing_xyz",
      "listing_title": "iPhone 15",
      "listing_price": 999,
      "listing_thumbnail": "https://...",
      "members": ["user1", "user2"],
      "last_message_at": "2026-04-07T10:30:00Z",
      "unread_count": 3
    }
  ],
  "_metadata": {
    "limit": 20,
    "offset": 0,
    "total": 47
  }
}
```

### Step 3: Get Conversation Details & Context

```
Frontend                Backend               MongoDB
   │                      │                      │
   ├ GET /messages/conv/─>│                      │
   │     context?id=xyz   ├─ getChannelContext ──>│
   │                      │                      │
   │                      │ <─ {context} ───────┤
   │ <─ {data, context} ──┤                      │
   │    (enriched)        │                      │
```

**Backend:**

- Route: `GET /messages/conversation-context?id=<channelId>`
- Looks up channel in MongoDB
- Enriches with business context: order, offer, reference check, etc.
- Verifies user authorization (must be channel party)

**Response:**

```json
{
  "data": {
    "channelId": "channel_hash_1",
    "getstreamChannelId": "messaging:channel_hash_1",
    "platform": "networks",
    "parties": [
      {
        "id": "buyer_id",
        "displayName": "John",
        "avatar": "...",
        "role": "buyer"
      },
      {
        "id": "seller_id",
        "displayName": "Jane",
        "avatar": "...",
        "role": "seller"
      }
    ],
    "listing": {
      "id": "listing_xyz",
      "brand": "Apple",
      "model": "iPhone 15",
      "price": 999,
      "currency": "USD",
      "thumbnail": "https://..."
    },
    "activeOffer": {
      "id": "offer_1",
      "state": "pending",
      "amount": 850,
      "expiresAt": "2026-04-14T10:00:00Z",
      "isExpired": false
    },
    "order": {
      "id": "order_1",
      "status": "reserved",
      "amount": 850,
      "paidAt": null,
      "shippedAt": null
    },
    "referenceCheck": {
      "id": "ref_check_1",
      "status": "active",
      "responseCount": 2,
      "vouchCount": 1
    }
  }
}
```

### Step 4: Load Message History

```
Frontend (GetStream)    Backend              MongoDB
   │                      │                    │
   ├─ queryMessages ─────>│                    │
   │ (GetStream SDK)      │                    │
   │                      ├─ getChannelMessages│
   │                      │                    │
   │ <─ [messages] ──────┬┴──────────────────┤
   │    (real-time)      │  (paginated)       │
   │                      │                    │
```

**Frontend:**

- Use GetStream client directly for messages
- SDK handles pagination and real-time sync
- Automatic presence + read receipts

**Backend (for history when needed):**

- Route: `GET /messages/channel/:channelId?limit=50&offset=0`
- Fetches from MongoDB ChatMessage collection
- Returns paginated with thread support

### Step 5: Send Message & Real-Time Sync

```
Frontend (App)         Frontend (GetStream)    Backend         MongoDB
   │                      │                      │                │
   ├─ sendMessage ───────>│                      │                │
   │ (GetStream SDK)      ├─ Send to Stream ────>│                │
   │                      │                      ├─ Webhook ─────>│
   │                      │ <─ ACK ─────────────┤ (save msg)     │
   │ <─ {message} ────────┤                      │ <─ confirm ───┤
   │    (optimistic)      │                      │                │
   │                      ├─ Subscribe ─────────┐                 │
   │ <─ realtime events ──┤ (typing, read, etc.)│                 │
```

**Frontend Flow:**

1. Call GetStream `sendMessage()` for optimistic UI updates
2. GetStream delivers to server
3. Backend webhook receives and stores in MongoDB
4. Other clients receive real-time event via GetStream subscription
5. Auto-retry if delivery fails

**Message Payload:**

```json
{
  "channel_id": "messaging:channel_hash_1",
  "text": "What's the lowest you can go?",
  "type": "regular",
  "attachments": [],
  "custom_data": {
    "offer_context": { "id": "offer_1" },
    "order_context": { "id": "order_1" }
  }
}
```

---

## Frontend Implementation Steps

### Phase 1: Setup & Authentication

#### 1a. Initialize GetStream Client

```typescript
import { StreamChat } from "stream-chat";

// Replace with your actual API key
const apiKey = process.env.REACT_APP_GETSTREAM_API_KEY;

// Create client instance (do this once, store as global/context)
const client = StreamChat.getInstance(apiKey);
```

#### 1b. Generate Token & Connect

```typescript
import { useEffect, useState } from "react";

export function useStreamAuth() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function initStream() {
      try {
        // 1. Get token from backend
        const response = await fetch("/api/v1/networks/chat/token", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (!response.ok) throw new Error("Token fetch failed");

        const { token, userId } = await response.json();

        // 2. Connect client
        await client.connectUser(
          {
            id: userId,
            name: currentUser.displayName,
          },
          token,
        );

        setIsReady(true);
      } catch (err) {
        setError(err);
        console.error("Stream auth failed:", err);
      }
    }

    initStream();

    // Cleanup on unmount
    return () => {
      client.disconnectUser();
    };
  }, [authToken]);

  return { isReady, error };
}
```

### Phase 2: Conversation List

#### 2a. Fetch Conversation List

```typescript
export async function fetchConversations(limit = 20, offset = 0) {
  const response = await fetch(
    `/api/v1/networks/messages/chats?limit=${limit}&offset=${offset}`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  );

  if (!response.ok) throw new Error("Failed to fetch conversations");

  return response.json(); // { data, _metadata }
}
```

#### 2b. Render Conversation List

```typescript
import React, { useEffect, useState } from 'react';

export function ConversationList() {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetchConversations();
        setConversations(response.data);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  if (isLoading) return <div>Loading conversations...</div>;

  return (
    <div className="conversation-list">
      {conversations.map(conv => (
        <ConversationCard
          key={conv.id}
          conversation={conv}
          onSelect={selectConversation}
        />
      ))}
    </div>
  );
}

function ConversationCard({ conversation, onSelect }) {
  return (
    <div
      className="conversation-card"
      onClick={() => onSelect(conversation)}
    >
      <img
        src={conversation.listing_thumbnail}
        alt={conversation.listing_title}
        className="listing-thumb"
      />
      <div className="conversation-info">
        <h3>{conversation.listing_title}</h3>
        <p className="price">${conversation.listing_price}</p>
        <p className="members">
          {conversation.members.length} members
        </p>
        {conversation.unread_count > 0 && (
          <span className="badge">{conversation.unread_count}</span>
        )}
      </div>
      <time>{formatDate(conversation.last_message_at)}</time>
    </div>
  );
}
```

### Phase 3: Conversation Details & Context

#### 3a. Fetch Channel Context

```typescript
export async function fetchChannelContext(channelId) {
  const response = await fetch(
    `/api/v1/networks/messages/conversation-context?id=${channelId}`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  );

  if (!response.ok) throw new Error("Failed to fetch context");

  return response.json();
}
```

#### 3b. Display Context Panel

```typescript
function ContextPanel({ context }) {
  if (!context) return null;

  return (
    <aside className="context-panel">
      {/* Listing Info */}
      <section>
        <h4>Listing</h4>
        <div className="listing-info">
          <img src={context.listing.thumbnail} alt="listing" />
          <div>
            <h5>{context.listing.brand} {context.listing.model}</h5>
            <p className="price">${context.listing.price} {context.listing.currency}</p>
            <p className="condition">Condition: {context.listing.condition}</p>
          </div>
        </div>
      </section>

      {/* Active Offer */}
      {context.activeOffer && (
        <section>
          <h4>Active Offer</h4>
          <div className="offer-info">
            <p>
              <strong>${context.activeOffer.amount}</strong>
              {context.activeOffer.isExpired && <span className="expired">EXPIRED</span>}
            </p>
            <p>Expires: {formatDate(context.activeOffer.expiresAt)}</p>
            <p>Revision: {context.activeOffer.revisionNumber}</p>
            <p>Status: {context.activeOffer.state}</p>
          </div>
        </section>
      )}

      {/* Order Status */}
      {context.order && (
        <section>
          <h4>Order</h4>
          <div className="order-info">
            <StatusTimeline order={context.order} />
          </div>
        </section>
      )}

      {/* Reference Check */}
      {context.referenceCheck && (
        <section>
          <h4>Reference Check</h4>
          <div className="reference-info">
            <p>Status: {context.referenceCheck.status}</p>
            <p>Responses: {context.referenceCheck.responseCount}</p>
            <p>Vouches: {context.referenceCheck.vouchCount}</p>
          </div>
        </section>
      )}

      {/* Party Info */}
      <section>
        <h4>Participants</h4>
        <div className="parties">
          {context.parties.map(party => (
            <div key={party.id} className="party">
              <img src={party.avatar} alt={party.displayName} />
              <span>{party.displayName}</span>
              <span className="role">{party.role}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
```

### Phase 4: Message List & Real-Time Messaging

#### 4a. Setup Channel & Subscribe

```typescript
import { Channel } from "stream-chat";

export function useStreamChannel(channelId) {
  const [channel, setChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function setup() {
      try {
        // Get channel from GetStream
        const channels = await client.queryChannels(
          { id: channelId },
          { last_message_at: -1 },
        );

        if (channels.length === 0) {
          throw new Error("Channel not found");
        }

        const ch = channels[0];
        setChannel(ch);

        // Load initial messages
        const state = await ch.watch();
        setMessages(state.messages);

        // Subscribe to real-time events
        ch.on("message.new", handleNewMessage);
        ch.on("message.updated", handleUpdatedMessage);
        ch.on("message.deleted", handleDeletedMessage);
        ch.on("typing.start", handleTypingStart);
        ch.on("typing.stop", handleTypingStop);

        setIsLoading(false);
      } catch (error) {
        console.error("Channel setup failed:", error);
      }
    }

    setup();

    return () => {
      if (channel) {
        channel.stopWatching();
      }
    };
  }, [channelId]);

  const handleNewMessage = (event) => {
    setMessages((prev) => [...prev, event.message]);
  };

  const handleUpdatedMessage = (event) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === event.message.id ? event.message : msg)),
    );
  };

  const handleDeletedMessage = (event) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== event.message.id));
  };

  return { channel, messages, isLoading };
}
```

#### 4b. Render Messages

```typescript
function MessageList({ messages, currentUserId, channel }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="message-list">
      {messages.map(message => (
        <MessageBubble
          key={message.id}
          message={message}
          isOwn={message.user?.id === currentUserId}
          channel={channel}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function MessageBubble({ message, isOwn, channel }) {
  const [showReactions, setShowReactions] = useState(false);

  const handleReact = async (emoji) => {
    await channel.sendReaction(message.id, {
      type: emoji,
      emoji_code: emoji
    });
  };

  const handleDelete = async () => {
    await channel.deleteMessage(message.id);
  };

  const handleEdit = async (newText) => {
    await channel.updateMessage({
      ...message,
      text: newText
    });
  };

  return (
    <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
      {!isOwn && (
        <img
          src={message.user?.image}
          alt={message.user?.name}
          className="avatar"
        />
      )}

      <div className="message-content">
        {!isOwn && (
          <span className="sender-name">{message.user?.name}</span>
        )}

        <div className="message-text">
          {message.text}

          {/* Attachments */}
          {message.attachments?.map(att => (
            <Attachment key={att.id} attachment={att} />
          ))}
        </div>

        {/* Reactions */}
        {message.reaction_counts && (
          <div className="reactions">
            {Object.entries(message.reaction_counts).map(([emoji, count]) => (
              <span
                key={emoji}
                className="reaction"
                onClick={() => handleReact(emoji)}
              >
                {emoji} {count}
              </span>
            ))}
          </div>
        )}

        <time className="timestamp">
          {formatTime(message.created_at)}
        </time>
      </div>

      {isOwn && (
        <div className="message-actions">
          <button onClick={() => handleEdit('new text')}>Edit</button>
          <button onClick={() => setShowReactions(true)}>React</button>
          <button onClick={handleDelete}>Delete</button>
        </div>
      )}

      {showReactions && <ReactionPicker onSelect={handleReact} />}
    </div>
  );
}
```

#### 4c. Send Message Input

```typescript
import React, { useState } from 'react';

export function MessageInput({ channel, onMessageSent }) {
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachments, setAttachments] = useState([]);

  const handleTyping = (e) => {
    setText(e.target.value);

    // Notify others of typing
    if (!isTyping) {
      setIsTyping(true);
      channel.sendTypingEvent();
    }
  };

  const handleSend = async () => {
    if (!text.trim() && attachments.length === 0) return;

    try {
      // 1. Optimistic update in UI
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        text,
        attachments,
        user: { id: currentUserId },
        created_at: new Date(),
        status: 'sending'
      };

      onMessageSent(optimisticMessage);

      // 2. Send to GetStream
      const response = await channel.sendMessage({
        text,
        attachments: attachments.map(att => ({
          type: 'image',
          image_url: att.url,
          title: att.name
        }))
      });

      // 3. Update UI with server response
      onMessageSent({ ...response.message, status: 'sent' });

      // 4. Reset form
      setText('');
      setAttachments([]);
      setIsTyping(false);

      // 5. Stop typing notification
      await channel.stopTyping();
    } catch (error) {
      console.error('Failed to send message:', error);
      // Show error toast to user
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        // Upload to backend (which uploads to storage)
        const uploadResponse = await fetch('/api/v1/networks/upload', {
          method: 'POST',
          body: formData,
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const { url } = await uploadResponse.json();

        setAttachments(prev => [...prev, { url, name: file.name }]);
      }
    } catch (error) {
      console.error('File upload failed:', error);
    }
  };

  return (
    <div className="message-input">
      <div className="input-box">
        <textarea
          value={text}
          onChange={handleTyping}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          rows={3}
        />

        <div className="attachments-preview">
          {attachments.map(att => (
            <div key={att.url} className="attachment-preview">
              <img src={att.url} alt={att.name} />
              <button
                onClick={() => setAttachments(prev =>
                  prev.filter(a => a.url !== att.url)
                )}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="input-actions">
        <label className="file-upload">
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          📎 Attach
        </label>

        <button
          onClick={handleSend}
          disabled={!text.trim() && attachments.length === 0}
          className="send-btn"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

### Phase 5: Threading & Replies

```typescript
function MessageThread({ message, channel }) {
  const [threadMessages, setThreadMessages] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenThread = async () => {
    try {
      const response = await channel.getReplies(message.id);
      setThreadMessages(response.messages);
      setIsOpen(true);
    } catch (error) {
      console.error('Failed to load thread:', error);
    }
  };

  const handleReply = async (text) => {
    try {
      await channel.sendMessage({
        text,
        parent_id: message.id
      });

      // Reload thread
      const response = await channel.getReplies(message.id);
      setThreadMessages(response.messages);
    } catch (error) {
      console.error('Failed to send reply:', error);
    }
  };

  return (
    <>
      {message.reply_count > 0 && (
        <div className="thread-preview">
          <button onClick={handleOpenThread}>
            {message.reply_count} replies
          </button>
        </div>
      )}

      {isOpen && (
        <ThreadPanel
          parentMessage={message}
          replies={threadMessages}
          onReply={handleReply}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
```

---

## API Reference

### Chat Endpoints

#### Authentication

```
POST /api/v1/networks/chat/token
Headers: Authorization: Bearer {jwtToken}
Response: {
  token: string,
  userId: string,
  apiKey: string
}
```

#### Get Conversation List

```
GET /api/v1/networks/messages/chats?limit=20&offset=0
Headers: Authorization: Bearer {jwtToken}
Response: {
  data: ConversationCard[],
  _metadata: { limit, offset, total }
}
```

#### Get Conversation Context

```
GET /api/v1/networks/messages/conversation-context?id={channelId}
Headers: Authorization: Bearer {jwtToken}
Response: {
  data: ConversationContext,
  requestId: string
}
```

#### Get Channel Messages

```
GET /api/v1/networks/messages/channel/{channelId}?limit=50&offset=0
Headers: Authorization: Bearer {jwtToken}
Response: {
  data: Message[],
  _metadata: { limit, offset, total, next_token }
}
```

#### Send Message

```
POST /api/v1/networks/messages/send
Headers: Authorization: Bearer {jwtToken}
Body: {
  channel_id: string,
  text: string,
  type: 'regular' | 'inquiry' | 'offer' | ...,
  attachments?: Attachment[],
  custom_data?: object,
  parent_id?: string
}
Response: {
  data: Message,
  requestId: string
}
```

#### Update Message

```
PUT /api/v1/networks/messages/{messageId}
Headers: Authorization: Bearer {jwtToken}
Body: { text: string }
Response: { data: Message }
```

#### Delete Message

```
DELETE /api/v1/networks/messages/{messageId}
Headers: Authorization: Bearer {jwtToken}
Response: { success: boolean }
```

#### Mark Message Read

```
POST /api/v1/networks/messages/{messageId}/read
Headers: Authorization: Bearer {jwtToken}
Response: { success: boolean }
```

#### Mark Channel Read

```
POST /api/v1/networks/messages/channel/{channelId}/read-all
Headers: Authorization: Bearer {jwtToken}
Response: { success: boolean }
```

#### React to Message

```
POST /api/v1/networks/messages/{messageId}/react
Headers: Authorization: Bearer {jwtToken}
Body: { emoji: string }
Response: { data: ReactionEvent }
```

#### Get Shared Media

```
GET /api/v1/networks/messages/channel/{channelId}/media?type=image&limit=20
Headers: Authorization: Bearer {jwtToken}
Response: {
  data: SharedMediaItem[],
  _metadata: { type, total, offset, limit }
}
```

#### Get Unread Counts

```
GET /api/v1/networks/chat/unread
Headers: Authorization: Bearer {jwtToken}
Response: {
  data: {
    total_unread: number,
    unread_channels: number
  }
}
```

---

## Real-Time Integration

### GetStream Event Subscriptions

Frontend subscribes to these events automatically via GetStream SDK:

```typescript
// New message received
channel.on("message.new", (event) => {
  // { message, user, cid, type, created_at }
});

// Message edited
channel.on("message.updated", (event) => {
  // { message, user, cid }
});

// Message deleted
channel.on("message.deleted", (event) => {
  // { message, cid }
});

// User typing
channel.on("typing.start", (event) => {
  // { user, cid }
});

// User stops typing
channel.on("typing.stop", (event) => {
  // { user, cid }
});

// Message reaction added
channel.on("reaction.new", (event) => {
  // { reaction, message, user }
});

// Message reaction removed
channel.on("reaction.deleted", (event) => {
  // { reaction, message, user }
});

// User read message
channel.on("message.read", (event) => {
  // { user, cid }
});

// User presence change
client.on("user.presence.changed", (event) => {
  // { user, changes: { online, last_active } }
});
```

### Backend Webhooks (for persistence)

GetStream sends webhooks to backend for message persistence:

```
POST {WEBHOOK_URL}
Headers: X-GetStream-Signature: {signature}
Body: {
  type: 'message.new' | 'message.updated' | 'message.deleted' | ...,
  data: {
    message: Message,
    channel: Channel,
    reaction?: Reaction,
    user?: User
  }
}
```

Backend validates signature and persists to MongoDB.

---

## Context & Metadata

### Context Types

Each channel can have business context attached:

```typescript
interface ChannelContext {
  listing: {
    id: string;
    brand: string;
    model: string;
    price: number;
    currency: string;
    thumbnail: string;
    condition: string;
  };
  activeOffer?: {
    id: string;
    amount: number;
    state: "pending" | "accepted" | "rejected" | "expired";
    expiresAt: Date;
    revisionNumber: number;
  };
  order?: {
    id: string;
    status: "reserved" | "paid" | "shipped" | "completed";
    amount: number;
    paidAt?: Date;
    shippedAt?: Date;
    completedAt?: Date;
  };
  referenceCheck?: {
    id: string;
    status: "pending" | "active" | "completed" | "suspended";
    responseCount: number;
    vouchCount: number;
    totalVouchWeight: number;
  };
}
```

### Custom Message Fields

Frontend can attach custom data to messages:

```typescript
await channel.sendMessage({
  text: "I'll take it!",
  custom_data: {
    offer_context: {
      id: "offer_1",
      amount: 850,
      accepted: true,
    },
    action_type: "accept_offer",
  },
});
```

Backend stores custom_data in MongoDB ChatMessage document.

---

## Shared Content (Media/Files/Links)

### Upload & Attach Files

```typescript
async function uploadAndAttach(file: File, channel: Channel) {
  // 1. Upload file to backend
  const formData = new FormData();
  formData.append("file", file);

  const uploadRes = await fetch("/api/v1/networks/upload", {
    method: "POST",
    body: formData,
    headers: { Authorization: `Bearer ${authToken}` },
  });

  const { url, type } = await uploadRes.json();

  // 2. Send message with attachment
  await channel.sendMessage({
    text: `Check this out: ${file.name}`,
    attachments: [
      {
        type: type === "image" ? "image" : "file",
        asset_url: url,
        title: file.name,
        file_size: file.size,
      },
    ],
  });
}
```

### Query Shared Content

```typescript
async function getSharedMedia(channelId: string, type = "all") {
  const response = await fetch(
    `/api/v1/networks/messages/channel/${channelId}/media?type=${type}`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  );

  return response.json();
}

// Usage
const images = await getSharedMedia(channelId, "image");
const files = await getSharedMedia(channelId, "file");
const links = await getSharedMedia(channelId, "link");
```

### Display Shared Media

```typescript
function SharedMediaGallery({ channelId }) {
  const [media, setMedia] = useState([]);

  useEffect(() => {
    async function load() {
      const data = await getSharedMedia(channelId);
      setMedia(data.data);
    }
    load();
  }, [channelId]);

  return (
    <div className="media-gallery">
      {media.map(item => (
        <div key={item.id} className="media-item">
          {item.type === 'image' ? (
            <img src={item.url} alt={item.name} />
          ) : item.type === 'file' ? (
            <a href={item.url} download>{item.name}</a>
          ) : (
            <a href={item.url} target="_blank">{item.name}</a>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## Error Handling & Recovery

### Common Errors & Solutions

| Error                          | Cause                      | Solution                       |
| ------------------------------ | -------------------------- | ------------------------------ |
| `Unauthorized`                 | Invalid JWT token          | Refresh auth token, retry      |
| `Not a member of this channel` | User not in channel        | Verify channel membership      |
| `Message not found`            | Deleted/invalid message ID | Reload message list            |
| `Reaction limit reached`       | Too many reactions         | Show user limit warning        |
| `Connection timeout`           | Network/server unreachable | Retry with exponential backoff |
| `Channel archived`             | Channel closed             | Handle gracefully, show info   |

### Retry Logic

```typescript
async function fetchWithRetry(url: string, options = {}, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
```

### Optimistic Updates

```typescript
function useMessageSend(channel) {
  const [messages, setMessages] = useState([]);

  const sendMessage = async (text) => {
    // 1. Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      text,
      status: "sending",
      created_at: new Date(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      // 2. Actual send
      const response = await channel.sendMessage({ text });

      // 3. Replace optimistic with real
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? response.message : msg)),
      );
    } catch (error) {
      // 4. Rollback on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      throw error;
    }
  };

  return { messages, sendMessage };
}
```

### Network Recovery

```typescript
function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));

    return () => {
      window.removeEventListener('online', () => {});
      window.removeEventListener('offline', () => {});
    };
  }, []);

  return isOnline;
}

// Usage
function ChatView() {
  const isOnline = useNetworkStatus();

  if (!isOnline) {
    return <div className="offline-banner">You're offline. Messages will sync when reconnected.</div>;
  }

  return <MessageArea />;
}
```

---

## Code Examples

### Complete Chat Component

```typescript
import React, { useState, useEffect } from 'react';
import { Channel, StreamChat } from 'stream-chat';

interface ChatScreenProps {
  channelId: string;
  authToken: string;
}

export function ChatScreen({ channelId, authToken }: ChatScreenProps) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [context, setContext] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');

  // 1. Initialize Stream & get auth
  useEffect(() => {
    async function initializeStream() {
      try {
        const tokenRes = await fetch('/api/v1/networks/chat/token', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const { token, userId } = await tokenRes.json();
        setCurrentUserId(userId);

        const client = StreamChat.getInstance(process.env.REACT_APP_GETSTREAM_KEY);
        await client.connectUser({ id: userId }, token);

        // 2. Load context
        const contextRes = await fetch(
          `/api/v1/networks/messages/conversation-context?id=${channelId}`,
          { headers: { 'Authorization': `Bearer ${authToken}` } }
        );

        const { data: contextData } = await contextRes.json();
        setContext(contextData);

        // 3. Set up channel
        const channels = await client.queryChannels({ id: channelId });
        if (channels.length === 0) throw new Error('Channel not found');

        const ch = channels[0];
        setChannel(ch);

        const state = await ch.watch();
        setMessages(state.messages);

        // 4. Subscribe to events
        ch.on('message.new', event => {
          setMessages(prev => [...prev, event.message]);
        });

        ch.on('message.updated', event => {
          setMessages(prev =>
            prev.map(m => m.id === event.message.id ? event.message : m)
          );
        });

        ch.on('message.deleted', event => {
          setMessages(prev => prev.filter(m => m.id !== event.message.id));
        });

        setIsLoading(false);
      } catch (err) {
        setError((err as Error).message);
        setIsLoading(false);
      }
    }

    initializeStream();

    return () => {
      if (channel) channel.stopWatching();
    };
  }, [channelId, authToken]);

  const handleSendMessage = async (text: string) => {
    if (!channel || !text.trim()) return;

    try {
      await channel.sendMessage({ text });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (isLoading) return <div>Loading chat...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!channel || !context) return <div>Chat not found</div>;

  return (
    <div className="chat-container">
      <div className="chat-main">
        {/* Header */}
        <header className="chat-header">
          <h2>{context.listing.brand} {context.listing.model}</h2>
          <span className="price">${context.listing.price}</span>
        </header>

        {/* Messages */}
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          channel={channel}
        />

        {/* Input */}
        <MessageInput
          channel={channel}
          onSend={handleSendMessage}
        />
      </div>

      {/* Context Panel */}
      <ContextPanel context={context} />
    </div>
  );
}
```

### Conv List with Search

```typescript
export function ConversationsView() {
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadConversations = async (query = '') => {
    setIsLoading(true);
    try {
      if (query) {
        const res = await fetch(
          `/api/v1/networks/messages/chats/search?q=${encodeURIComponent(query)}`,
          { headers: { 'Authorization': `Bearer ${authToken}` } }
        );
        const { data } = await res.json();
        setConversations(data);
      } else {
        const res = await fetch(
          '/api/v1/networks/messages/chats',
          { headers: { 'Authorization': `Bearer ${authToken}` } }
        );
        const { data } = await res.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConversations(searchQuery);
  }, [searchQuery]);

  return (
    <div className="conversations-view">
      <input
        type="text"
        placeholder="Search conversations..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="search-input"
      />

      {isLoading && <div>Loading...</div>}

      <div className="conversations-list">
        {conversations.map(conv => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            onClick={() => navigateToChat(conv.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Summary

**Frontend Chat Flow:**

1. Request token from backend → Connect to GetStream
2. Fetch conversation list → Display in sidebar
3. Select conversation → Fetch context & load messages
4. Send message → GetStream real-time + backend persistence
5. Subscribe to events → Auto-update on new/edited/deleted messages
6. Display context → Offers, orders, reference checks in side panel

**Key Integration Points:**

- `/chat/token` — Auth setup
- `/messages/chats` — List view
- `/messages/conversation-context` — Business context
- `/messages/send` — Message creation
- GetStream SDK — Real-time messaging & presence
- WebSocket — Live updates

**Performance Tips:**

- Paginate message history (limit 50 per page)
- Cache conversation list (5 min TTL)
- Use optimistic updates for fast UX
- Implement retry logic for failed requests
- Lazy-load shared media galleries

**Security:**

- Validate JWT on every API call
- Verify channel membership before operations
- Sanitize message text (XSS prevention)
- Enforce rate limits on send operations
- Log all message operations for audit trail
