# Batch 2 API Request Response Alignment

This document gives practical request and response examples for Batch 2 Part-1 and Part-2 APIs, using the mock-user header flow from [src/middleware/customClerkMw.ts](src/middleware/customClerkMw.ts).

## Test Auth Mode (from customClerkMw)

Use this in development or test only:

- Header: x-test-user
- Example values: buyer_us_complete, merchant_approved, user_with_networks

Example base request:

curl -X GET "http://localhost:5050/api/v1/networks/search?type=listing&q=rolex" \
 -H "x-test-user: user_with_networks"

Important:

- The middleware injects auth claims for x-test-user, but routes using attachUser still require a matching User in DB by external_id.
- If mock claims exist but DB user does not exist, many endpoints return 404 User not found.

## Status Legend

- Aligned: endpoint and contract match Batch 2 needs.
- Partial: endpoint exists but behavior or contract is incomplete for screen expectations.
- Gap: missing endpoint or missing required behavior.

## Pagination Contract (Canonical by Endpoint Family)

Batch 2 intentionally uses two pagination families. Frontend should not assume one global pagination envelope.

1. Page-based family (search/listings index style)

- Request query: `page`, `limit`
- Response metadata: `_metadata.paging.page`, `_metadata.paging.limit`, `_metadata.paging.pages`, `_metadata.paging.total`
- Typical endpoints:
  - `GET /api/v1/networks/listings`
  - `GET /api/v1/networks/user/listings`
  - `GET /api/v1/networks/connections`

2. Offset-based family (activity/inbox/channel style)

- Request query: `limit`, `offset`
- Response metadata: usually `_metadata.total` and/or `_metadata.paging.offset`, `_metadata.paging.hasMore`
- Typical endpoints:
  - `GET /api/v1/networks/offers`
  - `GET /api/v1/networks/orders`
  - `GET /api/v1/networks/notifications`
  - `GET /api/v1/networks/connections/my-incoming`
  - `GET /api/v1/networks/connections/my-outgoing`

3. Legacy simple list family (retained for compatibility)

- Response top-level: `total`, `limit`, `offset` (without `_metadata.paging`)
- Typical endpoints:
  - `GET /api/v1/networks/user/isos/my`
  - `GET /api/v1/networks/user/reviews`
  - `GET /api/v1/networks/user/favorites`

## Core Endpoint Catalog

### 1) Search and Listings

1. GET /api/v1/networks/search

- Request example:
  - Query: type=listing&q=rolex&page=1&limit=10&sort_by=relevance&allow_offers=true&year_min=2020&year_max=2025
- Response shape:
  - data: listings, listings_count, isos, isos_count, users, users_count
  - pagination: limit, page, offset
- Alignment: Aligned
- Notes:
  - Canonical keys are unified.
  - Legacy aliases still accepted via normalization middleware.

2. GET /api/v1/networks/listings

- Request example:
  - Query: page=1&limit=10&sort_by=popularity&sort_order=desc&allow_offers=true&contents=box&year_min=2019&year_max=2025
- Response shape:
  - data: listing array
  - \_metadata.paging: count, total, page, limit, pages
  - \_metadata.filters
  - \_metadata.sort
- Alignment: Aligned
- Notes:
  - Supports category, contents, year range, allow_offers, relevance and popularity.

3. GET /api/v1/networks/search/popular-brands

- Request example:
  - Query: none
- Response shape:
  - data: array of brand entries
- Alignment: Aligned

4. GET /api/v1/networks/user/listings

- Request example:
  - Query: status=all&search=rolex&page=1&limit=20
- Response shape:
  - data: listing array
  - \_metadata.paging
  - \_metadata.groups: draft, active, reserved, sold
  - \_metadata.filters
- Alignment: Aligned

5. GET /api/v1/networks/listings/:id

- Request example:
  - Path param: listing id
- Response shape:
  - data: listing detail
- Alignment: Aligned

6. PATCH /api/v1/networks/listings/:id

- Request example:
  - Body: listing fields to edit
- Response shape:
  - data: updated listing
- Alignment: Partial
- Notes:
  - Only draft listings can be updated, which conflicts with active-edit UX expectation.

7. DELETE /api/v1/networks/listings/:id

- Request example:
  - Path param: listing id
- Response shape:
  - success or error
- Alignment: Partial
- Notes:
  - Restricted when status is reserved or sold, or when negotiation constraints exist.

8. POST /api/v1/networks/listings/:id/offers

- Request example:
  - Body: amount, optional message, optional shipping_region, optional request_free_shipping
- Response shape:
  - data: offer channel object (buyer/seller snapshots, last_offer, status)
  - requestId
- Alignment: Aligned

9. GET /api/v1/networks/listings/:id/offers

- Request example:
  - Path param: listing id
- Response shape:
  - data: offer channels for listing (seller-only)
  - requestId
- Alignment: Aligned

10. POST /api/v1/networks/listings/:id/inquire

- Request example:
  - Body: optional message
- Response shape:
  - data: inquiry channel payload (channel metadata and participants)
  - message
- Alignment: Aligned

11. POST /api/v1/networks/listings/:id/reserve

- Request example:
  - Body: shipping_region, optional note
- Response shape:
  - data: order object (reserved status)
  - requestId
- Alignment: Aligned

### 2) Notifications

1. GET /api/v1/networks/notifications

- Request example:
  - Query: tab=buying&unread_only=false&limit=20&offset=0
  - Optional: types=offer_received,counter_offer
- Response shape:
  - platform
  - data: notification array (id, type, category, title, body, actionUrl, read, createdAt, data)
  - total
  - unread_count
  - limit, offset
- Alignment: Aligned

2. GET /api/v1/networks/notifications/unread-count

- Request example:
  - Query: none
- Response shape:
  - platform
  - unread_count
- Alignment: Aligned

3. POST /api/v1/networks/notifications/:id/read

- Request example:
  - Path param: notification id
- Response shape:
  - platform, success, id
- Alignment: Aligned

4. POST /api/v1/networks/notifications/mark-all-read

- Request example:
  - Query: tab=all or buying or selling or social or system
- Response shape:
  - platform, success
- Alignment: Aligned

### 3) Connections and Friend Requests

1. GET /api/v1/networks/connections/my-incoming

- Request example:
  - Query: limit=20&offset=0
- Response shape:
  - data: array of requests with requester user_id, display_name, handle, avatar, bio, mutual_friends_count
  - \_metadata.paging
- Alignment: Aligned

2. GET /api/v1/networks/connections/my-outgoing

- Request example:
  - Query: limit=20&offset=0
- Response shape:
  - data: outgoing pending requests
  - \_metadata.paging
- Alignment: Aligned

3. POST /api/v1/networks/connections/send-request

- Request example:
  - Body: target_user_id
- Response shape:
  - data: connection request object
- Alignment: Aligned

4. POST /api/v1/networks/connections/:id/accept

- Request example:
  - Path param: connection request id
- Response shape:
  - data: accepted connection result
- Alignment: Aligned

5. POST /api/v1/networks/connections/:id/reject

- Request example:
  - Path param: connection request id
- Response shape:
  - data.message
- Alignment: Aligned

6. GET /api/v1/networks/connections

- Request example:
  - Query: page=1&limit=50
- Response shape:
  - data: accepted connections
  - \_metadata.paging: count, total, page, limit, pages
  - requestId
- Alignment: Aligned

7. DELETE /api/v1/networks/connections/:id

- Request example:
  - Path param: target user id
- Response shape:
  - data.message
  - requestId
- Alignment: Aligned

### 4) User Features in Networks Namespace

1. GET /api/v1/networks/user/dashboard/stats

- Request example:
  - Query: none
- Response shape:
  - data.stats: listings, offers, isos, reference_checks, social, verified_dealers_global
  - data.onboarding: completed_count, total_count, percentage, items
  - data.user: verification_status, rating
- Alignment: Partial
- Notes:
  - verified_dealers_global exists, but online dealer metric is not available.

2. GET /api/v1/networks/user/reviews

- Request example:
  - Query: role=buyer or role=seller, limit, offset
- Response shape:
  - data: reviews
  - total, limit, offset
- Alignment: Aligned

3. GET /api/v1/networks/user/favorites

- Request example:
  - Query: type=listing&limit=20&offset=0
- Response shape:
  - data: favorites
  - total, limit, offset
- Alignment: Aligned

4. POST /api/v1/networks/user/favorites

- Request example:
  - Body: item_type, item_id
- Response shape:
  - data: favorite entry
- Alignment: Aligned

5. DELETE /api/v1/networks/user/favorites/:type/:id

- Request example:
  - Path params: type, id
- Response shape:
  - success, message
- Alignment: Aligned

6. GET /api/v1/networks/user/searches/recent

- Request example:
  - Query: none
- Response shape:
  - data: recent searches
- Alignment: Aligned

7. POST /api/v1/networks/user/searches/recent

- Request example:
  - Body: query, context, filters, result_count
- Response shape:
  - data: created recent search entry
- Alignment: Aligned

8. DELETE /api/v1/networks/user/searches/recent

- Request example:
  - Query: none
- Response shape:
  - success, message
- Alignment: Aligned

9. DELETE /api/v1/networks/user/searches/recent/:id

- Request example:
  - Path param: search id
- Response shape:
  - success, message
- Alignment: Aligned

10. GET /api/v1/networks/user/isos/my

- Request example:
  - Query: status=all&limit=20&offset=0
- Response shape:
  - data: iso array
  - total
- Alignment: Aligned

11. GET /api/v1/networks/user/feeds/timeline

- Request example:
  - Query: limit=20&offset=0
- Response shape:
  - activities
  - limit, offset
- Alignment: Partial
- Notes:
  - Useful for connection activity feed but not a direct listing-card endpoint for home sections.

12. GET /api/v1/networks/onboarding/status

- Request example:
  - Query: none
- Response shape:
  - data.status
  - data.steps: location, display_name, avatar
  - data.progress: is_finished, percentage, steps_completed, total_steps
  - data.user
  - \_metadata.message
- Alignment: Partial
- Notes:
  - This uses a 3-step onboarding model, while dashboard card progress uses a 5-item model.

13. PATCH /api/v1/networks/onboarding/complete

- Request example:
  - Body: location, profile, avatar
- Response shape:
  - data: completed onboarding state and updated user fields
- Alignment: Aligned

### 5) Offers, Orders, Reference Checks, and Social Inbox

1. GET /api/v1/networks/offers

- Request example:
  - Query: type=sent|received&status=active|expired|in_progress&limit=20&offset=0
- Response shape:
  - data: offer channel array
  - \_metadata: total, limit, offset
  - requestId
- Alignment: Aligned

2. GET /api/v1/networks/offers/:id

- Request example:
  - Path param: channel id
- Response shape:
  - data: channel object plus role
  - requestId
- Alignment: Aligned

3. POST /api/v1/networks/offers/:id/accept

- Request example:
  - Path param: channel id
- Response shape:
  - data: updated channel
  - requestId
- Alignment: Aligned

4. POST /api/v1/networks/offers/:id/reject

- Request example:
  - Path param: channel id
- Response shape:
  - data: updated channel
  - requestId
- Alignment: Aligned

5. POST /api/v1/networks/offers/:id/counter

- Request example:
  - Body: amount, optional note
- Response shape:
  - data: updated channel
  - requestId
- Alignment: Aligned

6. GET /api/v1/networks/orders

- Request example:
  - Query: type=buy|sell&status=reserved|pending|paid&limit=20&offset=0
- Response shape:
  - data: order array
  - \_metadata: total, limit, offset
  - requestId
- Alignment: Partial
- Notes:
  - Home/activity cards derive counts from list metadata.

7. GET /api/v1/networks/orders/:id

- Request example:
  - Path param: order id
- Response shape:
  - data: order
  - requestId
- Alignment: Aligned

8. POST /api/v1/networks/orders/:id/complete

- Request example:
  - Path param: order id
- Response shape:
  - data.order
  - data.buyer_confirmed
  - data.seller_confirmed
  - data.completed
  - requestId
- Alignment: Aligned

9. GET /api/v1/networks/reference-checks

- Request example:
  - Query: type=requested|pending|about-me
- Response shape:
  - data: reference check array
  - \_metadata.total
  - requestId
- Alignment: Partial
- Notes:
  - Core list exists, but some screen card semantics still require UI composition.

10. GET /api/v1/networks/social/inbox

- Request example:
  - Query: filter=all|unread|offers|inquiries|reference_checks&limit=20&offset=0
- Response shape:
  - data: unified inbox channels
  - \_metadata.paging
  - requestId
- Alignment: Partial
- Notes:
  - Supports inquiry filtering, but quick-access combined counts are not a single dedicated contract.

### 6) Other User Public APIs in Networks Namespace

1. GET /api/v1/networks/users/:id/profile

- Request example:
  - Path param: user id
- Response shape:
  - data: public profile fields (visibility rules apply)
- Alignment: Aligned

2. GET /api/v1/networks/users/:id/listings

- Request example:
  - Query: limit=20&offset=0
- Response shape:
  - data: active public listings
  - total, limit, offset
- Alignment: Aligned

3. GET /api/v1/networks/users/:id/reviews

- Request example:
  - Query: role=buyer|seller&limit=20&offset=0
- Response shape:
  - data: reviews
  - total, limit, offset
- Alignment: Aligned

4. GET /api/v1/networks/users/:id/review-summary

- Request example:
  - Path param: user id
- Response shape:
  - data: total, average, breakdown
- Alignment: Aligned

5. GET /api/v1/networks/users/:id/connection-status

- Request example:
  - Path param: user id
- Response shape:
  - status object (connected, pending, direction)
- Alignment: Aligned

### 7) Cross Domain Dependencies Used by Batch 2 Screens

1. GET /api/v1/user/profile

- Response shape:
  - data: bio, social_links, stats, display_name, avatar, deactivated_at, isActive, full_name
- Alignment: Partial
- Notes:
  - Used by Networks screens but endpoint is outside networks namespace.

2. PATCH /api/v1/user/profile

- Response shape:
  - data: first_name, last_name, full_name, display_name, bio, social_links
- Alignment: Partial
- Notes:
  - Location update is not supported in this schema.

3. GET /api/v1/user/verification

- Response shape:
  - data: status, identityVerified, verifiedAt
- Alignment: Aligned

4. POST /api/v1/user/avatar

- Response shape:
  - data: avatar_url, metadata
- Alignment: Aligned

5. PATCH /api/v1/user/deactivate

- Response shape:
  - data: active, deactivated_at
- Alignment: Aligned

6. DELETE /api/v1/user

- Response shape:
  - success, message
- Alignment: Aligned

7. GET /api/v1/user/support/tickets/count/open

- Response shape:
  - data: count
- Alignment: Aligned

8. GET /api/v1/user/support/tickets

- Request example:
  - Query: status=open|resolved|closed&limit=20&offset=0
- Response shape:
  - data: ticket array
  - \_metadata: total, limit, offset, optional filters
- Alignment: Partial
- Notes:
  - Open count exists directly, but resolution split requires additional filtering/composition.

9. GET /api/v1/news

- Response shape:
  - data: news array
  - requestId
- Alignment: Aligned

## Explicit Gaps from Batch 2 Docs

1. GET /api/v1/networks/user/home

- Alignment: Clarified
- Reason: this was a proposed aggregate path. The implemented canonical aggregate endpoint is GET /api/v1/networks/user/profile. GET /api/v1/networks/user is a minimal platform endpoint and intentionally different.

2. Recommendation listing APIs under networks for home cards

- Alignment: Gap
- Reason: no dedicated recommended for you or from connections listings endpoint.

3. Learning materials endpoint for Profile Activity

- Alignment: Gap
- Reason: no corresponding API in current scope.

4. Remove avatar endpoint

- Alignment: Gap
- Reason: no DELETE or clear avatar endpoint on user profile routes.

5. Profile location update endpoint

- Alignment: Gap
- Reason: profile update schema does not include location fields.

## Quick Mock User Header Examples

1. Buyer perspective:

- x-test-user: buyer_us_complete

2. Networks feature perspective:

- x-test-user: user_with_networks

3. Merchant perspective:

- x-test-user: merchant_approved

## Full Payload Templates

Detailed JSON request and response payload templates for all endpoints in this document are available in [docs/BATCH_2_API_PAYLOADS.md](docs/BATCH_2_API_PAYLOADS.md).

## Postman Execution

For deterministic screen-by-screen execution order and variable dependency handling, use [docs/BATCH_2_POSTMAN_STEP_BY_STEP_RUNBOOK.md](docs/BATCH_2_POSTMAN_STEP_BY_STEP_RUNBOOK.md).
