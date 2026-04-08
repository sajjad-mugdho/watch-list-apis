# Implementation Plan: Model Gap Fill

> **Created:** January 28, 2026  
> **Author:** Backend Team  
> **Project Type:** BACKEND (Node.js/Express/MongoDB)  
> **Status:** Ready for Implementation  
> **Context:** Figma Design Review vs Current API Implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Key Decisions from Slack](#key-decisions-from-slack)
3. [Executive Summary](#executive-summary)
4. [Current Model Inventory](#current-model-inventory)
5. [Gap Analysis by Feature Area](#gap-analysis-by-feature-area)
6. [New Models Required](#new-models-required)
7. [Schema Updates Required](#schema-updates-required)
8. [Implementation Task Breakdown](#implementation-task-breakdown)
9. [Testing Strategy](#testing-strategy)
10. [Phase X: Verification Checklist](#phase-x-verification-checklist)
11. [Risk Mitigation](#risk-mitigation)
12. [Slack Reply Template](#slack-reply-template)

---

## Overview

Fill the API model gaps identified from Figma design review to support **Social**, **Reputation**, and **Support** features. This plan incorporates key decisions from the Slack discussion with Michael to avoid unnecessary complexity.

### Success Criteria

| Criteria | Metric |
|----------|--------|
| User profile shows bio, stats | Bio field persists, stats update on actions |
| Reviews work post-order | Rating aggregates correctly on user profile |
| Watch category filters work | Search API accepts category param |
| Friendship distinct from Follow | Accept/Decline flow works |
| All tests pass | 80%+ coverage on new code |
| TypeScript compiles | `npx tsc --noEmit` passes |

---

## Key Decisions from Slack

Based on discussion with Michael (Jan 27-28, 2026):

| Topic | Decision | Rationale |
|-------|----------|-----------|
| **NetworkListing polymorphic** | ❌ Skip | ISO model already handles WTB logic |
| **Watch.category** | ✅ Add with default `"Uncategorized"` | Backward compatible with 2k+ entries |
| **ISO price_range** | ❌ Skip | Only `year_range` needed per Michael |
| **Review vs ReferenceCheck** | ✅ Separate models | Different purposes (post-sale vs vouch) |
| **Notification persistence** | ✅ Already exists | Just add new types to enum |
| **Networks onboarding** | 🟡 TBD | Discuss in standup - may need separate tracking |

---

## Executive Summary

After reviewing the Figma designs against the current API implementation:

| Category | Count | Status |
|----------|-------|--------|
| **Existing Models** | 21 | ✅ Core transaction flow covered |
| **New Models Needed** | 3 | Review, Friendship, SupportTicket |
| **Schema Updates** | 4 | User, Watch, NetworkListing, Notification |
| **New Files Required** | 13 | Models, Services, Routes, Repos |
| **Files to Modify** | ~28 | Across all layers |

### Key Gaps Identified

1. **Social Features** - Friendship (two-way) distinct from Follow (one-way)
2. **Reputation System** - Review model for post-transaction feedback
3. **Support System** - SupportTicket for "Tickets" section
4. **Profile Enhancement** - User bio, wishlist, cached stats
5. **WTB Listings** - Year ranges for "Want to Buy" posts (via ISO)
6. **Search Filters** - Watch category (Luxury, Sport, Dress, Vintage)

---

## Current Model Inventory

### Existing Models (21 Total)

| Model | Purpose | Coverage |
|-------|---------|----------|
| `User` | User accounts | ⚠️ Missing bio, wishlist, stats |
| `Watch` | Watch catalog | ⚠️ Missing category field |
| `NetworkListing` | Private network listings | ✅ Complete (WTB handled by ISO) |
| `MarketplaceListing` | Public marketplace | ✅ Complete |
| `NetworkListingChannel` | Offer negotiations | ✅ Complete |
| `Order` | Transaction lifecycle | ✅ Complete |
| `Notification` | In-app notifications | ⚠️ Missing new types |
| `ReferenceCheck` | Vouch system | ✅ Complete |
| `Follow` | One-way following | ✅ Complete |
| `Favorite` | Saved listings | ✅ Complete |
| `ISO` | "In Search Of" posts | ✅ Complete (handles WTB) |
| `RecentSearch` | Search history | ✅ Complete |
| `Subscription` | Premium tiers | ✅ Complete |
| `ChatMessage` | Message storage | ✅ Complete |
| `DeviceToken` | Push notifications | ✅ Complete |
| `MerchantOnboarding` | Finix onboarding | ✅ Complete |
| `AuditLog` | System audit | ✅ Complete |
| `RefundRequest` | Refund handling | ✅ Complete |
| `WebhookEvent` | Webhook tracking | ✅ Complete |
| `FinixWebhookEvent` | Finix webhooks | ✅ Complete |
| `GetstreamWebhookEvent` | GetStream webhooks | ✅ Complete |

### Missing Models (3)

| Model | Purpose | Priority |
|-------|---------|----------|
| `Review` | Post-transaction ratings & feedback | 🔴 High |
| `Friendship` | Two-way friend requests (Accept/Decline) | 🟡 Medium |
| `SupportTicket` | Help desk tickets | 🟢 Low |

---

## Gap Analysis by Feature Area

### 1. Profile Screen

**Figma Features:**
- Bio text ("Watch enthusiast and collector...")
- Connection count (342)
- Rating display (⭐ 4.8 with 24 reviews)
- Active orders count
- Pending offers count
- Wishlist items count
- Reference checks received
- Support tickets count

**Current API Support:**

| Feature | Status | Gap |
|---------|--------|-----|
| Bio | ❌ Missing | Add `User.bio: String` |
| Connection count | ❌ Missing | Add `User.stats.connection_count` |
| Rating display | ❌ Missing | Add `User.stats.avg_rating`, `rating_count` |
| Active orders | ✅ Exists | Query `Order` collection |
| Pending offers | ✅ Exists | Query `ListingChannel.last_offer` |
| Wishlist | ❌ Missing | Add `User.wishlist: [ObjectId]` |
| Reference checks | ✅ Exists | Query `ReferenceCheck` |
| Support tickets | ❌ Missing | Create `SupportTicket` model |

---

### 2. Search & Filters

**Figma Features:**
- Tabs: For Sale, WTB, Members
- Recent searches with type badges
- Popular brands filter chips
- Filters: Brand, Condition, Category
- Sort: Relevance, Price, Newest, Most Popular

**Current API Support:**

| Feature | Status | Gap |
|---------|--------|-----|
| Search tabs | ✅ Exists | ISO handles WTB, listings for For Sale |
| Recent searches | ✅ Exists | `RecentSearch` model has `context` |
| Brand filter | ✅ Exists | `getListingsSchema` supports |
| Condition filter | ✅ Exists | enum values defined |
| Category filter | ❌ Missing | Add `Watch.category` enum |
| Sort options | ✅ Exists | `sort_by`, `sort_order` params |
| Members search | ✅ Exists | `/users` endpoint |

---

### 3. Notifications Screen

**Figma Features:**
- Tabs: All, Buying, Selling
- Friend Requests section with count
- Offer Received with expiry
- Counter Offer with original amount
- New Match Found
- Order Update with tracking
- Reference Check Completed
- System Notifications

**Current API Support (27 types exist):**

| Feature | Status | Gap |
|---------|--------|-----|
| Notification model | ✅ Exists | Persisted, not ephemeral |
| Buying/Selling tabs | ✅ Exists | Filter by type prefix |
| Friend Requests | ❌ Missing | Need `Friendship` model |
| Offer types | ✅ Exists | `offer_received`, `counter_offer` |
| Match notifications | ✅ Exists | `iso_match` type |
| Order updates | ✅ Exists | `order_shipped`, `order_delivered`, etc. |
| Reference checks | ✅ Exists | `reference_check_*` types |

**Types to Add:**
- `review_received`, `review_reminder`
- `friend_request_received`, `friend_request_accepted`, `friend_request_declined`
- `ticket_created`, `ticket_updated`, `ticket_response`, `ticket_resolved`
- `wtb_match_found`

---

### 4. Friend Requests Screen

**Figma Features:**
- Requester avatar, name, username
- Mutual friends count
- Time ago
- Accept/Decline buttons

**Current API Support:**

| Feature | Status | Gap |
|---------|--------|-----|
| Follow model | ✅ Exists | One-way only |
| Friendship | ❌ Missing | **Need new model** |
| Mutual friends | ❌ Missing | Need aggregation logic |
| Accept/Decline | ❌ Missing | Need status field |

---

### 5. Reviews/References Tab

**Figma Features:**
- Reviews as seller
- Reviews as buyer
- Star rating (1-5)
- Review text/feedback
- Transaction reference

**Current API Support:**

| Feature | Status | Gap |
|---------|--------|-----|
| ReferenceCheck | ✅ Exists | For vouching, not post-sale reviews |
| Review model | ❌ Missing | **Need new model** |
| Rating aggregation | ❌ Missing | Need `User.stats` |

---

## New Models Required

### 1. Review Model

**Purpose:** Store post-transaction ratings and feedback (distinct from ReferenceCheck which is for vouching)

**File:** `src/models/Review.ts`

```typescript
import mongoose, { Document, Schema, Types } from "mongoose";

export const REVIEW_ROLE_VALUES = ["buyer", "seller"] as const;
export type ReviewRole = (typeof REVIEW_ROLE_VALUES)[number];

export interface IReview extends Document {
  _id: Types.ObjectId;
  
  // Participants
  reviewer_id: Types.ObjectId;       // User leaving the review
  target_user_id: Types.ObjectId;    // User being reviewed
  
  // Context
  order_id: Types.ObjectId;          // Related transaction
  listing_id?: Types.ObjectId;       // Related listing
  role: ReviewRole;                  // Reviewer's role in transaction
  
  // Content
  rating: number;                    // 1-5 stars
  feedback: string;                  // Review text (required)
  
  // Options
  is_anonymous: boolean;             // Hide reviewer name
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    reviewer_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    target_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    listing_id: {
      type: Schema.Types.ObjectId,
      ref: "NetworkListing",
      default: null,
    },
    role: {
      type: String,
      enum: REVIEW_ROLE_VALUES,
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    feedback: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1000,
    },
    is_anonymous: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// One review per order per reviewer
ReviewSchema.index({ order_id: 1, reviewer_id: 1 }, { unique: true });

// For fetching reviews about a user
ReviewSchema.index({ target_user_id: 1, createdAt: -1 });

// For rating aggregation
ReviewSchema.index({ target_user_id: 1, rating: 1 });

export const Review = mongoose.model<IReview>("Review", ReviewSchema, "reviews");
```

**API Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/reviews` | Create review after order completion |
| GET | `/api/v1/reviews` | Get current user's reviews |
| GET | `/api/v1/users/:id/reviews` | Get reviews for a specific user |
| GET | `/api/v1/users/:id/reviews/summary` | Get rating summary (avg, count by role) |

---

### 2. Friendship Model

**Purpose:** Handle two-way friend requests with Accept/Decline (distinct from one-way Follow)

**File:** `src/models/Friendship.ts`

```typescript
import mongoose, { Document, Schema, Types } from "mongoose";

export const FRIENDSHIP_STATUS_VALUES = ["pending", "accepted", "declined"] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUS_VALUES)[number];

export interface IFriendship extends Document {
  _id: Types.ObjectId;
  
  // Participants
  requester_id: Types.ObjectId;      // User who sent request
  recipient_id: Types.ObjectId;      // User who received request
  
  // Status
  status: FriendshipStatus;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  accepted_at?: Date;
}

const FriendshipSchema = new Schema<IFriendship>(
  {
    requester_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: FRIENDSHIP_STATUS_VALUES,
      default: "pending",
      index: true,
    },
    accepted_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate requests (either direction)
FriendshipSchema.index(
  { requester_id: 1, recipient_id: 1 },
  { unique: true }
);

// For finding pending requests for a user
FriendshipSchema.index({ recipient_id: 1, status: 1, createdAt: -1 });

// For finding mutual friends
FriendshipSchema.index({ status: 1, requester_id: 1 });
FriendshipSchema.index({ status: 1, recipient_id: 1 });

export const Friendship = mongoose.model<IFriendship>(
  "Friendship",
  FriendshipSchema,
  "friendships"
);
```

**API Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/friends/request/:userId` | Send friend request |
| GET | `/api/v1/friends/requests` | Get pending requests (received) |
| GET | `/api/v1/friends/requests/sent` | Get pending requests (sent) |
| POST | `/api/v1/friends/:id/accept` | Accept friend request |
| POST | `/api/v1/friends/:id/decline` | Decline friend request |
| DELETE | `/api/v1/friends/:id` | Remove friend |
| GET | `/api/v1/friends` | Get all friends |
| GET | `/api/v1/friends/mutual/:userId` | Get mutual friends with user |

---

### 3. SupportTicket Model (Optional - P3)

**Purpose:** Power the "Tickets" section in Activity tab

**File:** `src/models/SupportTicket.ts`

```typescript
import mongoose, { Document, Schema, Types } from "mongoose";

export const TICKET_CATEGORY_VALUES = [
  "order", "payment", "account", "verification", "listing", "other",
] as const;

export const TICKET_STATUS_VALUES = [
  "open", "in_progress", "awaiting_response", "resolved", "closed",
] as const;

export const TICKET_PRIORITY_VALUES = ["low", "medium", "high", "urgent"] as const;

export interface ISupportTicket extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  subject: string;
  description: string;
  category: (typeof TICKET_CATEGORY_VALUES)[number];
  status: (typeof TICKET_STATUS_VALUES)[number];
  priority: (typeof TICKET_PRIORITY_VALUES)[number];
  assigned_to?: Types.ObjectId;
  order_id?: Types.ObjectId;
  messages: Array<{
    sender_id: Types.ObjectId;
    sender_type: "user" | "support";
    message: string;
    createdAt: Date;
  }>;
  resolution?: string;
  resolved_at?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Schema Updates Required

### 1. User Schema Updates

**File:** `src/models/User.ts`

```diff
const UserSchema = new Schema({
  // Existing fields...
  
+ // Profile Enhancement
+ bio: {
+   type: String,
+   maxlength: 500,
+   default: null,
+   trim: true,
+ },
+ 
+ social_links: {
+   instagram: { type: String, default: null },
+   twitter: { type: String, default: null },
+   website: { type: String, default: null },
+ },
+ 
+ // Wishlist
+ wishlist: [{
+   type: Schema.Types.ObjectId,
+   ref: 'NetworkListing',
+ }],
+ 
+ // Cached Stats (denormalized for performance)
+ stats: {
+   follower_count: { type: Number, default: 0 },
+   following_count: { type: Number, default: 0 },
+   friend_count: { type: Number, default: 0 },
+   avg_rating: { type: Number, default: 0 },
+   rating_count: { type: Number, default: 0 },
+   review_count_as_buyer: { type: Number, default: 0 },
+   review_count_as_seller: { type: Number, default: 0 },
+ },
});
```

---

### 2. Watch Schema Updates

**File:** `src/models/Watches.ts`

```diff
const WatchSchema = new Schema({
  brand: { type: String, required: true, index: true },
  model: { type: String, required: true },
  reference: { type: String },
  
+ category: {
+   type: String,
+   enum: ['Luxury', 'Sport', 'Dress', 'Vintage', 'Casual', 'Dive', 'Pilot', 'Uncategorized'],
+   default: 'Uncategorized',  // Backward compatible with 2k+ entries
+   index: true,
+ },
});
```

---

### 3. Notification Schema Updates

**File:** `src/models/Notification.ts`

```diff
export const NOTIFICATION_TYPES = [
  // Existing 27 types...
  
+ // Review notifications
+ 'review_received',
+ 'review_reminder',
  
+ // Friendship notifications
+ 'friend_request_received',
+ 'friend_request_accepted',
+ 'friend_request_declined',
  
+ // Support ticket notifications (if implemented)
+ 'ticket_created',
+ 'ticket_updated',
+ 'ticket_response',
+ 'ticket_resolved',
  
+ // WTB matching
+ 'wtb_match_found',
] as const;
```

---

## Implementation Task Breakdown

### Phase 1: User Schema Updates 🔴 P0

**Agent:** `backend-specialist` | **Effort:** Low | **Timeline:** Week 1

| Task | INPUT | OUTPUT | VERIFY |
|------|-------|--------|--------|
| 1.1 Add `User.bio` | User without bio | `bio: String(500)` | `User.create({ bio })` works |
| 1.2 Add `User.social_links` | User without social | `social_links: {}` | Update saves correctly |
| 1.3 Add `User.wishlist` | User without wishlist | `wishlist: [ObjectId]` | Add/remove works |
| 1.4 Add `User.stats` | User without stats | `stats: { ... }` | Defaults to 0 |
| 1.5 Profile update endpoint | No endpoint | `PUT /api/v1/users/me/profile` | curl test passes |
| 1.6 Zod validation | No schema | `updateProfileSchema` | Invalid rejected |

**Files Modified:** `User.ts`, `schemas.ts`, `userHandlers.ts`, `UserService.ts`

---

### Phase 2: Watch Category 🟡 P1

**Agent:** `backend-specialist` | **Effort:** Low | **Timeline:** Week 1

| Task | INPUT | OUTPUT | VERIFY |
|------|-------|--------|--------|
| 2.1 Add `Watch.category` | Watch without category | `category: enum` with default | 2k+ entries unaffected |
| 2.2 Update filter schemas | No category filter | `getListingsSchema` with category | `?category=Luxury` works |
| 2.3 Migration script (optional) | Uncategorized watches | Auto-categorize by brand | Reversible |

**Files Modified:** `Watches.ts`, `schemas.ts`, `watchesHandlers.ts`

---

### Phase 3: Review Model 🔴 P0

**Agent:** `backend-specialist` | **Effort:** Medium | **Timeline:** Week 2

| Task | INPUT | OUTPUT | VERIFY |
|------|-------|--------|--------|
| 3.1 Create `Review.ts` | No model | Review schema with indexes | Model compiles |
| 3.2 Create `ReviewService.ts` | No service | CRUD + aggregation | Methods work |
| 3.3 Create `ReviewRepository.ts` | No repo | Data access layer | Follows patterns |
| 3.4 Create `reviewRoutes.ts` | No routes | 4 endpoints | All protected |
| 3.5 Add notification types | Missing types | `review_received`, `review_reminder` | Notifications work |
| 3.6 Trigger on order completion | No trigger | `review_reminder` on delivered | User gets notification |
| 3.7 Update `User.stats` | No recalc | `avg_rating` updates | Stats accurate |

**Files Created:** `Review.ts`, `ReviewService.ts`, `ReviewRepository.ts`, `reviewRoutes.ts`, `reviewHandlers.ts`
**Files Modified:** `Notification.ts`, `User.ts`, `orderHandlers.ts`, `NotificationService.ts`

---

### Phase 4: Friendship Model 🟡 P1

**Agent:** `backend-specialist` | **Effort:** Medium | **Timeline:** Week 2-3

| Task | INPUT | OUTPUT | VERIFY |
|------|-------|--------|--------|
| 4.1 Create `Friendship.ts` | Only Follow | Friendship with status | Distinct from Follow |
| 4.2 Create `FriendshipService.ts` | No service | Request/accept/decline | Flow works |
| 4.3 Create `friendshipRoutes.ts` | No routes | 8 endpoints | All protected |
| 4.4 Add notification types | Missing types | `friend_request_*` | Notifications work |
| 4.5 Mutual friends logic | No logic | `getMutualFriends()` | Returns correctly |
| 4.6 Update `User.stats` | No friend_count | `friend_count` updates | Stats accurate |

**Files Created:** `Friendship.ts`, `FriendshipService.ts`, `FriendshipRepository.ts`, `friendshipRoutes.ts`
**Files Modified:** `Notification.ts`, `User.ts`, `NotificationService.ts`, `FeedService.ts`

---

### Phase 5: ISO Year Range 🟢 P2

**Agent:** `backend-specialist` | **Effort:** Low | **Timeline:** Week 3

> **Note:** ISO model already has `criteria.year_min` and `criteria.year_max`. Just verify alignment with UI.

| Task | INPUT | OUTPUT | VERIFY |
|------|-------|--------|--------|
| 5.1 Verify ISO year fields | Existing fields | Confirm works | UI displays range |
| 5.2 Update validation if needed | Current schema | Aligned schema | Validation passes |

---

### Phase 6: Notification Types 🟢 P2

**Agent:** `backend-specialist` | **Effort:** Low | **Timeline:** Week 3

| Task | INPUT | OUTPUT | VERIFY |
|------|-------|--------|--------|
| 6.1 Add all new types | 27 types | 37+ types | All types work |
| 6.2 Update NotificationService | Current handlers | Handle new types | Notifications sent |

---

### Phase 7: SupportTicket Model 🟢 P3 (Optional)

**Agent:** `backend-specialist` | **Effort:** Low | **Timeline:** Week 4

*Defer to later sprint if not blocking*

---

## Testing Strategy

Following **test-engineer** best practices:

### Testing Pyramid

```
        /\          E2E (Few)
       /  \         - Order → Review flow
      /----\        - Friend request → Accept
     /      \       Integration (Some)
    /--------\      - Review endpoints
   /          \     - Friendship endpoints
  /------------\    Unit (Many)
                    - ReviewService
                    - FriendshipService
```

### Test Files to Create

```
src/__tests__/
├── unit/
│   ├── services/
│   │   ├── ReviewService.test.ts
│   │   └── FriendshipService.test.ts
│   └── models/
│       └── Review.test.ts
└── integration/
    ├── reviewRoutes.test.ts
    └── friendshipRoutes.test.ts
```

### Coverage Targets

| Area | Target |
|------|--------|
| ReviewService | 80%+ |
| FriendshipService | 80%+ |
| New endpoints | 100% happy path |
| Edge cases | All error scenarios |

---

## Phase X: Verification Checklist

### P0: TypeScript & Lint
```bash
npm run lint && npx tsc --noEmit
```
- [ ] No TypeScript errors
- [ ] No lint warnings

### P1: Unit Tests
```bash
npm test -- --coverage
```
- [ ] ReviewService 80%+ coverage
- [ ] FriendshipService 80%+ coverage
- [ ] All tests pass

### P2: Integration Tests
```bash
npm run test:integration
```
- [ ] Review endpoints return correct responses
- [ ] Friendship endpoints return correct responses
- [ ] Auth middleware works on all new routes

### P3: E2E Tests
```bash
npm run test:e2e
```
- [ ] Create order → complete → leave review → stats update
- [ ] Send friend request → accept → mutual friends work

### P4: Security Audit
- [ ] All new routes have auth middleware
- [ ] Input validation on all endpoints
- [ ] No hardcoded secrets
- [ ] Rate limiting in place

### P5: Manual Verification
- [ ] POST /reviews with valid order_id creates review
- [ ] GET /users/:id/reviews returns reviews
- [ ] Friend request flow works end-to-end
- [ ] User.stats updates after review/friend actions

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing users | All new fields have defaults |
| 2k+ watch entries | `category` defaults to 'Uncategorized' |
| Stats inconsistency | Recalculate on write, cache in User doc |
| Performance on mutual friends | Index both directions, limit result size |
| Notification spam | Rate limit notifications per user |

---

## Slack Reply Template

Based on this plan, here's what you can reply to Michael:

---

> **On Review Model & Post-Order Completion:**
> 
> Creating a separate `Review` model (distinct from `ReferenceCheck`):
> - **ReferenceCheck** = Vouch system (verification before/during transaction)
> - **Review** = Star rating (1-5) + feedback text after order delivered
> 
> **Flow:**
> 1. Order.status → `"delivered"` triggers `review_reminder` notification
> 2. Buyer calls `POST /reviews` with rating + feedback
> 3. `User.stats.avg_rating` updates automatically on seller's profile
> 
> ---
> 
> **On Persistent Notification Entries:**
> 
> The `Notification` model already persists (27 types exist). We're adding:
> - `review_received` — when someone reviews you
> - `wtb_match_found` — when listing matches WTB criteria
> 
> These appear in Activity tab with existing offer/order notifications.
> 
> ---
> 
> **On Networks Onboarding (Umair's point):**
> 
> Agree — keep data in `User` model, but can track progress separately:
> ```
> onboarding.marketplace_completed: boolean
> onboarding.networks_completed: boolean
> ```
> Or create lightweight `OnboardingProgress` model if steps diverge. Happy to discuss in standup.

---

## Files Summary

### Files to Create (13)

| Layer | File | Purpose |
|-------|------|---------|
| Models | `src/models/Review.ts` | Review schema |
| Models | `src/models/Friendship.ts` | Friendship schema |
| Models | `src/models/SupportTicket.ts` | Support ticket schema (optional) |
| Services | `src/services/review/ReviewService.ts` | Review business logic |
| Services | `src/services/friendship/FriendshipService.ts` | Friendship logic |
| Repositories | `src/repositories/ReviewRepository.ts` | Review data access |
| Repositories | `src/repositories/FriendshipRepository.ts` | Friendship data access |
| Routes | `src/routes/reviewRoutes.ts` | Review endpoints |
| Routes | `src/routes/friendshipRoutes.ts` | Friendship endpoints |
| Handlers | `src/handlers/reviewHandlers.ts` | Review request handlers |
| Handlers | `src/handlers/friendshipHandlers.ts` | Friendship request handlers |
| Tests | `src/__tests__/unit/services/ReviewService.test.ts` | Unit tests |
| Tests | `src/__tests__/integration/reviewRoutes.test.ts` | Integration tests |

### Files to Modify (~20)

| Layer | File | Changes |
|-------|------|---------|
| Models | `User.ts` | Add bio, wishlist, stats |
| Models | `Watches.ts` | Add category enum |
| Models | `Notification.ts` | Add new types |
| Services | `UserService.ts` | Add stats update methods |
| Services | `NotificationService.ts` | Handle new notification types |
| Services | `FeedService.ts` | Add friendship activities |
| Handlers | `userHandlers.ts` | Profile update handler |
| Handlers | `orderHandlers.ts` | Trigger review prompt |
| Handlers | `watchesHandlers.ts` | Category filter |
| Routes | `index.ts` | Mount new routes |
| Validation | `schemas.ts` | All new validation schemas |

---

## Next Steps

1. ✅ Review this plan with team
2. ⬜ Confirm priority order
3. ⬜ Create Jira tickets for each phase
4. ⬜ Begin Phase 1 (User Schema) immediately
5. ⬜ Set up test infrastructure

---

*Document prepared for internal review. Please provide feedback on priorities and timeline.*
