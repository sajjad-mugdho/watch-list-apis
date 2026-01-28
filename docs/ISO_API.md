# ISO (In Search Of) API

## Overview

The ISO feature allows users to create "wanted" listings for watches they're searching for. Other users can browse active ISOs and reach out if they have matching items.

---

## Authentication
All endpoints require `Authorization: Bearer <token>` header with a valid Clerk JWT.

## Base Endpoint
`/api/v1/isos`

---

## Endpoints

### **1. Create ISO**
Create a new In Search Of request.

```http
POST /api/v1/isos
Content-Type: application/json

{
  "title": "Looking for Rolex Submariner 116610LN",
  "description": "Preferably from 2015-2020, full set with box and papers",
  "criteria": {
    "brand": "Rolex",
    "model": "Submariner",
    "reference": "116610LN",
    "year_min": 2015,
    "year_max": 2020,
    "condition": "like-new",
    "max_price": 12000
  },
  "urgency": "high",
  "is_public": true,
  "expires_at": "2026-02-06T00:00:00Z"
}
```

**Request Body:**
- `title` (string, required): Brief description of what you're looking for (max 200 chars)
- `description` (string, optional): Detailed description (max 2000 chars)
- `criteria` (object, optional): Search criteria
  - `brand` (string): Watch brand
  - `model` (string): Watch model
  - `reference` (string): Reference number
  - `year_min` (number): Minimum year
  - `year_max` (number): Maximum year
  - `condition` (string): Desired condition
  - `max_price` (number): Maximum price willing to pay
- `urgency` (string, optional): One of: `low`, `medium`, `high`, `urgent` (default: `medium`)
- `is_public` (boolean, optional): Whether ISO is publicly visible (default: `true`)
- `expires_at` (string, optional): ISO expiration date (ISO 8601 format)

**Response:**
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "user_id": "507f1f77bcf86cd799439012",
    "clerk_id": "user_abc123",
    "title": "Looking for Rolex Submariner 116610LN",
    "description": "Preferably from 2015-2020, full set with box and papers",
    "criteria": {
      "brand": "Rolex",
      "model": "Submariner",
      "reference": "116610LN",
      "year_min": 2015,
      "year_max": 2020,
      "condition": "like-new",
      "max_price": 12000
    },
    "status": "active",
    "urgency": "high",
    "is_public": true,
    "expires_at": "2026-02-06T00:00:00Z",
    "createdAt": "2026-01-06T00:00:00Z",
    "updatedAt": "2026-01-06T00:00:00Z"
  }
}
```

**Limitations:**
- Maximum 10 active ISOs per user
- Title max length: 200 characters
- Description max length: 2000 characters

**Error Responses:**
- `400` - Maximum active ISOs reached or validation error
- `401` - Unauthorized

---

### **2. Get Public ISOs**
Retrieve paginated list of public active ISOs.

```http
GET /api/v1/isos?limit=20&offset=0
```

**Query Parameters:**
- `limit` (number, optional): Results per page (default: 20, max: 50)
- `offset` (number, optional): Pagination offset (default: 0)

**Response:**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "user_id": "507f1f77bcf86cd799439012",
      "title": "Looking for Rolex Submariner 116610LN",
      "criteria": {
        "brand": "Rolex",
        "model": "Submariner",
        "reference": "116610LN",
        "max_price": 12000
      },
      "status": "active",
      "urgency": "high",
      "createdAt": "2026-01-06T00:00:00Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

### **3. Get My ISOs**
Retrieve all ISOs created by the current user.

```http
GET /api/v1/isos/my?status=active
```

**Query Parameters:**
- `status` (string, optional): Filter by status
  - `active` - Currently active ISOs
  - `fulfilled` - ISOs marked as fulfilled
  - `expired` - Expired ISOs
  - `closed` - Manually closed ISOs
  - `all` - All ISOs (default)

**Response:**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "Looking for Rolex Submariner 116610LN",
      "status": "active",
      "urgency": "high",
      "is_public": true,
      "createdAt": "2026-01-06T00:00:00Z",
      "updatedAt": "2026-01-06T00:00:00Z"
    }
  ],
  "total": 5
}
```

---

### **4. Get ISO by ID**
Retrieve a specific ISO by its ID.

```http
GET /api/v1/isos/:id
```

**Path Parameters:**
- `id` (string, required): ISO ObjectId

**Response:**
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "user_id": "507f1f77bcf86cd799439012",
    "title": "Looking for Rolex Submariner 116610LN",
    "description": "Preferably from 2015-2020",
    "criteria": { ... },
    "status": "active",
    "urgency": "high",
    "is_public": true,
    "createdAt": "2026-01-06T00:00:00Z"
  },
  "is_owner": true
}
```

**Access Control:**
- Public ISOs: Anyone can view
- Private ISOs: Only the owner can view

**Error Responses:**
- `403` - Access denied for private ISO
- `404` - ISO not found

---

### **5. Update ISO**
Update an existing ISO (owner only).

```http
PUT /api/v1/isos/:id
Content-Type: application/json

{
  "title": "Updated title",
  "criteria": {
    "max_price": 15000
  },
  "urgency": "urgent",
  "status": "active"
}
```

**Path Parameters:**
- `id` (string, required): ISO ObjectId

**Request Body:** All fields are optional
- `title` (string): Update title
- `description` (string): Update description
- `criteria` (object): Update search criteria
- `urgency` (string): Update urgency level
- `is_public` (boolean): Change visibility
- `expires_at` (string): Update expiration
- `status` (string): Change status (`active`, `fulfilled`, `expired`, `closed`)

**Response:**
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Updated title",
    "criteria": {
      "max_price": 15000
    },
    "urgency": "urgent",
    "updatedAt": "2026-01-06T01:00:00Z"
  }
}
```

**Error Responses:**
- `403` - Not authorized (not owner)
- `404` - ISO not found

---

### **6. Delete ISO**
Delete an ISO (owner only).

```http
DELETE /api/v1/isos/:id
```

**Path Parameters:**
- `id` (string, required): ISO ObjectId

**Response:**
```json
{
  "message": "ISO deleted successfully"
}
```

**Effect:** Also removes the ISO activity from the user's activity feed.

**Error Responses:**
- `403` - Not authorized
- `404` - ISO not found

---

### **7. Mark ISO as Fulfilled**
Mark an ISO as fulfilled when you've found what you were looking for.

```http
POST /api/v1/isos/:id/fulfill
```

**Path Parameters:**
- `id` (string, required): ISO ObjectId

**Response:**
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "fulfilled",
    "updatedAt": "2026-01-06T01:00:00Z"
  },
  "message": "ISO marked as fulfilled"
}
```

**Error Responses:**
- `400` - ISO is not active
- `403` - Not authorized
- `404` - ISO not found

---

## ISO Status Flow

```
active → fulfilled  (user found what they wanted)
active → expired    (automatically when expires_at is reached)
active → closed     (user manually closed via update)
```

---

## Activity Feed Integration

When a public ISO is created, it automatically appears in the user's activity feed with:
- `verb`: `"post"`
- `object`: `"iso:{isoId}"`
- `type`: `"iso"`
- `title`: The ISO title

Followers will see this ISO creation in their timeline feeds.

---

## Search & Discovery

**Text Search:**
ISOs have a text index on `title` and `description` fields for full-text search capabilities.

**Filters:**
- Status (active/fulfilled/expired/closed)
- Urgency level
- Public vs. private
- Date range (createdAt, expires_at)
- User

---

## Best Practices

### For Creating ISOs
1. **Be Specific**: Include detailed criteria (brand, model, reference, condition)
2. **Set Realistic Price**: Use `max_price` to set expectations
3. **Add Urgency**: Use urgency levels to communicate timeline
4. **Use Expiration**: Set `expires_at` to automatically close old ISOs
5. **Stay Under Limit**: Max 10 active ISOs per user

### For Browsing ISOs
1. **Filter by Urgency**: Check `urgent` and `high` priority ISOs first
2. **Check Criteria**: Review detailed criteria before reaching out
3. **Verify Ownership**: Use `is_owner` field to identify your own ISOs

---

## Example Workflows

### Create and Track ISO
```bash
# 1. Create ISO
POST /api/v1/isos
{
  "title": "Seeking Omega Speedmaster Professional",
  "criteria": {
    "brand": "Omega",
    "model": "Speedmaster Professional",
    "max_price": 5000
  },
  "urgency": "high"
}

# 2. Check your ISOs
GET /api/v1/isos/my?status=active

# 3. Update if needed
PUT /api/v1/isos/{id}
{
  "max_price": 5500
}

# 4. Mark as fulfilled when found
POST /api/v1/isos/{id}/fulfill
```

### Browse and Respond
```bash
# 1. Browse public ISOs
GET /api/v1/isos?limit=20

# 2. View details
GET /api/v1/isos/{id}

# 3. Contact seller (via chat, if you have matching listing)
POST /api/v1/chat/channel
{
  "listing_id": "{your_listing_id}",
  "other_user_id": "{iso_creator_id}"
}
```
