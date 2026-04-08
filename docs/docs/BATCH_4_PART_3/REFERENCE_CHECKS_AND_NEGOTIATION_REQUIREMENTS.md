# Batch 4 Part 3: Reference Checks and Offer Negotiation - Requirements Analysis

Date: April 6, 2026
Status: Part 3 Analysis Complete
Figma Scope: Counter offer flow, offer decision modal, reference checks hub/list/detail/complete states

---

## 1. Executive Summary

Part 3 introduces the trust-critical transaction phase where negotiation and community validation converge.

Core capabilities:

1. Structured counter-offer workflow with editable reservation terms.
2. Offer decision surface (accept/decline/counter) with terms versioning.
3. Reference Checks feed and detail pages to gather vouches and feedback during active transaction windows.
4. Completion handshake requiring bilateral confirmation.

This part is the bridge between commercial agreement (offers/orders) and social trust enforcement (vouches/accountability).

---

## 2. Screen-by-Screen Analysis

## Screen 1: Counter Offer Composer

Observed UI:

- Header: Counter Offer
- Listing summary card with current offer amount
- Required field: Make a Counter Offer amount
- Delta helper chip: +$1,500 above current offer
- Reservation terms section showing current terms text
- Caution notice
- Expandable edit section with suggested terms chips
- Optional note textarea
- Binding notice: counter offers binding for 24h
- Primary CTA: Send Counter Offer

Requirements:

1. Amount input must validate numeric format, currency precision, min/max boundaries.
2. Delta indicator updates in real time against current offer.
3. Reservation terms editor supports full overwrite and suggested chip insertion.
4. Reservation terms are versioned; new counter creates new terms version.
5. Optional note captured as negotiation context and rendered in timeline.
6. CTA disabled until required fields valid.
7. Submission is idempotent and guarded against duplicate taps.
8. Binding duration should come from server policy, default 24h.

Validation rules:

- Required: amount
- Optional: note, edited_terms
- amount > 0
- amount should satisfy configurable floor/ceiling policies
- note length max (example 1000 chars)

Endpoints needed:

- POST /networks/offers/:offerId/counter
- GET /networks/offers/:offerId
- GET /networks/offers/:offerId/policy

---

## Screen 2: Offer Details (Current Terms Tab)

Observed UI:

- Modal sheet with close action
- Listing summary, reference number, price
- Listing description block
- Seller profile block (rating, verified badge)
- Current offer amount + Counter Offer action
- Shipping and expiry cards
- Reservation terms section with tabs: Current Reservation Terms / Previous Reservation Terms
- Pro-tip advisory banner
- Dual CTAs: Decline and Accept Offer

Requirements:

1. Modal receives canonical offer state from backend.
2. Expiry countdown synchronized with server timestamps.
3. Terms tab defaults based on latest active version.
4. Counter Offer button navigates to Screen 1 with offer context.
5. Accept transitions to accepted state and creates downstream order workflow event.
6. Decline opens confirm modal (Screen 4).
7. Offer details should include immutable listing snapshot at offer-time.

Endpoints needed:

- GET /networks/offers/:offerId/details
- POST /networks/offers/:offerId/accept
- POST /networks/offers/:offerId/decline

---

## Screen 3: Offer Details (Previous Terms Tab)

Observed UI:

- Same as Screen 2 but tab selection on Previous Reservation Terms

Requirements:

1. Terms history presented as ordered versions (current + previous).
2. Previous tab read-only, includes version metadata (who changed, when).
3. If no history exists, show empty state for previous terms.
4. Accept/decline actions still operate on current offer state regardless of viewed tab.

Endpoints needed:

- GET /networks/offers/:offerId/terms-history

---

## Screen 4: Decline Confirmation Modal

Observed UI:

- Overlay modal: Decline Offer?
- Warning copy that buyer will be notified
- CTA pair: Cancel / Decline (destructive)

Requirements:

1. Decline action requires explicit confirmation.
2. Cancel closes modal with no mutation.
3. Confirm decline triggers immutable timeline event and notification.
4. Optional decline reason may be captured from backend policy.
5. Once declined, counter-offer path should be blocked unless new offer is created.

Endpoints needed:

- POST /networks/offers/:offerId/decline

---

## Screen 5: Social Hub Reference Checks (Empty State)

Observed UI:

- Social Hub header with avatar and plus button
- Tab switched to Reference Checks
- Search bar
- Filters: All / You / Connections
- Empty state: No Active Reference Check

Requirements:

1. Reference Checks tab is first-class feed separate from Messages tab.
2. Search applies to participants, listing title, check id.
3. Filters:
   - All: all visible checks
   - You: checks where viewer is buyer/seller/voucher
   - Connections: checks involving social graph connections
4. Empty state when zero results for selected filter/query.
5. Plus button action should map to check creation/invite entrypoint only if permitted.

Endpoints needed:

- GET /networks/reference-checks
- GET /networks/reference-checks/summary

---

## Screen 6: Social Hub Reference Checks (List with Active/Completed Cards)

Observed UI:

- Active checks count label
- Card layout includes:
  - Transaction value
  - Status badge/timer (23H LEFT, COMPLETED, 04H LEFT)
  - Seller and buyer identity with vouch counts
  - Community vouch count and comment count
  - Chevron to detail

Requirements:

1. Cards support mixed statuses in same feed.
2. Countdown badge based on server `expires_at`.
3. Vouch counters aggregate confirmed vouches, not comments.
4. Comment count derived from feedback thread volume.
5. Card press routes to detail page with check id.
6. Completed cards non-actionable but still viewable.

Status enum suggestions:

- active
- completed
- expired
- cancelled
- disputed

Endpoints needed:

- GET /networks/reference-checks?filter=all|you|connections

---

## Screen 7: Reference Check Detail (Active)

Observed UI:

- Header with check number, share icon, menu
- Top black strip: ACTIVE CHECK + remaining time
- Participant panel with seller/buyer identities and vouch counts
- Dual actions: Vouch for Seller, Vouch for Buyer
- Reservation terms block
- Expanded Important Info & Actions policy accordion
- Community feedback list with tagged entries (for whom vouched)
- Composer at bottom for comments
- Variant includes bottom progress strip: Mark Reference check as Complete + Confirm

Requirements:

1. Detail includes immutable transaction context (value, participants, reservation terms).
2. Vouch action requires explicit target participant and optional short reason.
3. Policy accordion content managed by CMS/config to allow legal updates.
4. Feedback comments cannot be interpreted as vouch; enforce warning label.
5. Completion handshake requires both sides confirmation before terminal complete state.
6. Share action supports deep link with permission checks.
7. Menu action can include report, mute updates, copy check id.

Endpoints needed:

- GET /networks/reference-checks/:checkId
- POST /networks/reference-checks/:checkId/vouches
- GET /networks/reference-checks/:checkId/feedback
- POST /networks/reference-checks/:checkId/feedback
- POST /networks/reference-checks/:checkId/confirm-complete
- POST /networks/reference-checks/:checkId/share-link

---

## Screen 8: Reference Check Detail (Completed Terminal State)

Observed UI:

- Blue banner: REFERENCE CHECK COMPLETED
- Same participant/terms/policy/feedback sections remain visible
- Green footer confirmation block: Reference check Completed, both parties confirmed

Requirements:

1. Completed state should lock vouch/confirm actions.
2. Banner and footer states derive from canonical status and confirmations.
3. Audit trail remains accessible (who vouched, who confirmed, when).
4. Feedback remains readable; posting may be restricted by policy after completion.
5. Completed checks remain searchable and filterable in feed.

Endpoints needed:

- GET /networks/reference-checks/:checkId/audit

---

## 3. Domain Model Requirements

```typescript
interface OfferTermsVersion {
  id: ObjectId;
  offer_id: ObjectId;
  version: number;
  terms_text: string;
  changed_by: ObjectId;
  changed_at: Date;
  reason?: string;
}

interface CounterOffer {
  id: ObjectId;
  offer_id: ObjectId;
  amount: number;
  currency: string;
  terms_version_id: ObjectId;
  note?: string;
  binding_expires_at: Date;
  created_by: ObjectId;
  created_at: Date;
}

interface ReferenceCheck {
  id: ObjectId;
  ref_code: string;
  offer_id?: ObjectId;
  order_id?: ObjectId;
  status: "active" | "completed" | "expired" | "cancelled" | "disputed";
  buyer_id: ObjectId;
  seller_id: ObjectId;
  transaction_value: number;
  currency: string;
  reservation_terms_snapshot: string;
  starts_at: Date;
  expires_at: Date;
  completed_at?: Date;
}

interface ReferenceVouch {
  id: ObjectId;
  check_id: ObjectId;
  vouched_by: ObjectId;
  vouched_for: ObjectId;
  reason?: string;
  created_at: Date;
}

interface ReferenceFeedback {
  id: ObjectId;
  check_id: ObjectId;
  author_id: ObjectId;
  message: string;
  created_at: Date;
  edited_at?: Date;
  flagged?: boolean;
}

interface CompletionHandshake {
  check_id: ObjectId;
  buyer_confirmed_at?: Date;
  seller_confirmed_at?: Date;
  completed_when_both_confirmed: boolean;
}
```

---

## 4. API Surface Summary

1. Offer negotiation

- GET /networks/offers/:offerId/details
- GET /networks/offers/:offerId/terms-history
- GET /networks/offers/:offerId/policy
- POST /networks/offers/:offerId/counter
- POST /networks/offers/:offerId/accept
- POST /networks/offers/:offerId/decline

2. Reference checks feed and detail

- GET /networks/reference-checks
- GET /networks/reference-checks/summary
- GET /networks/reference-checks/:checkId
- GET /networks/reference-checks/:checkId/feedback
- POST /networks/reference-checks/:checkId/feedback
- POST /networks/reference-checks/:checkId/vouches
- POST /networks/reference-checks/:checkId/confirm-complete
- GET /networks/reference-checks/:checkId/audit
- POST /networks/reference-checks/:checkId/share-link

---

## 5. Gap Analysis and Risks

Likely gaps:

1. Terms versioning may be missing in current offer contract.
2. Reference check status machine may need explicit completion handshake table.
3. Vouch action and feedback action can be conflated without separate endpoints.
4. Feed filters (you/connections) require social graph join logic and indexing.

Risks:

1. Legal language in policy accordion must be centrally managed and versioned.
2. Race conditions around dual completion confirmation.
3. Misuse risk if comments are interpreted as vouches.

---

## 6. Open Questions

1. Can non-participants vouch, or only invited/community-eligible users?
2. Is one user allowed to vouch for both parties in same check?
3. Are vouches editable/revocable before completion?
4. Should completed checks allow new feedback comments?
5. Is decline reason mandatory in specific categories?

---

## 7. Non-Drift Statement

This Part 3 spec is context-preserving with Part 1 and Part 2 and does not alter previously approved schemas without explicit additive modeling.
