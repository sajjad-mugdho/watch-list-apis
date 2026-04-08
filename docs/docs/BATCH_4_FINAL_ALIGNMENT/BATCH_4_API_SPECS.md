# Batch 4 API Specifications - Complete Reference

**Document Generated**: April 8, 2026  
**API Endpoints**: 49 (Parts 1, 2, 3 + Supporting)  
**Authentication**: Clerk JWT Bearer Token  
**Base URL**: `http://localhost:5050` (or configured endpoint)  
**Content Type**: `application/json`

---

## Table of Contents

1. [Part 1: Social Hub & Messaging (21 endpoints)](#part-1-social-hub--messaging)
2. [Part 2: Offers & Inquiries (6 endpoints)](#part-2-offers--inquiries)
3. [Part 3: Reference Checks & Orders (16 endpoints)](#part-3-reference-checks--orders)
4. [Supporting APIs: Users & Profiles (6 endpoints)](#supporting-apis-users--profiles)
5. [Authentication & Common Patterns](#authentication--common-patterns)
6. [Response Format & Status Codes](#response-format--status-codes)

---

## Part 1: Social Hub & Messaging

### 1.1 GET /social/status

Get current user's social status summary including unread counts and active conversations.

**Method**: `GET`  
**Authentication**: Required (Bearer JWT)  
**Rate Limit**: 100 req/min

**Request**:

```bash
curl -X GET http://localhost:5050/social/status \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": {
    "unread_messages": 5,
    "unread_group_invites": 2,
    "unread_reference_requests": 1,
    "active_conversations": 8,
    "total_groups": 12,
    "last_update": "2026-04-08T15:30:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Status retrieved successfully
- `401 Unauthorized` - Invalid or missing token
- `429 Too Many Requests` - Rate limit exceeded

---

### 1.2 GET /social/inbox

Retrieve user's social inbox with pending group invitations and notifications.

**Method**: `GET`  
**Authentication**: Required  
**Query Parameters**:

- `limit` (number, optional): Items per page (default: 20)
- `offset` (number, optional): Pagination offset (default: 0)

**Request**:

```bash
curl -X GET 'http://localhost:5050/social/inbox?limit=20&offset=0' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "inbox_123abc",
      "type": "group_invite",
      "group_id": "69d44c4ceb790d48e9a66780",
      "group_name": "Tech Entrepreneurs",
      "invited_by": "user_50abc123",
      "invited_at": "2026-04-08T14:00:00Z",
      "status": "pending"
    }
  ],
  "_metadata": {
    "total": 5,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Inbox retrieved
- `401 Unauthorized` - Authentication failed
- `404 Not Found` - User inbox not found

---

### 1.3 POST /social/groups

Create a new social group.

**Method**: `POST`  
**Authentication**: Required  
**Content-Type**: `application/json`

**Request Payload**:

```json
{
  "name": "Tech Entrepreneurs Network",
  "description": "A community for tech entrepreneurs to network and share ideas",
  "is_private": false,
  "tags": ["technology", "entrepreneurship", "networking"]
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/social/groups \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tech Entrepreneurs Network",
    "description": "A community for tech entrepreneurs",
    "is_private": false
  }'
```

**Response (201 - Created)**:

```json
{
  "data": {
    "id": "69d44c4ceb790d48e9a66780",
    "name": "Tech Entrepreneurs Network",
    "description": "A community for tech entrepreneurs",
    "created_by": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
    "created_at": "2026-04-08T15:30:00Z",
    "member_count": 1,
    "is_private": false,
    "tags": ["technology", "entrepreneurship", "networking"]
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `201 Created` - Group created successfully
- `400 Bad Request` - Invalid payload (missing name, etc.)
- `401 Unauthorized` - Authentication failed
- `429 Too Many Requests` - Rate limit (20 groups/hour)

---

### 1.4 GET /social/groups

List all groups the user is a member of.

**Method**: `GET`  
**Authentication**: Required  
**Query Parameters**:

- `limit` (number): Items per page (default: 20)
- `offset` (number): Pagination offset (default: 0)
- `sort` (string): Sort by `created_at` or `member_count` (default: `created_at`)

**Request**:

```bash
curl -X GET 'http://localhost:5050/social/groups?limit=20&offset=0' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "69d44c4ceb790d48e9a66780",
      "name": "Tech Entrepreneurs Network",
      "description": "A community for tech entrepreneurs",
      "created_by": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "created_at": "2026-04-08T10:00:00Z",
      "member_count": 42,
      "is_private": false,
      "tags": ["technology", "entrepreneurship"]
    }
  ],
  "_metadata": {
    "total": 12,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Groups retrieved
- `401 Unauthorized` - Invalid token

---

### 1.5 GET /social/groups/:id

Get detailed information about a specific group.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): MongoDB ObjectId of the group

**Request**:

```bash
curl -X GET 'http://localhost:5050/social/groups/69d44c4ceb790d48e9a66780' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": {
    "id": "69d44c4ceb790d48e9a66780",
    "name": "Tech Entrepreneurs Network",
    "description": "A community for tech entrepreneurs",
    "created_by": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
    "created_at": "2026-04-08T10:00:00Z",
    "updated_at": "2026-04-08T15:00:00Z",
    "member_count": 42,
    "is_private": false,
    "tags": ["technology", "entrepreneurship"],
    "permissions": {
      "can_post": true,
      "can_invite": true,
      "can_remove_members": false,
      "can_delete": false
    }
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Group details retrieved
- `401 Unauthorized` - Invalid token
- `404 Not Found` - Group not found
- `403 Forbidden` - User not a member

---

### 1.6 POST /social/groups/:id/join

Join an existing social group.

**Method**: `POST`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Group MongoDB ObjectId

**Request Payload** (optional):

```json
{
  "join_reason": "Interested in tech entrepreneurship"
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/social/groups/69d44c4ceb790d48e9a66780/join \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"join_reason": "Interested in tech entrepreneurship"}'
```

**Response (200 - Success)**:

```json
{
  "data": {
    "joined": true,
    "group_id": "69d44c4ceb790d48e9a66780",
    "user_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "joined_at": "2026-04-08T15:30:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Successfully joined
- `400 Bad Request` - Already a member
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Group membership restricted
- `404 Not Found` - Group doesn't exist

---

### 1.7 DELETE /social/groups/:id/leave

Leave a social group.

**Method**: `DELETE`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Group MongoDB ObjectId

**Request**:

```bash
curl -X DELETE http://localhost:5050/social/groups/69d44c4ceb790d48e9a66780/leave \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": {
    "left": true,
    "group_id": "69d44c4ceb790d48e9a66780",
    "user_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "left_at": "2026-04-08T15:30:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Successfully left group
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Cannot leave (creator can't leave empty group)
- `404 Not Found` - Group doesn't exist

---

### 1.8 GET /social/groups/:id/members

Get list of group members.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Group MongoDB ObjectId  
  **Query Parameters**:
- `limit` (number): Items per page (default: 50)
- `offset` (number): Pagination offset (default: 0)

**Request**:

```bash
curl -X GET 'http://localhost:5050/social/groups/69d44c4ceb790d48e9a66780/members?limit=50' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "user_id": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "name": "John Entrepreneur",
      "joined_at": "2026-04-08T10:00:00Z",
      "role": "creator"
    },
    {
      "user_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
      "name": "Jane Innovator",
      "joined_at": "2026-04-08T12:00:00Z",
      "role": "member"
    }
  ],
  "_metadata": {
    "total": 42,
    "limit": 50,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Members retrieved
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Group not found

---

### 1.9 GET /social/groups/:id/shared-links

Get shared links in a group (canonical content type endpoint).

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Group MongoDB ObjectId  
  **Query Parameters**:
- `limit` (number): Items per page (default: 20)
- `canonical_type` (string): Content type filter - `media|files|links` (default: `links`)

**Request**:

```bash
curl -X GET 'http://localhost:5050/social/groups/69d44c4ceb790d48e9a66780/shared-links?limit=20' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "link_123abc",
      "url": "https://example.com/article",
      "title": "Latest Tech Trends",
      "description": "Overview of 2026 technology landscape",
      "shared_by": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "shared_at": "2026-04-08T14:00:00Z",
      "canonical_type": "links",
      "reactions": { "👍": 5, "❤️": 2 }
    }
  ],
  "_metadata": {
    "total": 8,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Links retrieved
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Group not found

---

### 1.10 POST /social/groups/:id/shared-links

Post a shared link to a group.

**Method**: `POST`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Group MongoDB ObjectId

**Request Payload**:

```json
{
  "url": "https://example.com/article",
  "title": "Latest Tech Trends",
  "description": "Overview of 2026 technology landscape"
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/social/groups/69d44c4ceb790d48e9a66780/shared-links \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "title": "Latest Tech Trends"
  }'
```

**Response (201 - Created)**:

```json
{
  "data": {
    "id": "link_123abc",
    "url": "https://example.com/article",
    "title": "Latest Tech Trends",
    "shared_by": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
    "shared_at": "2026-04-08T15:30:00Z",
    "canonical_type": "links"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `201 Created` - Link shared successfully
- `400 Bad Request` - Invalid URL or missing fields
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Cannot post in this group
- `404 Not Found` - Group not found

---

### 1.11 GET /social/groups/:id/shared-media

Get shared media in a group.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Group MongoDB ObjectId  
  **Query Parameters**:
- `limit` (number): Items per page (default: 20)
- `canonical_type` (string): Filter - `media|files|links` (default: `media`)

**Request**:

```bash
curl -X GET 'http://localhost:5050/social/groups/69d44c4ceb790d48e9a66780/shared-media?limit=20' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "media_456def",
      "type": "image",
      "url": "https://cdn.example.com/image.jpg",
      "shared_by": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "shared_at": "2026-04-08T13:00:00Z",
      "canonical_type": "media",
      "filename": "group_photo.jpg"
    }
  ],
  "_metadata": {
    "total": 15,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Media retrieved
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Group not found

---

### 1.12 GET /social/groups/:id/shared-files

Get shared files in a group.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Group MongoDB ObjectId  
  **Query Parameters**:
- `limit` (number): Items per page
- `canonical_type` (string): Filter - `media|files|links` (default: `files`)

**Request**:

```bash
curl -X GET 'http://localhost:5050/social/groups/69d44c4ceb790d48e9a66780/shared-files?limit=20' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "file_789ghi",
      "filename": "business_plan.pdf",
      "url": "https://cdn.example.com/business_plan.pdf",
      "size_bytes": 2048576,
      "shared_by": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "shared_at": "2026-04-08T12:00:00Z",
      "canonical_type": "files"
    }
  ],
  "_metadata": {
    "total": 23,
    "limit": 20,
    "offset": 0,
    "has_more": true,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Files retrieved
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Group not found

---

### 1.13 GET /messages/chats

List all message conversations/chats for the user.

**Method**: `GET`  
**Authentication**: Required  
**Query Parameters**:

- `limit` (number): Items per page (default: 20)
- `offset` (number): Pagination offset (default: 0)
- `search` (string, optional): Filter chats by participant name

**Request**:

```bash
curl -X GET 'http://localhost:5050/messages/chats?limit=20&offset=0' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "chat_abc123",
      "with_user_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
      "with_user_name": "Jane Innovator",
      "last_message": "Thanks for the opportunity!",
      "last_message_at": "2026-04-08T14:00:00Z",
      "unread_count": 2,
      "message_count": 15
    }
  ],
  "_metadata": {
    "total": 8,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Chats retrieved
- `401 Unauthorized` - Not authenticated

---

### 1.14 GET /messages/chats/search

Search for specific chats by participant name or message content.

**Method**: `GET`  
**Authentication**: Required  
**Query Parameters**:

- `q` (string): Search query (required)
- `type` (string): `chat` or `message` (default: `chat`)

**Request**:

```bash
curl -X GET 'http://localhost:5050/messages/chats/search?q=jane' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "chat_abc123",
      "type": "chat",
      "with_user_name": "Jane Innovator",
      "match_context": "Chat with Jane Innovator"
    }
  ],
  "_metadata": {
    "total": 1,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Search results returned
- `400 Bad Request` - Missing query parameter
- `401 Unauthorized` - Not authenticated

---

### 1.15 POST /messages/send

Send a new message to another user.

**Method**: `POST`  
**Authentication**: Required  
**Content-Type**: `application/json`

**Request Payload**:

```json
{
  "recipient_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
  "content": "Thanks for connecting! I'd love to discuss collaboration opportunities.",
  "mentions": ["user_36IdtjemE0ACxYzUFfpP8QUFjyf"]
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/messages/send \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "content": "Thanks for connecting!"
  }'
```

**Response (201 - Created)**:

```json
{
  "data": {
    "id": "msg_xyz789",
    "from": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
    "to": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "content": "Thanks for connecting! I'd love to discuss collaboration opportunities.",
    "sent_at": "2026-04-08T15:30:00Z",
    "read": false
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `201 Created` - Message sent successfully
- `400 Bad Request` - Invalid payload
- `401 Unauthorized` - Not authenticated
- `429 Too Many Requests` - Rate limit (100 msgs/hour)

---

### 1.16 PUT /messages/:id

Edit an existing message.

**Method**: `PUT`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Message ID

**Request Payload**:

```json
{
  "content": "Updated message content"
}
```

**Request**:

```bash
curl -X PUT http://localhost:5050/messages/msg_xyz789 \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"content": "Updated message content"}'
```

**Response (200 - Success)**:

```json
{
  "data": {
    "id": "msg_xyz789",
    "content": "Updated message content",
    "edited_at": "2026-04-08T15:31:00Z",
    "original_content": "Thanks for connecting!"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:31:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Message updated
- `400 Bad Request` - Invalid payload
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Cannot edit others' messages
- `404 Not Found` - Message not found

---

### 1.17 DELETE /messages/:id

Delete a message.

**Method**: `DELETE`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Message ID

**Request**:

```bash
curl -X DELETE http://localhost:5050/messages/msg_xyz789 \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": {
    "deleted": true,
    "message_id": "msg_xyz789",
    "deleted_at": "2026-04-08T15:31:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:31:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Message deleted
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Cannot delete others' messages
- `404 Not Found` - Message not found

---

### 1.18 POST /messages/:id/react

Add a reaction/emoji to a message.

**Method**: `POST`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Message ID

**Request Payload**:

```json
{
  "reaction": "👍",
  "action": "add"
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/messages/msg_xyz789/react \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"reaction": "👍", "action": "add"}'
```

**Response (200 - Success)**:

```json
{
  "data": {
    "message_id": "msg_xyz789",
    "reactions": {
      "👍": [
        "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
        "user_36IdtjemE0ACxYzUFfpP8QUFjyf"
      ],
      "❤️": ["user_36IcC3uo7Ch1Go4qYTZexUeWoaM"]
    },
    "your_reactions": ["👍"]
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:31:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Reaction added/removed
- `400 Bad Request` - Invalid reaction emoji
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Message not found
- `429 Too Many Requests` - Rate limit (50 reactions/min)

---

### 1.19 GET /conversations

List all conversations (similar to chats but with more metadata).

**Method**: `GET`  
**Authentication**: Required  
**Query Parameters**:

- `limit` (number): Items per page (default: 20)
- `offset` (number): Pagination offset (default: 0)
- `include_archived` (boolean): Include archived conversations (default: false)

**Request**:

```bash
curl -X GET 'http://localhost:5050/conversations?limit=20' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "conv_conv123",
      "participants": [
        "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
        "user_36IdtjemE0ACxYzUFfpP8QUFjyf"
      ],
      "type": "direct",
      "created_at": "2026-04-01T10:00:00Z",
      "last_activity_at": "2026-04-08T14:00:00Z",
      "unread_count": 2,
      "archived": false
    }
  ],
  "_metadata": {
    "total": 12,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Conversations retrieved
- `401 Unauthorized` - Not authenticated

---

### 1.20 GET /conversations/:id/shared/media

Get shared media within a conversation (canonical endpoint).

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Conversation ID  
  **Query Parameters**:
- `canonical_type` (string): Filter - `media|files|links` (default: `media`)
- `limit` (number): Items per page (default: 20)

**Request**:

```bash
curl -X GET 'http://localhost:5050/conversations/conv_conv123/shared/media?canonical_type=media' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "media_456def",
      "type": "image",
      "url": "https://cdn.example.com/image.jpg",
      "canonical_type": "media",
      "shared_by": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "shared_at": "2026-04-08T13:00:00Z"
    }
  ],
  "_metadata": {
    "total": 5,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Media retrieved
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not a conversation participant
- `404 Not Found` - Conversation not found

---

### 1.21 GET /conversations/:id/shared/files

Get shared files within a conversation.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Conversation ID  
  **Query Parameters**:
- `canonical_type` (string): Filter - `media|files|links` (default: `files`)
- `limit` (number): Items per page (default: 20)

**Request**:

```bash
curl -X GET 'http://localhost:5050/conversations/conv_conv123/shared/files?canonical_type=files' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "file_789ghi",
      "filename": "proposal.docx",
      "url": "https://cdn.example.com/proposal.docx",
      "canonical_type": "files",
      "size_bytes": 1048576,
      "shared_by": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "shared_at": "2026-04-08T12:00:00Z"
    }
  ],
  "_metadata": {
    "total": 3,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Files retrieved
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not a conversation participant
- `404 Not Found` - Conversation not found

---

### 1.22 GET /conversations/:id/shared/links

Get shared links within a conversation.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Conversation ID  
  **Query Parameters**:
- `canonical_type` (string): Filter - `media|files|links` (default: `links`)
- `limit` (number): Items per page (default: 20)

**Request**:

```bash
curl -X GET 'http://localhost:5050/conversations/conv_conv123/shared/links?canonical_type=links' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "link_123abc",
      "url": "https://example.com/resource",
      "title": "Collaboration Resource",
      "canonical_type": "links",
      "shared_by": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "shared_at": "2026-04-08T11:00:00Z"
    }
  ],
  "_metadata": {
    "total": 2,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Links retrieved
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not a conversation participant
- `404 Not Found` - Conversation not found

---

## Part 2: Offers & Inquiries

### 2.1 GET /offers

List all offers (sent or received) for the user.

**Method**: `GET`  
**Authentication**: Required  
**Query Parameters**:

- `status` (string): `pending|accepted|rejected|countered` (optional)
- `direction` (string): `sent|received|all` (default: `all`)
- `limit` (number): Items per page (default: 20)
- `offset` (number): Pagination offset (default: 0)

**Request**:

```bash
curl -X GET 'http://localhost:5050/offers?status=pending&direction=received&limit=20' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "69cc5159cf0fca3e239f7808",
      "from_user_id": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "to_user_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
      "offer_type": "collaboration",
      "title": "Tech Partnership Opportunity",
      "description": "Interested in collaborating on a tech startup",
      "status": "pending",
      "created_at": "2026-04-08T10:00:00Z",
      "expires_at": "2026-04-15T10:00:00Z",
      "terms": {
        "equity": "20%",
        "investment": "$50,000"
      }
    }
  ],
  "_metadata": {
    "total": 5,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Offers retrieved
- `401 Unauthorized` - Not authenticated

---

### 2.2 GET /offers/:id

Get detailed information about a specific offer.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Offer MongoDB ObjectId

**Request**:

```bash
curl -X GET 'http://localhost:5050/offers/69cc5159cf0fca3e239f7808' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": {
    "id": "69cc5159cf0fca3e239f7808",
    "from_user_id": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
    "from_user_name": "John Entrepreneur",
    "to_user_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "to_user_name": "Jane Innovator",
    "offer_type": "collaboration",
    "title": "Tech Partnership Opportunity",
    "description": "Interested in collaborating on a tech startup",
    "status": "pending",
    "created_at": "2026-04-08T10:00:00Z",
    "updated_at": "2026-04-08T14:00:00Z",
    "expires_at": "2026-04-15T10:00:00Z",
    "terms": {
      "equity": "20%",
      "investment": "$50,000",
      "timeline": "6 months"
    },
    "conversation_id": "conv_xyz123",
    "counter_history": []
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Offer retrieved
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Cannot view this offer
- `404 Not Found` - Offer not found

---

### 2.3 GET /offers/:id/terms-history

Get the history of term changes for an offer.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Offer MongoDB ObjectId

**Request**:

```bash
curl -X GET 'http://localhost:5050/offers/69cc5159cf0fca3e239f7808/terms-history' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "version": 1,
      "terms": {
        "equity": "20%",
        "investment": "$50,000"
      },
      "changed_by": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "changed_at": "2026-04-08T10:00:00Z",
      "change_type": "initial"
    },
    {
      "version": 2,
      "terms": {
        "equity": "25%",
        "investment": "$60,000"
      },
      "changed_by": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
      "changed_at": "2026-04-08T12:00:00Z",
      "change_type": "counter"
    }
  ],
  "_metadata": {
    "total": 2,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Terms history retrieved
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Offer not found

---

### 2.4 POST /offers/:id/counter

Submit a counter offer to an existing offer.

**Method**: `POST`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Offer MongoDB ObjectId

**Request Payload**:

```json
{
  "terms": {
    "equity": "25%",
    "investment": "$60,000",
    "timeline": "12 months"
  },
  "message": "We can agree to these revised terms instead"
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/offers/69cc5159cf0fca3e239f7808/counter \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "terms": {
      "equity": "25%",
      "investment": "$60,000"
    },
    "message": "We can agree to these revised terms"
  }'
```

**Response (201 - Created)**:

```json
{
  "data": {
    "id": "69cc5159cf0fca3e239f7808",
    "status": "countered",
    "current_terms": {
      "equity": "25%",
      "investment": "$60,000",
      "timeline": "12 months"
    },
    "last_counter_by": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "last_counter_at": "2026-04-08T15:30:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `201 Created` - Counter offer submitted
- `400 Bad Request` - Invalid terms or offer already resolved
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Offer not found

---

### 2.5 POST /offers/:id/accept

Accept an offer (or the current counter terms).

**Method**: `POST`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Offer MongoDB ObjectId

**Request Payload** (optional):

```json
{
  "message": "I accept these terms!"
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/offers/69cc5159cf0fca3e239f7808/accept \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"message": "I accept these terms!"}'
```

**Response (200 - Success)**:

```json
{
  "data": {
    "id": "69cc5159cf0fca3e239f7808",
    "status": "accepted",
    "accepted_by": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "accepted_at": "2026-04-08T15:30:00Z",
    "final_terms": {
      "equity": "25%",
      "investment": "$60,000",
      "timeline": "12 months"
    },
    "next_step": "Reference check initiation"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Offer accepted
- `400 Bad Request` - Cannot accept (already resolved, expired, etc.)
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not the intended recipient
- `404 Not Found` - Offer not found

---

### 2.6 GET /offers-inquiries

Alias endpoint that returns combined offers and inquiry data.

**Method**: `GET`  
**Authentication**: Required  
**Query Parameters**:

- `type` (string): `offers|inquiries|all` (default: `all`)
- `limit` (number): Items per page (default: 20)

**Request**:

```bash
curl -X GET 'http://localhost:5050/offers-inquiries?type=all&limit=20' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "69cc5159cf0fca3e239f7808",
      "type": "offer",
      "title": "Tech Partnership Opportunity",
      "from": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "to": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
      "status": "pending",
      "created_at": "2026-04-08T10:00:00Z"
    }
  ],
  "_metadata": {
    "total": 12,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Data retrieved
- `401 Unauthorized` - Not authenticated

---

## Part 3: Reference Checks & Orders

### 3.1 GET /orders

List all orders for the user (as buyer or seller).

**Method**: `GET`  
**Authentication**: Required  
**Query Parameters**:

- `status` (string): `pending|in-progress|completed|cancelled` (optional)
- `role` (string): `buyer|seller|all` (default: `all`)
- `limit` (number): Items per page (default: 20)

**Request**:

```bash
curl -X GET 'http://localhost:5050/orders?status=pending&role=buyer&limit=20' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "69cc515bcf0fca3e239f7811",
      "buyer_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
      "seller_id": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "status": "in-progress",
      "title": "Web Development Services",
      "amount": 5000,
      "currency": "USD",
      "created_at": "2026-04-01T10:00:00Z",
      "expected_completion": "2026-05-01T10:00:00Z",
      "ref_check_required": true,
      "ref_check_status": "pending"
    }
  ],
  "_metadata": {
    "total": 8,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Orders retrieved
- `401 Unauthorized` - Not authenticated

---

### 3.2 GET /orders/:id

Get detailed information about a specific order.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Order MongoDB ObjectId

**Request**:

```bash
curl -X GET 'http://localhost:5050/orders/69cc515bcf0fca3e239f7811' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": {
    "id": "69cc515bcf0fca3e239f7811",
    "buyer_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "buyer_name": "Jane Innovator",
    "seller_id": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
    "seller_name": "John Entrepreneur",
    "status": "in-progress",
    "title": "Web Development Services",
    "description": "Full-stack web application development",
    "amount": 5000,
    "currency": "USD",
    "created_at": "2026-04-01T10:00:00Z",
    "updated_at": "2026-04-08T14:00:00Z",
    "expected_completion": "2026-05-01T10:00:00Z",
    "milestones": [
      {
        "name": "Design Phase",
        "status": "completed",
        "due_date": "2026-04-15T10:00:00Z",
        "price": 1500
      }
    ],
    "ref_check_required": true,
    "ref_check_status": "pending",
    "payment_status": "in-escrow"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Order retrieved
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not a party to this order
- `404 Not Found` - Order not found

---

### 3.3 GET /orders/:id/completion-status

Get current completion status and progress of an order.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Order MongoDB ObjectId

**Request**:

```bash
curl -X GET 'http://localhost:5050/orders/69cc515bcf0fca3e239f7811/completion-status' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": {
    "order_id": "69cc515bcf0fca3e239f7811",
    "overall_status": "in-progress",
    "completion_percentage": 45,
    "milestones": [
      {
        "name": "Design Phase",
        "status": "completed",
        "completion_date": "2026-04-05T10:00:00Z"
      },
      {
        "name": "Development Phase",
        "status": "in-progress",
        "expected_completion": "2026-04-20T10:00:00Z"
      }
    ],
    "timeline_status": "on-track",
    "days_remaining": 23
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Completion status retrieved
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Cannot view this order
- `404 Not Found` - Order not found

---

### 3.4 POST /orders/:id/complete

Mark an order as completed.

**Method**: `POST`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Order MongoDB ObjectId

**Request Payload** (optional):

```json
{
  "feedback": "Excellent work, very satisfied with the results",
  "rating": 5
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/orders/69cc515bcf0fca3e239f7811/complete \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "feedback": "Excellent work, very satisfied",
    "rating": 5
  }'
```

**Response (200 - Success)**:

```json
{
  "data": {
    "order_id": "69cc515bcf0fca3e239f7811",
    "status": "completed",
    "completed_by": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "completed_at": "2026-04-08T15:30:00Z",
    "reference_check_initiated": true
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Order completed
- `400 Bad Request` - Order cannot be completed (not in progress, etc.)
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Only buyer can complete
- `404 Not Found` - Order not found

---

### 3.5 POST /orders/:id/reference-check/initiate

Initiate a reference check for an order.

**Method**: `POST`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Order MongoDB ObjectId

**Request Payload**:

```json
{
  "asking_for": "Can you vouch for this person as a business partner?",
  "relationship_context": "Web development project completion",
  "include_seller": true
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/orders/69cc515bcf0fca3e239f7811/reference-check/initiate \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "asking_for": "Can you vouch for this person?"
  }'
```

**Response (201 - Created)**:

```json
{
  "data": {
    "reference_check_id": "69d4dd12eb790d48e9a686cd",
    "order_id": "69cc515bcf0fca3e239f7811",
    "status": "initiated",
    "asking_for": "Can you vouch for this person as a business partner?",
    "initiated_at": "2026-04-08T15:30:00Z",
    "expires_at": "2026-04-22T15:30:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `201 Created` - Reference check initiated
- `400 Bad Request` - Order context invalid
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Order not found

---

### 3.6 GET /orders/:id/audit-trail

Get all activities and changes associated with an order.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Order MongoDB ObjectId

**Request**:

```bash
curl -X GET 'http://localhost:5050/orders/69cc515bcf0fca3e239f7811/audit-trail' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "event": "order_created",
      "timestamp": "2026-04-01T10:00:00Z",
      "actor": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
      "details": "Order created for Web Development Services"
    },
    {
      "event": "milestone_completed",
      "timestamp": "2026-04-05T10:00:00Z",
      "actor": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "details": "Design Phase milestone completed"
    }
  ],
  "_metadata": {
    "total": 5,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Audit trail retrieved
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Cannot view this order
- `404 Not Found` - Order not found

---

### 3.7 POST /reference-checks

Create a new reference check request.

**Method**: `POST`  
**Authentication**: Required  
**Content-Type**: `application/json`

**Request Payload**:

```json
{
  "asking_for": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
  "relationship": "Business Partner",
  "message": "Can you vouch for this person's professionalism and reliability?",
  "notify_immediately": true
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/reference-checks \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "asking_for": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "relationship": "Business Partner",
    "message": "Can you vouch for this person?"
  }'
```

**Response (201 - Created)**:

```json
{
  "data": {
    "id": "69d4dd12eb790d48e9a686cd",
    "asking_for_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "asking_for_name": "Jane Innovator",
    "asked_by_id": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
    "asked_by_name": "John Entrepreneur",
    "relationship": "Business Partner",
    "message": "Can you vouch for this person's professionalism and reliability?",
    "status": "pending",
    "created_at": "2026-04-08T15:30:00Z",
    "expires_at": "2026-04-22T15:30:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `201 Created` - Reference check created
- `400 Bad Request` - Invalid user ID or missing fields
- `401 Unauthorized` - Not authenticated
- `429 Too Many Requests` - Rate limit (10 checks/day)

---

### 3.8 GET /reference-checks

List reference checks (supports both canonical and legacy filter values).

**Method**: `GET`  
**Authentication**: Required  
**Query Parameters**:

- `filter` (string): Canonical: `all|you|connections|active|suspended|completed` OR Legacy: `requested|pending|about-me`
- `limit` (number): Items per page (default: 20)
- `offset` (number): Pagination offset (default: 0)

**Request (with canonical filter)**:

```bash
curl -X GET 'http://localhost:5050/reference-checks?filter=all&limit=20' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Request (with legacy filter - backwards compatible)**:

```bash
curl -X GET 'http://localhost:5050/reference-checks?filter=requested&limit=20' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "69d4dd12eb790d48e9a686cd",
      "asking_for_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
      "asking_for_name": "Jane Innovator",
      "asked_by_id": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
      "asked_by_name": "John Entrepreneur",
      "relationship": "Business Partner",
      "status": "pending",
      "created_at": "2026-04-08T15:30:00Z",
      "expires_at": "2026-04-22T15:30:00Z",
      "vouches_count": 0
    }
  ],
  "_metadata": {
    "total": 3,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "canonical_filters": [
      "all",
      "you",
      "connections",
      "active",
      "suspended",
      "completed"
    ],
    "legacy_filters": ["requested", "pending", "about-me"],
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Reference checks retrieved
- `400 Bad Request` - Invalid filter value
- `401 Unauthorized` - Not authenticated

---

### 3.9 GET /reference-checks/:id

Get detailed information about a specific reference check.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Reference Check MongoDB ObjectId

**Request**:

```bash
curl -X GET 'http://localhost:5050/reference-checks/69d4dd12eb790d48e9a686cd' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": {
    "id": "69d4dd12eb790d48e9a686cd",
    "asking_for_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "asking_for_name": "Jane Innovator",
    "asked_by_id": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
    "asked_by_name": "John Entrepreneur",
    "relationship": "Business Partner",
    "message": "Can you vouch for this person's professionalism and reliability?",
    "status": "pending",
    "created_at": "2026-04-08T15:30:00Z",
    "updated_at": "2026-04-08T15:30:00Z",
    "expires_at": "2026-04-22T15:30:00Z",
    "respondents": [],
    "vouches_count": 0,
    "trust_score": 0,
    "verified": false
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Reference check retrieved
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Reference check not found

---

### 3.10 POST /reference-checks/:id/respond

Respond to a reference check request.

**Method**: `POST`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Reference Check MongoDB ObjectId

**Request Payload**:

```json
{
  "response": "positive",
  "message": "Jane is a reliable and professional business partner. Highly recommended!",
  "rating": 5,
  "public": true
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/reference-checks/69d4dd12eb790d48e9a686cd/respond \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "response": "positive",
    "message": "Jane is very reliable!",
    "rating": 5
  }'
```

**Response (200 - Success)**:

```json
{
  "data": {
    "reference_check_id": "69d4dd12eb790d48e9a686cd",
    "responded_by": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
    "response": "positive",
    "rating": 5,
    "message": "Jane is a reliable and professional business partner. Highly recommended!",
    "responded_at": "2026-04-08T15:30:00Z",
    "public": true
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Response recorded
- `400 Bad Request` - Invalid response type
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Reference check not found

---

### 3.11 DELETE /reference-checks/:id

Delete a reference check (can be deleted by the requester before responses).

**Method**: `DELETE`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Reference Check MongoDB ObjectId

**Request**:

```bash
curl -X DELETE http://localhost:5050/reference-checks/69d4dd12eb790d48e9a686cd \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": {
    "deleted": true,
    "reference_check_id": "69d4dd12eb790d48e9a686cd",
    "deleted_at": "2026-04-08T15:30:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Reference check deleted
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Only requester can delete, or has responses
- `404 Not Found` - Reference check not found

---

### 3.12 POST /reference-checks/:id/vouch

Vouch for someone (public endorsement).

**Method**: `POST`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Reference Check MongoDB ObjectId

**Request Payload**:

```json
{
  "confidence": "high",
  "comment": "I've worked with this person for 2 years. Very trustworthy and professional.",
  "willingness": "public"
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/reference-checks/69d4dd12eb790d48e9a686cd/vouch \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "confidence": "high",
    "comment": "Very trustworthy person",
    "willingness": "public"
  }'
```

**Response (201 - Created)**:

```json
{
  "data": {
    "vouch_id": "vouch_abc123",
    "reference_check_id": "69d4dd12eb790d48e9a686cd",
    "voucher_id": "user_delegate123",
    "confidence": "high",
    "comment": "I've worked with this person for 2 years. Very trustworthy and professional.",
    "willingness": "public",
    "created_at": "2026-04-08T15:30:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `201 Created` - Vouch recorded
- `400 Bad Request` - Invalid confidence level
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Reference check not found
- `429 Too Many Requests` - Rate limit (5 vouches per check, 50 vouches/day)

---

### 3.13 GET /reference-checks/:id/vouches

Get all vouches for a reference check.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Reference Check MongoDB ObjectId  
  **Query Parameters**:
- `visibility` (string): `public|private|all` (default: `public`)
- `limit` (number): Items per page (default: 50)

**Request**:

```bash
curl -X GET 'http://localhost:5050/reference-checks/69d4dd12eb790d48e9a686cd/vouches?visibility=public' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "voucher_id": "user_delegate123",
      "voucher_name": "John Delegate",
      "confidence": "high",
      "comment": "I've worked with this person for 2 years. Very trustworthy",
      "created_at": "2026-04-08T15:30:00Z",
      "visibility": "public"
    }
  ],
  "_metadata": {
    "total": 3,
    "limit": 50,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Vouches retrieved
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Reference check not found

---

### 3.14 GET /reference-checks/:id/summary

Get summary statistics for a reference check.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Reference Check MongoDB ObjectId

**Request**:

```bash
curl -X GET 'http://localhost:5050/reference-checks/69d4dd12eb790d48e9a686cd/summary' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": {
    "reference_check_id": "69d4dd12eb790d48e9a686cd",
    "status": "in-progress",
    "responses": {
      "positive": 3,
      "neutral": 1,
      "negative": 0,
      "pending_from": ["user_abc", "user_def"]
    },
    "vouches": {
      "total": 5,
      "high_confidence": 3,
      "medium_confidence": 2,
      "low_confidence": 0
    },
    "trust_score": 4.2,
    "overall_sentiment": "very_positive",
    "created_at": "2026-04-08T10:00:00Z",
    "expires_at": "2026-04-22T10:00:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Summary retrieved
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Reference check not found

---

### 3.15 POST /reference-checks/:id/feedback

Submit feedback on a reference check response.

**Method**: `POST`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Reference Check MongoDB ObjectId

**Request Payload**:

```json
{
  "response_id": "response_xyz789",
  "helpful": true,
  "feedback": "This was very helpful, thank you",
  "reason": "accurate"
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/reference-checks/69d4dd12eb790d48e9a686cd/feedback \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "response_id": "response_xyz789",
    "helpful": true,
    "feedback": "This was very helpful"
  }'
```

**Response (201 - Created)**:

```json
{
  "data": {
    "feedback_id": "feedback_abc123",
    "reference_check_id": "69d4dd12eb790d48e9a686cd",
    "helpful": true,
    "feedback": "This was very helpful, thank you",
    "reason": "accurate",
    "created_at": "2026-04-08T15:30:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `201 Created` - Feedback recorded
- `400 Bad Request` - Invalid feedback
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Reference check not found

---

### 3.16 POST /reference-checks/:id/trust-safety/appeal

Appeal a trust & safety decision related to a reference check.

**Method**: `POST`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Reference Check MongoDB ObjectId

**Request Payload**:

```json
{
  "reason": "inappropriate_suspension",
  "message": "I believe this suspension was made in error. I have always maintained professional standards.",
  "supporting_evidence": ["evidence_link_1", "evidence_link_2"]
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/reference-checks/69d4dd12eb790d48e9a686cd/trust-safety/appeal \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "inappropriate_suspension",
    "message": "I believe this suspension was made in error"
  }'
```

**Response (201 - Created)**:

```json
{
  "data": {
    "appeal_id": "appeal_def789",
    "reference_check_id": "69d4dd12eb790d48e9a686cd",
    "status": "under_review",
    "reason": "inappropriate_suspension",
    "created_at": "2026-04-08T15:30:00Z",
    "estimated_review_date": "2026-04-15T15:30:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `201 Created` - Appeal submitted
- `400 Bad Request` - Invalid appeal reason
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Reference check not found

---

## Supporting APIs: Users & Profiles

### 4.1 GET /user

Get current authenticated user's profile.

**Method**: `GET`  
**Authentication**: Required

**Request**:

```bash
curl -X GET http://localhost:5050/user \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": {
    "id": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
    "email": "john@example.com",
    "name": "John Entrepreneur",
    "avatar_url": "https://cdn.example.com/avatar.jpg",
    "bio": "Tech entrepreneur and startup founder",
    "location": "San Francisco, CA",
    "verification_status": "verified",
    "trust_score": 4.7,
    "member_since": "2025-01-15T10:00:00Z",
    "groups_count": 12,
    "connections_count": 45
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - User profile retrieved
- `401 Unauthorized` - Not authenticated

---

### 4.2 GET /user/profile

Alternate endpoint for retrieving current user profile.

**Method**: `GET`  
**Authentication**: Required

**Request**:

```bash
curl -X GET http://localhost:5050/user/profile \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response**: Same as /user endpoint

**Status Codes**:

- `200 OK` - User profile retrieved
- `401 Unauthorized` - Not authenticated

---

### 4.3 GET /users/:id/profile

Get a public user profile by ID.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): User ID

**Request**:

```bash
curl -X GET 'http://localhost:5050/users/user_36IdtjemE0ACxYzUFfpP8QUFjyf/profile' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": {
    "id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "name": "Jane Innovator",
    "avatar_url": "https://cdn.example.com/avatar2.jpg",
    "bio": "Innovation strategist and advisor",
    "location": "New York, NY",
    "verification_status": "verified",
    "trust_score": 4.8,
    "member_since": "2025-02-20T10:00:00Z",
    "public_connections_count": 62,
    "mutual_connections": 8,
    "mutual_groups": 3
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Profile retrieved
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Profile is private
- `404 Not Found` - User not found

---

### 4.4 GET /users/:id/common-groups

Get groups that both users are members of.

**Method**: `GET`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): User ID  
  **Query Parameters**:
- `limit` (number): Items per page (default: 20)

**Request**:

```bash
curl -X GET 'http://localhost:5050/users/user_36IdtjemE0ACxYzUFfpP8QUFjyf/common-groups?limit=20' \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": [
    {
      "id": "69d44c4ceb790d48e9a66780",
      "name": "Tech Entrepreneurs Network",
      "member_count": 42,
      "created_at": "2026-04-08T10:00:00Z"
    }
  ],
  "_metadata": {
    "total": 3,
    "limit": 20,
    "offset": 0,
    "has_more": false,
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Common groups retrieved
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - User not found

---

### 4.5 POST /users/:id/connections

Create a connection with another user.

**Method**: `POST`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): Target user ID

**Request Payload** (optional):

```json
{
  "relationship": "Business Partner",
  "message": "I'd like to connect with you"
}
```

**Request**:

```bash
curl -X POST http://localhost:5050/users/user_36IdtjemE0ACxYzUFfpP8QUFjyf/connections \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"relationship": "Business Partner"}'
```

**Response (201 - Created)**:

```json
{
  "data": {
    "connection_id": "conn_abc123",
    "from_user_id": "user_36IcC3uo7Ch1Go4qYTZexUeWoaM",
    "to_user_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "status": "pending",
    "relationship": "Business Partner",
    "created_at": "2026-04-08T15:30:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `201 Created` - Connection request sent
- `400 Bad Request` - Already connected or connection exists
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - User not found

---

### 4.6 DELETE /users/:id/connections

Delete/remove a connection with another user.

**Method**: `DELETE`  
**Authentication**: Required  
**Path Parameters**:

- `id` (string): User ID

**Request**:

```bash
curl -X DELETE http://localhost:5050/users/user_36IdtjemE0ACxYzUFfpP8QUFjyf/connections \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**Response (200 - Success)**:

```json
{
  "data": {
    "disconnected": true,
    "user_id": "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    "removed_at": "2026-04-08T15:30:00Z"
  },
  "_metadata": {
    "timestamp": "2026-04-08T15:30:45Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Status Codes**:

- `200 OK` - Connection removed
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Connection or user not found

---

## Authentication & Common Patterns

### Bearer Token Format

All authenticated endpoints require an `Authorization` header with a Bearer token:

```
Authorization: Bearer <JWT_TOKEN>
```

The JWT token is obtained from Clerk and contains:

- `sub`: User ID (Clerk format: `user_xxxxx`)
- `aud`: Application audience
- `exp`: Token expiration timestamp
- `iat`: Token issued at timestamp

### Response Format

All responses follow a standardized envelope format:

```json
{
  "data": <response_data>,
  "_metadata": {
    "timestamp": "ISO-8601 timestamp",
    "requestId": "Unique request ID",
    "total": <for_lists>,
    "limit": <for_lists>,
    "offset": <for_lists>,
    "has_more": <for_lists>
  }
}
```

### Pagination

List endpoints support pagination via query parameters:

- `limit`: Number of items per page (default: 20, max: 100)
- `offset`: Number of items to skip (default: 0)

The response includes `_metadata` with pagination information:

- `total`: Total number of items available
- `limit`: Requested page size
- `offset`: Current offset
- `has_more`: Whether more items are available

### Rate Limiting

Rate limits vary by endpoint:

- **Default**: 100 requests per minute
- **Reference Check Creation**: 10 per day
- **Reference Check Vouches**: 50 per day, 5 per check
- **Message Sending**: 100 per hour
- **Group Creation**: 20 per hour
- **Message Reactions**: 50 per minute

Rate limit headers returned with all responses:

- `RateLimit-Limit`: Total requests allowed
- `RateLimit-Remaining`: Requests remaining in window
- `RateLimit-Reset`: Unix timestamp when limit resets

### Content Type Canonicalization

Shared content types are canonicalized to three values:

- `media`: Images, videos, audio files
- `files`: Documents, PDFs, compressed files
- `links`: Web links, URLs

Legacy field values are automatically mapped to canonical types:

- `image` → `media`
- `video` → `media`
- `document` → `files`
- `pdf` → `files`
- `url` → `links`

### Error Response Format

Error responses include detailed information:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address"
      }
    ]
  },
  "_metadata": {
    "requestId": "req_abc123xyz",
    "timestamp": "2026-04-08T15:30:45Z"
  }
}
```

### Status Code Meanings

- **200 OK**: Request successful, returning data
- **201 Created**: Resource successfully created
- **202 Accepted**: Request accepted, processing asynchronously
- **204 No Content**: Successful operation with no response body
- **400 Bad Request**: Invalid request payload or parameters
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Authenticated but not authorized for action
- **404 Not Found**: Resource doesn't exist
- **409 Conflict**: Request conflicts with current state
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error
- **503 Service Unavailable**: Service temporarily unavailable

---

## Testing

All endpoints have been tested with real production JWTs and IDs using the E2E test suite:

**Test Coverage**: 49 Batch 4 endpoints  
**Real Tokens**: Both seller and buyer Clerk JWTs  
**Real IDs**: Actual MongoDB ObjectIds from production database  
**Run Command**:

```bash
npm test -- tests/batch4-e2e.test.ts --verbose
```

**Generated By**: Batch 4 Production-Readiness Implementation  
**Document Version**: 1.0  
**Last Updated**: April 8, 2026
