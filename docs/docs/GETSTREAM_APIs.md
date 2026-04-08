# Complete GetStream Backend API Documentation

## Overview

This document provides comprehensive API documentation for the Dialist backend's GetStream integration. It covers all endpoints related to chat, messaging, notifications, feeds, and the specific business logic for offers, orders, and reference checks.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Chat APIs](#chat-apis)
3. [Message APIs](#message-apis)
4. [Notification APIs](#notification-apis)
5. [Feed APIs](#feed-apis)
6. [Inquiry APIs](#inquiry-apis)
7. [Offer APIs](#offer-apis)
8. [Order Lifecycle](#order-lifecycle)
9. [Reference Check APIs](#reference-check-apis)
10. [Webhook Endpoints](#webhook-endpoints)
11. [System Message Types](#system-message-types)
12. [Error Codes](#error-codes)
13. [Event Flows](#event-flows)

---

## Authentication

All endpoints require a valid Clerk JWT token in the Authorization header:

```
Authorization: Bearer <CLERK_JWT_TOKEN>
```

### Getting a Test Token

```bash
# From Clerk Dashboard or via Clerk SDK
const token = await clerk.session?.getToken();
```

---

## Chat APIs

Base URL: `/api/v1/chat`

### GET /chat/token

Generate a Stream Chat token for the authenticated user.

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "692f287c77137aea628d4e1f",
  "apiKey": "gvfj7ywfyhq3"
}
```

**Usage:**
1. Frontend calls this endpoint with Clerk JWT
2. Backend verifies user, creates/upserts user in Stream
3. Returns Stream token for client-side SDK initialization

---

### GET /chat/channels

Get all channels the user is a member of.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 20 | Max channels to return |
| offset | number | 0 | Pagination offset |

**Response:**
```json
{
  "channels": [
    {
      "id": "listing_abc_buyer123_seller456",
      "cid": "messaging:listing_abc_buyer123_seller456",
      "type": "messaging",
      "listing_id": "abc123",
      "listing_title": "Rolex Submariner",
      "listing_price": 1200000,
      "listing_thumbnail": "https://...",
      "members": ["buyer123", "seller456"],
      "last_message_at": "2026-01-08T18:00:00Z",
      "created_at": "2026-01-07T10:00:00Z",
      "unread_count": 3
    }
  ],
  "limit": 20,
  "offset": 0
}
```

---

### GET /chat/unread

Get unread message counts.

**Response:**
```json
{
  "total_unread_count": 5,
  "channels": {
    "messaging:listing_abc_buyer123_seller456": 3,
    "messaging:listing_xyz_buyer123_seller789": 2
  }
}
```

---

### POST /chat/channel

Create or get an existing channel.

**Request Body:**
```json
{
  "listing_id": "abc123",
  "seller_id": "seller456",
  "listing_title": "Rolex Submariner",
  "listing_price": 1200000,
  "listing_thumbnail": "https://..."
}
```

**Response:**
```json
{
  "channelId": "listing_abc_buyer123_seller456",
  "channel": {
    "id": "listing_abc_buyer123_seller456",
    "listing_id": "abc123",
    "members": ["buyer123", "seller456"]
  }
}
```

---

## Message APIs

Base URL: `/api/v1/messages`

### POST /messages/send

Send a message through the backend (recommended approach for data ownership).

**Request Body:**
```json
{
  "channel_id": "listing_abc_buyer123_seller456",
  "text": "Is this watch still available?",
  "type": "regular",
  "attachments": [
    {
      "type": "image",
      "url": "https://..."
    }
  ],
  "custom_data": {
    "listing_reference": "abc123"
  }
}
```

**Response:**
```json
{
  "data": {
    "_id": "msg123",
    "text": "Is this watch still available?",
    "sender_id": {
      "_id": "buyer123",
      "display_name": "John Doe"
    },
    "type": "regular",
    "createdAt": "2026-01-08T18:30:00Z"
  }
}
```

**Note:** This endpoint:
1. Validates user is channel member
2. Stores message in MongoDB
3. Sends to GetStream in parallel
4. Creates notification for recipient

---

### GET /messages/channel/:channelId

Get message history for a channel.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 50 | Max messages to return |
| before | string | - | Cursor for pagination |

**Response:**
```json
{
  "data": [
    {
      "_id": "msg123",
      "text": "Is this available?",
      "sender_id": {
        "_id": "buyer123",
        "display_name": "John Doe"
      },
      "type": "regular",
      "createdAt": "2026-01-08T18:30:00Z"
    }
  ],
  "total": 100,
  "has_more": true
}
```

---

### PUT /messages/:messageId

Edit a message.

**Request Body:**
```json
{
  "text": "Updated message text"
}
```

---

### DELETE /messages/:messageId

Delete a message.

---

### POST /messages/:messageId/read

Mark a message as read.

---

### POST /messages/:messageId/react

Add reaction to a message.

**Request Body:**
```json
{
  "reaction": "👍"
}
```

---

### POST /messages/channel/:channelId/archive

Archive a channel (hide from user's channel list).

**Response:**
```json
{
  "message": "Channel archived successfully"
}
```

**Note:** Uses GetStream's `channel.hide()` method. Channel can be restored by user.

---

## Notification APIs

Base URL: `/api/v1/notifications`

### GET /notifications

Get user's notifications.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 20 | Max notifications |
| offset | number | 0 | Pagination offset |
| type | string | - | Filter by type |

**Response:**
```json
{
  "data": [
    {
      "_id": "notif123",
      "user_id": "user456",
      "type": "offer_received",
      "title": "New Offer Received",
      "body": "Someone offered $10,000 for your Rolex Submariner",
      "data": {
        "listing_id": "abc123",
        "offer_id": "offer789",
        "channel_id": "listing_abc_buyer123_seller456"
      },
      "action_url": "/offers/offer789",
      "read": false,
      "createdAt": "2026-01-08T18:00:00Z"
    }
  ],
  "total": 50,
  "unread_count": 5,
  "limit": 20,
  "offset": 0
}
```

---

### GET /notifications/unread-count

Get unread notification count.

**Response:**
```json
{
  "unread_count": 5
}
```

---

### POST /notifications/mark-all-read

Mark all notifications as read.

---

### POST /notifications/:id/read

Mark specific notification as read.

---

### DELETE /notifications/:id

Delete a notification.

---

## Feed APIs

Base URL: `/api/v1/feeds`

### GET /feeds/token

Get Stream Feeds token.

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "692f287c77137aea628d4e1f",
  "apiKey": "gvfj7ywfyhq3",
  "appId": "1467943"
}
```

---

### GET /feeds/timeline

Get user's timeline feed (activities from followed users).

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 20 | Max activities |
| offset | number | 0 | Pagination offset |

**Response:**
```json
{
  "activities": [
    {
      "id": "act123",
      "actor": "user:seller456",
      "verb": "post",
      "object": "listing:abc123",
      "time": "2026-01-08T18:00:00Z",
      "type": "listing",
      "listing_title": "Rolex Submariner",
      "listing_price": 1200000
    }
  ]
}
```

---

### POST /users/:id/follow

Follow a user.

**Response:**
```json
{
  "message": "Successfully followed user"
}
```

---

### DELETE /users/:id/follow

Unfollow a user.

---

### GET /users/:id/follow/status

Get follow status between current user and target.

**Response:**
```json
{
  "is_following": true,
  "is_followed_by": false
}
```

---

## Inquiry APIs

### POST /marketplace/listings/:id/inquire

Create an inquiry on a marketplace listing. **Creates channel immediately.**

**Request Body:**
```json
{
  "message": "Is this still available?"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "channel_id": "mongo_channel_id",
    "getstream_channel_id": "listing_abc_buyer123_seller456",
    "listing_id": "abc123",
    "seller_id": "seller456",
    "created": true
  },
  "message": "Inquiry sent and chat channel created"
}
```

**Response (200 OK - existing channel):**
```json
{
  "data": {
    "channel_id": "mongo_channel_id",
    "getstream_channel_id": "listing_abc_buyer123_seller456",
    "listing_id": "abc123",
    "seller_id": "seller456",
    "created": false
  },
  "message": "Inquiry added to existing conversation"
}
```

**Business Logic:**
- Marketplace: Channel unique per (buyer, seller, listing)
- Networks: Channel unique per (buyer, seller) - reused across listings

---

### POST /networks/listings/:id/inquire

Same as marketplace, but channels are user-to-user unique.

---

## Offer APIs

### POST /marketplace/listings/:id/offers

Send an offer on a listing.

**Request Body:**
```json
{
  "amount": 1000000
}
```

**Response:**
```json
{
  "data": {
    "channel_id": "mongo_channel_id",
    "getstream_channel_id": "listing_abc_buyer123_seller456",
    "offer": {
      "amount": 1000000,
      "status": "sent",
      "expires_at": "2026-01-10T18:00:00Z"
    }
  }
}
```

**Business Rules:**
- Only one active offer per buyer per channel
- New offers require previous to be resolved (accepted/rejected/expired)
- Counter-offers invalidate previous offers
- Offers expire after 48 hours

---

### POST /marketplace/channels/:channelId/offers/:offerId/accept

Accept an offer.

**Triggers:**
- Listing state → `reserved`
- System message in channel
- Notification to buyer
- Order creation

---

### POST /marketplace/channels/:channelId/offers/:offerId/reject

Reject an offer.

**Triggers:**
- System message in channel
- Notification to buyer

---

### POST /marketplace/channels/:channelId/offers/:offerId/counter

Counter an offer.

**Request Body:**
```json
{
  "amount": 1100000
}
```

**Triggers:**
- Previous offer → `countered` status
- System message in channel
- Notification to buyer

---

## Order Lifecycle

### Order States

| State | Description | Next States |
|-------|-------------|-------------|
| `pending_payment` | Awaiting payment | `paid`, `cancelled` |
| `paid` | Payment received | `shipped` |
| `shipped` | Tracking uploaded | `completed` |
| `completed` | Buyer confirmed delivery | - |
| `cancelled` | Order cancelled | - |

### System Messages by State

Each state transition sends a system message:

| Transition | System Message Type | Notification |
|------------|---------------------|--------------|
| → pending_payment | `listing_reserved` | Seller |
| → paid | `order_paid` | Seller & Buyer |
| → shipped | `order_shipped` | Buyer |
| → completed | `order_completed` | Seller |

---

## Reference Check APIs

### POST /reference-checks

Initiate a reference check.

**Request Body:**
```json
{
  "target_user_id": "user456",
  "order_id": "order789",
  "reason": "Completing a large transaction"
}
```

**Response:**
```json
{
  "data": {
    "_id": "ref123",
    "requester_id": "user123",
    "target_user_id": "user456",
    "order_id": "order789",
    "status": "pending",
    "getstream_channel_id": "ref_check_user123_user456"
  }
}
```

**Triggers:**
- Creates dedicated chat channel
- System message to order channel (if linked)
- Feed activity for followers
- Notification to followers

---

### POST /reference-checks/:id/respond

Respond to a reference check.

**Request Body:**
```json
{
  "vote": "positive",
  "comment": "Great trader, highly recommend!"
}
```

---

## Webhook Endpoints

### POST /webhooks/getstream

Receives webhooks from GetStream.

**Headers Required:**
```
x-signature: <HMAC-SHA256 signature>
```

**Handled Events:**
| Event | Action |
|-------|--------|
| `message.new` | Store in MongoDB, create notification |
| `message.updated` | Update in MongoDB |
| `message.deleted` | Mark as deleted in MongoDB |
| `message.read` | Update read receipts |
| `channel.created` | Log channel creation |
| `channel.updated` | Sync channel metadata |

---

## System Message Types

System messages are identified by `custom.system_message: true`

| Type | Description | Action Buttons |
|------|-------------|----------------|
| `inquiry` | User inquired about listing | Reply |
| `offer` | New offer sent | Accept, Counter, Decline |
| `counter_offer` | Counter offer made | Accept, Counter, Decline |
| `offer_accepted` | Offer was accepted | View Order |
| `offer_rejected` | Offer was declined | Send New Offer |
| `offer_expired` | Offer expired (48h) | Send New Offer |
| `listing_reserved` | Checkout in progress | View Order |
| `listing_sold` | Transaction complete | - |
| `order_paid` | Payment confirmed | View Order |
| `order_shipped` | Tracking uploaded | Track Package |
| `order_completed` | Delivery confirmed | Leave Review |
| `reference_check_initiated` | Ref check started | View Check |

**System Message Structure:**
```json
{
  "id": "msg123",
  "text": "💰 New offer: $10,000",
  "user": { "id": "system" },
  "custom": {
    "system_message": true,
    "type": "offer",
    "offer_id": "offer789",
    "amount": 1000000,
    "expires_at": "2026-01-10T18:00:00Z",
    "actions": [
      { "label": "Accept", "action": "accept", "endpoint": "/offers/offer789/accept" },
      { "label": "Counter", "action": "counter", "endpoint": "/offers/offer789/counter" },
      { "label": "Decline", "action": "decline", "endpoint": "/offers/offer789/reject" }
    ]
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `FORBIDDEN` | 403 | Not authorized for action |
| `NOT_FOUND` | 404 | Resource not found |
| `CHANNEL_CLOSED` | 400 | Cannot message in closed channel |
| `ACTIVE_OFFER_EXISTS` | 400 | Already have pending offer |
| `LISTING_RESERVED` | 400 | Cannot offer on reserved listing |
| `OFFER_EXPIRED` | 400 | Offer has expired |
| `NOT_CHANNEL_MEMBER` | 403 | Not a member of channel |

---

## Event Flows

### Inquiry → Order Complete Flow

```
1. Buyer inquires on listing
   └─> Channel created (Stream + MongoDB)
   └─> System message: "inquiry"
   └─> Notification to seller

2. Buyer sends offer ($10,000)
   └─> Offer stored in channel
   └─> System message: "offer"
   └─> Notification to seller

3. Seller counter-offers ($11,000)
   └─> Previous offer → "countered"
   └─> System message: "counter_offer"
   └─> Notification to buyer

4. Buyer accepts counter
   └─> Listing → "reserved"
   └─> Order created
   └─> System message: "offer_accepted"
   └─> System message: "listing_reserved"
   └─> Notification to both

5. Buyer pays
   └─> Order → "paid"
   └─> System message: "order_paid"
   └─> Notification to seller

6. Seller ships
   └─> Order → "shipped"
   └─> System message: "order_shipped"
   └─> Notification to buyer

7. Buyer confirms delivery
   └─> Order → "completed"
   └─> Listing → "sold"
   └─> System message: "order_completed"
   └─> System message: "listing_sold"
   └─> Notification to seller
```

---

## Environment Variables

```bash
# GetStream
GETSTREAM_API_KEY=your_api_key
GETSTREAM_API_SECRET=your_api_secret
GETSTREAM_APP_ID=your_app_id
GETSTREAM_WEBHOOK_SECRET=optional_webhook_secret

# Clerk
CLERK_SECRET_KEY=your_clerk_secret

# MongoDB
MONGODB_URI=mongodb://localhost:27017/dialist
```

---

## Testing Endpoints

Use the interactive Swagger UI at:
```
http://localhost:5050/api-docs
```

Or the frontend testing dashboard at:
```
http://localhost:3000/chat
```

---

*Document Version: 1.0*
*Last Updated: 2026-01-08*
