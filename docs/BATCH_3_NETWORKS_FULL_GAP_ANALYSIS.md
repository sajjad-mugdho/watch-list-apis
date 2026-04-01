# Batch 3 Networks Full Gap Analysis (Code-Verified)

Date: April 1, 2026
Scope: Batch 3 screens (Part 1 + Part 2 + Part 3) mapped to current Networks backend implementation
Verification Mode: Source-only, no inferred behavior

## 1. Verification Boundaries

This report is based on direct reads of current implementation in Networks routes, handlers, models, and schemas.

Included code areas:

- Networks routing and handlers for listings, offers, users, reservations, and orders
- Shared validation schemas used by Networks routes
- Offer canonical model and service used by Networks offer actions
- Listing completeness and watch extraction utilities used by Batch 3 flows

Not included:

- Speculative product behavior not present in code
- Proposed redesign details beyond concise recommendations

## 2. Endpoint Existence Matrix (Batch 3)

### Part 1: Listings Dashboard and Listing Creation

1. GET /api/v1/networks/listings

- Exists and mounted
- Supports query validation via getListingsSchema
- Handler returns paged public listings with filters and metadata

2. POST /api/v1/networks/listings

- Exists and mounted
- Validated by createListingSchema
- Creates draft listing from watch ID and listing type

3. PATCH /api/v1/networks/listings/:id

- Exists and mounted
- Validated by updateListingSchema
- Draft-only edit allowed in handler

4. POST /api/v1/networks/listings/:id/publish

- Exists and mounted
- Uses validateListingCompleteness before publish

5. PATCH /api/v1/networks/listings/:id/status

- Exists and mounted
- Validated by updateListingStatusSchema

6. DELETE /api/v1/networks/listings/:id

- Exists and mounted
- Soft-delete style flag (is_deleted = true)

7. GET /api/v1/networks/listings/:id/preview

- Exists and mounted
- Author-only preview

### Part 2: Listing Detail, Concierge, Reservation

1. GET /api/v1/networks/listings/:id

- Exists and mounted
- Public visibility for active/reserved/sold; owner-only for non-public states

2. POST /api/v1/networks/listings/:id/concierge

- Exists and mounted
- Validated by conciergeRequestSchema

3. POST /api/v1/networks/listings/:id/reserve

- Exists and mounted
- Validated by createReservationSchema
- Creates Order and transitions listing to reserved in transaction

4. GET /api/v1/networks/reservations/:id

- Handler exists (networks_reservation_get)
- No dedicated reservations router mounted in networks index
- Practical retrieval path in mounted routes is GET /api/v1/networks/orders/:id

5. GET /api/v1/networks/users/:id/profile

- Exists and mounted
- Returns public profile with reputation aggregates

6. GET /api/v1/networks/users/:id/reviews

- Exists and mounted in usersRoutes

7. GET /api/v1/networks/users/:id/references

- Exists and mounted

### Part 3: Offers, Public Profile Tabs, Safety Actions

1. POST /api/v1/networks/listings/:id/offers

- Exists and mounted
- Validated by sendOfferSchema

2. GET /api/v1/networks/offers/:id

- Exists and mounted
- Returns channel details + caller role

3. POST /api/v1/networks/offers/:id/counter

- Exists and mounted
- Uses route-local counterOfferSchema in offerRoutes

4. POST /api/v1/networks/offers/:id/accept

- Exists and mounted
- Looks up active canonical Offer by channel_id before service call

5. POST /api/v1/networks/offers/:id/reject

- Exists and mounted
- Looks up active canonical Offer by channel_id before service call

6. GET /api/v1/networks/users/:id/listings

- Exists and mounted
- Supports status/search/page/limit
- No type filter (for_sale or wtb)

7. POST /api/v1/networks/users/:id/connections

- Exists and mounted

8. DELETE /api/v1/networks/users/:id/connections

- Exists and mounted

9. POST /api/v1/networks/users/:id/report

- Exists and mounted
- Bridge injects target_id only

10. POST /api/v1/networks/users/:id/block

- Exists and mounted

11. DELETE /api/v1/networks/users/:id/block

- Exists and mounted

## 3. Request Contract Verification

### Listings and Publish Contracts

1. updateListingSchema shipping enum

- region is restricted to [US, CA]

2. createReservationSchema shipping_region enum

- shipping_region allows [US, CA, International]

3. publish requirements

- validateListingCompleteness requires shipping, price, images(min/max), thumbnail, contents, condition, reservation_terms
- subtitle is not required by completeness checker

### Offer Contracts

1. sendOfferSchema

- amount: positive integer
- shipping_region: required string (free-form)
- request_free_shipping: optional boolean
- reservation_terms_snapshot: optional string
- message: optional string

2. counter offer contract mismatch

- offerRoutes route-local schema accepts body.amount + body.note
- networks_offer_counter handler reads body.amount + body.message + body.reservation_terms
- shared schemas.ts also defines counterOfferSchema with message + reservation_terms

### User Report Contract

1. createReportSchema requires

- target_id
- target_type enum [User, NetworkListing]
- reason

2. usersRoutes bridge for POST /users/:id/report

- injects target_id from path
- does not inject target_type
- report can fail validation when client omits target_type

## 4. Response Shape Verification

### Listings

1. GET /networks/listings response

- data array of listings
- metadata includes paging, filters, sort

2. GET /networks/listings/:id response

- data listing document (visibility gated by status/ownership)

### Reservation/Order

1. POST /networks/listings/:id/reserve response

- returns created Order
- includes reservation_terms_snapshot copied from listing
- metadata includes shipping_region and shipping_cost in order metadata

2. GET /networks/orders/:id response

- returns order for buyer/seller only
- ensures listing_type is NetworkListing

### Offers and Channels

1. POST /networks/listings/:id/offers response

- returns NetworkListingChannel with last_offer set in handler

2. GET /networks/offers/:id response

- returns channel payload plus computed role (buyer/seller)

3. Channel schema persistence caveat

- Status: Resolved in current implementation.

- NetworkListingChannel OfferSchema does not define shipping_region, request_free_shipping, reservation_terms_snapshot
- handler writes these fields on last_offer during send offer
- schema omission can drop these fields from persisted channel offer payload

### Public Profile

1. GET /networks/users/:id/profile response

- includes user public identity fields and reputation block:
  - rating
  - reviewsCount
  - references summary counts
  - activeListingsCount

2. GET /networks/users/:id/listings response

- supports public status selection active/sold/all and search
- returns paging metadata

## 5. Screen-by-Screen Alignment Status

Status legend:

- Aligned: endpoint and contracts support screen behavior
- Partial: endpoint exists but contract/shape mismatch limits parity
- Not Aligned: required behavior is missing or blocked

### Part 1

1. Listings feed and overflow actions: Partial

- Core endpoints exist
- Boost listing action has no backend endpoint

2. Watch search and watch selection to draft: Partial

- Watch search and draft creation exist
- watch extraction expects color, but watch schema does not define color under strict mode

3. Draft editing and publish: Partial

- Draft patch and publish flows exist
- subtitle required in UI is not required in publish completeness

### Part 2

1. Listing detail: Aligned

- Listing detail endpoint and visibility logic are present

2. Concierge request: Aligned

- Endpoint and validation exist

3. Direct reservation (Buy Now): Partial

- Reserve endpoint exists and transactionally creates order
- shipping enum mismatch across listing update (US/CA) vs reservation (includes International)

4. Reservation summary retrieval: Partial

- Dedicated reservation get handler exists but reservations route is not mounted
- mounted and usable retrieval path is via orders endpoint

5. Trust/references/reviews surfaces: Partial

- reviews and references endpoints exist
- naming and source mapping still require frontend discipline for exact screen semantics

### Part 3

1. Make Offer compose: Partial

- send offer endpoint exists
- shipping_region is free-form string and not verified against listing shipping matrix in send flow
- message is optional in backend

2. Review Offer: Partial

- offer detail endpoint exists
- last_offer shipping/terms fields risk missing due to channel offer schema omission

3. Counter/Accept/Reject lifecycle: Not Aligned (critical consistency risk)

- Status: Resolved in current implementation.

- accept/reject/counter require active canonical Offer by channel_id
- initial send-offer handler does not create canonical Offer via OfferService
- this can produce channel-visible offer with no canonical active Offer for follow-up actions

4. Public profile tabs (For Sale/WTB/Reference History): Partial

- profile/listings/reviews/references endpoints exist
- listings endpoint has no type filter for for_sale vs wtb tab split

5. Profile overflow actions (report/block): Partial

- Status note: report target_type normalization is now resolved; block/unblock remained aligned.

- block/unblock flows are wired
- report bridge misses target_type normalization

## 6. Severity-Ranked Gap Backlog

### P0 Critical

1. Offer lifecycle split between channel mirror and canonical offer model
   Evidence:

- Initial send offer writes channel.last_offer directly in networks_offer_send
- Accept/reject/counter first query Offer collection by channel_id for active states
  Impact:
- Follow-up offer actions can fail with "No active offer found for this channel" despite visible channel last_offer

### P1 High

1. Channel offer schema omits shipping/terms fields
   Evidence:

- IOffer interface includes shipping_region/request_free_shipping/reservation_terms_snapshot
- OfferSchema in NetworkListingChannel does not define these fields
- send offer handler sets these fields in last_offer object
  Impact:
- Shipping and reservation terms metadata may be dropped from persisted channel offer payload

2. Counter route validation mismatch
   Evidence:

- offerRoutes local schema uses note
- networks_offer_counter reads message and reservation_terms
- shared counter schema in schemas.ts expects message/reservation_terms
  Impact:
- Client payload ambiguity and validation/runtime drift

3. Report account bridge mismatch
   Evidence:

- createReportSchema requires target_type
- /users/:id/report bridge injects only target_id
  Impact:
- Account report may fail validation unless frontend also sends target_type=User

### P2 Medium

1. Shipping region enum inconsistency
   Evidence:

- updateListingSchema shipping region is [US, CA]
- createReservationSchema shipping_region allows [US, CA, International]
- sendOfferSchema shipping_region is free-form string
  Impact:
- Inconsistent user paths and weak cross-flow parity

2. Publish completeness does not enforce subtitle
   Evidence:

- validateListingCompleteness missing-fields list excludes subtitle
  Impact:
- Published listing can pass backend completeness without subtitle

3. Public profile listings tab filter gap
   Evidence:

- getUserPublicProfileSchema query lacks type filter
- networks_user_listings_get filters by status/search only
  Impact:
- For Sale vs WTB tabs cannot be cleanly server-driven

4. Reservation summary endpoint mount gap
   Evidence:

- networks_reservation_get handler exists
- networks index mounts orders routes, not reservations routes
  Impact:
- Documented reservations GET path is not available as mounted dedicated route

5. Watch color persistence risk
   Evidence:

- IWatch interface includes color
- watch schema does not define color and strict mode is enabled
- ExtractWatchSpecData reads data.color
  Impact:
- color can be absent in persisted watch documents even though extraction expects it

## 7. Minimal Correction Targets (No Over-Engineering)

1. Offer lifecycle consistency

- Ensure initial networks offer creation also creates canonical Offer/OfferRevision in the same flow

2. Channel last_offer schema parity

- Add shipping_region, request_free_shipping, reservation_terms_snapshot to NetworkListingChannel OfferSchema

3. Counter contract unification

- Align route-level counter validator with handler/shared schema fields

4. Report bridge normalization

- Inject target_type=User in /users/:id/report route bridge for account report path

5. Shipping parity baseline

- Align listing shipping enum and offer shipping validation to the same controlled set used by reservation

6. Subtitle parity decision

- Either enforce subtitle in validateListingCompleteness or remove mandatory UI indicator

7. Public listings type filter

- Add type query support (for_sale|wtb) for profile tab parity

8. Reservations read path clarity

- Either mount dedicated reservations route or standardize docs to orders read endpoint

## 8. Final Conclusion

Batch 3 is largely implemented at route/handler level, but not fully screen-aligned yet. The highest-risk blocker is offer lifecycle inconsistency between channel-level last_offer and canonical Offer state used by accept/reject/counter actions. Most remaining issues are contract mismatches and parity gaps that can be fixed with focused, low-scope changes.
