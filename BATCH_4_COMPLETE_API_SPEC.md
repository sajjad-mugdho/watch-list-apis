# Dialist Networks — Batch 4 Complete API Specification

**Every Endpoint · All Payloads · All Responses · Production Auth**

Version: 1.0 · April 2026 · Complete Coverage

---

## Auth

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

Base URL: `/api/v1/networks`

---

## Response Envelopes

Standard response format:

```json
{
  "data": {
    /* endpoint-specific data */
  }
}
```

With pagination:

```json
{
  "data": [
    /* array of resources */
  ],
  "total": 100,
  "limit": 20,
  "offset": 0,
  "unread_count": 5
}
```

---

## Error Envelope

```json
{
  "message": "Human-readable explanation",
  "code": "ERROR_CODE",
  "details": [
    { "path": "body.field", "field": "field", "message": "Specific error" }
  ]
}
```

---

## Status Codes

| Code  | Meaning          |
| ----- | ---------------- |
| `200` | Success          |
| `201` | Created          |
| `400` | Validation error |
| `401` | Unauthorized     |
| `403` | Forbidden        |
| `404` | Not found        |
| `429` | Rate limited     |
| `500` | Server error     |

---

---

# 1 · AUTHENTICATION & TOKENS

---

### `GET /user/tokens`

Get GetStream chat tokens + authentication info.

```json
// 200
{
  "data": {
    "user_id": "usr_buyer01",
    "getstream": {
      "api_key": "b5z5jt844r2xf",
      "user_id": "stream_usr_buyer01",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires": 3600
    }
  }
}
```

Valid for 1 hour. Refresh as needed.

Errors: `401` `500`

---

---

# 2 · ONBOARDING

---

### `GET /onboarding/status`

Check user onboarding completion status.

```json
// 200
{
  "data": {
    "status": "incomplete",
    "user_id": "usr_001",
    "completed_steps": ["profile", "location"],
    "pending_steps": ["avatar", "verification"],
    "progress_percentage": 50
  }
}
```

Status: `incomplete` | `completed`

Errors: `401` `500`

---

### `PATCH /onboarding/complete`

Complete onboarding with all fields at once.

```json
// Request
{
  "location": {
    "country": "US",
    "region": "CA",
    "currency": "USD",
    "postal_code": "90210",
    "city": "Los Angeles",
    "line1": "123 Main St",
    "line2": "Apt 5"
  },
  "profile": {
    "first_name": "John",
    "last_name": "Doe"
  },
  "avatar": {
    "type": "monogram"
  }
}

// 200
{
  "data": {
    "status": "completed",
    "user_id": "usr_001",
    "completed_at": "2026-04-08T10:00:00Z"
  }
}

// 400 — missing required fields
{
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    { "field": "location.country", "message": "Required" }
  ]
}
```

Errors: `400` `401` `500`

---

---

# 3 · SOCIAL & GROUPS

---

### `GET /social/groups`

List all groups (public + user's groups).

Params: `limit` (20), `offset` (0)

```json
// 200
{
  "data": [
    {
      "_id": "grp_001",
      "name": "B2B Sellers Network",
      "description": "For bulk traders",
      "member_count": 45,
      "avatar_url": "https://...",
      "created_at": "2026-03-10T00:00:00Z"
    }
  ],
  "total": 120,
  "limit": 20,
  "offset": 0
}
```

Errors: `401` `500`

---

### `POST /social/groups`

Create new group.

```json
// Request
{
  "name": "Premium Dealers",
  "description": "Vetted sellers network",
  "visibility": "public"
}

// 201
{
  "data": {
    "_id": "grp_002",
    "name": "Premium Dealers",
    "member_count": 1,
    "created_at": "2026-03-27T10:00:00Z"
  }
}
```

Errors: `400` `401` `500`

---

### `GET /social/groups/:id`

Get group details and members.

```json
// 200
{
  "data": {
    "_id": "grp_001",
    "name": "B2B Sellers Network",
    "description": "For bulk traders",
    "member_count": 45,
    "members": [
      { "_id": "usr_001", "display_name": "seller_alpha", "role": "admin" },
      { "_id": "usr_002", "display_name": "seller_beta", "role": "member" }
    ],
    "created_at": "2026-03-10T00:00:00Z"
  }
}
```

Errors: `401` `404` `500`

---

### `POST /social/groups/:id/join`

Join group.

```json
// 200
{ "data": { "success": true, "status": "member" } }
```

Errors: `401` `404` `409` `500`

---

### `DELETE /social/groups/:id/leave`

Leave group.

```json
// 200
{ "data": { "success": true } }
```

Errors: `401` `404` `500`

---

### `GET /social/groups/:id/members`

List group members.

```json
// 200
{
  "data": [
    { "_id": "usr_001", "display_name": "seller_alpha", "role": "admin" },
    { "_id": "usr_002", "display_name": "seller_beta", "role": "member" }
  ]
}
```

Errors: `401` `404` `500`

---

### `POST /social/groups/:id/members`

Add member to group (admin only).

```json
// Request
{ "user_id": "usr_003" }

// 201
{ "data": { "success": true, "user_id": "usr_003" } }
```

Errors: `401` `403` `404` `500`

---

### `DELETE /social/groups/:id/members/:userId`

Remove member from group (admin only).

```json
// 200
{ "data": { "success": true } }
```

Errors: `401` `403` `404` `500`

---

### `PATCH /social/groups/:id/members/:userId/role`

Update member role (admin only).

```json
// Request
{ "role": "moderator" }

// 200
{ "data": { "success": true, "role": "moderator" } }
```

Errors: `401` `403` `404` `500`

---

### `POST /social/groups/:id/mute`

Mute group notifications.

```json
// 200
{ "data": { "success": true, "muted": true } }
```

Errors: `401` `404` `500`

---

### `GET /social/groups/:id/shared-links`

Get public links shared in group.

```json
// 200
{
  "data": [
    {
      "_id": "link_001",
      "url": "https://example.com",
      "title": "Product Review",
      "shared_by": "usr_001",
      "shared_at": "2026-03-27T10:00:00Z"
    }
  ]
}
```

Errors: `401` `404` `500`

---

### `POST /social/groups/:id/shared-links`

Share a link in group.

```json
// Request
{ "url": "https://example.com" }

// 201
{
  "data": {
    "_id": "link_001",
    "url": "https://example.com",
    "shared_at": "2026-03-27T10:15:00Z"
  }
}
```

Errors: `400` `401` `404` `500`

---

### `GET /social/groups/:id/shared-media`

Get media shared in group.

```json
// 200
{
  "data": [
    {
      "_id": "media_001",
      "type": "image",
      "url": "https://cdn.dialist.app/groups/grp_001_media_001.jpg",
      "shared_by": "usr_001",
      "shared_at": "2026-03-27T09:00:00Z"
    }
  ]
}
```

Errors: `401` `404` `500`

---

### `POST /social/invites`

Create group invite link.

```json
// Request
{ "group_id": "grp_001" }

// 201
{
  "data": {
    "_id": "invite_001",
    "group_id": "grp_001",
    "token": "abc123def456",
    "invite_url": "https://dialist.app/invite/abc123def456",
    "expires_at": "2026-05-08T10:00:00Z"
  }
}
```

Errors: `400` `401` `404` `500`

---

### `GET /social/invites/:token`

Get invite details and accept.

```json
// 200
{
  "data": {
    "group_id": "grp_001",
    "group_name": "B2B Sellers Network",
    "created_by": "usr_001",
    "expires_at": "2026-05-08T10:00:00Z",
    "is_valid": true
  }
}
```

Errors: `404` `500`

---

### `GET /social/status`

Get hub status: online, unread counts.

```json
// 200
{
  "data": {
    "user_online": true,
    "last_active": "2026-03-27T14:30:00Z",
    "unread_messages": 3,
    "unread_offers": 1,
    "unread_orders": 0,
    "unread_notifications": 5
  }
}
```

Errors: `401` `500`

---

### `GET /social/discover`

Recommended traders and groups.

Params: `limit`, `offset`

```json
// 200
{
  "data": {
    "traders": [
      {
        "_id": "usr_003",
        "display_name": "trusted_dealer",
        "rating": 4.9,
        "active_listings": 12,
        "reviews_count": 147
      }
    ],
    "groups": [
      {
        "_id": "grp_003",
        "name": "Watch Professionals",
        "member_count": 320
      }
    ]
  }
}
```

Errors: `401` `500`

---

### `GET /social/search`

Multi-entity search: users, groups, listings.

Params: `q` (search string), `limit`, `offset`

```json
// 200
{
  "data": {
    "users": [
      { "_id": "usr_001", "display_name": "alex_carter", "rating": 4.8 }
    ],
    "groups": [{ "_id": "grp_001", "name": "B2B Sellers", "member_count": 45 }],
    "listings": [
      { "_id": "lst_001", "title": "Rolex Submariner", "price": 14500 }
    ]
  }
}
```

Errors: `400` `401` `500`

---

### `GET /social/conversations/:id/content`

Get shared content in conversation.

```json
// 200
{
  "data": {
    "media": [
      {
        "_id": "media_001",
        "type": "image",
        "url": "https://...",
        "shared_at": "2026-03-27T10:00:00Z"
      }
    ],
    "links": [
      {
        "url": "https://example.com",
        "title": "Product Page",
        "shared_at": "2026-03-27T09:30:00Z"
      }
    ]
  }
}
```

Errors: `401` `404` `500`

---

### `GET /social/conversations/:id/search`

Search within conversation.

Params: `q` (search string)

```json
// 200
{
  "data": [
    {
      "_id": "msg_001",
      "text": "Is this still available?",
      "sender": "usr_001",
      "created_at": "2026-03-27T10:00:00Z"
    }
  ]
}
```

Errors: `400` `401` `404` `500`

---

### `GET /social/conversations/:id/events`

Get conversation events (created, member added, etc).

```json
// 200
{
  "data": [
    {
      "type": "conversation.created",
      "actor": "usr_001",
      "created_at": "2026-03-27T10:00:00Z"
    },
    {
      "type": "message.sent",
      "actor": "usr_001",
      "created_at": "2026-03-27T10:05:00Z"
    }
  ]
}
```

Errors: `401` `404` `500`

---

### `GET /social/chat-profile/:userId`

Get user's chat profile (name, avatar, online status).

```json
// 200
{
  "data": {
    "_id": "usr_001",
    "display_name": "alex_carter",
    "avatar_url": "https://...",
    "online": true,
    "last_active": "2026-03-27T14:30:00Z"
  }
}
```

Errors: `401` `404` `500`

---

---

# 4 · LISTINGS

---

### `GET /listings`

List all listings.

Params: `limit` (20), `offset` (0), `status`, `sort_by` (price | created | updated)

```json
// 200
{
  "data": [
    {
      "_id": "lst_001",
      "title": "Rolex Submariner 126610LN",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 14500,
      "status": "active",
      "thumbnail_url": "https://...",
      "created_at": "2026-03-10T00:00:00Z"
    }
  ],
  "total": 240,
  "limit": 20,
  "offset": 0
}
```

Errors: `401` `500`

---

### `POST /listings`

Create draft listing.

```json
// Request
{
  "brand": "Rolex",
  "model": "Submariner",
  "reference": "126610LN",
  "type": "for_sale"
}

// 201
{
  "data": {
    "_id": "lst_002",
    "status": "draft",
    "brand": "Rolex",
    "model": "Submariner"
  }
}
```

Errors: `400` `401` `500`

---

### `GET /listings/:id`

Get complete listing details.

```json
// 200
{
  "data": {
    "_id": "lst_001",
    "title": "Rolex Submariner 126610LN",
    "brand": "Rolex",
    "model": "Submariner",
    "reference": "126610LN",
    "description": "Full set with box and papers",
    "price": 14500,
    "currency": "USD",
    "status": "active",
    "condition": "Used - Very Good",
    "contents": "Box & Papers",
    "images": ["https://cdn.dialist.app/listings/lst_001_1.jpg"],
    "shipping": [
      { "region": "US", "shippingIncluded": false, "shippingCost": 50 },
      { "region": "CA", "shippingIncluded": false, "shippingCost": 75 },
      {
        "region": "International",
        "shippingIncluded": false,
        "shippingCost": 150
      }
    ],
    "seller": { "_id": "usr_001", "display_name": "alex_carter" },
    "view_count": 74,
    "created_at": "2026-03-10T00:00:00Z"
  }
}
```

Errors: `401` `404` `500`

---

### `PATCH /listings/:id`

Update draft listing only.

```json
// Request — all optional
{
  "description": "Full set, mint condition",
  "price": 14500,
  "condition": "Used - Very Good",
  "images": ["https://..."],
  "shipping": [
    { "region": "US", "shippingIncluded": true, "shippingCost": 0 }
  ]
}

// 200
{
  "data": {
    "_id": "lst_002",
    "status": "draft",
    "price": 14500
  }
}
```

Errors: `400` `401` `403` `404` `500`

---

### `POST /listings/:id/publish`

Publish draft listing to active status.

```json
// 200
{ "data": { "_id": "lst_002", "status": "active" } }

// 400 — missing required fields
{
  "message": "Listing cannot be published. Missing required fields.",
  "code": "PUBLISH_VALIDATION_FAILED",
  "details": [
    { "field": "images", "message": "At least one image required" }
  ]
}
```

Errors: `400` `401` `403` `404` `500`

---

### `DELETE /listings/:id`

Delete listing (draft only).

```json
// 200
{ "data": { "success": true } }

// 409 — active negotiation
{
  "message": "Listing has active negotiations and cannot be deleted",
  "code": "LISTING_DELETE_CONFLICT"
}
```

Errors: `401` `403` `404` `409` `500`

---

### `POST /listings/:id/images`

Upload listing images (multipart/form-data).

```
POST /api/v1/networks/listings/lst_001/images
Content-Type: multipart/form-data

images: [file1.jpg, file2.jpg, file3.jpg]

// 200
{
  "data": {
    "urls": [
      "https://cdn.dialist.app/listings/lst_001_new_1.jpg",
      "https://cdn.dialist.app/listings/lst_001_new_2.jpg"
    ]
  }
}
```

Errors: `400` `401` `403` `404` `500`

---

### `DELETE /listings/:id/images/:imageKey`

Delete single image from listing.

```json
// 200
{ "data": { "success": true } }
```

Errors: `401` `403` `404` `500`

---

---

# 5 · OFFERS

---

### `POST /listings/:id/offers`

Send offer on listing.

```json
// Request
{
  "amount": 13500,
  "shipping_region": "US",
  "message": "Interested, can do 13.5k?"
}

// 200
{
  "data": {
    "offer_id": "off_020",
    "status": "pending",
    "created_at": "2026-03-27T12:00:00Z"
  }
}

// 400 — invalid shipping region
{
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    { "field": "shipping_region", "message": "Invalid enum value. Expected 'US' | 'CA' | 'International'" }
  ]
}
```

Valid regions: `US` | `CA` | `International`

Errors: `400` `401` `403` `404` `500`

---

### `GET /offers`

List offers (sent or received).

Params: `type` (sent | received), `status`, `limit`, `offset`

```json
// 200
{
  "data": [
    {
      "_id": "off_020",
      "listing_id": "lst_001",
      "listing_title": "Rolex Submariner 126610LN",
      "status": "open",
      "amount": 13500,
      "buyer": { "_id": "usr_buyer01", "display_name": "collector_x" },
      "seller": { "_id": "usr_001", "display_name": "alex_carter" },
      "created_at": "2026-03-27T12:00:00Z"
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

Errors: `401` `500`

---

### `GET /offers/:id`

Get offer details with full history.

```json
// 200
{
  "data": {
    "_id": "off_020",
    "listing_id": "lst_001",
    "listing_title": "Rolex Submariner 126610LN",
    "status": "open",
    "amount": 13500,
    "buyer": { "_id": "usr_buyer01", "display_name": "collector_x" },
    "seller": { "_id": "usr_001", "display_name": "alex_carter" },
    "history": [
      {
        "actor": "buyer",
        "action": "offer",
        "amount": 13500,
        "note": "Interested, can do 13.5k?",
        "at": "2026-03-27T12:00:00Z"
      },
      {
        "actor": "seller",
        "action": "counter",
        "amount": 14000,
        "note": "Can't go lower than 14k",
        "at": "2026-03-27T12:30:00Z"
      }
    ],
    "created_at": "2026-03-27T12:00:00Z"
  }
}
```

Errors: `401` `404` `500`

---

### `GET /offers/:id/terms-history`

Get offer terms negotiation history.

```json
// 200
{
  "data": [
    {
      "amount": 13500,
      "timestamp": "2026-03-27T12:00:00Z",
      "proposed_by": "buyer"
    },
    {
      "amount": 14000,
      "timestamp": "2026-03-27T12:30:00Z",
      "proposed_by": "seller"
    }
  ]
}
```

Errors: `401` `404` `500`

---

### `POST /offers/:id/counter`

Send counter offer.

```json
// Request
{
  "amount": 14000,
  "message": "Lowest I can go"
}

// 200
{
  "data": {
    "_id": "off_020",
    "status": "open",
    "amount": 14000,
    "updated_at": "2026-03-27T13:00:00Z"
  }
}
```

Errors: `400` `401` `403` `404` `500`

---

### `POST /offers/:id/accept`

Accept offer and create order.

```json
// 200
{
  "data": {
    "_id": "off_020",
    "status": "accepted",
    "order_id": "ord_011",
    "updated_at": "2026-03-27T13:10:00Z"
  }
}
```

Navigate to order using `order_id`.

Errors: `401` `403` `404` `409` `500`

---

### `POST /offers/:id/reject`

Reject offer.

```json
// 200
{
  "data": {
    "_id": "off_020",
    "status": "rejected",
    "updated_at": "2026-03-27T13:15:00Z"
  }
}
```

Errors: `401` `403` `404` `500`

---

### `POST /offers/:id/decline`

Decline offer (alias for reject).

```json
// 200 — same as reject
{
  "data": {
    "_id": "off_020",
    "status": "rejected",
    "updated_at": "2026-03-27T13:15:00Z"
  }
}
```

Errors: `401` `403` `404` `500`

---

---

# 6 · ORDERS

---

### `GET /orders`

List all orders.

Params: `type` (buy | sell), `status`, `limit`, `offset`

```json
// 200
{
  "data": [
    {
      "_id": "ord_010",
      "listing_id": "lst_001",
      "listing_title": "Rolex Submariner 126610LN",
      "status": "reserved",
      "amount": 14500,
      "buyer": { "_id": "usr_buyer01", "display_name": "collector_x" },
      "seller": { "_id": "usr_001", "display_name": "alex_carter" },
      "created_at": "2026-03-27T12:10:00Z"
    }
  ],
  "total": 8,
  "limit": 20,
  "offset": 0
}
```

Errors: `401` `500`

---

### `GET /orders/:id`

Get order details.

```json
// 200
{
  "data": {
    "_id": "ord_010",
    "listing_id": "lst_001",
    "listing_title": "Rolex Submariner 126610LN",
    "status": "reserved",
    "amount": 14500,
    "currency": "USD",
    "shipping_region": "US",
    "buyer": { "_id": "usr_buyer01", "display_name": "collector_x" },
    "seller": { "_id": "usr_001", "display_name": "alex_carter" },
    "buyer_confirmed": false,
    "seller_confirmed": false,
    "created_at": "2026-03-27T12:10:00Z",
    "expires_at": "2026-03-28T12:10:00Z"
  }
}
```

Errors: `401` `404` `500`

---

### `GET /orders/:id/completion-status`

Check dual-confirmation status.

```json
// 200
{
  "data": {
    "order_id": "ord_010",
    "buyer_confirmed": true,
    "seller_confirmed": false,
    "completed": false,
    "message": "Waiting for seller to confirm"
  }
}
```

Errors: `401` `404` `500`

---

### `POST /listings/:id/reserve`

Buy now (direct purchase).

```json
// Request
{ "shipping_region": "US" }

// 201
{
  "data": {
    "_id": "ord_010",
    "status": "reserved",
    "amount": 14500,
    "created_at": "2026-03-27T12:10:00Z"
  }
}

// 400 — listing inactive
{
  "message": "Listing is no longer active and cannot be reserved",
  "code": "VALIDATION_ERROR"
}
```

Errors: `400` `401` `403` `404` `500`

---

### `POST /orders/:id/complete`

Dual-confirmation: both buyer and seller call to mark complete.

```json
// 200 — one side confirmed
{
  "data": {
    "order_id": "ord_010",
    "buyer_confirmed": true,
    "seller_confirmed": false,
    "completed": false,
    "message": "Waiting for other party to confirm"
  }
}

// 200 — both confirmed, order complete
{
  "data": {
    "order_id": "ord_010",
    "buyer_confirmed": true,
    "seller_confirmed": true,
    "completed": true,
    "completed_at": "2026-03-27T15:00:00Z"
  }
}
```

Always read `completed` from server. Double-submit is idempotent.

Errors: `401` `403` `404` `409` `500`

---

### `GET /orders/:id/audit-trail`

Get order audit log (state transitions, confirmations).

```json
// 200
{
  "data": [
    {
      "event": "order.created",
      "status": "reserved",
      "timestamp": "2026-03-27T12:10:00Z"
    },
    {
      "event": "buyer.confirmed",
      "timestamp": "2026-03-27T14:30:00Z"
    },
    {
      "event": "seller.confirmed",
      "timestamp": "2026-03-27T15:00:00Z"
    }
  ]
}
```

Errors: `401` `404` `500`

---

### `POST /orders/:id/reference-check/initiate`

Start reference check (vouching) process.

```json
// 200
{
  "data": {
    "reference_check_id": "ref_001",
    "status": "pending_response",
    "created_at": "2026-03-27T16:00:00Z"
  }
}
```

Errors: `401` `403` `404` `500`

---

---

# 7 · REFERENCE CHECKS (VOUCHING)

---

### `POST /reference-checks`

Create reference check (vouch).

```json
// Request
{
  "target_id": "507f1f77bcf86cd799439011",  // MongoDB User _id
  "order_id": "ord_010",                     // Completed order
  "reason": "Smooth transaction, reliable buyer"
}

// 201
{
  "data": {
    "_id": "ref_001",
    "target": "collector_x",
    "status": "pending_response",
    "created_at": "2026-03-27T14:00:00Z"
  }
}

// 429 — rate limited
{
  "message": "You have reached the maximum number of reference checks per hour",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 2942
}
```

Requirements:

- Order must be `reserved`, `completed`, or `delivered`
- `target_id` must be OTHER party in order
- Limit: 5 per hour per user

Errors: `400` `401` `404` `429` `500`

---

### `GET /reference-checks`

List reference checks.

Params: `role` (requester | target), `limit`, `offset`

```json
// 200
{
  "data": [
    {
      "_id": "ref_001",
      "target": "collector_x",
      "requester": "alex_carter",
      "reason": "Smooth transaction, reliable buyer",
      "status": "pending_response",
      "created_at": "2026-03-27T14:00:00Z"
    }
  ],
  "total": 12,
  "limit": 20,
  "offset": 0
}
```

Errors: `401` `500`

---

### `GET /reference-checks/:id`

Get reference check details.

```json
// 200
{
  "data": {
    "_id": "ref_001",
    "target": { "_id": "usr_buyer01", "display_name": "collector_x" },
    "requester": { "_id": "usr_001", "display_name": "alex_carter" },
    "order_id": "ord_010",
    "reason": "Smooth transaction, reliable buyer",
    "status": "pending_response",
    "created_at": "2026-03-27T14:00:00Z"
  }
}
```

Errors: `401` `404` `500`

---

### `POST /reference-checks/:id/respond`

Answer vouch questions.

```json
// Request
{
  "rating": "positive",
  "comment": "Great to work with, would transact again"
}

// 200
{
  "data": {
    "_id": "ref_001",
    "status": "confirmed",
    "rating": "positive",
    "updated_at": "2026-03-27T14:30:00Z"
  }
}
```

Rating: `positive` | `neutral` | `negative`

Errors: `400` `401` `404` `500`

---

### `POST /reference-checks/:id/complete`

Mark reference check complete.

```json
// 200
{
  "data": {
    "_id": "ref_001",
    "status": "completed",
    "completed_at": "2026-03-27T14:45:00Z"
  }
}
```

Errors: `401` `403` `404` `500`

---

### `DELETE /reference-checks/:id`

Delete reference check (if not yet responded).

```json
// 200
{ "data": { "success": true } }
```

Errors: `401` `403` `404` `500`

---

### `POST /reference-checks/:id/vouch`

Submit vouch (synonym for respond).

```json
// Request
{
  "rating": "positive",
  "comment": "Reliable partner"
}

// 200 — same as respond
{
  "data": {
    "_id": "ref_001",
    "status": "confirmed",
    "rating": "positive"
  }
}
```

Errors: `400` `401` `404` `500`

---

### `GET /reference-checks/:id/vouches`

Get all vouches (responses) for a check.

```json
// 200
{
  "data": [
    {
      "_id": "vouch_001",
      "rating": "positive",
      "comment": "Great seller, highly recommend",
      "submitted_at": "2026-03-27T14:30:00Z"
    }
  ]
}
```

Errors: `401` `404` `500`

---

### `GET /reference-checks/:id/summary`

Get trust score summary for user.

```json
// 200
{
  "data": {
    "user_id": "usr_001",
    "display_name": "alex_carter",
    "total_references": 142,
    "positive_count": 130,
    "neutral_count": 10,
    "negative_count": 2,
    "rating": 4.9,
    "status": "trusted"
  }
}
```

Errors: `401` `404` `500`

---

### `GET /reference-checks/:id/context`

Get all related references and vouches for context.

```json
// 200
{
  "data": {
    "check": {
      /* reference check object */
    },
    "related_vouches": [
      /* all vouches */
    ],
    "user_summary": {
      /* trust score */
    }
  }
}
```

Errors: `401` `404` `500`

---

### `GET /reference-checks/:id/progress`

Get completion progress of reference check.

```json
// 200
{
  "data": {
    "status": "pending_response",
    "responses_received": 3,
    "responses_required": 5,
    "percentage_complete": 60
  }
}
```

Errors: `401` `404` `500`

---

### `GET /reference-checks/:id/vouch-policy`

Get trust/vouch policy for this check.

```json
// 200
{
  "data": {
    "minimum_vouches": 3,
    "response_deadline": "2026-04-08T14:00:00Z",
    "rating_weights": {
      "positive": 1,
      "neutral": 0,
      "negative": -1
    }
  }
}
```

Errors: `401` `404` `500`

---

### `POST /reference-checks/:id/feedback`

Submit feedback on reference check.

```json
// Request
{
  "feedback": "This was very helpful",
  "helpfulness": 5
}

// 201
{
  "data": {
    "_id": "feedback_001",
    "created_at": "2026-03-27T15:00:00Z"
  }
}
```

Errors: `400` `401` `404` `500`

---

### `GET /reference-checks/:id/feedback`

Get feedback on reference check.

```json
// 200
{
  "data": [
    {
      "_id": "feedback_001",
      "feedback": "This was very helpful",
      "helpfulness": 5,
      "submitted_at": "2026-03-27T15:00:00Z"
    }
  ]
}
```

Errors: `401` `404` `500`

---

### `GET /reference-checks/:id/audit`

Get full audit log of reference check.

```json
// 200
{
  "data": [
    {
      "event": "reference_check.created",
      "timestamp": "2026-03-27T14:00:00Z",
      "actor": "usr_001"
    },
    {
      "event": "vouch.submitted",
      "timestamp": "2026-03-27T14:30:00Z",
      "actor": "usr_002"
    }
  ]
}
```

Errors: `401` `404` `500`

---

### `POST /reference-checks/:id/share-link`

Create shareable link for reference check.

```json
// 201
{
  "data": {
    "link": "https://dialist.app/ref/abc123",
    "expires_at": "2026-05-08T14:00:00Z"
  }
}
```

Errors: `401` `404` `500`

---

### `POST /reference-checks/:id/suspend`

Suspend reference check (curator action).

```json
// Request
{ "reason": "Fraudulent submission" }

// 200
{
  "data": {
    "_id": "ref_001",
    "status": "suspended",
    "suspended_at": "2026-03-27T15:30:00Z"
  }
}
```

Errors: `400` `401` `403` `404` `500`

---

### `GET /reference-checks/:id/trust-safety/status`

Get trust & safety status.

```json
// 200
{
  "data": {
    "status": "verified",
    "trust_tier": "gold",
    "flagged": false,
    "appeals_available": 0
  }
}
```

Errors: `401` `404` `500`

---

### `POST /reference-checks/:id/trust-safety/appeal`

Appeal trust & safety decision.

```json
// Request
{ "appeal_reason": "I believe this decision is unfair" }

// 201
{
  "data": {
    "appeal_id": "appeal_001",
    "status": "pending_review",
    "created_at": "2026-03-27T16:00:00Z"
  }
}
```

Errors: `400` `401` `404` `500`

---

---

# 8 · INQUIRIES

---

### `POST /listings/:id/inquire`

Ask question on listing.

```json
// Request
{ "message": "Can you ship to Canada? Still available?" }

// 201
{
  "data": {
    "_id": "inq_001",
    "conversation_id": "conv_001",
    "status": "active",
    "created_at": "2026-03-27T11:00:00Z"
  }
}
```

Errors: `400` `401` `404` `500`

---

---

# 9 · CONVERSATIONS & MESSAGES

---

### `GET /conversations`

List all conversations.

Params: `limit`, `offset`

```json
// 200
{
  "data": [
    {
      "_id": "conv_001",
      "listing_id": "lst_001",
      "listing_title": "Rolex Submariner 126610LN",
      "other_user": { "_id": "usr_001", "display_name": "alex_carter" },
      "last_message": "Are you still available?",
      "last_message_at": "2026-03-27T14:30:00Z",
      "unread_count": 2
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

Errors: `401` `500`

---

### `GET /conversations/search`

Search conversations by message content or participant.

Params: `q` (search string)

```json
// 200
{
  "data": [
    {
      "_id": "conv_001",
      "listing_title": "Rolex Submariner 126610LN",
      "matching_message": "Yes, still available next week"
    }
  ]
}
```

Errors: `400` `401` `500`

---

### `GET /conversations/:id`

Get conversation details.

```json
// 200
{
  "data": {
    "_id": "conv_001",
    "listing_id": "lst_001",
    "listing_title": "Rolex Submariner 126610LN",
    "other_user": { "_id": "usr_001", "display_name": "alex_carter" },
    "message_count": 15,
    "created_at": "2026-03-27T11:00:00Z"
  }
}
```

Errors: `401` `404` `500`

---

### `GET /conversations/:id/media`

Get media files shared in conversation.

```json
// 200
{
  "data": [
    {
      "_id": "media_001",
      "type": "image",
      "url": "https://...",
      "shared_by": "usr_001",
      "shared_at": "2026-03-27T11:15:00Z"
    }
  ]
}
```

Errors: `401` `404` `500`

---

### `GET /chats`

List all chats (alias for conversations, seller perspective).

```json
// 200 — same structure as /conversations
{
  "data": [
    {
      "_id": "conv_001",
      "other_user": { "_id": "usr_buyer01", "display_name": "collector_x" },
      "last_message": "Is this still available?",
      "unread_count": 1
    }
  ]
}
```

Errors: `401` `500`

---

### `GET /chat/token`

Get GetStream chat token.

```json
// 200
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expires": 3600
  }
}
```

Errors: `401` `500`

---

### `GET /chat/channels`

Get user's channels.

```json
// 200
{
  "data": [
    {
      "id": "messaging:lst_001-usr_001",
      "type": "messaging",
      "member_count": 2,
      "created_at": "2026-03-27T11:00:00Z"
    }
  ]
}
```

Errors: `401` `500`

---

### `GET /chat/unread`

Get unread message counts by channel.

```json
// 200
{
  "data": [
    {
      "channel_id": "messaging:lst_001-usr_001",
      "unread_count": 3
    }
  ],
  "total_unread": 8
}
```

Errors: `401` `500`

---

### `POST /chat/channel`

Get or create conversation channel.

```json
// Request
{
  "listing_id": "lst_001",
  "seller_id": "usr_001"
}

// 200
{
  "data": {
    "channel_id": "messaging:lst_001-usr_001",
    "created": false
  }
}
```

Errors: `400` `401` `404` `500`

---

### `POST /messages/send`

Send message in conversation.

```json
// Request
{
  "channel_id": "messaging:lst_001-usr_001",
  "text": "Great item! When can you ship?"
}

// 201
{
  "data": {
    "_id": "msg_001",
    "text": "Great item! When can you ship?",
    "user_id": "usr_buyer01",
    "created_at": "2026-03-27T14:30:00Z"
  }
}

// 403 — not channel member
{
  "message": "Not a member of this channel",
  "code": "AUTHORIZATION_ERROR"
}
```

Errors: `400` `401` `403` `404` `500`

---

### `POST /messages/:id/read`

Mark message as read.

```json
// 200
{
  "data": {
    "_id": "msg_001",
    "read": true,
    "read_at": "2026-03-27T14:35:00Z"
  }
}
```

Errors: `401` `404` `500`

---

### `POST /messages/:id/react`

Add emoji reaction to message.

```json
// Request
{ "emoji": "👍" }

// 200
{
  "data": {
    "_id": "msg_001",
    "reactions": { "👍": 1 }
  }
}
```

Errors: `400` `401` `404` `500`

---

### `POST /messages/:id/unreact`

Remove emoji reaction from message.

```json
// Request
{ "emoji": "👍" }

// 200
{
  "data": {
    "_id": "msg_001",
    "reactions": {}
  }
}
```

Errors: `401` `404` `500`

---

---

# 10 · USER PROFILE

---

### `GET /user`

Get current authenticated user profile.

```json
// 200
{
  "data": {
    "_id": "usr_001",
    "external_id": "user_36IcC3uo7Ch1Go4qYTZexUeWoZM",
    "display_name": "alex_carter",
    "first_name": "Alex",
    "last_name": "Carter",
    "email": "alex@example.com",
    "bio": "Independent dealer, 500+ transactions",
    "avatar_url": "https://...",
    "location": { "country": "US", "region": "CA" },
    "member_since": "2023-05-01T00:00:00Z"
  }
}
```

Errors: `401` `500`

---

### `GET /user/profile`

Get user's public profile (current user).

```json
// 200 — same as /user but limited fields
{
  "data": {
    "_id": "usr_001",
    "display_name": "alex_carter",
    "reputation": {
      "rating": 4.9,
      "reviews_count": 147
    }
  }
}
```

Errors: `401` `500`

---

### `PATCH /user/:id/profile`

Update user profile.

```json
// Request — all optional
{
  "bio": "Updated bio",
  "display_name": "new_username",
  "avatar_url": "https://..."
}

// 200
{
  "data": {
    "_id": "usr_001",
    "display_name": "new_username",
    "updated_at": "2026-03-27T16:00:00Z"
  }
}
```

Errors: `400` `401` `403` `404` `500`

---

### `GET /user/dashboard/stats`

Get user dashboard statistics.

```json
// 200
{
  "data": {
    "active_listings": 8,
    "sold_count": 45,
    "total_sales_value": 650000,
    "pending_orders": 3,
    "avg_rating": 4.9,
    "new_messages": 2,
    "unread_offers": 1
  }
}
```

Errors: `401` `500`

---

### `GET /user/blocks`

Get list of blocked users.

```json
// 200
{
  "data": [
    {
      "_id": "usr_003",
      "display_name": "problematic_user",
      "blocked_at": "2026-03-20T10:00:00Z"
    }
  ]
}
```

Errors: `401` `500`

---

### `GET /user/:id/references`

Get user's references (vouches).

Params: `role` (requester | target), `limit`, `offset`

```json
// 200
{
  "data": [
    {
      "_id": "ref_001",
      "type": "positive",
      "comment": "Trustworthy seller",
      "rating": 5,
      "from": "usr_002",
      "created_at": "2026-02-10T00:00:00Z"
    }
  ],
  "total": 142,
  "limit": 20,
  "offset": 0
}
```

Errors: `401` `404` `500`

---

### `GET /users/:id/profile`

Get public user profile.

```json
// 200
{
  "data": {
    "_id": "usr_001",
    "display_name": "alex_carter",
    "bio": "Independent dealer, 500+ transactions",
    "avatar_url": "https://...",
    "member_since": "2023-05-01T00:00:00Z",
    "location": { "city": "New York", "country": "US" },
    "reputation": {
      "rating": 4.9,
      "reviews_count": 147,
      "positive_refs": 130,
      "neutral_refs": 10,
      "negative_refs": 2,
      "active_listings": 8
    }
  }
}
```

Errors: `401` `404` `500`

---

### `GET /users/:id/listings`

Get user's public listings.

Params: `status` (active | sold | all), `limit`, `offset`

```json
// 200
{
  "data": [
    {
      "_id": "lst_001",
      "title": "Rolex Submariner 126610LN",
      "price": 14500,
      "status": "active",
      "thumbnail_url": "https://..."
    }
  ],
  "total": 8,
  "limit": 20,
  "offset": 0
}
```

Errors: `401` `404` `500`

---

### `GET /users/:id/common-groups`

Get groups that both users are in.

```json
// 200
{
  "data": [
    {
      "_id": "grp_001",
      "name": "B2B Sellers Network",
      "member_count": 45
    }
  ]
}
```

Errors: `401` `404` `500`

---

### `POST /users/:id/connections`

Send connection request.

```json
// 201
{
  "message": "Connection request sent",
  "connection": {
    "follower_id": "usr_buyer01",
    "following_id": "usr_001",
    "status": "pending"
  }
}

// 409 — already connected
{
  "message": "A connection or request already exists",
  "code": "CONNECTION_EXISTS"
}
```

Errors: `401` `409` `500`

---

### `DELETE /users/:id/connections`

Remove connection.

```json
// 200
{
  "message": "Connection removed",
  "data": { "success": true }
}
```

Errors: `401` `404` `500`

---

### `GET /connections/my-incoming`

Get pending connection requests (incoming).

```json
// 200
{
  "data": [
    {
      "_id": "conn_001",
      "from": "usr_002",
      "requested_at": "2026-03-25T10:00:00Z"
    }
  ]
}
```

Errors: `401` `500`

---

### `GET /connections/my-outgoing`

Get pending connection requests (outgoing).

```json
// 200
{
  "data": [
    {
      "_id": "conn_001",
      "to": "usr_003",
      "requested_at": "2026-03-26T10:00:00Z"
    }
  ]
}
```

Errors: `401` `500`

---

### `GET /connections`

Get all connections.

```json
// 200
{
  "data": [
    {
      "_id": "conn_001",
      "from": "usr_001",
      "to": "usr_002",
      "status": "accepted",
      "connected_at": "2026-03-20T10:00:00Z"
    }
  ]
}
```

Errors: `401` `500`

---

### `POST /connections`

Create new connection.

```json
// Request
{ "user_id": "usr_002" }

// 201
{
  "data": {
    "_id": "conn_001",
    "status": "pending",
    "created_at": "2026-03-27T10:00:00Z"
  }
}
```

Errors: `400` `401` `500`

---

### `POST /connections/:id/accept`

Accept connection request.

```json
// 200
{
  "data": {
    "_id": "conn_001",
    "status": "accepted",
    "accepted_at": "2026-03-27T10:15:00Z"
  }
}
```

Errors: `401` `403` `404` `500`

---

### `POST /connections/:id/reject`

Reject connection request.

```json
// 200
{
  "data": {
    "_id": "conn_001",
    "status": "rejected",
    "rejected_at": "2026-03-27T10:20:00Z"
  }
}
```

Errors: `401` `403` `404` `500`

---

### `DELETE /connections/:id`

Delete connection.

```json
// 200
{ "data": { "success": true } }
```

Errors: `401` `404` `500`

---

### `POST /users/:id/block`

Block user.

```json
// Request
{ "reason": "safety" }

// 201
{
  "data": {
    "success": true,
    "message": "User blocked successfully"
  }
}

// 409 — already blocked
{
  "message": "This user is already blocked",
  "code": "USER_ALREADY_BLOCKED"
}
```

Errors: `400` `401` `409` `500`

---

### `DELETE /users/:id/block`

Unblock user.

```json
// 200
{ "data": { "success": true } }
```

Errors: `401` `404` `500`

---

### `POST /users/:id/report`

Report user for violation.

```json
// Request
{
  "reason": "fraud",
  "description": "Suspicious behavior during transaction"
}

// 201
{
  "data": {
    "_id": "rep_001",
    "target_id": "usr_001",
    "reason": "fraud",
    "status": "pending",
    "created_at": "2026-03-27T16:00:00Z"
  }
}

// 409 — already reported
{
  "message": "You have already submitted a report against this user",
  "code": "REPORT_ALREADY_EXISTS"
}
```

Errors: `400` `401` `409` `500`

---

---

# 11 · FEED & DISCOVERY

---

### `GET /feed/token`

Get GetStream feed token.

```json
// 200
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "api_key": "b5z5jt844r2xf",
    "expires": 3600
  }
}
```

Errors: `401` `500`

---

### `GET /feed`

Get personalized feed.

Params: `limit`, `offset`

```json
// 200
{
  "data": [
    {
      "_id": "feed_001",
      "type": "listing_published",
      "actor": "usr_002",
      "listing": { "_id": "lst_010", "title": "New Watch" },
      "created_at": "2026-03-27T14:00:00Z"
    }
  ]
}
```

Errors: `401` `500`

---

### `GET /feed/enriched`

Get enriched feed with full entity details.

```json
// 200
{
  "data": [
    {
      "activity_id": "feed_001",
      "type": "listing_published",
      "actor_details": { "_id": "usr_002", "display_name": "seller_beta" },
      "listing_details": {
        /* full listing object */
      },
      "created_at": "2026-03-27T14:00:00Z"
    }
  ]
}
```

Errors: `401` `500`

---

### `GET /feed/trending`

Get trending listings and users.

```json
// 200
{
  "data": {
    "trending_listings": [{ "_id": "lst_001", "title": "...", "views": 150 }],
    "trending_users": [
      { "_id": "usr_001", "display_name": "...", "new_followers": 25 }
    ]
  }
}
```

Errors: `401` `500`

---

### `GET /feed/connections`

Get feed from connections only.

```json
// 200 — same structure as /feed
{
  "data": [
    /* feed items from connections */
  ]
}
```

Errors: `401` `500`

---

---

# 12 · SEARCH

---

### `GET /search`

Global multi-entity search.

Params: `q` (search string), `limit`, `offset`

```json
// 200
{
  "data": {
    "listings": [
      {
        "_id": "lst_001",
        "title": "Rolex Submariner 126610LN",
        "price": 14500,
        "seller": "alex_carter"
      }
    ],
    "users": [
      {
        "_id": "usr_001",
        "display_name": "alex_carter",
        "rating": 4.9
      }
    ],
    "groups": [
      {
        "_id": "grp_001",
        "name": "B2B Sellers",
        "member_count": 45
      }
    ]
  }
}
```

Errors: `400` `401` `500`

---

### `GET /search/popular-brands`

Get popular brands for autocomplete.

Params: `limit` (20)

```json
// 200
{
  "data": ["Rolex", "Omega", "Patek Philippe", "Cartier", "Breitling"]
}
```

Errors: `401` `500`

---

---

# 13 · NOTIFICATIONS

---

### `GET /notifications`

Get user notifications.

Params: `limit` (20), `offset` (0), `unread_only`, `types` (comma-separated), `tab` (all | buying | selling | social | system)

```json
// 200
{
  "platform": "networks",
  "data": [
    {
      "_id": "notif_001",
      "type": "offer_received",
      "title": "New offer on your listing",
      "message": "alex_buyer offered $13,500",
      "unread": true,
      "created_at": "2026-03-27T14:30:00Z"
    }
  ],
  "total": 25,
  "unread_count": 5,
  "limit": 20,
  "offset": 0
}
```

Errors: `401` `500`

---

### `GET /notifications/unread-count`

Get unread notification count.

```json
// 200
{
  "platform": "networks",
  "unread_count": 5
}
```

Errors: `401` `500`

---

### `POST /notifications/:id/read`

Mark notification as read.

```json
// 200
{
  "platform": "networks",
  "success": true,
  "id": "notif_001"
}
```

Errors: `401` `404` `500`

---

### `POST /notifications/mark-all-read`

Mark all notifications as read.

Params: `tab` (optional)

```json
// 200
{
  "platform": "networks",
  "success": true,
  "marked_count": 5
}
```

Errors: `401` `500`

---

### `DELETE /notifications/:id`

Delete notification.

```json
// 200
{ "data": { "success": true } }
```

Errors: `401` `404` `500`

---

---

# 14 · RESERVATIONS

---

### `GET /reservations/:id`

Get reservation details.

```json
// 200
{
  "data": {
    "_id": "ord_010",
    "listing_id": "lst_001",
    "listing_title": "Rolex Submariner 126610LN",
    "status": "reserved",
    "amount": 14500,
    "currency": "USD",
    "buyer_id": "usr_buyer01",
    "seller_id": "usr_001",
    "reservation_terms_snapshot": "Verified buyers only",
    "shipping_region": "US",
    "buyer_confirmed": false,
    "seller_confirmed": false,
    "completed": false,
    "created_at": "2026-03-27T12:10:00Z"
  }
}
```

Errors: `401` `404` `500`

---

---

# 15 · WEBHOOKS

---

### `POST /webhooks/getstream`

GetStream webhook endpoint.

Events: message.created, message.updated, user.presence.changed, typing.start, typing.stop, etc.

```json
// Incoming webhook (example: message.created)
{
  "type": "message.created",
  "event_id": "msg_123456",
  "user": { "id": "stream_usr_buyer01", "name": "collector_x" },
  "message": {
    "id": "msg_123456",
    "text": "Interested in this item",
    "created_at": "2026-03-27T14:30:00Z",
    "channel": { "id": "messaging:lst_001", "type": "messaging" }
  }
}

// Server response (must be 200-299)
{ "success": true }
```

**Required**: Signature verification with GetStream SDK

Errors: `401` `500`

---

---

# 16 · COMPLETE ENDPOINT INDEX

| #   | Method | Path                                        | Section |
| --- | ------ | ------------------------------------------- | ------- |
| 1   | GET    | `/user/tokens`                              | 1       |
| 2   | GET    | `/onboarding/status`                        | 2       |
| 3   | PATCH  | `/onboarding/complete`                      | 2       |
| 4   | GET    | `/social/groups`                            | 3       |
| 5   | POST   | `/social/groups`                            | 3       |
| 6   | GET    | `/social/groups/:id`                        | 3       |
| 7   | POST   | `/social/groups/:id/join`                   | 3       |
| 8   | DELETE | `/social/groups/:id/leave`                  | 3       |
| 9   | GET    | `/social/groups/:id/members`                | 3       |
| 10  | POST   | `/social/groups/:id/members`                | 3       |
| 11  | DELETE | `/social/groups/:id/members/:userId`        | 3       |
| 12  | PATCH  | `/social/groups/:id/members/:userId/role`   | 3       |
| 13  | POST   | `/social/groups/:id/mute`                   | 3       |
| 14  | GET    | `/social/groups/:id/shared-links`           | 3       |
| 15  | POST   | `/social/groups/:id/shared-links`           | 3       |
| 16  | GET    | `/social/groups/:id/shared-media`           | 3       |
| 17  | POST   | `/social/invites`                           | 3       |
| 18  | GET    | `/social/invites/:token`                    | 3       |
| 19  | GET    | `/social/status`                            | 3       |
| 20  | GET    | `/social/discover`                          | 3       |
| 21  | GET    | `/social/search`                            | 3       |
| 22  | GET    | `/social/conversations/:id/content`         | 3       |
| 23  | GET    | `/social/conversations/:id/search`          | 3       |
| 24  | GET    | `/social/conversations/:id/events`          | 3       |
| 25  | GET    | `/social/chat-profile/:userId`              | 3       |
| 26  | GET    | `/listings`                                 | 4       |
| 27  | POST   | `/listings`                                 | 4       |
| 28  | GET    | `/listings/:id`                             | 4       |
| 29  | PATCH  | `/listings/:id`                             | 4       |
| 30  | POST   | `/listings/:id/publish`                     | 4       |
| 31  | DELETE | `/listings/:id`                             | 4       |
| 32  | POST   | `/listings/:id/images`                      | 4       |
| 33  | DELETE | `/listings/:id/images/:imageKey`            | 4       |
| 34  | POST   | `/listings/:id/offers`                      | 5       |
| 35  | GET    | `/offers`                                   | 5       |
| 36  | GET    | `/offers/:id`                               | 5       |
| 37  | GET    | `/offers/:id/terms-history`                 | 5       |
| 38  | POST   | `/offers/:id/counter`                       | 5       |
| 39  | POST   | `/offers/:id/accept`                        | 5       |
| 40  | POST   | `/offers/:id/reject`                        | 5       |
| 41  | POST   | `/offers/:id/decline`                       | 5       |
| 42  | GET    | `/orders`                                   | 6       |
| 43  | GET    | `/orders/:id`                               | 6       |
| 44  | GET    | `/orders/:id/completion-status`             | 6       |
| 45  | GET    | `/orders/:id/audit-trail`                   | 6       |
| 46  | POST   | `/listings/:id/reserve`                     | 6       |
| 47  | POST   | `/orders/:id/complete`                      | 6       |
| 48  | POST   | `/orders/:id/reference-check/initiate`      | 6       |
| 49  | POST   | `/reference-checks`                         | 7       |
| 50  | GET    | `/reference-checks`                         | 7       |
| 51  | GET    | `/reference-checks/:id`                     | 7       |
| 52  | POST   | `/reference-checks/:id/respond`             | 7       |
| 53  | POST   | `/reference-checks/:id/complete`            | 7       |
| 54  | DELETE | `/reference-checks/:id`                     | 7       |
| 55  | POST   | `/reference-checks/:id/vouch`               | 7       |
| 56  | GET    | `/reference-checks/:id/vouches`             | 7       |
| 57  | GET    | `/reference-checks/:id/summary`             | 7       |
| 58  | GET    | `/reference-checks/:id/context`             | 7       |
| 59  | GET    | `/reference-checks/:id/progress`            | 7       |
| 60  | GET    | `/reference-checks/:id/vouch-policy`        | 7       |
| 61  | POST   | `/reference-checks/:id/feedback`            | 7       |
| 62  | GET    | `/reference-checks/:id/feedback`            | 7       |
| 63  | GET    | `/reference-checks/:id/audit`               | 7       |
| 64  | POST   | `/reference-checks/:id/share-link`          | 7       |
| 65  | POST   | `/reference-checks/:id/suspend`             | 7       |
| 66  | GET    | `/reference-checks/:id/trust-safety/status` | 7       |
| 67  | POST   | `/reference-checks/:id/trust-safety/appeal` | 7       |
| 68  | POST   | `/listings/:id/inquire`                     | 8       |
| 69  | GET    | `/conversations`                            | 9       |
| 70  | GET    | `/conversations/search`                     | 9       |
| 71  | GET    | `/conversations/:id`                        | 9       |
| 72  | GET    | `/conversations/:id/media`                  | 9       |
| 73  | GET    | `/chats`                                    | 9       |
| 74  | GET    | `/chat/token`                               | 9       |
| 75  | GET    | `/chat/channels`                            | 9       |
| 76  | GET    | `/chat/unread`                              | 9       |
| 77  | POST   | `/chat/channel`                             | 9       |
| 78  | POST   | `/messages/send`                            | 9       |
| 79  | POST   | `/messages/:id/read`                        | 9       |
| 80  | POST   | `/messages/:id/react`                       | 9       |
| 81  | POST   | `/messages/:id/unreact`                     | 9       |
| 82  | GET    | `/user`                                     | 10      |
| 83  | GET    | `/user/profile`                             | 10      |
| 84  | PATCH  | `/user/:id/profile`                         | 10      |
| 85  | GET    | `/user/dashboard/stats`                     | 10      |
| 86  | GET    | `/user/blocks`                              | 10      |
| 87  | GET    | `/user/:id/references`                      | 10      |
| 88  | GET    | `/users/:id/profile`                        | 10      |
| 89  | GET    | `/users/:id/listings`                       | 10      |
| 90  | GET    | `/users/:id/common-groups`                  | 10      |
| 91  | POST   | `/users/:id/connections`                    | 10      |
| 92  | DELETE | `/users/:id/connections`                    | 10      |
| 93  | GET    | `/connections/my-incoming`                  | 10      |
| 94  | GET    | `/connections/my-outgoing`                  | 10      |
| 95  | GET    | `/connections`                              | 10      |
| 96  | POST   | `/connections`                              | 10      |
| 97  | POST   | `/connections/:id/accept`                   | 10      |
| 98  | POST   | `/connections/:id/reject`                   | 10      |
| 99  | DELETE | `/connections/:id`                          | 10      |
| 100 | POST   | `/users/:id/block`                          | 10      |
| 101 | DELETE | `/users/:id/block`                          | 10      |
| 102 | POST   | `/users/:id/report`                         | 10      |
| 103 | GET    | `/feed/token`                               | 11      |
| 104 | GET    | `/feed`                                     | 11      |
| 105 | GET    | `/feed/enriched`                            | 11      |
| 106 | GET    | `/feed/trending`                            | 11      |
| 107 | GET    | `/feed/connections`                         | 11      |
| 108 | GET    | `/search`                                   | 12      |
| 109 | GET    | `/search/popular-brands`                    | 12      |
| 110 | GET    | `/notifications`                            | 13      |
| 111 | GET    | `/notifications/unread-count`               | 13      |
| 112 | POST   | `/notifications/:id/read`                   | 13      |
| 113 | POST   | `/notifications/mark-all-read`              | 13      |
| 114 | DELETE | `/notifications/:id`                        | 13      |
| 115 | GET    | `/reservations/:id`                         | 14      |
| 116 | POST   | `/webhooks/getstream`                       | 15      |

---

**Total Endpoints: 116**
**Complete Coverage: ✅ 100%**

_Batch 4 · Production auth · April 2026_
