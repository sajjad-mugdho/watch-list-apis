# Batch 4 Part 2: Group Details, Shared Content, and Offer Timeline - Requirements Analysis

**Date:** April 6, 2026  
**Status:** Part 2 Analysis Complete  
**Figma Scope:** 8 screens (group details variants, shared content pages, common groups, offers list, offer-rich chat thread)

---

## 1. Executive Summary

Batch 4 Part 2 deepens the Social Hub by adding **role-aware group administration** and **transaction-aware conversation views**.

Primary outcomes:

1. Group details pages with owner/admin/member-specific actions.
2. Shared assets browsing surfaces (media, links, files) at chat/group scope.
3. Common groups discovery page for relationship context.
4. Dedicated offers/inquiries list view with status chips.
5. Offer lifecycle cards embedded directly in chat timeline.

This part is an extension of Batch 4 Part 1 and must preserve all prior contracts.

---

## 2. Screen-by-Screen Analysis

## Screen 1: Group Details (Owner/Admin Variant)

**Observed UI:**

- Header: Group Details
- Hero: Group avatar, online marker
- Group title: NYC Watch Collectors
- Subtext: 2.4k members, Private
- Actions: Add Member, Search in Chat
- Content rows: Media(12), Links(1), Files(2)
- Privacy & Support: Mute Notifications toggle, Report User, Block User
- Members list with `Remove` action per member

**Interpretation:**
This screen reflects a **privileged role** (owner/admin/mod) with member removal control.

**Requirements:**

1. Group role must be fetched and applied server-side.
2. `Remove` action visible only for authorized roles.
3. Add Member opens user search constrained by privacy rules.
4. Search in Chat scopes query to current group channel.
5. Content counters are dynamic and reflect attachment index.
6. Mute setting is per user per group channel.

**Role Policy:**

- Owner: full rights (add/remove members, report, settings)
- Admin/Moderator: remove member (except owner), add member
- Member: no remove controls

**Endpoints Needed:**

- `GET /networks/groups/:groupId/details`
- `POST /networks/groups/:groupId/members/invite`
- `DELETE /networks/groups/:groupId/members/:memberId`
- `PATCH /networks/groups/:groupId/notifications`
- `GET /networks/groups/:groupId/search-messages`

---

## Screen 2: Group Details (Member Variant)

**Observed UI:**

- Same header and content counters as Screen 1
- Privacy & Support differs: Mute Notifications, Report Group, Leave Group
- Members rows show `Follow` action, not `Remove`

**Interpretation:**
This is a **standard member** view with personal actions only.

**Requirements:**

1. Replace moderation controls with member-safe actions.
2. Leave Group requires confirmation + optional reason.
3. Report Group opens abuse category flow (spam, fraud, hate, explicit, other).
4. Follow on member rows triggers social follow/friend flow (not group role change).
5. `See All` navigates to full members list with pagination and role badges.

**Endpoints Needed:**

- `POST /networks/groups/:groupId/leave`
- `POST /networks/groups/:groupId/report`
- `POST /networks/users/:userId/follow`
- `GET /networks/groups/:groupId/members`

---

## Screen 3: Common Groups List

**Observed UI:**

- Page title: Common Groups
- Card list with name, member count, privacy type (Private/Invite Only/Secret)
- Chevron for navigation to group detail

**Requirements:**

1. Show groups shared by current user and target user.
2. Must include privacy label and membership visibility constraints.
3. Secret groups should only appear if policy allows mutual disclosure.
4. Ordering default: highest engagement or most recent activity.
5. Row tap navigates to group profile/details page.

**Endpoints Needed:**

- `GET /networks/users/:userId/common-groups`

**Privacy Enum Mapping:**

- UI `Private` -> API `private`
- UI `Invite Only` -> API `invite_only`
- UI `Secret` -> API `secret`

---

## Screen 4: Shared Links

**Observed UI:**

- Title: Shared Links
- Link rows with icon, URL text, timestamp text like `Shared yesterday`

**Requirements:**

1. Fetch URLs extracted from chat messages and attachments metadata.
2. Deduplicate identical URLs by default (toggle optional for all instances).
3. Provide normalized domain + full URL.
4. Tap opens in external browser or in-app webview based on policy.
5. Support pagination and reverse chronological order.

**Endpoints Needed:**

- `GET /networks/chats/:chatId/links`
- `GET /networks/groups/:groupId/links` (if group-scoped route preferred)

---

## Screen 5: Shared Media

**Observed UI:**

- Masonry/grid gallery (3 columns)
- Large image collection from chat history

**Requirements:**

1. Pull media attachments from message index for that chat/group.
2. Thumbnail + original URL + source message linkage.
3. Infinite scroll pagination.
4. Tap opens media viewer with swipe navigation and jump-to-message.
5. Respect deleted message/media permission logic.
6. Support media filters (image/video) for future scalability.

**Endpoints Needed:**

- `GET /networks/chats/:chatId/media`
- `GET /networks/messages/:messageId` (jump-to-source)

---

## Screen 6: Shared Files

**Observed UI:**

- File list cards with file name and metadata (`size • time`)
- Different file-type icon colors

**Requirements:**

1. List non-media attachments (doc/pdf/xls/etc).
2. Show size, share timestamp, uploader.
3. Download tokenized secure URL.
4. Virus-scan/attachment safety flag before allowing open.
5. Expired links auto-regenerate via authenticated endpoint.

**Endpoints Needed:**

- `GET /networks/chats/:chatId/files`
- `POST /networks/files/:fileId/download-link`

---

## Screen 7: Offers & Inquiries List View

**Observed UI:**

- Title: Offers & Inquiries
- Tabs: All / Sent / Received
- Result count
- Card variants with status chips: Received, Sent, Expired, In Progress
- Action button label changes (View Counter Offer, View Offer Details, View Order Details)
- Fields include listing snapshot, reference no., year/condition/box papers, amount, reservation terms, reference check state

**Requirements:**

1. Unify offers + inquiries + order progression in one timeline list.
2. Support sender/receiver filtering and status filtering.
3. Card should include immutable listing snapshot captured at offer time.
4. Action CTA must deep-link to transaction detail state machine.
5. Expired cards are non-primary/disabled styling but still accessible for audit.
6. Add sorting options (latest, amount high->low, expiring soon).

**Endpoints Needed:**

- `GET /networks/user/offers-inquiries`
- `GET /networks/offers/:offerId`
- `GET /networks/orders/:orderId`

**Status Mapping (UI -> API):**

- Received -> `received`
- Sent -> `sent`
- Expired -> `expired`
- In Progress -> `order_in_progress`
- Accepted -> `accepted`
- Completed -> `completed`
- Declined/Counter Declined -> `declined` / `counter_declined`

---

## Screen 8: Chat Thread with Embedded Offer Lifecycle

**Observed UI:**

- Standard chat messages interleaved with structured transaction cards
- Transaction milestones displayed in sequence:
  - Inquiry Received
  - Sent Offer
  - Counter Offer Received
  - Accepted
  - Order In Progress
  - Completed
  - Expired/Declined variants
- Cards include colored side bars for state emphasis

**Requirements:**

1. Chat timeline supports polymorphic message items:
   - text message
   - system event
   - transaction card snapshot
2. Transaction card events are append-only historical records.
3. Each card carries `source_offer_id` and `snapshot_version`.
4. CTA from card opens current canonical offer/order detail.
5. Edited offers create new event card, not overwrite historical card.
6. Timeline filtering by event type (messages vs transactions) is optional future enhancement.

**Endpoints Needed:**

- `GET /networks/messages/:chatId/history` (include `event_type`)
- `POST /networks/offers/:offerId/counter`
- `POST /networks/offers/:offerId/accept`
- `POST /networks/offers/:offerId/decline`
- `POST /networks/offers/:offerId/expire`

---

## 3. Data Model Requirements (Part 2 Additions)

```typescript
interface GroupRoleMembership {
  group_id: ObjectId;
  user_id: ObjectId;
  role: "owner" | "admin" | "moderator" | "member";
  joined_at: Date;
  invited_by?: ObjectId;
}

interface SharedLinkItem {
  id: ObjectId;
  chat_id: ObjectId;
  message_id: ObjectId;
  url: string;
  normalized_url: string;
  domain: string;
  shared_by: ObjectId;
  shared_at: Date;
}

interface SharedFileItem {
  id: ObjectId;
  chat_id: ObjectId;
  message_id: ObjectId;
  storage_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: ObjectId;
  uploaded_at: Date;
  scan_status: "pending" | "clean" | "blocked";
}

interface TransactionTimelineEvent {
  id: ObjectId;
  chat_id: ObjectId;
  offer_id?: ObjectId;
  inquiry_id?: ObjectId;
  order_id?: ObjectId;
  event_type:
    | "offer_sent"
    | "offer_received"
    | "counter_received"
    | "accepted"
    | "declined"
    | "expired"
    | "order_created"
    | "order_completed";
  snapshot: {
    listing_id: ObjectId;
    listing_title: string;
    ref_no?: string;
    condition?: string;
    amount: number;
    currency: string;
    reservation_terms?: string;
    reference_check_status?: string;
  };
  created_by: ObjectId;
  created_at: Date;
}
```

---

## 4. Cross-Batch Alignment Notes

1. Reuse offer/inquiry reference and status semantics from Batch 3.
2. Reuse member follow relationships from Batch 2/Part 1 discovery.
3. Group role matrix is new in Part 2 and must be enforced server-side.
4. Shared media/links/files are projections from message attachments; do not duplicate entire file objects in chat documents.

---

## 5. Gap Analysis (Current vs Required)

### Likely Existing

- Base chat/message APIs (from Part 1 assumptions)
- Offer models and status transitions
- Basic user discovery/follow flows

### Likely Missing or Partial

1. Group role-based details variants.
2. Dedicated shared links index and dedupe behavior.
3. Embedded transaction event cards in chat history payload.
4. Common groups privacy-aware disclosure policy.
5. Leave group/report group endpoint contracts.

---

## 6. Open Questions

1. Should non-admin users ever see `Add Member` in private groups?
2. Is `Block User` on group detail intended as personal block or group ban?
3. Should shared links dedupe by normalized URL or exact URL?
4. Does expired offer card allow re-open/new counter action?
5. How should secret groups appear in common groups list?

---

## 7. Delivery Scope Statement

This document defines Part 2 requirements only, while remaining strictly aligned with Part 1 and prior batch contracts.
No assumptions here override previously approved schemas unless explicitly stated as a new Part 2 addition.
