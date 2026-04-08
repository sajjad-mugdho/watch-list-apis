# Batch 4 Part 2 Context Alignment

**Date:** April 6, 2026  
**Scope:** Keep Batch 4 Part 2 fully aligned with Batch 2, Batch 3, and Batch 4 Part 1 decisions

---

## 1. Context Rules (Must Not Drift)

1. Messaging domain remains under Networks scope (`/networks/...`).
2. Chat/Group features must reuse user identity fields already normalized in previous batches.
3. Marketplace transaction objects (offers/inquiries/orders) are referenced, not duplicated.
4. Part 1 definitions remain source of truth for:
   - chat model
   - message model
   - presence/unread semantics
   - mute/block/report workflows
5. Reference Checks vs Reviews naming ambiguity remains an explicit product question; do not silently remap without decision.

---

## 2. What Part 2 Adds (Relative to Part 1)

Part 2 focuses on **conversation-adjacent deep views and role-based group controls**:

- Group Details (owner/admin vs member variant)
- Group members management actions (remove/follow/see all)
- Shared Content surfaces (media/links/files)
- Common Groups list
- Offers & Inquiries dedicated list view
- Embedded offer lifecycle cards inside chat timeline

This is not a separate system; this extends Part 1 chat + social hub.

---

## 3. Confirmed Reuse from Previous Batches

### From Batch 2

- User profile, display name, location, verification status
- Follow/connection direction and social graph assumptions

### From Batch 3

- Offer and inquiry card semantics
- Status progression and listing-linked transaction context
- Existing offer APIs and statuses

### From Batch 4 Part 1

- Message list and thread behavior
- Read receipts and chat metadata
- Safety actions and mute behavior

---

## 4. Non-Negotiable API Consistency

1. Use `ApiResponse` envelope shape (`data`, optional `_metadata`, `requestId`).
2. Keep pagination fields consistent across endpoints.
3. Human UI labels may differ from API enums; map explicitly.
4. Role-based controls are server-authorized (not UI-authorized only).
5. Group privacy enum should be canonical (`public|private|invite_only|secret`).

---

## 5. Key Risks to Guard Against

1. Mixing group moderation actions with user-to-user report/block semantics without scope field.
2. Duplicating offer state in chat message documents (should be snapshot + source reference ID).
3. Breaking current search/list endpoints by creating overlapping route contracts.
4. Missing owner/admin/member policy matrix for add/remove/leave/report actions.

---

## 6. Output Contract for Part 2

Part 2 documentation set must include:

1. Screen-by-screen requirements
2. Endpoint and payload contracts
3. Data model additions/changes
4. Implementation checklist
5. Cross-batch alignment notes
6. Open product/engineering questions

All are included in this folder.
