# Reference Checks API

## Overview

Reference checks allow users to request community feedback about other users they're considering doing business with. Network members can provide ratings and comments (optionally anonymous) to help build trust.

---

## Authentication
All endpoints require `Authorization: Bearer <token>` header with a valid Clerk JWT.

## Base Endpoint
`/api/v1/reference-checks`

---

## Endpoints

### **1. Create Reference Check**
Request a reference check for another user.

```http
POST /api/v1/reference-checks
Content-Type: application/json

{
  "target_id": "507f1f77bcf86cd799439012",
  "network_id": "507f1f77bcf86cd799439013",
  "reason": "Considering a large purchase from this seller"
}
```

**Request Body:**
- `target_id` (string, required): User ID being checked
- `network_id` (string, optional): Network context for the check
- `reason` (string, optional): Why you're requesting this check (max 500 chars)

**Response:**
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "requester_id": "507f1f77bcf86cd799439011",
    "target_id": "507f1f77bcf86cd799439012",
    "network_id": "507f1f77bcf86cd799439013",
    "reason": "Considering a large purchase from this seller",
    "status": "pending",
    "responses": [],
    "expires_at": "2026-01-13T00:00:00Z",
    "createdAt": "2026-01-06T00:00:00Z",
    "updatedAt": "2026-01-06T00:00:00Z"
  }
}
```

**Rules:**
- Cannot create reference check for yourself
- Cannot have multiple pending checks for the same user
- Automatically expires after 7 days

**Error Responses:**
- `400` - Already have pending check for this user or trying to check yourself
- `404` - Target user not found

---

### **2. Get Reference Checks**
Retrieve reference checks based on type.

```http
GET /api/v1/reference-checks?type=requested
```

**Query Parameters:**
- `type` (string, optional): Filter type
  - `requested` - Checks you requested (default)
  - `pending` - Checks you can respond to
  - `about-me` - Completed checks about you

**Response:**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439014",
      "requester_id": "507f1f77bcf86cd799439011",
      "target_id": "507f1f77bcf86cd799439012",
      "status": "pending",
      "responses": [
        {
          "responder_id": "507f1f77bcf86cd799439015",
          "rating": "positive",
          "comment": "Trustworthy seller, smooth transaction",
          "is_anonymous": false,
          "responded_at": "2026-01-06T02:00:00Z"
        }
      ],
      "expires_at": "2026-01-13T00:00:00Z",
      "createdAt": "2026-01-06T00:00:00Z"
    }
  ],
  "total": 5
}
```

---

### **3. Get Reference Check by ID**
Get details of a specific reference check.

```http
GET /api/v1/reference-checks/:id
```

**Path Parameters:**
- `id` (string, required): Reference check ObjectId

**Response:**
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "requester_id": {
      "_id": "507f1f77bcf86cd799439011",
      "display_name": "John Doe",
      "avatar": "https://...",
      "first_name": "John",
      "last_name": "Doe"
    },
    "target_id": {
      "_id": "507f1f77bcf86cd799439012",
      "display_name": "Jane Smith",
      "avatar": "https://..."
    },
    "status": "pending",
    "responses": [
      {
        "responder_id": "507f1f77bcf86cd799439015",
        "rating": "positive",
        "comment": "Great experience",
        "is_anonymous": false,
        "responded_at": "2026-01-06T02:00:00Z"
      }
    ],
    "createdAt": "2026-01-06T00:00:00Z"
  },
  "is_requester": true,
  "is_target": false,
  "can_respond": false
}
```

**Anonymous Response Handling:**
- If `is_anonymous: true` and you're not the requester, `responder_id` will be `null`
- Requester always sees full details

**Response Fields:**
- `is_requester` (boolean): Whether you created this check
- `is_target` (boolean): Whether this check is about you
- `can_respond` (boolean): Whether you can respond to this check

---

### **4. Respond to Reference Check**
Provide feedback for a reference check.

```http
POST /api/v1/reference-checks/:id/respond
Content-Type: application/json

{
  "rating": "positive",
  "comment": "Had a great transaction with this person. Very professional.",
  "is_anonymous": false
}
```

**Path Parameters:**
- `id` (string, required): Reference check ObjectId

**Request Body:**
- `rating` (string, required): One of: `positive`, `neutral`, `negative`
- `comment` (string, optional): Your feedback (max 1000 chars)
- `is_anonymous` (boolean, optional): Whether to hide your identity (default: `false`)

**Response:**
```json
{
  "message": "Response added successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "responses": [
      {
        "responder_id": "507f1f77bcf86cd799439015",
        "rating": "positive",
        "comment": "Had a great transaction with this person.",
        "is_anonymous": false,
        "responded_at": "2026-01-06T03:00:00Z"
      }
    ],
    "updatedAt": "2026-01-06T03:00:00Z"
  }
}
```

**Rules:**
- Cannot respond to your own request
- Cannot respond about yourself
- Cannot respond twice to the same check
- Must be on a pending check

**Error Responses:**
- `400` - Already responded, check not pending, or invalid rating
- `403` - Not authorized to respond

---

### **5. Complete Reference Check**
Mark a reference check as complete (requester only).

```http
POST /api/v1/reference-checks/:id/complete
```

**Path Parameters:**
- `id` (string, required): Reference check ObjectId

**Response:**
```json
{
  "message": "Reference check completed",
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "status": "completed",
    "summary": {
      "total_responses": 5,
      "positive_count": 4,
      "neutral_count": 1,
      "negative_count": 0
    },
    "completed_at": "2026-01-06T04:00:00Z",
    "updatedAt": "2026-01-06T04:00:00Z"
  }
}
```

**Summary Calculation:**
Automatically aggregates all responses by rating type.

**Rules:**
- Only the requester can complete
- Must be in pending status

**Error Responses:**
- `403` - Not the requester
- `400` - Check not pending

---

### **6. Delete Reference Check**
Cancel/delete a pending reference check (requester only).

```http
DELETE /api/v1/reference-checks/:id
```

**Path Parameters:**
- `id` (string, required): Reference check ObjectId

**Response:**
```json
{
  "message": "Reference check deleted successfully"
}
```

**Rules:**
- Only the requester can delete
- Can only delete pending checks

**Error Responses:**
- `403` - Not authorized
- `400` - Check not pending

---

## Reference Check Lifecycle

```
pending → completed  (requester manually completes)
pending → expired    (auto-expires after 7 days)
pending → deleted    (requester cancels)
```

**Status Values:**
- `pending` - Active, accepting responses
- `approved` - Reserved for future use
- `declined` - Reserved for future use  
- `completed` - Requester manually completed

---

## Activity Feed Integration

When created, reference checks appear in the requester's activity feed with:
- `verb`: `"request"`
- `object`: `"reference_check:{checkId}"`
- `type`: `"reference_check"`
- `extra.target_user`: Target user ID

---

## Rating System

### Rating Values
- `positive` - Good experience, trustworthy
- `neutral` - No strong opinion, limited experience
- `negative` - Poor experience, concerns raised

### Best Practices for Responding
1. **Be Honest**: Provide truthful feedback
2. **Be Specific**: Include details in comments
3. **Consider Anonymous**: Use for sensitive feedback
4. **Stay Professional**: Keep comments professional

---

## Privacy & Anonymity

### Anonymous Responses
- Your identity is hidden from everyone except the requester
- The requester always sees who responded (for accountability)
- Other responders cannot see your identity

### Who Can See What
| Viewer | Requester | Target | Other Users | Anonymous Responders |
|--------|-----------|--------|-------------|---------------------|
| **Requester** | ✓ Full details | ✓ All responses | ✓ All responses | ✓ Can see responder IDs |
| **Target** | ✓ Can view | ✓ Can view if completed | ✓ Cannot respond | ✗ Responder IDs hidden |
| **Others** | ✓ Who requested | ✓ Who's being checked | ✓ Can respond | ✗ Responder IDs hidden |

---

## Example Workflows

### Request and Complete a Check
```bash
# 1. Create reference check
POST /api/v1/reference-checks
{
  "target_id": "507f1f77bcf86cd799439012",
  "reason": "Considering $15K watch purchase"
}

# 2. Check for responses
GET /api/v1/reference-checks/{id}

# 3. Wait for community responses...

# 4. Complete when satisfied
POST /api/v1/reference-checks/{id}/complete
```

### Respond to a Check
```bash
# 1. See pending checks you can respond to
GET /api/v1/reference-checks?type=pending

# 2. Review details
GET /api/v1/reference-checks/{id}

# 3. Provide feedback
POST /api/v1/reference-checks/{id}/respond
{
  "rating": "positive",
  "comment": "Smooth transaction, would recommend",
  "is_anonymous": false
}
```

### View Checks About You
```bash
# See completed reference checks about you
GET /api/v1/reference-checks?type=about-me
```

---

## Network Context

The optional `network_id` field allows checks within specific network contexts:
- Network-specific checks for network transactions
- Helps organize checks by community
- Future: Could enable network-only visibility

---

## Limitations

- 7-day expiration for pending checks
- Cannot check yourself
- Cannot respond to your own checks
- Cannot respond about yourself
- One response per user per check
- Only requester can complete/delete
