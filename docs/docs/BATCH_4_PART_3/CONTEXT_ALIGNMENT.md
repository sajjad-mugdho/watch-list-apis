# Batch 4 Part 3 Context Alignment

Date: April 6, 2026

## Purpose

Keep Part 3 fully aligned with Batch 2, Batch 3, Batch 4 Part 1, and Batch 4 Part 2 without contract drift.

## Hard Context Constraints

1. Messaging remains in Networks scope and uses existing chat envelope conventions.
2. Offer and order entities remain source-of-truth in transaction modules; chat/reference screens consume references and snapshots.
3. Reference Checks are a distinct trust workflow and must not be silently merged with Reviews.
4. Part 1 chat and Part 2 group/content contracts remain valid; Part 3 adds negotiation + trust-check lifecycle surfaces.
5. ApiResponse contract shape must be consistent (`data`, optional `_metadata`, `requestId`).

## What Part 3 Adds

1. Counter-offer composer with reservation term editing and note support.
2. Offer details modal with accept/decline and reservation terms history tabs.
3. Decline confirmation guardrail modal.
4. Social Hub Reference Checks tab with search + filters + active/completed list cards.
5. Reference Check detail page with vouch actions, policy panel, feedback feed, and completion handshake.
6. Completed reference check terminal state banner/footer.

## Cross-Batch Reuse

- From Batch 2: user identity, badges/verification, connection filters.
- From Batch 3: offer lifecycle, amount/currency semantics, reservation terms.
- From Part 1/2: chat timeline, transaction event embedding, shared content surfaces.

## Explicit Separation Rule

- Reviews = post-transaction reputation content.
- Reference Checks = in-transaction community vouching workflow.
- APIs and UI labels must preserve this separation.
