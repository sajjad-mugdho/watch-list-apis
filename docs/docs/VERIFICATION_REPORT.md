# Gap Analysis Verification Report

This report summarizes the alignment between the findings in [GAP_ANALYSIS.md](./GAP_ANALYSIS.md) and the current state of the codebase (as of 2026-02-09).

## Overview 📊

The `GAP_ANALYSIS.md` document is partially out of sync with the codebase. Several features identified as "Gaps" or "Missing" have already been implemented as "V2" versions or new models, although some implementation details (like the Outbox Publisher) remain incomplete.

## Detailed Alignment Table 🔍

| Component | Status in GAP_ANALYSIS.md | Actual Codebase State | Alignment |
| :--- | :--- | :--- | :--- |
| **Offers** | Embedded in channel docs. | **V2 Implemented**. First-class `Offer` and `OfferRevision` models exist. V1 still exists in legacy channels. | ⚠️ Partial (V2 exists but V1 remains) |
| **Event Outbox** | Missing / No outbox table. | **Implemented**. `EventOutbox` model exists and is used in `OfferServiceV2`. | ❌ **Misaligned** (Already exists) |
| **Outbox Publisher** | Missing. | **Still Missing**. No publisher worker found in `src/workers` or `src/index.ts`. | ✅ **Aligned** |
| **Vouching System** | Missing `vouches` model. | **Implemented**. `Vouch.ts` model exists with unique constraints and immutable guards. | ❌ **Misaligned** (Already exists) |
| **Reservation Terms** | Missing. | **Implemented**. `ReservationTerms.ts` exists and is used in V2 offer flows. | ❌ **Misaligned** (Already exists) |
| **Trust & Safety** | Missing `trust_cases`. | **Implemented**. `TrustCase.ts` model exists with evidence snapshots and case management logic. | ❌ **Misaligned** (Already exists) |
| **Conversations** | Missing model. | **No MongoDB Model**. However, `conversationRoutes` and `ChannelContextService` provide the functionality. | ⚠️ Partial (Service exists, model still missing) |
| **Order Snapshotting** | Partial / Incomplete. | **Improved in V2**. `OfferServiceV2` adds `offer_id`, `offer_revision_id`, and `reservation_terms_id` to orders. | ⚠️ Partial (V2 addresses it, V1 remains partial) |

## Key Findings 🔦

1.  **V2 Migration in Progress**: The project is in the middle of a migration from "V1" (embedded/legacy) to "V2" (first-class models). [GAP_ANALYSIS.md](./GAP_ANALYSIS.md) seems to describe the V1 state as the "Current" state, overlooking that some V2 components are already built.
2.  **Outbox Logic Gap**: While the `EventOutbox` table exists and is being populated by `OfferServiceV2`, there is no worker process to actually read and publish these events. This logic is indeed a gap.
3.  **Trust & Vouching**: The models for these exist (`TrustCase`, `Vouch`), but their integration into the primary application routes (outside of V2 offers) may still be incomplete.
4.  **Route Versioning**: The API is correctly versioned. Legacy routes remain on `/v1/marketplace/offers`, while the new implementation is on `/v2/marketplace/offers`.

## Suggested Next Steps 🛠️

1.  **Implement Outbox Publisher**: Create a worker to process `EventOutbox` entries.
2.  **Update GAP_ANALYSIS.md**: Refine the document to reflect that models for Vouches, Trust Cases, and Reservation Terms already exist.
3.  **Deprecation Plan**: Formulate a plan to migrate legacy data from channel-embedded offers to the new first-class `Offer` models.
4.  **Complete Conversations Model**: If desired, implement a dedicated `Conversation` model to fully decouple chat/business logic as originally planned.
