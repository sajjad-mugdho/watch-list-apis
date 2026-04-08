# Mock User System

> **For Frontend Developers** - How to test different user states without creating real accounts.

## Quick Start

Add the `x-test-user` header to any API request:

```javascript
// Using fetch
const response = await fetch("/api/v1/me", {
  headers: {
    "x-test-user": "buyer_us_complete",
  },
});

// Using axios
const response = await axios.get("/api/v1/me", {
  headers: { "x-test-user": "buyer_us_complete" },
});
```

⚠️ **Mock users only work in development/test environments.**

---

## Available Mock Users

### 🆕 New Users (Pre-Onboarding)

| ID            | Description                                |
| ------------- | ------------------------------------------ |
| `new_user_us` | Fresh US user, no onboarding started       |
| `new_user_ca` | Fresh Canadian user, no onboarding started |

**Expected Behavior:**

- `GET /api/v1/me` → `onboarding_status: "incomplete"`, `next_step: "location"`
- Protected routes → 403 Forbidden

---

### 🚶 Onboarding In Progress

| ID                             | Current Step     | Completed                            |
| ------------------------------ | ---------------- | ------------------------------------ |
| `onboarding_step1_location`    | location         | None                                 |
| `onboarding_step2_displayname` | display_name     | location ✓                           |
| `onboarding_step3_avatar`      | avatar           | location ✓, display_name ✓           |
| `onboarding_step4_acks`        | acknowledgements | location ✓, display_name ✓, avatar ✓ |

**Expected Behavior:**

- `GET /api/v1/me` → Shows `next_step` for current onboarding stage
- Can call `POST /api/v1/onboarding/steps/{step}` to progress

---

### 🛒 Buyers (Platform Complete, Not Merchant)

| ID                       | Description                       |
| ------------------------ | --------------------------------- |
| `buyer_us_complete`      | Fully onboarded US buyer          |
| `buyer_ca_complete`      | Fully onboarded Canadian buyer    |
| `buyer_with_custom_name` | Buyer who set custom display name |

**Expected Behavior:**

- `GET /api/v1/me` → `onboarding_status: "completed"`, `isMerchant: false`
- Can browse marketplace, make purchases
- Cannot create listings (not a merchant)

---

### 🏪 Merchants (Finix Onboarding States)

| ID                          | State             | Can Sell?                                |
| --------------------------- | ----------------- | ---------------------------------------- |
| `merchant_pending`          | PENDING           | ❌ Form link generated, not completed    |
| `merchant_provisioning`     | PROVISIONING      | ❌ Form completed, awaiting verification |
| `merchant_approved`         | APPROVED          | ✅ **Can sell!**                         |
| `merchant_approved_ca`      | APPROVED (Canada) | ✅ **Can sell!**                         |
| `merchant_rejected`         | REJECTED          | ❌ Application denied                    |
| `merchant_update_requested` | UPDATE_REQUESTED  | ❌ Needs to update info                  |

**Expected Behavior:**

- Only `APPROVED` merchants can create listings
- `GET /api/v1/me` → Shows `onboarding_state` for merchant status

---

### 🔧 Edge Cases

| ID                    | Description                             |
| --------------------- | --------------------------------------- |
| `user_with_networks`  | Buyer with Networks feature access      |
| `user_minimal_claims` | Minimal claims - for testing validation |

---

## Debug Endpoint

Get all mock users programmatically:

```bash
# List all mock users
GET /api/v1/debug/mock-users

# Get specific mock user details
GET /api/v1/debug/mock-users/buyer_us_complete

# Get mock users by category
GET /api/v1/debug/mock-users/category/merchant
```

---

## Testing Different Flows

### Flow 1: Complete Platform Onboarding

```javascript
// Step 1: Start as new user
headers: { 'x-test-user': 'onboarding_step1_location' }

// Check current state
GET /api/v1/me
// Response: { onboarding_status: "incomplete", next_step: "location" }

// Submit location
POST /api/v1/onboarding/steps/location
Body: { country: "US", postal_code: "94102" }

// Step 2: Switch to next stage user
headers: { 'x-test-user': 'onboarding_step2_displayname' }

// Continue testing...
```

### Flow 2: Test Merchant Dashboard

```javascript
// Test as approved merchant
headers: { 'x-test-user': 'merchant_approved' }

GET /api/v1/me
// Response includes: isMerchant: true, onboarding_state: "APPROVED"

// Can create listings
POST /api/v1/marketplace/listings
```

### Flow 3: Test Buyer Purchase Flow

```javascript
// Test as complete buyer
headers: { 'x-test-user': 'buyer_us_complete' }

// Browse marketplace
GET /api/v1/marketplace/listings

// Make purchase (cannot sell)
POST /api/v1/marketplace/orders
```

---

## Important Notes

1. **Session claims only**: Mock users inject session claims but don't create DB records by default. Most read operations work, but some write operations may need DB records.

2. **Environment restriction**: Mock users are disabled in production. The `x-test-user` header is ignored.

3. **Legacy IDs**: Some old mock user IDs still work for backward compatibility:

   - `user_new_incomplete` → Use `new_user_us` instead
   - `user_onboarded_buyer` → Use `buyer_us_complete` instead
   - `user_merchant_approved` → Use `merchant_approved` instead

4. **Real Clerk auth**: In production, real Clerk authentication is used. Mock users are for development/testing only.

---

## User State Reference

### Platform Onboarding (`onboarding_status`)

| Value        | Meaning                                   |
| ------------ | ----------------------------------------- |
| `incomplete` | User has not finished platform onboarding |
| `completed`  | User finished all onboarding steps        |

### Merchant Onboarding (`onboarding_state`)

| Value              | Meaning                                     |
| ------------------ | ------------------------------------------- |
| `undefined`        | User has not started merchant onboarding    |
| `PENDING`          | Form link created, user hasn't submitted    |
| `PROVISIONING`     | Form submitted, awaiting Finix verification |
| `APPROVED`         | **Can sell!** Merchant account active       |
| `REJECTED`         | Application denied                          |
| `UPDATE_REQUESTED` | Finix needs additional information          |

### Key Flags

| Field               | Type    | Meaning                                            |
| ------------------- | ------- | -------------------------------------------------- |
| `isMerchant`        | boolean | `true` only when `onboarding_state === "APPROVED"` |
| `networks_accessed` | boolean | User has visited Networks feature                  |

---

## Support

For questions about the mock user system, contact the backend team.

File: `/docs/MOCK_USER_SYSTEM.md`
Last updated: Auto-generated
