# API Endpoint Analysis: Postman vs Swagger Configuration

**Date:** April 9, 2026  
**Purpose:** Identify deprecated/unused API endpoints by comparing Postman collection, Swagger config, and expected codebase routes

---

## Executive Summary

| Source                       | Count          | Details                          |
| ---------------------------- | -------------- | -------------------------------- |
| **Postman Collection**       | 30 folders     | 169 endpoints across all modules |
| **Swagger Config**           | 1 file         | 200 unique API paths defined     |
| **Expected Networks Routes** | 17 base routes | Should exist in codebase         |

---

## Postman Folders & Endpoints

### 🔧 Debug

- `GET health`
- `GET api/v1/debug/mock-users`
- `GET api-docs.json`

### ✅ Batch 3 — Networks Validation Suite

- `GET api/v1/networks/listings`
- `GET api/v1/networks/search`
- `GET api/v1/networks/offers`
- `GET api/v1/networks/orders`
- `GET api/v1/networks/user/dashboard/stats`
- `GET api/v1/networks/user`
- `GET api/v1/networks/notifications`
- `GET api/v1/networks/connections`
- `GET api/v1/networks/user/listings`
- `GET api/v1/networks/user/favorites`
- `GET api/v1/networks/user/searches/recent`
- `GET api/v1/networks/user/reviews`
- `GET api/v1/networks/user/isos/my`
- `GET api/v1/networks/notifications/unread-count`
- `GET api/v1/networks/users/{{userId}}/profile`
- `GET api/v1/networks/users/{{userId}}/listings`

### 👤 User — Profile

- `GET api/v1/user`
- `GET api/v1/user/profile`
- `PATCH api/v1/user/profile`
- `POST api/v1/user/avatar`
- `GET api/v1/user/verification`
- `PATCH api/v1/user/status`
- `PATCH api/v1/user/deactivate`
- `GET api/v1/user/wishlist`
- `POST api/v1/user/wishlist`
- `GET api/v1/user/wishlist/check/{{listingId}}`
- `DELETE api/v1/user/wishlist/{{listingId}}`
- `DELETE api/v1/user`

### ⭐ Networks — Favorites

- `GET api/v1/networks/user/favorites?platform=networks`
- `GET api/v1/networks/user/favorites?platform=marketplace`
- `POST api/v1/networks/user/favorites`
- `GET api/v1/networks/user/favorites/check/listing/{{listingId}}`
- `DELETE api/v1/networks/user/favorites/listing/{{listingId}}`

### 🔍 Networks — Searches

- `GET api/v1/networks/user/searches/recent`
- `POST api/v1/networks/user/searches/recent`
- `DELETE api/v1/networks/user/searches/recent`
- `DELETE api/v1/networks/user/searches/recent/SEARCH_ID`

### 💳 User — Subscription

- `GET api/v1/user/subscription`
- `POST api/v1/user/subscription/upgrade`
- `POST api/v1/user/subscription/cancel`

### 🔔 User — Notifications

- `GET api/v1/user/notifications`
- `GET api/v1/user/notifications/unread-count`
- `PATCH api/v1/user/notifications/read-all`
- `PATCH api/v1/user/notifications/NOTIFICATION_ID/read`
- `DELETE api/v1/user/notifications/NOTIFICATION_ID`

### 🎫 User — Tokens

- `GET api/v1/user/tokens/chat`
- `GET api/v1/user/tokens/feed`
- `GET api/v1/user/tokens/push`
- `POST api/v1/user/tokens/push`

### 📋 User — Support

- `GET api/v1/user/support/tickets`
- `POST api/v1/user/support/tickets`
- `GET api/v1/user/support/tickets/{{ticketId}}`
- `POST api/v1/user/support/tickets/{{ticketId}}/messages`
- `POST api/v1/user/support/tickets/{{ticketId}}/reopen`
- `GET api/v1/user/support/tickets/count/open`

### 🛍️ Marketplace — User Onboarding

- `GET api/v1/marketplace/onboarding/status`
- `PATCH api/v1/marketplace/onboarding/complete`

### 🏷️ Networks — Listings

- `GET api/v1/networks/listings`
- `POST api/v1/networks/listings`
- `GET api/v1/networks/listings/{{listingId}}`
- `PATCH api/v1/networks/listings/{{listingId}}`
- `DELETE api/v1/networks/listings/{{listingId}}`
- `POST api/v1/networks/listings/{{listingId}}/publish`
- `POST api/v1/networks/listings/{{listingId}}/inquire`
- `GET api/v1/networks/listings/{{listingId}}/preview`
- `GET api/v1/networks/user/listings`

### 💰 Networks — Offers

- `GET api/v1/networks/offers`
- `POST api/v1/networks/offers`
- `GET api/v1/networks/offers/{{offerId}}`
- `PATCH api/v1/networks/offers/{{offerId}}`
- `POST api/v1/networks/offers/{{offerId}}/accept`
- `POST api/v1/networks/offers/{{offerId}}/counter`
- `POST api/v1/networks/offers/{{offerId}}/reject`

### 📦 Networks — Orders

- `GET api/v1/networks/orders`
- `GET api/v1/networks/orders/{{orderId}}`
- `PATCH api/v1/networks/orders/{{orderId}}`

### 🔗 Networks — Connections

- `GET api/v1/networks/connections`
- `POST api/v1/networks/connections/request`
- `GET api/v1/networks/connections/requests`
- `POST api/v1/networks/connections/{{connectionId}}/respond`
- `GET api/v1/networks/connections/listings`
- `GET api/v1/networks/user/connections/incoming`
- `GET api/v1/networks/user/connections/outgoing`

### 💬 Networks — Chat

- `GET api/v1/networks/chat/channels`
- `POST api/v1/networks/chat/channel`
- `GET api/v1/networks/chat/token`
- `GET api/v1/networks/chat/unread`

### 📨 Networks — Conversations

- `GET api/v1/networks/conversations`
- `POST api/v1/networks/conversations`
- `GET api/v1/networks/conversations/{{conversationId}}`
- `PATCH api/v1/networks/conversations/{{conversationId}}`
- `DELETE api/v1/networks/conversations/{{conversationId}}`
- `GET api/v1/networks/conversations/{{conversationId}}/media`
- `GET api/v1/networks/conversations/search`

### 💬 Networks — Messages

- `GET api/v1/networks/messages/channel/{{channelId}}`
- `POST api/v1/networks/messages/send`
- `GET api/v1/networks/messages/{{messageId}}`
- `PATCH api/v1/networks/messages/{{messageId}}`
- `DELETE api/v1/networks/messages/{{messageId}}`
- `POST api/v1/networks/messages/{{messageId}}/react`

### 👥 Networks — Social Groups

- `GET api/v1/networks/social/groups`
- `POST api/v1/networks/social/groups`
- `GET api/v1/networks/social/groups/{{groupId}}`
- `PATCH api/v1/networks/social/groups/{{groupId}}`
- `DELETE api/v1/networks/social/groups/{{groupId}}`
- `GET api/v1/networks/social/groups/{{groupId}}/members`
- `POST api/v1/networks/social/groups/{{groupId}}/join`
- `POST api/v1/networks/social/groups/{{groupId}}/leave`
- `POST api/v1/networks/social/groups/{{groupId}}/mute`

### ✉️ Networks — Social Invites

- `GET api/v1/networks/social/invites`
- `POST api/v1/networks/social/invites`

### 📊 Networks — User & Dashboard

- `GET api/v1/networks/user`
- `PATCH api/v1/networks/user`
- `GET api/v1/networks/user/profile`
- `PATCH api/v1/networks/user/profile`
- `GET api/v1/networks/user/dashboard/stats`
- `GET api/v1/networks/user/listings`
- `GET api/v1/networks/user/connections`
- `GET api/v1/networks/user/connections/incoming`
- `GET api/v1/networks/user/connections/outgoing`
- `GET api/v1/networks/user/reviews`
- `GET api/v1/networks/user/isos/my`
- `GET api/v1/networks/user/feeds/user/{{userId}}`

### 👤 Networks — Users (Other)

- `GET api/v1/networks/users/{{userId}}/profile`
- `GET api/v1/networks/users/{{userId}}/listings`
- `GET api/v1/networks/users/{{userId}}/connections`
- `GET api/v1/networks/users/{{userId}}/connections/incoming`
- `GET api/v1/networks/users/{{userId}}/connections/outgoing`
- `GET api/v1/networks/users/connection-status`
- `GET api/v1/networks/users/{{userId}}/references`
- `GET api/v1/networks/user/{{userId}}/common-groups`

### 🏪 Marketplace — Listings

- `GET api/v1/marketplace/listings`
- `POST api/v1/marketplace/listings`
- `GET api/v1/marketplace/listings/{{listingId}}`
- `PATCH api/v1/marketplace/listings/{{listingId}}`
- `DELETE api/v1/marketplace/listings/{{listingId}}`
- `POST api/v1/marketplace/listings/{{listingId}}/publish`
- `POST api/v1/marketplace/listings/{{listingId}}/inquire`

### 🛒 Marketplace — Orders (Finix Payments)

- `GET api/v1/marketplace/orders/buyer/list`
- `GET api/v1/marketplace/orders/seller/list`
- `POST api/v1/marketplace/orders/reserve`
- `GET api/v1/marketplace/orders/{{orderId}}`
- `POST api/v1/marketplace/orders/{{orderId}}/tokenize`

### 🏢 Marketplace — Merchant Onboarding

- `GET api/v1/marketplace/merchant/status`
- `POST api/v1/marketplace/merchant/onboard`

### 🔎 Networks — ISOs

- `GET api/v1/networks/user/isos/my`

### ⌚ Watches

- `GET api/v1/watches`
- `GET api/v1/watches/{{watchId}}`

### 🔐 Reference Checks

- `GET api/v1/networks/reference-checks`
- `GET api/v1/networks/reference-checks/{{refCheckId}}`
- `POST api/v1/networks/reference-checks/{{refCheckId}}/respond`

### 🛡️ Admin

- `GET api/v1/admin/trust-cases`

### 🔗 Webhooks

- `POST api/v1/webhooks/clerk`
- `POST api/v1/webhooks/getstream`

### ✅ Batch 2 - Screen Integration (Aligned Payloads)

- _Legacy validation folder - no unique endpoints_

---

## Swagger Configuration - All Paths (200 Total)

### Auth & Debug

- `/api/v1/auth/refresh`
- `/api/v1/debug/mock-users`
- `/api/v1/debug/mock-users/category/{category}`
- `/api/v1/debug/mock-users/{id}`

### Networks — Chat

- `/api/v1/networks/chat/channel` (POST)
- `/api/v1/networks/chat/channels` (GET)
- `/api/v1/networks/chat/token` (GET)
- `/api/v1/networks/chat/unread` (GET)

### Networks — Connections

- `/api/v1/networks/connections` (GET)
- `/api/v1/networks/connections/{id}/respond` (POST)
- `/api/v1/networks/connections/listings` (GET)
- `/api/v1/networks/connections/request` (POST)

### Networks — Conversations

- `/api/v1/networks/conversations` (GET, POST)
- `/api/v1/networks/conversations/{id}` (GET, PATCH, DELETE)
- `/api/v1/networks/conversations/{id}/media` (GET)
- `/api/v1/networks/conversations/{id}/shared/files` (GET)
- `/api/v1/networks/conversations/{id}/shared/links` (GET)
- `/api/v1/networks/conversations/{id}/shared/media` (GET)
- `/api/v1/networks/conversations/search` (GET)

### Networks — Listings

- `/api/v1/networks/listings` (GET, POST)
- `/api/v1/networks/listings/{id}` (GET, PATCH, DELETE)
- `/api/v1/networks/listings/{id}/concierge` (GET)
- `/api/v1/networks/listings/{id}/inquire` (POST)
- `/api/v1/networks/listings/{id}/offers` (GET)
- `/api/v1/networks/listings/{id}/preview` (GET)
- `/api/v1/networks/listings/{id}/publish` (POST)
- `/api/v1/networks/listings/{id}/status` (GET)

### Networks — Messages

- `/api/v1/networks/messages/channel/{channelId}` (GET)
- `/api/v1/networks/messages/channel/{channelId}/archive` (POST)
- `/api/v1/networks/messages/channel/{channelId}/read-all` (POST)
- `/api/v1/networks/messages/{id}` (GET, PATCH, DELETE)
- `/api/v1/networks/messages/{id}/react` (POST)
- `/api/v1/networks/messages/{id}/read` (POST)
- `/api/v1/networks/messages/send` (POST)

### Networks — Offers

- `/api/v1/networks/offers` (GET, POST)
- `/api/v1/networks/offers/{id}` (GET, PATCH)
- `/api/v1/networks/offers/{id}/accept` (POST)
- `/api/v1/networks/offers/{id}/counter` (POST)
- `/api/v1/networks/offers/{id}/reject` (POST)

### Networks — Orders

- `/api/v1/networks/orders` (GET)

### Networks — Onboarding

- `/api/v1/networks/onboarding/complete` (PATCH)
- `/api/v1/networks/onboarding/status` (GET)

### Networks — Reference Checks

- `/api/v1/networks/reference-checks` (GET)
- `/api/v1/networks/reference-checks/{id}` (GET)
- `/api/v1/networks/reference-checks/{id}/complete` (POST)
- `/api/v1/networks/reference-checks/{id}/respond` (POST)
- `/api/v1/networks/reference-checks/{id}/suspend` (POST)
- `/api/v1/networks/reference-checks/{id}/vouch` (POST)
- `/api/v1/networks/reference-checks/{id}/vouches` (GET)

### Networks — Reservations

- `/api/v1/networks/reservations` (GET)

### Networks — Social (Groups, Invites, etc.)

- `/api/v1/networks/social/chat-profile/{userId}` (GET)
- `/api/v1/networks/social/conversations/{id}/content` (GET)
- `/api/v1/networks/social/conversations/{id}/events` (GET)
- `/api/v1/networks/social/conversations/{id}/search` (GET)
- `/api/v1/networks/social/discover` (GET)
- `/api/v1/networks/social/groups` (GET, POST)
- `/api/v1/networks/social/groups/{group_id}/join` (POST)
- `/api/v1/networks/social/groups/{group_id}/leave` (POST)
- `/api/v1/networks/social/groups/{id}` (GET, PATCH, DELETE)
- `/api/v1/networks/social/groups/{id}/members` (GET)
- `/api/v1/networks/social/groups/{id}/members/{userId}/role` (PATCH)
- `/api/v1/networks/social/groups/{id}/mute` (POST)
- `/api/v1/networks/social/inbox` (GET)
- `/api/v1/networks/social/invites` (GET, POST)
- `/api/v1/networks/social/invites/{token}` (GET)
- `/api/v1/networks/social/reports` (POST)
- `/api/v1/networks/social/search` (GET)

### Networks — User

- `/api/v1/networks/user` (GET, PATCH)
- `/api/v1/networks/user/block` (POST)
- `/api/v1/networks/user/blocks` (GET)
- `/api/v1/networks/user/blocks/{blocked_id}` (DELETE)
- `/api/v1/networks/user/connections/{id}` (GET)
- `/api/v1/networks/user/connections/incoming` (GET)
- `/api/v1/networks/user/connections/outgoing` (GET)
- `/api/v1/networks/user/connections/requests` (GET)
- `/api/v1/networks/user/connections/requests/{id}/accept` (POST)
- `/api/v1/networks/user/connections/requests/{id}/reject` (POST)
- `/api/v1/networks/user/dashboard/stats` (GET)
- `/api/v1/networks/user/feeds/followers` (GET)
- `/api/v1/networks/user/feeds/following` (GET)
- `/api/v1/networks/user/feeds/timeline` (GET)
- `/api/v1/networks/user/feeds/token` (GET)
- `/api/v1/networks/user/feeds/user/{id}` (GET)
- `/api/v1/networks/user/{id}/common-groups` (GET)
- `/api/v1/networks/user/{id}/listings` (GET)
- `/api/v1/networks/user/{id}/profile` (GET)
- `/api/v1/networks/user/{id}/references` (GET)
- `/api/v1/networks/user/listings` (GET)
- `/api/v1/networks/user/profile` (GET, PATCH)
- `/api/v1/networks/user/report` (POST)

### Networks — Users (Public Profiles)

- `/api/v1/networks/users/{id}/connections` (GET)
- `/api/v1/networks/users/{id}/connections/incoming` (GET)
- `/api/v1/networks/users/{id}/connections/outgoing` (GET)
- `/api/v1/networks/users/{id}/connection-status` (GET)

### User — Profile

- `/api/v1/user` (GET)
- `/api/v1/user/avatar` (POST)
- `/api/v1/user/deactivate` (PATCH)
- `/api/v1/user/notifications` (GET)
- `/api/v1/user/notifications/{id}` (GET, DELETE, PATCH)
- `/api/v1/user/notifications/{id}/read` (PATCH)
- `/api/v1/user/notifications/read-all` (PATCH)
- `/api/v1/user/notifications/unread-count` (GET)
- `/api/v1/user/profile` (GET, PATCH)
- `/api/v1/user/status` (PATCH)
- `/api/v1/user/subscription` (GET)
- `/api/v1/user/subscription/cancel` (POST)
- `/api/v1/user/subscription/upgrade` (POST)
- `/api/v1/user/support/tickets` (GET, POST)
- `/api/v1/user/support/tickets/count/open` (GET)
- `/api/v1/user/support/tickets/{ticket_id}` (GET)
- `/api/v1/user/support/tickets/{ticket_id}/messages` (POST)
- `/api/v1/user/support/tickets/{ticket_id}/reopen` (POST)
- `/api/v1/user/tokens/chat` (GET)
- `/api/v1/user/tokens/feed` (GET)
- `/api/v1/user/tokens/push` (GET, POST)
- `/api/v1/user/verification` (GET)
- `/api/v1/user/wishlist` (GET, POST)
- `/api/v1/user/wishlist/check/{listing_id}` (GET)
- `/api/v1/user/wishlist/{listing_id}` (DELETE)

### Marketplace — Listings

- `/api/v1/marketplace/listings` (GET, POST)
- `/api/v1/marketplace/listings/{id}` (GET, PATCH, DELETE)
- `/api/v1/marketplace/listings/{id}/images` (GET, POST)
- `/api/v1/marketplace/listings/{id}/images/{imageKey}` (DELETE)
- `/api/v1/marketplace/listings/{id}/images/reorder` (POST)
- `/api/v1/marketplace/listings/{id}/inquire` (POST)
- `/api/v1/marketplace/listings/{id}/publish` (POST)
- `/api/v1/marketplace/listings/{id}/thumbnail` (POST)

### Marketplace — Orders

- `/api/v1/marketplace/orders/buyer/list` (GET)
- `/api/v1/marketplace/orders/dev/clear-reservations` (POST)
- `/api/v1/marketplace/orders/dev/reset-listing` (POST)
- `/api/v1/marketplace/orders/{id}` (GET)
- `/api/v1/marketplace/orders/{id}/cancel` (POST)
- `/api/v1/marketplace/orders/{id}/confirm-delivery` (POST)
- `/api/v1/marketplace/orders/{id}/payment` (POST)
- `/api/v1/marketplace/orders/{id}/refund` (POST)
- `/api/v1/marketplace/orders/{id}/refund-request` (POST)
- `/api/v1/marketplace/orders/{id}/tokenize` (POST)
- `/api/v1/marketplace/orders/{id}/tracking` (GET)
- `/api/v1/marketplace/orders/reserve` (POST)
- `/api/v1/marketplace/orders/seller/list` (GET)

### Marketplace — Refund Requests

- `/api/v1/marketplace/refund-requests` (GET)
- `/api/v1/marketplace/refund-requests/{id}` (GET)
- `/api/v1/marketplace/refund-requests/{id}/approve` (POST)
- `/api/v1/marketplace/refund-requests/{id}/cancel` (POST)
- `/api/v1/marketplace/refund-requests/{id}/confirm-return` (POST)
- `/api/v1/marketplace/refund-requests/{id}/deny` (POST)
- `/api/v1/marketplace/refund-requests/{id}/submit-return` (POST)

### Marketplace — Chat & Conversations

- `/api/v1/chat/channel` (POST)
- `/api/v1/chat/channels` (GET)
- `/api/v1/chat/token` (GET)
- `/api/v1/chat/unread` (GET)
- `/api/v1/conversations/{id}` (GET)
- `/api/v1/conversations/{id}/media` (GET)
- `/api/v1/conversations/search` (GET)
- `/api/v1/marketplace/channels` (GET)
- `/api/v1/marketplace/channels/{channelId}/messages` (GET)
- `/api/v1/marketplace/conversations` (GET)
- `/api/v1/marketplace/messages/channel/{channelId}` (GET)
- `/api/v1/marketplace/messages/send` (POST)

### Marketplace — Onboarding

- `/api/v1/marketplace/onboarding/complete` (PATCH)
- `/api/v1/marketplace/onboarding/status` (GET)

### Marketplace — Merchant

- `/api/v1/marketplace/merchant/onboard` (POST)
- `/api/v1/marketplace/merchant/onboard/refresh-link` (POST)
- `/api/v1/marketplace/merchant/status` (GET)

### Marketplace — User

- `/api/v1/marketplace/user` (GET)
- `/api/v1/marketplace/user/listings` (GET)
- `/api/v1/marketplace/user/offers` (GET)
- `/api/v1/marketplace/users/{id}` (GET)

### Marketplace — Offers

- `/api/v1/marketplace/offers` (GET, POST)
- `/api/v1/marketplace/offers/{id}` (GET, PATCH)
- `/api/v1/marketplace/offers/{id}/accept` (POST)
- `/api/v1/marketplace/offers/{id}/counter` (POST)
- `/api/v1/marketplace/offers/{id}/reject` (POST)

### Messages & Reviews

- `/api/v1/messages/channel/{channelId}/read-all` (POST)
- `/api/v1/messages/{id}` (GET, DELETE)
- `/api/v1/messages/{id}/react` (POST)
- `/api/v1/messages/{id}/read` (POST)
- `/api/v1/reviews` (GET, POST)
- `/api/v1/reviews/me` (GET)
- `/api/v1/reviews/users/{user_id}` (GET)
- `/api/v1/reviews/users/{user_id}/summary` (GET)

### Watches & Terms

- `/api/v1/watches` (GET)
- `/api/v1/watches/{watchId}` (GET)
- `/api/v1/reservation-terms` (GET)
- `/api/v1/reservation-terms/current` (GET)
- `/api/v1/reservation-terms/{version}` (GET)
- `/api/v1/reservation-terms/{version}/archive` (POST)
- `/api/v1/reservation-terms/{version}/set-current` (POST)

### Admin & Analytics

- `/api/v1/admin/trust-cases` (GET)
- `/api/v1/admin/trust-cases/{id}` (GET)
- `/api/v1/admin/trust-cases/{id}/assign` (POST)
- `/api/v1/admin/trust-cases/{id}/note` (POST)
- `/api/v1/admin/trust-cases/{id}/resolve` (POST)
- `/api/v1/admin/trust-cases/{id}/suspend-user` (POST)
- `/api/v1/analytics/listing/{listingId}/messages` (GET)
- `/api/v1/analytics/messages` (GET)

### Webhooks & System

- `/api/v1/me` (GET)
- `/api/v1/marketplace/webhooks/finix` (POST)
- `/api/v1/webhooks/clerk` (POST)
- `/api/v1/webhooks/getstream` (POST)

---

## Comparison: Expected vs Defined Routes

### ✅ Expected Routes Found in Swagger:

1. **`/networks/user`** → `/api/v1/networks/user` ✓
2. **`/networks/users`** → `/api/v1/networks/users/{id}/...` ✓
3. **`/networks/listings`** → `/api/v1/networks/listings` ✓
4. **`/networks/offers`** → `/api/v1/networks/offers` ✓
5. **`/networks/chat`** → `/api/v1/networks/chat/*` ✓
6. **`/networks/messages`** → `/api/v1/networks/messages` ✓
7. **`/networks/conversations`** → `/api/v1/networks/conversations` ✓
8. **`/networks/reference-checks`** → `/api/v1/networks/reference-checks` ✓
9. **`/networks/onboarding`** → `/api/v1/networks/onboarding` ✓
10. **`/networks/search`** → Embedded in `/api/v1/networks/conversations/search` or `/api/v1/networks/listings` ✓
11. **`/networks/connections`** → `/api/v1/networks/connections` ✓
12. **`/networks/social`** → `/api/v1/networks/social/*` ✓
13. **`/networks/orders`** → `/api/v1/networks/orders` ✓
14. **`/networks/reservations`** → `/api/v1/networks/reservations` ✓
15. **`/networks/notifications`** → Embedded in `/api/v1/user/notifications` ✓

### ⚠️ Potentially Unused/Deprecated Endpoints:

#### 1. **Marketplace Generic Chat Paths** (Duplicated from Networks)

- `/api/v1/chat/channel`
- `/api/v1/chat/channels`
- `/api/v1/chat/token`
- `/api/v1/chat/unread`
- `/api/v1/conversations/{id}*` (Generic, not scoped to networks/marketplace)
- `/api/v1/marketplace/channels*`
- `/api/v1/marketplace/conversations`

**Status**: Likely legacy dual-routing. Networks versions are preferred.

---

#### 2. **Missing Network-specific Paths**

- **`/networks/offers-inquiries`**: NOT found - should exist for offer inquiries
- **`/networks/chats`**: NOT found - mentioned as alias for chat, but not present

**Recommendation**: These should be added or removed from expected list.

---

#### 3. **Unused Marketplace Generic Paths**

- `/api/v1/messages/channel/{channelId}/read-all`
- `/api/v1/messages/{id}` (generic, not scoped)
- `/api/v1/messages/{id}/react`
- `/api/v1/messages/{id}/read`

**Status**: Legacy non-scoped message endpoints. Networks versions should be used instead.

---

#### 4. **Dev/Debug Endpoints** (Should be removed from production)

- `/api/v1/marketplace/orders/dev/clear-reservations`
- `/api/v1/marketplace/orders/dev/reset-listing`

**Action Required**: Remove from production Swagger/routes.

---

#### 5. **Deprecated/Legacy Paths**

- `/api/v1/chat/channel`, `/api/v1/chat/channels`, etc. (generic)
- `/api/v1/conversations/{id}*` (non-scoped)
- `/api/v1/marketplace/messages/channel/{channelId}`

**Recommendation**: Keep only scoped versions:

- `/api/v1/networks/chat/*`
- `/api/v1/networks/conversations/*`
- `/api/v1/networks/messages/*`

---

## Summary Table: Endpoint Coverage

| Module                    | Expected | Defined        | Status                 |
| ------------------------- | -------- | -------------- | ---------------------- |
| Networks User             | 1        | 10+            | ✓ Comprehensive        |
| Networks Listings         | 1        | 8              | ✓ Complete             |
| Networks Offers           | 1        | 5              | ✓ Complete             |
| Networks Chat             | 1        | 4              | ✓ Complete             |
| Networks Messages         | 1        | 7              | ✓ Complete             |
| Networks Conversations    | 1        | 7              | ✓ Complete             |
| Networks Connections      | 1        | 10+            | ✓ Comprehensive        |
| Networks Social           | 1        | 17             | ✓ Comprehensive        |
| Networks Orders           | 1        | 1              | ✓ Minimal              |
| Networks Reservations     | 1        | 1              | ✓ Minimal              |
| Networks Onboarding       | 1        | 2              | ✓ Complete             |
| Networks Reference Checks | 1        | 7              | ✓ Complete             |
| Networks Search           | 1        | Embedded       | ⚠️ Implicit            |
| Networks Notifications    | 1        | Scoped to User | ⚠️ Wrong Scope         |
| **Offers-Inquiries**      | 1        | **0**          | ❌ **Missing**         |
| **Chats** (alias)         | 1        | **0**          | ❌ **Not as separate** |

---

## Recommendations

### 🔴 Critical Actions:

1. **Remove dev endpoints** from production:
   - `/api/v1/marketplace/orders/dev/*`

2. **Consolidate chat/conversations**:
   - Keep: `/api/v1/networks/chat/*`, `/api/v1/networks/conversations/*`, `/api/v1/networks/messages/*`
   - Remove: `/api/v1/chat/*`, `/api/v1/conversations/*` (generic versions)

3. **Verify missing routes**:
   - Check if `/api/v1/networks/offers-inquiries` is actually needed
   - Check if `/api/v1/networks/chats` is just an alias that doesn't need separate definition

### 🟡 Medium Priority:

1. **Scope notifications to networks** if needed:
   - Currently: `/api/v1/user/notifications`
   - Consider: `/api/v1/networks/notifications` for network-specific notifications

2. **Add searches endpoint**:
   - Add `/api/v1/networks/search` as explicit path (currently implicit in listings)

### 🟢 Clean-up:

1. Remove marketplace generic message paths if networks versions are complete
2. Archive Batch 2 and Batch 3 test collections in Postman
3. Document the dual-scope pattern (user-level vs networks-level endpoints)

---

## Files Analyzed

- ✓ [Dialist-API.postman_collection.json](postman/Dialist-API.postman_collection.json)
- ✓ [src/config/swagger.ts](src/config/swagger.ts)
- ✓ Context: Expected networks routes provided

**Report Generated**: April 9, 2026
