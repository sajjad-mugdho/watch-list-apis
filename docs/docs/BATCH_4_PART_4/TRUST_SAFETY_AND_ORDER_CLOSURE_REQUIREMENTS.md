# Batch 4 Part 4: Trust, Safety, and Order Closure - Requirements Analysis

Date: April 6, 2026
Status: Part 4 Analysis Complete
Figma Scope: Reference check terminal/suspension states, vouch warning modal, order detail with reference-check orchestration and completion handshake

---

## 1. Executive Summary

Part 4 closes the Batch 4 lifecycle by defining what happens at the **end and exception states** of trust-enabled transactions.

Core outcomes:

1. Completed reference check final view with immutable trust record.
2. Suspended reference check under Trust & Safety review (read-only enforcement).
3. Explicit legal-risk confirmation modal before a user can vouch.
4. Order detail page integrating reference-check initiation and progress tracking.
5. Order-level completion handshake with waiting state for counterpart confirmation.

This part operationalizes governance, auditability, and finalization controls around the deal lifecycle.

---

## 2. Screen-by-Screen Analysis

## Screen 1: Reference Check Detail - Completed State

Observed UI:

- Header: Reference Check #8821
- Blue banner: REFERENCE CHECK COMPLETED
- Participant panel (seller/buyer, vouch counts)
- Reservation terms block
- Important Info & Actions accordion
- Community feedback list
- Bottom success strip: Reference check Completed, both parties have confirmed

Requirements:

1. Completed state must be immutable for core actions:
   - no new vouch submissions

- no completion confirmations

2. Show final status badges and timestamps.
3. Retain read-only visibility of policy and feedback.
4. Ensure audit access for trust investigations.
5. Keep detail accessible from list and order history deep links.

System rules:

- Terminal status: `completed`
- Allowed actions: view/share/report (policy-dependent)
- Forbidden actions: vouch, edit terms, reopen by user

Endpoints needed:

- GET /networks/reference-checks/:checkId
- GET /networks/reference-checks/:checkId/audit

---

## Screen 2: Reference Check Detail - Suspended (Under Review)

Observed UI:

- Red suspension banner: SUSPENDED - Under Review by Trust & Safety
- Core transaction and participant info remains visible
- Policy and feedback visible
- Bottom completion strip still visible in screenshot but should be state-governed

Requirements:

1. Suspension state is controlled by Trust & Safety workflow.
2. All mutation actions disabled while suspended:
   - vouch submit
   - confirm complete
   - feedback posting (configurable)
3. Display suspension reason category and review status.
4. Preserve full evidence view for involved participants.
5. Add escalation metadata (opened_by, opened_at, SLA target).

System rules:

- Status: `suspended`
- Substatus examples: `under_review`, `awaiting_user_response`, `resolved`

Endpoints needed:

- GET /networks/reference-checks/:checkId
- POST /networks/reference-checks/:checkId/trust-safety/appeal (optional)
- GET /networks/reference-checks/:checkId/trust-safety/status

---

## Screen 3: Vouch Warning Modal (Pre-Submit Confirmation)

Observed UI:

- Modal title: Wait! Read Before Vouching
- User-specific statement: You are about to vouch for Michael L. (Seller)
- Warning bullets:
  - Not a "Like"
  - No legal protection
- CTA: Cancel / Submit Vouch

Requirements:

1. Vouch requires explicit risk acknowledgment before submission.
2. Modal copy should be server-driven/config-driven for legal updates.
3. Modal must clearly show target user and role (seller/buyer).
4. Submit action should include acknowledgment token/version.
5. Cancel returns without side effects.

Data requirements:

- Store accepted policy version on vouch event.

Endpoints needed:

- GET /networks/reference-checks/:checkId/vouch-policy
- POST /networks/reference-checks/:checkId/vouches

Payload must include:

- target_user_id
- policy_version_accepted
- ack_timestamp

---

## Screen 4: Order Detail - Reserved & Pending (Reference Check Not Started)

Observed UI:

- Modal header: Order #849302
- Blue status card: Reserved & Pending
- Listing snapshot and description
- Seller -> buyer shipping route
- Reservation terms block
- Shipping country row
- Reference Check module with CTA: Initiate Reference Check
- Transaction history timeline showing milestones
- Bottom rail: Mark Order as Complete + Confirm

Requirements:

1. Order detail aggregates listing snapshot, participant info, terms, shipping, timeline.
2. Reference Check module appears when order is eligible for trust verification.
3. Initiate Reference Check starts check and links order <-> check.
4. Timeline should append event: Reference Check Started.
5. Order completion action should enforce policy gate:
   - if reference check required and not complete, block or warn based on config.

Endpoints needed:

- GET /networks/orders/:orderId/details
- POST /networks/orders/:orderId/reference-check/initiate
- POST /networks/orders/:orderId/confirm-complete

---

## Screen 5: Order Detail - Reference Check In Progress

Observed UI:

- Same order header and core blocks
- Reference check card shows:
  - status text: Reference Check In progress
  - order/check id
  - remaining time
  - progress tracker (started, people vouched, completed)
  - CTA: View Details
- Bottom rail shows waiting state for counterpart confirmation

Requirements:

1. Reference check card state must be synchronized with check lifecycle.
2. Progress milestones should be backend-computed and stable.
3. View Details deep-links to check detail page.
4. Bottom completion rail reflects confirmation handshake state:
   - current user confirmed?
   - counterpart confirmed?
5. Disable final completion button until allowed by policy and role.

Endpoints needed:

- GET /networks/orders/:orderId/details
- GET /networks/reference-checks/:checkId/progress
- POST /networks/orders/:orderId/confirm-complete

---

## Screen 6: Order Completion Handshake (Confirm/Waiting)

Observed UI across order screens:

- Bottom track: YOU --- lock --- PARTNER
- CTA variants:
  - Confirm
  - Waiting...
- Instruction text: other party must also confirm

Requirements:

1. Order completion requires dual acknowledgment from both parties.
2. Handshake state should be explicit and idempotent.
3. UI states:
   - idle (can confirm)
   - confirmed_by_you_waiting_partner
   - confirmed_by_partner_waiting_you
   - completed
4. Emit notifications on each confirmation event.
5. Prevent duplicate confirmation writes.

Endpoints needed:

- GET /networks/orders/:orderId/completion-status
- POST /networks/orders/:orderId/confirm-complete

---

## Screen 7: Reference Check Detail with Mutual Connections Context

Observed UI (modal underlay shows participant rail with mutual friends count):

- Seller and buyer with mutual friends cluster and count
- Supports trust-context before vouching

Requirements:

1. Show mutual connection context on check detail when available.
2. Mutual count should be derived from social graph service.
3. Do not expose private connection identities beyond policy.
4. Use mutual context as informative signal, not automatic trust.

Endpoints needed:

- GET /networks/reference-checks/:checkId/context

---

## Screen 8: Timeline and Status Normalization

Observed cues:

- Transaction History list on order screen includes:
  - Inquiry Started
  - Offer Received
  - Counter Offer Sent
  - Offer Accepted
  - Reference Check Complete
  - Order Completed
- Timestamps on each step

Requirements:

1. Normalize all timeline events under one schema and source.
2. Ensure chronological integrity with immutable event log.
3. Link each event to source entity id (inquiry/offer/check/order).
4. Keep UI labels mapped from canonical event enums.

Endpoints needed:

- GET /networks/orders/:orderId/history

---

## 3. State Machine Requirements

## Reference Check State Machine

States:

- draft
- active
- completed
- suspended
- expired
- cancelled

Transitions:

1. draft -> active (initiated)
2. active -> completed (both confirmations + policy satisfied)
3. active -> suspended (trust-safety trigger)
4. suspended -> active (review cleared)
5. active -> expired (time elapsed)
6. active -> cancelled (manual/admin flow)

Rules:

- completed is terminal for user mutations.
- suspended blocks mutations except trust-safety managed routes.

## Order Completion State Machine

States:

- reserved_pending
- reference_check_in_progress
- ready_to_complete
- completion_waiting_partner
- completed
- disputed

Rules:

1. If `reference_check_required=true`, cannot reach ready_to_complete until check state policy passes.
2. completion_waiting_partner requires one-sided confirmation stored with timestamp.
3. completed only when both parties confirmed.

---

## 4. Data Model Additions

```typescript
interface TrustSafetyReview {
  id: ObjectId;
  target_type: "reference_check" | "order" | "feedback";
  target_id: ObjectId;
  status: "open" | "under_review" | "resolved" | "dismissed";
  reason_code: string;
  notes?: string;
  opened_by: ObjectId;
  assigned_to?: ObjectId;
  opened_at: Date;
  resolved_at?: Date;
}

interface VouchPolicyAcceptance {
  id: ObjectId;
  check_id: ObjectId;
  user_id: ObjectId;
  target_user_id: ObjectId;
  policy_version: string;
  accepted_at: Date;
}

interface ReferenceCheckProgress {
  check_id: ObjectId;
  started_at: Date;
  vouches_count: number;
  required_vouches?: number;
  completed_at?: Date;
  expires_at: Date;
}

interface OrderCompletionConfirmation {
  order_id: ObjectId;
  buyer_confirmed_at?: Date;
  seller_confirmed_at?: Date;
  completed_at?: Date;
}

interface UnifiedTransactionEvent {
  id: ObjectId;
  order_id: ObjectId;
  event_type:
    | "inquiry_started"
    | "offer_received"
    | "counter_offer_sent"
    | "offer_accepted"
    | "reference_check_started"
    | "reference_check_completed"
    | "order_completed"
    | "reference_check_suspended";
  source_type:
    | "inquiry"
    | "offer"
    | "reference_check"
    | "order"
    | "trust_safety";
  source_id: ObjectId;
  created_at: Date;
  metadata?: Record<string, any>;
}
```

---

## 5. Gap Analysis

Likely gaps to implement now:

1. Suspension status propagation in reference-check detail responses.
2. Vouch pre-submit policy acknowledgment tracking.
3. Order + reference-check policy gate for completion.
4. Unified transaction history event service for order detail timeline.
5. Trust & Safety review endpoint visibility for affected users.

---

## 6. Open Questions

1. Should suspended checks allow posting feedback comments?
2. Is minimum vouch threshold required before reference check completion is allowed?
3. Can admins force-complete an order while check is suspended?
4. Should both parties be required to initiate completion or is one-sided + timeout allowed?
5. How long should completed checks remain editable for typo fixes in feedback?

---

## 7. Non-Drift Statement

Part 4 is additive and consistent with all earlier Batch 4 parts and prior batch contracts.
No schema or semantic change here overrides earlier approved behavior without explicit migration decision.
