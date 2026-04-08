# Batch 4 Part 1: Social Hub Implementation Checklist & Gap Analysis

**Date:** April 6, 2026  
**Status:** Part 1 Complete - Awaiting Parts 2, 3, 4  
**Objective:** Track implementation tasks and identify integration gaps vs existing codebase

---

## 1. Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

#### 1.1 Message Model & Chat Foundation
- [ ] Create `Message` schema in MongoDB
  - Fields: message_id, chat_id, sender_id, content, type, attachments, mentions, reply_to, thread_id, reactions, read_by, deleted, timestamps
  - Indexes: chat_id (for history fetch), sender_id, created_at
  - TTL: No expiration (keep messages indefinitely); archival policy TBD
- [ ] Create `Chat` schema in MongoDB
  - Fields: chat_id, type (personal|group), participant_id (1:1) or group_id (group), last_message, unread_count, muted, pinned, timestamps
  - Indexes: user_id, type, updated_at
- [ ] Create `Group` schema in MongoDB
  - Fields: group_id, name, description, avatar_url, members[], settings, created_by, timestamps
  - Relationships: has_many Messages, has_many Users (members)
- [ ] Verify/setup GetStream Chat API integration
  - Confirm API keys configured in .env
  - Confirm WebSocket connection for real-time updates
  - Test message delivery and read receipts
- [ ] Create API: `GET /networks/social-hub/status` — Dashboard initialization
- [ ] Create API: `GET /networks/messages/chats` — List all conversations

**Acceptance Criteria:**
- [ ] Message history retrievable and paginated
- [ ] Chat list shows latest message + unread count
- [ ] GetStream real-time updates working

---

#### 1.2 Messaging Send & History
- [ ] Create API: `POST /networks/messages/:chatId/send` — Send message
  - Support: text, attachments, mentions, replies
  - Idempotency: idempotency_key prevents duplicates
  - Validation: content max 5000 chars, max 10 attachments
- [ ] Create API: `GET /networks/messages/:chatId/history` — Fetch message history
  - Pagination: limit, before/after timestamps
  - Include: reactions, read receipts, mentions
  - Performance: index on chat_id + created_at
- [ ] Implement file upload handling for message attachments
  - Integration: S3 or existing CDN
  - File types: image, document, video
  - Size limits: 50MB per file, 100MB total per message
- [ ] Implement attachment thumbnail generation (images)

**Acceptance Criteria:**
- [ ] Can send text message to chat
- [ ] Can send message with multiple attachments
- [ ] Message history loads with infinite scroll
- [ ] Thumbnails generated for image attachments

---

#### 1.3 Message Reactions & Actions
- [ ] Create API: `POST /networks/messages/:messageId/react` — Add/remove emoji reaction
  - Support: standard emoji set (👍 ❤️ 👎 😂 🤔 ❓)
  - Deduplication: user can only have one reaction per emoji
- [ ] Create API: `PATCH /networks/messages/:messageId/edit` — Edit message
  - Constraints: own messages only; admin/mod can edit others
  - Preserve: edit history with timestamps
  - Update: reset read receipts on edit
- [ ] Create API: `DELETE /networks/messages/:messageId` — Delete message
  - Soft delete: show placeholder, preserve thread integrity
  - Hard delete: admin only, with reason logging
- [ ] Create API: `POST /networks/messages/:messageId/reply` — Reply to message
  - Quote message in reply; creates linked thread
  - UI: show quoted message in bubble

**Acceptance Criteria:**
- [ ] Can react to others' messages
- [ ] Can edit own messages; edit history visible
- [ ] Can delete messages; shows as "[deleted]"
- [ ] Can reply to specific message with quote

---

### Phase 2: Search & Discovery (Week 2-3)

#### 2.1 Full-Text Search
- [ ] Create API: `GET /networks/messages/search` — Search messages, users, groups
  - Index: message content, user display_name, group name
  - Search types: all, messages, users, groups
  - Relevance: title match > content match > time decay
  - Performance: Redis caching for popular queries
- [ ] Create search indexes in MongoDB
  - Message: compound index on (chat_id, content, timestamp)
  - User: compound index on (display_name, location)
  - Group: compound index on (name, description)

**Acceptance Criteria:**
- [ ] Search returns results within 200ms
- [ ] Results ranked by relevance
- [ ] Search filters work (type: messages/users/groups)

---

#### 2.2 Friend Request System
- [ ] Create `FriendRequest` schema
  - Fields: request_id, from_user_id, to_user_id, status, created_at, expires_at
  - Status: pending, accepted, declined
  - Auto-expire after 30 days if not acted upon
- [ ] Create API: `GET /networks/friend-requests` — List pending requests
  - Pagination, filtering by status
  - Include: mutual connection count
- [ ] Create API: `POST /networks/friend-requests/:requestId/accept` — Accept request
  - Action: create bidirectional friend relationship
  - Notification: notify accepter
  - Auto-create direct message chat
- [ ] Create API: `POST /networks/friend-requests/:requestId/decline` — Decline request
  - Action: mark request as declined
  - Notification: optional notification to requester
  - Cleanup: remove after 7 days
- [ ] Create bidirectional Friend relationship in User model
  - Field: friends[] (array of user_ids)
  - Index: for fast lookup

**Acceptance Criteria:**
- [ ] Can send friend request; request appears in recipient's list
- [ ] Can accept/decline requests
- [ ] Accepted requests create direct message chat
- [ ] Can view list of friends

---

#### 2.3 Group Request System
- [ ] Create `GroupRequest` schema
  - Fields: request_id, user_id, group_id, request_type (invite|join_request), status, created_at
  - Status: pending, accepted, declined, expired
  - Auto-expire: 30 days
- [ ] Create API: `GET /networks/group-requests` — List pending group requests
- [ ] Create API: `POST /networks/group-requests/:requestId/accept` — Accept group invite
  - Action: add user to group members list
  - Notification: welcome message to group
- [ ] Create API: `POST /networks/group-requests/:requestId/decline` — Decline group invite
  - Action: mark as declined
  - Cleanup: remove after 7 days

**Acceptance Criteria:**
- [ ] Can receive and accept group invitations
- [ ] User added to group after acceptance
- [ ] Group appears in user's chat list

---

#### 2.4 User Discovery & Search
- [ ] Create API: `GET /networks/discovery/search` — Search users and groups
  - Filters: type (all|users|groups), location, follower count
  - Sort: relevance (default), followers, recent
  - Include: bio, location, follower count, mutual connections
- [ ] Create API: `POST /networks/users/:userId/follow` — Follow/send friend request
  - Action: trigger friend request workflow
  - Response: request status (none|requested|following)
- [ ] Create API: `POST /networks/groups/:groupId/follow` — Join group
  - Action: trigger group request or direct join (if public)
  - Response: join status (none|requested|joined)

**Acceptance Criteria:**
- [ ] Can search for users by name/location
- [ ] Can search for groups by name/description
- [ ] Can follow/request to join from discovery view
- [ ] Discovering users shows mutual friends

---

### Phase 3: Group Messaging (Week 3-4)

#### 3.1 Group Chat Features
- [ ] Extend `Chat` model for group-specific fields
  - group_id reference
  - List of member_ids
  - Admin/mod list
  - Settings: notifications, member approval
- [ ] Create API: `GET /networks/groups/:groupId` — Get group details
  - Return: members list, settings, member count, online count
- [ ] Create API: `GET /networks/groups/:groupId/members` — Paginated member list
- [ ] Implement group message threading
  - API: `POST /networks/messages/:messageId/thread` — Fetch thread for message
  - Response: all reply messages with threaded structure
- [ ] Implement typing indicators
  - Broadcast: "User is typing..." via WebSocket
  - Auto-clear: after 3 seconds of inactivity or send

**Acceptance Criteria:**
- [ ] Can view group member list
- [ ] Can start thread on message
- [ ] See "User is typing..." indicator
- [ ] Thread shows all replies in context

---

#### 3.2 Message Read Status
- [ ] Create API: `POST /networks/messages/:chatId/read-receipt` — Mark as read
  - Trigger: when message enters viewport
  - Broadcast: update read_by list via WebSocket
  - Timestamp: record when read by each user
- [ ] Implement read receipt display in UI
  - Single ✓: sent/delivered
  - Double ✓✓: read by one or more (not all)
  - Blue double ✓✓: read by all recipients
  - Tip: show count on long-press
- [ ] Create read receipt timeouts
  - Mark as delivered after 2 seconds (no read indicator needed)
  - Mark as read after message visible for 1 second

**Acceptance Criteria:**
- [ ] Messages show delivery status
- [ ] Read receipts update as recipients read
- [ ] Count of readers visible on hover/long-press

---

### Phase 4: User Context & Actions (Week 4)

#### 4.1 User Profile in Chat
- [ ] Create API: `GET /networks/users/:userId/profile` — User profile details
  - Fields: avatar, bio, location, follower count, member_since, verification
  - Include: reputation score, badges (verified, trusted_buyer, etc.)
  - Privacy: respect block/mute settings from current user
- [ ] Create API: `GET /networks/users/:userId/transactions` — Active offers/inquiries
  - Return: active_offers, active_inquiries, completed_transaction_count
  - Link: to marketplace transaction detail pages
- [ ] Create API: `GET /networks/users/:userId/common-groups` — Groups both users share
  - Return: group_id, name, member count, roles for each user
- [ ] Create API: `GET /networks/chats/:chatId/media` — Shared media in chat
  - Pagination: limit, offset
  - Include: type, url, thumbnail, sender, timestamp
- [ ] Create API: `GET /networks/chats/:chatId/links` — Shared links
  - Extract: URL, title (if available), preview image
  - Deduplicate: group same URLs together
- [ ] Create API: `GET /networks/chats/:chatId/files` — Shared documents
  - List: all non-image attachments
  - Include: file name, type, size, download URL

**Acceptance Criteria:**
- [ ] Can view user details from chat
- [ ] Can see active transactions with user
- [ ] Can browse shared media in conversation
- [ ] Can download files from chat

---

#### 4.2 Mute & Block Features
- [ ] Create API: `PATCH /networks/users/:userId/mute` — Mute user/chat
  - Durations: forever, 1h, 8h, 24h
  - Effect: suppress notifications but keep messages
  - Visual: grayed out or "muted" badge
- [ ] Create API: `POST /networks/users/:userId/block` — Block user
  - Effect: cannot send messages, existing messages hidden option
  - Bidirectional: also blocks their ability to message you
  - Reversal: can unblock after 7 days minimum
- [ ] Create API: `PATCH /networks/messages/chats/:chatId/mute` — Mute chat
  - Same durations as user mute
  - Effect: suppress notifications, keep in chat list
- [ ] Create BlockList document
  - Fields: blocker_id, blocked_id, blocked_at, duration
  - Index: blocker_id for fast lookup
  - Auto-unblock: after duration (optional)

**Acceptance Criteria:**
- [ ] Can mute users/chats with duration options
- [ ] Muted chats suppress notifications
- [ ] Can block users; blocked messages hidden
- [ ] Block is reversible after cooldown

---

#### 4.3 Report & Safety
- [ ] Create API: `POST /networks/users/:userId/report` — Report user
  - Reasons: spam, harassment, inappropriate, fraud, other
  - Evidence: message IDs, description, optional attachments
  - Anonymous: option to report anonymously
- [ ] Create `UserReport` document
  - Fields: reporter_id, reported_user_id, reason, description, status
  - Status: open, investigating, resolved, dismissed
  - Escalation: auto-escalate after 3 reports same user/reason
- [ ] Create moderation workflow
  - Admin dashboard: view open reports, investigate, take action
  - Actions: warn user, suspend account, delete messages, ban
  - Logging: audit trail of all actions

**Acceptance Criteria:**
- [ ] Can report users with reason
- [ ] Reports appear in admin dashboard
- [ ] Admins can investigate and take action

---

### Phase 5: Notifications & Presence (Week 5)

#### 5.1 Online Presence
- [ ] Create presence tracking in User model
  - Fields: online_status (online|away|offline), last_seen, device
  - Update: every 30s on activity; reset on message send
  - Broadcast: online status changes to relevant users via WebSocket
- [ ] Create API: `GET /networks/users/presence` — Get user presence info
  - Return: online_status, last_seen for current user's friends
- [ ] Implement idle detection on frontend
  - Set away after 5 minutes of inactivity
  - Set offline after 15 minutes (or app backgrounded)

**Acceptance Criteria:**
- [ ] Green dot shows for online users
- [ ] Presence updates in real-time
- [ ] Presence changes reflected in UI

---

#### 5.2 Notifications
- [ ] Create notification model for messaging
  - Types: new_message, friend_request, group_invite, message_reaction, etc.
  - Fields: id, user_id, type, related_id, content, read, created_at
- [ ] Create API: `GET /networks/notifications` — Fetch notifications
  - Pagination, filtering by type, status (read|unread)
- [ ] Implement notification delivery
  - In-app: badge counter on hub tab
  - Push: system notifications (if user enabled)
  - Email: daily digest of mentions (optional)
- [ ] Create API: `PATCH /networks/notifications/:id/read` — Mark notification as read

**Acceptance Criteria:**
- [ ] Badge counter shows unread notification count
- [ ] Can fetch notification history
- [ ] Push notifications work (requires frontend integration)

---

### Phase 6: Inv it & Maintenance (Week 6)

#### 6.1 Invite Links
- [ ] Create API: `POST /networks/invite-link/generate` — Generate invite link
  - Fields: invite_code, expires_at, usage_count, max_usages
  - URL format: dialist.app/join/{code}
  - Creator can revoke link anytime
- [ ] Create API: `GET /networks/invite-link/:code` — Validate/get invite info
  - Check: code valid, not expired, not max usages reached
  - Return: inviter info, reason to join message
- [ ] Implement invite link tracking
  - Record: time of use, user_id who used it
  - Analytics: track invite effectiveness

**Acceptance Criteria:**
- [ ] Can generate shareable invite links
- [ ] Links redirect and allow invite-based signup
- [ ] Can view who joined via link

---

#### 6.2 Performance & Caching
- [ ] Implement caching for expensive queries
  - Redis: message search results (1 hour TTL)
  - Redis: user discovery results (30 min TTL)
  - Redis: group member lists (15 min TTL)
- [ ] Implement database indexes
  - Message: (chat_id, created_at desc), (sender_id), (content text)
  - Chat: (user_id, type), (updated_at desc)
  - FriendRequest: (to_user_id, status), (from_user_id, status)
- [ ] Load testing
  - Target: 1000 concurrent users
  - Endpoint benchmarks: list chats <200ms, search <300ms, send message <500ms
- [ ] Monitor slow queries
  - Log queries > 100ms
  - Weekly review of slowest queries

**Acceptance Criteria:**
- [ ] All endpoints meet latency targets
- [ ] Search results cached and fast
- [ ] Database queries optimized

---

#### 6.3 Data Cleanup & Maintenance
- [ ] Implement message archival
  - Policy: move messages > 2 years old to archive collection (configurable)
  - Retain: searchable reference + metadata, remove full content
- [ ] Implement request expiration
  - Friend requests: auto-delete after 30 days if not acted
  - Group requests: auto-delete after 30 days
- [ ] Implement soft-deleted cleanup
  - Batch job: permanently delete soft-deleted messages > 30 days old
  - Frequency: weekly

**Acceptance Criteria:**
- [ ] Old messages automatically archived
- [ ] Expired requests cleaned up
- [ ] Soft-deleted messages purged after retention period

---

## 2. Cross-Platform Consistency Checklist

### User Model Integration
- [ ] Verify User model includes all necessary fields for messaging
  - Required: friends[], online_status, last_seen
  - Verify: avatar_url, display_name, location (from Batch 2)
  - New: bio, reputation_score, badges
- [ ] Ensure User onboarding (Batch 2) doesn't conflict with messaging fields
  - Expectation: User.onboarding (Networks), User.marketplace_onboarding (Marketplace) coexist peacefully
  - Messaging adds: User.friends[], User.online_status
- [ ] Verify verification status from Batch 2 is used correctly
  - Display: "verified" badge on profile
  - Used in: search ranking, trust scoring

**Ownership Decision:** Messaging features are Networks-scoped; reuse User model but add messaging-specific fields

---

### Marketplace Transaction Integration
- [ ] Ensure Offer model (Batch 2/3) integrates with messaging
  - Chat details view should link to active offers/inquiries with user
  - Messages can include offer/inquiry references
  - Attachments: allow sharing listing photos in chat
- [ ] Ensure Inquiry model integrates
  - Messages tagged with "inquiry" link back to inquiry ID
  - Inquiries can be resolved via chat thread
- [ ] Verify no data duplication
  - Offer/Inquiry stored only in marketplace collection
  - Messaging only stores references (IDs, not duplicated data)

**Ownership Decision:** Messaging references marketplace data; no duplication, only IDs

---

### Batch 2 Collections vs Batch 4 Groups
- [ ] Clarify distinction between two group types
  - **Collections (Batch 2):** Curated item groupings for discovery (user-created + system-generated)
  - **Groups (Batch 4):** Social communities with members, chat, shared transactions
  - API: different endpoints, different models
- [ ] Ensure no confusion in UI/documentation
  - Clear naming: "Collections" vs "Communities" or "Groups"
  - Link: Collections might show in group discovery (but different model)

**Ownership Decision:** Keep separate; Collections are item-focused; Groups are people-focused

---

## 3. Known Gaps from Batch 2 & 3

### Gaps to Resolve with Batch 4 Part 1

| Gap | Batch 2/3 Impact | Batch 4 Resolution |
|-----|------------------|-------------------|
| **References Tab Terminology** | Design says "Reference Checks" but should be "Reviews" | Clarify in Part 2: do we fetch reviews or reference checks for profile? |
| **Search vs Listings Endpoint** | `/networks/search` vs `/networks/listings` distinction | Batch 4 uses distinct search; confirm both coexist without conflict |
| **Message Attachments** | Partial in Batch 3 (inquiry photos) | Batch 4 full messaging attachments; ensure same S3 bucket, CDN |
| **User Presence** | Not in Batch 2/3 | Batch 4 adds online status; needs real-time infrastructure |
| **Notification System** | Not in Batch 2/3 | Batch 4 adds app notifications; needs badge counter, push API |

---

## 4. Integration Handoff Points (Part 1 → Part 2, 3, 4)

### Part 1 → Part 2 Likely Handoff
- Part 1: Basic messaging, discovery, friend requests
- Part 2: Group management (create, admin, moderation)
  - Create group
  - Invite members
  - Group settings
  - Admin/mod tools

### Part 2 → Part 3 Likely Handoff
- Part 3: Notifications, settings, deepdives
  - Notification preferences
  - Privacy settings
  - Message search filters
  - Conversation archival

### Part 3 → Part 4 Likely Handoff
- Part 4: Analytics, content moderation, advanced
  - Report moderation dashboard
  - User safety analytics
  - Search analytics
  - Conversation export

---

## 5. Risk & Dependencies

### Critical Dependencies
| Dependency | Status | Risk |
|------------|--------|------|
| **GetStream Chat API** | Assumed integrated | If not configured, messaging delays 1-2 weeks |
| **File Upload (S3)** | Partial from Batch 3 | If quota low, file attachment limits needed |
| **WebSocket Support** | Assumed in infrastructure | If absent, real-time features won't work; need polling fallback |
| **MongoDB Text Search** | Assumed available | If not enabled, full-text search requires external Elasticsearch |
| **User Onboarding (Batch 2)** | Complete | Messaging requires users complete Batch 2 onboarding first |

---

### Mitigation Strategies
- [ ] Verify GetStream integration before implementation; if missing, set up immediately
- [ ] Check S3 quotas; increase if needed for file uploads
- [ ] Confirm WebSocket infrastructure; implement polling fallback for real-time
- [ ] Enable MongoDB text search indexes before search implementation
- [ ] Add note in requirements: messaging requires completed user profile

---

## 6. Testing Strategy

### Unit Tests
- [ ] Message model creation, validation
- [ ] Chat model relationships
- [ ] Friend request workflows (send, accept, decline, expire)
- [ ] FriendRequest cascading deletes
- [ ] Search indexing & retrieval

### Integration Tests
- [ ] Send message to chat; verify appears in history
- [ ] Search returns correct results (messages, users, groups)
- [ ] Friend request sent → appears in recipient's inbox
- [ ] Friend request accepted → adds to both users' friend lists
- [ ] Block user → cannot send messages; messages hidden
- [ ] Mute chat → no notifications but messages visible

### E2E Tests (UI)
- [ ] User can open Social Hub, see chat list
- [ ] User can send message to friend
- [ ] User can search for other user
- [ ] User can send friend request
- [ ] Recipient accepts friend request
- [ ] Both users see each other in friends list
- [ ] Users can start direct message chat

### Load Tests
- [ ] 1000 concurrent chats active
- [ ] 500 QPS on message send
- [ ] 100 QPS on search queries
- [ ] Latency: p99 < 500ms

---

## 7. Documentation Artifacts Created

### Completed
- [x] BATCH_4_PART_1_SOCIAL_HUB_REQUIREMENTS.md — Full functional spec (8 screens)
- [x] BATCH_4_PART_1_API_PAYLOADS.md — Detailed request/response examples
- [x] BATCH_4_PART_1_IMPLEMENTATION_CHECKLIST.md — This document

### Pending (Awaiting Parts 2, 3, 4)
- [ ] BATCH_4_PART_2_GROUP_MANAGEMENT_REQUIREMENTS.md
- [ ] BATCH_4_PART_3_NOTIFICATIONS_SETTINGS_REQUIREMENTS.md
- [ ] BATCH_4_PART_4_ADVANCED_FEATURES_REQUIREMENTS.md
- [ ] BATCH_4_INTEGRATION_GUIDE.md — Combined cross-part guide

---

## 8. Development Kickoff Readiness

### Prerequisites Before Starting Implementation
- [ ] Confirm GetStream API keys and credentials with DevOps
- [ ] Verify MongoDB text search enabled
- [ ] Confirm S3 access for file uploads
- [ ] Review WebSocket infrastructure documentation
- [ ] Team alignment on Batch 4 timeline and resourcing
- [ ] Assign developers per phase (messaging, discovery, groups, context, notifications)

### Questions for Product/Design
1. **References Tab (Batch 2):** Should "Reference Checks History" actually display Reviews or Reference Checks?
2. **Message Retention:** How long should messages be kept? (Proposed: indefinite with 2-year archival option)
3. **Group Size Limits:** Are there max members per group?
4. **Invite Links:** Should invite links be user-specific (only generate from user's profile) or global?
5. **Moderation:** What's the escalation process for user reports?

---

**Document Version:** 1.0  
**Last Updated:** April 6, 2026  
**Status:** Ready for Batch 4 Part 1 implementation kickoff
