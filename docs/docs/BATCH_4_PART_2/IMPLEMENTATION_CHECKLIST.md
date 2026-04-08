# Batch 4 Part 2: Implementation Checklist

**Date:** April 6, 2026  
**Scope:** Group detail role controls + shared content surfaces + transaction timeline in chat

---

## Phase 1: Group Role Controls

1. Add role-based authorization middleware for group actions.
2. Implement group details endpoint with viewer capabilities matrix.
3. Implement member invite/remove endpoints.
4. Implement leave group and report group endpoints.
5. Add audit log records for member removals and group reports.

**Acceptance Criteria:**

- Owner/admin sees remove controls; member does not.
- Unauthorized remove attempt returns 403.
- Leave group updates membership and chat access immediately.

---

## Phase 2: Shared Content Projections

1. Build attachment projection pipeline for media/files/links.
2. Implement shared links endpoint with URL normalization.
3. Implement shared media endpoint with cursor pagination.
4. Implement shared files endpoint with scan-status filtering.
5. Add jump-to-source-message support.

**Acceptance Criteria:**

- Content counts in group detail match projection totals.
- Deleted or blocked assets are excluded by policy.
- Pagination stable with no duplicates/missing rows.

---

## Phase 3: Common Groups + Members List

1. Implement common groups endpoint with privacy-aware filtering.
2. Implement members list endpoint with follow status.
3. Add `See All` pagination support and sort options.
4. Add role badges in member payload (owner/admin/member).

**Acceptance Criteria:**

- Common groups list matches expected mutual groups.
- Secret groups follow disclosure policy.

---

## Phase 4: Offers & Inquiries Unified List

1. Implement `/networks/user/offers-inquiries` aggregator endpoint.
2. Map statuses from offer/order engines into UI chips.
3. Include immutable listing snapshot in each item.
4. Add filters: all/sent/received + status + sort.

**Acceptance Criteria:**

- Counts match tab filters.
- Expired/completed states render correctly.

---

## Phase 5: Transaction Events in Chat Timeline

1. Extend history endpoint to emit polymorphic timeline items.
2. Add transaction event serialization contracts.
3. Ensure append-only historical event records.
4. Add deep-link CTA metadata for each event card.

**Acceptance Criteria:**

- Chat timeline shows both text and transaction cards in order.
- Historical events are never overwritten.

---

## Phase 6: Safety, Observability, and QA

1. Add metrics for group moderation actions.
2. Add rate limits for invite/remove/report actions.
3. Add integration tests for role matrix and event timeline.
4. Add E2E tests for all 8 Part 2 screens.

**Acceptance Criteria:**

- All critical flows covered by tests.
- No unauthorized moderation action succeeds.

---

## Testing Matrix (Minimum)

1. Owner removes member -> success, audit log created.
2. Member removes member -> forbidden.
3. Member leaves group -> group no longer in chat list.
4. Shared links page -> URLs open correctly.
5. Shared files page -> secure download URL generated.
6. Offers tab all/sent/received counts correct.
7. Counter offer event appears in timeline after action.
8. Expired offer event appears and disables invalid CTA.

---

## Dependencies

1. GetStream/event backbone from Part 1.
2. Offer/order state engine from Batch 3.
3. Attachment storage and scanning pipeline.
4. Existing follow graph endpoints.

---

## Open Decisions

1. Should group report include message evidence by default?
2. Should removed members be auto-blocked from rejoin for cooldown period?
3. Which statuses are terminal for transaction timeline coloring?
4. Should `Follow` in members list be friend request or one-way follow?
