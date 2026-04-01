# Batch 3 Networks API Payload and Response Spec

Date: April 1, 2026
Status: Implemented contract snapshot for Batch 3 cross-check
Scope: Networks APIs used by Batch 3 Part 1, Part 2, and Part 3 screens

## Conventions

- Base path: /api/v1/networks
- Auth: bearer token required for all endpoints listed here
- Object IDs: 24-char MongoDB ObjectId strings
- Response envelope pattern:
  - data: primary payload
  - requestId: request correlation id
  - \_metadata: optional paging/summary object
- Exception: connection mutation endpoints intentionally return lightweight legacy payloads ({ message, connection } or { message }) and do not include requestId/data wrapper.

## Part 1: Listings Creation and Management

### 1) GET /listings

Query:

- q: string optional
- brand: string optional
- category: enum optional
- condition: enum optional
- contents: string optional
- year_min: number-string optional
- year_max: number-string optional
- min_price: number-string optional
- max_price: number-string optional
- allow_offers: true|false optional
- sort_by: price|created|updated|popularity|relevance optional
- sort_order: asc|desc optional
- page: number-string optional
- limit: number-string optional

Response 200:

- data: INetworkListing[]
- \_metadata:
  - paging: { count, total, page, limit, pages }
  - filters: { ... }
  - sort: { field, order }

### 2) POST /listings

Payload:

- watch: string (ObjectId) required
- type: for_sale|wtb optional (default for_sale)
- year_range: { min?, max? } optional
- price_range: { min?, max? } optional
- acceptable_conditions: condition[] optional
- wtb_description: string optional

Response 201:

- data: created draft listing

### 3) PATCH /listings/:id

Payload (all optional, strict schema):

- subtitle: string
- description: string
- price: number
- condition: New|Used - Very Good|Used - Good|Used - Fair|Used - Damaged
- allow_offers: boolean
- year: number
- contents: Box & Papers|Box Only|Papers Only|Watch Only
- images: string[] (urls)
- thumbnail: string (url)
- shipping: [
  {
  region: US|CA|International,
  shippingIncluded: boolean,
  shippingCost: number
  }
  ]
- ships_from: { country, state?, city? }
- type: for_sale|wtb
- year_range: { min?, max? }
- price_range: { min?, max? }
- acceptable_conditions: condition[]
- wtb_description: string
- reservation_terms: string

Response 200:

- data: updated listing

### 4) POST /listings/:id/publish

Payload:

- empty object

Response 200:

- data: published listing

Notes:

- Completeness check currently enforces shipping, price, images count, thumbnail, contents, condition, reservation_terms.
- Subtitle is not currently enforced in backend completeness.

### 5) PATCH /listings/:id/status

Payload:

- status: active|inactive

Response 200:

- data: listing with new status

### 6) DELETE /listings/:id

Payload:

- none

Response 200:

- data: { success: true }

### 7) GET /listings/:id/preview

Response 200:

- data: listing (author-only preview)

## Part 2: Listing Detail, Concierge, Reservation

### 8) GET /listings/:id

Response 200:

- data: listing

Visibility:

- Active/Reserved/Sold: public
- Draft/Inactive: owner only

### 9) POST /listings/:id/concierge

Payload:

- message: string optional

Response 201/200:

- data: concierge request payload

### 10) POST /listings/:id/reserve

Payload:

- shipping_region: US|CA|International

Response 201:

- data: Order
  - listing_type: NetworkListing
  - listing_snapshot: { brand, model, reference, price, thumbnail }
  - buyer_id, seller_id
  - amount
  - status: reserved
  - reservation_expires_at
  - reservation_terms_snapshot
  - metadata: { shipping_region, shipping_cost, buy_type }

### 11) GET /reservations/:id

Response 200:

- data: Order (reservation summary)

Authorization:

- buyer or seller only
- listing_type must be NetworkListing

### 12) GET /orders/:id

Response 200:

- data: Order (also valid read path for reservation/order detail)

## Part 3: Offer Flow, Public Profile Tabs, Safety Actions

### 13) POST /listings/:id/offers

Payload:

- amount: integer > 0 and below asking price
- shipping_region: US|CA|International
- request_free_shipping: boolean optional
- reservation_terms_snapshot: string optional
- message: string optional

Response 201:

- data: NetworkListingChannel
  - listing snapshot
  - buyer/seller snapshots
  - last_offer with:
    - sender_id
    - amount
    - message
    - shipping_region
    - request_free_shipping
    - reservation_terms_snapshot
    - offer_type
    - status
    - expiresAt
    - createdAt

### 14) GET /offers

Query:

- type: sent|received optional
- status: string optional
- limit: number optional
- offset: number optional

Response 200:

- data: channel list
- \_metadata: { total, limit, offset }

### 15) GET /offers/:id

Response 200:

- data: channel detail + role

### 16) POST /offers/:id/counter

Payload:

- amount: integer > 0
- message: string optional
- reservation_terms: string optional

Response 201:

- data: updated channel

### 17) POST /offers/:id/accept

Payload:

- none

Response 200:

- data: updated channel

### 18) POST /offers/:id/reject

Payload:

- none

Response 200:

- data: updated channel

### 19) GET /users/:id/profile

Response 200:

- data:
  - public user profile fields
  - reputation:
    - rating
    - reviewsCount
    - references: { positive, neutral, negative, total }
    - activeListingsCount

### 20) GET /users/:id/listings

Query:

- status: active|sold|all optional
- type: for_sale|wtb optional
- search: string optional
- page: number-string optional
- limit: number-string optional

Response 200:

- data: INetworkListing[]
- \_metadata:
  - paging: { count, total, page, limit, pages }

### 21) GET /users/:id/reviews

Query:

- role: buyer|seller optional
- limit: number optional
- offset: number optional

Response 200:

- data: review list
- total, limit, offset

### 22) GET /users/:id/references

Query:

- role: requester|target optional
- limit: number optional
- offset: number optional

Response 200:

- data: reference checks list
- \_metadata: { total, limit, offset }

### 23) POST /users/:id/connections

Payload:

- none

Response 201:

- message
- connection

### 24) DELETE /users/:id/connections

Payload:

- none

Response 200:

- message

### 25) POST /users/:id/report

Payload:

- reason: string required
- description: string optional
- target_type optional in request; bridge defaults to User

Response 201:

- data: created report

### 26) POST /users/:id/block

Payload:

- reason: string optional

Response 200:

- data: { success: true, message }

### 27) DELETE /users/:id/block

Payload:

- none

Response 200:

- data: { success: true, message }

## Cross-Check Notes

1. Offer send now creates canonical Offer records and keeps channel mirror for backward-compatible reads.
2. Channel OfferSchema now persists shipping and reservation terms fields.
3. Counter payload contract now aligns with handler/shared schema (message/reservation_terms).
4. Shared subtitle publish rule was intentionally left unchanged to avoid Batch 2 regressions.
