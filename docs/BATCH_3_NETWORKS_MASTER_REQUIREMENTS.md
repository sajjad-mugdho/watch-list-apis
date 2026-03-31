# Batch 3 Networks Master Requirements (Part 1 + Part 2 + Part 3)

Date: April 1, 2026
Owner: Networks Platform + Mobile/Web Clients
Status: Master requirements baseline

## 1. Purpose

This document defines the complete end-to-end requirements for Networks Batch 3 by combining all Figma screens from:

- Part 1: Listing management and listing creation
- Part 2: Listing detail, concierge, reservation, and trust views
- Part 3: Offer workflow, public profile tabs, and profile safety actions

This is the single source of truth for implementation requirements, API behavior, validation requirements, acceptance criteria, and delivery priorities.

## 2. Scope

### In Scope

- Seller inventory feed and listing lifecycle (draft -> active -> reserved -> sold)
- Watch selection and listing setup
- Listing detail page with trust/safety modules
- Buy Now reservation flow
- Make Offer flow including review and submit
- Public user profile tabs (For Sale, WTB, Reference History)
- Social actions (connect/friend, report, block)

### Out of Scope

- Payment processor settlement internals
- New monetization architecture for Boost Listing (unless separately approved)
- Re-design of existing chat rendering system

## 3. Personas

- Seller: Creates listings, sets shipping and reservation terms, receives offers.
- Buyer: Views listings, sends offer or reserves directly, checks trust signals.
- Public Profile Viewer: Browses listings and references/reviews for another user.
- Moderator/Admin: Receives reports and handles abuse workflow downstream.

## 4. End-to-End Journey Requirements

## 4.1 Part 1 Requirements: Listings Management and Creation

### FR-P1-001 Inventory Feed by Status

System must return authenticated user listings for tabs All, Active, Draft, Reserved, Sold.

API:

- GET /api/v1/networks/listings

Requirements:

- Support status filtering.
- Support paging.
- Return listing cards with thumbnail, price, status, offers_count, view_count, and watch reference fields.

### FR-P1-002 Listing Overflow Actions

Each listing card must support actions:

- Preview
- Share
- Activate/Deactivate
- Edit
- Delete
- Boost Listing (feature-flagged or hidden until backend exists)

APIs:

- GET /api/v1/networks/listings/:id/preview
- PATCH /api/v1/networks/listings/:id/status
- DELETE /api/v1/networks/listings/:id

### FR-P1-003 Watch Search and Selection

Seller must search watch catalog and select exact watch record before listing detail entry.

API:

- GET /api/v1/watches?q=...

Requirements:

- Search response must include brand/model/reference and detail chips shown in Figma (dial/bezel/bracelet/materials).

### FR-P1-004 Draft Creation

Upon watch confirmation, system must create listing as draft.

API:

- POST /api/v1/networks/listings

Requirements:

- Type must support for_sale and wtb.
- Return created listing id for subsequent patching.

### FR-P1-005 Draft Editing

Seller must be able to patch listing draft incrementally.

API:

- PATCH /api/v1/networks/listings/:id

Required editable fields:

- subtitle
- description
- year
- condition
- contents
- images (3-10 at publish time)
- thumbnail
- price
- allow_offers
- shipping array
- reservation_terms

### FR-P1-006 Publish Validation

System must block publish when required listing elements are incomplete.

API:

- POST /api/v1/networks/listings/:id/publish

Current backend-required fields:

- shipping
- price > 0
- images >= 3 and <= 10
- thumbnail
- contents
- condition
- reservation_terms min length

Product-required parity additions:

- subtitle required at publish
- shipping option support includes International where required by Figma

## 4.2 Part 2 Requirements: Listing Detail, Concierge, Reservation

### FR-P2-001 Listing Detail Data Contract

Listing detail screen must present:

- Listing media and specifications
- Description
- Shipping summary
- Reservation terms summary
- Seller information card
- Trust/safety modules

API:

- GET /api/v1/networks/listings/:id
- GET /api/v1/networks/users/:id/profile

### FR-P2-002 Concierge Request

Buyer can submit concierge request from listing.

API:

- POST /api/v1/networks/listings/:id/concierge

Requirements:

- Listing must be active.
- Buyer cannot request concierge for own listing.
- Duplicate pending request handling required.

### FR-P2-003 Direct Buy Reservation

Buyer can reserve listing directly with selected shipping region.

API:

- POST /api/v1/networks/listings/:id/reserve

Requirements:

- Listing must be active and not owned by buyer.
- Requested shipping region must match listing shipping options when options exist.
- On success:
  - Create Order document
  - Transition listing status to reserved
  - Persist reservation terms snapshot
  - Open/create network listing channel

### FR-P2-004 Reservation Confirmation and Summary

Reservation summary view must show item price, shipping, total, and terms.

API:

- GET /api/v1/networks/reservations/:id

### FR-P2-005 Reference/Review Display Semantics

UI must clearly separate:

- Reviews: post-transaction ratings/comments
- Reference Checks: pre-transaction trust/vouch records

APIs:

- GET /api/v1/networks/users/:id/reviews
- GET /api/v1/networks/users/:id/references

Requirement:

- Naming in UI should match actual data source semantics.

## 4.3 Part 3 Requirements: Offer Flow + Public Profile + Safety Actions

### FR-P3-001 Make Offer Compose

Buyer must be able to submit offer with:

- amount
- shipping_region
- request_free_shipping toggle
- reservation_terms_snapshot (optional override)
- message

API:

- POST /api/v1/networks/listings/:id/offers

Validation requirements:

- amount positive integer and below asking price
- shipping_region must be controlled enum aligned with shipping matrix
- message requiredness must match product decision consistently

### FR-P3-002 Offer Review Screen Data

Offer review must display:

- listing snapshot
- seller summary
- submitted amount
- shipping selection
- expiration window
- reservation terms snapshot
- message

APIs:

- GET /api/v1/networks/offers/:id

Requirement:

- Persist and return all offer metadata fields consistently.

### FR-P3-003 Offer Submit and Lifecycle Integrity

Initial offer submission must create canonical offer state and allow later accept/reject/counter actions without divergence.

APIs:

- POST /api/v1/networks/listings/:id/offers
- POST /api/v1/networks/offers/:id/counter
- POST /api/v1/networks/offers/:id/accept
- POST /api/v1/networks/offers/:id/reject

Requirement:

- Single source of truth between Offer model and channel mirror state.

### FR-P3-004 Public Profile Tabs

Profile must support tabs:

- For Sale
- WTB
- Reference History

APIs:

- GET /api/v1/networks/users/:id/profile
- GET /api/v1/networks/users/:id/listings
- GET /api/v1/networks/users/:id/references
- GET /api/v1/networks/users/:id/reviews

Requirement:

- listings endpoint supports type filter (for_sale | wtb) for exact tab behavior.

### FR-P3-005 Profile Overflow Actions

Profile overflow actions must support:

- Share
- Report this account
- Block this account

APIs:

- POST /api/v1/networks/users/:id/report
- POST /api/v1/networks/users/:id/block
- DELETE /api/v1/networks/users/:id/block

Requirement:

- report endpoint route bridge should normalize target_type=User for account reports.

## 5. Current Codebase Gap Matrix

### Critical

1. Offer lifecycle inconsistency:

- Initial offer path updates channel.last_offer but does not guarantee canonical Offer creation in same flow.
- Accept/reject/counter flows look up active Offer records.

### High

2. Network listing channel offer schema omission:

- Offer payload fields shipping_region/request_free_shipping/reservation_terms_snapshot are written in handlers but not fully represented in persisted subdocument schema.

3. Counter payload contract mismatch:

- Route-level schema uses note while handler expects message and reservation_terms.

4. Report route bridge mismatch:

- /users/:id/report injects target_id but not target_type.

### Medium

5. Shipping enum mismatch across flows:

- updateListingSchema shipping region is US/CA only while reservation supports International.
- offer schema shipping region is unbounded string.

6. Subtitle required mismatch:

- Figma marks required but publish completeness does not enforce subtitle.

7. Public listings tab mismatch:

- No explicit type filter for For Sale vs WTB.

8. Pagination contract inconsistency:

- Mixed page/limit and limit/offset semantics in docs/routes/handlers.

9. Reference vs Review terminology mismatch in some screens.

10. Boost listing backend architecture missing.

11. Watch color persistence must be explicitly confirmed in schema to avoid strict-drop behavior.

## 6. Requirements for Backend Completion

### BR-001 Offer Canonicalization

- Ensure POST /listings/:id/offers creates/updates canonical Offer and OfferRevision entities.
- Channel last_offer can remain mirror but cannot be sole source of truth.

### BR-002 Offer Payload Persistence

- Persist all required offer metadata fields:
  - shipping_region
  - request_free_shipping
  - reservation_terms_snapshot
  - message
  - expiresAt

### BR-003 Contract Alignment

- Harmonize counter route schema and handler contract.
- Harmonize report route bridge and validation contract.

### BR-004 Shipping Consistency

- Align listing shipping enum, reservation shipping enum, and offer shipping enum to the same controlled set.
- Enforce requested offer/reservation region against listing shipping availability.

### BR-005 Publish Consistency

- Decide subtitle mandatory behavior and enforce consistently in backend and frontend.

### BR-006 Profile API Support

- Add type filter for listings endpoint to support For Sale/WTB tabs.
- Standardize pagination semantics across endpoint docs and validation.

## 7. Requirements for Frontend Completion

### FE-001 Tab-to-API Mapping

- Map profile Reference History to the intended datasource:
  - reviews for buyer/seller role tab behavior
  - references for pre-transaction trust checks

### FE-002 Offer Form Validation Parity

- Enforce same required/optional rules as backend.
- Prevent invalid shipping selection based on listing shipping options.

### FE-003 Fallback Behavior

- Handle blocked interactions, expired offers, and unavailable shipping region with actionable error states.

### FE-004 Feature Gating

- Hide Boost Listing until backend and pricing flow exist.

## 8. Acceptance Criteria

### AC-A Listings and Publish

1. User can create draft from watch selection and persist all listing fields.
2. Publish fails with explicit missing list when required fields are absent.
3. Publish succeeds only when completeness criteria are met.

### AC-B Reservation

1. Buyer can reserve active listing with valid shipping region.
2. Invalid shipping region returns validation error.
3. Successful reservation returns order with terms snapshot and pricing totals.

### AC-C Offer

1. Buyer can submit initial offer and retrieve it in review/get endpoints.
2. Seller can accept/reject/counter submitted offer without missing canonical record errors.
3. Shipping and terms metadata round-trip correctly.

### AC-D Public Profile and Safety

1. Profile tabs For Sale/WTB/Reference History return expected server-filtered data.
2. Report account succeeds with only reason and description from client for user reports.
3. Block action removes mutual connection paths and reflects updated status.

## 9. Non-Functional Requirements

- Data integrity: offer and order transitions must be transaction-safe.
- Auditability: critical commerce transitions must be event logged.
- Performance: listing/profile endpoints should remain paginated and index-backed.
- Backward compatibility: maintain route compatibility where possible, with versioned deprecations if needed.

## 10. Delivery Plan

### Milestone 1 (Stability)

- Offer canonicalization and schema persistence fixes
- Counter/report contract fixes

### Milestone 2 (Parity)

- Shipping parity and subtitle parity
- Profile type filter and pagination normalization

### Milestone 3 (Product Completion)

- Reference/review UX naming resolution
- Boost listing go/no-go decision

## 11. Risks and Dependencies

- Mobile/web clients may currently rely on route quirks (counter note vs message).
- Existing data may contain mixed offer/channel states requiring migration or reconciliation script.
- Product clarification needed on mandatory message and subtitle behavior.

## 12. Single-Doc Source Traceability

This master requirements doc consolidates and supersedes the planning perspective from:

- docs/BATCH_3_PART_1_LISTINGS_API_GUIDE.md
- docs/BATCH_3_PART_2_FIGMA_GAP_ANALYSIS.md
- docs/BATCH_3_PART_3_FINAL_FIGMA_GAP_ANALYSIS.md
- docs/BATCH_3_MASTER_PART1_PART2_PART3_CODEBASE_GUIDE.md
