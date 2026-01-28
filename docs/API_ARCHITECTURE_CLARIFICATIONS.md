# API Architecture Clarifications

Response to Michael's code review feedback addressing platform separation, route conventions, and message flow.

---

## Quick Reference: Michael's IMPORTANT Items

| # | Item | Status | Section |
|---|------|--------|---------|
| 1 | Platform Separation (Marketplace vs Networks) | ✅ Complete | [Section 2](#2-platform-separation-important) |
| 2 | Messages hot-path clarification | ✅ Documented | [Section 1](#1-message-flow-clarification) |
| 3 | Current-user route conventions | ✅ Complete | [Section 3](#3-current-user-route-conventions-important) |
| 4 | Favorites/Recent Searches platform scoping | ✅ Complete | [Section 5](#5-favorites--recent-searches-important) |
| 5 | Reference Checks networks-only | ✅ Confirmed | [Section 6](#6-reference-checks) |

---

## 1. Message Flow Clarification

### Michael's Question
> Is `/messages/send` a hot-path? Unclear how regular messaging works on the client. Clarification needed on regular messages vs socket behavior.

### Answer: NO, `/messages/send` is NOT hot-path

```
┌─────────────────────────────────────────────────────────────────┐
│  REGULAR USER MESSAGES (User typing "Hello, interested!")       │
│                                                                  │
│  Client → Stream WebSocket → Stream Server → Other Client        │
│                                    │                             │
│                              (async webhook)                     │
│                                    ▼                             │
│                              Backend → MongoDB (persistence)     │
│                                                                  │
│  ⚡ HOT PATH: Client → Stream (sub-second)                       │
│  🐢 COLD PATH: Webhook → MongoDB (async, not blocking)           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SYSTEM MESSAGES (Offers, Orders, Status Updates)               │
│                                                                  │
│  Client → Backend API → MongoDB → Stream API → Client            │
│                                                                  │
│  ⚙️ CONTROLLED PATH: Goes through backend for validation         │
└─────────────────────────────────────────────────────────────────┘
```

### `/messages/send` Route Usage

| Message Type | Uses `/messages/send`? | Flow |
|--------------|------------------------|------|
| User types "Hello" | **NO** | WebSocket direct to Stream |
| User sends offer | **YES** | Backend validates → MongoDB → Stream |
| Order status update | **YES** | Backend-initiated system message |
| Read receipts | **NO** | Stream WebSocket |

**Summary:** Action-messages (offers, orders) go through backend. Regular chat is WebSocket-direct.

---

## 2. Platform Separation (IMPORTANT)

### Michael's Concern
> Most functionality has different logic between Marketplace and Networks. These should always be explicitly communicated. Avoid implicit platform distinctions.

### Current Problem (messageRoutes.ts)

```typescript
// ❌ BAD: Implicit platform detection
const [marketplaceChannel, networkChannel] = await Promise.all([
  MarketplaceListingChannel.findOne({ getstream_channel_id }),
  NetworkListingChannel.findOne({ getstream_channel_id }),
]);
const channel = marketplaceChannel || networkChannel;
```

### Proposed Fix: Explicit Platform Routes

```
// ✅ GOOD: Platform-explicit routes
/api/v1/marketplace/channels/:id/messages
/api/v1/networks/channels/:id/messages
```

### Route Restructuring Plan

| Current | Proposed |
|---------|----------|
| `POST /messages/send` | `POST /{platform}/channels/:id/messages` |
| `GET /messages/channel/:id` | `GET /{platform}/channels/:id/messages` |
| `POST /chat/channel` | **DEPRECATE** (use `/{platform}/listings/:id/inquire`) |
| `GET /chat/channels` | `GET /{platform}/channels` |

### Benefits (per Michael's feedback)
- ✅ Handlers know platform context immediately
- ✅ No dual-collection queries
- ✅ Simpler branching logic
- ✅ Easier client API modules
- ✅ Clarifies channel/message relationship

---

## 3. Current-User Route Conventions (IMPORTANT)

### Michael's Observation
> Currently mixing conventions: namespace-based, domain suffix-based, implicit.

### Current Mixed Patterns

| Pattern | Examples |
|---------|----------|
| Namespace | `/user/marketplace`, `/user/networks` |
| Domain suffix | `/subscriptions/current`, `/isos/my` |
| Implicit | `/favorites`, `/notifications` |

### Proposed Standard

```
/api/v1/user/**         → Auth-scoped, current user (PRIVATE)
/api/v1/users/:id/**    → Public/permissioned user resources
```

### Migration Table

| Current | Proposed | Notes |
|---------|----------|-------|
| `GET /notifications` | `GET /user/notifications` | Current user's notifications |
| `GET /subscriptions/current` | `GET /user/subscription` | Current user's subscription |
| `GET /favorites` | `GET /user/favorites` | Current user's favorites |
| `GET /isos/my` | `GET /user/isos` | Current user's ISO orders |
| `GET /feeds/timeline` | `GET /user/feeds/timeline` | Allow growth in feeds/ |
| `GET /feeds/following` | `GET /user/following` | Follows under user/ |
| `GET /feeds/followers` | `GET /user/followers` | Follows under user/ |

### Client SDK Mapping

```typescript
// Clean SDK structure
api.user.notifications.list()     // GET /user/notifications
api.user.subscription.get()       // GET /user/subscription
api.user.favorites.list()         // GET /user/favorites
api.users(id).profile.get()       // GET /users/:id/profile
```

---

## 4. `POST /chat/channel` Clarification

### Michael's Question
> Is this redundant when we already have: listing/:id/{action}?

### Answer: YES, it's redundant for production use

| Endpoint | Purpose | Recommendation |
|----------|---------|----------------|
| `POST /chat/channel` | Low-level channel creation | **DEPRECATE** (internal/testing only) |
| `POST /listings/:id/inquire` | Business action: inquiry | ✅ Use this |
| `POST /listings/:id/offers` | Business action: offer | ✅ Use this |

**Channels should be created implicitly through business actions (inquire, offer), not directly.**

---

## 5. Favorites & Recent Searches (IMPORTANT)

### Michael's Requirements

| Feature | Marketplace | Networks |
|---------|-------------|----------|
| Favorites | For-sale only | For-sale + ISO/WTB |
| Recent Searches | Platform-scoped | Platform-scoped |
| Cross-platform visibility | ❌ NO | ❌ NO |

### Proposed Model Updates

```typescript
// Favorite
interface Favorite {
  user_id: ObjectId;
  listing_id: ObjectId;
  platform: 'marketplace' | 'networks';  // NEW
  listing_type: 'for-sale' | 'wtb-iso';
  createdAt: Date;
}

// RecentSearch
interface RecentSearch {
  user_id: ObjectId;
  platform: 'marketplace' | 'networks';  // NEW
  context: 'for-sale' | 'profiles' | 'wtb-iso';
  query: string;
  createdAt: Date;
}
```

### Route Locations

```
GET /user/favorites?platform=marketplace
GET /user/favorites?platform=networks
GET /user/recent-searches?platform=marketplace
GET /user/recent-searches?platform=networks
```

### Naming Consideration
Michael suggested "watchlist" - can be aliased: `GET /user/watchlist` → `GET /user/favorites`

---

## 6. Reference Checks

### Confirmed Constraints (per Michael)

| Requirement | Status |
|-------------|--------|
| Networks-only | ✅ Enforced |
| No Marketplace support | ✅ Enforced |
| Created ONLY through active Order | ✅ Enforced |
| Either buyer or seller can create | ✅ Supported |
| Exposes order price | ✅ Included |
| Exposes users involved | ✅ Included |
| Exposes user roles (buyer/seller) | ✅ Included |
| Exposes private contract text | ✅ Included |

---

## 7. Feeds & Follow System

### Michael's Note
> Follows may be more appropriate under user/, outside feeds domain. Marketplace does NOT support follow functionality.

### Proposed Structure

```
/api/v1/user/following          # Users I follow (Networks only)
/api/v1/user/followers          # Users following me (Networks only)
/api/v1/user/feeds/timeline     # Activity feed (Networks only)
/api/v1/user/tokens/feed        # GetStream feed token
/api/v1/user/tokens/chat        # GetStream chat token
```

### Platform Restrictions

| Feature | Marketplace | Networks |
|---------|-------------|----------|
| Follow/Unfollow | ❌ | ✅ |
| Activity Feed | ❌ | ✅ |
| Chat | ✅ (listing-based) | ✅ (user-based + listing) |

---

## Action Items

### Phase 1: This PR ✅
- [x] Document message flow (hot-path clarification)
- [x] Document `/messages/send` usage
- [x] Document platform separation plan
- [x] Document route convention proposal
- [x] Confirm reference checks constraints

### Phase 2: Route Refactoring ✅
- [x] `/{platform}/channels/:id/messages` structure
- [x] Consolidate `/user/**` routes
- [x] Deprecate `/chat/channel` direct endpoint
- [x] Add `platform` field to Favorites model
- [x] Add `platform` field to RecentSearch model

### Phase 3: Client SDK Alignment
- [ ] `api.marketplace.channels.*`
- [ ] `api.networks.channels.*`
- [ ] `api.user.*` for current-user resources
