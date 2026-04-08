# Batch 4 Networks API List (Canonical)

Date: April 7, 2026
Scope: Networks APIs mapped to Batch 4 Part 1, Part 2, Part 3 screens
Base path: `/api/v1/networks`

---

## 1. Part 1 APIs (Social Hub, Messaging, Discovery)

### Social hub core

- `GET /social/status`
- `GET /social/inbox`
- `GET /social/search`
- `GET /social/discover`

### Social conversation utilities

- `GET /social/conversations/:id/content`
- `GET /social/conversations/:id/search`
- `GET /social/conversations/:id/events`
- `GET /social/chat-profile/:userId`

### Message and chat flows

- `GET /messages/chats`
- `GET /messages/chats/search`
- `GET /messages/:chatId/history`
- `POST /messages/send`
- `GET /messages/:id`
- `PUT /messages/:id`
- `DELETE /messages/:id`
- `POST /messages/:id/read`
- `POST /messages/:id/reply`
- `POST /messages/:id/react`
- `POST /messages/:id/typing`

### Conversation feeds and shared content aliases

- `GET /conversations`
- `GET /conversations/search`
- `GET /conversations/:id`
- `GET /conversations/:id/media`
- `GET /conversations/:id/shared/media`
- `GET /conversations/:id/shared/files`
- `GET /conversations/:id/shared/links`

### Group social APIs used by Part 1/2 screens

- `GET /social/groups`
- `GET /social/groups/:id`
- `POST /social/groups`
- `POST /social/groups/:group_id/join`
- `DELETE /social/groups/:group_id/leave`
- `GET /social/groups/:id/members`
- `POST /social/groups/:id/members`
- `DELETE /social/groups/:id/members/:userId`
- `PATCH /social/groups/:id/members/:userId/role`
- `POST /social/groups/:id/mute`
- `GET /social/groups/:id/shared-links`
- `POST /social/groups/:id/shared-links`
- `GET /social/groups/:id/shared-media`
- `GET /social/groups/:id/shared-files`
- `POST /social/invites`
- `GET /social/invites/:token`

### User context/discovery routes used by social screens

- `GET /users/:id/profile`
- `GET /users/:id/common-groups`
- `POST /users/:id/connections`
- `DELETE /users/:id/connections`

---

## 2. Part 2 APIs (Group Detail, Shared Content, Offer Timeline)

### Group detail and member role actions

- `GET /social/groups/:id`
- `GET /social/groups/:id/members`
- `POST /social/groups/:id/members`
- `PATCH /social/groups/:id/members/:userId/role`
- `DELETE /social/groups/:id/members/:userId`
- `POST /social/groups/:id/mute`
- `DELETE /social/groups/:group_id/leave`

### Common groups

- `GET /users/:id/common-groups`

### Shared content pages

- `GET /social/groups/:id/shared-links`
- `POST /social/groups/:id/shared-links`
- `GET /social/groups/:id/shared-media`
- `GET /social/groups/:id/shared-files`
- `GET /conversations/:id/shared/links`
- `GET /conversations/:id/shared/media`
- `GET /conversations/:id/shared/files`

### Offers list and transaction flow (timeline sources)

- `GET /offers`
- `GET /offers-inquiries`
- `GET /offers/:id`
- `GET /offers/:id/terms-history`
- `POST /offers/:id/counter`
- `POST /offers/:id/accept`
- `POST /offers/:id/reject`
- `POST /offers/:id/decline`
- `GET /social/conversations/:id/events`

---

## 3. Part 3 APIs (Negotiation and Reference Checks)

### Offer decision flow

- `GET /offers/:id`
- `GET /offers/:id/terms-history`
- `POST /offers/:id/counter`
- `POST /offers/:id/accept`
- `POST /offers/:id/reject`
- `POST /offers/:id/decline`

### Reference checks feed/detail/actions

- `POST /reference-checks`
- `GET /reference-checks`
- `GET /reference-checks/:id`
- `POST /reference-checks/:id/respond`
- `POST /reference-checks/:id/complete`
- `DELETE /reference-checks/:id`
- `POST /reference-checks/:id/vouch`
- `GET /reference-checks/:id/vouches`
- `GET /reference-checks/:id/summary`
- `GET /reference-checks/:id/context`
- `GET /reference-checks/:id/progress`
- `GET /reference-checks/:id/vouch-policy`
- `POST /reference-checks/:id/feedback`
- `GET /reference-checks/:id/feedback`
- `GET /reference-checks/:id/audit`
- `POST /reference-checks/:id/share-link`
- `POST /reference-checks/:id/suspend`
- `GET /reference-checks/:id/trust-safety/status`
- `POST /reference-checks/:id/trust-safety/appeal`

### Order coupling for negotiation completion surfaces

- `GET /orders`
- `GET /orders/:id`
- `POST /orders/:id/complete`
- `GET /orders/:id/completion-status`
- `POST /orders/:id/reference-check/initiate`
- `GET /orders/:id/audit-trail`

### Appeals (used by trust-safety/reference-check flow screens)

- `GET /users/:id/appeals`
- `POST /users/:id/appeals`
- `GET /users/:id/appeal-status`

---

## 4. Alignment Notes

1. This API list is intentionally Batch-4-only and Networks-only.
2. Batch 2 and Batch 3 APIs are not enumerated here unless directly used by Batch 4 screen flows.
3. For final screen alignment decisions, use this file together with `BATCH_4_FINAL_GAP_ANALYSIS_SCREEN_BY_SCREEN.md`.
