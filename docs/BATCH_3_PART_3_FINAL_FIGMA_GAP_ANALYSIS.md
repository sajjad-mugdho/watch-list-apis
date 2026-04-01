# Networks Batch 3, Part 3 (Final): Offer Flow + Public Profile + Safety Actions

This document analyzes the final Figma screens for Batch 3 Part 3 against current backend behavior in the Networks codebase.

Scope covered:

- Make an Offer flow (compose, shipping selection, free shipping toggle, reservation terms editing, message)
- Review Offer screen and submit action
- Offer submitted confirmation state on listing detail
- Public Profile screen (For Sale, WTB, Reference History)
- Public Profile overflow actions (Share, Report account, Block account)

---

## Screen Group A: Make an Offer (Compose)

### Figma behavior

- User enters offer amount.
- User picks shipping country from United States, Canada, International.
- Optional "Request free shipping" toggle.
- User can review and optionally edit reservation terms before submit.
- Message is marked required in UI.

### Codebase mapping

- Endpoint: POST /api/v1/networks/listings/:id/offers
- Route file: src/networks/routes/listingRoutes.ts
- Handler: networks_offer_send in src/networks/handlers/NetworksOfferHandlers.ts
- Validation: sendOfferSchema in src/validation/schemas.ts

### Alignment

- Amount validation exists (positive integer and below asking price).
- Block relationship checks exist between buyer and seller.
- Offer expiry is set to 24h in Networks channel last_offer logic.
- Seller notification is created with type offer_received.

### Gaps

1. Shipping region is under-validated.

- Current schema uses shipping_region as free-form string, not enum.
- No handler check that selected region exists in listing.shipping options.
- Figma requires controlled options and valid, selectable regions.

2. Message required mismatch.

- UI marks Message as required.
- Backend schema keeps message optional.

3. Shipping and terms fields are dropped from channel last_offer persistence.

- Handler sets shipping_region, request_free_shipping, reservation_terms_snapshot on last_offer.
- NetworkListingChannel OfferSchema does not define these fields.
- Result: strict subdocument schema drops these values from stored channel payload and read APIs.

4. Canonical Offer document creation gap.

- networks_offer_send writes only NetworkListingChannel last_offer.
- It does not call networksOfferService.sendOffer and does not create an Offer record.
- Later endpoints (accept, reject, counter) query Offer collection by channel_id and active state.
- This creates a lifecycle consistency risk where downstream offer actions cannot find an active Offer entity.

---

## Screen Group B: Make an Offer (Shipping Dropdown + Free Shipping Toggle States)

### Figma behavior

- Dropdown shows United States, Canada, International.
- Shipping cost shown for selected region.
- Free shipping toggle visually updates shipping cost display.

### Codebase mapping

- sendOfferSchema supports request_free_shipping.
- networks_offer_send places request_free_shipping and shipping_region into channel last_offer.

### Gaps

1. request_free_shipping is not structurally persisted in channel offer schema.
2. No backend validation links offer shipping_region to listing shipping matrix.
3. No canonical order-level mapping for shipping request from offer acceptance path.

---

## Screen Group C: Review Offer

### Figma behavior

- Shows listing snapshot, seller summary, offer amount, selected shipping, 24h expiry, reservation terms, and buyer message.
- User confirms and submits offer.

### Codebase mapping

- GET /api/v1/networks/offers/:id returns channel detail.
- POST /api/v1/networks/listings/:id/offers submits initial offer.

### Alignment

- Listing snapshot fields are present in channel.listing_snapshot.
- 24h expiry exists on channel last_offer.expiresAt.

### Gaps

1. Review payload incompleteness risk.

- Shipping fields and free-shipping flag may be absent due to channel schema omission.
- Reservation terms snapshot may also be missing in channel read response for same reason.

2. Counter-offer contract mismatch at route level.

- Route-local counter schema in src/networks/routes/offerRoutes.ts expects body.note.
- Handler expects body.message and body.reservation_terms.
- This contract mismatch blocks terms-edit parity and creates inconsistent client payload expectations.

---

## Screen Group D: Offer Sent Confirmation on Listing Detail

### Figma behavior

- User sees immediate confirmation toast and returns to listing detail.

### Codebase mapping

- networks_offer_send creates seller notification of type offer_received.
- Stream system message is sent when channel exists/created.

### Alignment

- Backend emits notification and chat events suitable for confirmation UX.

### Gap

- No dedicated offer submission receipt endpoint; frontend must trust immediate POST success + optional channel fetch.

---

## Screen Group E: Public Profile (For Sale, WTB, Reference History)

### Figma behavior

- Header: user identity, location, joined date, counts, rating.
- Tabs: For Sale, WTB, Reference History.
- Search and status filters in listings grid.

### Codebase mapping

- Profile: GET /api/v1/networks/users/:id/profile
- Public listings: GET /api/v1/networks/users/:id/listings
- References: GET /api/v1/networks/users/:id/references
- Reviews (role filter): GET /api/v1/networks/users/:id/reviews
- Connection actions: POST/DELETE /api/v1/networks/users/:id/connections

### Alignment

- Profile endpoint returns review and reference aggregates plus activeListingsCount.
- Listings endpoint supports status=active|sold|all and search query.
- References endpoint exists for Reference History tab.

### Gaps

1. Missing type filter for For Sale vs WTB tab split.

- Status: Resolved.
- Public listings supports explicit type filtering (for_sale|wtb).

2. Pagination contract drift.

- Validation schema for public listings uses page + limit.
- Route swagger comments mention limit + offset in multiple places.
- Handler itself uses page + limit.
- This inconsistency can create frontend integration confusion.

---

## Screen Group F: Public Profile Overflow Actions (Share, Report, Block)

### Figma behavior

- Overflow menu provides Share, Report this account, Block this account.

### Codebase mapping

- Report route: POST /api/v1/networks/users/:id/report
- Block route: POST /api/v1/networks/users/:id/block
- Unblock route: DELETE /api/v1/networks/users/:id/block

### Alignment

- Block and unblock actions are implemented with bridge mapping.
- Blocking severs both-direction connection edges and updates follower/following stats.

### Gap

1. Report bridge does not inject target_type.

- Status: Resolved.
- Route bridge injects target_id and defaults target_type=User.

---

## Final Gap Severity Summary

P0 Critical

- Initial offer send split-brain risk is resolved by canonical Offer creation via OfferService.

P1 High

- last_offer schema persistence parity: resolved.
- report user bridge target_type normalization: resolved.
- counter-offer route schema mismatch: resolved.

P2 Medium

- Offer shipping_region is free-form and not validated against listing shipping options.
- Message required mismatch between UI and backend.
- Missing public listings type filter for For Sale vs WTB tab.
- Pagination documentation/schema drift (page/limit vs limit/offset references).

---

## Recommended Backend Action Plan

1. Offer lifecycle integrity

- Update networks_offer_send to invoke networksOfferService.sendOffer and keep channel mirror in sync.

2. Channel offer schema completeness

- Extend OfferSchema in src/networks/models/NetworkListingChannel.ts with:
  - shipping_region
  - request_free_shipping
  - reservation_terms_snapshot

3. Validation hardening

- Change sendOfferSchema shipping_region to enum [US, CA, International].
- Validate requested shipping region against listing.shipping entries when present.
- Decide and enforce message requiredness parity with Figma.

4. Route/schema contract fixes

- Align /networks/offers/:id/counter route schema with handler fields message and reservation_terms.
- In /networks/users/:id/report bridge, inject target_type=User by default.

Status:

- Both route/schema fixes are implemented.

5. Profile tab support

- Add type filter (for_sale|wtb) to public listings endpoint for exact tab semantics.
- Standardize pagination contract in docs and schema.
