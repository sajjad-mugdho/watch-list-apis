# Batch 4 Part 3 Implementation Checklist

Date: April 6, 2026

## Phase 1: Offer Negotiation Foundation

1. Add offer terms versioning table/model.
2. Implement offer details endpoint with listing snapshot + expiry + tabs metadata.
3. Implement counter-offer endpoint with policy validation.
4. Implement accept/decline actions with immutable timeline events.

Acceptance:

- Counter-offer updates terms version and timeline.
- Decline requires confirmation in UI and produces declined event.

## Phase 2: Reservation Terms and Policy Controls

1. Build terms history endpoint.
2. Build policy endpoint for dynamic warnings and legal text.
3. Add validation for restricted terms keywords if required by compliance.

Acceptance:

- Current/previous tabs map to backend versions correctly.

## Phase 3: Reference Checks Feed

1. Implement reference checks list endpoint with filters all/you/connections.
2. Add summary counters (active/completed).
3. Implement search across check id, participants, listing metadata.
4. Add performant indexes for status, expires_at, participant ids.

Acceptance:

- Empty state appears only when result set is empty for selected filter/query.

## Phase 4: Reference Check Detail and Vouch Actions

1. Implement detail endpoint with participant, terms snapshot, policy accordion payload.
2. Implement vouch endpoint with target enforcement.
3. Implement feedback list + post endpoints.
4. Enforce warning semantics: comments are not vouches.

Acceptance:

- Vouch and feedback are stored in separate models and shown with correct tags.

## Phase 5: Completion Handshake

1. Implement confirm-complete endpoint for buyer/seller only.
2. Add dual-confirmation state machine.
3. Add completed status transition with banner/footer metadata.
4. Lock mutable actions post-completion.

Acceptance:

- Check transitions to completed only when both sides confirm.

## Phase 6: Notifications, Audit, and Safety

1. Push notifications for counter offer, accept/decline, vouch, completion pending/completed.
2. Add audit endpoint for reference check events.
3. Add moderation hooks for abusive comments.
4. Add share-link endpoint with permission checks.

Acceptance:

- Full event trail retrievable for compliance review.

## Testing Matrix

1. Counter offer valid/invalid amount cases.
2. Terms history rendering and tab switching.
3. Decline modal cancel vs confirm behavior.
4. Reference check feed filter correctness.
5. Vouch once constraint.
6. Comment posting with profanity/moderation checks.
7. Completion by one side only remains active.
8. Completion by both sides sets terminal completed state.

## Open Decisions

1. One vouch per user per participant or per check globally?
2. Should connections filter include second-degree or first-degree only?
3. Can admins override completion in dispute flow?
4. What is the SLA for active check expiry and extension?
