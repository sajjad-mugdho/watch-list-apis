# Auth + Onboarding Clarity — Source of Truth & Bootstrap Contract

**Purpose:** Define the source of truth and onboarding flows to eliminate session-claim edge cases across web and mobile.

**Date:** December 18, 2025  
**Status:** Implementation Plan

---

## 1. Source of Truth (Core Decision)

### The Rule

- **Database (MongoDB) is the single source of truth**
- **Clerk session claims (JWT publicMetadata) are a cache**
- Session claims **may be stale** immediately after:
  - First signup (webhook delay)
  - Platform onboarding completion
  - Merchant onboarding completion
- Backend **must always be able to fall back to DB**

### Why This Matters

Session claims are embedded in JWT tokens issued by Clerk. They are updated via:

1. Clerk webhook → DB update → Clerk mutation (async)
2. Manual refresh endpoint (forced)

Between these events, clients may have stale JWTs showing `onboarding_status: "incomplete"` when the user has already completed onboarding.

**Implication:** Never trust session claims blindly. Always provide a DB fallback path.

---

## 2. Two Onboarding Flows (Critical Understanding)

### Flow 1: Platform Onboarding (Required for All Users)

**What:** 4-step wizard that collects baseline user info  
**When:** Immediately after Clerk signup  
**Purpose:** Establish user profile for platform access (buying watches)

**Steps:**

1. Location (country, postal_code, region)
2. Display name (auto-generated or custom)
3. Avatar (default or custom URL)
4. Legal acknowledgements (ToS, Privacy, Rules)

**Status Field:** `user.onboarding.status`

- `incomplete` → user created but not onboarded
- `completed` → all 4 steps done

**Completion Trigger:** `finalizeOnboarding()` in `src/utils/user.ts`

- Promotes location/display_name/avatar to top-level user fields
- Sets `user.onboarding.status = "completed"`
- Syncs to Clerk session claims (async)

**Files:**

- Handlers: `src/handlers/onboardingHandlers.ts`
- Routes: `src/routes/onboardingRoutes.ts`
- Logic: `src/utils/user.ts` (getOnboardingProgress, finalizeOnboarding)

---

### Flow 2: Merchant Onboarding (Optional, for Sellers)

**What:** Finix-hosted KYC form for payment processing  
**When:** After platform onboarding complete, user clicks "Become a Seller"  
**Purpose:** Enable user to sell watches (receive payouts)

**Process:**

1. User calls `POST /api/v1/marketplace/merchant/onboard`
2. Backend creates Finix onboarding form → returns `onboarding_url`
3. User redirected to Finix-hosted form (identity verification, bank account, tax info)
4. User completes form → Finix webhook: `onboarding_form.updated` (status: COMPLETED)
5. Worker stores `identity_id`, sets `onboarding_state: "PROVISIONING"`
6. Finix reviews → webhook: `merchant.created` or `merchant.updated`
7. Worker updates `onboarding_state: "APPROVED"` or `"REJECTED"`
8. Sync to Clerk claims: `isMerchant: true` if APPROVED

**Status Field:** `user.merchant.onboarding_state` (deprecated embedded field) OR `MerchantOnboarding.onboarding_state` (new separate collection)

**States:**

- `PENDING` → form created, not completed
- `PROVISIONING` → form completed, Finix reviewing
- `APPROVED` → merchant approved, can sell
- `REJECTED` → merchant rejected
- `UPDATE_REQUESTED` → Finix needs more info

**Files:**

- Handlers: `src/handlers/marketplaceMerchantHandlers.ts`
- Routes: `src/routes/marketplaceMerchant.ts`
- Model: `src/models/MerchantOnboarding.ts`
- Webhook worker: `src/workers/webhookProcessor.ts` (processFinixWebhook)
- Finix utils: `src/utils/finix.ts` (createOnboardingForm, provisionMerchant)

---

## 3. Client Bootstrap Flow (Web + Mobile)

### The Contract

```
1. User authenticates via Clerk
   → Client obtains JWT with embedded session claims

2. Client immediately calls GET /api/v1/me
   → Backend returns canonical user state:
      {
        dialist_id,
        onboarding_status,      // "incomplete" | "completed"
        onboarding_state,        // merchant onboarding state (if applicable)
        isMerchant,              // true if merchant APPROVED
        display_name,
        location_country,
        networks_accessed
      }

3. Client decides UI based on /me response:
   - If onboarding_status === "incomplete" → Show platform onboarding wizard
   - If onboarding_status === "completed" → Enter app
   - If user wants to sell → Check isMerchant
     - If false → Show "Become a Seller" → POST /marketplace/merchant/onboard
     - If true → Allow listing creation
```

**Key Points:**

- `/me` is the **canonical bootstrap endpoint**
- Session claims are **only used for fast-path optimization**
- Mobile and web use **identical flow**

---

## 4. Backend Behavior (Middleware + Handlers)

### Current Implementation (`src/middleware/authentication.ts`)

**Function:** `requirePlatformAuth()`

**Logic:**

```typescript
1. Extract auth from Clerk middleware (userId, sessionClaims)
2. Validate session claims against schema
3. IF claims valid → use claims (fast path)
4. ELSE → call fetchAndSyncLocalUser(external_id) (DB fallback)
5. Attach req.user for downstream handlers
```

**DB Fallback Function:** `fetchAndSyncLocalUser()` in `src/utils/user.ts`

- Queries User by external_id (Clerk userId)
- Builds claims from DB fields: `buildClaimsFromDbUser()`
- Attempts async sync back to Clerk (best-effort, non-blocking)

### Proposed Enhancement (New Endpoint)

**Add:** `GET /api/v1/me`

- Always returns DB-backed claims (no session claim dependency)
- Used by clients on bootstrap

**Add:** `POST /api/v1/auth/refresh`

- Forces DB fallback and re-syncs to Clerk
- Called after onboarding completion or merchant approval

**Modify:** `requirePlatformAuth()` middleware

- Honor `x-refresh-session: 1` header to force DB fallback

---

## 5. Known Edge Cases

### Edge Case 1: First Login Before Webhook Completes

**Scenario:** User signs up → Clerk webhook delayed → User tries to access app  
**Symptoms:** Session claims missing `dialist_id`  
**Handling:** Middleware falls back to DB → creates user if not exists (idempotent)

### Edge Case 2: Onboarding Completed, Session Not Refreshed

**Scenario:** User completes platform onboarding → PATCH /onboarding/acknowledgements → JWT still shows `onboarding_status: "incomplete"`  
**Symptoms:** Client shows onboarding wizard again  
**Handling:** Client calls POST /auth/refresh or GET /me after onboarding completion

### Edge Case 3: Mobile Opening Immediately After Signup

**Scenario:** User signs up on web → opens mobile app → session claims stale  
**Symptoms:** Mobile shows incomplete onboarding when already complete  
**Handling:** Mobile calls GET /me on launch (ignores JWT claims for bootstrap)

### Edge Case 4: Merchant Approval Race Condition

**Scenario:** Finix approves merchant → webhook arrives → Clerk sync pending → user checks status  
**Symptoms:** GET /marketplace/merchant/status shows old state  
**Handling:** Endpoint queries MerchantOnboarding collection directly (not session claims)

### Edge Case 5: Test/Mock Users in Dev

**Scenario:** Dev mode with mock Clerk users (customClerkMw.ts)  
**Symptoms:** Mock users have hardcoded session claims that don't match DB  
**Handling:** Standardize mock users to match DB fixtures; use x-test-user header

---

## 6. Mock User States (For Testing)

### State 1: New User (Pre-Platform Onboarding)

```typescript
{
  external_id: "user_new_incomplete_123",
  email: "new.user@test.com",
  first_name: "New",
  last_name: "User",
  onboarding: {
    status: "incomplete",
    steps: {
      location: { country: null },
      display_name: { confirmed: false },
      avatar: { confirmed: false },
      acknowledgements: { tos: false, privacy: false, rules: false }
    }
  },
  merchant: null
}
```

**Use Case:** Test platform onboarding wizard

---

### State 2: Onboarded Buyer (Platform Complete, Not Merchant)

```typescript
{
  external_id: "user_onboarded_buyer_123",
  email: "buyer@test.com",
  first_name: "John",
  last_name: "Buyer",
  onboarding: {
    status: "completed",
    completed_at: Date.now()
  },
  location: { country: "US", postal_code: "10001", region: "NY" },
  display_name: "John B.",
  avatar: null,
  merchant: null
}
```

**Session Claims:**

```typescript
{
  dialist_id: "...",
  onboarding_status: "completed",
  isMerchant: false,
  onboarding_state: undefined
}
```

**Use Case:** Test marketplace browsing, order placement

---

### State 3: Approved Merchant (Can Sell)

```typescript
{
  external_id: "user_merchant_approved_123",
  email: "seller@test.com",
  first_name: "Jane",
  last_name: "Seller",
  onboarding: {
    status: "completed"
  },
  location: { country: "US", postal_code: "90210", region: "CA" },
  display_name: "Jane's Watches",
  merchant: {
    onboarding_state: "APPROVED",
    merchant_id: "MU_test_123",
    identity_id: "ID_test_456"
  }
}
```

**MerchantOnboarding Record:**

```typescript
{
  dialist_user_id: ObjectId("..."),
  form_id: "obf_test_123",
  identity_id: "ID_test_456",
  merchant_id: "MU_test_123",
  onboarding_state: "APPROVED",
  verification_state: "SUCCEEDED"
}
```

**Session Claims:**

```typescript
{
  dialist_id: "...",
  onboarding_status: "completed",
  isMerchant: true,
  onboarding_state: "APPROVED"
}
```

**Use Case:** Test listing creation, payment processing

---

## 7. Explicit Out-of-Scope Items

**Not included in this phase:**

- ❌ Marketplace offer flows (counter, accept, reject, checkout)
- ❌ Payment subscription system (RevenueCat, in-app purchases)
- ❌ Handler refactors or normalization
- ❌ Data model schema changes (e.g., deprecating user.merchant embedded field)
- ❌ Frontend state management refactors
- ❌ Networks platform onboarding (separate from marketplace)

**Why:** Michael explicitly requested a focused scope on authentication bootstrap and onboarding clarity. Marketplace and payment features are deferred to Phase 2.

---

## 8. Implementation Checklist (Backend Only)

### Step 1: Add Canonical Endpoints (2–3 hours)

- [ ] Create `src/handlers/authHandlers.ts`
  - [ ] `me_get` → returns buildClaimsFromDbUser(user)
  - [ ] `auth_refresh_post` → forces fetchAndSyncLocalUser()
- [ ] Create `src/routes/auth.ts`
  - [ ] Mount GET /api/v1/me
  - [ ] Mount POST /api/v1/auth/refresh
- [ ] Update `src/routes/index.ts` to include auth routes
- [ ] Update middleware `requirePlatformAuth()` to honor `x-refresh-session: 1` header

### Step 2: Standardize Mock Users (1–2 hours)

- [ ] Update `src/middleware/customClerkMw.ts` mock user definitions
  - [ ] Add mock user: "new_incomplete" (State 1)
  - [ ] Add mock user: "onboarded_buyer" (State 2)
  - [ ] Add mock user: "merchant_approved" (State 3)
- [ ] Create `tests/helpers/mockUserFactory.ts` for consistent test fixtures
- [ ] Update existing tests to use standardized mocks

### Step 3: Add Integration Tests (2–3 hours)

- [ ] Create `tests/integration/auth.me.test.ts`
  - [ ] Test: GET /me returns claims when session valid
  - [ ] Test: GET /me falls back to DB when session missing
  - [ ] Test: GET /me with x-refresh-session forces DB lookup
  - [ ] Test: POST /auth/refresh updates claims
- [ ] Create `tests/integration/onboarding.e2e.test.ts`
  - [ ] Test: New user → complete onboarding → GET /me shows completed
  - [ ] Test: Onboarding mid-flow → GET /me shows correct next_step

### Step 4: Update Swagger Docs (1 hour)

- [ ] Add `/api/v1/me` endpoint to `src/config/swagger.ts`
  - [ ] Request: none (auth via bearer token)
  - [ ] Response: ValidatedUserClaims schema
- [ ] Add `/api/v1/auth/refresh` endpoint
  - [ ] Request: none
  - [ ] Response: ValidatedUserClaims schema
- [ ] Add `x-refresh-session` header documentation

### Step 5: Document and Share (30 min)

- [ ] Finalize this doc
- [ ] Share with Michael for review
- [ ] Get approval before implementing code changes

---

## 9. Testing Strategy

### Unit Tests

- `src/utils/user.ts` → getOnboardingProgress, finalizeOnboarding, buildClaimsFromDbUser
- `src/middleware/authentication.ts` → requirePlatformAuth with various claim states

### Integration Tests

- Signup → webhook → GET /me (stale JWT)
- Complete onboarding → POST /auth/refresh → updated claims
- Merchant onboarding → webhook chain → GET /marketplace/merchant/status

### E2E / Smoke Tests

- Full user journey: signup → onboard → browse → (optional) become merchant → create listing

---

## 10. Success Criteria

**This phase is complete when:**

✅ GET /api/v1/me returns DB-backed claims for any authenticated user  
✅ POST /api/v1/auth/refresh forces DB refresh and syncs to Clerk  
✅ Middleware honors x-refresh-session header  
✅ 3 mock user states exist and are used consistently across tests  
✅ Integration tests pass for bootstrap and fallback scenarios  
✅ Swagger includes new endpoints  
✅ This doc is reviewed and approved by Michael

**Timeline:** 1–2 days for backend-only implementation

---

## 11. Open Questions for Michael

1. **Branch strategy:** Should new endpoints go to a `dev` branch first, then merge to `main` after testing?
2. **Clerk mutation flag:** Should we always attempt Clerk sync (FEATURE_CLERK_MUTATIONS=1) in production, or keep it optional?
3. **Mock user persistence:** Should mock users be seeded in dev DB, or only exist in customClerkMw.ts?
4. **Session refresh UX:** Should clients auto-refresh JWT after onboarding completion, or just call /me?

---

## Appendix A: Current File Structure

```
src/
├── handlers/
│   ├── onboardingHandlers.ts       # Platform onboarding (4 steps)
│   ├── marketplaceMerchantHandlers.ts  # Merchant onboarding (Finix)
│   ├── userHandlers.ts             # GET /user (legacy?)
│   └── authHandlers.ts             # NEW: me_get, auth_refresh_post
├── middleware/
│   ├── authentication.ts           # requirePlatformAuth (uses session + DB fallback)
│   └── customClerkMw.ts            # Mock users for dev
├── models/
│   ├── User.ts                     # Platform user + embedded merchant field
│   ├── MerchantOnboarding.ts      # Separate merchant onboarding collection
│   └── WebhookEvent.ts             # Webhook idempotency + retry
├── routes/
│   ├── onboardingRoutes.ts         # Platform onboarding endpoints
│   ├── marketplaceMerchant.ts      # Merchant onboarding endpoints
│   ├── userRoutes.ts               # GET /user
│   └── auth.ts                     # NEW: /me, /auth/refresh
├── utils/
│   ├── user.ts                     # getOnboardingProgress, finalizeOnboarding, buildClaimsFromDbUser
│   └── finix.ts                    # createOnboardingForm, provisionMerchant
├── workers/
│   └── webhookProcessor.ts         # Async webhook processing (Clerk + Finix)
└── queues/
    └── webhookQueue.ts             # Bull queue config
```

---

## Appendix B: Relevant Endpoints (Current)

### Platform Onboarding

- `GET /api/v1/onboarding` → get status
- `PATCH /api/v1/onboarding/location`
- `PATCH /api/v1/onboarding/display-name`
- `PATCH /api/v1/onboarding/avatar`
- `PATCH /api/v1/onboarding/acknowledgements`

### Merchant Onboarding

- `POST /api/v1/marketplace/merchant/onboard` → create Finix form
- `GET /api/v1/marketplace/merchant/status` → check approval state
- `POST /api/v1/marketplace/merchant/onboard/refresh-link` → generate new form URL

### User

- `GET /api/v1/user` → legacy endpoint (returns minimal info)
- `GET /api/v1/marketplace/user` → marketplace-specific user info
- `GET /api/v1/networks/user` → networks-specific user info

### Webhooks

- `POST /api/v1/webhooks/clerk` → Clerk user.created, user.updated
- `POST /api/v1/webhooks/finix` → Finix onboarding_form.updated, merchant.created, etc.

---

**End of Document**
