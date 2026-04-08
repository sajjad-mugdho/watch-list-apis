# Batch 4 Master Guide: End-to-End Feature and Batch Consolidation

Date: April 6, 2026
Status: Consolidated Master Guide (Parts 1-4)
Scope: Social Hub, Messaging, Group Operations, Negotiation, Reference Checks, Trust & Safety, and Order Closure

---

## 1. Purpose of This Guide

This document is the single source for Batch 4 implementation across all parts. It consolidates:

1. Feature-wise behavior from entry to closure.
2. Batch-wise scope progression (Part 1 -> Part 4).
3. Unified backend contracts and state machines.
4. Delivery sequence and test strategy.

This guide is written to remain consistent with previous established context from Batch 2 and Batch 3.

---

## 2. Batch-Wise Consolidation

## Part 1 (Foundation): Social Hub Core Messaging

Primary scope:

1. Social Hub shell and tab architecture.
2. Message search and conversation list.
3. 1:1 and group chat basics.
4. Discovery entrypoints and friend/group request handling.
5. Chat details, user context, mute/block/report foundations.

Deliverables recap:

- Real-time messaging foundation.
- Chat list + unread logic.
- Search and discovery baseline.
- Safety primitives.

## Part 2 (Expansion): Group Operations + Shared Content + Transaction Cards

Primary scope:

1. Group detail variants by role (admin/member).
2. Member management actions and common groups surfaces.
3. Shared media/links/files extraction views.
4. Offers and inquiries consolidated list view.
5. Transaction events embedded in chat timeline.

Deliverables recap:

- Role-aware group capabilities.
- Content indexing projections for chat assets.
- Transaction context rendered in communication layer.

## Part 3 (Trust Activation): Negotiation + Reference Checks Lifecycle

Primary scope:

1. Counter-offer composer and reservation terms versioning.
2. Offer details modal with current/previous terms.
3. Decline guardrail confirmation flow.
4. Reference Checks feed (empty + populated states).
5. Reference Check detail with vouching, feedback, and completion handshake.

Deliverables recap:

- Negotiation controls + terms governance.
- Dedicated trust workflow separate from reviews.
- Active-to-completed check lifecycle.

## Part 4 (Closure & Exceptions): Trust & Safety + Finalization

Primary scope:

1. Completed reference-check terminal state.
2. Suspended under-review trust-safety state.
3. Pre-vouch legal acknowledgment modal.
4. Order details with reference-check initiation/progress.
5. Dual-party order completion confirmation and waiting states.
6. Unified transaction history normalization.

Deliverables recap:

- Exception handling and compliance controls.
- Policy-gated order closure.
- Full end-state auditability.

---

## 3. Feature-Wise End-to-End Flows

## Flow A: Social Communication Flow

1. User opens Social Hub.
2. User browses mixed chat list (1:1 + groups).
3. User searches messages/users/groups.
4. User opens conversation and exchanges messages.
5. User uses reactions, replies, thread actions.
6. User accesses chat details and shared content.

Key systems involved:

- Chat service
- Presence service
- Search index
- Media/files projection

## Flow B: Group Participation and Management Flow

1. User enters group details.
2. Server resolves role (owner/admin/mod/member).
3. UI renders role-specific actions.
4. Admin path: add/remove members.
5. Member path: follow users, leave group, report group.
6. Group content (media/links/files) accessible by permission.

Key systems involved:

- Group membership + roles
- Policy authorization
- Content index projections

## Flow C: Negotiation to Order Flow

1. Inquiry/offer thread starts.
2. Offer Details modal shown with terms and expiry.
3. User may counter, accept, or decline.
4. Counter creates new terms version + timeline event.
5. Accept transitions into order flow.
6. Order detail page shows reservation + shipping + timeline.

Key systems involved:

- Offer service
- Terms versioning
- Order orchestration
- Timeline event service

## Flow D: Reference Check Trust Flow

1. From order, user initiates reference check.
2. Reference check becomes active with expiration window.
3. Community participants vouch and comment.
4. Completion requires bilateral confirmations.
5. Completed check becomes read-only terminal record.

Exception path:

- Trust & Safety can suspend check under review.
- Suspended state blocks normal mutation actions.

Key systems involved:

- Reference check service
- Vouch/feedback service
- Trust & Safety review service
- Notification service

## Flow E: Final Completion Handshake

1. One party confirms order completion.
2. State becomes waiting_for_partner.
3. Other party confirms.
4. Order transitions to completed.
5. Timeline appends final event and locks mutable actions.

Key systems involved:

- Order completion handshake store
- Notification triggers
- State machine guards

---

## 4. Unified Domain Model Map

Core entities:

1. User
2. Group
3. Chat
4. Message
5. Offer
6. OfferTermsVersion
7. Order
8. ReferenceCheck
9. ReferenceVouch
10. ReferenceFeedback
11. TrustSafetyReview
12. UnifiedTransactionEvent

Relationship highlights:

1. Chat links users and optionally a group.
2. Offer links to listing snapshot and participants.
3. Order links to accepted offer.
4. ReferenceCheck links to order/offer and participants.
5. TransactionEvent links to order and source artifacts.

Design rule:

- Offers, orders, and checks remain source entities; chat timeline stores event projections, not duplicated source-of-truth records.

---

## 5. Master API Surface (Consolidated)

## A. Messaging and Social Hub

1. GET /networks/social-hub/status
2. GET /networks/messages/chats
3. GET /networks/messages/:chatId/history
4. POST /networks/messages/:chatId/send
5. PATCH /networks/messages/:messageId/edit
6. DELETE /networks/messages/:messageId
7. POST /networks/messages/:messageId/react
8. GET /networks/messages/search

## B. Group and Membership

1. GET /networks/groups/:groupId/details
2. GET /networks/groups/:groupId/members
3. POST /networks/groups/:groupId/members/invite
4. DELETE /networks/groups/:groupId/members/:memberId
5. POST /networks/groups/:groupId/leave
6. POST /networks/groups/:groupId/report
7. GET /networks/users/:userId/common-groups

## C. Shared Content

1. GET /networks/chats/:chatId/media
2. GET /networks/chats/:chatId/links
3. GET /networks/chats/:chatId/files

## D. Offers and Negotiation

1. GET /networks/offers/:offerId/details
2. GET /networks/offers/:offerId/terms-history
3. POST /networks/offers/:offerId/counter
4. POST /networks/offers/:offerId/accept
5. POST /networks/offers/:offerId/decline

## E. Orders and Closure

1. GET /networks/orders/:orderId/details
2. GET /networks/orders/:orderId/history
3. POST /networks/orders/:orderId/reference-check/initiate
4. POST /networks/orders/:orderId/confirm-complete
5. GET /networks/orders/:orderId/completion-status

## F. Reference Checks

1. GET /networks/reference-checks
2. GET /networks/reference-checks/summary
3. GET /networks/reference-checks/:checkId
4. GET /networks/reference-checks/:checkId/context
5. GET /networks/reference-checks/:checkId/feedback
6. POST /networks/reference-checks/:checkId/feedback
7. GET /networks/reference-checks/:checkId/vouch-policy
8. POST /networks/reference-checks/:checkId/vouches
9. POST /networks/reference-checks/:checkId/confirm-complete
10. GET /networks/reference-checks/:checkId/audit

## G. Trust & Safety

1. GET /networks/reference-checks/:checkId/trust-safety/status
2. POST /networks/reference-checks/:checkId/trust-safety/appeal

---

## 6. Unified State Machines

## Reference Check States

States:

1. draft
2. active
3. completed
4. suspended
5. expired
6. cancelled

Transitions:

1. draft -> active (initiated)
2. active -> completed (dual confirm + policy pass)
3. active -> suspended (trust-safety trigger)
4. suspended -> active (review cleared)
5. active -> expired (time elapsed)
6. active -> cancelled (manual/admin)

Rules:

1. completed and suspended block normal mutation actions.
2. trust-safety routes can still operate in suspended state.

## Order Completion States

States:

1. reserved_pending
2. reference_check_in_progress
3. ready_to_complete
4. waiting_partner_confirmation
5. completed
6. disputed

Rules:

1. If reference check is required, completion gating depends on check policy.
2. Completed requires both buyer and seller confirmation.

---

## 7. Policy and Compliance Rules

1. Reference Checks and Reviews are separate concepts and routes.
2. Vouching is not social endorsement; legal-risk warning is mandatory before submit.
3. Policy copy should be versioned and server-delivered.
4. Suspended checks must show clear under-review messaging.
5. Audit trails must be immutable and queryable for trust investigations.

---

## 8. End-to-End Delivery Plan (Feature-Wise + Batch-Wise)

## Stage 1: Social Core (Part 1)

1. Build chat, search, and discovery baseline.
2. Integrate real-time channel/presence foundations.
3. Deliver message safety and moderation primitives.

## Stage 2: Group + Context Expansion (Part 2)

1. Add role-based group controls.
2. Add shared content extraction endpoints.
3. Add transaction cards in communication flows.

## Stage 3: Negotiation + Trust Activation (Part 3)

1. Add counter-offer + terms versioning.
2. Add offer decision controls and decline guardrails.
3. Launch reference checks feed and detail workflows.

## Stage 4: Trust Exceptions + Closure (Part 4)

1. Add suspended/completed trust states.
2. Add vouch legal acknowledgment gate.
3. Add order completion handshake and final timeline coherence.

---

## 9. QA Strategy (Consolidated)

Functional scenarios:

1. Send/edit/delete message and verify history integrity.
2. Group role matrix enforcement (admin/member permissions).
3. Shared media/links/files accuracy and pagination.
4. Offer accept/decline/counter transitions with terms versions.
5. Reference check active flow with vouch and feedback.
6. Completed check action lock validation.
7. Suspended check mutation blocking validation.
8. Order dual-confirm completion gating.
9. End-to-end timeline ordering from inquiry to completion.

Negative scenarios:

1. Vouch without policy acknowledgment.
2. Confirm completion when policy gate not met.
3. Unauthorized member removal.
4. Mutations during suspended state.

Performance scenarios:

1. Reference check list query with filters and search.
2. Order history retrieval with event joins.
3. Shared content endpoints under high volume.

---

## 10. Open Product/Engineering Decisions

1. Minimum vouch threshold needed before check completion unlock.
2. Whether comments are allowed during suspended checks.
3. Whether admins can force-complete in dispute pathways.
4. Exact rule for reference check expiry impact on order completion.
5. Visibility policy for secret groups in context surfaces.

---

## 11. Source Documents Used

Part guides:

1. docs/BATCH_4_PART_1/
2. docs/BATCH_4_PART_2/
3. docs/BATCH_4_PART_3/
4. docs/BATCH_4_PART_4/

This master guide should be treated as the orchestration layer above part-specific detailed specs.

---

## 12. Final Implementation Principle

Implement Batch 4 as one coherent trust-enabled transaction ecosystem:

1. Communicate (messages/groups)
2. Negotiate (offers/counters/terms)
3. Validate trust (reference checks/vouches)
4. Handle exceptions (suspension/review)
5. Close safely (dual confirmation + auditable timeline)
