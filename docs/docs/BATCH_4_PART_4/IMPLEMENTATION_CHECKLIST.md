# Batch 4 Part 4 Implementation Checklist

Date: April 6, 2026

## Phase 1: Terminal and Exception States

1. Extend reference-check state machine with suspended and completed lock rules.
2. Add status-banner mapping in response serializers.
3. Enforce mutation guards for completed/suspended states.

Acceptance:

- Completed and suspended checks reject vouch/confirm actions.

## Phase 2: Trust & Safety Integration

1. Add trust-safety review model and service.
2. Add suspension trigger hooks from reports/heuristics.
3. Add user-facing status endpoint and optional appeal action.

Acceptance:

- Suspended checks show review metadata and read-only behavior.

## Phase 3: Vouch Confirmation Compliance Modal

1. Add vouch policy endpoint with versioned legal copy.
2. Require policy ack fields on vouch submission.
3. Persist policy acceptance with vouch audit record.

Acceptance:

- Vouch call fails without policy acknowledgment.

## Phase 4: Order + Reference Check Orchestration

1. Add order detail aggregation endpoint with reference-check module.
2. Implement initiate-reference-check order action.
3. Add progress endpoint and detail deep-link metadata.

Acceptance:

- Order view correctly transitions from not_started -> in_progress -> completed.

## Phase 5: Completion Handshakes

1. Implement dual-party order completion confirmation table.
2. Ensure idempotent confirmation writes.
3. Emit notifications for waiting and completion states.

Acceptance:

- Order completes only after both confirmations.

## Phase 6: Unified Transaction History

1. Build immutable event timeline stream for order detail.
2. Map all lifecycle events with source links.
3. Backfill historical events where possible.

Acceptance:

- Timeline displays full sequence without missing transitions.

## Testing Matrix

1. Completed check cannot be modified.
2. Suspended check disables all user mutation actions.
3. Vouch without policy ack fails.
4. Vouch with policy ack succeeds and logs policy version.
5. Order completion blocked when check gate unmet.
6. One-sided order confirm moves to waiting state.
7. Second-side confirm finalizes order.
8. Timeline shows inquiry->offer->reference-check->order completion chain.

## Open Decisions

1. Allow comments during suspended checks or fully lock thread?
2. Allow trust-safety moderators to post system notes visible to users?
3. Should order completion remain possible if reference check expired?
4. Minimum number of vouches required before completion gate unlock?
