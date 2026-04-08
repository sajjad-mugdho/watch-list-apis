# Auth + Onboarding Flow Diagrams

## 1. Current System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DIALIST PLATFORM                          │
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │   Clerk      │      │   MongoDB    │                     │
│  │  (Auth JWT)  │      │  (Source of  │                     │
│  │              │      │    Truth)    │                     │
│  │ Session      │◄────►│              │                     │
│  │ Claims       │ Sync │  User.       │                     │
│  │ (Cache)      │      │  onboarding  │                     │
│  └──────────────┘      │              │                     │
│         │              │  Merchant    │                     │
│         │              │  Onboarding  │                     │
│         │              └──────────────┘                     │
│         │                     ▲                              │
│         │                     │                              │
│         ▼                     │                              │
│  ┌──────────────┐            │                              │
│  │  Web/Mobile  │────────────┘                              │
│  │   Clients    │  DB Fallback                              │
│  └──────────────┘  (when needed)                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Problem:** Session claims can be stale. Clients don't know when to trust JWT vs call backend.

---

## 2. Platform Onboarding Flow (4 Steps)

```
┌──────────────────────────────────────────────────────────────┐
│              PLATFORM ONBOARDING (Required)                   │
└──────────────────────────────────────────────────────────────┘

User Signs Up (Clerk)
    │
    ▼
Clerk Webhook: user.created
    │
    ▼
Create User in DB
    onboarding.status = "incomplete"
    │
    ▼
┌─────────────────────────────────┐
│  Client Checks Onboarding       │
│  GET /me or session claims      │
│  → onboarding_status: incomplete│
└─────────────────────────────────┘
    │
    ▼
┌──────────────────┐
│ Step 1: Location │ ◄── PATCH /onboarding/location
│ (country, zip)   │
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Step 2: Display  │ ◄── PATCH /onboarding/display-name
│ Name             │
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Step 3: Avatar   │ ◄── PATCH /onboarding/avatar
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Step 4: Legal    │ ◄── PATCH /onboarding/acknowledgements
│ Acks (ToS etc)   │
└──────────────────┘
    │
    ▼
Backend: finalizeOnboarding()
    • Sets onboarding.status = "completed"
    • Promotes location/name/avatar to top level
    • Syncs to Clerk (async)
    │
    ▼
┌─────────────────────────────────┐
│  Client Calls GET /me           │
│  → onboarding_status: completed │
│  → Enter app                    │
└─────────────────────────────────┘
```

---

## 3. Merchant Onboarding Flow (Optional, for Sellers)

```
┌──────────────────────────────────────────────────────────────┐
│           MERCHANT ONBOARDING (Optional, Finix)               │
└──────────────────────────────────────────────────────────────┘

User Clicks "Become a Seller"
    │
    ▼
POST /marketplace/merchant/onboard
    body: { business_name, max_transaction_amount }
    │
    ▼
Backend Creates Finix Onboarding Form
    • createOnboardingForm(user_location: US/CA)
    • Tags form with dialist_user_id
    │
    ▼
Response: { onboarding_url, form_id, expires_at }
    │
    ▼
Client Redirects User to Finix Hosted Form
    │
    ▼
┌────────────────────────────────────┐
│  Finix Hosted Form                 │
│  • Business details                │
│  • Bank account                    │
│  • Tax ID (SSN/EIN)                │
│  • Identity verification (DOB)     │
└────────────────────────────────────┘
    │
    ▼
User Completes Form
    │
    ▼
Finix Webhook: onboarding_form.updated
    status: COMPLETED
    identity_id: ID_xyz123
    tags: { dialist_user_id }
    │
    ▼
Worker: processFinixWebhook()
    • Find MerchantOnboarding by dialist_user_id
    • Store identity_id
    • Set onboarding_state = "PROVISIONING"
    │
    ▼
Finix Reviews Application (1–2 days)
    │
    ▼
Finix Webhook: merchant.created
    merchant_id: MU_abc456
    onboarding_state: APPROVED (or REJECTED)
    │
    ▼
Worker: processFinixWebhook()
    • Update MerchantOnboarding.onboarding_state = "APPROVED"
    • Update User.merchant.onboarding_state = "APPROVED"
    • Sync to Clerk: isMerchant = true
    │
    ▼
┌─────────────────────────────────┐
│  Client Checks Merchant Status  │
│  GET /marketplace/merchant/status│
│  → is_merchant: true            │
│  → onboarding_state: APPROVED   │
└─────────────────────────────────┘
    │
    ▼
User Can Now Create Listings
```

---

## 4. Client Bootstrap Flow (Proposed)

```
┌──────────────────────────────────────────────────────────────┐
│              CLIENT BOOTSTRAP (Web + Mobile)                  │
└──────────────────────────────────────────────────────────────┘

App Launch
    │
    ▼
Clerk Authentication
    • Obtain JWT with session claims (may be stale)
    │
    ▼
┌─────────────────────────────────┐
│  Call GET /api/v1/me            │
│  (Always DB-backed)             │
└─────────────────────────────────┘
    │
    ▼
Backend: requirePlatformAuth()
    • Extract session claims from JWT
    • IF claims valid → use (fast path)
    • ELSE → fetchAndSyncLocalUser() (DB)
    │
    ▼
Response: {
  dialist_id,
  onboarding_status,     // "incomplete" | "completed"
  onboarding_state,      // merchant state (if applicable)
  isMerchant,            // true if APPROVED
  display_name,
  location_country
}
    │
    ▼
Client Decision Tree:

IF onboarding_status === "incomplete"
    → Show Platform Onboarding Wizard

ELSE IF onboarding_status === "completed"
    → Enter App
    │
    ├─► User wants to buy watches
    │   → Allow browsing + checkout
    │
    └─► User wants to sell watches
        │
        IF isMerchant === false
            → Show "Become a Seller" CTA
            → POST /marketplace/merchant/onboard
        ELSE
            → Allow listing creation
```

---

## 5. Edge Case: Stale JWT After Onboarding

```
┌──────────────────────────────────────────────────────────────┐
│           EDGE CASE: Onboarding Complete, JWT Stale           │
└──────────────────────────────────────────────────────────────┘

User Completes Platform Onboarding
    PATCH /onboarding/acknowledgements
    │
    ▼
Backend: finalizeOnboarding()
    • user.onboarding.status = "completed"
    • Sync to Clerk (async, takes 1–2 seconds)
    │
    ▼
┌─────────────────────────────────────────────────┐
│  Client JWT Still Shows:                        │
│  { onboarding_status: "incomplete" }            │
│  (Because Clerk hasn't refreshed token yet)     │
└─────────────────────────────────────────────────┘
    │
    ▼
Client Calls GET /me (or POST /auth/refresh)
    │
    ▼
Backend: requirePlatformAuth()
    • Session claims show "incomplete" (stale)
    • Detects mismatch → calls fetchAndSyncLocalUser()
    • Queries DB → user.onboarding.status = "completed"
    │
    ▼
Response: {
  onboarding_status: "completed"  ← Correct state from DB
}
    │
    ▼
Client: Enter app (no wizard shown)
```

**Solution:** Always trust GET /me over session claims for bootstrap decisions.

---

## 6. Database Schema Summary

```
┌─────────────────────────────────────────────────────────────┐
│                   User Collection                            │
├─────────────────────────────────────────────────────────────┤
│  _id: ObjectId                                               │
│  external_id: string (Clerk userId)                         │
│  email: string                                               │
│  first_name: string                                          │
│  last_name: string                                           │
│  display_name: string                                        │
│  avatar: string (URL)                                        │
│  location: {                                                 │
│    country: "US" | "CA"                                      │
│    postal_code: string                                       │
│    region: string                                            │
│  }                                                            │
│  onboarding: {                                               │
│    status: "incomplete" | "completed"                        │
│    version: "1.0"                                            │
│    steps: { location, display_name, avatar, acks }          │
│    completed_at: Date                                        │
│  }                                                            │
│  merchant: {  (DEPRECATED — moving to MerchantOnboarding)   │
│    onboarding_state: "PROVISIONING" | "APPROVED" | ...      │
│    merchant_id: string (Finix)                               │
│    identity_id: string (Finix)                               │
│  }                                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              MerchantOnboarding Collection                   │
├─────────────────────────────────────────────────────────────┤
│  _id: ObjectId                                               │
│  dialist_user_id: ObjectId → User._id                       │
│  form_id: string (Finix onboarding form)                    │
│  identity_id: string (Finix identity)                       │
│  merchant_id: string (Finix merchant)                       │
│  onboarding_state: "PENDING" | "PROVISIONING" |             │
│                    "APPROVED" | "REJECTED"                   │
│  verification_state: "PENDING" | "SUCCEEDED" | "FAILED"     │
│  onboarded_at: Date                                          │
│  verified_at: Date                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 Clerk Session Claims (JWT)                   │
├─────────────────────────────────────────────────────────────┤
│  {                                                            │
│    dialist_id: string                                        │
│    onboarding_status: "incomplete" | "completed"            │
│    onboarding_state: "APPROVED" | "PROVISIONING" | ...      │
│    isMerchant: boolean                                       │
│    display_name: string                                      │
│    location_country: "US" | "CA"                             │
│    networks_accessed: boolean                                │
│  }                                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. API Endpoints Summary

### Platform Onboarding

```
GET    /api/v1/onboarding                      → Get status
PATCH  /api/v1/onboarding/location             → Step 1
PATCH  /api/v1/onboarding/display-name         → Step 2
PATCH  /api/v1/onboarding/avatar               → Step 3
PATCH  /api/v1/onboarding/acknowledgements     → Step 4
```

### Merchant Onboarding

```
POST   /api/v1/marketplace/merchant/onboard    → Create Finix form
GET    /api/v1/marketplace/merchant/status     → Check approval
POST   /api/v1/marketplace/merchant/refresh    → New form link
```

### Bootstrap (NEW)

```
GET    /api/v1/me                              → Canonical user state (DB)
POST   /api/v1/auth/refresh                    → Force claims refresh
```

### Webhooks

```
POST   /api/v1/webhooks/clerk                  → Clerk events
POST   /api/v1/webhooks/finix                  → Finix events
```

---

**End of Diagrams**
