# Networks Batch 3 Master Guide (Part 1 + Part 2 + Part 3)

This is the unified codebase-aligned document for the full Batch 3 Figma scope.
It merges:

- Part 1: Listings management and listing creation flow
- Part 2: Listing detail, concierge, reservation, and reference/review surfaces
- Part 3: Offer lifecycle, public profile tabs, and profile safety actions

Primary objective:

- Provide one implementation reference for frontend and backend teams.
- Preserve screen-by-screen mapping while consolidating all gaps into one priority list.

---

## 1) End-to-End Screen Flow Map

### Phase A: Inventory + Create Listing (Part 1)

1. Listings dashboard feed and overflow actions.
2. Watch search and reference selection.
3. Draft creation.
4. Draft editing and publish checks.

Main endpoints:

- GET /api/v1/networks/listings
- GET /api/v1/watches
- POST /api/v1/networks/listings
- PATCH /api/v1/networks/listings/:id
- POST /api/v1/networks/listings/:id/publish
- PATCH /api/v1/networks/listings/:id/status
- DELETE /api/v1/networks/listings/:id
- GET /api/v1/networks/listings/:id/preview

### Phase B: Listing Detail + Concierge + Reserve (Part 2)

1. Public listing detail view with seller trust and safety blocks.
2. Concierge inquiry request flow.
3. Buy Now reservation confirmation and order creation.
4. Reservation confirmed state.
5. Reference history/review context mapping.

Main endpoints:

- GET /api/v1/networks/listings/:id
- POST /api/v1/networks/listings/:id/concierge
- POST /api/v1/networks/listings/:id/reserve
- GET /api/v1/networks/reservations/:id
- GET /api/v1/networks/users/:id/profile
- GET /api/v1/networks/users/:id/reviews
- GET /api/v1/networks/users/:id/references

### Phase C: Offer + Profile Actions (Part 3)

1. Make Offer compose form.
2. Offer review confirmation screen.
3. Offer sent confirmation state.
4. Public profile tabs: For Sale, WTB, Reference History.
5. Profile overflow actions: Share, Report, Block.

Main endpoints:

- POST /api/v1/networks/listings/:id/offers
- GET /api/v1/networks/offers/:id
- POST /api/v1/networks/offers/:id/counter
- POST /api/v1/networks/offers/:id/accept
- POST /api/v1/networks/offers/:id/reject
- GET /api/v1/networks/users/:id/listings
- GET /api/v1/networks/users/:id/profile
- GET /api/v1/networks/users/:id/reviews
- GET /api/v1/networks/users/:id/references
- POST /api/v1/networks/users/:id/connections
- DELETE /api/v1/networks/users/:id/connections
- POST /api/v1/networks/users/:id/report
- POST /api/v1/networks/users/:id/block
- DELETE /api/v1/networks/users/:id/block

---

## 2) What Is Already Aligned

- Listings CRUD + draft/publish structure exists and is usable.
- Listing completeness checks enforce images, thumbnail, contents, condition, price, and reservation terms.
- Reservation flow creates orders and transitions listing to reserved.
- Concierge requests exist as first-class workflow.
- Public profile endpoint returns review + reference aggregates.
- Connection, block, unblock, and report actions are implemented.
- Offer accept/reject/counter routes and services are present.

---

## 3) Unified Gap Analysis (All Parts Combined)

### P0 Critical

1. Offer lifecycle split-brain.

- Initial offer send updates NetworkListingChannel.last_offer.
- Accept/reject/counter paths depend on canonical Offer model records.
- Risk: channel shows active offer while Offer lookup fails downstream.

### P1 High

2. NetworkListingChannel last_offer schema missing fields.

- Handler writes shipping_region, request_free_shipping, reservation_terms_snapshot.
- Offer subdocument schema does not define those fields.
- Result: fields are dropped from persisted payload and read APIs.

3. Counter route contract mismatch.

- Route-local schema accepts amount + note.
- Handler expects amount + message + reservation_terms.

4. Report-account bridge mismatch.

- /users/:id/report bridge injects target_id only.
- Validation requires target_type and reason.
- Risk: account report fails unless client manually sends target_type=User.

### P2 Medium

5. Shipping region parity gaps.

- Listing update schema supports only US and CA while reservation UI includes International.
- Offer send schema uses free-form shipping_region and does not enforce listing shipping availability.

6. Required subtitle parity gap.

- UI marks subtitle required.
- Publish completeness does not currently require subtitle.

7. Public profile listing tab parity.

- For Sale vs WTB tabs need type-level filtering.
- Public listings endpoint currently centers on status/search only.

8. Reference vs review naming ambiguity.

- Some Figma references show review-like content under Reference naming.
- Integration needs explicit mapping between reviews data and reference checks data.

9. Pagination contract inconsistency.

- Mixed use of page/limit and limit/offset across comments, schemas, and handlers.

10. Boost listing not implemented.

- UX includes Boost action without backend architecture.

11. Watch color field persistence risk.

- Watch model interface includes color usage, but schema alignment must be confirmed to avoid field drops.

---

## 4) Consolidated Implementation Plan

### Phase 1: Integrity Fixes (Must do first)

1. Unify offer creation path so initial send creates canonical Offer + OfferRevision and mirrors channel state.
2. Extend channel offer subdocument schema with shipping_region, request_free_shipping, reservation_terms_snapshot.
3. Fix counter route validation contract to match handler payload.
4. Normalize report bridge to auto-inject target_type=User.

### Phase 2: Figma Parity Fixes

5. Add International support to listing shipping enum and align reservation/offer shipping validation.
6. Enforce subtitle in publish completeness checks (if product confirms required behavior).
7. Add public listings type filter for For Sale/WTB parity.
8. Standardize pagination contract to a single approach.

### Phase 3: Product Clarifications

9. Decide whether Reference History UI uses reviews, reference checks, or both with segmented tabs.
10. Decide Boost Listing roadmap or hide action.
11. Confirm message requiredness in Make Offer screen and enforce at schema level.

---

## 5) Suggested API Contract Snapshot for Frontend

### Listing Draft/Publish

- Create draft with watch ID.
- Patch draft incrementally.
- Publish only when completeness passes.

### Offer Flow

- Create offer with strict shipping region.
- Fetch channel/offer summary for review screen.
- Accept/reject/counter operate on active canonical offer.

### Reservation Flow

- Reserve listing by shipping region.
- Confirm totals and terms snapshot in response.

### Profile + Safety

- Fetch profile summary + listings with tab filters.
- Fetch reviews and references separately.
- Support report and block from overflow menu.

---

## 6) Source Documents

- docs/BATCH_3_PART_1_LISTINGS_API_GUIDE.md
- docs/BATCH_3_PART_2_FIGMA_GAP_ANALYSIS.md
- docs/BATCH_3_PART_3_FINAL_FIGMA_GAP_ANALYSIS.md
