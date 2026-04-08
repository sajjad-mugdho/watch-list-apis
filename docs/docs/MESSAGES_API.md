# Messages API

Backend-controlled messaging system with zero-gap real-time delivery via GetStream.

## Overview

All messages flow through your backend BEFORE GetStream, enabling:
- Full message tracking in MongoDB
- Business logic validation
- Moderation capabilities
- Analytics and reporting
- Zero latency gap (parallel execution)

## Architecture

```
┌─────────────┐                ┌──────────────────┐                ┌──────────────┐
│   Client    │ ─── REST ────► │   YOUR BACKEND   │ ─── SDK ─────► │   GetStream  │
│  (Mobile/   │                │                  │                │    Cloud     │
│    Web)     │                │  ✅ Validate     │                │              │
│             │                │  ✅ Store in DB  │─────┐          │  INSTANT     │
│             │ ◄── WebSocket ─│  ✅ Business     │     │──────────►│  DELIVERY    │
│             │                │     Logic        │─────┘ PARALLEL  │              │
└─────────────┘                └──────────────────┘                └──────────────┘
```

## Endpoints

### POST /api/v1/messages/send

Send a message through the backend. Stores in MongoDB AND delivers via GetStream simultaneously.

**Request Body:**
```json
{
  "channel_id": "messaging:offer_123abc",
  "text": "Hello, is this still available?",
  "type": "inquiry",
  "attachments": [],
  "custom_data": {}
}
```

**Response (201):**
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "stream_message_id": "msg_abc123",
    "text": "Hello, is this still available?",
    "type": "inquiry",
    "sender_id": "677a2222222222222222bbb2",
    "createdAt": "2024-01-15T10:30:00Z",
    "status": "delivered"
  }
}
```

### GET /api/v1/messages/channel/:channelId

Get message history from YOUR MongoDB database (not GetStream).

**Query Parameters:**
- `limit` (optional): Max messages (default: 50, max: 100)
- `before` (optional): Message ID for pagination

**Response:**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "text": "Hello!",
      "sender_id": { "_id": "...", "display_name": "John", "avatar": "..." },
      "type": "regular",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 42,
  "limit": 50,
  "has_more": false
}
```

### PUT /api/v1/messages/:id

Edit a message. Updates both MongoDB AND GetStream.

**Request Body:**
```json
{
  "text": "Updated message text"
}
```

### DELETE /api/v1/messages/:id

Soft-delete a message. Marks as deleted in MongoDB and removes from GetStream.

### POST /api/v1/messages/:id/read

Mark a specific message as read by the current user.

### POST /api/v1/messages/channel/:channelId/read-all

Mark all messages in a channel as read by the current user.

### POST /api/v1/messages/:id/react

Add a reaction to a message.

**Request Body:**
```json
{
  "type": "like"
}
```

## Message Types

| Type | Description |
|------|-------------|
| `regular` | Normal chat message |
| `inquiry` | Question about a listing |
| `offer` | Price offer from buyer |
| `counter_offer` | Counter offer from seller |
| `offer_accepted` | Offer acceptance notification |
| `offer_rejected` | Offer rejection notification |
| `order_created` | Order creation notification |
| `system` | System-generated message |

## Message Status

| Status | Description |
|--------|-------------|
| `pending` | Message created, not yet sent |
| `sent` | Sent to GetStream |
| `delivered` | Confirmed delivery to GetStream |
| `failed` | Delivery failed |
| `deleted` | Soft-deleted |

## Error Responses

**401 Unauthorized:**
```json
{
  "error": { "message": "Unauthorized" }
}
```

**403 Forbidden:**
```json
{
  "error": { "message": "Not a member of this channel" }
}
```

**400 Bad Request:**
```json
{
  "error": { "message": "Cannot send messages to a closed channel" }
}
```
