# DIALIST API - Complete Project Documentation & Roadmap

> **Last Updated:** November 12, 2025  
> **Version:** 1.0  
> **Status:** Phase 1 Complete | Phase 2 In Progress

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Business Model & Revenue Streams](#business-model--revenue-streams)
3. [Platform Architecture Overview](#platform-architecture-overview)
4. [Current Implementation Status](#current-implementation-status)
5. [Complete Technical Stack](#complete-technical-stack)
6. [Database Architecture](#database-architecture)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [User Journeys & Flows](#user-journeys--flows)
9. [Phase 2: Implementation Roadmap](#phase-2-implementation-roadmap)
10. [Phase 3+: Future Features](#phase-3-future-features)
11. [Integration Dependencies](#integration-dependencies)
12. [Security & Compliance](#security--compliance)
13. [Development Guidelines](#development-guidelines)

---

## Executive Summary

### What is Dialist?

DIALIST MARKETPLACE, Inc. is a **dual-platform marketplace solution** for the luxury watch industry, addressing the gap between traditional retail and existing off-platform trading networks.

### Core Problem Being Solved

The luxury watch industry operates through:

- **Retail channels** - Traditional buyers seeking trust and facilitation
- **Dealer networks** - Professionals trading via WhatsApp groups, Facebook, and informal channels

**Current pain points:**

- **Content moderation burden** - Manual vetting of posts and KYC
- **Fraud risks** - Informal trust systems (Facebook reference checks)
- **Listing management chaos** - No centralized inventory, manual updates across platforms
- **Communication fragmentation** - Platform-dependent messaging, no structured offer flow
- **Discovery limitations** - Poor search, no standardized criteria
- **No transactional tracking** - No audit trail, insights, or performance metrics

---

## Business Model & Revenue Streams

### Revenue Channels

| Channel                     | Platform    | Model                                | Status  |
| --------------------------- | ----------- | ------------------------------------ | ------- |
| **Merchant Subscriptions**  | Marketplace | Tiered plans based on listing volume | Phase 2 |
| **Transaction Fees**        | Marketplace | % fee on completed sales             | Phase 2 |
| **Dealer Subscriptions**    | Networks    | Tiered plans based on listing volume | Phase 3 |
| **Acquisition Service**     | Marketplace | Platform purchases watches directly  | Future  |
| **Authentication Services** | Both        | DIALIST watchmakers (Toronto office) | Future  |

### Marketplace vs. Networks

#### **Marketplace Platform** (Web-based, Public)

**Target Audience:**

- Retail buyers seeking trust and facilitation
- Established watch businesses wanting broader reach
- Merchants seeking professional marketplace presence

**Key Characteristics:**

- **Public accessibility** - Anyone can browse listings
- **Vetted merchants only** - Rigorous application + Finix underwriting
- **Payment facilitation** - Platform handles all transactions via Finix
- **Subscription-based** - Monthly/annual merchant fees
- **Transaction fees** - % of each sale
- **High trust requirement** - Full KYC, business verification

**Comparable Sites:**

- wristaficionado.com
- chrono24.ca (without private sellers)
- bobswatches.com

#### **Networks Platform** (Mobile-first, Private)

**Target Audience:**

- Existing watch dealers operating in WhatsApp/Facebook groups
- Industry professionals with established reputations
- Collectors active in off-platform trading communities

**Key Characteristics:**

- **Private access** - Application + admin approval required
- **NO payment facilitation** - Platform does not handle transactions (classified model)
- **Subscription-based** - Access fee for approved dealers
- **Peer-to-peer commerce** - Direct negotiation, local/in-person deals preferred
- **Community-driven** - Trust based on network relationships
- **Structured communication** - Offers, inquiries, and orders have formal channels

**Similar To:**

- Kijiji/Craigslist (classified approach)
- Facebook Marketplace (community-based)
- WhatsApp dealer groups (but structured and searchable)

**Why Users Will Switch:**

- **Structured listings** - No more manual inventory tracking across groups
- **Discovery tools** - Search by brand, model, condition, price
- **ISO/WTB tracking** - Want-to-buy posts are searchable and persistent
- **Offer management** - Formal offer/counter-offer flow with history
- **Reference check system** - Verifiable trust scores (Phase 3)
- **Content moderation** - Automated, no brand name censorship
- **Performance insights** - Track listing views, offer activity

---

## Platform Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     DIALIST API (Express)                       │
│  Port: 5050 │ TypeScript │ MongoDB │ Redis │ Bull Queue         │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────▼─────┐      ┌──────▼──────┐    ┌──────▼──────┐
    │   Clerk   │      │    Finix    │    │  GetStream  │
    │   Auth    │      │  Payments   │    │    Chat     │
    └───────────┘      └─────────────┘    └─────────────┘
          │                   │                   │
          │                   │                   │
    ┌─────▼──────────────────▼───────────────────▼─────┐
    │              MongoDB Atlas Database                │
    │  Collections: users, listings, channels, orders   │
    └───────────────────────────────────────────────────┘
```

### Request Flow

```
1. User Auth Flow (Clerk)
   Client → Clerk SDK → Clerk API → JWT Token
   Client → API (JWT) → Clerk Middleware → req.user populated

2. Marketplace Merchant Onboarding Flow
   Merchant → POST /merchant/onboard → Finix API → Hosted Form URL
   Merchant → Completes Form → Finix Webhook → Queue → Worker → DB Update

3. Networks Offer Flow
   Buyer → POST /listings/:id/offers → Create Channel → GetStream Channel
   Seller → GET /offers → View Offers → POST /offers/:id/accept → Update Order

4. Payment Flow (Marketplace Only)
   Buyer → POST /orders → Order Created (pending)
   Buyer → POST /orders/:id/checkout → Finix Authorization → Checkout URL
   Buyer → Completes Payment → Finix Webhook → Queue → Worker → Order (paid)
   Seller → Ships → POST /orders/:id/ship → Order (shipped)
```

---

## Current Implementation Status

### ✅ **Phase 1 - COMPLETED** (Current)

#### 1. **Authentication & User Management**

- ✅ Clerk JWT authentication middleware
- ✅ User creation via Clerk webhooks
- ✅ Session claims synchronization with DB
- ✅ Test user mocking for development

#### 2. **User Onboarding Flow**

- ✅ 4-step onboarding process:
  - Location selection (US/CA + postal code + region)
  - Display name (default or custom)
  - Avatar (default or custom URL)
  - Legal acknowledgements (ToS, Privacy, Rules)
- ✅ Onboarding progress tracking
- ✅ Auto-completion and claim updates

#### 3. **Merchant Onboarding (Finix Integration)**

- ✅ `POST /marketplace/merchant/onboard` - Create Finix hosted onboarding form
- ✅ `GET /marketplace/merchant/status` - Check merchant approval status
- ✅ Finix webhook receiver (`POST /webhooks/finix`)
- ✅ Async webhook processing (Redis + Bull queue)
- ✅ Merchant status tracking:
  - PROVISIONING → APPROVED/REJECTED
  - Auto-complete onboarding on merchant approval

#### 4. **Listings System (Partial)**

- ✅ NetworkListing model (with offers support)
- ✅ MarketplaceListing model
- ✅ CRUD endpoints for listings (create, update, publish)
- ✅ Listing search and filtering (brand, condition, price range)
- ✅ Draft → Active publishing flow

#### 5. **Networks Offer System (Partial)**

- ✅ `NetworkListingChannel` model (buyer/seller communication)
- ✅ Inquiry support
- ✅ Offer lifecycle: send → counter → accept/reject
- ✅ Offer history tracking
- ✅ Offer expiration (24hr default)
- ✅ Channel status management (open/closed)

#### 6. **Infrastructure**

- ✅ MongoDB connection with Mongoose ODM
- ✅ Redis connection for queue management
- ✅ Bull queue for async job processing
- ✅ Swagger/OpenAPI documentation (`/api-docs`)
- ✅ Zod validation schemas for all endpoints
- ✅ Centralized error handling
- ✅ Request ID tracking
- ✅ Jest test framework setup

#### 7. **Models & Database Schema**

- ✅ User model (with merchant, onboarding, location fields)
- ✅ NetworkListing & MarketplaceListing models
- ✅ NetworkListingChannel model (inquiries, offers, orders)
- ✅ Watch model (catalog data)
- ✅ WebhookEvent models (Clerk & Finix)
- ✅ Order model (standalone, with Finix integration fields)

---

### 🔄 **Phase 2 - IN PROGRESS**

#### **Current Priority: Stabilize Listing & Offer Functionality**

**Recommendation:** Finalize listing flows before full GetStream/payment integration to avoid rework.

#### **What's Partially Done:**

- ⚠️ Listing CRUD (needs validation improvements)
- ⚠️ Offer send/counter/accept (needs Order creation on accept)
- ⚠️ Channel management (needs GetStream integration)
- ⚠️ Order model (created but not wired to payment flow)

#### **What Needs to be Completed:**

**Priority 1: Listing Functionality (1-2 days)**

- [ ] Finalize listing validation (required fields for publish)
- [ ] Add listing tests (create, update, publish, search)
- [ ] Fix listing snapshot in offers/orders
- [ ] Add listing status transitions (draft → active → reserved → sold)

**Priority 2: Order Creation from Offers (1 day)**

- [ ] Wire `networks_offer_accept` to create Order document
- [ ] Link Order to NetworkListingChannel via `order_id`
- [ ] Update listing status to "reserved" on order creation
- [ ] Add order creation tests

**Priority 3: ChatroomService (Minimal) (1 day)**

- [ ] Install GetStream SDK
- [ ] Create `ChatroomService` stub:
  - `createForListing(listingId, buyerId, sellerId, metadata)`
  - `getChannel(channelId)`
  - `sendSystemMessage(channelId, message)`
- [ ] Wire chatroom creation to offer/inquiry creation
- [ ] Persist `getstream_channel_id` in `NetworkListingChannel`
- [ ] Unit tests (mocked GetStream client)

**Priority 4: Payment Integration (Marketplace) (2-3 days)**

- [ ] `OrderService.createOrder` - Create order from listing/offer
- [ ] `PaymentService.createAuthorization` - Finix payment authorization
- [ ] `PaymentService.captureAuthorization` - Capture payment
- [ ] Add order endpoints:
  - `POST /api/v1/orders` - Create order
  - `POST /api/v1/orders/:id/checkout` - Get Finix checkout URL
  - `GET /api/v1/orders/:id` - Get order status
  - `POST /api/v1/orders/:id/ship` - Mark shipped (seller)
- [ ] Extend webhook processor for payment events:
  - `authorization.succeeded` → Order status = authorized
  - `transaction.succeeded` → Order status = paid
  - `transfer.succeeded` → Record payout
- [ ] Integration tests (offer→order→checkout→webhook→paid flow)

**Priority 5: Full GetStream Integration (1-2 days)**

- [ ] Replace stub ChatroomService with real implementation
- [ ] Create channels on first offer/inquiry (idempotent)
- [ ] Add members (buyer + seller)
- [ ] Send system messages on order events (payment, shipping)
- [ ] Add GetStream user tokens to auth response

**Priority 6: Documentation & Handoff (1 day)**

- [ ] Update Swagger with all new endpoints
- [ ] Update schema.md for frontend
- [ ] Create testing guide for Phase 2 features
- [ ] Frontend API integration examples
      Documentation & Handoff (1 day)\*\*
- [ ] Update Swagger with all new endpoints
- [ ] Update schema.md for frontend
- [ ] Create testing guide for Phase 2 features
- [ ] Frontend API integration examples

**Timeline:** 7-10 work days (depending on priorities and testing depth)

---

### ❌ **Phase 3 - NOT STARTED** (Future)

#### **Networks Application Process**

- [ ] Application submission form
- [ ] Admin review dashboard
- [ ] Approval/rejection flow
- [ ] Dealer verification KYC
- [ ] Read-only vs. full-access permissions

#### **Networks Reference Check System**

- [ ] Reference check creation (tied to orders)
- [ ] Public reference requests
- [ ] Vouching system (trusted users vouch for others)
- [ ] Reference score calculation
- [ ] Reference check visibility in profiles

#### **Public User Profiles**

- [ ] Marketplace merchant profiles (public)
- [ ] Networks dealer profiles (network-only)
- [ ] Profile configuration (show name, location granularity)
- [ ] Listing history
- [ ] Transaction history (if allowed)
- [ ] Reference check history

#### **Subscription Management**

- [ ] Subscription plans (tiers by listing count)
- [ ] Subscription payment integration
- [ ] Trial periods
- [ ] Subscription status in user claims
- [ ] Listing quotas enforcement

#### **Follow/Social System (GetStream Activity Feeds)**

- [ ] Follow/unfollow users
- [ ] Activity feed (new listings, reference checks, ISO posts)
- [ ] Notifications feed
- [ ] Social graph

#### **ISO/WTB Listings (Want-to-Buy)**

- [ ] ISO listing creation
- [ ] ISO search and filtering
- [ ] Match alerts (when listing matches ISO)
- [ ] ISO offer flow

#### **Notifications System**

- [ ] In-app notifications (new offers, messages, order updates)
- [ ] Email notifications (optional)
- [ ] Push notifications (mobile)
- [ ] Notification preferences
- [ ] Firebase integration

#### **Image Upload System**

- [ ] Image upload API
- [ ] Image resizing/optimization
- [ ] CDN integration (Cloudflare Images / Cloudinary / S3)
- [ ] Image moderation
- [ ] Listing image management

---

## Complete Technical Stack

### Core Technologies

| Component          | Technology    | Version | Purpose                          |
| ------------------ | ------------- | ------- | -------------------------------- |
| **Runtime**        | Node.js       | 22.x    | JavaScript runtime               |
| **Framework**      | Express       | 4.18+   | Web framework                    |
| **Language**       | TypeScript    | 5.x     | Type safety                      |
| **Database**       | MongoDB Atlas | 8.x     | Document database                |
| **ODM**            | Mongoose      | 8.19+   | MongoDB object modeling          |
| **Cache/Queue**    | Redis         | Latest  | Session cache & job queue        |
| **Queue System**   | Bull          | 4.16+   | Background job processing        |
| **Authentication** | Clerk         | Latest  | User auth & management           |
| **Payments**       | Finix         | 3.0+    | Payment processing (Marketplace) |
| **Chat**           | GetStream     | Latest  | Messaging & activity feeds       |
| **Validation**     | Zod           | Latest  | Runtime type validation          |
| **Testing**        | Jest          | Latest  | Unit & integration tests         |
| **Documentation**  | Swagger UI    | Latest  | API documentation                |

### Development Tools

- **ts-node-dev** - Development server with hot reload
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Swagger JSDoc** - OpenAPI spec generation

### Deployment Infrastructure

- **Environment:** AWS / Heroku / Digital Ocean (TBD)
- **CI/CD:** GitHub Actions (TBD)
- **Monitoring:** (TBD - Datadog / New Relic / Sentry)
- **Logging:** Winston / Pino (TBD)

---

## Database Architecture

### Collections Overview

```
dialist-db/
├── users                    # User accounts & profiles
├── watches                  # Watch catalog (shared)
├── network_listings         # Networks platform listings
├── marketplace_listings     # Marketplace platform listings
├── network_listing_channels # Offers, inquiries, orders (Networks)
├── orders                   # Canonical order documents (both platforms)
├── finix_webhook_events     # Finix webhook event log
└── webhook_events           # Clerk webhook event log
```

### User Model Schema

```typescript
interface IUser {
  // Identity
  _id: ObjectId;
  external_id: string; // Clerk user ID

  // Basic Profile
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  avatar?: string; // URL
  display_name: string | null;
  display_name_history: Array<{ value: string; changed_at: Date }>;
  location?: {
    country: "US" | "CA";
    region: string;
    city?: string;
    postal_code: string;
  };

  // Legal
  legal_acks?: {
    tos_ack: boolean;
    privacy_ack: boolean;
    rules_ack: boolean;
  };

  // Platform Access
  marketplace_last_accessed: Date | null;
  networks_last_accessed: Date | null;
  marketplace_published: boolean;
  networks_published: boolean;

  // Marketplace Merchant (Finix)
  merchant?: {
    merchant_status:
      | "PROVISIONING"
      | "UPDATE_REQUESTED"
      | "REJECTED"
      | "APPROVED";
    merchant_verification: "PENDING" | "SUCCEEDED" | "FAILED";
    merchant_external_id: string; // Finix merchant ID
    finix_form_id?: string;
    merchant_verified_at?: Date;
  };

  // Networks Application
  networks_application_id: ObjectId | null; // Application doc ID (Phase 3)

  // Profile Configuration
  marketplace_profile_config: {
    location: "country" | "country_region" | "city" | "full";
    show_name: boolean;
  };
  networks_profile_config: {
    location: "country" | "country_region" | "city";
    show_name: boolean;
  };

  // Onboarding
  onboarding: {
    status: "incomplete" | "completed";
    version: string;
    steps: {
      location: { country; postal_code; region; updated_at };
      display_name: { confirmed; value; user_provided; updated_at };
      avatar: { confirmed; url; user_provided; updated_at };
      acknowledgements: { tos; privacy; rules; updated_at };
    };
    last_step?: string;
    completed_at?: Date;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  isMerchant: boolean; // computed from merchant.merchant_status
  marketplace_display_location: string;
  networks_display_location: string;
}
```

### Listing Models

**Base Listing Fields (Shared):**

```typescript
interface IBaseListing {
  // Ownership
  dialist_id: ObjectId; // User ID
  clerk_id: string; // Clerk external ID
  watch_id: ObjectId; // Reference to Watch catalog

  // Status
  status: "draft" | "active" | "reserved" | "sold";

  // Watch Details (embedded from Watch)
  brand: string;
  model: string;
  reference: string;
  diameter: string;
  bezel: string;
  materials: string;
  bracelet: string;
  color?: string;
  year?: number;

  // Author Info (snapshot)
  author: {
    _id: ObjectId;
    name: string;
    avatar?: string;
    location?: string;
  };

  // Pricing
  price: number; // In cents
  currency: string; // USD/CAD

  // Condition & Contents
  condition: "new" | "like-new" | "good" | "fair" | "poor";
  contents: "box_papers" | "box" | "papers" | "watch";

  // Media
  images: string[]; // Image URLs
  thumbnail?: string;

  // Description
  title?: string;
  subtitle?: string;
  description?: string;

  // Shipping
  ships_from: { country; state?; city? };
  shipping?: Array<{ region; shippingIncluded; shippingCost }>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

**NetworkListing Extensions:**

```typescript
interface INetworkListing extends IBaseListing {
  allow_offers: boolean; // Accept offers?

  // Order tracking (when offer accepted)
  order?: {
    channel_id: ObjectId; // NetworkListingChannel ID
    buyer_id: ObjectId;
    buyer_name: string;
    reserved_at: Date;
  };
}
```

**MarketplaceListing Extensions:**

```typescript
interface IMarketplaceListing extends IBaseListing {
  // Marketplace-specific fields
  // (TBD based on business requirements)
}
```

### NetworkListingChannel Schema

```typescript
interface INetworkListingChannel {
  // References
  listing_id: ObjectId;
  buyer_id: ObjectId;
  seller_id: ObjectId;

  // Channel Status
  status: "open" | "closed";
  created_from: "inquiry" | "offer" | "order";
  last_event_type?: "inquiry" | "offer" | "order";

  // Snapshots (immutable at creation)
  buyer_snapshot: { _id; name; avatar? };
  seller_snapshot: { _id; name; avatar? };
  listing_snapshot: {
    brand;
    model;
    reference;
    price?;
    condition?;
    contents?;
    thumbnail?;
    year?;
  };

  // Inquiry (optional, one-time)
  inquiry?: {
    sender_id: ObjectId;
    message: string;
    createdAt: Date;
  };

  // Offers (history + current)
  offer_history: Array<{
    _id: ObjectId;
    sender_id: ObjectId;
    amount: number;
    message?: string;
    offer_type: "initial" | "counter";
    status: "sent" | "accepted" | "declined" | "superseded";
    expiresAt?: Date;
    createdAt: Date;
  }>;
  last_offer?: {
    /* same structure */
  };

  // GetStream Integration
  getstream_channel_id?: string; // GetStream channel ID
  getstream_channel_type: string; // "messaging"

  // Order Reference (Phase 2)
  order_id?: ObjectId; // Links to Order collection
  order?: {
    // Embedded order (deprecated, use order_id)
    from_offer_id: ObjectId;
    amount: number;
    buyer_id: ObjectId;
    seller_id: ObjectId;
    status: "pending" | "paid" | "shipped" | "completed" | "cancelled";
    createdAt: Date;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Methods
  isOfferExpired(): boolean;
  hasActiveOffer(): boolean;
  getUserRole(userId): "buyer" | "seller" | null;
  supersedeLastOffer(): void;
  resolveLastOffer(status): Promise<void>;
}
```

### Order Model Schema (Phase 2)

```typescript
interface IOrder {
  _id: ObjectId;

  // References
  listing_id: ObjectId;
  buyer_id: ObjectId;
  seller_id: ObjectId;
  channel_id?: ObjectId; // NetworkListingChannel reference

  // Listing Snapshot
  listing_snapshot: {
    brand?: string;
    model?: string;
    reference?: string;
    condition?: string;
    price: number;
    images?: string[];
    thumbnail?: string;
  };

  // Pricing
  amount: number; // Final agreed price (cents)
  currency: string; // USD/CAD

  // Status
  status:
    | "pending"
    | "authorized"
    | "paid"
    | "shipped"
    | "completed"
    | "cancelled"
    | "refunded";

  // Finix Integration (Marketplace)
  finix_authorization_id?: string;
  finix_transaction_id?: string;
  finix_transfer_id?: string;

  // GetStream Integration
  getstream_channel_id?: string;

  // Status Timestamps
  authorized_at?: Date;
  paid_at?: Date;
  shipped_at?: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  refunded_at?: Date;

  // Metadata
  metadata?: Record<string, any>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

### Indexes

**users:**

```javascript
{ external_id: 1 }  // Unique
{ "merchant.merchant_external_id": 1 }
{ "onboarding.status": 1 }
```

**network_listings:**

```javascript
{ dialist_id: 1, status: 1 }
{ status: 1, brand: 1 }
{ status: 1, price: 1 }
{ status: 1, condition: 1 }
{ status: 1, allow_offers: 1 }
```

**network_listing_channels:**

```javascript
{ listing_id: 1, buyer_id: 1 }  // Unique
{ buyer_id: 1, updatedAt: -1 }
{ seller_id: 1, updatedAt: -1 }
{ "last_offer.status": 1 }
{ getstream_channel_id: 1 }
```

**orders:**

```javascript
{ buyer_id: 1, status: 1 }
{ seller_id: 1, status: 1 }
{ listing_id: 1 }
{ finix_authorization_id: 1 }  // Sparse
{ finix_transaction_id: 1 }    // Sparse
{ channel_id: 1 }
```

---

## API Endpoints Reference

### Authentication

All endpoints require Clerk JWT in `Authorization: Bearer <token>` header, except:

- `GET /watches` (public)
- Webhook endpoints (use Basic Auth or signature verification)

### Onboarding Endpoints

| Method | Endpoint                                    | Description              | Status  |
| ------ | ------------------------------------------- | ------------------------ | ------- |
| GET    | `/api/v1/onboarding/status`                 | Get onboarding progress  | ✅ Done |
| PATCH  | `/api/v1/onboarding/steps/location`         | Update location step     | ✅ Done |
| PATCH  | `/api/v1/onboarding/steps/display_name`     | Update display name step | ✅ Done |
| PATCH  | `/api/v1/onboarding/steps/avatar`           | Update avatar step       | ✅ Done |
| PATCH  | `/api/v1/onboarding/steps/acknowledgements` | Update legal acks step   | ✅ Done |

### Marketplace - Merchant Endpoints

| Method | Endpoint                               | Description                  | Status  |
| ------ | -------------------------------------- | ---------------------------- | ------- |
| POST   | `/api/v1/marketplace/merchant/onboard` | Create Finix onboarding form | ✅ Done |
| GET    | `/api/v1/marketplace/merchant/status`  | Get merchant status          | ✅ Done |

### Marketplace - User Endpoints

| Method | Endpoint                            | Description                     | Status  |
| ------ | ----------------------------------- | ------------------------------- | ------- |
| GET    | `/api/v1/marketplace/user`          | Get current user profile        | ✅ Done |
| GET    | `/api/v1/marketplace/user/listings` | Get user's marketplace listings | ✅ Done |

### Marketplace - Listing Endpoints

| Method | Endpoint                                   | Description                      | Status  |
| ------ | ------------------------------------------ | -------------------------------- | ------- |
| GET    | `/api/v1/marketplace/listings`             | Search & filter listings         | ✅ Done |
| POST   | `/api/v1/marketplace/listings`             | Create draft listing             | ✅ Done |
| PATCH  | `/api/v1/marketplace/listings/:id`         | Update draft listing             | ✅ Done |
| POST   | `/api/v1/marketplace/listings/:id/publish` | Publish listing (draft → active) | ✅ Done |

### Marketplace - Public Profile Endpoints

| Method | Endpoint                        | Description                 | Status  |
| ------ | ------------------------------- | --------------------------- | ------- |
| GET    | `/api/v1/marketplace/users/:id` | Get public merchant profile | ✅ Done |

### Networks - User Endpoints

| Method | Endpoint                         | Description                 | Status  |
| ------ | -------------------------------- | --------------------------- | ------- |
| GET    | `/api/v1/networks/user`          | Get current user profile    | ✅ Done |
| GET    | `/api/v1/networks/user/listings` | Get user's network listings | ✅ Done |
| GET    | `/api/v1/networks/user/offers`   | Get user's offer channels   | ✅ Done |

### Networks - Listing Endpoints

| Method | Endpoint                                | Description                  | Status  |
| ------ | --------------------------------------- | ---------------------------- | ------- |
| GET    | `/api/v1/networks/listings`             | Search & filter listings     | ✅ Done |
| POST   | `/api/v1/networks/listings`             | Create draft listing         | ✅ Done |
| PATCH  | `/api/v1/networks/listings/:id`         | Update draft listing         | ✅ Done |
| POST   | `/api/v1/networks/listings/:id/publish` | Publish listing              | ✅ Done |
| POST   | `/api/v1/networks/listings/:id/offers`  | Send offer on listing        | ✅ Done |
| GET    | `/api/v1/networks/listings/:id/offers`  | Get all offers (seller only) | ✅ Done |

### Networks - Offer/Channel Endpoints

| Method | Endpoint                              | Description                  | Status     |
| ------ | ------------------------------------- | ---------------------------- | ---------- |
| GET    | `/api/v1/networks/offers`             | Get user's offer channels    | ✅ Done    |
| GET    | `/api/v1/networks/offers/:id`         | Get channel details          | ✅ Done    |
| POST   | `/api/v1/networks/offers/:id/accept`  | Accept offer (creates order) | ⚠️ Partial |
| POST   | `/api/v1/networks/offers/:id/reject`  | Reject offer                 | ✅ Done    |
| POST   | `/api/v1/networks/offers/:id/counter` | Send counter-offer           | ✅ Done    |

### Networks - Public Profile Endpoints

| Method | Endpoint                     | Description               | Status  |
| ------ | ---------------------------- | ------------------------- | ------- |
| GET    | `/api/v1/networks/users/:id` | Get public dealer profile | ✅ Done |

### Order Endpoints (Phase 2 - TO BE IMPLEMENTED)

| Method | Endpoint                      | Description                                 | Status  |
| ------ | ----------------------------- | ------------------------------------------- | ------- |
| POST   | `/api/v1/orders`              | Create order from listing/offer             | ❌ TODO |
| GET    | `/api/v1/orders/:id`          | Get order details                           | ❌ TODO |
| POST   | `/api/v1/orders/:id/checkout` | Create Finix checkout session (Marketplace) | ❌ TODO |
| POST   | `/api/v1/orders/:id/capture`  | Capture payment (internal/admin)            | ❌ TODO |
| POST   | `/api/v1/orders/:id/ship`     | Mark order as shipped (seller)              | ❌ TODO |
| POST   | `/api/v1/orders/:id/complete` | Mark order as completed (buyer)             | ❌ TODO |

### Webhook Endpoints

| Method | Endpoint                 | Description                   | Status     |
| ------ | ------------------------ | ----------------------------- | ---------- |
| POST   | `/api/v1/webhooks/clerk` | Clerk user lifecycle events   | ✅ Done    |
| POST   | `/api/v1/webhooks/finix` | Finix payment/merchant events | ⚠️ Partial |

### Shared Public Endpoints

| Method | Endpoint          | Description                    | Status  |
| ------ | ----------------- | ------------------------------ | ------- |
| GET    | `/api/v1/watches` | Search watch catalog (no auth) | ✅ Done |
| GET    | `/api/v1/health`  | Health check                   | ✅ Done |

---

## User Journeys & Flows

### Journey 1: Marketplace Buyer Purchase Flow

```
1. Browse public listings (no auth required)
   GET /api/v1/marketplace/listings?brand=Rolex&condition=like-new

2. Sign up / Log in (Clerk)
   → Redirected to onboarding if incomplete

3. Complete onboarding (4 steps)
   PATCH /api/v1/onboarding/steps/location
   PATCH /api/v1/onboarding/steps/display_name
   PATCH /api/v1/onboarding/steps/avatar
   PATCH /api/v1/onboarding/steps/acknowledgements

4. Create order (Phase 2)
   POST /api/v1/orders
   { "listingId": "...", "offerId": null }
   → Response: { orderId, amount, status: "pending" }

5. Checkout (Finix hosted form)
   POST /api/v1/orders/:orderId/checkout
   { "returnUrl": "https://app.com/orders/:orderId/complete" }
   → Response: { checkoutUrl, finixAuthorizationId }
   → Redirect user to checkoutUrl

6. Complete payment (Finix)
   → Finix webhook: authorization.succeeded
   → Worker updates Order.status = "authorized"
   → Finix webhook: transaction.succeeded
   → Worker updates Order.status = "paid"

7. Seller ships watch
   POST /api/v1/orders/:orderId/ship (seller only)
   → Order.status = "shipped"

8. Buyer receives watch
   POST /api/v1/orders/:orderId/complete (buyer only)
   → Order.status = "completed"
```

### Journey 2: Marketplace Merchant Seller Flow

```
1. Sign up / Log in (Clerk)
   → Complete onboarding

2. Apply for merchant access
   POST /api/v1/marketplace/merchant/onboard
   { "business_name": "...", "max_transaction_amount": 50000 }
   → Response: { onboarding_url, form_id, expires_at }
   → Redirect to onboarding_url

3. Complete Finix KYC form (hosted by Finix)
   → Submit business details, bank account, tax info

4. Finix reviews application
   → Webhook: onboarding_form.updated (status: COMPLETED)
   → Worker updates User.merchant.merchant_status = "APPROVED"
   → Worker completes onboarding automatically

5. Check merchant status
   GET /api/v1/marketplace/merchant/status
   → { is_merchant: true, merchant_status: "APPROVED", ... }

6. Create listing (draft)
   POST /api/v1/marketplace/listings
   { "watch": "watchId", ... }
   → Response: { status: "draft", ... }

7. Publish listing
   POST /api/v1/marketplace/listings/:id/publish
   → Listing.status = "active"

8. Receive order
   → Order created by buyer
   → GetStream notification

9. Ship watch
   POST /api/v1/orders/:orderId/ship
   → Order.status = "shipped"
   → Finix processes payout (automatic)
```

### Journey 3: Networks Dealer Offer Flow

```
1. Sign up / Log in (Clerk)
   → Complete onboarding

2. Apply for Networks access (Phase 3)
   POST /api/v1/networks/application
   { "business_name": "...", "references": [...] }
   → Admin reviews and approves

3. Browse Networks listings
   GET /api/v1/networks/listings?brand=Rolex&allow_offers=true

4. Send offer on listing
   POST /api/v1/networks/listings/:id/offers
   { "amount": 850000, "message": "Interested, can meet in NYC" }
   → Creates NetworkListingChannel
   → Creates GetStream channel (Phase 2)
   → Response: { channelId, getstream_channel_id, ... }

5. Negotiate via GetStream chat
   → Real-time messaging
   → System messages for offer events

6. Seller counters offer
   POST /api/v1/networks/offers/:channelId/counter
   { "amount": 875000, "message": "Meet in the middle?" }
   → Updates channel.last_offer

7. Buyer accepts counter-offer
   POST /api/v1/networks/offers/:channelId/accept
   → Creates Order document (status: "pending")
   → Updates Listing.status = "reserved"
   → Updates channel.order_id = orderId
   → System message: "Offer accepted! Complete payment to proceed."

8. Complete transaction (off-platform)
   → Buyer and seller coordinate payment/delivery via chat
   → No platform facilitation (Networks is classified)

9. Mark order completed (optional)
   POST /api/v1/orders/:orderId/complete
   → Order.status = "completed"
   → Enables reference check (Phase 3)
```

### Journey 4: Networks ISO (In Search Of) Flow (Phase 3)

```
1. Dealer creates ISO listing
   POST /api/v1/networks/listings
   { "type": "iso", "brand": "Patek Philippe", "model": "Nautilus", "reference": "5711", "budget": 15000000 }
   → Listing.type = "iso"

2. Other dealers browse ISO listings
   GET /api/v1/networks/listings?type=iso&brand=Patek

3. Dealer with matching watch sends offer
   POST /api/v1/networks/listings/:isoId/offers
   { "amount": 14500000, "message": "I have 5711/1A in excellent condition" }

4. ISO creator receives offer notifications
   GET /api/v1/networks/user/offers?type=received

5. Accept offer and coordinate deal
   POST /api/v1/networks/offers/:channelId/accept
   → Creates Order
   → Chat enabled for coordination
```

---

## Phase 2: Implementation Roadmap

### Week 1: Listing Stabilization & Order Creation

**Goal:** Finalize listing lifecycle and wire order creation to offer acceptance.

**Tasks:**

1. **Listing Validation Improvements**

   - [ ] Add comprehensive validation for required fields before publish
   - [ ] Add `validateListingForPublish` helper function
   - [ ] Return clear error messages with missing field details
   - [ ] Test publish flow with incomplete listings

2. **Listing Status Transitions**

   - [ ] Implement status machine: draft → active → reserved → sold
   - [ ] Add `transitionListingStatus` utility
   - [ ] Prevent invalid transitions
   - [ ] Add status transition tests

3. **Order Creation on Offer Accept**

   - [ ] Update `networks_offer_accept` handler to create Order document
   - [ ] Link Order to NetworkListingChannel via `order_id` field
   - [ ] Create listing snapshot in Order
   - [ ] Update Listing.status = "reserved"
   - [ ] Add transaction safety (MongoDB session)
   - [ ] Integration test: offer accept → order created → listing reserved

4. **Listing Tests**
   - [ ] Unit tests for listing validation
   - [ ] Integration tests for listing CRUD
   - [ ] Integration tests for publish flow
   - [ ] Integration tests for offer → order flow

**Deliverables:**

- All listing endpoints fully functional and tested
- Order creation wired to offer acceptance
- Clear error messages for validation failures

---

### Week 2: Minimal ChatroomService & GetStream Setup

**Goal:** Enable chatroom creation for offers/inquiries without blocking listing work.

**Tasks:**

1. **GetStream Setup**

   - [ ] Install GetStream SDK: `npm install getstream`
   - [ ] Add environment variables (GETSTREAM_API_KEY, GETSTREAM_API_SECRET, GETSTREAM_APP_ID)
   - [ ] Create `src/config/getstream.ts` with StreamChat client
   - [ ] Test GetStream connection

2. **ChatroomService (Minimal)**

   - [ ] Create `src/services/ChatroomService.ts`
   - [ ] Implement `createForListing(params)`:
     - Check if channel already exists in DB
     - Create GetStream channel (type: "messaging")
     - Add buyer + seller as members
     - Send optional initial message
     - Persist `getstream_channel_id` in NetworkListingChannel
     - Return channel info
   - [ ] Implement `getChannel(channelId)` (simple wrapper)
   - [ ] Implement `sendSystemMessage(channelId, message)`

3. **Wire Chatroom Creation to Offers**

   - [ ] Update `networks_offer_send` to call `ChatroomService.createForListing`
   - [ ] Persist `getstream_channel_id` in NetworkListingChannel
   - [ ] Return `getstream_channel_id` in offer response
   - [ ] Send system message on offer creation

4. **Wire Chatroom Updates to Order Events**

   - [ ] Send system message on offer accept: "Offer accepted! Order created."
   - [ ] Send system message on order payment: "Payment received! Seller notified."
   - [ ] Send system message on order ship: "Order shipped! Tracking: ..."

5. **Unit Tests (Mocked)**
   - [ ] Mock GetStream SDK in tests
   - [ ] Test channel creation (idempotent)
   - [ ] Test system message sending
   - [ ] Test error handling (GetStream API failures)

**Deliverables:**

- GetStream integration working for offer/inquiry chatrooms
- Chatroom IDs persisted in database
- System messages sent on key events
- Unit tests with mocked GetStream client

---

### Week 3: Payment Integration (Marketplace Orders)

**Goal:** Implement full payment flow for Marketplace orders using Finix.

**Tasks:**

1. **OrderService**

   - [ ] Create `src/services/OrderService.ts`
   - [ ] Implement `createOrder(params)`:
     - Validate listing availability
     - Create Order document (status: "pending")
     - Snapshot listing details
     - Create/link GetStream channel
     - Update listing status to "reserved"
     - Return Order object
   - [ ] Implement `updateFromFinixWebhook(params)`:
     - Map event types to order status updates
     - Handle `authorization.succeeded` → status = "authorized"
     - Handle `transaction.succeeded` → status = "paid"
     - Handle `transfer.succeeded` → record payout
     - Send GetStream system messages
   - [ ] Implement `markShipped(orderId)` (seller action)
   - [ ] Implement `markCompleted(orderId)` (buyer action)

2. **PaymentService**

   - [ ] Create `src/services/PaymentService.ts`
   - [ ] Implement `createAuthorization(params)`:
     - Call Finix API to create authorization
     - Return checkout URL
     - Persist `finix_authorization_id` in Order
   - [ ] Implement `captureAuthorization(params)`:
     - Call Finix API to capture payment
     - Update Order.finix_transaction_id
   - [ ] Implement `refundTransaction(params)`:
     - Call Finix API to create reversal
     - Update Order.status = "refunded"

3. **Order Endpoints**

   - [ ] Create `src/handlers/orderHandlers.ts`
   - [ ] Implement `POST /api/v1/orders` (createOrder)
   - [ ] Implement `GET /api/v1/orders/:id` (getOrder)
   - [ ] Implement `POST /api/v1/orders/:id/checkout` (createCheckout)
   - [ ] Implement `POST /api/v1/orders/:id/capture` (capturePayment - admin only)
   - [ ] Implement `POST /api/v1/orders/:id/ship` (markShipped - seller only)
   - [ ] Implement `POST /api/v1/orders/:id/complete` (markCompleted - buyer only)
   - [ ] Create `src/routes/orders.ts` and wire to main app

4. **Extend Webhook Processor**

   - [ ] Update `src/workers/webhookProcessor.ts`
   - [ ] Add handler for `authorization.succeeded`
   - [ ] Add handler for `transaction.succeeded`
   - [ ] Add handler for `transfer.succeeded`
   - [ ] Call `OrderService.updateFromFinixWebhook` for each event
   - [ ] Add idempotency checks (use Finix event ID)

5. **Validation Schemas**

   - [ ] Add `createOrderSchema` to `src/validation/schemas.ts`
   - [ ] Add `getOrderSchema`
   - [ ] Add `checkoutSchema`
   - [ ] Add `capturePaymentSchema`
   - [ ] Add `shipOrderSchema`

6. **Integration Tests**
   - [ ] Create `tests/integration/order-flow.test.ts`
   - [ ] Test full flow: create order → checkout → webhook (auth) → webhook (capture) → paid
   - [ ] Test idempotency (duplicate webhook events)
   - [ ] Test order status transitions
   - [ ] Test authorization checks (only buyer can checkout, only seller can ship)

**Deliverables:**

- Complete order creation and payment flow for Marketplace
- Finix webhook integration for payment events
- Order endpoints fully functional and tested
- Integration tests covering end-to-end payment flow

---

### Week 4: Documentation & Frontend Handoff

**Goal:** Provide complete documentation for frontend integration.

**Tasks:**

1. **Update Swagger Documentation**

   - [ ] Add all order endpoints to `src/config/swagger.ts`
   - [ ] Add request/response examples for each endpoint
   - [ ] Add error response examples
   - [ ] Document GetStream channel integration
   - [ ] Document order status lifecycle

2. **Update schema.md**

   - [ ] Add Order model documentation
   - [ ] Add OrderService API reference
   - [ ] Add PaymentService API reference
   - [ ] Add GetStream integration details
   - [ ] Add order status state machine diagram

3. **Create Testing Guides**

   - [ ] Create `docs/testing-order-flow.md`
   - [ ] Document how to test order creation
   - [ ] Document how to test Finix webhooks (ngrok)
   - [ ] Document how to test GetStream chat
   - [ ] Add Postman collection export

4. **Frontend Integration Examples**
   - [ ] Create `docs/frontend-integration.md`
   - [ ] Add TypeScript interfaces for all API responses
   - [ ] Add example API calls for each user journey
   - [ ] Add GetStream client setup guide
   - [ ] Add error handling examples

**Deliverables:**

- Complete API documentation for Phase 2 features
- Frontend integration guide with examples
- Testing guide for QA and developers
- Updated schema.md with all new models

---

## Phase 3+: Future Features

### Networks Application & Vetting System

**Goal:** Implement application process for Networks access.

**Components:**

- Application form (business info, references, trading history)
- Admin review dashboard
- Approval/rejection workflow
- KYC verification (identity documents)
- Application status tracking
- Email notifications

**Database:**

- `networks_applications` collection
- Application status: "pending" | "approved" | "rejected"
- Admin notes and review history

**Endpoints:**

- `POST /api/v1/networks/application` - Submit application
- `GET /api/v1/networks/application/status` - Check status
- `GET /admin/applications` - List pending applications (admin)
- `POST /admin/applications/:id/approve` - Approve application (admin)
- `POST /admin/applications/:id/reject` - Reject application (admin)

---

### Reference Check System

**Goal:** Enable trust-building through peer vouching.

**Components:**

- Reference check creation (tied to completed orders)
- Public reference requests (asking community to vouch)
- Vouching system (trusted users vouch for others)
- Reference score calculation (weighted by voucher reputation)
- Reference check visibility in user profiles

**Database:**

- `reference_checks` collection
- `vouches` collection

**Endpoints:**

- `POST /api/v1/reference-checks` - Create reference check
- `GET /api/v1/reference-checks/:id` - View reference check
- `POST /api/v1/reference-checks/:id/vouch` - Vouch for user
- `GET /api/v1/users/:id/references` - Get user's reference history

**Business Logic:**

- Reference checks only available for completed orders
- Vouchers must be verified dealers (networks_published = true)
- Voucher weight based on:
  - Account age
  - Completed transaction count
  - Own reference check score
  - Admin verification level

---

### Subscription Management

**Goal:** Manage tiered subscription plans for both platforms.

**Components:**

- Subscription plans (tiers: Basic, Pro, Enterprise)
- Listing quotas per tier
- Payment integration (Stripe or Finix subscriptions)
- Trial periods
- Subscription renewal and cancellation
- Quota enforcement

**Database:**

- `subscription_plans` collection
- `user_subscriptions` collection

**Endpoints:**

- `GET /api/v1/subscriptions/plans` - List available plans
- `POST /api/v1/subscriptions` - Subscribe to plan
- `GET /api/v1/subscriptions/current` - Get current subscription
- `POST /api/v1/subscriptions/cancel` - Cancel subscription
- `POST /api/v1/subscriptions/upgrade` - Upgrade plan

**Business Logic:**

- Marketplace: listing quota enforcement
- Networks: listing quota enforcement
- Grace period after subscription expiration
- Automatic downgrade after grace period

---

### ISO/WTB Listings (In Search Of / Want to Buy)

**Goal:** Enable dealers to post what they're looking for.

**Components:**

- ISO listing creation (brand, model, budget, notes)
- ISO search and filtering
- Match alerts (when listing matches ISO)
- ISO offer flow (seller initiates offer on ISO)

**Database:**

- Add `type: "for-sale" | "iso"` to NetworkListing
- ISO-specific fields: `budget`, `target_condition`, `preferred_location`

**Endpoints:**

- `POST /api/v1/networks/listings` - Create ISO listing (type: "iso")
- `GET /api/v1/networks/listings?type=iso` - Browse ISO listings
- `POST /api/v1/networks/listings/:isoId/offers` - Send offer on ISO (seller initiates)

**Business Logic:**

- ISO listings don't have "reserve" or "sold" status (always active until closed)
- Multiple sellers can offer on one ISO
- ISO creator receives all offers and chooses winner

---

### Follow/Social System (GetStream Activity Feeds)

**Goal:** Social features to surface reference checks and activity.

**Components:**

- Follow/unfollow users
- Activity feed (new listings, reference checks, ISO posts)
- Notifications feed (mentions, follows, offers)
- Social graph (followers, following)

**Integration:**

- GetStream Activity Feeds API
- User activity timeline
- Notification timeline

**Endpoints:**

- `POST /api/v1/users/:id/follow` - Follow user
- `DELETE /api/v1/users/:id/follow` - Unfollow user
- `GET /api/v1/feed/activity` - Get activity feed
- `GET /api/v1/feed/notifications` - Get notifications
- `GET /api/v1/users/:id/followers` - Get followers
- `GET /api/v1/users/:id/following` - Get following

---

### Notifications System

**Goal:** Real-time and email notifications for key events.

**Components:**

- In-app notifications (new offers, messages, order updates)
- Email notifications (optional, configurable)
- Push notifications (mobile apps)
- Notification preferences (per event type)

**Integration:**

- Firebase Cloud Messaging (FCM) for mobile push
- SendGrid / Mailgun for email
- GetStream Feeds for in-app notifications

**Endpoints:**

- `GET /api/v1/notifications` - Get user notifications
- `PATCH /api/v1/notifications/:id/read` - Mark as read
- `GET /api/v1/notifications/preferences` - Get preferences
- `PATCH /api/v1/notifications/preferences` - Update preferences

**Notification Events:**

- New offer received
- Offer accepted/rejected
- Counter-offer received
- Order payment received
- Order shipped
- New message in channel
- Reference check requested
- New follower

---

### Image Upload System

**Goal:** Centralized image management for listings and avatars.

**Components:**

- Image upload API
- Image resizing and optimization
- CDN integration
- Image moderation (content filtering)
- Listing image gallery

**Integration:**

- Cloudflare Images / Cloudinary / AWS S3
- Sharp for image processing

**Endpoints:**

- `POST /api/v1/images/upload` - Upload image
- `DELETE /api/v1/images/:id` - Delete image
- `GET /api/v1/images/:id/variants` - Get image variants (thumbnail, full, etc.)

**Business Logic:**

- Max file size: 10MB
- Supported formats: JPEG, PNG, WebP
- Automatic thumbnail generation
- Image optimization (quality, dimensions)
- Image moderation (NSFW detection)

---

## Integration Dependencies

### External Services

| Service           | Purpose                                  | Status     | Credentials Needed                                                                                                   |
| ----------------- | ---------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| **Clerk**         | Authentication & user management         | ✅ Active  | CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET                                                        |
| **Finix**         | Payment processing & merchant onboarding | ✅ Active  | FINIX_USERNAME, FINIX_PASSWORD, FINIX_BASE_URL, FINIX_WEBHOOK_USERNAME, FINIX_WEBHOOK_PASSWORD, FINIX_WEBHOOK_SECRET |
| **GetStream**     | Chat & activity feeds                    | ⚠️ Pending | GETSTREAM_API_KEY, GETSTREAM_API_SECRET, GETSTREAM_APP_ID                                                            |
| **MongoDB Atlas** | Database                                 | ✅ Active  | MONGODB_URI                                                                                                          |
| **Redis**         | Queue & cache                            | ✅ Active  | REDIS_URL                                                                                                            |

### Third-Party Dependencies

**npm packages:**

```json
{
  "dependencies": {
    "@clerk/express": "^1.7.40",
    "@finix-payments/finix": "^3.0.1",
    "axios": "^1.12.2",
    "bull": "^4.16.5",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "helmet": "^7.0.0",
    "ioredis": "^5.8.2",
    "mongoose": "^8.19.1",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0",
    "zod": "^3.23.8",
    "getstream": "TBD"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "jest": "^29.7.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.3"
  }
}
```

---

## Security & Compliance

### Authentication Security

- **JWT verification:** All requests verify Clerk JWT signatures
- **Token expiration:** JWTs expire after configured duration
- **Session management:** Clerk manages session lifecycle
- **Test user bypass:** Only in development mode (FEATURE_TEST_USER_BYPASS=1)

### Payment Security (Finix)

- **PCI DSS compliance:** Finix handles all card data (platform never sees PAN)
- **Webhook verification:** HMAC-SHA256 signature verification
- **Merchant underwriting:** Finix performs KYC/AML checks
- **Fraud monitoring:** Finix monitors transactions for suspicious activity

### Data Security

- **Encryption at rest:** MongoDB Atlas encrypted storage
- **Encryption in transit:** TLS 1.2+ for all API calls
- **Password hashing:** N/A (Clerk handles authentication)
- **PII handling:** Minimize PII storage, mask in logs

### API Security

- **Rate limiting:** (TBD - implement with express-rate-limit)
- **CORS:** Configured for specific origins
- **Helmet:** Security headers enabled
- **Input validation:** Zod schemas for all inputs
- **SQL injection:** N/A (NoSQL database)
- **XSS prevention:** Input sanitization, output encoding

### Webhook Security

- **Clerk webhooks:** Signature verification via CLERK_WEBHOOK_SECRET
- **Finix webhooks:** HMAC-SHA256 signature verification + Basic Auth

### Compliance

- **GDPR:** User data deletion on request (TBD)
- **CCPA:** User data export on request (TBD)
- **Privacy Policy:** Required acknowledgement in onboarding
- **Terms of Service:** Required acknowledgement in onboarding

---

## Development Guidelines

### Code Style

- **TypeScript:** Strict mode enabled
- **ESLint:** Follow Airbnb style guide (TBD)
- **Prettier:** Automatic code formatting
- **Naming conventions:**
  - Files: kebab-case (e.g., `order-handlers.ts`)
  - Classes: PascalCase (e.g., `OrderService`)
  - Functions: camelCase (e.g., `createOrder`)
  - Constants: UPPER_SNAKE_CASE (e.g., `MAX_LISTING_COUNT`)
  - Interfaces: PascalCase with `I` prefix (e.g., `IOrder`)

### Git Workflow

- **Branches:**
  - `main` - Production-ready code
  - `develop` - Development branch
  - `feature/*` - Feature branches
  - `fix/*` - Bug fix branches
- **Commits:** Use conventional commit messages (feat, fix, docs, refactor, test, chore)
- **Pull Requests:** Required for all changes to main/develop
- **Code Review:** At least one approval required

### Testing Strategy

- **Unit tests:** Jest for individual functions/services
- **Integration tests:** Jest for API endpoint flows
- **E2E tests:** (TBD - Cypress or Playwright)
- **Test coverage:** Aim for 80%+ coverage
- **CI/CD:** Run tests on every PR (GitHub Actions)

### Environment Management

- **Development:** Local MongoDB, Redis, ngrok for webhooks
- **Staging:** (TBD)
- **Production:** (TBD)

### Error Handling

- **Custom error classes:** Use `AppError`, `ValidationError`, `DatabaseError`, etc.
- **Error middleware:** Centralized error handler in `src/middleware/errorHandler.ts`
- **Error logging:** Log errors with stack traces in production
- **Error responses:** Consistent JSON format with `error` object and `requestId`

### Logging

- **Request logging:** Log all API requests (method, path, status, duration)
- **Error logging:** Log all errors with stack traces
- **Webhook logging:** Log all webhook events (type, status, processing time)
- **Sensitive data:** Mask PII, API keys, tokens in logs

### Documentation

- **Code comments:** JSDoc for all public functions
- **README:** Project overview, setup instructions
- **API docs:** Swagger UI (`/api-docs`)
- **Architecture docs:** This document
- **Changelog:** Track all significant changes

---

## Summary & Next Steps

### Current Status (November 2025)

**Phase 1: ✅ COMPLETE**

- Authentication, user onboarding, merchant onboarding (Finix), listings CRUD, offers flow

**Phase 2: 🔄 IN PROGRESS**

- Order creation, payment integration (Finix), GetStream chat, webhook processing

**Phase 3: ❌ NOT STARTED**

- Networks application, reference checks, subscriptions, ISO listings, social features

### Immediate Priorities (Next 7-10 days)

1. **Stabilize listing functionality** - Validation, status transitions, tests
2. **Wire order creation to offer acceptance** - Create Order on accept, link to channel
3. **Implement minimal ChatroomService** - GetStream integration for offers/inquiries
4. **Implement payment flow** - OrderService, PaymentService, webhook handlers
5. **Complete documentation** - Swagger, frontend guide, testing guide

### Long-Term Roadmap (3-6 months)

1. **Complete Phase 2** - All marketplace checkout features functional
2. **Launch Networks application process** - Dealer vetting and approval
3. **Implement reference check system** - Trust-building for Networks
4. **Add subscription management** - Tiered plans and listing quotas
5. **Build ISO/WTB features** - Reverse marketplace for dealer sourcing
6. **Add social features** - Follow system, activity feeds, notifications

---

## Contact & Resources

**Documentation:**

- API Docs: http://localhost:5050/api-docs
- GitHub Repo: (TBD)
- Figma Designs: (TBD)

**Team:**

- Backend Lead: (TBD)
- Frontend Lead: (TBD)
- Product Manager: (TBD)

**Support:**

- Slack: #dialist-dev
- Email: dev@dialist.com

---

**END OF DOCUMENT**
