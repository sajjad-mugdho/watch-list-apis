# Batch 2 APIs — End-to-End Testing & Integration Guide

**Version:** 1.0  
**Date:** 2026-03-28  
**Status:** Production Ready ✅  
**Scope:** 32 Comprehensive Batch 2 Network Endpoints  
**Audience:** Frontend Engineers, Integration Teams, QA

---

## Table of Contents

1. [Global Rules & Setup](#global-rules--setup)
2. [Category 1: Home Dashboard](#category-1-home-dashboard)
3. [Category 2: Profile & Account](#category-2-profile--account)
4. [Category 3: Listings & Search](#category-3-listings--search)
5. [Category 4: Offers & Orders](#category-4-offers--orders)
6. [Category 5: Connections & Social](#category-5-connections--social)
7. [Category 6: Notifications](#category-6-notifications)
8. [Category 7: User Features](#category-7-user-features)
9. [Category 8: Other User Profiles](#category-8-other-user-profiles)
10. [Pagination & Query Families](#pagination--query-families)
11. [Error Handling & Scenarios](#error-handling--scenarios)
12. [Canonical Keys & Parameter Mapping](#canonical-keys--parameter-mapping)
13. [Frontend Working Rules](#frontend-working-rules)
14. [Edge Cases & Advanced Patterns](#edge-cases--advanced-patterns)
15. [Summary Reference](#summary-reference)

---

## Global Rules & Setup

### Base Configuration

```http
Base URL:                  /api/v1
Authorization:             Bearer <JWT_TOKEN>
Content-Type:              application/json
Timeout:                   30 seconds
Retry Max Attempts:        3 with exponential backoff
```

### Authentication Flow

```
1. Frontend obtains JWT from Clerk auth provider
2. All requests include: Authorization: Bearer <token>
3. Backend validates token and extracts user context
4. Invalid/expired token → 401 Unauthorized
5. Frontend response: Redirect to sign-in flow
```

### Response Envelope Patterns

| Pattern | Shape                                                    | Usage               | Example Endpoints                   |
| ------- | -------------------------------------------------------- | ------------------- | ----------------------------------- |
| **A**   | `{ data, requestId }`                                    | Most GET endpoints  | User profile, listings detail, news |
| **B**   | `{ data, _metadata, requestId }`                         | Paginated endpoints | Search, offers, orders, favorites   |
| **C**   | `{ success, message }`                                   | Quick actions       | Mark as read, deactivate            |
| **D**   | `{ platform, data, total, unread_count, limit, offset }` | Notifications only  | GET /notifications, mark-all-read   |

### Error Envelope

```json
{
  "error": {
    "code": "ERROR_CODE_CONSTANT",
    "message": "Human-readable explanation.",
    "fields": { "field_name": "Specific field error" },
    "status": 400
  }
}
```

**Note:** `fields` present on `400` only

### Pagination Contract

**Family 1: Page-Based (page + limit)**

- Endpoints: `/networks/user/listings`, `/networks/search`, `/networks/listings`, `/networks/connections`
- Request: `GET /api/v1/networks/listings?page=2&limit=20`
- Response metadata: `{ page, limit, total, pages }`

**Family 2: Offset-Based (limit + offset)**

- Endpoints: `/networks/offers`, `/networks/orders`, `/networks/user/favorites`, `/networks/user/isos/my`, `/networks/user/reviews`, `/networks/notifications`, `/networks/social/inbox`
- Request: `GET /api/v1/networks/offers?limit=20&offset=40`
- Response metadata: `{ limit, offset, total, hasMore }`

---

## Category 1: Home Dashboard

### GET /networks/user/dashboard/stats

**Purpose:** Aggregated user stats, onboarding progress, and verification status for home page

**Response Pattern:** A

**Request:**

```bash
curl -X GET http://localhost:5050/api/v1/networks/user/dashboard/stats \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": {
    "stats": {
      "listings": { "active": 4, "draft": 2, "sold": 1 },
      "offers": { "pending": 2, "accepted": 1 },
      "isos": { "active": 1 },
      "reference_checks": { "pending": 0 },
      "social": { "followers": 14, "following": 9 },
      "verified_dealers_global": 87
    },
    "onboarding": {
      "completed_count": 4,
      "total_count": 5,
      "percentage": 80,
      "items": [
        { "id": "display_name", "completed": true },
        { "id": "avatar", "completed": true },
        { "id": "location", "completed": true },
        { "id": "first_listing", "completed": true },
        { "id": "first_iso", "completed": false }
      ]
    },
    "user": {
      "verification_status": "SUCCEEDED",
      "rating": { "average": 4.8, "count": 37 }
    }
  },
  "requestId": "req_139"
}
```

**Error Scenarios:**

401 Unauthorized:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token.",
    "status": 401
  }
}
```

→ Frontend: Redirect to sign-in

500 Server Error:

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to retrieve dashboard stats.",
    "status": 500
  }
}
```

→ Frontend: Show cached state or skeleton loaders

**Edge Cases:**

- No listings yet: `listings: { active: 0, draft: 0 }`
- Pending onboarding: `percentage < 100`
- Unverified user: `verification_status: "PENDING"`

**Frontend Working Rules:**

1. Cache stats for 30-60 seconds; poll on app focus
2. Show skeleton loaders during load
3. After any mutation (listing create, offer accept), re-fetch immediately
4. If 500, use last successful response as fallback

---

### GET /networks/notifications/unread-count

**Purpose:** Get current unread notification count for badge

**Response Pattern:** D

**Request:**

```bash
curl -X GET http://localhost:5050/api/v1/networks/notifications/unread-count \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "platform": "networks",
  "unread_count": 5
}
```

**Error Scenarios:**

401 Unauthorized
500 Server Error

**Edge Cases:**

- No unread notifications: `unread_count: 0` → Hide badge

**Frontend Working Rules:**

1. Fetch independently from notifications list
2. Re-fetch after every notification read mutation
3. Update badge count immediately in UI

---

## Category 2: Profile & Account

### GET /user/profile

**Purpose:** Current user's full public profile

**Response Pattern:** A

**Request:**

```bash
curl -X GET http://localhost:5050/api/v1/user/profile \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": {
    "_id": "usr_abc123",
    "first_name": "Mugdho",
    "last_name": "Hossain",
    "display_name": "mugdho_h",
    "email": "mugdho@example.com",
    "bio": "Passionate sneaker collector based in Dhaka.",
    "avatar_url": "https://cdn.dialist.app/avatars/usr_abc123.jpg",
    "location": {
      "city": "Dhaka",
      "country": "BD"
    },
    "social_links": {
      "instagram": "https://instagram.com/mugdho_h",
      "website": "https://mugdho.dev"
    },
    "created_at": "2024-08-01T00:00:00.000Z",
    "updated_at": "2026-03-27T14:00:00.000Z"
  }
}
```

**Error Scenarios:**

401 Unauthorized
404 Not Found

**Edge Cases:**

- No avatar: `avatar_url: null` → Show default avatar
- No bio: `bio: ""` → Show placeholder "Add a bio"
- Incomplete location: `location: { country: "US" }` → Pre-fill form with partial data

**Frontend Working Rules:**

1. Use in profile edit modal for pre-population
2. Cache in local state during session
3. Show avatar fallback if null

---

### PATCH /user/profile

**Purpose:** Update user's profile information

**Response Pattern:** A

**Request:**

```bash
curl -X PATCH http://localhost:5050/api/v1/user/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Mugdho",
    "last_name": "Hossain",
    "display_name": "mugdho_h",
    "bio": "Updated bio",
    "location": { "city": "Dhaka", "country": "BD" },
    "social_links": {
      "instagram": "https://instagram.com/mugdho_h"
    }
  }'
```

**Success Response (200):**

```json
{
  "data": {
    "_id": "usr_abc123",
    "first_name": "Mugdho",
    "display_name": "mugdho_h",
    "bio": "Updated bio",
    "updated_at": "2026-03-27T14:00:00.000Z"
  }
}
```

**Error Scenarios:**

400 Validation Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid field values.",
    "fields": { "display_name": "Display name already taken" },
    "status": 400
  }
}
```

→ Frontend: Show field-specific error messages

401 Unauthorized
500 Server Error

**Edge Cases:**

- Duplicate display_name: 400 validation error
- All optional fields: No changes → 200 success with unchanged data

**Frontend Working Rules:**

1. Validate required fields on client before submit
2. Show field errors from `error.fields`
3. Optimistic update with rollback on error
4. After success, refresh GET /user/profile

---

### GET /user/verification

**Purpose:** Check verification status and badges

**Response Pattern:** A

**Request:**

```bash
curl -X GET http://localhost:5050/api/v1/user/verification \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200) — Verified:**

```json
{
  "data": {
    "is_verified": true,
    "verification_level": "identity",
    "verified_at": "2024-09-10T12:00:00.000Z",
    "badges": ["email_confirmed", "id_verified", "phone_verified"]
  }
}
```

**Success Response (200) — Unverified:**

```json
{
  "data": {
    "is_verified": false,
    "verification_level": null,
    "verified_at": null,
    "badges": ["email_confirmed"]
  }
}
```

**Error Scenarios:**

401 Unauthorized
500 Server Error

**Edge Cases:**

- Unverified but email confirmed: Show "Complete verification to unlock" banner
- No badges: `badges: []` → Show verification CTA

**Frontend Working Rules:**

1. DO NOT throw error on unverified — render fallback state
2. Show badge icons per badge type
3. Render verification banner if not verified but has some badges
4. Hide verification UI for fully verified users

---

### GET /user/support/tickets/count/open

**Purpose:** Count open support tickets for badge

**Response Pattern:** A

**Request:**

```bash
curl -X GET http://localhost:5050/api/v1/user/support/tickets/count/open \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": { "count": 1 }
}
```

**Error Scenarios:**

401 Unauthorized
500 Server Error

**Edge Cases:**

- No open tickets: `count: 0` → Hide badge

**Frontend Working Rules:**

1. Use count for badge on Support menu
2. Show "All caught up!" message if count is 0

---

## Category 3: Listings & Search

### GET /networks/user/listings?status=all&search=&page=1&limit=20

**Purpose:** User's personal listings (For Sale tab)

**Response Pattern:** B | Pagination:\*\* Page-based

**Query Parameters:**

| Param    | Type   | Required | Values                                                             |
| -------- | ------ | -------- | ------------------------------------------------------------------ |
| `status` | string | No       | `all` \| `draft` \| `active` \| `reserved` \| `sold` \| `inactive` |
| `search` | string | No       | Free text search                                                   |
| `page`   | number | Yes      | 1+                                                                 |
| `limit`  | number | Yes      | 1-100                                                              |

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/user/listings?status=all&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    {
      "_id": "lst_abc",
      "title": "Jordan 1 Chicago",
      "status": "active",
      "price": 8200,
      "currency": "USD",
      "condition": "used_like_new",
      "category": "sneakers",
      "thumbnail_url": "https://cdn.dialist.app/listings/lst_abc_thumb.jpg",
      "created_at": "2026-01-15T00:00:00.000Z"
    }
  ],
  "_metadata": {
    "paging": {
      "total": 4,
      "page": 1,
      "limit": 20,
      "pages": 1
    },
    "groups": {
      "all": 4,
      "draft": 2,
      "active": 1,
      "reserved": 0,
      "sold": 1,
      "inactive": 0
    }
  }
}
```

**Error Scenarios:**

400 Bad Request:

```json
{
  "error": {
    "code": "INVALID_QUERY_PARAMS",
    "message": "Invalid status value.",
    "status": 400
  }
}
```

401 Unauthorized
500 Server Error

**Edge Cases:**

- No listings: `data: []` with `total: 0`
- First page load: `page: 1`
- Last page: No additional pages

**Frontend Working Rules:**

1. Use `_metadata.groups` to power status filter chip counts
2. Show count badge per tab (draft: 2, active: 1, etc.)
3. Support search filtering in addition to status
4. Maintain independent pagination per screen

---

### GET /networks/listings?page=1&limit=20

**Purpose:** Marketplace listings grid/list

**Response Pattern:** B | Pagination:\*\* Page-based

**Query Parameters:**

| Param          | Type    | Required | Values                                                           |
| -------------- | ------- | -------- | ---------------------------------------------------------------- |
| `page`         | number  | Yes      | 1+                                                               |
| `limit`        | number  | Yes      | 1-100                                                            |
| `sort_by`      | string  | No       | `relevance` \| `popularity` \| `price` \| `created` \| `updated` |
| `sort_order`   | string  | No       | `asc` \| `desc`                                                  |
| `allow_offers` | boolean | No       | true \| false                                                    |
| `year_min`     | number  | No       | Min year filter                                                  |
| `year_max`     | number  | No       | Max year filter                                                  |

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/listings?page=1&limit=20&sort_by=popularity&sort_order=desc" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    {
      "_id": "lst_abc",
      "title": "Jordan 1 Chicago",
      "price": 8200,
      "currency": "USD",
      "condition": "used_like_new",
      "thumbnail_url": "https://cdn.dialist.app/listings/lst_abc_thumb.jpg",
      "view_count": 74,
      "offers_count": 5
    }
  ],
  "requestId": "req_124",
  "_metadata": {
    "paging": {
      "count": 1,
      "total": 43,
      "page": 1,
      "limit": 20,
      "pages": 3
    },
    "sort": { "field": "popularity", "order": "desc" }
  }
}
```

**Error Scenarios:**

400 Bad Request
401 Unauthorized
500 Server Error

**Edge Cases:**

- No results: `data: []` with `total: 0`
- Multi-page: Calculate `hasMorePages = (page < pages)`

**Frontend Working Rules:**

1. Always send canonical keys: `sort_by` and `sort_order` (NOT `sort` alias)
2. For deep-links, normalize incoming params before dispatch
3. Use consistent pagination adapter for page-based family

---

### GET /networks/search?type=listing&q=jordan&page=1&limit=10

**Purpose:** Unified search across listings, ISOs, users

**Response Pattern:** B | Pagination:\*\* Page-based

**Query Parameters:**

| Param        | Type   | Required | Values                                                           |
| ------------ | ------ | -------- | ---------------------------------------------------------------- |
| `type`       | string | Yes      | `listing` \| `iso` \| `user`                                     |
| `q`          | string | Yes      | Search query                                                     |
| `page`       | number | Yes      | 1+                                                               |
| `limit`      | number | Yes      | 1-100                                                            |
| `sort_by`    | string | No       | `relevance` \| `popularity` \| `price` \| `created` \| `updated` |
| `sort_order` | string | No       | `asc` \| `desc`                                                  |

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/search?type=listing&q=jordan&page=1&limit=10&sort_by=relevance" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": {
    "listings": [
      {
        "_id": "lst_abc",
        "title": "Jordan 1 Chicago",
        "price": 8200,
        "currency": "USD",
        "condition": "used_like_new",
        "thumbnail_url": "https://cdn.dialist.app/listings/lst_abc_thumb.jpg"
      }
    ],
    "listings_count": 1,
    "isos": [],
    "isos_count": 0,
    "users": [],
    "users_count": 0
  },
  "pagination": { "limit": 10, "page": 1, "offset": 0 }
}
```

**Error Scenarios:**

400 Bad Request: Missing required params
401 Unauthorized
500 Server Error

**Edge Cases:**

- Empty results: All counts at 0, empty arrays
- Mixed results: Some listings, some ISOs, no users

**Frontend Working Rules:**

1. Always send canonical `sort_by` and `sort_order`
2. Support type switching (listing → ISO → user) with query preservation
3. Reset pagination to page 1 when query or type changes

---

### GET /networks/search/popular-brands

**Purpose:** Popular brands for search landing chips

**Response Pattern:** A | Non-paginated

**Request:**

```bash
curl -X GET http://localhost:5050/api/v1/networks/search/popular-brands \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    { "_id": "brand_001", "name": "Nike", "slug": "nike", "count": 22 },
    { "_id": "brand_002", "name": "Adidas", "slug": "adidas", "count": 16 }
  ]
}
```

**Error Scenarios:**

401 Unauthorized
500 Server Error

**Edge Cases:**

- Empty list: Show fallback popular brand chips

**Frontend Working Rules:**

1. Cache for entire session
2. Display as clickable chips on search landing
3. Prefetch on app startup

---

### GET /networks/listings/:id

**Purpose:** Listing detail page

**Response Pattern:** A | Non-paginated

**Path Parameters:**

| Param | Type   | Required         |
| ----- | ------ | ---------------- |
| `id`  | string | Yes (listing ID) |

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/listings/lst_abc" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": {
    "_id": "lst_abc",
    "title": "Jordan 1 Chicago",
    "description": "DS pair, original box, purchased 2024.",
    "status": "active",
    "price": 8200,
    "currency": "USD",
    "condition": "used_like_new",
    "size": "US 10",
    "brand": "Nike",
    "category": "sneakers",
    "shipping": {
      "offers_free_shipping": false,
      "ships_to": ["US", "CA"]
    },
    "images": ["https://cdn.dialist.app/listings/lst_abc_1.jpg"],
    "seller": {
      "_id": "usr_abc123",
      "display_name": "mugdho_h",
      "avatar_url": "https://...",
      "rating": { "average": 4.8, "count": 37 }
    },
    "view_count": 74,
    "offers_count": 5,
    "created_at": "2026-01-15T00:00:00.000Z"
  }
}
```

**Error Scenarios:**

401 Unauthorized
404 Not Found: Listing doesn't exist or deleted
500 Server Error

**Edge Cases:**

- `offers_free_shipping: false` → Show "Does not include free shipping"
- `ships_to` limited → Show geographic restriction
- Multiple images → Render gallery

**Frontend Working Rules:**

1. Show all images in gallery/carousel
2. Display seller profile card with rating
3. Show shipping restrictions prominently
4. Enable offer flow if `status: active`

---

### GET /networks/listings/:id/offers

**Purpose:** All offers for a specific listing (seller view)

**Response Pattern:** A | Non-paginated

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/listings/lst_abc/offers" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    {
      "_id": "offer_010",
      "buyer": { "_id": "usr_buyer01", "display_name": "sneaker_guy" },
      "amount": 7800,
      "status": "active",
      "created_at": "2026-03-27T12:00:00.000Z"
    }
  ]
}
```

**Error Scenarios:**

401 Unauthorized
404 Not Found: Listing not found
500 Server Error

**Edge Cases:**

- No offers: `data: []`

**Frontend Working Rules:**

1. Show offers in reverse chronological order
2. Show buyer avatars and display names
3. Enable counter-offer flow

---

## Category 4: Offers & Orders

### GET /networks/offers?type=received&limit=20&offset=0

**Purpose:** Buyer's received offers or seller's sent offers

**Response Pattern:** B | Pagination:\*\* Offset-based

**Query Parameters:**

| Param    | Type   | Required | Values                                                           |
| -------- | ------ | -------- | ---------------------------------------------------------------- |
| `type`   | string | Yes      | `received` \| `sent`                                             |
| `status` | string | No       | `active` \| `expired` \| `countered` \| `accepted` \| `rejected` |
| `limit`  | number | Yes      | 1-100                                                            |
| `offset` | number | Yes      | 0+                                                               |

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/offers?type=received&status=active&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    {
      "_id": "offer_001",
      "listing_id": "lst_xyz",
      "listing_title": "Nike Dunk Low Panda",
      "buyer": { "_id": "usr_buyer01", "display_name": "sneaker_guy" },
      "amount": 5500,
      "currency": "USD",
      "status": "active",
      "created_at": "2026-03-20T08:00:00.000Z"
    }
  ],
  "_metadata": {
    "paging": {
      "total": 15,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

**Error Scenarios:**

400 Bad Request: Invalid type or status
401 Unauthorized
500 Server Error

**Edge Cases:**

- No offers: `data: []` with `total: 0`
- Last page: `hasMore: false`

**Frontend Working Rules:**

1. Use offset-based pagination adapter: `nextOffset = offset + limit`
2. Check `hasMore` to show "Load more" button
3. Reset offset to 0 when switching type/status tabs

---

### GET /networks/offers/:id

**Purpose:** Specific offer details with history

**Response Pattern:** A

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/offers/offer_010" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": {
    "_id": "offer_010",
    "listing_id": "lst_abc",
    "listing_title": "Jordan 1 Chicago",
    "buyer": { "_id": "usr_buyer01", "display_name": "sneaker_guy" },
    "seller": { "_id": "usr_abc123", "display_name": "mugdho_h" },
    "amount": 7800,
    "currency": "USD",
    "status": "active",
    "history": [
      {
        "actor": "buyer",
        "action": "offer",
        "amount": 7800,
        "note": "Would you take $7,800 shipped?",
        "at": "2026-03-27T12:00:00.000Z"
      }
    ],
    "channel_id": "ch_020",
    "created_at": "2026-03-27T12:00:00.000Z"
  }
}
```

**Error Scenarios:**

401 Unauthorized
404 Not Found
500 Server Error

**Edge Cases:**

- Single offer (no counters): `history` has 1 entry
- Multiple counters: Show full negotiation thread

**Frontend Working Rules:**

1. Render offer history as timeline
2. Show current status prominently
3. Enable counter/accept/reject actions based on status

---

### GET /networks/orders?type=buy&limit=20&offset=0

**Purpose:** User's buy or sell orders

**Response Pattern:** B | Pagination:\*\* Offset-based

**Query Parameters:**

| Param    | Type   | Required | Values                                             |
| -------- | ------ | -------- | -------------------------------------------------- |
| `type`   | string | Yes      | `buy` \| `sell`                                    |
| `status` | string | No       | `reserved` \| `paid` \| `completed` \| `cancelled` |
| `limit`  | number | Yes      | 1-100                                              |
| `offset` | number | Yes      | 0+                                                 |

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/orders?type=buy&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    {
      "_id": "ord_001",
      "listing_id": "lst_abc",
      "listing_title": "Jordan 1 Chicago",
      "buyer": { "_id": "usr_buyer01", "display_name": "sneaker_guy" },
      "seller": { "_id": "usr_seller01", "display_name": "kicks_vault" },
      "amount": 8200,
      "currency": "USD",
      "status": "reserved",
      "created_at": "2026-03-22T10:00:00.000Z"
    }
  ],
  "_metadata": {
    "paging": {
      "total": 3,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

**Error Scenarios:**

400 Bad Request
401 Unauthorized
500 Server Error

**Edge Cases:**

- No orders: `data: []`

**Frontend Working Rules:**

1. Use offset-based pagination
2. Show type (buy vs sell) in UI headers
3. Highlight unconfirmed orders pending dual-confirmation

---

### GET /networks/orders/:id

**Purpose:** Order detail with confirmation state

**Response Pattern:** A

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/orders/ord_010" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": {
    "_id": "ord_010",
    "listing_id": "lst_abc",
    "listing_title": "Jordan 1 Chicago",
    "buyer": { "_id": "usr_buyer01", "display_name": "sneaker_guy" },
    "seller": { "_id": "usr_abc123", "display_name": "mugdho_h" },
    "amount": 8000,
    "currency": "USD",
    "status": "reserved",
    "buyer_confirmed": false,
    "seller_confirmed": false,
    "completed": false,
    "shipping_region": "US",
    "created_at": "2026-03-27T13:10:00.000Z"
  }
}
```

**Error Scenarios:**

401 Unauthorized
404 Not Found
500 Server Error

**Edge Cases:**

- Dual-confirmation flow: Show progress (0/2, 1/2, 2/2)
- Completed order: `completed: true`, show completion timestamp

**Frontend Working Rules:**

1. Always trust `completed` flag from server (not local state)
2. Show which party has confirmed (buyer vs seller)
3. Disable submit button if already confirmed by current user

---

## Category 5: Connections & Social

### GET /networks/connections?page=1&limit=50

**Purpose:** User's accepted connections list

**Response Pattern:** B | Pagination:\*\* Page-based

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/connections?page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    {
      "_id": "conn_001",
      "user": {
        "_id": "usr_buyer01",
        "display_name": "sneaker_guy",
        "avatar_url": "https://cdn.dialist.app/avatars/usr_buyer01.jpg"
      },
      "status": "accepted",
      "connected_at": "2026-03-27T14:05:00.000Z"
    }
  ],
  "_metadata": { "paging": { "total": 1, "page": 1, "limit": 50 } }
}
```

**Error Scenarios:**

401 Unauthorized
500 Server Error

**Edge Cases:**

- No connections: `data: []` with `total: 0`

**Frontend Working Rules:**

1. Show connected user cards with avatar
2. Enable disconnect action per user

---

### GET /networks/connections/my-incoming?limit=20&offset=0

**Purpose:** Incoming connection requests

**Response Pattern:** B | Pagination:\*\* Offset-based

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/connections/my-incoming?limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "conn_req_001",
      "requester": {
        "user_id": "usr_buyer01",
        "display_name": "sneaker_guy",
        "avatar": "https://cdn.dialist.app/avatars/usr_buyer01.jpg",
        "bio": "Collector and dealer",
        "mutual_friends_count": 4
      },
      "status": "pending",
      "created_at": "2026-03-27T10:00:00.000Z"
    }
  ],
  "_metadata": {
    "paging": {
      "count": 1,
      "total": 1,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  },
  "requestId": "req_132"
}
```

**Error Scenarios:**

401 Unauthorized
500 Server Error

**Edge Cases:**

- No requests: `data: []`

**Frontend Working Rules:**

1. Show accept/reject buttons
2. Display mutual friends count
3. Use offset-based pagination

---

### GET /networks/connections/my-outgoing?limit=20&offset=0

**Purpose:** Outgoing connection requests sent by user

**Response Pattern:** B | Pagination:\*\* Offset-based

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/connections/my-outgoing?limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    {
      "_id": "conn_req_002",
      "follower_id": "usr_abc123",
      "following_id": "usr_buyer01",
      "status": "pending"
    }
  ],
  "_metadata": {
    "paging": {
      "count": 1,
      "total": 1,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  },
  "requestId": "req_133"
}
```

**Error Scenarios:**

401 Unauthorized
500 Server Error

**Edge Cases:**

- No outgoing requests: `data: []`

**Frontend Working Rules:**

1. Show "Request sent" state
2. Enable cancel request action

---

### POST /networks/connections/send-request

**Purpose:** Send connection request to another user

**Response Pattern:** A

**Request:**

```bash
curl -X POST "http://localhost:5050/api/v1/networks/connections/send-request" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "target_user_id": "usr_seller01" }'
```

**Success Response (201):**

```json
{
  "data": {
    "connection_id": "conn_001",
    "status": "pending",
    "created_at": "2026-03-27T14:00:00.000Z"
  }
}
```

**Error Scenarios:**

400 Bad Request: Missing target_user_id
401 Unauthorized
409 Conflict: Already connected or request pending

```json
{
  "error": {
    "code": "CONNECTION_EXISTS",
    "message": "Connection already exists.",
    "status": 409
  }
}
```

→ Frontend: On 409, re-sync connection status

500 Server Error

**Edge Cases:**

- Self-connect attempt: 400 validation error
- Already connected: 409 conflict

**Frontend Working Rules:**

1. Lock button during request
2. On 409, fetch latest connection status
3. Update CTA text to "Request sent"

---

### GET /networks/social/inbox?filter=inquiries&limit=20&offset=0

**Purpose:** Messages/inquiries/offers inbox

**Response Pattern:** B | Pagination:\*\* Offset-based

**Query Parameters:**

| Param    | Type   | Required | Values                                                             |
| -------- | ------ | -------- | ------------------------------------------------------------------ |
| `filter` | string | No       | `all` \| `unread` \| `offers` \| `inquiries` \| `reference_checks` |
| `limit`  | number | Yes      | 1-100                                                              |
| `offset` | number | Yes      | 0+                                                                 |

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/social/inbox?filter=all&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    {
      "_id": "ch_001",
      "type": "inquiry",
      "listing_id": "lst_xyz",
      "participant": {
        "_id": "usr_buyer01",
        "display_name": "sneaker_guy",
        "avatar_url": "https://cdn.dialist.app/avatars/usr_buyer01.jpg"
      },
      "last_message": "Is this still available?",
      "unread_count": 2,
      "updated_at": "2026-03-25T09:00:00.000Z"
    }
  ],
  "_metadata": {
    "paging": {
      "total": 8,
      "limit": 20,
      "offset": 0
    }
  }
}
```

**Error Scenarios:**

401 Unauthorized
500 Server Error

**Edge Cases:**

- No messages: `data: []`
- Unread filter: Show only messages with `unread_count > 0`

**Frontend Working Rules:**

1. Use offset-based pagination
2. Show unread count badge
3. Sort by most recent first
4. Filter by type (inquiries, offers, reference checks)

---

## Category 6: Notifications

### GET /networks/notifications?tab=all&limit=20&offset=0

**Purpose:** User's notifications feed

**Response Pattern:** D | Pagination:\*\* Offset-based

**Query Parameters:**

| Param    | Type   | Required | Values                                                 |
| -------- | ------ | -------- | ------------------------------------------------------ |
| `tab`    | string | No       | `all` \| `buying` \| `selling` \| `social` \| `system` |
| `limit`  | number | Yes      | 1-100                                                  |
| `offset` | number | Yes      | 0+                                                     |

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/notifications?tab=all&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "platform": "networks",
  "data": [
    {
      "id": "notif_001",
      "type": "offer_received",
      "category": "selling",
      "title": "New offer on Jordan 1 Chicago",
      "body": "sneaker_guy made an offer of $7,800.",
      "read": false,
      "action_url": "/offers/offer_010",
      "created_at": "2026-03-27T12:00:00.000Z"
    },
    {
      "id": "notif_002",
      "type": "connection_request",
      "category": "social",
      "title": "kicks_vault wants to connect",
      "body": null,
      "read": true,
      "action_url": "/connections/conn_001",
      "created_at": "2026-03-26T09:00:00.000Z"
    }
  ],
  "total": 14,
  "unread_count": 5,
  "limit": 20,
  "offset": 0
}
```

**Error Scenarios:**

400 Bad Request: Invalid tab
401 Unauthorized
500 Server Error

**Edge Cases:**

- `action_url: null` → Mark as read on tap, stay in list
- `body: null` → Show only title

**Frontend Working Rules:**

1. Use Pattern D envelope (platform field)
2. Update badge with `unread_count`
3. Reset offset to 0 when switching tabs
4. Separate action behavior: if action_url present, navigate; else mark read

---

### POST /networks/notifications/mark-all-read?tab=buying

**Purpose:** Mark all notifications in a tab as read

**Response Pattern:** C

**Query Parameters:**

| Param | Type   | Required                   |
| ----- | ------ | -------------------------- |
| `tab` | string | No (omit to mark all tabs) |

**Request:**

```bash
curl -X POST "http://localhost:5050/api/v1/networks/notifications/mark-all-read?tab=all" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "platform": "networks",
  "success": true
}
```

**Error Scenarios:**

401 Unauthorized
500 Server Error

**Edge Cases:**

- No tab specified: Mark entire notifications feed as read
- Already all read: Still 200 success

**Frontend Working Rules:**

1. Fire after user views notifications list
2. Update badge count to 0
3. Mark all visible notifications as read locally
4. Re-fetch unread count after success

---

## Category 7: User Features

### GET /networks/user/isos/my?status=all&limit=20&offset=0

**Purpose:** User's Want-to-Buy items (ISOs — "In Search Of")

**Response Pattern:** B | Pagination:\*\* Offset-based

**Query Parameters:**

| Param    | Type   | Required | Values                           |
| -------- | ------ | -------- | -------------------------------- |
| `status` | string | No       | `all` \| `active` \| `fulfilled` |
| `limit`  | number | Yes      | 1-100                            |
| `offset` | number | Yes      | 0+                               |

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/user/isos/my?status=all&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    {
      "_id": "iso_001",
      "status": "active",
      "criteria": {
        "brand": "Nike",
        "model": "Air Max 90",
        "size": "US 9",
        "condition": "any",
        "max_price": 3000,
        "currency": "USD"
      },
      "note": "Looking for clean pairs only, no yellowing.",
      "created_at": "2026-02-10T00:00:00.000Z"
    }
  ],
  "_metadata": {
    "paging": { "total": 1, "limit": 20, "offset": 0 }
  }
}
```

**Error Scenarios:**

401 Unauthorized
500 Server Error

**Edge Cases:**

- No ISOs: `data: []`

**Frontend Working Rules:**

1. Keep per-tab offsets independent
2. Reset to offset 0 when switching status tabs
3. Show search criteria prominently

---

### GET /networks/user/reviews?role=seller&limit=20&offset=0

**Purpose:** Reviews of current user

**Response Pattern:** B | Pagination:\*\* Offset-based

**Query Parameters:**

| Param    | Type   | Required | Values                       |
| -------- | ------ | -------- | ---------------------------- |
| `role`   | string | No       | `all` \| `buyer` \| `seller` |
| `limit`  | number | Yes      | 1-100                        |
| `offset` | number | Yes      | 0+                           |

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/user/reviews?role=seller&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    {
      "_id": "rev_001",
      "role": "seller",
      "rating": 5,
      "comment": "Shipped fast, exactly as described. A+ seller.",
      "reviewer": {
        "_id": "usr_buyer01",
        "display_name": "sneaker_guy",
        "avatar_url": "https://cdn.dialist.app/avatars/usr_buyer01.jpg"
      },
      "order_id": "ord_001",
      "created_at": "2026-01-28T00:00:00.000Z"
    }
  ],
  "total": 8,
  "limit": 20,
  "offset": 0
}
```

**Error Scenarios:**

401 Unauthorized
500 Server Error

**Edge Cases:**

- `reviewer.avatar_url: null` → Show fallback avatar
- No reviews: `data: []`

**Frontend Working Rules:**

1. Maintain separate offset per role tab
2. Show rating stars prominently
3. Link to reviewer profile

---

### GET /networks/user/favorites?type=listing&limit=20&offset=0

**Purpose:** User's saved favorites

**Response Pattern:** B | Pagination:\*\* Offset-based

**Query Parameters:**

| Param    | Type   | Required | Values                       |
| -------- | ------ | -------- | ---------------------------- |
| `type`   | string | Yes      | `listing` \| `iso` \| `user` |
| `limit`  | number | Yes      | 1-100                        |
| `offset` | number | Yes      | 0+                           |

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/user/favorites?type=listing&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    {
      "_id": "fav_001",
      "item_type": "listing",
      "item_id": "lst_abc",
      "listing": {
        "_id": "lst_abc",
        "title": "Jordan 1 Chicago",
        "price": 8200,
        "thumbnail_url": "https://cdn.dialist.app/listings/lst_abc_thumb.jpg",
        "status": "active"
      },
      "saved_at": "2026-03-10T08:00:00.000Z"
    }
  ],
  "_metadata": {
    "paging": { "total": 5, "limit": 20, "offset": 0 }
  }
}
```

**Error Scenarios:**

401 Unauthorized
500 Server Error

**Edge Cases:**

- No favorites: `data: []`

**Frontend Working Rules:**

1. Hydrate `Set<string>` of `item_id` for O(1) card icon checks
2. Use offset-based pagination
3. Show heart icon when item is favorited

---

### POST /networks/user/favorites

**Purpose:** Add item to favorites

**Response Pattern:** A

**Request:**

```bash
curl -X POST "http://localhost:5050/api/v1/networks/user/favorites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "item_type": "listing", "item_id": "lst_abc" }'
```

**Success Response (201):**

```json
{
  "data": {
    "_id": "fav_002",
    "item_type": "listing",
    "item_id": "lst_abc",
    "saved_at": "2026-03-27T11:30:00.000Z"
  }
}
```

**Error Scenarios:**

400 Validation Error: Missing required fields
401 Unauthorized
409 Conflict: Already favorited
500 Server Error

**Edge Cases:**

- Duplicate favorite: 409 conflict
- Invalid item_id: 400 validation error

**Frontend Working Rules:**

1. Optimistic update: Toggle heart icon immediately
2. On 500, rollback optimistic change
3. One mutation per item_id at a time (lock icon)

---

### GET /networks/user/searches/recent

**Purpose:** User's recent searches

**Response Pattern:** A | Non-paginated

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/user/searches/recent" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": [
    {
      "_id": "srch_001",
      "query": "Jordan 1",
      "context": "listing",
      "filters": {
        "year_min": 2020,
        "sort_by": "price",
        "sort_order": "asc"
      },
      "result_count": 42,
      "searched_at": "2026-03-25T10:00:00.000Z"
    }
  ]
}
```

**Error Scenarios:**

401 Unauthorized
500 Server Error

**Edge Cases:**

- No searches: `data: []`

**Frontend Working Rules:**

1. Show as clickable chips on search landing
2. Enable delete per search
3. Click chip to restore search + filters

---

### POST /networks/user/searches/recent

**Purpose:** Save a search to history

**Response Pattern:** A

**Request:**

```bash
curl -X POST "http://localhost:5050/api/v1/networks/user/searches/recent" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Air Force 1",
    "context": "listing",
    "filters": { "year_min": 2022, "sort_by": "price", "sort_order": "asc" },
    "result_count": 27
  }'
```

**Success Response (201):**

```json
{
  "data": {
    "_id": "srch_003",
    "query": "Air Force 1",
    "context": "listing",
    "searched_at": "2026-03-27T11:00:00.000Z"
  }
}
```

**Error Scenarios:**

400 Bad Request
401 Unauthorized
500 Server Error

**Edge Cases:**

- Duplicate search: May create duplicate entry or deduplicate automatically

**Frontend Working Rules:**

1. Fire asynchronously — do NOT block navigation
2. Use background task/queue
3. No need to wait for 201 before routing away

---

## Category 8: Other User Profiles

### GET /networks/users/:id/profile

**Purpose:** View another user's public profile

**Response Pattern:** A

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/users/usr_seller01/profile" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": {
    "_id": "usr_seller01",
    "display_name": "kicks_vault",
    "bio": "Premium sneaker dealer. 500+ trades.",
    "avatar_url": "https://cdn.dialist.app/avatars/usr_seller01.jpg",
    "member_since": "2023-05-01T00:00:00.000Z",
    "location": { "city": "New York", "country": "US" },
    "stats": { "total_sold": 58, "average_rating": 4.98, "total_reviews": 54 }
  }
}
```

**Error Scenarios:**

401 Unauthorized
404 Not Found
500 Server Error

**Edge Cases:**

- `avatar_url: null` → Show fallback avatar
- Private user: May return 404 or limited data

**Frontend Working Rules:**

1. Show stats overview (sold count, average rating)
2. Enable connection request from profile
3. Link to listings, reviews, etc.

---

### GET /networks/users/:id/reviews?role=seller&limit=20&offset=0

**Purpose:** View another user's reviews

**Response Pattern:** B | Pagination:\*\* Offset-based

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/users/usr_seller01/reviews?role=seller&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**
Same structure as GET /networks/user/reviews

**Error Scenarios:**

401 Unauthorized
404 Not Found: User doesn't exist
500 Server Error

**Edge Cases:**

- No reviews: `data: []`

**Frontend Working Rules:**

1. Use offset-based pagination
2. Show role filter (buyer vs seller reviews)

---

### GET /networks/users/:id/review-summary

**Purpose:** User's review statistics summary

**Response Pattern:** A

**Request:**

```bash
curl -X GET "http://localhost:5050/api/v1/networks/users/usr_seller01/review-summary" \
  -H "Authorization: Bearer $TOKEN"
```

**Success Response (200):**

```json
{
  "data": {
    "user_id": "usr_seller01",
    "total_reviews": 8,
    "average_rating": 4.9,
    "breakdown": {
      "5": 7,
      "4": 1,
      "3": 0,
      "2": 0,
      "1": 0
    },
    "as_seller": { "count": 6, "average": 5.0 },
    "as_buyer": { "count": 2, "average": 4.5 }
  }
}
```

**Error Scenarios:**

401 Unauthorized
404 Not Found
500 Server Error

**Edge Cases:**

- No reviews: All counts 0, average null

**Frontend Working Rules:**

1. Show as card with rating breakdown chart
2. Highlight as_seller and as_buyer separately

---

## Pagination & Query Families

### Page-Based Pagination Pattern

**Endpoints:** `/networks/user/listings`, `/networks/search`, `/networks/listings`, `/networks/connections`

**Request Format:**

```bash
GET /networks/listings?page=2&limit=20
```

**Response Metadata:**

```json
{
  "_metadata": {
    "paging": {
      "page": 2,
      "limit": 20,
      "total": 150,
      "pages": 8,
      "count": 20
    }
  }
}
```

**Frontend Adapter:**

```javascript
const calculatePageBased = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    currentPage: page,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    nextPage: page + 1,
    previousPage: page - 1,
  };
};

// Usage in component
const nextPage = currentPage + 1;
if (nextPage <= _metadata.paging.pages) {
  fetchListings({ page: nextPage, limit });
}
```

### Offset-Based Pagination Pattern

**Endpoints:** `/networks/offers`, `/networks/orders`, `/networks/user/favorites`, `/networks/user/isos/my`, `/networks/user/reviews`, `/networks/notifications`, `/networks/social/inbox`

**Request Format:**

```bash
GET /networks/offers?limit=20&offset=40
```

**Response Metadata:**

```json
{
  "_metadata": {
    "paging": {
      "limit": 20,
      "offset": 40,
      "total": 150,
      "hasMore": true
    }
  }
}
```

**Frontend Adapter:**

```javascript
const calculateOffsetBased = (offset, limit, total) => {
  const nextOffset = offset + limit;
  const hasMore = nextOffset < total;

  return {
    currentOffset: offset,
    nextOffset,
    hasMore,
    itemsLoaded: offset + limit,
    totalItems: total,
  };
};

// Usage in component
if (_metadata.paging.hasMore) {
  const nextOffset = currentOffset + limit;
  fetchOffers({ limit, offset: nextOffset });
}
```

### Tab-Switching & State Reset

```javascript
// Keep pagination state independent per tab
const screens = {
  allListings: { page: 1, limit: 20 },
  myListings: { page: 1, limit: 20 },
  draftListings: { page: 1, limit: 20 },
  offers: { offset: 0, limit: 20 },
  orders: { offset: 0, limit: 20 },
};

const switchTab = (tabName) => {
  // Reset to first page/offset
  screens[tabName].page = 1;
  screens[tabName].offset = 0;
};
```

---

## Error Handling & Scenarios

### Global Error Envelope

```json
{
  "error": {
    "code": "ERROR_CODE_CONSTANT",
    "message": "Human-readable explanation.",
    "fields": { "field_name": "Specific field error" },
    "status": 400
  }
}
```

### Status Code Mapping

| Code    | Meaning                | Frontend Action                | Example                             |
| ------- | ---------------------- | ------------------------------ | ----------------------------------- |
| **200** | Success                | Render/update UI               | GET profile, PATCH listing          |
| **201** | Created                | Store entity + navigate        | POST favorite, POST search          |
| **400** | Validation/rule error  | Show field errors or toast     | Invalid filter, duplicate entry     |
| **401** | Unauthenticated        | Redirect to sign-in            | Invalid/expired JWT                 |
| **403** | Forbidden              | Show permission denied state   | Edit someone else's listing         |
| **404** | Not found              | Show empty state or remove row | Listing deleted, user removed       |
| **409** | Conflict (state drift) | Re-fetch and reconcile         | Already connected, listing reserved |
| **500** | Server error           | Keep prior state, show retry   | Database failure, service error     |

### Retry Strategy with Exponential Backoff

```javascript
const retryWithBackoff = async (
  fn,
  maxRetries = 3,
  baseDelayMs = 1000,
  statusCodesToRetry = [408, 429, 500, 502, 503, 504],
) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const shouldRetry =
        statusCodesToRetry.includes(error.status) && attempt < maxRetries - 1;

      if (shouldRetry) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1} after ${delayMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
};

// Usage
try {
  await retryWithBackoff(() => fetchListings());
} catch (error) {
  showErrorMessage("Failed to load listings. Please try again.");
  // Keep UI in previous state
}
```

### 409 Conflict Reconciliation

```javascript
// On 409, re-sync latest state from server
const handleConflict = async (resourceId, resourceType) => {
  try {
    // Re-fetch latest state
    const latest = await fetchLatest(resourceId, resourceType);

    // Update UI to match server truth
    updateUI(latest);

    // Show info message
    showMessage("The item was updated. Refreshed to latest version.");
  } catch (refetchError) {
    showErrorMessage("Conflict detected. Please refresh the page.");
  }
};

// Usage
if (error.status === 409) {
  await handleConflict(listingId, "listing");
}
```

---

## Canonical Keys & Parameter Mapping

### Filter Key Reference

| Send This    | NOT This                | Endpoints                                | Type        |
| ------------ | ----------------------- | ---------------------------------------- | ----------- |
| `year_min`   | `min_year`              | `/networks/search`, `/networks/listings` | Query param |
| `year_max`   | `max_year`              | `/networks/search`, `/networks/listings` | Query param |
| `sort_by`    | `sort`                  | `/networks/search`, `/networks/listings` | Query param |
| `sort_order` | Encoded in `sort` value | `/networks/search`, `/networks/listings` | Query param |

### Correct vs Incorrect Request Examples

**❌ INCORRECT (Never send from UI):**

```javascript
// Do not send legacy aliases
fetch(
  "/api/v1/networks/search?type=listing&min_year=2020&max_year=2024&sort=mostPopular",
);

// Do not mix families
fetch("/api/v1/networks/listings?page=1&limit=20&offset=40");
```

**✅ CORRECT (Always from UI):**

```javascript
// Send canonical keys
fetch(
  "/api/v1/networks/search?type=listing&year_min=2020&year_max=2024&sort_by=popularity&sort_order=desc",
);

// Consistent family per endpoint
fetch("/api/v1/networks/listings?page=1&limit=20");
fetch("/api/v1/networks/offers?limit=20&offset=0");
```

### Deep-Link Parameter Normalization

```javascript
// When receiving deep-link params, normalize before dispatch
const normalizeDeepLinkParams = (incomingParams) => {
  const normalized = { ...incomingParams };

  // Map legacy keys to canonical
  if (incomingParams.min_year) {
    normalized.year_min = incomingParams.min_year;
    delete normalized.min_year;
  }
  if (incomingParams.max_year) {
    normalized.year_max = incomingParams.max_year;
    delete normalized.max_year;
  }

  // Handle sort encoding
  if (incomingParams.sort === "mostPopular") {
    normalized.sort_by = "popularity";
    normalized.sort_order = "desc";
    delete normalized.sort;
  }

  return normalized;
};

// Usage
const deepLinkParams = parseURL(location.search);
const canonical = normalizeDeepLinkParams(deepLinkParams);
fetchSearch(canonical);
```

---

## Frontend Working Rules

### Rule 1: Always Send Canonical Keys from UI

```javascript
// ✅ Correct: Frontend sends canonical keys
const searchParams = {
  type: "listing",
  q: userQuery,
  sort_by: selectedSort, // NOT "sort"
  sort_order: sortDirection, // NOT encoded in sort value
  year_min: minYear, // NOT "min_year"
  year_max: maxYear, // NOT "max_year"
  page: 1,
  limit: 20,
};

// ❌ Wrong: These should never come from UI code
// sort: 'mostPopular'
// min_year: 2020
// max_year: 2024
```

---

### Rule 2: Treat 409 Conflict as Re-Sync Trigger

```javascript
// On any 409, re-fetch latest state immediately
const addFavorite = async (listingId) => {
  try {
    (await POST) / networks / user / favorites;
    updateFavoritesSet(listingId);
  } catch (error) {
    if (error.status === 409) {
      // Conflict: re-fetch latest favorites
      const latest = (await GET) / networks / user / favorites;
      updateFavoritesSet(latest);
    }
  }
};
```

---

### Rule 3: Use Shared Pagination Adapter

```javascript
class PaginationAdapter {
  static pageFamily = [
    "/networks/user/listings",
    "/networks/search",
    "/networks/listings",
    "/networks/connections",
  ];

  static offsetFamily = [
    "/networks/offers",
    "/networks/orders",
    "/networks/user/favorites",
    "/networks/notifications",
  ];

  static detect(endpoint) {
    return this.pageFamily.includes(endpoint) ? "page" : "offset";
  }

  static getNextParams(endpoint, current, metadata) {
    const family = this.detect(endpoint);

    if (family === "page") {
      const nextPage = current.page + 1;
      return {
        ...current,
        page: nextPage,
        canFetch: nextPage <= metadata.paging.pages,
      };
    } else {
      const nextOffset = current.offset + current.limit;
      return {
        ...current,
        offset: nextOffset,
        canFetch: metadata.paging.hasMore,
      };
    }
  }
}
```

---

### Rule 4: Keep Independent Route State Per Screen

```javascript
// Each screen maintains its own pagination state
const usePaginationState = (screenName) => {
  const [state, setState] = useState(() => {
    const familyType = PaginationAdapter.detect(screenName);

    return familyType === "page"
      ? { page: 1, limit: 20 }
      : { offset: 0, limit: 20 };
  });

  const reset = () => {
    setState(
      familyType === "page" ? { page: 1, limit: 20 } : { offset: 0, limit: 20 },
    );
  };

  return [state, setState, reset];
};

// Usage
const [listingState, setListingState, resetListingState] =
  usePaginationState("listings");
const [offerState, setOfferState, resetOfferState] =
  usePaginationState("offers");

// On tab switch
const switchTab = (newTab) => {
  resetListingState(); // Reset to top
};
```

---

### Rule 5: Refresh Unread Count After Mutations

```javascript
// After any notification read action, re-fetch count
const markNotificationAsRead = async (notifId) => {
  await POST /networks/notifications/:id/read;

  // Immediately refresh unread count
  const { unread_count } = await GET /networks/notifications/unread-count;
  updateNotificationBadge(unread_count);
};

const markAllAsRead = async (tab) => {
  await POST /networks/notifications/mark-all-read?tab=${tab};

  // Refresh count
  const { unread_count } = await GET /networks/notifications/unread-count;
  updateNotificationBadge(unread_count);
};
```

---

### Rule 6: Favorites Set<string> Optimization

```javascript
class FavoritesCache {
  constructor() {
    this.set = new Set();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    // Fetch all favorites (paginate if needed)
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response =
        await GET`/networks/user/favorites?limit=200&offset=${offset}`;
      response.data.forEach((fav) => this.set.add(fav.item_id));

      hasMore =
        response._metadata.paging.offset + response._metadata.paging.limit <
        response._metadata.paging.total;
      offset += 200;
    }

    this.initialized = true;
  }

  // O(1) check
  isFavored(itemId) {
    return this.set.has(itemId);
  }

  add(itemId) {
    this.set.add(itemId);
  }

  remove(itemId) {
    this.set.delete(itemId);
  }
}

// Usage in component
const isFavored = favoritesCache.isFavored(listingId); // O(1)
```

---

### Rule 7: Trust Latest Server Response for Orders

```javascript
// Always trust the server's 'completed' flag
const confirmOrder = async (orderId) => {
  try {
    const response = await POST /networks/orders/:id/complete;

    // Use server's truth
    setOrderCompleted(response.data.completed);
    setOrderState({
      buyer_confirmed: response.data.buyer_confirmed,
      seller_confirmed: response.data.seller_confirmed,
      completed: response.data.completed  // ← Trust this
    });

    // DO NOT use:
    // setOrderCompleted(true); // ❌ Wrong
  } catch (error) {
    if (error.status === 409) {
      // Re-fetch latest
      const latest = await GET /networks/orders/:id;
      setOrderState(latest);
    }
  }
};
```

---

### Rule 8: Lock Icon During Mutations (Prevent Double-Submit)

```javascript
const FavoriteButton = ({ listingId, initialFavored }) => {
  const [isFavored, setIsFavored] = useState(initialFavored);
  const [isLoading, setIsLoading] = useState(false);

  const toggleFavorite = async () => {
    if (isLoading) return; // Prevent double-click

    setIsLoading(true);
    const wasFavored = isFavored;

    try {
      // Optimistic update
      setIsFavored(!isFavored);

      if (wasFavored) {
        await DELETE /networks/user/favorites/listing/:id;
      } else {
        await POST /networks/user/favorites;
      }
    } catch (error) {
      // Rollback on error
      setIsFavored(wasFavored);
      showErrorMessage("Failed to update favorite");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={toggleFavorite}
      disabled={isLoading}
    >
      {isLoading ? <Spinner /> : <HeartIcon filled={isFavored} />}
    </button>
  );
};
```

---

## Edge Cases & Advanced Patterns

### Edge Case: Empty Paginated List

```json
{
  "data": [],
  "_metadata": {
    "paging": {
      "total": 0,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

**Frontend Handling:**

```javascript
if (response.data.length === 0 && response._metadata.paging.total === 0) {
  showEmptyState({
    title: "No listings yet",
    cta: {
      label: "Create your first listing",
      action: () => navigate("/create"),
    },
  });
}
```

---

### Edge Case: Null/Missing Optional Fields

**Profile with null avatar:**

```json
{
  "avatar_url": null,
  "bio": "",
  "social_links": {}
}
```

**Frontend Handling:**

```javascript
<UserCard
  avatar={profile.avatar_url || DEFAULT_AVATAR}
  bio={profile.bio || "Add a bio"}
  hasInstagram={!!profile.social_links?.instagram}
/>
```

---

### Edge Case: Notification with Null action_url

```json
{
  "id": "notif_003",
  "type": "reference_check_requested",
  "title": "Someone requested a reference check",
  "body": null,
  "action_url": null,
  "read": false
}
```

**Frontend Logic:**

```javascript
const handleNotificationTap = (notification) => {
  if (notification.action_url) {
    navigate(notification.action_url);
  } else {
    // Mark as read, stay in list
    markAsRead(notification.id);
  }
};
```

---

### Advanced Pattern: Offer Negotiation Flow

```
Step 1: Buyer views listing
  └─ GET /networks/listings/:id (check status)

Step 2: Buyer makes offer
  └─ POST /networks/listings/:id/offers
  └─ Response: channel_id + offer_id
  └─ Navigate to offer detail

Step 3: Seller views offers
  └─ GET /networks/listings/:id/offers
  └─ GET /networks/offers/:id (view full negotiation)

Step 4: Seller counters offer
  └─ POST /networks/offers/:id/counter
  └─ Update offer status to "countered"
  └─ Notify buyer

Step 5: Buyer accepts counter
  └─ POST /networks/offers/:id/accept
  └─ Response: order_id created
  └─ Navigate to order detail

Step 6: Dual confirmation
  └─ POST /networks/orders/:id/complete (buyer)
  └─ POST /networks/orders/:id/complete (seller)
  └─ After both: completed: true
```

---

### Advanced Pattern: Listing Lifecycle

```
Status Flow:
  draft
    ├─ Can PATCH (edit)
    ├─ Can DELETE
    └─ Can POST (publish to active)
       └─ active
          ├─ Cannot PATCH (forbidden)
          ├─ Cannot DELETE (blocked)
          ├─ Can accept offers
          ├─ Can inquiries
          ├─ Can reserve
          └─ When reserved: status → reserved
             └─ Can POST complete (dual confirm)
                └─ When completed: status → sold
                   └─ Cannot edit, cannot delete

  draft ─REJECT─> Can DELETE
  active ─OFFER ACCEPTED─> reserved
  active ─DIRECT RESERVE─> reserved
  reserved ─DUAL CONFIRM─> completed (sold)
```

---

## Summary Reference

### All 32 Endpoints

| #   | Category       | Endpoint                              | Method | Pattern | Pagination |
| --- | -------------- | ------------------------------------- | ------ | ------- | ---------- |
| 1   | Dashboard      | /networks/user/dashboard/stats        | GET    | A       | —          |
| 2   | Dashboard      | /networks/notifications/unread-count  | GET    | D       | —          |
| 3   | Profile        | /user/profile                         | GET    | A       | —          |
| 4   | Profile        | /user/profile                         | PATCH  | A       | —          |
| 5   | Profile        | /user/verification                    | GET    | A       | —          |
| 6   | Profile        | /user/support/tickets/count/open      | GET    | A       | —          |
| 7   | Listings       | /networks/user/listings               | GET    | B       | Page       |
| 8   | Listings       | /networks/listings                    | GET    | B       | Page       |
| 9   | Listings       | /networks/search                      | GET    | B       | Page       |
| 10  | Listings       | /networks/search/popular-brands       | GET    | A       | —          |
| 11  | Listings       | /networks/listings/:id                | GET    | A       | —          |
| 12  | Listings       | /networks/listings/:id/offers         | GET    | A       | —          |
| 13  | Offers/Orders  | /networks/offers                      | GET    | B       | Offset     |
| 14  | Offers/Orders  | /networks/offers/:id                  | GET    | A       | —          |
| 15  | Offers/Orders  | /networks/orders                      | GET    | B       | Offset     |
| 16  | Offers/Orders  | /networks/orders/:id                  | GET    | A       | —          |
| 17  | Connections    | /networks/connections                 | GET    | B       | Page       |
| 18  | Connections    | /networks/connections/my-incoming     | GET    | B       | Offset     |
| 19  | Connections    | /networks/connections/my-outgoing     | GET    | B       | Offset     |
| 20  | Connections    | /networks/connections/send-request    | POST   | A       | —          |
| 21  | Connections    | /networks/social/inbox                | GET    | B       | Offset     |
| 22  | Notifications  | /networks/notifications               | GET    | D       | Offset     |
| 23  | Notifications  | /networks/notifications/mark-all-read | POST   | C       | —          |
| 24  | User Features  | /networks/user/isos/my                | GET    | B       | Offset     |
| 25  | User Features  | /networks/user/reviews                | GET    | B       | Offset     |
| 26  | User Features  | /networks/user/favorites              | GET    | B       | Offset     |
| 27  | User Features  | /networks/user/favorites              | POST   | A       | —          |
| 28  | User Features  | /networks/user/searches/recent        | GET    | A       | —          |
| 29  | User Features  | /networks/user/searches/recent        | POST   | A       | —          |
| 30  | Other Profiles | /networks/users/:id/profile           | GET    | A       | —          |
| 31  | Other Profiles | /networks/users/:id/reviews           | GET    | B       | Offset     |
| 32  | Other Profiles | /networks/users/:id/review-summary    | GET    | A       | —          |

---

### Status Code Quick Reference

| Code | When          | Action               |
| ---- | ------------- | -------------------- |
| 200  | Success       | Render data          |
| 201  | Created       | Store + navigate     |
| 400  | Invalid input | Show field errors    |
| 401  | No auth       | Redirect sign-in     |
| 403  | Forbidden     | Show denied state    |
| 404  | Not found     | Empty state          |
| 409  | Conflict      | Re-fetch & reconcile |
| 500  | Server error  | Retry + fallback     |

---

### Deployment Verification Checklist

- [x] All 32 endpoints documented with full specs
- [x] Response patterns (A, B, C, D) labeled per endpoint
- [x] Error scenarios documented (401/400/403/404/409/500)
- [x] Edge cases for each endpoint covered
- [x] Pagination families (page-based vs offset-based) explained
- [x] Canonical keys reference complete
- [x] 8 Frontend working rules with code examples
- [x] Advanced patterns (offer flow, listings lifecycle)
- [x] Retry strategy with exponential backoff example
- [x] Deep-link normalization pattern included
- [x] All 32 endpoints ready for production

---

**Status: ✅ PRODUCTION READY**

_Generated: 2026-03-28 · Framework: Batch 2 Comprehensive API Guide · All 32 Endpoints · Full Specs · Production Integration Ready_
