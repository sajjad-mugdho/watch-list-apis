# Batch 2 API Payload Templates

All examples use mock auth via custom clerk middleware.

## Global Headers

```json
{
  "x-test-user": "user_with_networks",
  "Content-Type": "application/json"
}
```

## 1) Search and Listings

### GET /api/v1/networks/search

Request:

```json
{
  "query": {
    "type": "listing",
    "q": "rolex",
    "page": 1,
    "limit": 10,
    "sort_by": "relevance",
    "allow_offers": true,
    "year_min": 2020,
    "year_max": 2025
  }
}
```

Response 200:

```json
{
  "data": {
    "listings": [
      {
        "_id": "67f100000000000000000101",
        "brand": "Rolex",
        "model": "Submariner",
        "price": 12500,
        "allow_offers": true,
        "status": "active"
      }
    ],
    "listings_count": 1,
    "isos": [],
    "isos_count": 0,
    "users": [],
    "users_count": 0
  },
  "pagination": {
    "limit": 10,
    "page": 1,
    "offset": 0
  }
}
```

### GET /api/v1/networks/listings

Request:

```json
{
  "query": {
    "page": 1,
    "limit": 10,
    "sort_by": "popularity",
    "sort_order": "desc",
    "allow_offers": true,
    "contents": "box",
    "year_min": 2019,
    "year_max": 2025
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67f100000000000000000102",
      "brand": "Omega",
      "model": "Speedmaster",
      "price": 6200,
      "contents": "box",
      "allow_offers": true,
      "view_count": 74,
      "offers_count": 5
    }
  ],
  "requestId": "req_123",
  "_metadata": {
    "paging": {
      "count": 1,
      "total": 43,
      "page": 1,
      "limit": 10,
      "pages": 5
    },
    "filters": {
      "allow_offers": true,
      "contents": "box"
    },
    "sort": {
      "field": "popularity",
      "order": "desc"
    }
  }
}
```

### GET /api/v1/networks/search/popular-brands

Request:

```json
{}
```

Response 200:

```json
{
  "data": [
    { "brand": "Rolex", "count": 22 },
    { "brand": "Omega", "count": 16 }
  ]
}
```

### GET /api/v1/networks/user/listings

Request:

```json
{
  "query": {
    "status": "all",
    "search": "rolex",
    "page": 1,
    "limit": 20
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67f100000000000000000103",
      "brand": "Rolex",
      "model": "GMT-Master II",
      "status": "active"
    }
  ],
  "requestId": "req_124",
  "_metadata": {
    "paging": {
      "count": 1,
      "total": 8,
      "page": 1,
      "limit": 20,
      "pages": 1
    },
    "groups": {
      "draft": 1,
      "active": 4,
      "reserved": 1,
      "sold": 2
    },
    "filters": {
      "status": "all",
      "search": "rolex",
      "sort": "recent"
    }
  }
}
```

### GET /api/v1/networks/listings/:id

Request:

```json
{
  "params": {
    "id": "67f100000000000000000102"
  }
}
```

Response 200:

```json
{
  "data": {
    "_id": "67f100000000000000000102",
    "brand": "Omega",
    "model": "Speedmaster",
    "status": "active",
    "allow_offers": true
  },
  "requestId": "req_125"
}
```

### PATCH /api/v1/networks/listings/:id

Request:

```json
{
  "params": {
    "id": "67f100000000000000000104"
  },
  "body": {
    "price": 5900,
    "description": "Updated draft description",
    "allow_offers": true
  }
}
```

Response 200:

```json
{
  "data": {
    "_id": "67f100000000000000000104",
    "price": 5900,
    "description": "Updated draft description",
    "allow_offers": true,
    "status": "draft"
  },
  "requestId": "req_126"
}
```

### DELETE /api/v1/networks/listings/:id

Request:

```json
{
  "params": {
    "id": "67f100000000000000000104"
  }
}
```

Response 200:

```json
{
  "data": {
    "success": true
  },
  "requestId": "req_127"
}
```

### POST /api/v1/networks/listings/:id/offers

Request:

```json
{
  "params": {
    "id": "67f100000000000000000102"
  },
  "body": {
    "amount": 5800,
    "message": "Can close today",
    "shipping_region": "US",
    "request_free_shipping": false
  }
}
```

Response 201:

```json
{
  "data": {
    "_id": "67f200000000000000000201",
    "listing_id": "67f100000000000000000102",
    "status": "open",
    "last_offer": {
      "amount": 5800,
      "offer_type": "initial",
      "status": "sent"
    }
  },
  "requestId": "req_128"
}
```

### GET /api/v1/networks/listings/:id/offers

Request:

```json
{
  "params": {
    "id": "67f100000000000000000102"
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67f200000000000000000201",
      "listing_id": "67f100000000000000000102",
      "status": "open",
      "last_offer": {
        "amount": 5800,
        "status": "sent"
      }
    }
  ],
  "requestId": "req_129"
}
```

### POST /api/v1/networks/listings/:id/inquire

Request:

```json
{
  "params": {
    "id": "67f100000000000000000102"
  },
  "body": {
    "message": "Is service history available?"
  }
}
```

Response 201:

```json
{
  "data": {
    "channel_id": "67f200000000000000000202",
    "getstream_channel_id": "messaging:networks_abc123",
    "listing_id": "67f100000000000000000102",
    "seller_id": "67e900000000000000000901",
    "created": true,
    "reused": false
  },
  "requestId": "req_130",
  "message": "Inquiry sent and chat channel created"
}
```

### POST /api/v1/networks/listings/:id/reserve

Request:

```json
{
  "params": {
    "id": "67f100000000000000000102"
  },
  "body": {
    "shipping_region": "US",
    "note": "Please hold for wire transfer"
  }
}
```

Response 201:

```json
{
  "data": {
    "_id": "67f300000000000000000301",
    "listing_id": "67f100000000000000000102",
    "listing_type": "NetworkListing",
    "status": "reserved",
    "amount": 6200,
    "metadata": {
      "shipping_region": "US",
      "shipping_cost": 0,
      "buy_type": "direct_buy"
    }
  },
  "requestId": "req_131"
}
```

## 2) Notifications

### GET /api/v1/networks/notifications

Request:

```json
{
  "query": {
    "tab": "buying",
    "unread_only": false,
    "limit": 20,
    "offset": 0,
    "types": "offer_received,counter_offer"
  }
}
```

Response 200:

```json
{
  "platform": "networks",
  "data": [
    {
      "id": "67f400000000000000000401",
      "type": "offer_received",
      "category": "selling",
      "title": "Offer Received",
      "body": "You received an offer",
      "actionUrl": "/networks/offers/67f200000000000000000201",
      "read": false,
      "createdAt": "2026-03-27T11:22:33.000Z",
      "data": {
        "listing_id": "67f100000000000000000102",
        "amount": 5800
      }
    }
  ],
  "total": 1,
  "unread_count": 1,
  "limit": 20,
  "offset": 0
}
```

### GET /api/v1/networks/notifications/unread-count

Request:

```json
{}
```

Response 200:

```json
{
  "platform": "networks",
  "unread_count": 3
}
```

### POST /api/v1/networks/notifications/:id/read

Request:

```json
{
  "params": {
    "id": "67f400000000000000000401"
  }
}
```

Response 200:

```json
{
  "platform": "networks",
  "success": true,
  "id": "67f400000000000000000401"
}
```

### POST /api/v1/networks/notifications/mark-all-read

Request:

```json
{
  "query": {
    "tab": "buying"
  }
}
```

Response 200:

```json
{
  "platform": "networks",
  "success": true
}
```

## 3) Connections and Friend Requests

### GET /api/v1/networks/connections/my-incoming

Request:

```json
{
  "query": {
    "limit": 20,
    "offset": 0
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "id": "67f500000000000000000501",
      "requester": {
        "user_id": "67ea00000000000000000a01",
        "display_name": "Dealer One",
        "handle": "@DealerOne",
        "avatar": "https://cdn.example.com/avatar.jpg",
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

### GET /api/v1/networks/connections/my-outgoing

Request:

```json
{
  "query": {
    "limit": 20,
    "offset": 0
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67f500000000000000000502",
      "follower_id": "67e900000000000000000901",
      "following_id": "67ea00000000000000000a02",
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

### POST /api/v1/networks/connections/send-request

Request:

```json
{
  "body": {
    "target_user_id": "67ea00000000000000000a02"
  }
}
```

Response 201:

```json
{
  "data": {
    "_id": "67f500000000000000000503",
    "follower_id": "67e900000000000000000901",
    "following_id": "67ea00000000000000000a02",
    "status": "pending"
  },
  "requestId": "req_134"
}
```

### POST /api/v1/networks/connections/:id/accept

Request:

```json
{
  "params": {
    "id": "67f500000000000000000501"
  }
}
```

Response 200:

```json
{
  "data": {
    "message": "Connection request accepted"
  },
  "requestId": "req_135"
}
```

### POST /api/v1/networks/connections/:id/reject

Request:

```json
{
  "params": {
    "id": "67f500000000000000000501"
  }
}
```

Response 200:

```json
{
  "data": {
    "message": "Connection request rejected"
  },
  "requestId": "req_136"
}
```

### GET /api/v1/networks/connections

Request:

```json
{
  "query": {
    "page": 1,
    "limit": 50
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "user_id": "67ea00000000000000000a03",
      "display_name": "Collector X"
    }
  ],
  "requestId": "req_137",
  "_metadata": {
    "paging": {
      "count": 1,
      "total": 12,
      "page": 1,
      "limit": 50,
      "pages": 1
    }
  }
}
```

### DELETE /api/v1/networks/connections/:id

Request:

```json
{
  "params": {
    "id": "67ea00000000000000000a03"
  }
}
```

Response 200:

```json
{
  "data": {
    "message": "Connection removed successfully"
  },
  "requestId": "req_138"
}
```

## 4) User Features in Networks Namespace

### GET /api/v1/networks/user/profile

Request:

```json
{}
```

Response 200:

```json
{
  "data": {
    "profile": {
      "_id": "67ea00000000000000000a01",
      "first_name": "Sam",
      "last_name": "Dealer",
      "display_name": "Sam Dealer",
      "email": "sam@example.com",
      "bio": "Independent watch dealer",
      "avatar_url": "https://cdn.example.com/avatar.jpg",
      "location": {
        "city": "New York",
        "region": "NY",
        "country": "US"
      },
      "social_links": {
        "instagram": "dealer_handle",
        "twitter": "dealerx",
        "website": "https://dealer.example.com"
      },
      "joined_at": "2024-03-01T10:00:00.000Z"
    },
    "verification": {
      "status": "approved",
      "identity_verified": true,
      "verified_at": "2026-03-01T10:00:00.000Z",
      "verification_status": "SUCCEEDED"
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
    "stats": {
      "listings": {
        "all": 4,
        "draft": 2,
        "active": 1,
        "reserved": 0,
        "sold": 1,
        "inactive": 0
      },
      "offers": { "pending": 2 },
      "orders": { "active": 3 },
      "isos": { "active": 1 },
      "reference_checks": { "pending": 0 },
      "favorites": { "total": 18 },
      "support": { "open_tickets": 1 },
      "social": {
        "followers": 14,
        "following": 9
      },
      "rating": {
        "average": 4.8,
        "count": 37,
        "reference_count": 26
      },
      "verified_dealers_global": 87
    }
  },
  "requestId": "req_139"
}
```

Note:

- This is now the primary read endpoint for Networks home/profile summary composition.
- It consolidates fields previously fetched through multiple calls.

### GET /api/v1/networks/user/dashboard/stats

Note:

- Legacy compatibility endpoint. For Networks home/profile summary screens, use GET /api/v1/networks/user/profile.
- GET /api/v1/networks/user is a lightweight platform endpoint and is intentionally different from GET /api/v1/networks/user/profile.

Request:

```json
{}
```

Response 200:

```json
{
  "data": {
    "stats": {
      "listings": { "active": 4 },
      "offers": { "pending": 2 },
      "isos": { "active": 1 },
      "reference_checks": { "pending": 0 },
      "social": {
        "followers": 14,
        "following": 9
      },
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
      "rating": {
        "average": 4.8,
        "count": 37
      }
    }
  },
  "requestId": "req_139"
}
```

### GET /api/v1/networks/user/reviews

Request:

```json
{
  "query": {
    "role": "seller",
    "limit": 20,
    "offset": 0
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67f600000000000000000601",
      "rating": 5,
      "feedback": "Great seller",
      "role": "seller"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### GET /api/v1/networks/user/favorites

Request:

```json
{
  "query": {
    "type": "listing",
    "limit": 20,
    "offset": 0
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67f700000000000000000701",
      "item_type": "listing",
      "item_id": "67f100000000000000000102",
      "platform": "networks"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### POST /api/v1/networks/user/favorites

Request:

```json
{
  "body": {
    "item_type": "listing",
    "item_id": "67f100000000000000000102"
  }
}
```

Response 201:

```json
{
  "data": {
    "_id": "67f700000000000000000701",
    "item_type": "listing",
    "item_id": "67f100000000000000000102",
    "platform": "networks"
  }
}
```

### DELETE /api/v1/networks/user/favorites/:type/:id

Request:

```json
{
  "params": {
    "type": "listing",
    "id": "67f100000000000000000102"
  }
}
```

Response 200:

```json
{
  "success": true,
  "message": "Favorite removed"
}
```

### GET /api/v1/networks/user/searches/recent

Request:

```json
{}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67f800000000000000000801",
      "query": "rolex gmt",
      "context": "listing",
      "result_count": 14
    }
  ]
}
```

### POST /api/v1/networks/user/searches/recent

Request:

```json
{
  "body": {
    "query": "rolex gmt",
    "context": "listing",
    "filters": {
      "year_min": 2020,
      "allow_offers": true
    },
    "result_count": 14
  }
}
```

Response 201:

```json
{
  "data": {
    "_id": "67f800000000000000000801",
    "query": "rolex gmt",
    "context": "listing",
    "result_count": 14,
    "platform": "networks"
  }
}
```

### DELETE /api/v1/networks/user/searches/recent

Request:

```json
{}
```

Response 200:

```json
{
  "success": true,
  "message": "Recent searches cleared"
}
```

### DELETE /api/v1/networks/user/searches/recent/:id

Request:

```json
{
  "params": {
    "id": "67f800000000000000000801"
  }
}
```

Response 200:

```json
{
  "success": true,
  "message": "Search entry deleted"
}
```

### GET /api/v1/networks/user/isos/my

Request:

```json
{
  "query": {
    "status": "all"
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67f900000000000000000901",
      "brand": "Patek Philippe",
      "model": "Nautilus",
      "status": "active"
    }
  ],
  "total": 1
}
```

Notes:

- Supported status values: `all`, `active`, `fulfilled`, `expired`, `closed`.
- This endpoint currently returns a simple list envelope (`data`, `total`) instead of `_metadata.paging`.

### GET /api/v1/networks/user/feeds/timeline

Request:

```json
{
  "query": {
    "limit": 20,
    "offset": 0
  }
}
```

Response 200:

```json
{
  "activities": [
    {
      "id": "act:1",
      "verb": "listing_created",
      "actor": "67e900000000000000000901",
      "time": "2026-03-27T10:10:00.000Z"
    }
  ],
  "limit": 20,
  "offset": 0
}
```

### GET /api/v1/networks/onboarding/status

Request:

```json
{}
```

Response 200:

```json
{
  "data": {
    "status": "incomplete",
    "completed_at": null,
    "steps": {
      "location": { "confirmed": true },
      "display_name": { "confirmed": true },
      "avatar": { "confirmed": false }
    },
    "progress": {
      "is_finished": false,
      "percentage": 67,
      "steps_completed": 2,
      "total_steps": 3
    },
    "requires": ["avatar"],
    "user": {
      "user_id": "67e900000000000000000901",
      "dialist_id": "67e900000000000000000901",
      "first_name": "Sam",
      "last_name": "Dealer",
      "display_name": "Sam Dealer"
    }
  },
  "_metadata": {
    "message": "Onboarding status retrieved successfully",
    "timestamp": "2026-03-27T11:30:00.000Z"
  },
  "requestId": "req_140"
}
```

### PATCH /api/v1/networks/onboarding/complete

Request:

```json
{
  "body": {
    "location": {
      "country": "US",
      "region": "NY",
      "postal_code": "10001",
      "city": "New York",
      "line1": "123 Main St",
      "line2": null,
      "currency": "USD"
    },
    "profile": {
      "first_name": "Sam",
      "last_name": "Dealer"
    },
    "avatar": {
      "type": "monogram",
      "monogram_initials": "SD",
      "monogram_color": "#0B3D91",
      "monogram_style": "classic"
    }
  }
}
```

Response 200:

```json
{
  "data": {
    "user": {
      "id": "67e900000000000000000901",
      "first_name": "Sam",
      "last_name": "Dealer",
      "display_name": "Sam Dealer",
      "location": {
        "country": "US",
        "region": "NY",
        "postal_code": "10001",
        "city": "New York",
        "line1": "123 Main St",
        "line2": null,
        "currency": "USD"
      }
    },
    "onboarding": {
      "status": "completed",
      "completed_at": "2026-03-27T11:35:00.000Z",
      "steps": {
        "location": {
          "country": "US",
          "region": "NY",
          "postal_code": "10001",
          "city": "New York",
          "line1": "123 Main St",
          "line2": null,
          "currency": "USD"
        },
        "avatar": {
          "type": "monogram",
          "monogram_initials": "SD",
          "monogram_color": "#0B3D91",
          "monogram_style": "classic"
        },
        "payment": null
      }
    }
  },
  "_metadata": {
    "message": "Onboarding completed successfully",
    "timestamp": "2026-03-27T11:35:00.000Z"
  },
  "requestId": "req_141"
}
```

## 5) Offers, Orders, Reference Checks, Social Inbox

### GET /api/v1/networks/offers

Request:

```json
{
  "query": {
    "type": "received",
    "status": "active",
    "limit": 20,
    "offset": 0
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67f200000000000000000201",
      "status": "open",
      "last_offer": {
        "amount": 5800,
        "status": "sent"
      }
    }
  ],
  "requestId": "req_142",
  "_metadata": {
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

### GET /api/v1/networks/offers/:id

Request:

```json
{
  "params": {
    "id": "67f200000000000000000201"
  }
}
```

Response 200:

```json
{
  "data": {
    "_id": "67f200000000000000000201",
    "listing_id": "67f100000000000000000102",
    "status": "open",
    "role": "seller"
  },
  "requestId": "req_143"
}
```

### POST /api/v1/networks/offers/:id/accept

Request:

```json
{
  "params": {
    "id": "67f200000000000000000201"
  }
}
```

Response 200:

```json
{
  "data": {
    "_id": "67f200000000000000000201",
    "status": "open",
    "order_id": "67f300000000000000000301"
  },
  "requestId": "req_144"
}
```

### POST /api/v1/networks/offers/:id/reject

Request:

```json
{
  "params": {
    "id": "67f200000000000000000201"
  }
}
```

Response 200:

```json
{
  "data": {
    "_id": "67f200000000000000000201",
    "status": "open",
    "last_offer": {
      "status": "declined"
    }
  },
  "requestId": "req_145"
}
```

### POST /api/v1/networks/offers/:id/counter

Request:

```json
{
  "params": {
    "id": "67f200000000000000000201"
  },
  "body": {
    "amount": 6000,
    "note": "Meet in the middle"
  }
}
```

Response 201:

```json
{
  "data": {
    "_id": "67f200000000000000000201",
    "last_offer": {
      "amount": 6000,
      "offer_type": "counter",
      "status": "sent"
    }
  },
  "requestId": "req_146"
}
```

### GET /api/v1/networks/orders

Request:

```json
{
  "query": {
    "type": "buy",
    "status": "reserved",
    "limit": 20,
    "offset": 0
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67f300000000000000000301",
      "status": "reserved",
      "amount": 6200,
      "buyer_id": "67e900000000000000000901",
      "seller_id": "67ea00000000000000000a01"
    }
  ],
  "_metadata": {
    "total": 1,
    "limit": 20,
    "offset": 0
  },
  "requestId": "req_147"
}
```

### GET /api/v1/networks/orders/:id

Request:

```json
{
  "params": {
    "id": "67f300000000000000000301"
  }
}
```

Response 200:

```json
{
  "data": {
    "_id": "67f300000000000000000301",
    "listing_type": "NetworkListing",
    "status": "reserved",
    "amount": 6200
  },
  "requestId": "req_148"
}
```

### POST /api/v1/networks/orders/:id/complete

Request:

```json
{
  "params": {
    "id": "67f300000000000000000301"
  }
}
```

Response 200:

```json
{
  "data": {
    "order": {
      "_id": "67f300000000000000000301",
      "status": "reserved"
    },
    "buyer_confirmed": true,
    "seller_confirmed": false,
    "completed": false
  },
  "requestId": "req_149"
}
```

### GET /api/v1/networks/reference-checks

Request:

```json
{
  "query": {
    "type": "requested"
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67fa000000000000000a001",
      "type": "requested",
      "requester_id": "67e900000000000000000901",
      "target_id": "67ea00000000000000000a01",
      "status": "pending",
      "created_at": "2026-03-27T09:15:00.000Z"
    }
  ],
  "requestId": "req_150",
  "_metadata": {
    "total": 1
  }
}
```

Notes:

- Query `type` is commonly one of: `requested`, `pending`, `about-me`.
- Card-level display fields (for example requester display info) may require companion user/profile fetches depending on screen design.

### GET /api/v1/networks/social/inbox

Request:

```json
{
  "query": {
    "filter": "inquiries",
    "limit": 20,
    "offset": 0
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "id": "messaging:networks_abc123",
      "type": "personal",
      "name": "Rolex GMT-Master II",
      "lastMessage": "Is service history available?",
      "lastMessageType": "inquiry",
      "unreadCount": 1,
      "metadata": {
        "listing_id": "67f100000000000000000102",
        "group_id": null,
        "is_reference_check": false
      }
    }
  ],
  "requestId": "req_151",
  "_metadata": {
    "paging": {
      "count": 1,
      "total": 1,
      "page": 1,
      "limit": 20
    }
  }
}
```

## 6) Other User Public APIs in Networks Namespace

### GET /api/v1/networks/users/:id/profile

Request:

```json
{
  "params": {
    "id": "67ea00000000000000000a01"
  }
}
```

Response 200:

```json
{
  "data": {
    "_id": "67ea00000000000000000a01",
    "display_name": "Dealer One",
    "avatar": "https://cdn.example.com/avatar.jpg",
    "bio": "Collector and dealer",
    "location": {
      "country": "US",
      "region": "CA"
    },
    "reputation": {
      "rating": 4.9,
      "reviewsCount": 32,
      "references": {
        "positive": 24,
        "neutral": 2,
        "negative": 0,
        "total": 26
      },
      "activeListingsCount": 12
    }
  },
  "requestId": "req_152"
}
```

### GET /api/v1/networks/users/:id/listings

Request:

```json
{
  "params": {
    "id": "67ea00000000000000000a01"
  },
  "query": {
    "status": "active",
    "page": 1,
    "limit": 20
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67f100000000000000000105",
      "brand": "Audemars Piguet",
      "status": "active"
    }
  ],
  "requestId": "req_153",
  "_metadata": {
    "paging": {
      "count": 1,
      "total": 7,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

### GET /api/v1/networks/users/:id/reviews

Request:

```json
{
  "params": {
    "id": "67ea00000000000000000a01"
  },
  "query": {
    "role": "seller",
    "limit": 20,
    "offset": 0
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67f600000000000000000602",
      "rating": 5,
      "feedback": "Smooth transaction"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### GET /api/v1/networks/users/:id/review-summary

Request:

```json
{
  "params": {
    "id": "67ea00000000000000000a01"
  }
}
```

Response 200:

```json
{
  "data": {
    "total": 32,
    "average": 4.9,
    "breakdown": {
      "1": 0,
      "2": 0,
      "3": 1,
      "4": 3,
      "5": 28
    }
  }
}
```

### GET /api/v1/networks/users/:id/connection-status

Request:

```json
{
  "params": {
    "id": "67ea00000000000000000a01"
  }
}
```

Response 200:

```json
{
  "is_connected_to": true,
  "is_connected_by": true,
  "outgoing_status": "accepted",
  "incoming_status": "accepted"
}
```

## 7) Cross Domain Dependencies

### GET /api/v1/user/profile

Note:

- Legacy compatibility endpoint. For Networks home/profile summary screens, use GET /api/v1/networks/user/profile.
- GET /api/v1/networks/user is a lightweight platform endpoint and is intentionally different from GET /api/v1/networks/user/profile.

Request:

```json
{}
```

Response 200:

```json
{
  "data": {
    "bio": "Independent watch dealer",
    "social_links": {
      "instagram": "dealer_handle",
      "twitter": "dealerx",
      "website": "https://dealer.example.com"
    },
    "stats": {
      "follower_count": 14,
      "following_count": 9,
      "avg_rating": 4.8,
      "rating_count": 37,
      "reference_count": 26
    },
    "display_name": "Sam Dealer",
    "avatar": "https://cdn.example.com/avatar.jpg",
    "deactivated_at": null,
    "isActive": true,
    "full_name": "Sam Dealer"
  }
}
```

### PATCH /api/v1/user/profile

Request:

```json
{
  "body": {
    "first_name": "Sam",
    "last_name": "Dealer",
    "display_name": "Sam Dealer",
    "bio": "Independent watch dealer",
    "social_links": {
      "instagram": "dealer_handle",
      "twitter": "dealerx",
      "website": "https://dealer.example.com"
    }
  }
}
```

Response 200:

```json
{
  "data": {
    "first_name": "Sam",
    "last_name": "Dealer",
    "full_name": "Sam Dealer",
    "display_name": "Sam Dealer",
    "bio": "Independent watch dealer",
    "social_links": {
      "instagram": "dealer_handle",
      "twitter": "dealerx",
      "website": "https://dealer.example.com"
    }
  }
}
```

### GET /api/v1/user/verification

Request:

```json
{}
```

Response 200:

```json
{
  "data": {
    "status": "approved",
    "identityVerified": true,
    "verifiedAt": "2026-03-01T10:00:00.000Z"
  }
}
```

### POST /api/v1/user/avatar

Request (multipart simplified):

```json
{
  "body": {
    "avatar": "<binary-file>"
  }
}
```

Response 200:

```json
{
  "data": {
    "avatar_url": "https://cdn.example.com/avatar-new.jpg",
    "metadata": {
      "url": "https://cdn.example.com/avatar-new.jpg",
      "contentType": "image/jpeg",
      "size": 183204
    }
  }
}
```

### PATCH /api/v1/user/deactivate

Request:

```json
{
  "body": {
    "active": false
  }
}
```

Response 200:

```json
{
  "data": {
    "active": false,
    "deactivated_at": "2026-03-27T11:40:00.000Z"
  }
}
```

### DELETE /api/v1/user

Request:

```json
{}
```

Response 200:

```json
{
  "success": true,
  "message": "Your account has been deleted and anonymized."
}
```

### GET /api/v1/user/support/tickets/count/open

Request:

```json
{}
```

Response 200:

```json
{
  "data": {
    "count": 2
  }
}
```

### GET /api/v1/user/support/tickets

Request:

```json
{
  "query": {
    "status": "open",
    "limit": 20,
    "offset": 0
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67fb000000000000000b001",
      "subject": "Payment settlement question",
      "status": "open",
      "category": "payment"
    }
  ],
  "requestId": "req_15200",
  "_metadata": {
    "paging": {
      "count": 1,
      "total": 2,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    },
    "filters": {
      "status": "open"
    }
  }
}
```

### GET /api/v1/news

Request:

```json
{
  "query": {
    "limit": 10
  }
}
```

Response 200:

```json
{
  "data": [
    {
      "_id": "67fc000000000000000c001",
      "title": "Geneva Week Highlights",
      "status": "published",
      "is_active": true
    }
  ],
  "requestId": "req_15300"
}
```

## Notes

- IDs, timestamps, and numeric values are examples.
- For mock mode, always include x-test-user.
- For routes that rely on attachUser, ensure a DB user exists with external_id matching mock user id.
