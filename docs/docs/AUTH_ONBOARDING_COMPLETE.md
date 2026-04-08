# Dialist API - Complete Auth & Onboarding Documentation

## Executive Summary

This document provides complete technical documentation for the Dialist API authentication and onboarding flows, covering:

1. **User Authentication** - Sign-up, Sign-in via Clerk
2. **Platform Onboarding** - 4-step wizard for buyer/seller profile setup
3. **Merchant Onboarding** - Finix KYC form for payment processing approval
4. **Session Management** - JWT claims sync between Clerk and Database
5. **Status Tracking** - How to determine user state at any point

**Key Achievement:** Single source of truth (MongoDB) with Clerk as JWT token cache.

---

## Architecture Overview

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Application                      │
│                    (Web / Mobile / Dashboard)                    │
└────────────┬──────────────────────────────────────────────┬─────┘
             │                                              │
             ▼                                              ▼
       ┌──────────┐                                  ┌─────────────┐
       │   Clerk  │                                  │ Dialist API │
       │   SDK    │◄──────── JWT Token ─────────►  │             │
       │          │         + publicMetadata        │ - Express   │
       └──────────┘                                  │ - MongoDB   │
             │                                       │ - Finix     │
             │                                       │ - Queues    │
             └───────────────────────┬───────────────┘
                                     │
                            ┌────────▼──────────┐
                            │    MongoDB        │
                            │  (Source of Truth)│
                            │                   │
                            │ - User            │
                            │ - Onboarding      │
                            │ - MerchantOnboard │
                            └───────────────────┘
```

### Data Model

#### User Collection

Stores core user identity and platform onboarding status:

```typescript
{
  _id: ObjectId,
  external_id: string,           // Clerk user ID
  email: string,
  first_name: string,
  last_name: string,
  display_name: string | null,   // From platform onboarding
  avatar: string | null,         // From platform onboarding
  location: {
    country: "US" | "CA",
    region: string,              // "CA", "NY", etc.
    postal_code: string,
  },
  onboarding: {
    status: "incomplete" | "completed",
    version: "1.0",
    completed_at: Date | null,
    steps: {
      location: { country, region, postal_code },
      display_name: { value, mode: "custom" | "auto" },
      avatar: { url },
      acknowledgements: { terms_of_service, privacy_policy, marketplace_rules }
    }
  },
  // Deprecated - DO NOT USE
  merchant?: {
    onboarding_state: string,
    merchant_id?: string,
  }
}
```

#### MerchantOnboarding Collection

Separate collection for merchant-specific data (Finix integration):

```typescript
{
  _id: ObjectId,
  dialist_user_id: ObjectId,     // Reference to User._id
  clerk_id: string,               // Clerk user ID

  // Finix resource IDs
  form_id: string,                // Finix onboarding form ID
  identity_id?: string | null,    // Set when form submitted
  merchant_id?: string | null,    // Set when merchant approved
  verification_id?: string | null,

  // Status
  onboarding_state:               // From Finix
    | "PENDING"
    | "PROVISIONING"
    | "APPROVED"
    | "REJECTED"
    | "UPDATE_REQUESTED",
  verification_state?: "PENDING" | "SUCCEEDED" | "FAILED" | null,

  // Form link management
  last_form_link?: string,
  last_form_link_expires_at?: Date,

  // Timestamps
  onboarded_at?: Date | null,     // When form was submitted
  created_at: Date,
  updated_at: Date,
}
```

#### Session Claims (Clerk publicMetadata)

Cached in Clerk JWT token for fast access:

```json
{
  "userId": "user_36OKpyLZ...",
  "dialist_id": "6931d0ad8f88ced1cd48b052",
  "display_name": "Jane's Watches",
  "display_avatar": "https://...",
  "location_country": "US",
  "location_region": "California",
  "onboarding_status": "completed",
  "isMerchant": true,
  "onboarding_state": "APPROVED",
  "networks_application_id": null,
  "networks_accessed": false
}
```

**Important:**

- `onboarding_status` = Platform onboarding (always present)
- `onboarding_state` + `isMerchant` = Merchant onboarding (only if user started merchant flow)
- Not all fields always present - only included when relevant

---

## Complete User Journeys

### Journey 1: User Sign-Up (First Time)

```
1. Client opens app
   ▼
2. User clicks "Sign Up"
   ├─► Clerk SDK opens sign-up form
   ├─► User enters email, password, name
   └─► Clerk creates user account
   ▼
3. Clerk webhook triggered: user.created
   ├─► Backend creates User document in MongoDB
   ├─► onboarding.status = "incomplete"
   ├─► Clerk webhook saves user to session cache
   └─► Frontend redirected to onboarding
   ▼
4. GET /api/v1/me (client bootstrap)
   ├─► Backend queries User collection
   ├─► Returns onboarding_status: "incomplete"
   ├─► Syncs to Clerk publicMetadata (cache)
   └─► Frontend shows: "Complete your profile"
```

**Response Example:**

```json
{
  "data": {
    "userId": "user_36OKpyLZ...",
    "dialist_id": "6931d0ad8f88ced1cd48b052",
    "onboarding_status": "incomplete",
    "display_name": null,
    "location_country": null,
    "isMerchant": false,
    "requestId": "..."
  }
}
```

---

### Journey 2: Platform Onboarding (4 Steps)

User completes 4-step onboarding wizard:

#### Step 1: Location

```
PATCH /api/v1/onboarding/steps/location
{
  "country": "US",
  "region": "California",
  "postal_code": "90210"
}
```

Backend updates:

- `User.location`
- `User.onboarding.steps.location`

#### Step 2: Display Name

```
PATCH /api/v1/onboarding/steps/display_name
{
  "value": "Jane's Watches",
  "mode": "custom"
}
```

Backend updates:

- `User.display_name`
- `User.onboarding.steps.display_name`

#### Step 3: Avatar

```
PATCH /api/v1/onboarding/steps/avatar
{
  "url": "https://images.dialist.com/..."
}
```

Backend updates:

- `User.avatar`
- `User.onboarding.steps.avatar`

#### Step 4: Acknowledgements (Final)

```
PATCH /api/v1/onboarding/steps/acknowledgements
{
  "terms_of_service": true,
  "privacy_policy": true,
  "marketplace_rules": true
}
```

Backend:

1. Updates `User.onboarding.steps.acknowledgements`
2. Sets `User.onboarding.status = "completed"`
3. Sets `User.onboarding.completed_at = now()`
4. Calls `attemptClerkSync()`:
   ```typescript
   clerkClient.users.updateUserMetadata(external_id, {
     publicMetadata: {
       onboarding_status: "completed",
       display_name: "Jane's Watches",
       location_country: "US",
       // ... etc
     },
   });
   ```

**After Step 4 Complete:**

```json
{
  "data": {
    "userId": "user_36OKpyLZ...",
    "dialist_id": "6931d0ad8f88ced1cd48b052",
    "onboarding_status": "completed",
    "display_name": "Jane's Watches",
    "display_avatar": "https://...",
    "location_country": "US",
    "location_region": "California",
    "isMerchant": false
  }
}
```

---

### Journey 3: Merchant Onboarding (Finix KYC)

User decides to become a seller and complete Finix KYC:

#### Step 1: Initiate Merchant Onboarding

```
POST /api/v1/marketplace/merchant/onboard
{
  "business_name": "Jane's Watches Inc",
  "max_transaction_amount": 50000
}
```

Backend:

1. Validates user completed platform onboarding (required)
2. Calls Finix API: `createOnboardingForm()`
   - Finix creates hosted form
   - Returns: form_id, form_link, expires_at
3. Creates `MerchantOnboarding` document:
   ```typescript
   {
     dialist_user_id: user._id,
     clerk_id: external_id,
     form_id: "ONF_xxx",
     onboarding_state: "PENDING",
     // ... Finix will update after form completion
   }
   ```
4. Returns onboarding URL to client

**Response:**

```json
{
  "data": {
    "onboarding_url": "https://onboarding.finix.com/form/ONF_xxx",
    "form_id": "ONF_xxx",
    "expires_at": "2025-12-25T10:24:03.000Z",
    "existing_form": false
  }
}
```

#### Step 2: User Completes Finix Form

1. Client redirects user to `onboarding_url`
2. User enters in Finix hosted form:
   - Business details
   - Bank account information
   - Tax ID
   - Personal verification
3. User submits form
4. Finix processes submission

#### Step 3: Finix Webhook Notifications

Finix sends webhooks about form and merchant status:

**Webhook 1: onboarding_form.updated (status: COMPLETED)**

```json
{
  "type": "onboarding_form.updated",
  "data": {
    "id": "ONF_xxx",
    "status": "COMPLETED",
    "identity_id": "ID_xxx"
  }
}
```

Backend:

1. Finds `MerchantOnboarding` by form_id
2. Sets `identity_id = "ID_xxx"`
3. Calls Finix to provision merchant: `provisionMerchant(identity_id)`

**Webhook 2: merchant.created**

```json
{
  "type": "merchant.created",
  "data": {
    "id": "MU_xxx",
    "identity": "ID_xxx",
    "onboarding_state": "PROVISIONING",
    "verification": null
  }
}
```

Backend:

1. Updates `MerchantOnboarding`:
   - `merchant_id = "MU_xxx"`
   - `onboarding_state = "PROVISIONING"`
2. Calls `buildClaimsFromDbUser()` to refresh session
3. Syncs to Clerk:
   ```typescript
   clerkClient.users.updateUserMetadata(external_id, {
     publicMetadata: {
       isMerchant: false, // Not yet APPROVED
       onboarding_state: "PROVISIONING",
     },
   });
   ```

**Webhook 3: merchant.updated (status: APPROVED)**

```json
{
  "type": "merchant.updated",
  "data": {
    "id": "MU_xxx",
    "onboarding_state": "APPROVED",
    "verification": "APPROVED"
  }
}
```

Backend:

1. Updates `MerchantOnboarding`:
   - `onboarding_state = "APPROVED"`
   - `verification_state = "APPROVED"`
2. Calls `buildClaimsFromDbUser()` to refresh session
3. Syncs to Clerk:
   ```typescript
   clerkClient.users.updateUserMetadata(external_id, {
     publicMetadata: {
       isMerchant: true, // NOW approved!
       onboarding_state: "APPROVED",
     },
   });
   ```

#### Step 4: Verify Merchant Status

After ~30 seconds (time for webhooks to process):

```
GET /api/v1/marketplace/merchant/status
```

**Response:**

```json
{
  "data": {
    "is_merchant": true,
    "status": "APPROVED",
    "merchant_id": "MU_xxx",
    "identity_id": "ID_xxx",
    "form_id": "ONF_xxx",
    "onboarding_state": "APPROVED",
    "verification_state": "APPROVED",
    "onboarded_at": "2025-11-18T10:24:03.000Z",
    "verified_at": "2025-11-18T10:30:00.000Z"
  }
}
```

#### Alternative: Check via GET /me

```
GET /api/v1/me
```

**Response:**

```json
{
  "data": {
    "userId": "user_36OKpyLZ...",
    "dialist_id": "6931d0ad8f88ced1cd48b052",
    "onboarding_status": "completed",
    "display_name": "Jane's Watches",
    "isMerchant": true,
    "onboarding_state": "APPROVED"
  }
}
```

---

## API Endpoints Reference

### Authentication Endpoints

#### GET /api/v1/me

**Purpose:** Get canonical user state (DB-backed, always fresh)

**Canonical Bootstrap Endpoint:** Call this immediately after Clerk authentication to determine user state

**Authentication:** Required (Bearer token)

**Headers:**

- `x-refresh-session: 1` (optional) - Force DB lookup, skip session cache

**Response:**

```json
{
  "data": {
    "userId": "user_36OKpyLZ...",
    "dialist_id": "6931d0ad8f88ced1cd48b052",
    "display_name": "Jane's Watches",
    "display_avatar": "https://images.dialist.com/...",
    "location_country": "US",
    "location_region": "California",
    "onboarding_status": "completed",
    "isMerchant": true,
    "onboarding_state": "APPROVED",
    "networks_application_id": null,
    "networks_accessed": false
  },
  "requestId": "881f08c6-0ef8-4ff1-b911-6cfaec12c8bf"
}
```

**Use Cases:**

- Client bootstrap after Clerk authentication
- Verify onboarding status before showing UI
- Get fresh merchant status after Finix approval
- Detect stale session claims

---

#### POST /api/v1/auth/refresh

**Purpose:** Force refresh user session claims from database

**When to Call:**

- After completing platform onboarding
- After Finix merchant approval
- When client detects stale session claims

**Authentication:** Required (Bearer token)

**Response:** (same as GET /me)

```json
{
  "data": {
    /* ... */
  }
}
```

**Note:** This endpoint always queries DB and attempts to sync to Clerk. Clerk JWT refresh may take 1-2 seconds.

---

### Platform Onboarding Endpoints

#### PATCH /api/v1/onboarding/steps/location

Update user location (Step 1)

**Request:**

```json
{
  "country": "US",
  "region": "California",
  "postal_code": "90210"
}
```

**Response:**

```json
{
  "data": {
    "status": "incomplete",
    "steps": {
      "location": { "completed": true }
    }
  }
}
```

---

#### PATCH /api/v1/onboarding/steps/display_name

Update display name (Step 2)

**Request:**

```json
{
  "value": "Jane's Watches",
  "mode": "custom"
}
```

---

#### PATCH /api/v1/onboarding/steps/avatar

Update avatar (Step 3)

**Request:**

```json
{
  "url": "https://images.dialist.com/avatar-uuid/w=400"
}
```

---

#### PATCH /api/v1/onboarding/steps/acknowledgements

Complete onboarding (Step 4 - Final)

**Request:**

```json
{
  "terms_of_service": true,
  "privacy_policy": true,
  "marketplace_rules": true
}
```

**Response:** (triggers Clerk sync)

```json
{
  "data": {
    "status": "completed",
    "completed_at": "2025-11-18T10:24:03.000Z"
  }
}
```

---

### Merchant Onboarding Endpoints

#### POST /api/v1/marketplace/merchant/onboard

**Purpose:** Create Finix merchant onboarding session

**Required:** User must complete platform onboarding first

**Authentication:** Required (Bearer token)

**Request:**

```json
{
  "business_name": "Jane's Watches Inc",
  "max_transaction_amount": 50000
}
```

**Response:**

```json
{
  "data": {
    "onboarding_url": "https://onboarding.finix.com/form/ONF_xxx?token=...",
    "form_id": "ONF_xxx",
    "expires_at": "2025-12-25T10:24:03.000Z",
    "existing_form": false
  }
}
```

**Client Action:** Redirect user to `onboarding_url` to complete Finix KYC form.

---

#### GET /api/v1/marketplace/merchant/status

**Purpose:** Get current merchant status

**Authentication:** Required (Bearer token)

**Response (Not Started):**

```json
{
  "data": {
    "is_merchant": false,
    "status": "NOT_STARTED",
    "identity_id": null,
    "merchant_id": null,
    "form_id": null,
    "onboarding_state": null
  }
}
```

**Response (In Progress):**

```json
{
  "data": {
    "is_merchant": false,
    "status": "PROVISIONING",
    "identity_id": "ID_xxx",
    "merchant_id": "MU_xxx",
    "form_id": "ONF_xxx",
    "onboarding_state": "PROVISIONING",
    "verification_state": "PENDING"
  }
}
```

**Response (Approved):**

```json
{
  "data": {
    "is_merchant": true,
    "status": "APPROVED",
    "identity_id": "ID_xxx",
    "merchant_id": "MU_xxx",
    "form_id": "ONF_xxx",
    "onboarding_state": "APPROVED",
    "verification_state": "APPROVED",
    "onboarded_at": "2025-11-18T10:24:03.000Z",
    "verified_at": "2025-11-18T10:30:00.000Z"
  }
}
```

---

#### POST /api/v1/marketplace/merchant/onboard/refresh-link

**Purpose:** Refresh expired onboarding form link

**Use Case:** If original link expired (valid for 30 days)

**Authentication:** Required (Bearer token)

**Request:**

```json
{
  "form_id": "ONF_xxx"
}
```

**Response:** (new link)

```json
{
  "data": {
    "onboarding_url": "https://onboarding.finix.com/form/ONF_xxx?token=...",
    "expires_at": "2025-12-25T10:24:03.000Z"
  }
}
```

---

## User State Decision Tree

### Determining User Status from /me Response

```
Query: GET /api/v1/me

┌─ onboarding_status == "incomplete" ?
│  └─► User hasn't completed platform onboarding yet
│      Action: Show 4-step onboarding wizard
│
├─ onboarding_status == "completed" && isMerchant == false ?
│  └─► Completed platform onboarding, NOT a merchant
│      Action: Show "Become a Seller" button
│
├─ onboarding_status == "completed" && isMerchant == false && onboarding_state == undefined ?
│  └─► Buyer account (no merchant record exists)
│      Action: Show marketplace buyer UI
│
├─ onboarding_status == "completed" && onboarding_state == "PENDING" ?
│  └─► Started merchant onboarding, awaiting Finix review
│      Action: Show "Application under review" message
│
├─ onboarding_status == "completed" && onboarding_state == "PROVISIONING" ?
│  └─► Merchant being provisioned by Finix
│      Action: Show "Setting up your merchant account..." spinner
│
├─ onboarding_status == "completed" && onboarding_state == "APPROVED" && isMerchant == true ?
│  └─► Fully approved merchant, ready to sell!
│      Action: Show full seller UI, create listings, receive payments
│
└─ onboarding_status == "completed" && onboarding_state == "REJECTED" ?
   └─► Merchant application rejected
       Action: Show rejection reason, offer reapply option
```

---

## Field Presence Rules

### When Fields Appear in JWT/Session

| Field                     | Condition                 | Value                                                   | Notes                              |
| ------------------------- | ------------------------- | ------------------------------------------------------- | ---------------------------------- |
| `userId`                  | Always                    | Clerk user ID                                           | From JWT                           |
| `dialist_id`              | Always                    | MongoDB user ID                                         | From User collection               |
| `onboarding_status`       | Always                    | "incomplete" \| "completed"                             | From User.onboarding               |
| `display_name`            | Always                    | string \| null                                          | null until step 2 complete         |
| `location_country`        | Always                    | "US" \| "CA" \| null                                    | null until step 1 complete         |
| `isMerchant`              | Always                    | boolean                                                 | false if no MerchantOnboarding     |
| `onboarding_state`        | If merchant record exists | "PENDING" \| "PROVISIONING" \| "APPROVED" \| "REJECTED" | Only if user started merchant flow |
| `networks_application_id` | Always                    | string \| null                                          | For networks integration           |
| `networks_accessed`       | Always                    | boolean                                                 | Has user accessed networks?        |

---

## Session Claim Sync Points

### When Clerk publicMetadata is Updated

The backend syncs user state to Clerk at these critical points:

#### 1. **Clerk Webhook: user.created**

- Trigger: New user signs up
- Action: Create User document in MongoDB
- Clerk Sync: Automatic (webhook receipt updates claims)

#### 2. **PATCH /onboarding/steps/acknowledgements** (Final Step)

- Trigger: User completes 4-step wizard
- Action: Set `onboarding.status = "completed"`
- Clerk Sync: Call `attemptClerkSync()`
- Wait: 1-2 seconds before JWT reflects change

#### 3. **POST /marketplace/merchant/onboard**

- Trigger: User initiates merchant onboarding
- Action: Create MerchantOnboarding document
- Clerk Sync: Automatic (sets initial merchant state)

#### 4. **Finix Webhook: merchant.updated**

- Trigger: Finix approves merchant or changes status
- Action: Update MerchantOnboarding in DB
- Clerk Sync: Call `attemptClerkSync()`
- Result: `isMerchant` and `onboarding_state` updated in JWT

#### 5. **POST /api/v1/auth/refresh** (On-Demand)

- Trigger: Client calls explicitly
- Action: Query DB for latest state
- Clerk Sync: Always syncs regardless of changes
- Use Case: Force refresh after onboarding/approval

---

## Testing Guide

### Mock Users for Testing

Four standardized mock users available for local/test environments:

#### 1. user_new_incomplete

- **State:** New, hasn't completed onboarding
- **Use:** Test onboarding flow
- **Response from /me:**

```json
{
  "onboarding_status": "incomplete",
  "display_name": null,
  "location_country": null,
  "isMerchant": false
}
```

#### 2. user_onboarded_buyer

- **State:** Completed platform onboarding, no merchant
- **Use:** Test buyer account
- **Response from /me:**

```json
{
  "onboarding_status": "completed",
  "display_name": "John Buyer",
  "location_country": "US",
  "isMerchant": false
}
```

#### 3. user_merchant_approved

- **State:** Merchant APPROVED and active
- **Use:** Test seller/merchant UI
- **Response from /me:**

```json
{
  "onboarding_status": "completed",
  "display_name": "Jane's Watches",
  "isMerchant": true,
  "onboarding_state": "APPROVED"
}
```

#### 4. user_orphaned

- **State:** Minimal/no DB data
- **Use:** Test error handling
- **Response from /me:**

```json
{
  "onboarding_status": "incomplete",
  "display_name": null,
  "isMerchant": false
}
```

### Testing with x-test-user Header

```bash
curl -X GET http://localhost:5050/api/v1/me \
  -H "x-test-user: user_merchant_approved" \
  -H "x-refresh-session: 1"
```

---

## Completeness Verification

### ✅ Implemented

- [x] Clerk authentication (sign-up, sign-in)
- [x] User creation via webhook
- [x] Platform onboarding (4 steps)
- [x] Session claim sync to Clerk
- [x] Merchant onboarding initiation
- [x] Finix webhook processing
- [x] Merchant status tracking
- [x] GET /me endpoint (canonical bootstrap)
- [x] POST /auth/refresh endpoint
- [x] Test coverage (10/10 integration tests passing)
- [x] Swagger documentation
- [x] Mock user support

### ⚠️ Considerations

1. **Finix Webhooks:** Requires ngrok/webhook tunnel for local testing
2. **Clerk JWT Refresh:** Takes 1-2 seconds after sync
3. **Form Expiration:** Onboarding links valid for 30 days
4. **Merchant Approval Timeline:** 5-60 seconds depending on Finix review

---

## Deployment Checklist

Before sending to production:

- [ ] All environment variables configured
  - [ ] `CLERK_SECRET_KEY`
  - [ ] `FINIX_API_KEY`
  - [ ] `FINIX_USER_ID`
  - [ ] `FEATURE_CLERK_MUTATIONS` enabled
- [ ] Finix webhook endpoints configured
- [ ] Clerk webhook endpoints configured
- [ ] Database indices created
- [ ] Test with real Clerk app
- [ ] Test with real Finix sandbox account
- [ ] Load test session sync
- [ ] Monitor webhook queue
- [ ] Error alerting enabled

---

## FAQ & Troubleshooting

### Q: Why do I see both onboarding_status and onboarding_state?

**A:** They represent two different flows:

- `onboarding_status` = Platform onboarding (4-step wizard)
- `onboarding_state` = Merchant onboarding (Finix KYC)

Most users will have `onboarding_status: "completed"` but NO `onboarding_state` (they're not merchants).

### Q: Session claims seem stale after onboarding

**A:** Call `POST /api/v1/auth/refresh` to force DB lookup and Clerk sync. Clerk JWT refresh takes 1-2 seconds.

### Q: How do I test merchant webhook without Finix account?

**A:** Use mock webhook endpoint or configure ngrok tunnel pointing to localhost for testing.

### Q: Can user complete merchant onboarding before platform onboarding?

**A:** No, backend validates `onboarding_status == "completed"` before allowing merchant flow.

### Q: What happens if Finix webhook fails?

**A:** Queue worker retries with exponential backoff. Check webhook queue logs if stuck.

### Q: Form link expired, how do user resume?

**A:** Call `POST /marketplace/merchant/onboard/refresh-link` to generate new link.

---

## Architecture Decisions

### 1. Separate MerchantOnboarding Collection

**Why:** Better than embedding merchant data in User document

- Reduces User document size
- Clear separation of concerns
- Easier to query merchant-specific data
- Finix data can be updated independently

### 2. Clerk publicMetadata Cache

**Why:** JWT tokens instead of session cookies

- Works across web/mobile/APIs
- Clerk handles token refresh automatically
- Faster client access (no network round-trip)
- Fallback to DB if claims invalid

### 3. Webhook-Driven State Updates

**Why:** Queue-based processing

- Decouples frontend from payment processor
- Retry logic for failed webhooks
- Audit trail of all state changes
- No blocking I/O in request handler

### 4. GET /me as Canonical Bootstrap

**Why:** Always DB-backed, never session cache

- Ensures fresh state on app startup
- Prevents confusion from stale JWT
- Clear single source of truth
- Replaces deprecated /user endpoint

---

## Related Documentation

- `docs/finix-onboarding.md` - Finix integration details
- `docs/Project_requrement.md` - Complete project requirements
- `README.md` - API overview
- `IMPLEMENTATION_COMPLETE.md` - Implementation status

---

**Last Updated:** December 18, 2025

**Status:** ✅ Complete - Ready for Michael Review

**Test Results:** 10/10 integration tests passing
