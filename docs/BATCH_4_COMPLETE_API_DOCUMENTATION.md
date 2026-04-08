# Batch 4 Complete API Documentation

**Generated**: April 8, 2026  
**Total APIs Documented**: 51 endpoints across 6 categories  
**Base URL**: `/api/v1/networks`  
**Authentication**: Bearer token (Clerk JWT)

---

## Table of Contents

1. **Social APIs** (23 endpoints)
2. **Offer APIs** (5 endpoints)
3. **Order APIs** (6 endpoints)
4. **Reference Check APIs** (12 endpoints)
5. **Users/Profile APIs** (8 endpoints)
6. **Conversation APIs** (8 endpoints)
7. **Connection APIs** (6 endpoints)

---

## 1. SOCIAL APIS (23 Endpoints)

### 1.1 GET /social/status

**Purpose**: Get social hub status summary (unread counts, online status)  
**HTTP Method**: GET  
**Auth**: Required (Bearer token)  
**Request Headers**:

```
Authorization: Bearer <clerk_jwt>
X-Request-ID: <uuid>
```

**Response** (200 OK):

```json
{
  "data": {
    "user_id": "66fb1a2e8b5d1234567890ab",
    "display_name": "John Seller",
    "avatar_url": "https://...",
    "online_status": "online",
    "unread_messages": 5,
    "unread_group_chats": 2,
    "unread_personal_chats": 3
  },
  "requestId": "req-123-456"
}
```

**Database Models**: User  
**GetStream Integration**: Queries GetStream channels for unread message counts

---

### 1.2 GET /social/inbox

**Purpose**: Get unified social inbox (Marketplace + Networks + Groups)  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**:

```
filter?: "all" | "messages" | "groups"
limit?: number (default: 20, max: 100)
offset?: number (default: 0)
```

**Request Example**:

```
GET /api/v1/networks/social/inbox?filter=all&limit=20&offset=0
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "conv-123",
      "type": "group",
      "name": "Sellers Network",
      "unread_count": 3,
      "last_message": "See you tomorrow",
      "last_message_at": "2026-04-08T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 20,
    "offset": 0
  },
  "requestId": "req-123-456"
}
```

**Database Models**: ChatMessage, SocialGroup  
**GetStream Integration**: Queries GetStream channels with filters

---

### 1.3 GET /social/search

**Purpose**: Multi-entity search (people, groups, messages)  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**:

```
q: string (search term)
type?: "people" | "groups" | "all" (default: "all")
limit?: number (default: 20)
offset?: number (default: 0)
```

**Request Example**:

```
GET /api/v1/networks/social/search?q=john&type=people&limit=10
```

**Response** (200 OK):

```json
{
  "data": {
    "people": [
      {
        "id": "user-123",
        "display_name": "John Doe",
        "avatar": "https://...",
        "online": true
      }
    ],
    "groups": [
      {
        "id": "group-456",
        "name": "Sellers Hub",
        "members_count": 45
      }
    ]
  }
}
```

---

### 1.4 GET /social/discover

**Purpose**: Get recommended people and groups  
**HTTP Method**: GET  
**Auth**: Required

**Response** (200 OK):

```json
{
  "data": {
    "recommended_people": [
      {
        "id": "user-789",
        "display_name": "Expert Seller",
        "mutual_connections": 5
      }
    ],
    "recommended_groups": [
      {
        "id": "group-999",
        "name": "Premium Sellers",
        "join_rate": "89%"
      }
    ]
  }
}
```

---

### 1.5 GET /social/groups

**Purpose**: List all groups (public + user's groups)  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**:

```
limit?: number (default: 20, max: 100)
offset?: number (default: 0)
filter?: "my" | "public" | "all"
```

**Request Example**:

```
GET /api/v1/networks/social/groups?filter=my&limit=20
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "69d44c4ceb790d48e9a66780",
      "name": "Premium Sellers",
      "description": "Exclusive group for vetted sellers",
      "members_count": 150,
      "is_member": true,
      "is_admin": true,
      "created_at": "2026-03-15T08:00:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "offset": 0
  }
}
```

**Database Models**: SocialGroup, SocialGroupMember

---

### 1.6 GET /social/groups/:id

**Purpose**: Get a single group's details  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (MongoDB ObjectId)

**Request Example**:

```
GET /api/v1/networks/social/groups/69d44c4ceb790d48e9a66780
```

**Response** (200 OK):

```json
{
  "data": {
    "id": "69d44c4ceb790d48e9a66780",
    "name": "Premium Sellers",
    "description": "Exclusive group for vetted sellers",
    "avatar": "https://...",
    "members_count": 150,
    "is_member": true,
    "is_admin": true,
    "permissions": {
      "can_post": true,
      "can_invite": true,
      "can_moderate": true
    },
    "created_at": "2026-03-15T08:00:00Z",
    "updated_at": "2026-04-08T10:00:00Z"
  }
}
```

---

### 1.7 POST /social/groups

**Purpose**: Create a new social group  
**HTTP Method**: POST  
**Auth**: Required

**Request Body**:

```json
{
  "name": "Test Group 1712558400",
  "description": "Integration test group",
  "privacy": "private"
}
```

**Response** (201 Created):

```json
{
  "data": {
    "id": "69d44c4ceb790d48e9a66781",
    "name": "Test Group 1712558400",
    "description": "Integration test group",
    "privacy": "private",
    "members_count": 1,
    "is_member": true,
    "is_admin": true,
    "created_at": "2026-04-08T10:30:00Z"
  }
}
```

**Database Models**: SocialGroup

---

### 1.8 POST /social/groups/:id/join

**Purpose**: Join a group  
**HTTP Method**: POST  
**Auth**: Required  
**Path Parameters**: `id` (group ID)

**Request Body**:

```json
{
  "notify_admins": true
}
```

**Response** (200 OK):

```json
{
  "data": {
    "id": "69d44c4ceb790d48e9a66780",
    "joined_at": "2026-04-08T10:35:00Z",
    "status": "active"
  }
}
```

---

### 1.9 DELETE /social/groups/:id/leave

**Purpose**: Leave a group  
**HTTP Method**: DELETE  
**Auth**: Required  
**Path Parameters**: `id` (group ID)

**Response** (200 OK):

```json
{
  "data": {
    "status": "left",
    "left_at": "2026-04-08T10:36:00Z"
  }
}
```

---

### 1.10 GET /social/groups/:id/members

**Purpose**: List group members  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (group ID)  
**Query Parameters**:

```
limit?: number (default: 20)
offset?: number (default: 0)
role?: "admin" | "moderator" | "member"
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "user_id": "user-123",
      "display_name": "John Doe",
      "avatar": "https://...",
      "role": "admin",
      "joined_at": "2026-03-15T08:00:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0
  }
}
```

**Database Models**: SocialGroup, SocialGroupMember, User

---

### 1.11 POST /social/groups/:id/members

**Purpose**: Add members to group  
**HTTP Method**: POST  
**Auth**: Required  
**Authorization**: Group admin only

**Request Body**:

```json
{
  "user_ids": ["user-456", "user-789"],
  "role": "member"
}
```

**Response** (201 Created):

```json
{
  "data": {
    "added_count": 2,
    "members": [
      {
        "user_id": "user-456",
        "role": "member",
        "added_at": "2026-04-08T10:40:00Z"
      }
    ]
  }
}
```

---

### 1.12 DELETE /social/groups/:id/members/:userId

**Purpose**: Remove a member from group  
**HTTP Method**: DELETE  
**Auth**: Required  
**Authorization**: Group admin or the user themselves

**Response** (200 OK):

```json
{
  "data": {
    "user_id": "user-456",
    "status": "removed"
  }
}
```

---

### 1.13 PATCH /social/groups/:id/members/:userId/role

**Purpose**: Update member role  
**HTTP Method**: PATCH  
**Auth**: Required  
**Authorization**: Group admin only

**Request Body**:

```json
{
  "role": "moderator"
}
```

**Response** (200 OK):

```json
{
  "data": {
    "user_id": "user-456",
    "role": "moderator",
    "updated_at": "2026-04-08T10:45:00Z"
  }
}
```

---

### 1.14 POST /social/groups/:id/mute

**Purpose**: Mute group notifications  
**HTTP Method**: POST  
**Auth**: Required

**Request Body**:

```json
{
  "mute": true,
  "duration": "permanent"
}
```

**Response** (200 OK):

```json
{
  "data": {
    "status": "muted",
    "muted_until": null
  }
}
```

---

### 1.15 GET /social/groups/:id/shared-links

**Purpose**: Get shared links in group  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**:

```
limit?: number
offset?: number
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "link-123",
      "url": "https://example.com",
      "title": "Test Link",
      "shared_by": "user-123",
      "shared_at": "2026-04-08T10:00:00Z"
    }
  ]
}
```

---

### 1.16 POST /social/groups/:id/shared-links

**Purpose**: Share a link in group  
**HTTP Method**: POST  
**Auth**: Required

**Request Body**:

```json
{
  "url": "https://example.com",
  "title": "Test Link",
  "description": "A great article"
}
```

**Response** (201 Created):

```json
{
  "data": {
    "id": "link-124",
    "url": "https://example.com",
    "title": "Test Link",
    "shared_by": "user-123",
    "shared_at": "2026-04-08T10:50:00Z"
  }
}
```

---

### 1.17 GET /social/groups/:id/shared-media

**Purpose**: Get shared media files in group  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**:

```
limit?: number (default: 20)
offset?: number (default: 0)
type?: "image" | "video" | "audio"
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "media-123",
      "type": "image",
      "url": "https://cloud.../image.jpg",
      "shared_by": "user-123",
      "shared_at": "2026-04-08T09:00:00Z"
    }
  ]
}
```

---

### 1.18 GET /social/groups/:id/shared-files

**Purpose**: Get shared files in group  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**:

```
limit?: number
offset?: number
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "file-123",
      "name": "proposal.pdf",
      "url": "https://cloud.../proposal.pdf",
      "size_kb": 250,
      "shared_by": "user-123",
      "shared_at": "2026-04-08T09:15:00Z"
    }
  ]
}
```

---

### 1.19 POST /social/invites

**Purpose**: Create a social invite link  
**HTTP Method**: POST  
**Auth**: Required

**Request Body**:

```json
{
  "group_id": "69d44c4ceb790d48e9a66780",
  "expires_at": "2026-04-15T00:00:00Z",
  "max_uses": 10
}
```

**Response** (201 Created):

```json
{
  "data": {
    "token": "invite_token_abc123xyz",
    "link": "https://dialist.com/join/invite_token_abc123xyz",
    "group_id": "69d44c4ceb790d48e9a66780",
    "expires_at": "2026-04-15T00:00:00Z",
    "uses": 0,
    "max_uses": 10
  }
}
```

**Database Models**: SocialInvite

---

### 1.20 GET /social/invites/:token

**Purpose**: Validate/Get an invite token  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `token` (invite token)

**Response** (200 OK):

```json
{
  "data": {
    "token": "invite_token_abc123xyz",
    "group_id": "69d44c4ceb790d48e9a66780",
    "group_name": "Premium Sellers",
    "group_avatar": "https://...",
    "is_valid": true,
    "expires_at": "2026-04-15T00:00:00Z",
    "uses": 2,
    "max_uses": 10
  }
}
```

---

### 1.21 GET /social/conversations/:id/content

**Purpose**: Get shared content in conversation  
**HTTP Method**: GET  
**Auth**: Required

**Response** (200 OK):

```json
{
  "data": {
    "messages": [
      {
        "id": "msg-123",
        "type": "text",
        "content": "Check this out",
        "created_at": "2026-04-08T10:00:00Z"
      }
    ]
  }
}
```

---

### 1.22 GET /social/conversations/:id/search

**Purpose**: Search within conversation  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**: `q` (search term)

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "msg-123",
      "content": "search result",
      "created_at": "2026-04-08T10:00:00Z"
    }
  ]
}
```

---

### 1.23 GET /social/chat-profile/:userId

**Purpose**: Get user's chat profile  
**HTTP Method**: GET  
**Auth**: Required

**Response** (200 OK):

```json
{
  "data": {
    "user_id": "user-123",
    "display_name": "John Doe",
    "avatar": "https://...",
    "online": true,
    "last_seen": "2026-04-08T10:55:00Z",
    "bio": "Trusted seller"
  }
}
```

---

## 2. OFFER APIS (5 Endpoints)

### 2.1 GET /offers

**Purpose**: List all offers (sent/received)  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**:

```
type?: "sent" | "received" (default: all)
status?: string (default: all)
limit?: number (default: 20, max: 100)
offset?: number (default: 0)
```

**Request Example**:

```
GET /api/v1/networks/offers?type=received&status=open&limit=20&offset=0
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "69cc5159cf0fca3e239f7808",
      "listing_id": "69c2b51234567890abcdef00",
      "from_user_id": "user-seller",
      "to_user_id": "user-buyer",
      "amount": 1500,
      "currency": "USD",
      "state": "CREATED",
      "created_at": "2026-04-07T14:30:00Z",
      "expires_at": "2026-04-14T14:30:00Z"
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 20,
    "offset": 0
  }
}
```

**Database Models**: Offer, NetworkListing

---

### 2.2 GET /offers/:id

**Purpose**: Get offer details  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (offer ID)

**Request Example**:

```
GET /api/v1/networks/offers/69cc5159cf0fca3e239f7808
```

**Response** (200 OK):

```json
{
  "data": {
    "id": "69cc5159cf0fca3e239f7808",
    "listing": {
      "id": "69c2b51234567890abcdef00",
      "title": "MacBook Pro 2023",
      "price": 1800
    },
    "from_user": {
      "id": "user-seller",
      "display_name": "John Seller"
    },
    "to_user": {
      "id": "user-buyer",
      "display_name": "Jane Buyer"
    },
    "amount": 1500,
    "currency": "USD",
    "state": "CREATED",
    "last_offer": {
      "amount": 1500,
      "user_id": "user-seller",
      "created_at": "2026-04-07T14:30:00Z"
    },
    "negotiation_rounds": 0,
    "expires_at": "2026-04-14T14:30:00Z",
    "created_at": "2026-04-07T14:30:00Z"
  }
}
```

---

### 2.3 GET /offers/:id/terms-history

**Purpose**: Get offer negotiation history  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (offer ID)

**Response** (200 OK):

```json
{
  "data": {
    "offer_id": "69cc5159cf0fca3e239f7808",
    "history": [
      {
        "round": 1,
        "amount": 1500,
        "proposed_by": "user-seller",
        "created_at": "2026-04-07T14:30:00Z"
      },
      {
        "round": 2,
        "amount": 1550,
        "proposed_by": "user-buyer",
        "created_at": "2026-04-07T15:00:00Z"
      }
    ],
    "current_amount": 1550,
    "negotiation_rounds": 2
  }
}
```

**Database Models**: Offer, OfferRevision

---

### 2.4 POST /offers/:id/counter

**Purpose**: Make a counter offer  
**HTTP Method**: POST  
**Auth**: Required  
**Path Parameters**: `id` (offer ID)

**Request Body**:

```json
{
  "amount": 1550,
  "terms": "Can do this price if delivery included"
}
```

**Response** (201 Created):

```json
{
  "data": {
    "id": "69cc5159cf0fca3e239f7808",
    "state": "COUNTERED",
    "amount": 1550,
    "terms": "Can do this price if delivery included",
    "current_offerer": "user-buyer",
    "updated_at": "2026-04-07T15:00:00Z",
    "expires_at": "2026-04-14T15:00:00Z"
  }
}
```

**Business Logic**:

- Buyer cannot offer above asking price
- Seller cannot offer below last offer
- Updates negotiation round counter
- Extends expiration time

---

### 2.5 POST /offers/:id/accept

**Purpose**: Accept an offer  
**HTTP Method**: POST  
**Auth**: Required  
**Path Parameters**: `id` (offer ID)

**Request Body**: None required

**Response** (200 OK):

```json
{
  "data": {
    "id": "69cc5159cf0fca3e239f7808",
    "state": "ACCEPTED",
    "amount": 1550,
    "accepted_by": "user-buyer",
    "accepted_at": "2026-04-07T15:30:00Z",
    "next_step": "Payment processing",
    "order_id": "69cc515bcf0fca3e239f7811"
  }
}
```

**Business Logic**:

- Both or either party can accept
- Creates Order upon acceptance
- Transitions to payment flow

---

### 2.6 GET /offers-inquiries (Alias)

**Purpose**: Alias for GET /offers for legacy naming  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**: Same as GET /offers

**Response** (200 OK): Same as GET /offers

---

## 3. ORDER APIS (6 Endpoints)

### 3.1 GET /orders

**Purpose**: List all user's orders (buy/sell)  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**:

```
type?: "buy" | "sell" (default: all)
status?: string (default: all)
limit?: number (default: 20, max: 100)
offset?: number (default: 0)
```

**Request Example**:

```
GET /api/v1/networks/orders?type=buy&status=completed&limit=20
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "69cc515bcf0fca3e239f7811",
      "listing_id": "69c2b51234567890abcdef00",
      "buyer_id": "user-buyer",
      "seller_id": "user-seller",
      "amount": 1550,
      "currency": "USD",
      "status": "completed",
      "offer_id": "69cc5159cf0fca3e239f7808",
      "listing_type": "NetworkListing",
      "created_at": "2026-04-07T15:30:00Z",
      "completed_at": "2026-04-08T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 8,
    "limit": 20,
    "offset": 0
  }
}
```

**Database Models**: Order, NetworkListing

---

### 3.2 GET /orders/:id

**Purpose**: Get order details with completion status  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (order ID)

**Request Example**:

```
GET /api/v1/networks/orders/69cc515bcf0fca3e239f7811
```

**Response** (200 OK):

```json
{
  "data": {
    "id": "69cc515bcf0fca3e239f7811",
    "listing": {
      "id": "69c2b51234567890abcdef00",
      "title": "MacBook Pro 2023"
    },
    "buyer": {
      "id": "user-buyer",
      "display_name": "Jane Buyer"
    },
    "seller": {
      "id": "user-seller",
      "display_name": "John Seller"
    },
    "amount": 1550,
    "currency": "USD",
    "status": "completed",
    "reference_check": {
      "status": "pending",
      "current_check_id": "69d4dd12eb790d48e9a686cd",
      "total_checks": 1
    },
    "completion_status": {
      "buyer_confirmed": true,
      "seller_confirmed": false,
      "waiting_for": "seller",
      "completed": false
    },
    "created_at": "2026-04-07T15:30:00Z",
    "completed_at": null
  }
}
```

**Authorization**: Buyer or Seller only  
**Database Models**: Order, ReferenceCheck

---

### 3.3 GET /orders/:id/completion-status

**Purpose**: Get dual-confirmation status for order completion  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (order ID)

**Response** (200 OK):

```json
{
  "data": {
    "order_id": "69cc515bcf0fca3e239f7811",
    "buyer_confirmed": true,
    "seller_confirmed": false,
    "waiting_for": "seller",
    "completed": false,
    "confirmation_deadline": "2026-04-15T15:30:00Z",
    "messages": {
      "buyer": "Confirmed order completion on April 8",
      "seller": "Not yet confirmed"
    }
  }
}
```

---

### 3.4 POST /orders/:id/complete

**Purpose**: Confirm order completion (dual-confirmation required)  
**HTTP Method**: POST  
**Auth**: Required  
**Path Parameters**: `id` (order ID)

**Request Body**:

```json
{
  "notes": "Item received in excellent condition"
}
```

**Response** (200 OK):

```json
{
  "data": {
    "order_id": "69cc515bcf0fca3e239f7811",
    "confirmed_by": "user-buyer",
    "confirmed_at": "2026-04-08T10:00:00Z",
    "status": "pending_seller_confirmation",
    "buyer_confirmed": true,
    "seller_confirmed": false,
    "waiting_for": "seller"
  }
}
```

**Business Logic**:

- Both buyer AND seller must call independently
- Order only "completed" when both confirm
- If active reference check exists, it completes as side effect
- Dual-confirmation prevents false claims

---

### 3.5 POST /orders/:id/reference-check/initiate

**Purpose**: Initiate reference check for order  
**HTTP Method**: POST  
**Auth**: Required  
**Path Parameters**: `id` (order ID)

**Request Body**:

```json
{
  "target_id": "user-seller",
  "reason": "Request feedback on transaction"
}
```

**Response** (201 Created):

```json
{
  "data": {
    "reference_check_id": "69d4dd12eb790d48e9a686cd",
    "order_id": "69cc515bcf0fca3e239f7811",
    "target_id": "user-seller",
    "requester_id": "user-buyer",
    "status": "pending",
    "created_at": "2026-04-08T10:10:00Z",
    "expires_at": "2026-04-15T10:10:00Z"
  }
}
```

**Business Logic**:

- Can only be initiated after order becomes reserved/completed
- Target must be other party in order
- Prevents reviewing yourself

---

### 3.6 GET /orders/:id/audit-trail

**Purpose**: Get complete order action history  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (order ID)

**Response** (200 OK):

```json
{
  "data": {
    "order_id": "69cc515bcf0fca3e239f7811",
    "events": [
      {
        "timestamp": "2026-04-07T15:30:00Z",
        "action": "order_created",
        "actor": "system",
        "details": "Order created from accepted offer"
      },
      {
        "timestamp": "2026-04-08T10:00:00Z",
        "action": "completion_confirmed",
        "actor": "user-buyer",
        "details": "Buyer confirmed order completion"
      }
    ]
  }
}
```

**Database Models**: Order, AuditLog

---

## 4. REFERENCE CHECK APIS (12 Endpoints)

### 4.1 POST /reference-checks

**Purpose**: Create a reference check request  
**HTTP Method**: POST  
**Auth**: Required

**Request Body**:

```json
{
  "target_id": "669a1b2c3d4e5f6g7h8i9j0k",
  "order_id": "69cc515bcf0fca3e239f7811",
  "reason": "Request feedback on transaction"
}
```

**Response** (201 Created):

```json
{
  "data": {
    "id": "69d4dd12eb790d48e9a686cd",
    "status": "pending",
    "requester": {
      "id": "user-buyer",
      "display_name": "Jane Buyer"
    },
    "target": {
      "id": "user-seller",
      "display_name": "John Seller"
    },
    "order_id": "69cc515bcf0fca3e239f7811",
    "transaction_value": 1550,
    "reason": "Request feedback on transaction",
    "created_at": "2026-04-08T10:10:00Z",
    "expires_at": "2026-04-22T10:10:00Z"
  }
}
```

**Validation Rules**:

- Order must be completed/reserved/delivered
- Target must be other party in order
- Cannot request reference for yourself
- Cannot have duplicate pending request

**Database Models**: ReferenceCheck, Order, User  
**GetStream Integration**: May trigger notifications

---

### 4.2 GET /reference-checks

**Purpose**: List reference checks  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**:

```
filter?: "all" | "requested" | "responses" | "completed" (default: "all")
limit?: number (default: 20, max: 100)
offset?: number (default: 0)
```

**Request Example**:

```
GET /api/v1/networks/reference-checks?filter=requested&limit=20
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "69d4dd12eb790d48e9a686cd",
      "requester_id": "user-buyer",
      "target_id": "user-seller",
      "status": "pending",
      "responses": 0,
      "created_at": "2026-04-08T10:10:00Z"
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 20,
    "offset": 0
  }
}
```

---

### 4.3 GET /reference-checks/:id

**Purpose**: Get reference check details  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (reference check ID)

**Response** (200 OK):

```json
{
  "data": {
    "id": "69d4dd12eb790d48e9a686cd",
    "status": "pending",
    "requester": {
      "id": "user-buyer",
      "display_name": "Jane Buyer",
      "avatar": "https://..."
    },
    "target": {
      "id": "user-seller",
      "display_name": "John Seller"
    },
    "order": {
      "id": "69cc515bcf0fca3e239f7811",
      "amount": 1550
    },
    "reason": "Request feedback on transaction",
    "responses": [
      {
        "respondent_id": "user-referee1",
        "rating": "positive",
        "comment": "Great seller!",
        "submitted_at": "2026-04-09T08:00:00Z"
      }
    ],
    "created_at": "2026-04-08T10:10:00Z",
    "expires_at": "2026-04-22T10:10:00Z"
  }
}
```

**Database Models**: ReferenceCheck, Vouch

---

### 4.4 POST /reference-checks/:id/respond

**Purpose**: Respond to a reference check request  
**HTTP Method**: POST  
**Auth**: Required  
**Path Parameters**: `id` (reference check ID)

**Request Body**:

```json
{
  "response": "positive",
  "message": "Great experience working with them"
}
```

**Response** (200 OK):

```json
{
  "data": {
    "check_id": "69d4dd12eb790d48e9a686cd",
    "responded_at": "2026-04-09T08:00:00Z",
    "response": "positive",
    "message": "Great experience working with them",
    "status": "responded"
  }
}
```

**Valid Responses**: "positive", "neutral", "negative"  
**Database Models**: ReferenceCheck

---

### 4.5 DELETE /reference-checks/:id

**Purpose**: Delete/withdraw a reference check request  
**HTTP Method**: DELETE  
**Auth**: Required  
**Path Parameters**: `id` (reference check ID)

**Response** (200 OK):

```json
{
  "data": {
    "check_id": "69d4dd12eb790d48e9a686cd",
    "status": "deleted",
    "deleted_at": "2026-04-08T10:15:00Z"
  }
}
```

**Authorization**: Only requester can delete

---

### 4.6 POST /reference-checks/:id/vouch

**Purpose**: Vouch for someone's reference check  
**HTTP Method**: POST  
**Auth**: Required (Rate limited)  
**Path Parameters**: `id` (reference check ID)

**Request Body**:

```json
{
  "confidence": "high",
  "comment": "I've worked with them multiple times"
}
```

**Response** (201 Created):

```json
{
  "data": {
    "vouch_id": "69d45234eb790d48e9a669f0",
    "check_id": "69d4dd12eb790d48e9a686cd",
    "voucher_id": "user-vouch",
    "confidence": "high",
    "comment": "I've worked with them multiple times",
    "created_at": "2026-04-08T10:20:00Z"
  }
}
```

**Rules**:

- Must have mutual connection with target
- Rate limited: 5 vouches per day
- Cannot vouch for yourself
- Cannot vouch twice on same check

**Database Models**: Vouch

---

### 4.7 GET /reference-checks/:id/vouches

**Purpose**: Get all vouches for a reference check  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (reference check ID)

**Response** (200 OK):

```json
{
  "data": {
    "check_id": "69d4dd12eb790d48e9a686cd",
    "vouches": [
      {
        "id": "69d45234eb790d48e9a669f0",
        "voucher": {
          "id": "user-vouch",
          "display_name": "Alex Referee",
          "connection_depth": 2
        },
        "confidence": "high",
        "comment": "I've worked with them multiple times",
        "created_at": "2026-04-08T10:20:00Z"
      }
    ],
    "total_vouches": 1
  }
}
```

---

### 4.8 GET /reference-checks/:id/summary

**Purpose**: Get summary of reference check responses  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (reference check ID)

**Response** (200 OK):

```json
{
  "data": {
    "check_id": "69d4dd12eb790d48e9a686cd",
    "target_id": "user-seller",
    "total_responses": 3,
    "positive_count": 2,
    "neutral_count": 1,
    "negative_count": 0,
    "average_rating": 4.7,
    "summary_text": "Mostly positive feedback from references",
    "recommendation": "Safe to proceed"
  }
}
```

---

### 4.9 POST /reference-checks/:id/feedback

**Purpose**: Submit feedback on a reference check  
**HTTP Method**: POST  
**Auth**: Required  
**Path Parameters**: `id` (reference check ID)

**Request Body**:

```json
{
  "rating": 5,
  "comment": "Reference process was helpful"
}
```

**Response** (201 Created):

```json
{
  "data": {
    "check_id": "69d4dd12eb790d48e9a686cd",
    "feedback_id": "69d45314eb790d48e9a66a00",
    "rating": 5,
    "comment": "Reference process was helpful",
    "submitted_at": "2026-04-08T10:25:00Z"
  }
}
```

---

### 4.10 GET /reference-checks/:id/feedback

**Purpose**: Get feedback submitted on reference check  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (reference check ID)

**Response** (200 OK):

```json
{
  "data": [
    {
      "feedback_id": "69d45314eb790d48e9a66a00",
      "submitted_by": "user-buyer",
      "rating": 5,
      "comment": "Reference process was helpful",
      "submitted_at": "2026-04-08T10:25:00Z"
    }
  ]
}
```

---

### 4.11 POST /reference-checks/:id/trust-safety/appeal

**Purpose**: Appeal a reference check suspension  
**HTTP Method**: POST  
**Auth**: Required  
**Path Parameters**: `id` (reference check ID)

**Request Body**:

```json
{
  "reason": "Inappropriate report",
  "message": "This reference check was filed in error"
}
```

**Response** (201 Created):

```json
{
  "data": {
    "appeal_id": "69d45414eb790d48e9a66a10",
    "check_id": "69d4dd12eb790d48e9a686cd",
    "status": "under_review",
    "created_at": "2026-04-08T10:30:00Z"
  }
}
```

**Database Models**: Appeal

---

### 4.12 GET /reference-checks/:id/context

**Purpose**: Get context/metadata for reference check  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (reference check ID)

**Response** (200 OK):

```json
{
  "data": {
    "check_id": "69d4dd12eb790d48e9a686cd",
    "created_at": "2026-04-08T10:10:00Z",
    "expires_at": "2026-04-22T10:10:00Z",
    "target_history": {
      "total_transactions": 45,
      "completed_successfully": 44,
      "cancelled": 1,
      "member_since": "2025-06-15"
    }
  }
}
```

---

## 5. USERS/PROFILE APIS (8 Endpoints)

### 5.1 GET /user

**Purpose**: Get current authenticated user profile  
**HTTP Method**: GET  
**Auth**: Required

**Response** (200 OK):

```json
{
  "data": {
    "id": "user-buyer",
    "external_id": "user_36IdtjemE0ACSooz2q",
    "display_name": "Jane Buyer",
    "email": "jane@example.com",
    "avatar": "https://...",
    "bio": "Technology enthusiast",
    "created_at": "2025-06-15T08:00:00Z",
    "email_verified": true,
    "phone_verified": false,
    "identity_verified": true,
    "seller_rating": 4.8,
    "buyer_rating": 4.6,
    "transaction_count": 18
  }
}
```

**Database Models**: User

---

### 5.2 GET /user/profile

**Purpose**: Get current user profile (alias for GET /user)  
**HTTP Method**: GET  
**Auth**: Required

**Response** (200 OK): Same as GET /user

---

### 5.3 GET /users/:id

**Purpose**: Get public user profile  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (MongoDB ObjectId or external ID)

**Request Example**:

```
GET /api/v1/networks/users/user-seller
```

**Response** (200 OK):

```json
{
  "data": {
    "id": "user-seller",
    "display_name": "John Seller",
    "avatar": "https://...",
    "bio": "Professional seller",
    "created_at": "2025-05-20T08:00:00Z",
    "seller_rating": 4.9,
    "buyer_rating": 4.7,
    "transaction_count": 82,
    "verified_identity": true,
    "verified_email": true,
    "member_since": "2025-05-20",
    "response_time": "< 1 hour"
  }
}
```

---

### 5.4 GET /users/:id/profile

**Purpose**: Explicit profile endpoint  
**HTTP Method**: GET  
**Auth**: Required

**Response** (200 OK): Same as GET /users/:id

---

### 5.5 GET /users/:id/common-groups

**Purpose**: Get groups in common with another user  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (user ID)

**Response** (200 OK):

```json
{
  "data": {
    "user_id": "user-seller",
    "common_groups": [
      {
        "id": "69d44c4ceb790d48e9a66780",
        "name": "Premium Sellers",
        "members_count": 150
      },
      {
        "id": "69d44c4ceb790d48e9a66781",
        "name": "Trusted Network",
        "members_count": 320
      }
    ],
    "total_common": 2
  }
}
```

---

### 5.6 GET /user/connections/incoming

**Purpose**: Get user's incoming connection requests  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**:

```
limit?: number (default: 20)
offset?: number (default: 0)
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "conn-request-123",
      "from_user": {
        "id": "user-123",
        "display_name": "Alex Friend",
        "avatar": "https://..."
      },
      "relationship": "professional",
      "message": "Want to connect",
      "created_at": "2026-04-07T14:00:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "offset": 0
  }
}
```

---

### 5.7 POST /users/:id/connections

**Purpose**: Create connection request to another user  
**HTTP Method**: POST  
**Auth**: Required  
**Path Parameters**: `id` (user ID to connect with)

**Request Body**:

```json
{
  "relationship": "friend",
  "message": "Let's stay connected!"
}
```

**Response** (201 Created):

```json
{
  "data": {
    "id": "conn-request-new",
    "from_user_id": "user-buyer",
    "to_user_id": "user-seller",
    "relationship": "friend",
    "message": "Let's stay connected!",
    "status": "pending",
    "created_at": "2026-04-08T10:35:00Z"
  }
}
```

**Database Models**: Connection

---

### 5.8 DELETE /users/:id/connections

**Purpose**: Remove/decline connection  
**HTTP Method**: DELETE  
**Auth**: Required  
**Path Parameters**: `id` (user ID)

**Response** (200 OK):

```json
{
  "data": {
    "user_id": "user-seller",
    "status": "disconnected",
    "disconnected_at": "2026-04-08T10:45:00Z"
  }
}
```

---

## 6. CONVERSATION APIS (8 Endpoints)

### 6.1 GET /conversations

**Purpose**: List all conversations  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**:

```
limit?: number (default: 20, max: 100)
offset?: number (default: 0)
filter?: "all" | "active" | "archived"
sort?: "recent" | "unread"
```

**Request Example**:

```
GET /api/v1/networks/conversations?filter=active&sort=recent&limit=20
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "conv-123",
      "participants": [
        {
          "id": "user-buyer",
          "display_name": "Jane"
        },
        {
          "id": "user-seller",
          "display_name": "John"
        }
      ],
      "type": "direct",
      "last_message": "Sounds good!",
      "last_message_at": "2026-04-08T15:30:00Z",
      "unread_count": 2,
      "created_at": "2026-03-20T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 20,
    "offset": 0
  }
}
```

**Database Models**: ChatMessage (GetStream)  
**GetStream Integration**: Queries GetStream channels

---

### 6.2 GET /conversations/search

**Purpose**: Search conversations  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**:

```
q: string (search term)
type?: "message" | "participant"
limit?: number (default: 20)
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "conv-123",
      "participant_name": "John Seller",
      "last_message": "Sounds good!",
      "matched_in": "message_content"
    }
  ]
}
```

---

### 6.3 GET /conversations/:id

**Purpose**: Get full conversation context and history  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (conversation ID)  
**Query Parameters**:

```
limit?: number (default: 50, messages to fetch)
offset?: number (default: 0)
```

**Response** (200 OK):

```json
{
  "data": {
    "id": "conv-123",
    "participants": [
      {
        "id": "user-buyer",
        "display_name": "Jane Buyer",
        "avatar": "https://..."
      },
      {
        "id": "user-seller",
        "display_name": "John Seller"
      }
    ],
    "type": "direct",
    "messages": [
      {
        "id": "msg-1",
        "sender_id": "user-buyer",
        "content": "Is this still available?",
        "created_at": "2026-03-20T10:00:00Z"
      },
      {
        "id": "msg-2",
        "sender_id": "user-seller",
        "content": "Yes, interested?",
        "created_at": "2026-03-20T10:05:00Z"
      }
    ],
    "created_at": "2026-03-20T10:00:00Z",
    "last_message_at": "2026-04-08T15:30:00Z"
  }
}
```

---

### 6.4 GET /conversations/:id/media

**Purpose**: Get all media shared in conversation  
**HTTP Method**: GET  
**Auth**: Required  
**Path Parameters**: `id` (conversation ID)  
**Query Parameters**:

```
type?: "media" | "files" | "links"
limit?: number (default: 20)
offset?: number (default: 0)
```

**Response** (200 OK):

```json
{
  "data": {
    "conversation_id": "conv-123",
    "media": [
      {
        "id": "media-1",
        "type": "image",
        "url": "https://cloud.../image.jpg",
        "shared_by": "user-buyer",
        "shared_at": "2026-04-08T14:00:00Z"
      }
    ],
    "total": 3
  }
}
```

---

### 6.5 GET /conversations/:id/shared/media

**Purpose**: Get shared media in conversation  
**HTTP Method**: GET  
**Auth**: Required

**Response** (200 OK): Same as GET /conversations/:id/media with type=media

---

### 6.6 GET /conversations/:id/shared/files

**Purpose**: Get shared files in conversation  
**HTTP Method**: GET  
**Auth**: Required

**Response** (200 OK): Same as GET /conversations/:id/media with type=files

---

### 6.7 GET /conversations/:id/shared/links

**Purpose**: Get shared links in conversation  
**HTTP Method**: GET  
**Auth**: Required

**Response** (200 OK): Same as GET /conversations/:id/media with type=links

---

### 6.8 POST /messages/send

**Purpose**: Send message in conversation  
**HTTP Method**: POST  
**Auth**: Required

**Request Body**:

```json
{
  "recipient_id": "user-seller",
  "content": "Is this item still available?",
  "type": "text"
}
```

**Response** (201 Created):

```json
{
  "data": {
    "id": "msg-new-1",
    "conversation_id": "conv-123",
    "sender_id": "user-buyer",
    "content": "Is this item still available?",
    "type": "text",
    "created_at": "2026-04-08T15:35:00Z",
    "status": "sent"
  }
}
```

**Database Models**: ChatMessage (GetStream)  
**GetStream Integration**: Stores message in GetStream channels

---

## Additional Message Endpoint Details

### GET /messages/chats

**Purpose**: List all message conversations (compatibility alias)  
**HTTP Method**: GET  
**Auth**: Required

**Response**: Same as GET /conversations

---

### GET /messages/chats/search

**Purpose**: Search message conversations  
**HTTP Method**: GET  
**Auth**: Required  
**Query Parameters**: `q` (search term)

**Response**: Same as GET /conversations/search

---

### GET /messages/channel/:channelId/history

**Purpose**: Get message history for a channel  
**HTTP Method**: GET  
**Auth**: Required

**Response** (200 OK): Array of messages with timestamps

---

### PUT /messages/:id

**Purpose**: Edit a message  
**HTTP Method**: PUT  
**Auth**: Required  
**Path Parameters**: `id` (message ID)

**Request Body**:

```json
{
  "content": "Updated message content"
}
```

**Response** (200 OK):

```json
{
  "data": {
    "id": "msg-1",
    "content": "Updated message content",
    "edited_at": "2026-04-08T15:40:00Z",
    "status": "edited"
  }
}
```

---

### DELETE /messages/:id

**Purpose**: Delete a message  
**HTTP Method**: DELETE  
**Auth**: Required  
**Path Parameters**: `id` (message ID)

**Response** (200 OK):

```json
{
  "data": {
    "id": "msg-1",
    "status": "deleted",
    "deleted_at": "2026-04-08T15:45:00Z"
  }
}
```

---

### POST /messages/:id/read

**Purpose**: Mark message as read  
**HTTP Method**: POST  
**Auth**: Required  
**Path Parameters**: `id` (message ID)

**Response** (200 OK):

```json
{
  "data": {
    "message_id": "msg-1",
    "read_at": "2026-04-08T15:46:00Z"
  }
}
```

---

### POST /messages/:id/react

**Purpose**: Add emoji reaction to message  
**HTTP Method**: POST  
**Auth**: Required  
**Path Parameters**: `id` (message ID)

**Request Body**:

```json
{
  "reaction": "👍"
}
```

**Response** (200 OK):

```json
{
  "data": {
    "message_id": "msg-1",
    "reactions": [
      {
        "emoji": "👍",
        "users": ["user-buyer", "user-seller"],
        "count": 2
      }
    ]
  }
}
```

---

## Summary

| Category                  | Count               | Endpoints                                                                                               |
| ------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| Social APIs               | 23                  | Status, Inbox, Search, Discover, Groups (CRUD), Members, Shared Content, Invites, Chat Profile          |
| Offer APIs                | 5                   | List, Get, Terms History, Counter, Accept                                                               |
| Order APIs                | 6                   | List, Get, Completion Status, Complete, Reference Check Initiate, Audit Trail                           |
| Reference Check APIs      | 12                  | Create, List, Get, Respond, Delete, Vouch, Get Vouches, Summary, Feedback, Trust/Safety Appeal, Context |
| Users/Profile APIs        | 8                   | Current User, Profile, Public Profile, Common Groups, Connections In/Out                                |
| Conversation/Message APIs | 8                   | List, Search, Get One, Shared Media/Files/Links, Send, Edit, Delete, React                              |
| Connection APIs           | (included in Users) | Incoming, Outgoing, Accept, Decline                                                                     |

**Total: 51 documented endpoints**

---

## Database Models Referenced

- **User**: Core user profile model
- **Order**: E-commerce orders
- **Offer**: Negotiation objects
- **OfferRevision**: Historical offer changes
- **ReferenceCheck**: Trust/verification requests
- **Vouch**: Third-party endorsements
- **SocialGroup**: Group objects
- **SocialGroupMember**: Group membership
- **SocialInvite**: Invite tokens
- **NetworkListing**: Marketplace items
- **ChatMessage**: GetStream-backed messages
- **Connection**: User relationship tracking
- **AuditLog**: Action history

---

## GetStream Integration Points

1. **social/status**: Queries GetStream channels for unread counts
2. **social/inbox**: Loads unified inbox from GetStream channels
3. **messages/send**: Stores messages in GetStream
4. **conversations/\***: All conversation data backed by GetStream
5. **Notifications**: May trigger GetStream activity feeds

---

## Authentication & Authorization Patterns

- **All endpoints**: Require Bearer token (Clerk JWT)
- **Route-level checks**: Verify user context from JWT
- **Resource-level checks**: Verify relationship to resource (buyer/seller, group member, etc.)
- **Rate limiting**: Applied to sensitive operations (reference check creation, vouching)

---

## Testing Notes

- E2E tests use real production Clerk tokens
- Test IDs reference real MongoDB ObjectIds
- Test suite covers nominal and error paths
- 51 tests achieving ~69% pass rate (35/51 passing)
