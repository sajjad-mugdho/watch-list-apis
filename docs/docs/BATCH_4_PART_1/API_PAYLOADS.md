# Batch 4 Part 1: Social Hub API Payloads & Examples

**Date:** April 6, 2026  
**Purpose:** Detailed request/response examples for all Social Hub messaging endpoints  
**Reference:** See BATCH_4_PART_1_SOCIAL_HUB_REQUIREMENTS.md for full functional spec

---

## 1. Social Hub Status & Search

### 1.1 GET /networks/social-hub/status

**Purpose:** Dashboard initialization — fetch user messaging stats and presence

**Request:**
```http
GET /networks/social-hub/status
Authorization: Bearer {auth_token}
x-request-id: {uuid}
```

**Response (200 OK):**
```json
{
  "data": {
    "user_id": "507f1f77bcf86cd799439011",
    "display_name": "John Doe",
    "avatar_url": "https://cdn.dialist.app/avatars/user_123_v2.jpg",
    "online_status": "online",
    "last_activity": "2026-04-06T12:34:56Z",
    "unread_messages": 42,
    "unread_group_chats": 3,
    "unread_personal_chats": 8,
    "active_chats": 15,
    "total_groups": 6,
    "presence": {
      "device": "mobile",
      "location": "Toronto, ON"
    }
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": {
    "code": "INVALID_AUTH",
    "message": "Bearer token is invalid or expired",
    "statusCode": 401
  },
  "requestId": "uuid"
}
```

---

### 1.2 GET /networks/messages/search

**Purpose:** Full-text search across messages, users, and groups

**Request:**
```http
GET /networks/messages/search?q=omega&type=all&limit=20&offset=0
Authorization: Bearer {auth_token}
x-request-id: {uuid}
```

**Response (200 OK) — Multi-type results:**
```json
{
  "data": {
    "query": "omega",
    "applied_filters": {
      "type": "all",
      "include_blocked": false
    },
    "results": [
      {
        "type": "message",
        "score": 0.95,
        "message": {
          "message_id": "507f1f77bcf86cd799439001",
          "chat_id": "507f1f77bcf86cd799439005",
          "sender": {
            "user_id": "507f1f77bcf86cd799439011",
            "display_name": "Sarah Kim",
            "avatar_url": "https://...",
            "online_status": "online"
          },
          "content": "Has anyone seen the new release from Omega today? It's stunning.",
          "message_tag": "inquiry",
          "timestamp": "2026-04-06T10:23:00Z",
          "unread_count": 0,
          "is_pinned": false,
          "reactions": [
            {
              "emoji": "👍",
              "count": 2,
              "current_user_reacted": false
            }
          ]
        }
      },
      {
        "type": "user",
        "score": 0.87,
        "user": {
          "user_id": "507f1f77bcf86cd799439022",
          "display_name": "Omega Collector",
          "avatar_url": "https://...",
          "location": "Toronto, ON",
          "follower_count": 1200,
          "online_status": "offline",
          "is_friend": true,
          "follow_status": "following"
        }
      },
      {
        "type": "group",
        "score": 0.82,
        "group": {
          "group_id": "507f1f77bcf86cd799439033",
          "name": "Omega Watch Enthusiasts",
          "avatar_url": "https://...",
          "member_count": 245,
          "unread_count": 5,
          "join_status": "joined"
        }
      }
    ],
    "total": 3,
    "hasMore": false,
    "searchDuration": 0.145
  },
  "requestId": "uuid"
}
```

---

## 2. Messaging Endpoints

### 2.1 GET /networks/messages/chats

**Purpose:** Fetch all user conversations (1:1 + group, sorted by activity)

**Request:**
```http
GET /networks/messages/chats?include_unread=true&include_preview=true&limit=50&offset=0&sort_by=last_activity
Authorization: Bearer {auth_token}
x-request-id: {uuid}
```

**Response (200 OK):**
```json
{
  "data": {
    "chats": [
      {
        "chat_id": "507f1f77bcf86cd799439101",
        "type": "group",
        "group": {
          "group_id": "507f1f77bcf86cd799439201",
          "name": "Watch Collectors Club",
          "avatar_url": "https://...",
          "member_count": 12,
          "online_member_count": 4
        },
        "last_message": {
          "message_id": "507f1f77bcf86cd799439301",
          "content": "New event coming up next week...",
          "sender": "Sarah Kim",
          "sender_id": "507f1f77bcf86cd799439011",
          "timestamp": "2026-04-04T14:30:00Z",
          "is_read": false
        },
        "unread_count": 39,
        "is_muted": false,
        "is_pinned": true,
        "created_at": "2025-11-10T08:00:00Z",
        "updated_at": "2026-04-04T14:30:00Z"
      },
      {
        "chat_id": "507f1f77bcf86cd799439102",
        "type": "personal",
        "participant": {
          "user_id": "507f1f77bcf86cd799439012",
          "display_name": "Sandra Dorsett",
          "avatar_url": "https://...",
          "online_status": "offline"
        },
        "last_message": {
          "message_id": "507f1f77bcf86cd799439302",
          "content": "See offer attached",
          "sender": "Sandra Dorsett",
          "timestamp": "2026-04-06T15:00:00Z",
          "is_read": true
        },
        "unread_count": 0,
        "is_muted": false,
        "is_pinned": false,
        "created_at": "2026-03-15T10:00:00Z",
        "updated_at": "2026-04-06T15:00:00Z"
      },
      {
        "chat_id": "507f1f77bcf86cd799439103",
        "type": "group",
        "group": {
          "group_id": "507f1f77bcf86cd799439202",
          "name": "Rolex Collectors Group",
          "avatar_url": "https://...",
          "member_count": 8,
          "online_member_count": 2
        },
        "last_message": {
          "message_id": "507f1f77bcf86cd799439303",
          "content": "Anyone seen the new release?",
          "sender": "David Chen",
          "timestamp": "2026-04-05T18:45:00Z",
          "is_read": false
        },
        "unread_count": 5,
        "is_muted": false,
        "is_pinned": false,
        "created_at": "2025-09-20T12:00:00Z",
        "updated_at": "2026-04-05T18:45:00Z"
      }
    ],
    "total": 50,
    "total_unread": 44,
    "_metadata": {
      "hasMore": true,
      "nextOffset": 50,
      "sortedBy": "last_activity"
    }
  },
  "requestId": "uuid"
}
```

---

### 2.2 POST /networks/messages/:chatId/send

**Purpose:** Send a message to a chat (1:1 or group)

**Request:**
```http
POST /networks/messages/chat_001/send
Authorization: Bearer {auth_token}
Content-Type: application/json
x-request-id: {uuid}

{
  "content": "I'm actually heading there tomorrow if anyone wants me to check availability.",
  "attachments": [
    {
      "type": "image",
      "url": "https://cdn.dialist.app/files/msg_attach_123.jpg",
      "name": "watch_photo.jpg",
      "size": 245000
    }
  ],
  "mentions": [
    {
      "user_id": "507f1f77bcf86cd799439022",
      "display_name": "David Chen",
      "position": [24, 35]
    }
  ],
  "reply_to": null,
  "thread_id": null,
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440001"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "message": {
      "message_id": "507f1f77bcf86cd799439304",
      "chat_id": "507f1f77bcf86cd799439101",
      "sender": {
        "user_id": "507f1f77bcf86cd799439000",
        "display_name": "Current User",
        "avatar_url": "https://..."
      },
      "content": "I'm actually heading there tomorrow if anyone wants me to check availability.",
      "type": "text",
      "timestamp": "2026-04-06T10:25:00Z",
      "edited_at": null,
      "reactions": [],
      "read_by": [],
      "attachments": [
        {
          "id": "507f1f77bcf86cd799439400",
          "type": "image",
          "url": "https://cdn.dialist.app/files/msg_attach_123.jpg",
          "name": "watch_photo.jpg",
          "size": 245000,
          "thumbnail_url": "https://cdn.dialist.app/files/msg_attach_123_thumb.jpg"
        }
      ],
      "mentions": [
        {
          "user_id": "507f1f77bcf86cd799439022",
          "display_name": "David Chen"
        }
      ]
    }
  },
  "requestId": "uuid"
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Message content cannot be empty",
    "statusCode": 400,
    "details": {
      "field": "content",
      "constraint": "min_length",
      "min": 1,
      "max": 5000
    }
  },
  "requestId": "uuid"
}
```

---

### 2.3 GET /networks/messages/:chatId/history

**Purpose:** Fetch paginated message history for a chat

**Request:**
```http
GET /networks/messages/chat_001/history?limit=30&before=507f1f77bcf86cd799439304&after=null
Authorization: Bearer {auth_token}
x-request-id: {uuid}
```

**Response (200 OK):**
```json
{
  "data": {
    "messages": [
      {
        "message_id": "507f1f77bcf86cd799439301",
        "chat_id": "507f1f77bcf86cd799439101",
        "sender": {
          "user_id": "507f1f77bcf86cd799439011",
          "display_name": "Sarah Kim",
          "avatar_url": "https://...",
          "online_status": "online"
        },
        "content": "Has anyone seen the new release from Omega today? It's stunning.",
        "type": "text",
        "timestamp": "2026-04-06T10:23:00Z",
        "edited_at": null,
        "reactions": [
          {
            "emoji": "👍",
            "count": 2,
            "reactors": ["507f1f77bcf86cd799439000", "507f1f77bcf86cd799439022"],
            "current_user_reacted": false
          }
        ],
        "read_by": [
          "507f1f77bcf86cd799439000",
          "507f1f77bcf86cd799439022"
        ],
        "attachments": [],
        "mentions": [],
        "reply_to": null,
        "thread_message_count": 2
      },
      {
        "message_id": "507f1f77bcf86cd799439302",
        "chat_id": "507f1f77bcf86cd799439101",
        "sender": {
          "user_id": "507f1f77bcf86cd799439022",
          "display_name": "David Chen",
          "avatar_url": "https://...",
          "online_status": "offline"
        },
        "content": "I did! The green dial is incredible. I might have to visit the boutique this weekend.",
        "type": "text",
        "timestamp": "2026-04-06T10:24:00Z",
        "edited_at": null,
        "reactions": [],
        "read_by": [
          "507f1f77bcf86cd799439000",
          "507f1f77bcf86cd799439011"
        ],
        "attachments": [],
        "mentions": [],
        "reply_to": null
      },
      {
        "message_id": "507f1f77bcf86cd799439303",
        "chat_id": "507f1f77bcf86cd799439101",
        "sender": {
          "user_id": "507f1f77bcf86cd799439000",
          "display_name": "Current User",
          "avatar_url": "https://..."
        },
        "content": "I'm actually heading there tomorrow if anyone wants me to check availability.",
        "type": "text",
        "timestamp": "2026-04-06T10:25:00Z",
        "edited_at": null,
        "reactions": [],
        "read_by": [],
        "attachments": []
      }
    ],
    "has_more": true,
    "oldest_message_id": "507f1f77bcf86cd799439200"
  },
  "requestId": "uuid"
}
```

---

### 2.4 PATCH /networks/messages/:messageId/edit

**Purpose:** Edit own message (read receipts reset)

**Request:**
```http
PATCH /networks/messages/msg_303/edit
Authorization: Bearer {auth_token}
Content-Type: application/json
x-request-id: {uuid}

{
  "content": "I'm actually heading there tomorrow if anyone wants me to check availability. Let me know!",
  "attachments": []
}
```

**Response (200 OK):**
```json
{
  "data": {
    "message": {
      "message_id": "507f1f77bcf86cd799439303",
      "content": "I'm actually heading there tomorrow if anyone wants me to check availability. Let me know!",
      "edited_at": "2026-04-06T10:26:00Z",
      "edit_history": [
        {
          "content": "I'm actually heading there tomorrow if anyone wants me to check availability.",
          "edited_at": "2026-04-06T10:25:00Z"
        }
      ],
      "read_by": []
    }
  },
  "requestId": "uuid"
}
```

---

### 2.5 DELETE /networks/messages/:messageId

**Purpose:** Delete message (soft delete - shows as "deleted")

**Request:**
```http
DELETE /networks/messages/msg_303?soft_delete=true
Authorization: Bearer {auth_token}
x-request-id: {uuid}
```

**Response (200 OK):**
```json
{
  "data": {
    "message_id": "507f1f77bcf86cd799439303",
    "deleted": true,
    "deleted_at": "2026-04-06T10:27:00Z",
    "deleted_for": "all" // or "self"
  },
  "requestId": "uuid"
}
```

---

### 2.6 POST /networks/messages/:messageId/react

**Purpose:** Add/remove emoji reaction to message

**Request (Add):**
```http
POST /networks/messages/msg_301/react
Authorization: Bearer {auth_token}
Content-Type: application/json
x-request-id: {uuid}

{
  "emoji": "❤️",
  "action": "add"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "message_id": "507f1f77bcf86cd799439301",
    "reactions": [
      {
        "emoji": "👍",
        "count": 2,
        "reactors": ["user_022", "user_033"],
        "current_user_reacted": false
      },
      {
        "emoji": "❤️",
        "count": 1,
        "reactors": ["user_000"],
        "current_user_reacted": true
      }
    ]
  },
  "requestId": "uuid"
}
```

**Request (Remove):**
```http
POST /networks/messages/msg_301/react
Authorization: Bearer {auth_token}
Content-Type: application/json
x-request-id: {uuid}

{
  "emoji": "❤️",
  "action": "remove"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "message_id": "507f1f77bcf86cd799439301",
    "reactions": [
      {
        "emoji": "👍",
        "count": 2,
        "reactors": ["user_022", "user_033"],
        "current_user_reacted": false
      }
    ]
  },
  "requestId": "uuid"
}
```

---

## 3. Friend Request Endpoints

### 3.1 GET /networks/friend-requests

**Purpose:** Fetch pending friend requests

**Request:**
```http
GET /networks/friend-requests?status=pending&limit=10&offset=0&include_mutual_count=true
Authorization: Bearer {auth_token}
x-request-id: {uuid}
```

**Response (200 OK):**
```json
{
  "data": {
    "requests": [
      {
        "request_id": "507f1f77bcf86cd799439501",
        "from_user": {
          "user_id": "507f1f77bcf86cd799439011",
          "display_name": "David Lee",
          "avatar_url": "https://...",
          "follower_count": 8200,
          "mutual_connections": 12,
          "online_status": "online"
        },
        "status": "pending",
        "created_at": "2026-04-05T10:00:00Z",
        "expires_at": "2026-05-05T10:00:00Z"
      }
    ],
    "total": 4
  },
  "requestId": "uuid"
}
```

---

### 3.2 POST /networks/friend-requests/:requestId/accept

**Purpose:** Accept incoming friend request

**Request:**
```http
POST /networks/friend-requests/req_001/accept
Authorization: Bearer {auth_token}
Content-Type: application/json
x-request-id: {uuid}

{}
```

**Response (200 OK):**
```json
{
  "data": {
    "request_id": "507f1f77bcf86cd799439501",
    "status": "accepted",
    "new_friend": {
      "user_id": "507f1f77bcf86cd799439011",
      "display_name": "David Lee",
      "avatar_url": "https://...",
      "connection_established_at": "2026-04-06T12:00:00Z"
    }
  },
  "requestId": "uuid"
}
```

---

### 3.3 POST /networks/friend-requests/:requestId/decline

**Purpose:** Decline incoming friend request

**Request:**
```http
POST /networks/friend-requests/req_001/decline
Authorization: Bearer {auth_token}
Content-Type: application/json
x-request-id: {uuid}

{
  "reason": "optional reason"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "request_id": "507f1f77bcf86cd799439501",
    "status": "declined",
    "declined_at": "2026-04-06T12:00:00Z"
  },
  "requestId": "uuid"
}
```

---

## 4. Group Request Endpoints

### 4.1 GET /networks/group-requests

**Purpose:** Fetch pending group requests/invitations

**Request:**
```http
GET /networks/group-requests?status=pending&limit=10
Authorization: Bearer {auth_token}
x-request-id: {uuid}
```

**Response (200 OK):**
```json
{
  "data": {
    "requests": [
      {
        "request_id": "507f1f77bcf86cd799439601",
        "group": {
          "group_id": "507f1f77bcf86cd799439201",
          "name": "Watch Collectors Club",
          "avatar_url": "https://...",
          "member_count": 12,
          "follower_count": 245,
          "mutual_members": 7
        },
        "request_type": "invite",
        "invited_by": {
          "user_id": "507f1f77bcf86cd799439011",
          "display_name": "Sarah Kim"
        },
        "status": "pending",
        "created_at": "2026-04-05T15:00:00Z",
        "expires_at": "2026-05-05T15:00:00Z"
      }
    ],
    "total": 2
  },
  "requestId": "uuid"
}
```

---

### 4.2 POST /networks/group-requests/:requestId/accept

**Purpose:** Accept group invitation

**Request:**
```http
POST /networks/group-requests/grpreq_001/accept
Authorization: Bearer {auth_token}
Content-Type: application/json
x-request-id: {uuid}

{}
```

**Response (200 OK):**
```json
{
  "data": {
    "request_id": "507f1f77bcf86cd799439601",
    "status": "accepted",
    "group": {
      "group_id": "507f1f77bcf86cd799439201",
      "name": "Watch Collectors Club",
      "joined_at": "2026-04-06T12:00:00Z"
    }
  },
  "requestId": "uuid"
}
```

---

## 5. Discovery Endpoints

### 5.1 GET /networks/discovery/search

**Purpose:** Search for users and groups to discover

**Request:**
```http
GET /networks/discovery/search?q=pate&type=all&limit=20&offset=0&sort_by=relevance
Authorization: Bearer {auth_token}
x-request-id: {uuid}
```

**Response (200 OK):**
```json
{
  "data": {
    "results": [
      {
        "type": "user",
        "user_id": "507f1f77bcf86cd799439023",
        "display_name": "Sophia Patel",
        "avatar_url": "https://...",
        "bio": "Watch collector and photography enthusiast",
        "location": {
          "city": "Toronto",
          "province": "ON",
          "country": "CA"
        },
        "follower_count": 5400,
        "reputation_score": 4.8,
        "is_friend": false,
        "follow_status": "none",
        "verification_status": "verified"
      },
      {
        "type": "group",
        "group_id": "507f1f77bcf86cd799439202",
        "name": "Patek Collectors Toronto",
        "avatar_url": "https://...",
        "description": "Luxury watch enthusiasts in Toronto",
        "location": {
          "city": "Toronto",
          "province": "ON",
          "country": "CA"
        },
        "member_count": 145,
        "follower_count": 5400,
        "join_status": "none",
        "mutual_members": 3
      }
    ],
    "total": 2,
    "hasMore": false
  },
  "requestId": "uuid"
}
```

---

### 5.2 POST /networks/users/:userId/follow

**Purpose:** Send friend request to user

**Request:**
```http
POST /networks/users/user_023/follow
Authorization: Bearer {auth_token}
Content-Type: application/json
x-request-id: {uuid}

{
  "action": "follow"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "user_id": "507f1f77bcf86cd799439023",
    "follow_status": "requested",
    "friend_request": {
      "request_id": "507f1f77bcf86cd799439601",
      "status": "pending",
      "created_at": "2026-04-06T12:00:00Z"
    }
  },
  "requestId": "uuid"
}
```

---

## 6. User Profile & Context Endpoints

### 6.1 GET /networks/users/:userId/profile

**Purpose:** Fetch detailed user profile for chat context

**Request:**
```http
GET /networks/users/user_023/profile
Authorization: Bearer {auth_token}
x-request-id: {uuid}
```

**Response (200 OK):**
```json
{
  "data": {
    "user_id": "507f1f77bcf86cd799439023",
    "display_name": "Michael Lammens",
    "avatar_url": "https://...",
    "bio": "Watch collector since 2010. Vintage Rolex enthusiast.",
    "location": {
      "city": "Toronto",
      "province": "ON",
      "country": "CA"
    },
    "follower_count": 2500,
    "following_count": 1200,
    "member_since": "2021-01-15T00:00:00Z",
    "verification_status": "verified",
    "online_status": "online",
    "last_seen": "2026-04-06T12:34:00Z",
    "reputation_score": 4.8,
    "profile_completeness": 0.95,
    "badges": ["verified", "trusted_buyer", "trusted_seller"]
  },
  "requestId": "uuid"
}
```

---

### 6.2 GET /networks/users/:userId/transactions

**Purpose:** Fetch active offers/inquiries with specific user

**Request:**
```http
GET /networks/users/user_023/transactions?status=active&limit=10
Authorization: Bearer {auth_token}
x-request-id: {uuid}
```

**Response (200 OK):**
```json
{
  "data": {
    "active_offers": [
      {
        "offer_id": "507f1f77bcf86cd799439701",
        "item_name": "Rolex Submariner",
        "item_id": "507f1f77bcf86cd799439050",
        "price": 12000,
        "currency": "USD",
        "status": "accepted",
        "created_at": "2026-04-01T10:00:00Z",
        "expires_at": "2026-05-01T10:00:00Z"
      }
    ],
    "active_inquiries": [
      {
        "inquiry_id": "507f1f77bcf86cd799439702",
        "item_name": "Omega Seamaster",
        "item_id": "507f1f77bcf86cd799439051",
        "question": "Is it still available?",
        "status": "pending",
        "created_at": "2026-04-06T02:14:00Z"
      }
    ],
    "completed_transactions": 15,
    "total_active": 2
  },
  "requestId": "uuid"
}
```

---

### 6.3 GET /networks/chats/:chatId/media

**Purpose:** Fetch shared media in conversation

**Request:**
```http
GET /networks/chats/chat_001/media?limit=30&offset=0
Authorization: Bearer {auth_token}
x-request-id: {uuid}
```

**Response (200 OK):**
```json
{
  "data": {
    "media": [
      {
        "media_id": "507f1f77bcf86cd799439801",
        "type": "image",
        "url": "https://cdn.dialist.app/media/img_123.jpg",
        "thumbnail_url": "https://cdn.dialist.app/media/img_123_thumb.jpg",
        "source_message_id": "507f1f77bcf86cd799439234",
        "sent_by": {
          "user_id": "507f1f77bcf86cd799439023",
          "display_name": "Michael Lammens"
        },
        "timestamp": "2026-04-05T14:30:00Z",
        "size": 1024000
      }
    ],
    "total": 12,
    "hasMore": true
  },
  "requestId": "uuid"
}
```

---

### 6.4 POST /networks/users/:userId/block

**Purpose:** Block user from sending messages

**Request:**
```http
POST /networks/users/user_023/block
Authorization: Bearer {auth_token}
Content-Type: application/json
x-request-id: {uuid}

{
  "action": "block",
  "clear_history": true
}
```

**Response (200 OK):**
```json
{
  "data": {
    "user_id": "507f1f77bcf86cd799439023",
    "blocked": true,
    "chat_id": "507f1f77bcf86cd799439101",
    "history_cleared": true,
    "blocked_at": "2026-04-06T12:00:00Z",
    "unblock_available_at": "2026-04-13T12:00:00Z"
  },
  "requestId": "uuid"
}
```

---

### 6.5 POST /networks/users/:userId/report

**Purpose:** Report user for violations

**Request:**
```http
POST /networks/users/user_023/report
Authorization: Bearer {auth_token}
Content-Type: application/json
x-request-id: {uuid}

{
  "reason": "harassment",
  "description": "User sent inappropriate messages and refused to stop",
  "evidence": ["msg_001", "msg_002"],
  "attachments": []
}
```

**Response (201 Created):**
```json
{
  "data": {
    "report_id": "507f1f77bcf86cd799439901",
    "reported_user_id": "507f1f77bcf86cd799439023",
    "reason": "harassment",
    "status": "open",
    "created_at": "2026-04-06T12:00:00Z",
    "investigation_status": "queued"
  },
  "requestId": "uuid"
}
```

---

## 7. Chat Management Endpoints

### 7.1 PATCH /networks/messages/chats/:chatId/mute

**Purpose:** Mute/unmute conversation notifications

**Request:**
```http
PATCH /networks/messages/chats/chat_001/mute
Authorization: Bearer {auth_token}
Content-Type: application/json
x-request-id: {uuid}

{
  "mute": true,
  "mute_duration": "forever"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "chat_id": "507f1f77bcf86cd799439101",
    "is_muted": true,
    "mute_until": null,
    "mute_started_at": "2026-04-06T12:00:00Z"
  },
  "requestId": "uuid"
}
```

---

### 7.2 DELETE /networks/messages/chats/:chatId

**Purpose:** Archive or delete conversation

**Request:**
```http
DELETE /networks/messages/chats/chat_001?action=archive
Authorization: Bearer {auth_token}
x-request-id: {uuid}
```

**Response (200 OK):**
```json
{
  "data": {
    "chat_id": "507f1f77bcf86cd799439101",
    "action": "archived",
    "archived_at": "2026-04-06T12:00:00Z",
    "can_restore": true,
    "restore_until": "2026-05-06T12:00:00Z"
  },
  "requestId": "uuid"
}
```

---

## 8. Invite Management

### 8.1 POST /networks/invite-link/generate

**Purpose:** Generate shareable invite link

**Request:**
```http
POST /networks/invite-link/generate
Authorization: Bearer {auth_token}
Content-Type: application/json
x-request-id: {uuid}

{
  "expiration_days": 30,
  "max_usages": null
}
```

**Response (201 Created):**
```json
{
  "data": {
    "invite_link": "https://dialist.app/join/abc123xyz789",
    "short_code": "abc123xyz",
    "expires_at": "2026-05-06T12:00:00Z",
    "usage_count": 0,
    "max_usages": null,
    "created_by": "507f1f77bcf86cd799439000",
    "created_at": "2026-04-06T12:00:00Z"
  },
  "requestId": "uuid"
}
```

---

## 9. Error Response Formats

### Rate Limit (429)
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please retry after 60 seconds.",
    "statusCode": 429,
    "retryAfter": 60
  },
  "requestId": "uuid"
}
```

### Not Found (404)
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Chat not found",
    "statusCode": 404,
    "details": {
      "resource": "chat",
      "id": "chat_001"
    }
  },
  "requestId": "uuid"
}
```

### Permission Denied (403)
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to edit this message",
    "statusCode": 403,
    "details": {
      "reason": "message not authored by current user",
      "message_id": "msg_001",
      "author_id": "user_other"
    }
  },
  "requestId": "uuid"
}
```

---

**Document Version:** 1.0  
**Last Updated:** April 6, 2026
