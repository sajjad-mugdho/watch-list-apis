# Batch 3 Networks Full Gap Analysis Log

Date: April 1, 2026
Engineer: GitHub Copilot
Scope: Final source-verified Batch 3 gap analysis for networks APIs, payloads, responses, and screen alignment

## Completed

1. Verified mounted routes and handlers for listings, offers, users, reservations/orders.
2. Verified request contracts directly from route validators and shared schemas.
3. Verified response behavior from handlers and model usage.
4. Produced a screen-by-screen alignment matrix with Aligned/Partial/Not Aligned statuses.
5. Produced severity-ranked gap backlog (P0/P1/P2) with code evidence.

## Deliverable

- docs/BATCH_3_NETWORKS_FULL_GAP_ANALYSIS.md

## Critical Finding Captured

- Offer lifecycle inconsistency:
  - Initial send-offer path writes channel.last_offer.
  - Counter/accept/reject paths require active canonical Offer by channel_id.
  - This can break follow-up actions despite visible offer state in channel payload.

## Implementation Update (Applied)

1. Offer lifecycle consistency (Networks)

- Updated networks send-offer flow to create canonical Offer records in addition to channel mirror updates.
- File: src/networks/handlers/NetworksOfferHandlers.ts

2. Channel offer mirror schema parity

- Added missing fields to persisted channel offer schema:
  - shipping_region
  - request_free_shipping
  - reservation_terms_snapshot
- File: src/networks/models/NetworkListingChannel.ts

3. Counter contract alignment

- Removed local route schema drift and reused shared counter schema contract.
- File: src/networks/routes/offerRoutes.ts

4. Report bridge normalization

- Updated /users/:id/report bridge to inject target_type=User by default.
- File: src/networks/routes/usersRoutes.ts

5. Shipping and public listings parity

- updateListing shipping enum now includes International.
- sendOffer shipping_region now validates with enum [US, CA, International].
- Public listings query supports type filter (for_sale|wtb).
- Files:
  - src/validation/schemas.ts
  - src/networks/handlers/NetworksUserHandlers.ts

6. Reservation read path clarity

- Mounted explicit reservations GET route:
  - GET /api/v1/networks/reservations/:id
- Files:
  - src/networks/routes/reservationRoutes.ts (new)
  - src/networks/index.ts

7. Watch schema parity

- Added color field to Watch schema to match interface and extraction usage.
- File: src/models/Watches.ts

## Batch 2/Shared Guardrails

- Shared subtitle publish requirement was intentionally not changed.
- Shared schema changes are additive (enum expansion and optional query filter).

## Validation Status

- File-level diagnostics for all changed files: no TypeScript/editor errors reported.
