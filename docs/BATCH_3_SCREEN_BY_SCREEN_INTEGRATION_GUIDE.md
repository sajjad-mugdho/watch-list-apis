# Batch 3 Screen-by-Screen API Integration Guide

Version: 1.0
Last Updated: April 1, 2026
Scope: Batch 3 Networks screens (Part 1, Part 2, Part 3)
Related Docs:

- docs/BATCH_3_API_PAYLOAD_RESPONSE_SPEC.md
- docs/BATCH_3_NETWORKS_FULL_GAP_ANALYSIS.md

---

## 1. Conventions

- Base URL: /api/v1
- Auth: Bearer token in production, x-test-user supported in local/dev.
- IDs: Mongo ObjectId strings.
- Response envelope pattern used by Networks endpoints:
  - data
  - requestId
  - \_metadata (optional)

---

## 2. Part 1 Screens: Listing Management and Creation

### Screen Group 1-2: Listings Feed + Overflow Actions

Brief:

- User sees inventory cards and runs quick actions: preview, activate/deactivate, delete.

APIs:

- GET /api/v1/networks/listings
- GET /api/v1/networks/listings/:id/preview
- PATCH /api/v1/networks/listings/:id/status
- DELETE /api/v1/networks/listings/:id

Request payload templates:

- GET /networks/listings (query)
  - status: draft|active|reserved|sold (optional)
  - page: number string (optional)
  - limit: number string (optional)
  - sort_by: price|created|updated|popularity|relevance (optional)
  - sort_order: asc|desc (optional)

- PATCH /networks/listings/:id/status

```json
{
  "status": "active"
}
```

Response templates:

- GET /networks/listings

```json
{
  "data": [
    {
      "_id": "<listingId>",
      "status": "active",
      "title": "<title>",
      "price": 14500,
      "offers_count": 2,
      "view_count": 44
    }
  ],
  "requestId": "<reqId>",
  "_metadata": {
    "paging": { "count": 1, "total": 1, "page": 1, "limit": 20, "pages": 1 }
  }
}
```

- PATCH /networks/listings/:id/status

```json
{
  "data": { "_id": "<listingId>", "status": "active" },
  "requestId": "<reqId>"
}
```

- DELETE /networks/listings/:id

```json
{
  "data": { "success": true },
  "requestId": "<reqId>"
}
```

### Screen Group 3-6: Watch Search + Confirm Watch

Brief:

- User searches watch catalog and confirms reference before draft listing creation.

APIs:

- GET /api/v1/watches
- POST /api/v1/networks/listings

Request payload templates:

- GET /watches (query)
  - q: string (optional)
  - limit: number string (optional)

- POST /networks/listings

```json
{
  "watch": "<watchObjectId>",
  "type": "for_sale"
}
```

Response templates:

- GET /watches

```json
{
  "data": [
    {
      "_id": "<watchId>",
      "reference": "126610LN",
      "brand": "Rolex",
      "model": "Submariner",
      "color": "Black"
    }
  ],
  "requestId": "<reqId>",
  "_metadata": { "count": 1 }
}
```

- POST /networks/listings

```json
{
  "data": {
    "_id": "<listingId>",
    "status": "draft",
    "type": "for_sale",
    "watch": "<watchObjectId>"
  },
  "requestId": "<reqId>"
}
```

### Screen 7: Listing Details Form + Publish

Brief:

- User fills listing details and publishes listing.

APIs:

- PATCH /api/v1/networks/listings/:id
- POST /api/v1/networks/listings/:id/publish

Request payload template:

- PATCH /networks/listings/:id

```json
{
  "subtitle": "Mint condition",
  "description": "Full set and warranty card",
  "price": 14500,
  "condition": "Used - Very Good",
  "contents": "Box & Papers",
  "images": ["https://.../1.jpg", "https://.../2.jpg", "https://.../3.jpg"],
  "thumbnail": "https://.../1.jpg",
  "allow_offers": true,
  "shipping": [
    { "region": "US", "shippingIncluded": false, "shippingCost": 50 },
    {
      "region": "International",
      "shippingIncluded": false,
      "shippingCost": 150
    }
  ],
  "reservation_terms": "Verified buyers only"
}
```

- POST /networks/listings/:id/publish

```json
{}
```

Response templates:

- PATCH /networks/listings/:id

```json
{
  "data": { "_id": "<listingId>", "status": "draft", "price": 14500 },
  "requestId": "<reqId>"
}
```

- POST /networks/listings/:id/publish

```json
{
  "data": { "_id": "<listingId>", "status": "active" },
  "requestId": "<reqId>"
}
```

---

## 3. Part 2 Screens: Listing Detail, Concierge, Reservation

### Screen Group: Listing Detail + Seller Trust Summary

Brief:

- User opens listing detail and seller context (profile/reviews/references).

APIs:

- GET /api/v1/networks/listings/:id
- GET /api/v1/networks/users/:id/profile
- GET /api/v1/networks/users/:id/reviews
- GET /api/v1/networks/users/:id/references

Request payload templates:

- GET /networks/users/:id/reviews (query)
  - role: buyer|seller (optional)
  - limit: number (optional)
  - offset: number (optional)

- GET /networks/users/:id/references (query)
  - role: requester|target (optional)
  - limit: number (optional)
  - offset: number (optional)

Response templates:

- GET /networks/users/:id/profile

```json
{
  "data": {
    "_id": "<userId>",
    "display_name": "<name>",
    "reputation": {
      "rating": 4.9,
      "reviewsCount": 147,
      "references": {
        "positive": 130,
        "neutral": 10,
        "negative": 2,
        "total": 142
      },
      "activeListingsCount": 8
    }
  },
  "requestId": "<reqId>"
}
```

### Screen: Concierge Service

Brief:

- User sends concierge request from listing detail.

API:

- POST /api/v1/networks/listings/:id/concierge

Request payload template:

```json
{
  "message": "Need authentication support"
}
```

Response template:

```json
{
  "data": { "_id": "<conciergeId>", "status": "pending" },
  "requestId": "<reqId>"
}
```

### Screens: Confirm Reservation + Reservation Confirmed

Brief:

- User reserves listing (buy now), then opens reservation/order detail.

APIs:

- POST /api/v1/networks/listings/:id/reserve
- GET /api/v1/networks/reservations/:id
- GET /api/v1/networks/orders/:id
- POST /api/v1/networks/orders/:id/complete

Request payload templates:

- POST /networks/listings/:id/reserve

```json
{
  "shipping_region": "US"
}
```

- POST /networks/orders/:id/complete

```json
{}
```

Response templates:

- POST /networks/listings/:id/reserve

```json
{
  "data": {
    "_id": "<orderId>",
    "listing_type": "NetworkListing",
    "status": "reserved",
    "amount": 14500,
    "reservation_terms_snapshot": "Verified buyers only"
  },
  "requestId": "<reqId>"
}
```

- GET /networks/reservations/:id (or /orders/:id)

```json
{
  "data": {
    "_id": "<orderId>",
    "status": "reserved",
    "buyer_id": "<buyerId>",
    "seller_id": "<sellerId>"
  },
  "requestId": "<reqId>"
}
```

---

## 4. Part 3 Screens: Offer Flow, Public Profile, Safety Actions

### Screen Group: Make Offer -> Review Offer -> Offer Sent

Brief:

- User sends initial offer, seller counters/accepts/rejects, channel state updates drive offer UI.

APIs:

- POST /api/v1/networks/listings/:id/offers
- GET /api/v1/networks/offers
- GET /api/v1/networks/offers/:id
- POST /api/v1/networks/offers/:id/counter
- POST /api/v1/networks/offers/:id/accept
- POST /api/v1/networks/offers/:id/reject

Request payload templates:

- POST /networks/listings/:id/offers

```json
{
  "amount": 13000,
  "shipping_region": "US",
  "request_free_shipping": false,
  "reservation_terms_snapshot": "Terms snapshot",
  "message": "Can you do 13k?"
}
```

- POST /networks/offers/:id/counter

```json
{
  "amount": 13800,
  "message": "Counter at 13.8k",
  "reservation_terms": "Counter terms"
}
```

- POST /networks/offers/:id/accept

```json
{}
```

- POST /networks/offers/:id/reject

```json
{}
```

Response templates:

- GET /networks/offers

```json
{
  "data": [
    {
      "_id": "<channelId>",
      "status": "open",
      "last_offer": {
        "amount": 13000,
        "status": "sent",
        "offer_type": "initial"
      }
    }
  ],
  "requestId": "<reqId>",
  "_metadata": { "total": 1, "limit": 10, "offset": 0 }
}
```

- GET /networks/offers/:id

```json
{
  "data": {
    "_id": "<channelId>",
    "role": "buyer",
    "last_offer": { "amount": 13000, "status": "sent" }
  },
  "requestId": "<reqId>"
}
```

### Screen Group: Public Profile Tabs (For Sale / WTB / Reference History)

Brief:

- User views another profile and switches listings tabs and trust history tabs.

APIs:

- GET /api/v1/networks/users/:id/profile
- GET /api/v1/networks/users/:id/listings
- GET /api/v1/networks/users/:id/reviews
- GET /api/v1/networks/users/:id/references

Request payload templates:

- GET /networks/users/:id/listings (query)
  - status: active|sold|all (optional)
  - type: for_sale|wtb (optional)
  - search: string (optional)
  - page: number string (optional)
  - limit: number string (optional)

Response template:

- GET /networks/users/:id/listings

```json
{
  "data": [
    {
      "_id": "<listingId>",
      "type": "for_sale",
      "status": "active",
      "title": "<title>",
      "price": 12000
    }
  ],
  "requestId": "<reqId>",
  "_metadata": {
    "paging": { "count": 1, "total": 1, "page": 1, "limit": 10, "pages": 1 }
  }
}
```

### Screen Group: Profile Overflow Actions (Connect, Report, Block)

Brief:

- User performs social and safety actions from profile overflow menu.

APIs:

- POST /api/v1/networks/users/:id/connections
- DELETE /api/v1/networks/users/:id/connections
- POST /api/v1/networks/users/:id/report
- POST /api/v1/networks/users/:id/block
- DELETE /api/v1/networks/users/:id/block

Request payload templates:

- POST /networks/users/:id/report

```json
{
  "reason": "fraud",
  "description": "Suspicious behavior"
}
```

- POST /networks/users/:id/block

```json
{
  "reason": "safety"
}
```

Response templates:

- POST /networks/users/:id/connections

```json
{
  "message": "Connection request sent",
  "connection": {
    "follower_id": "<me>",
    "following_id": "<target>",
    "status": "pending"
  }
}
```

- DELETE /networks/users/:id/connections

```json
{
  "message": "Connection removed"
}
```

- POST /networks/users/:id/report

```json
{
  "data": {
    "_id": "<reportId>",
    "target_id": "<target>",
    "target_type": "User",
    "reason": "fraud",
    "status": "pending"
  },
  "requestId": "<reqId>"
}
```

- POST /networks/users/:id/block

```json
{
  "data": { "success": true, "message": "User blocked successfully" },
  "requestId": "<reqId>"
}
```

- DELETE /networks/users/:id/block

```json
{
  "data": { "success": true, "message": "User unblocked successfully" },
  "requestId": "<reqId>"
}
```

---

## 5. Error Handling Quick Reference

Common codes in Batch 3 flows:

- 400: Validation/business rule (e.g., listing not active, invalid payload)
- 401: Unauthorized
- 403: Forbidden (e.g., non-seller reading listing offers)
- 404: Entity not found / no active offer
- 409: Conflict state (where applicable)
- 500: System error

---

## 6. Implementation Notes

- Use docs/BATCH_3_API_PAYLOAD_RESPONSE_SPEC.md for full endpoint-level contract details.
- Use this guide as the screen-level integration map for frontend wiring.
- Keep Batch 2 shared behavior intact when adding parity changes.
