# Dialist API - Model Gap Analysis & Implementation Plan

> **Date:** January 27, 2025  
> **Author:** Backend Team  
> **Status:** Draft for Review  
> **Context:** Figma Design Review vs Current API Implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Model Inventory](#current-model-inventory)
3. [Gap Analysis by Feature Area](#gap-analysis-by-feature-area)
4. [New Models Required](#new-models-required)
5. [Schema Updates Required](#schema-updates-required)
6. [Logic Impact Analysis](#logic-impact-analysis)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Appendix: Figma Screens Analysis](#appendix-figma-screens-analysis)

---

## Executive Summary

After reviewing the Figma designs against the current API implementation, we have identified:

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
5. **WTB Listings** - Year/price ranges for "Want to Buy" posts
6. **Search Filters** - Watch category (Luxury, Sport, Dress, Vintage)

---

## Current Model Inventory

### Existing Models (21 Total)

| Model | Purpose | Coverage |
|-------|---------|----------|
| `User` | User accounts | ⚠️ Missing bio, wishlist, stats |
| `Watch` | Watch catalog | ⚠️ Missing category field |
| `NetworkListing` | Private network listings | ⚠️ Missing WTB type/ranges |
| `MarketplaceListing` | Public marketplace | ✅ Complete |
| `NetworkListingChannel` | Offer negotiations | ✅ Complete |
| `Order` | Transaction lifecycle | ✅ Complete |
| `Notification` | In-app notifications | ⚠️ Missing new types |
| `ReferenceCheck` | Vouch system | ✅ Complete |
| `Follow` | One-way following | ✅ Complete |
| `Favorite` | Saved listings | ✅ Complete |
| `ISO` | "In Search Of" posts | ✅ Complete |
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
| Search tabs | ⚠️ Partial | Need `NetworkListing.type` field |
| Recent searches | ✅ Exists | `RecentSearch` model has `context` |
| Brand filter | ✅ Exists | `getListingsSchema` supports |
| Condition filter | ✅ Exists | enum values defined |
| Category filter | ❌ Missing | Add `Watch.category` enum |
| Sort options | ✅ Exists | `sort_by`, `sort_order` params |
| Members search | ✅ Exists | `/users` endpoint |

---

### 3. WTB (Want to Buy) Listings

**Figma Features:**
- Title: "ISO: Rolex Submariner 126610LN"
- Condition: "Like New, Excellent" (multiple)
- Contents: "Full Set, Complete"
- Year: "2020-2023" (range)
- "Strong Call" badge

**Current API Support:**

| Feature | Status | Gap |
|---------|--------|-----|
| ISO model | ✅ Exists | Has `criteria.year_min/max` |
| Multiple conditions | ❌ Missing | `ISO.criteria.condition` is single value |
| WTB in NetworkListing | ❌ Missing | Need `type: 'wtb'` field |
| Year range | ❌ Missing | Add `year_range: {min, max}` |
| Price range | ❌ Missing | Add `price_range: {min, max}` |
| Urgency badge | ⚠️ Partial | `ISO.urgency` exists but not in listing |

---

### 4. Notifications Screen

**Figma Features:**
- Tabs: All, Buying, Selling
- Friend Requests section with count
- Offer Received with expiry
- Counter Offer with original amount
- New Match Found
- Order Update with tracking
- Reference Check Completed
- System Notifications

**Current API Support:**

| Feature | Status | Gap |
|---------|--------|-----|
| Notification model | ✅ Exists | 30+ types supported |
| Buying/Selling tabs | ✅ Exists | Filter by type prefix |
| Friend Requests | ❌ Missing | Need `Friendship` model |
| Offer types | ✅ Exists | `offer_received`, `counter_offer` |
| Match notifications | ✅ Exists | `iso_match` type |
| Order updates | ✅ Exists | `order_shipped`, etc. |
| Reference checks | ✅ Exists | `reference_check_*` types |

---

### 5. Friend Requests Screen

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

### 6. Reviews/References Tab

**Figma Features:**
- Reviews as seller
- Reviews as buyer
- Star rating (1-5)
- Review text/feedback
- Transaction reference

**Current API Support:**

| Feature | Status | Gap |
|---------|--------|-----|
| ReferenceCheck | ✅ Exists | For vouching, not reviews |
| Review model | ❌ Missing | **Need new model** |
| Rating aggregation | ❌ Missing | Need `User.stats` |

---

## New Models Required

### 1. Review Model

**Purpose:** Store post-transaction ratings and feedback

```typescript
// src/models/Review.ts

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

```
POST   /api/v1/reviews                    # Create review after order completion
GET    /api/v1/reviews                    # Get current user's reviews
GET    /api/v1/users/:id/reviews          # Get reviews for a specific user
GET    /api/v1/users/:id/reviews/summary  # Get rating summary (avg, count by role)
```

---

### 2. Friendship Model

**Purpose:** Handle two-way friend requests with Accept/Decline

```typescript
// src/models/Friendship.ts

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

// Static methods
FriendshipSchema.statics.getMutualFriendsCount = async function(
  userId1: string,
  userId2: string
): Promise<number> {
  // Get both users' friends
  const user1Friends = await this.find({
    status: "accepted",
    $or: [{ requester_id: userId1 }, { recipient_id: userId1 }],
  });
  
  const user2Friends = await this.find({
    status: "accepted",
    $or: [{ requester_id: userId2 }, { recipient_id: userId2 }],
  });
  
  // Find intersection
  const user1FriendIds = new Set(user1Friends.flatMap(f => 
    [f.requester_id.toString(), f.recipient_id.toString()]
  ).filter(id => id !== userId1));
  
  const user2FriendIds = new Set(user2Friends.flatMap(f => 
    [f.requester_id.toString(), f.recipient_id.toString()]
  ).filter(id => id !== userId2));
  
  let count = 0;
  user1FriendIds.forEach(id => {
    if (user2FriendIds.has(id)) count++;
  });
  
  return count;
};

export const Friendship = mongoose.model<IFriendship>(
  "Friendship",
  FriendshipSchema,
  "friendships"
);
```

**API Endpoints:**

```
POST   /api/v1/friends/request/:userId     # Send friend request
GET    /api/v1/friends/requests            # Get pending requests (received)
GET    /api/v1/friends/requests/sent       # Get pending requests (sent)
POST   /api/v1/friends/:id/accept          # Accept friend request
POST   /api/v1/friends/:id/decline         # Decline friend request
DELETE /api/v1/friends/:id                 # Remove friend
GET    /api/v1/friends                     # Get all friends
GET    /api/v1/friends/mutual/:userId      # Get mutual friends with user
```

---

### 3. SupportTicket Model

**Purpose:** Power the "Tickets" section in Activity tab

```typescript
// src/models/SupportTicket.ts

import mongoose, { Document, Schema, Types } from "mongoose";

export const TICKET_CATEGORY_VALUES = [
  "order",
  "payment",
  "account",
  "verification",
  "listing",
  "other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORY_VALUES)[number];

export const TICKET_STATUS_VALUES = [
  "open",
  "in_progress",
  "awaiting_response",
  "resolved",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUS_VALUES)[number];

export const TICKET_PRIORITY_VALUES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITY_VALUES)[number];

export interface ITicketMessage {
  sender_id: Types.ObjectId;
  sender_type: "user" | "support";
  message: string;
  attachments?: string[];
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  _id: Types.ObjectId;
  
  // Owner
  user_id: Types.ObjectId;
  
  // Ticket details
  subject: string;
  description: string;
  category: TicketCategory;
  
  // Status
  status: TicketStatus;
  priority: TicketPriority;
  
  // Assignment
  assigned_to?: Types.ObjectId;
  
  // Related entities
  order_id?: Types.ObjectId;
  listing_id?: Types.ObjectId;
  
  // Conversation
  messages: ITicketMessage[];
  
  // Resolution
  resolution?: string;
  resolved_at?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const TicketMessageSchema = new Schema<ITicketMessage>(
  {
    sender_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sender_type: { type: String, enum: ["user", "support"], required: true },
    message: { type: String, required: true, trim: true },
    attachments: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    category: {
      type: String,
      enum: TICKET_CATEGORY_VALUES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: TICKET_STATUS_VALUES,
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: TICKET_PRIORITY_VALUES,
      default: "medium",
    },
    assigned_to: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    listing_id: {
      type: Schema.Types.ObjectId,
      ref: "NetworkListing",
      default: null,
    },
    messages: [TicketMessageSchema],
    resolution: {
      type: String,
      default: null,
    },
    resolved_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// User's tickets by status
SupportTicketSchema.index({ user_id: 1, status: 1, createdAt: -1 });

// Admin queue
SupportTicketSchema.index({ status: 1, priority: 1, createdAt: 1 });

export const SupportTicket = mongoose.model<ISupportTicket>(
  "SupportTicket",
  SupportTicketSchema,
  "support_tickets"
);
```

**API Endpoints:**

```
POST   /api/v1/support/tickets              # Create ticket
GET    /api/v1/support/tickets              # Get user's tickets
GET    /api/v1/support/tickets/:id          # Get ticket details
POST   /api/v1/support/tickets/:id/messages # Add message to ticket
PATCH  /api/v1/support/tickets/:id          # Update ticket (close, etc.)
```

---

## Schema Updates Required

### 1. User Schema Updates

**File:** `src/models/User.ts`

```diff
const UserSchema = new Schema({
  // Existing fields...
  external_id: { type: String, required: true, unique: true },
  display_name: { type: String },
  email: { type: String },
  
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

**Impact:**
- `UserService.ts` - Add `updateStats()`, `updateBio()` methods
- `UserRepository.ts` - Add wishlist operations
- `userHandlers.ts` - Add profile update endpoint
- `schemas.ts` - Add `updateProfileSchema`

---

### 2. Watch Schema Updates

**File:** `src/models/Watch.ts`

```diff
const WatchSchema = new Schema({
  brand: { type: String, required: true, index: true },
  model: { type: String, required: true },
  reference: { type: String },
  
+ category: {
+   type: String,
+   enum: ['Luxury', 'Sport', 'Dress', 'Vintage', 'Casual', 'Dive', 'Pilot'],
+   index: true,
+ },
});
```

**Impact:**
- `schemas.ts` - Add category to `getListingsSchema` and `getWatchesSchema`
- `watchesHandlers.ts` - Add category filter in queries

---

### 3. NetworkListing Schema Updates

**File:** `src/models/NetworkListing.ts`

```diff
const NetworkListingSchema = new Schema({
  // Existing fields...
  user_id: { type: Schema.Types.ObjectId, required: true },
  watch_id: { type: Schema.Types.ObjectId, required: true },
  price: { type: Number },
  condition: { type: String },
  
+ // Listing type
+ type: {
+   type: String,
+   enum: ['for_sale', 'wtb'],
+   default: 'for_sale',
+   required: true,
+   index: true,
+ },
+ 
+ // For WTB listings - ranges instead of specific values
+ year_range: {
+   min: { type: Number, min: 1800 },
+   max: { type: Number, max: 2030 },
+ },
+ 
+ price_range: {
+   min: { type: Number, min: 0 },
+   max: { type: Number },
+ },
+ 
+ // Multiple acceptable conditions for WTB
+ acceptable_conditions: [{
+   type: String,
+   enum: ['new', 'like-new', 'excellent', 'good', 'fair', 'poor'],
+ }],
+ 
+ // Description for WTB (what they're looking for)
+ wtb_description: {
+   type: String,
+   maxlength: 2000,
+ },
});
```

**Impact:**
- `networksListingHandlers.ts` - Handle WTB vs For Sale creation differently
- `schemas.ts` - Add discriminated union for listing creation
- `ISOMatchingService.ts` - Match WTB listings to For Sale
- Search queries - Filter by type

---

### 4. Notification Schema Updates

**File:** `src/models/Notification.ts`

```diff
export const NOTIFICATION_TYPE_VALUES = [
  // Existing types...
  'offer_received',
  'offer_accepted',
  'offer_rejected',
  'counter_offer',
  'order_created',
  'order_paid',
  'order_shipped',
  'order_completed',
  'reference_check_request',
  'reference_check_response',
  'iso_match',
  'new_follower',
  
+ // Review notifications
+ 'review_received',
+ 'review_reminder',
  
+ // Friendship notifications
+ 'friend_request_received',
+ 'friend_request_accepted',
+ 'friend_request_declined',
  
+ // Support ticket notifications
+ 'ticket_created',
+ 'ticket_updated',
+ 'ticket_response',
+ 'ticket_resolved',
  
+ // WTB matching
+ 'wtb_match_found',
] as const;
```

---

## Logic Impact Analysis

### Files to Create (13)

| Layer | File | Purpose |
|-------|------|---------|
| **Models** | `src/models/Review.ts` | Review schema |
| **Models** | `src/models/Friendship.ts` | Friendship schema |
| **Models** | `src/models/SupportTicket.ts` | Support ticket schema |
| **Services** | `src/services/review/ReviewService.ts` | Review business logic |
| **Services** | `src/services/friendship/FriendshipService.ts` | Friendship logic |
| **Services** | `src/services/support/SupportTicketService.ts` | Ticket lifecycle |
| **Repositories** | `src/repositories/ReviewRepository.ts` | Review data access |
| **Repositories** | `src/repositories/FriendshipRepository.ts` | Friendship data access |
| **Repositories** | `src/repositories/SupportTicketRepository.ts` | Ticket data access |
| **Routes** | `src/routes/reviewRoutes.ts` | Review endpoints |
| **Routes** | `src/routes/friendshipRoutes.ts` | Friendship endpoints |
| **Routes** | `src/routes/supportTicketRoutes.ts` | Ticket endpoints |
| **Routes** | `src/routes/user/profile.ts` | Profile update endpoints |

### Files to Modify (~28)

| Layer | File | Changes |
|-------|------|---------|
| **Models** | `User.ts` | Add bio, wishlist, stats |
| **Models** | `Watch.ts` | Add category |
| **Models** | `NetworkListing.ts` | Add type, ranges |
| **Models** | `Notification.ts` | Add new types |
| **Models** | `index.ts` | Export new models |
| **Services** | `UserService.ts` | Add stats methods |
| **Services** | `NotificationService.ts` | Handle new types |
| **Services** | `FeedService.ts` | Add friendship activities |
| **Services** | `ISOMatchingService.ts` | Match WTB listings |
| **Services** | `index.ts` | Export new services |
| **Repositories** | `UserRepository.ts` | Add wishlist methods |
| **Repositories** | `index.ts` | Export new repos |
| **Handlers** | `userHandlers.ts` | Profile update handler |
| **Handlers** | `orderHandlers.ts` | Trigger review prompt |
| **Handlers** | `watchesHandlers.ts` | Category filter |
| **Handlers** | `networksListingHandlers.ts` | WTB handling |
| **Routes** | `index.ts` | Mount new routes |
| **Routes** | `followRoutes.ts` | Clarify vs friendship |
| **Routes** | `networksListings.ts` | WTB routes |
| **Validation** | `schemas.ts` | All new validations |

---

## Implementation Roadmap

### Phase 1: User Schema (Week 1)
**Priority: 🔴 HIGH | Effort: 🟢 LOW**

- [ ] Add `bio`, `social_links` to User schema
- [ ] Add `wishlist` array to User schema
- [ ] Add `stats` object to User schema
- [ ] Create profile update endpoint
- [ ] Add validation schema

**Files:** 5 modified

---

### Phase 2: Watch Category (Week 1)
**Priority: 🟡 MEDIUM | Effort: 🟢 LOW**

- [ ] Add `category` enum to Watch schema
- [ ] Update search/filter validation
- [ ] Update handlers to filter by category

**Files:** 3 modified

---

### Phase 3: Review Model (Week 2)
**Priority: 🔴 HIGH | Effort: 🟡 MEDIUM**

- [ ] Create Review model
- [ ] Create ReviewService
- [ ] Create ReviewRepository
- [ ] Create review routes
- [ ] Add notification types
- [ ] Trigger review prompt on order completion
- [ ] Update User.stats calculation

**Files:** 4 new + 6 modified

---

### Phase 4: Friendship Model (Week 2-3)
**Priority: 🟡 MEDIUM | Effort: 🟡 MEDIUM**

- [ ] Create Friendship model
- [ ] Create FriendshipService
- [ ] Create friendship routes
- [ ] Add notification types
- [ ] Add mutual friends logic
- [ ] Update feed activities

**Files:** 4 new + 5 modified

---

### Phase 5: WTB Listings (Week 3-4)
**Priority: 🟡 MEDIUM | Effort: 🔴 HIGH**

- [ ] Add type, ranges to NetworkListing
- [ ] Update creation flow
- [ ] Update search queries
- [ ] Add WTB matching service
- [ ] Update validation schemas

**Files:** 0 new + 6 modified (complex changes)

---

### Phase 6: Support Tickets (Week 4)
**Priority: 🟢 LOW | Effort: 🟢 LOW**

- [ ] Create SupportTicket model
- [ ] Create SupportTicketService
- [ ] Create ticket routes
- [ ] Add notification types

**Files:** 4 new + 3 modified

---

## Appendix: Figma Screens Analysis

### Screens Reviewed

1. **Profile - Activity Tab** - Bio, stats, orders, offers, wishlist
2. **Profile - For Sale Tab** - User's active listings
3. **Profile - WTB Tab** - User's WTB posts
4. **Profile - References Tab** - Reviews as buyer/seller
5. **Search - Main** - Tabs, recent searches, popular brands
6. **Search - Results (For Sale)** - Grid/list view, filters
7. **Search - Results (WTB)** - ISO cards with ranges
8. **Search - Members** - User search results
9. **Filters - Modal** - Brand, Condition, Category
10. **Sort - Dropdown** - Relevance, Price, Newest, Popular
11. **Notifications - All** - Full activity feed
12. **Notifications - Buying** - Buyer-related notifications
13. **Notifications - Selling** - Seller-related notifications
14. **Friend Requests** - Pending with mutual friends
15. **Settings** - Account, verification, subscriptions

---

## Next Steps

1. **Review this document** with team
2. **Prioritize** based on current sprint goals
3. **Create tickets** for each phase
4. **Begin Phase 1** (User Schema) immediately
5. **Set up integration tests** for new endpoints

---

*Document prepared for internal review. Please provide feedback on priorities and timeline.*
