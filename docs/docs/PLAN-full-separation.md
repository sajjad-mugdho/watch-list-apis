# Full Platform Separation — Phased Plan

> **Strategy:** Full module isolation into `src/marketplace/`, `src/networks/`, `src/shared/`. Each platform gets its own routes, handlers, services, repositories, and models. Shared code moves to `src/shared/`. Executed in phases so **no phase breaks current logic**.

---

## Current Problems

| Area | Problem | Impact |
|---|---|---|
| `src/handlers/chatHandlers.ts` | Shared between both platforms | Chat logic bleeds across |
| `src/handlers/messageHandlers.ts` | Shared between both platforms | Messages not isolated |
| `src/handlers/conversationHandlers.ts` | Shared between both platforms | Conversations mixed |
| `src/services/channel/ChannelService.ts` | Single service for both platforms | No platform isolation |
| `src/services/message/MessageService.ts` | Single service for both platforms | No platform isolation |
| `src/services/ChatService.ts` | Single top-level shared service | Breaks separation |
| `src/models/Listings.ts` | Generic, not platform-scoped | Wrong data can be queried |
| `src/models/ListingChannel.ts` | Ambiguous — marketplace or networks? | Confusion, data leaks |
| `src/models/Offer.ts` + `Order.ts` | Generic base — platform unclear | Cross-platform data risk |
| `src/repositories/ChannelRepository.ts` | Shared, not platform-scoped | Queries may return wrong data |
| `src/repositories/MessageRepository.ts` | Shared, not platform-scoped | Messages not isolated |

---

## Target Folder Structure

```
src/
├── marketplace/                          ← Full marketplace module
│   ├── index.ts                          ← exports marketplace router
│   ├── routes/
│   │   ├── listings.ts
│   │   ├── orders.ts
│   │   ├── offers.ts
│   │   ├── channels.ts
│   │   ├── messages.ts
│   │   ├── conversations.ts
│   │   ├── chat.ts
│   │   ├── merchant.ts
│   │   ├── users.ts
│   │   └── refundRequests.ts
│   ├── handlers/
│   │   ├── MarketplaceListingHandlers.ts
│   │   ├── MarketplaceOrderHandlers.ts
│   │   ├── MarketplaceOfferHandlers.ts
│   │   ├── MarketplaceChannelHandlers.ts
│   │   ├── MarketplaceMessageHandlers.ts
│   │   ├── MarketplaceConversationHandlers.ts
│   │   ├── MarketplaceChatHandlers.ts
│   │   ├── MarketplaceMerchantHandlers.ts
│   │   └── MarketplaceRefundHandlers.ts
│   ├── services/
│   │   ├── MarketplaceChannelService.ts  ← split from ChannelService.ts
│   │   ├── MarketplaceMessageService.ts  ← split from MessageService.ts
│   │   ├── MarketplaceOfferService.ts
│   │   ├── MarketplaceOrderService.ts
│   │   └── MarketplaceListingService.ts
│   ├── repositories/
│   │   ├── MarketplaceChannelRepository.ts
│   │   ├── MarketplaceMessageRepository.ts
│   │   └── MarketplaceListingRepository.ts
│   └── models/
│       ├── MarketplaceListing.ts         ← from Listings.ts discriminator
│       ├── MarketplaceListingChannel.ts  ← already exists
│       ├── MarketplaceOffer.ts
│       └── MarketplaceOrder.ts
│
├── networks/                             ← Full networks module
│   ├── index.ts                          ← exports networks router
│   ├── routes/
│   │   ├── listings.ts
│   │   ├── offers.ts
│   │   ├── channels.ts
│   │   ├── messages.ts
│   │   ├── conversations.ts
│   │   ├── chat.ts
│   │   ├── users.ts
│   │   ├── referenceChecks.ts
│   │   ├── feeds.ts
│   │   ├── follow.ts
│   │   ├── isos.ts
│   │   └── orders.ts
│   ├── handlers/
│   │   ├── NetworksListingHandlers.ts
│   │   ├── NetworksOfferHandlers.ts
│   │   ├── NetworksChannelHandlers.ts
│   │   ├── NetworksMessageHandlers.ts
│   │   ├── NetworksConversationHandlers.ts
│   │   ├── NetworksChatHandlers.ts
│   │   └── NetworksReferenceCheckHandlers.ts
│   ├── services/
│   │   ├── NetworksChannelService.ts     ← split from ChannelService.ts
│   │   ├── NetworksMessageService.ts     ← split from MessageService.ts
│   │   ├── NetworksOfferService.ts
│   │   ├── ReferenceCheckService.ts
│   │   ├── ISOMatchingService.ts
│   │   └── FeedService.ts
│   ├── repositories/
│   │   ├── NetworksChannelRepository.ts
│   │   ├── NetworksMessageRepository.ts
│   │   ├── NetworksListingRepository.ts
│   │   ├── ISORepository.ts
│   │   └── FollowRepository.ts
│   └── models/
│       ├── NetworksListing.ts            ← from Listings.ts discriminator
│       ├── NetworksChannel.ts            ← ListingChannel.ts
│       ├── NetworkOffer.ts
│       └── NetworkOrder.ts
│
├── shared/                               ← ONLY truly shared code
│   ├── getstream/
│   │   └── GetstreamClient.ts            ← ChatService.ts (wrapper only)
│   ├── middleware/
│   │   ├── authentication.ts
│   │   ├── platformAccess.ts
│   │   ├── errorHandler.ts
│   │   ├── validation.ts
│   │   └── operational.ts
│   ├── repositories/
│   │   └── base/BaseRepository.ts
│   └── utils/                            ← from src/utils/
│
├── handlers/                             ← ONLY non-platform handlers
│   ├── authHandlers.ts
│   ├── onboardingHandlers.ts
│   ├── notificationHandlers.ts
│   ├── webhookHandlers.ts
│   ├── userHandlers.ts
│   ├── imageHandlers.ts
│   └── debugHandlers.ts
│
├── routes/                               ← ONLY non-platform routes
│   ├── index.ts                          ← mounts /marketplace + /networks
│   ├── auth.ts
│   ├── onboardingRoutes.ts
│   ├── notificationRoutes.ts
│   ├── analyticsRoutes.ts
│   ├── watchesRoutes.ts
│   ├── reviewRoutes.ts
│   ├── subscriptionRoutes.ts
│   ├── reservationTermsRoutes.ts
│   └── user/                             ← consolidated user routes
│
├── models/                               ← ONLY shared models
│   ├── User.ts
│   ├── Notification.ts
│   ├── Friendship.ts
│   ├── Follow.ts
│   ├── Favorite.ts
│   ├── Subscription.ts
│   ├── SupportTicket.ts
│   ├── Review.ts
│   ├── Watches.ts
│   ├── ChatMessage.ts
│   ├── DeviceToken.ts
│   ├── EventOutbox.ts
│   ├── ReferenceCheck.ts
│   ├── Vouch.ts
│   └── AuditLog.ts
│
└── app.ts
```

---

## What STAYS Shared (do NOT move)

| File | Reason |
|---|---|
| `src/models/User.ts` | Single user across both platforms |
| `src/models/Notification.ts` | Notifications are cross-platform |
| `src/models/Friendship.ts` | Friendships are cross-platform |
| `src/models/Follow.ts` | Follows are cross-platform |
| `src/models/Favorite.ts` | Single model with `platform` field |
| `src/models/Subscription.ts` | Single subscription per user |
| `src/models/SupportTicket.ts` | Support is cross-platform |
| `src/models/Review.ts` | Reviews are cross-platform |
| `src/models/Watches.ts` | Watch database is cross-platform |
| `src/models/ChatMessage.ts` | Message storage is shared |
| `src/services/ChatService.ts` | GetStream client wrapper only |
| `src/middleware/*.ts` | Auth/error middleware is shared |
| `src/utils/*.ts` | Utilities are shared |
| `src/config/*.ts` | Config is shared |

---

## Phase 1 — Scaffolding (Zero Side Effects)

**Goal:** Create empty module folders + index routers. Mount in `routes/index.ts`. **Nothing moves yet.**

**Duration:** ~30 min | **Risk:** 🟢 Zero

### Step 1.1 — Create folders
```bash
mkdir -p src/marketplace/{routes,handlers,services,repositories,models}
mkdir -p src/networks/{routes,handlers,services,repositories,models}
mkdir -p src/shared/{getstream,middleware,repositories/base,utils}
```

### Step 1.2 — Create `marketplace/index.ts` (empty router)
Stub router that re-exports from existing `src/routes/marketplaceRoutes.ts` for now:
```ts
// src/marketplace/index.ts — Phase 1: proxy to existing routes
export { marketplaceRoutes } from '../routes/marketplaceRoutes';
```

### Step 1.3 — Create `networks/index.ts` (empty router)
```ts
// src/networks/index.ts — Phase 1: proxy to existing routes
export { networksRoutes } from '../routes/networksRoutes';
```

### Verification
- `tsc --noEmit` passes (new files are stubs, no breaking imports)
- `npm test` — identical results to pre-change baseline
- App boots normally

---

## Phase 2 — Service Layer Split (Additive Only)

**Goal:** Create platform-specific services in module folders. Shared services stay untouched. New services **wrap** shared logic with platform locked in.

**Duration:** ~3-4 hours | **Risk:** 🟢 Zero — additive only

### Step 2.1 — `MarketplaceChannelService.ts`
- Location: `src/marketplace/services/MarketplaceChannelService.ts`
- Logic: Listing-scoped channels — unique per `(listing + buyer + seller)`
- Wraps `channelRepository` with `platform: 'marketplace'` locked
- Uses `MarketplaceListingChannel` model directly

### Step 2.2 — `NetworksChannelService.ts`
- Location: `src/networks/services/NetworksChannelService.ts`
- Logic: User-to-user channels — unique per `(user1, user2)` bidirectional
- Wraps `channelRepository` with `platform: 'networks'` locked
- Uses `NetworkListingChannel` model directly

### Step 2.3 — `MarketplaceMessageService.ts`
- Location: `src/marketplace/services/MarketplaceMessageService.ts`
- Wraps `messageService` methods with `platform: 'marketplace'`

### Step 2.4 — `NetworksMessageService.ts`
- Location: `src/networks/services/NetworksMessageService.ts`
- Wraps `messageService` methods with `platform: 'networks'`

### Step 2.5 — Move existing offer services
- Copy `src/services/marketplace/MarketplaceOfferService.ts` → `src/marketplace/services/`
- Copy `src/services/networks/NetworkOfferService.ts` → `src/networks/services/`
- Copy `src/services/networks/ReferenceCheckService.ts` → `src/networks/services/`
- Fix import paths (add `../../` depth)
- **Keep originals until Phase 5 cleanup**

### Verification
- `tsc --noEmit` — 0 errors (new files, no modifications to existing)
- `npm test` — same results
- New service files exist but nothing imports them yet

---

## Phase 3 — Repository Layer Split (Additive Only)

**Goal:** Create platform-specific repositories that eliminate raw `platform` params at DB layer.

**Duration:** ~2 hours | **Risk:** 🟢 Zero — additive only

### Step 3.1 — `MarketplaceChannelRepository.ts`
- Location: `src/marketplace/repositories/MarketplaceChannelRepository.ts`
- Extends `BaseRepository<IMarketplaceListingChannel>`
- Methods: `findByListingAndUsers()`, `findForUser()`, `findByGetstreamId()`, `isMember()`
- No `platform` param — always queries `MarketplaceListingChannel` model

### Step 3.2 — `NetworksChannelRepository.ts`
- Location: `src/networks/repositories/NetworksChannelRepository.ts`
- Extends `BaseRepository<INetworkListingChannel>`
- Methods: `findByUserPair()`, `findForUser()`, `findByGetstreamId()`, `isMember()`
- No `platform` param — always queries `NetworkListingChannel` model

### Step 3.3 — Wire Phase 2 services to Phase 3 repos
- Update `MarketplaceChannelService` to use `MarketplaceChannelRepository` instead of shared `channelRepository`
- Update `NetworksChannelService` to use `NetworksChannelRepository`

### Verification
- `tsc --noEmit` — 0 errors
- `npm test` — same results
- Grep: new repos don't accept `platform` param anywhere

---

## Phase 4 — Handler Migration (Careful Rewiring)

**Goal:** Copy platform handlers into module folders. Update imports to use new platform services. **Old handler files stay until cleanup.**

**Duration:** ~3-4 hours | **Risk:** 🟡 Low — same logic, different imports

### Step 4.1 — Marketplace handlers
Copy and rewire these into `src/marketplace/handlers/`:
- `marketplaceListingHandlers.ts` → `MarketplaceListingHandlers.ts`
- `marketplaceOfferHandlers.ts` → `MarketplaceOfferHandlers.ts`
- `marketplaceMerchantHandlers.ts` → `MarketplaceMerchantHandlers.ts`
- `orderHandlers.ts` (marketplace portions) → `MarketplaceOrderHandlers.ts`
- `chatHandlers.ts` (marketplace-curried) → `MarketplaceChatHandlers.ts`
- `messageHandlers.ts` (marketplace-curried) → `MarketplaceMessageHandlers.ts`
- `conversationHandlers.ts` (marketplace-curried) → `MarketplaceConversationHandlers.ts`

**Key change:** Each handler imports from `../services/MarketplaceChannelService` instead of shared `channelService`. No more `platform` param passing.

### Step 4.2 — Networks handlers
Copy and rewire into `src/networks/handlers/`:
- `networksListingHandlers.ts` → `NetworksListingHandlers.ts`
- `networksOfferHandlers.ts` → `NetworksOfferHandlers.ts`
- `chatHandlers.ts` (networks-curried) → `NetworksChatHandlers.ts`
- `messageHandlers.ts` (networks-curried) → `NetworksMessageHandlers.ts`
- `conversationHandlers.ts` (networks-curried) → `NetworksConversationHandlers.ts`

### Verification
- `tsc --noEmit` — 0 errors
- `npm test` — same results
- New handlers exist in module folders, old ones still untouched

---

## Phase 5 — Route Migration & Module Activation

**Goal:** Move platform routes into module folders. Update `marketplace/index.ts` and `networks/index.ts` to use module-internal routes + handlers. Update `routes/index.ts` to mount from modules.

**Duration:** ~2-3 hours | **Risk:** 🟡 Medium — this is the switchover

### Step 5.1 — Marketplace routes
Move route files from `src/routes/{listings,offers,channels,chat,messages,conversations,merchant,users}/marketplace*.ts` into `src/marketplace/routes/`.

Update imports to point to `../handlers/Marketplace*Handlers`.

### Step 5.2 — Networks routes
Move route files from `src/routes/{listings,offers,channels,chat,messages,conversations,users}/networks*.ts` into `src/networks/routes/`.

Update imports to point to `../handlers/Networks*Handlers`.

### Step 5.3 — Build module routers
Update `marketplace/index.ts` and `networks/index.ts` to import from `./routes/*` and compose the full platform router.

### Step 5.4 — Update `routes/index.ts`
```ts
import marketplaceRouter from '../marketplace';
import networksRouter from '../networks';

router.use("/v1/networks", requirePlatformAuth(), networksRouter);
router.use("/v1/marketplace", requirePlatformAuth(), marketplaceRouter);
```

### Step 5.5 — Delete old route aggregators
Remove `src/routes/marketplaceRoutes.ts` and `src/routes/networksRoutes.ts`.

### Verification
- `tsc --noEmit` — 0 errors
- `npm test` — same results
- All `/api/v1/marketplace/*` and `/api/v1/networks/*` endpoints respond correctly
- `routes/` folder contains ONLY shared/non-platform routes

---

## Phase 6 — Cleanup & Orphan Removal

**Goal:** Delete old shared files that are now fully replaced by platform modules.

**Duration:** ~1-2 hours | **Risk:** 🟡 Low

### Step 6.1 — Delete old handler files
Only after verifying no imports remain:
- `src/handlers/chatHandlers.ts`
- `src/handlers/messageHandlers.ts`
- `src/handlers/conversationHandlers.ts`
- `src/handlers/marketplaceListingHandlers.ts`
- `src/handlers/marketplaceOfferHandlers.ts`
- `src/handlers/marketplaceMerchantHandlers.ts`
- `src/handlers/networksListingHandlers.ts`
- `src/handlers/networksOfferHandlers.ts`

### Step 6.2 — Delete old platform service directories
- `src/services/marketplace/` (empty)
- `src/services/networks/` (empty)

### Step 6.3 — Delete old route subdirectories
- `src/routes/listings/`, `src/routes/offers/`, `src/routes/channels/`, etc.

### Step 6.4 — Move shared infrastructure
- Copy `src/middleware/*.ts` → `src/shared/middleware/`
- Copy `src/repositories/base/` → `src/shared/repositories/base/`
- Wrap `ChatService.ts` as `src/shared/getstream/GetstreamClient.ts`
- **Update all imports across codebase**

### Verification
- `tsc --noEmit` — 0 errors
- `npm test` — same results
- Cross-contamination check:
  ```bash
  grep -r "marketplace" src/networks/ --include="*.ts"  # should be empty
  grep -r "networks" src/marketplace/ --include="*.ts"   # should be empty
  grep -r "ChannelService" src/ --include="*.ts" | grep -v "Marketplace\|Networks\|shared"
  grep -r "MessageService" src/ --include="*.ts" | grep -v "Marketplace\|Networks\|shared"
  ```

---

## Phase 7 — Model Scoping

**Goal:** Ensure data models enforce platform boundaries at schema level.

**Duration:** ~1-2 hours | **Risk:** 🟡 Low

### Step 7.1 — Wishlist platform enforcement
Add `platform` filtering to `Favorite.ts` static methods (required param at TypeScript level).

### Step 7.2 — Listing model verification
Confirm `MarketplaceListing` and `NetworkListing` discriminators are fully separate.

### Step 7.3 — Order/Offer model audit
Verify `Order.ts` and `Offer.ts` include `platform` field with `required: true` and all queries filter by it.

### Verification
- Schema: every platform-aware model has `platform` as required field
- Grep: no `.find()` on platform models without `platform` in filter

---

## Phase 8 — Test Suite Alignment

**Goal:** Fix test imports and add isolation tests.

**Duration:** ~1-2 hours | **Risk:** 🟢 Low

### Step 8.1 — Fix broken test imports
- `finix-payment-flow.test.ts` → point to correct handler path
- `SharedMedia.test.ts` → fix conversation route import
- `LoadBurst.test.ts` → fix reference check route import
- Any other tests referencing old paths

### Step 8.2 — Add platform isolation tests
- Marketplace operation cannot touch Networks data
- Networks operation cannot touch Marketplace data

### Verification
- `npm test` — 0 new failures vs baseline

---

## Phase 9 — Documentation & Swagger Synchronization

**Goal:** Update API docs and Swagger to reflect the separated architecture and ensure 100% alignment.

**Duration:** ~1-2 hours | **Risk:** 🟢 Zero

### Step 9.1 — Swagger Tag Grouping
Ensure every endpoint is tagged under the correct platform group (Marketplace vs Networks).

### Step 9.2 — Synchronize `src/config/swagger.ts`
- **Audit all paths:** Verify that all paths (e.g., `/api/v1/marketplace/...`) match the actual routes mounted in `routes/index.ts`.
- **Update definitions:** Ensure that schemas and parameters in `swagger.ts` reflect any model-level changes made in Phase 7.
- **Verification:** Run the server and inspect the Swagger UI dashboard to ensure no broken references or missing endpoints.

### Step 9.3 — Architecture Doc
Update `ARCHITECTURE.md` or create one documenting the façade pattern and module isolation strategy.

### Verification
- Swagger UI shows clean platform grouping.
- No orphan or undocumented endpoints.
- Total alignment between code routes and API documentation.

---

## Timeline Summary

| Phase | What | Duration | Risk | Breaks Logic? |
|-------|------|----------|------|---------------|
| **P1** | Scaffolding (empty folders + stubs) | 30 min | 🟢 | No |
| **P2** | Service layer split (additive) | 3-4h | 🟢 | No |
| **P3** | Repository layer split (additive) | 2h | 🟢 | No |
| **P4** | Handler migration (copy + rewire) | 3-4h | 🟡 | No |
| **P5** | Route migration & module activation | 2-3h | 🟡 | **Switchover** |
| **P6** | Cleanup & orphan removal | 1-2h | 🟡 | No |
| **P7** | Model scoping | 1-2h | 🟡 | No |
| **P8** | Test suite alignment | 1-2h | 🟢 | No |
| **P9** | Documentation & Swagger | 1h | 🟢 | No |

**Total: ~15-20 hours across 9 phases**

> **Key principle:** Phases 1-4 are purely additive — they create new files without touching existing ones. Phase 5 is the switchover. Phase 6 is cleanup. This means you can ship after P4 and the app works identically.
