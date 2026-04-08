# Batch 2 Needed Features API Spec (Non-Onboarding)

Version: 1.0  
Last Updated: March 2026  
Scope: Batch 2 needed features only (onboarding endpoints excluded)

Source of truth:

- docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md
- docs/BATCH_2_API_PAYLOADS.md
- docs/BATCH_2_PART1_PART2_FINAL_INTEGRATION_GUIDE.md

## 1) Global API Calling Rules

Base URL:

- /api/v1

Required headers:

- Authorization: Bearer <token>
- Content-Type: application/json (for JSON body endpoints)

Local mock-auth mode (dev/test only):

- x-test-user: merchant_approved or buyer_us_complete (or other configured mock user)

Response envelope patterns used across Batch 2:

- Pattern A: { data, requestId }
- Pattern B: { data, \_metadata, requestId }
- Pattern C: { success, message, requestId? }
- Pattern D (notifications platform): { platform, data, total, unread_count, limit, offset }

Error handling contract:

- 400: validation/business rule error
- 401: authentication required
- 403: forbidden/ownership/access issue
- 404: entity not found
- 409: state conflict (treat as re-sync trigger)
- 500: server/internal failure

Pagination contract (must stay aligned):

- Page-based family: page + limit
- Offset-based family: limit + offset
- Do not mix page and offset in one request unless endpoint explicitly supports alias compatibility

## 2) Search and Listings

### 2.1 GET /networks/search

Use:

- Unified search for listing/iso/user contexts.

Query:

- type: listing | iso | user
- q: string
- page: number (default 1)
- limit: number
- sort_by: relevance | popularity | price | created | updated
- sort_order: asc | desc
- allow_offers: boolean
- year_min, year_max: number

Success response:

- data.listings, data.listings_count
- data.isos, data.isos_count
- data.users, data.users_count
- pagination.limit, pagination.page, pagination.offset

Call example:

- GET /api/v1/networks/search?type=listing&q=rolex&page=1&limit=10&sort_by=relevance&sort_order=desc

### 2.2 GET /networks/listings

Use:

- Listing grid/list retrieval with canonical filters.

Query:

- page, limit
- sort_by, sort_order
- allow_offers
- contents
- year_min, year_max
- category (optional)

Success response:

- data: listing[]
- \_metadata.paging: count, total, page, limit, pages
- \_metadata.filters
- \_metadata.sort

Call example:

- GET /api/v1/networks/listings?page=1&limit=20&sort_by=popularity&sort_order=desc&allow_offers=true

### 2.3 GET /networks/search/popular-brands

Use:

- Search landing popular brand chips.

Query:

- none

Success response:

- data: brand[]

Call example:

- GET /api/v1/networks/search/popular-brands

### 2.4 GET /networks/user/listings

Use:

- Owner inventory in Profile For Sale tab.

Query:

- status: all | draft | active | reserved | sold | inactive
- search: string
- page, limit

Success response:

- data: listing[]
- \_metadata.paging
- \_metadata.groups: draft, active, reserved, sold
- \_metadata.filters

Call example:

- GET /api/v1/networks/user/listings?status=all&search=&page=1&limit=20

### 2.5 GET /networks/listings/:id

Use:

- Listing detail fetch.

Path params:

- id: listing id

Success response:

- data: listing detail object

Call example:

- GET /api/v1/networks/listings/{listingId}

### 2.6 PATCH /networks/listings/:id

Use:

- Listing update (draft-only by backend rule).

Path params:

- id: listing id

Body (common fields):

- title?: string
- description?: string
- price?: number
- year?: number
- brand?: string
- model?: string
- contents?: string[]
- allow_offers?: boolean

Success response:

- data: updated listing

Call example:

- PATCH /api/v1/networks/listings/{listingId}

### 2.7 DELETE /networks/listings/:id

Use:

- Listing removal (status/business constraints apply).

Path params:

- id: listing id

Success response:

- success or data/message depending on handler

Call example:

- DELETE /api/v1/networks/listings/{listingId}

### 2.8 POST /networks/listings/:id/offers

Use:

- Create offer channel from listing detail.

Path params:

- id: listing id

Body:

- amount: number (required)
- message?: string
- shipping_region?: string
- request_free_shipping?: boolean

Success response:

- data: offer channel object
- requestId

Call example:

- POST /api/v1/networks/listings/{listingId}/offers

### 2.9 GET /networks/listings/:id/offers

Use:

- Seller-side listing offer channels.

Path params:

- id: listing id

Success response:

- data: offer channel[]
- requestId

Call example:

- GET /api/v1/networks/listings/{listingId}/offers

### 2.10 POST /networks/listings/:id/inquire

Use:

- Create or reuse inquiry channel.

Path params:

- id: listing id

Body:

- message?: string

Success response:

- data: inquiry channel payload
- message

Call example:

- POST /api/v1/networks/listings/{listingId}/inquire

### 2.11 POST /networks/listings/:id/reserve

Use:

- Reserve listing and create reserved order state.

Path params:

- id: listing id

Body:

- shipping_region: string (required)
- note?: string

Success response:

- data: order object
- requestId

Call example:

- POST /api/v1/networks/listings/{listingId}/reserve

## 3) Notifications

### 3.1 GET /networks/notifications

Use:

- Notifications center list by tab.

Query:

- tab: all | buying | selling | social | system
- unread_only?: boolean
- limit, offset
- types?: comma-separated notification types

Success response:

- platform
- data: notification[]
- total, unread_count, limit, offset

Call example:

- GET /api/v1/networks/notifications?tab=all&limit=20&offset=0

### 3.2 GET /networks/notifications/unread-count

Use:

- Badge count refresh.

Success response:

- platform
- unread_count

Call example:

- GET /api/v1/networks/notifications/unread-count

### 3.3 POST /networks/notifications/:id/read

Use:

- Mark single notification as read.

Path params:

- id: notification id

Success response:

- platform, success, id

Call example:

- POST /api/v1/networks/notifications/{notificationId}/read

### 3.4 POST /networks/notifications/mark-all-read

Use:

- Mark all as read globally or per tab.

Query:

- tab?: all | buying | selling | social | system

Success response:

- platform, success

Call example:

- POST /api/v1/networks/notifications/mark-all-read?tab=buying

## 4) Connections and Relationship APIs

### 4.1 GET /networks/connections/my-incoming

Query:

- limit, offset

Success response:

- data: incoming request[]
- \_metadata.paging

Call example:

- GET /api/v1/networks/connections/my-incoming?limit=20&offset=0

### 4.2 GET /networks/connections/my-outgoing

Query:

- limit, offset

Success response:

- data: outgoing request[]
- \_metadata.paging

Call example:

- GET /api/v1/networks/connections/my-outgoing?limit=20&offset=0

### 4.3 POST /networks/connections/send-request

Body:

- target_user_id: string (required)

Success response:

- data: connection request object

Call example:

- POST /api/v1/networks/connections/send-request

### 4.4 POST /networks/connections/:id/accept

Path params:

- id: connection request id

Success response:

- data: accepted connection result

Call example:

- POST /api/v1/networks/connections/{requestId}/accept

### 4.5 POST /networks/connections/:id/reject

Path params:

- id: connection request id

Success response:

- data.message

Call example:

- POST /api/v1/networks/connections/{requestId}/reject

### 4.6 GET /networks/connections

Query:

- page, limit

Success response:

- data: accepted connection[]
- \_metadata.paging
- requestId

Call example:

- GET /api/v1/networks/connections?page=1&limit=50

### 4.7 DELETE /networks/connections/:id

Path params:

- id: target user id (disconnect)

Success response:

- data.message
- requestId

Call example:

- DELETE /api/v1/networks/connections/{targetUserId}

## 5) User Features in Networks Namespace

### 5.1 GET /networks/user/dashboard/stats

Use:

- Home and profile activity cards.

Success response:

- data.stats
- data.onboarding
- data.user

Call example:

- GET /api/v1/networks/user/dashboard/stats

### 5.2 GET /networks/user/reviews

Query:

- role: all | buyer | seller
- limit, offset

Success response:

- data: review[]
- total, limit, offset

Call example:

- GET /api/v1/networks/user/reviews?role=seller&limit=20&offset=0

### 5.3 GET /networks/user/favorites

Query:

- type: listing
- limit, offset

Success response:

- data: favorites[]
- total, limit, offset

Call example:

- GET /api/v1/networks/user/favorites?type=listing&limit=20&offset=0

### 5.4 POST /networks/user/favorites

Body:

- item_type: listing
- item_id: string

Success response:

- data: favorite entry

Call example:

- POST /api/v1/networks/user/favorites

### 5.5 DELETE /networks/user/favorites/:type/:id

Path params:

- type: listing
- id: listing id

Success response:

- success, message

Call example:

- DELETE /api/v1/networks/user/favorites/listing/{listingId}

### 5.6 GET /networks/user/searches/recent

Success response:

- data: recent search[]

Call example:

- GET /api/v1/networks/user/searches/recent

### 5.7 POST /networks/user/searches/recent

Body:

- query: string
- context: listing | iso | user
- filters?: object
- result_count?: number

Success response:

- data: created recent search

Call example:

- POST /api/v1/networks/user/searches/recent

### 5.8 DELETE /networks/user/searches/recent

Success response:

- success, message

Call example:

- DELETE /api/v1/networks/user/searches/recent

### 5.9 DELETE /networks/user/searches/recent/:id

Path params:

- id: recent-search id

Success response:

- success, message

Call example:

- DELETE /api/v1/networks/user/searches/recent/{recentId}

### 5.10 GET /networks/user/isos/my

Query:

- status: all | active | fulfilled | closed (backend-supported set)
- limit, offset

Success response:

- data: iso[]
- total

Call example:

- GET /api/v1/networks/user/isos/my?status=all&limit=20&offset=0

## 6) Offers and Orders

### 6.1 GET /networks/offers

Query:

- type: sent | received
- status: active | expired | in_progress (or backend-supported status)
- limit, offset

Success response:

- data: offer channel[]
- \_metadata.total, \_metadata.limit, \_metadata.offset
- requestId

Call example:

- GET /api/v1/networks/offers?type=received&status=active&limit=20&offset=0

### 6.2 GET /networks/offers/:id

Path params:

- id: offer channel id

Success response:

- data: channel + role
- requestId

Call example:

- GET /api/v1/networks/offers/{channelId}

### 6.3 POST /networks/offers/:id/accept

Path params:

- id: offer channel id

Success response:

- data: updated channel
- requestId

Call example:

- POST /api/v1/networks/offers/{channelId}/accept

### 6.4 POST /networks/offers/:id/reject

Path params:

- id: offer channel id

Success response:

- data: updated channel
- requestId

Call example:

- POST /api/v1/networks/offers/{channelId}/reject

### 6.5 POST /networks/offers/:id/counter

Path params:

- id: offer channel id

Body:

- amount: number (required)
- message?: string
- reservation_terms?: string

Success response:

- data: updated channel
- requestId

Call example:

- POST /api/v1/networks/offers/{channelId}/counter

### 6.6 GET /networks/orders

Query:

- type: buy | sell
- status: reserved | pending | paid | completed (backend-supported)
- limit, offset

Success response:

- data: order[]
- \_metadata.total, \_metadata.limit, \_metadata.offset
- requestId

Call example:

- GET /api/v1/networks/orders?type=buy&status=reserved&limit=20&offset=0

### 6.7 GET /networks/orders/:id

Path params:

- id: order id

Success response:

- data: order
- requestId

Call example:

- GET /api/v1/networks/orders/{orderId}

### 6.8 POST /networks/orders/:id/complete

Path params:

- id: order id

Success response:

- data.order
- data.buyer_confirmed
- data.seller_confirmed
- data.completed
- requestId

Call example:

- POST /api/v1/networks/orders/{orderId}/complete

## 7) Social Inbox

### 7.1 GET /networks/social/inbox

Query:

- filter: all | unread | offers | inquiries | reference_checks
- limit, offset

Success response:

- data: inbox channel[]
- \_metadata.paging
- requestId

Call example:

- GET /api/v1/networks/social/inbox?filter=inquiries&limit=20&offset=0

## 8) Other User Public APIs

### 8.1 GET /networks/users/:id/profile

Path params:

- id: target user id

Success response:

- data: public profile

Call example:

- GET /api/v1/networks/users/{userId}/profile

### 8.2 GET /networks/users/:id/listings

Path params:

- id: target user id

Query:

- limit, offset

Success response:

- data: active public listings[]
- total, limit, offset

Call example:

- GET /api/v1/networks/users/{userId}/listings?limit=20&offset=0

### 8.3 GET /networks/users/:id/reviews

Path params:

- id: target user id

Query:

- role: buyer | seller
- limit, offset

Success response:

- data: review[]
- total, limit, offset

Call example:

- GET /api/v1/networks/users/{userId}/reviews?role=seller&limit=20&offset=0

### 8.4 GET /networks/users/:id/review-summary

Path params:

- id: target user id

Success response:

- data.total
- data.average
- data.breakdown

Call example:

- GET /api/v1/networks/users/{userId}/review-summary

### 8.5 GET /networks/users/:id/connection-status

Path params:

- id: target user id

Success response:

- connection status object (connected, pending, direction)

Call example:

- GET /api/v1/networks/users/{userId}/connection-status

## 9) Cross-Domain APIs Used by Batch 2 Screens

### 9.1 GET /user/profile

Success response:

- data: profile object (display_name, avatar, bio, social_links, stats, active flags)

Call example:

- GET /api/v1/user/profile

### 9.2 PATCH /user/profile

Body:

- first_name?
- last_name?
- display_name?
- bio?
- social_links?

Success response:

- data: updated profile subset

Call example:

- PATCH /api/v1/user/profile

### 9.3 GET /user/verification

Success response:

- data.status
- data.identityVerified
- data.verifiedAt

Call example:

- GET /api/v1/user/verification

### 9.4 POST /user/avatar

Body:

- multipart upload payload or avatar metadata according to backend route

Success response:

- data.avatar_url
- data.metadata

Call example:

- POST /api/v1/user/avatar

### 9.5 PATCH /user/deactivate

Body:

- endpoint-specific deactivate reason fields (if configured)

Success response:

- data.active
- data.deactivated_at

Call example:

- PATCH /api/v1/user/deactivate

### 9.6 DELETE /user

Success response:

- success, message

Call example:

- DELETE /api/v1/user

### 9.7 GET /user/support/tickets/count/open

Success response:

- data.count

Call example:

- GET /api/v1/user/support/tickets/count/open

### 9.8 GET /news

Query:

- limit (recommended for dashboard blocks)

Success response:

- data: news[]
- requestId

Call example:

- GET /api/v1/news?limit=10

## 10) Fully Aligned Frontend Call Pattern (Recommended)

Use one API adapter and keep method semantics strict.

Pseudo-pattern:

- GET list endpoints: pass params object only
- POST/PATCH endpoints: pass JSON body with required fields only
- DELETE endpoints: pass path params only unless API requires body (these Batch 2 routes do not)

Request utility requirements:

- Attach Authorization token always in production
- Attach x-test-user only in local mock mode
- Normalize query adapters by pagination family before send
- Handle 409 by re-fetch/reconcile for list/detail state

## 11) Explicitly Excluded (Onboarding-Related)

These are intentionally excluded from this needed-features spec:

- GET /api/v1/networks/onboarding/status
- PATCH /api/v1/networks/onboarding/complete

## 12) Implementation Checklist

- Use canonical filter keys: year_min/year_max, sort_by/sort_order
- Keep list pagination adapters split: page family vs offset family
- Re-fetch unread count after notification read mutations
- Re-sync offers/orders list after accept/reject/counter/complete writes
- Keep favorites state rollback-safe on mutation errors
- Treat 409 as state drift; refresh current entity/list
- Keep request/response envelopes mapped exactly as documented above
