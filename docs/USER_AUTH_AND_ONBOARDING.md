# User Authentication & Onboarding

## Authentication Flow

Users authenticate through Clerk (OAuth provider).

**Process:**

1. User signs up or logs in via Clerk
2. Clerk creates user account and issues JWT token
3. Backend receives `user.created` webhook
4. Backend creates `User` record in MongoDB with `onboarding.status = "incomplete"`

**Client Bootstrap:**

```
Authenticate with Clerk → GET /api/v1/me → Receive user state
```

### Source of Truth

**MongoDB** is the source of truth for all user data.

**Clerk JWT claims** are a cache that may be stale after:

- Initial signup
- Completing platform onboarding
- Merchant approval/rejection

The backend always validates against the database when needed.

---

## Key Endpoints

### `GET /api/v1/me`

**Purpose:** Get current user state (canonical bootstrap endpoint)

**When to call:**

- Immediately after authentication
- Before showing UI
- After completing onboarding steps

**Returns:**

```json
{
  "data": {
    "userId": "user_abc123",
    "dialist_id": "677a...",
    "onboarding_status": "completed",
    "display_name": "John Buyer",
    "location_country": "US",
    "isMerchant": false
  }
}
```

**Optional Header:**

- `x-refresh-session: 1` - Force fresh database lookup

---

### `POST /api/v1/auth/refresh`

**Purpose:** Force database lookup and sync to Clerk session claims

**When to call:**

- After completing platform onboarding
- After merchant approval
- When detecting stale session claims

**Returns:** Same as `/api/v1/me`

---

## Platform Onboarding

Required for all users before they can purchase or sell watches.

### Status Field: `onboarding_status`

- `incomplete` - User has not completed onboarding
- `completed` - User finished all 4 steps

### 4-Step Process

#### Step 1: Location

**Endpoint:** `PATCH /api/v1/onboarding/steps/location`

**Body:**

```json
{
  "country": "US",
  "region": "California",
  "postal_code": "90210"
}
```

#### Step 2: Display Name

**Endpoint:** `PATCH /api/v1/onboarding/steps/display_name`

Users can choose between using an auto-generated name or providing their own.

**Option A: Use Default (Auto-Generated)**

Backend automatically generates name from user's first and last name (e.g., "John D.").

```json
{
  "mode": "default"
}
```

**Option B: Provide Custom Name**

User provides their own display name.

**Requirements:**

- `value` must be 7-60 characters
- Whitespace is trimmed

```json
{
  "mode": "custom",
  "value": "John's Watch Shop"
}
```

#### Step 3: Avatar

**Endpoint:** `PATCH /api/v1/onboarding/steps/avatar`

Users can use a default avatar or upload their own.

**Option A: Use Default Avatar**

Backend assigns a default avatar.

```json
{
  "mode": "default"
}
```

**Option B: Provide Custom Avatar**

User provides their own avatar URL (from image upload).

**Requirements:**

- `url` must be a valid URL
- Maximum length: 512 characters
- Must be hosted on a publicly accessible server

```json
{
  "mode": "custom",
  "url": "https://cdn.example.com/users/avatar_abc123.jpg"
}
```

#### Step 4: Acknowledgements (Final)

**Endpoint:** `PATCH /api/v1/onboarding/steps/acknowledgements`

**Body:**

```json
{
  "terms_of_service": true,
  "privacy_policy": true,
  "marketplace_rules": true
}
```

**Effect:**

- Sets `onboarding.status = "completed"`
- Sets `onboarding.completed_at = <timestamp>`
- Syncs to Clerk session claims
- User can now purchase watches

### Field Validation Summary

For frontend validation before API calls:

**Location (Step 1):**

- `country`: Must be "US" or "CA"
- `region`: 1-100 characters
- `postal_code`: 3-12 characters, alphanumeric + spaces/hyphens only

**Display Name (Step 2):**

- `mode`: "default" or "custom"
- `value`: Required only if `mode === "custom"`, 7-60 characters (trimmed)

**Avatar (Step 3):**

- `mode`: "default" or "custom"
- `url`: Required only if `mode === "custom"`, valid URL, max 512 characters

**Acknowledgements (Step 4):**

- All three must be `true`: `terms_of_service`, `privacy_policy`, `marketplace_rules`

### After Completing Onboarding

Call `GET /api/v1/me` to verify status changed to `"completed"`.

**Client Decision Logic:**

```
if (onboarding_status === "incomplete")
  → Show onboarding wizard

if (onboarding_status === "completed")
  → Show main app
```

---

## Merchant Onboarding

Optional process for users who want to sell watches.

**Prerequisites:**

- `onboarding_status` must be `"completed"`

### Status Fields

**`onboarding_state`** (Finix merchant status):

- `PENDING` - Waiting for Finix review
- `PROVISIONING` - Finix setting up merchant account
- `APPROVED` - Merchant can sell
- `REJECTED` - Application declined
- `UPDATE_REQUESTED` - Additional info needed

**`isMerchant`**:

- `false` - Not a merchant or under review
- `true` - Approved merchant, can sell watches

### Process

#### 1. Start Merchant Onboarding

**Endpoint:** `POST /api/v1/marketplace/merchant/onboard`

**Body:**

```json
{
  "idempotency_id": "onboard-abc123",
  "business_name": "My Watch Business",
  "max_transaction_amount": 50000
}
```

**Response:**

```json
{
  "data": {
    "onboarding_url": "https://onboarding.finix.com/form/ONF_xxx",
    "form_id": "ONF_xxx",
    "expires_at": "2025-12-25T10:00:00Z"
  }
}
```

#### 2. User Completes Finix Form

- Redirect user to `onboarding_url`
- User enters business details, bank info, tax ID
- Finix processes KYC verification

#### 3. Finix Webhooks Update Status

Backend receives webhooks:

- `onboarding_form.updated` - Form submitted
- `merchant.created` - Merchant account created
- `merchant.updated` - Status changed to APPROVED/REJECTED

Backend updates `MerchantOnboarding` collection with:

- `identity_id`
- `merchant_id`
- `onboarding_state`
- `verification_state`

#### 4. Check Merchant Status

**Endpoint:** `GET /api/v1/marketplace/merchant/status`

**Response:**

```json
{
  "data": {
    "is_merchant": true,
    "identity_id": "ID_xxx",
    "merchant_id": "MU_xxx",
    "onboarding_state": "APPROVED",
    "verification_state": "SUCCEEDED",
    "onboarded_at": "2025-12-18T10:00:00Z",
    "verified_at": "2025-12-18T12:00:00Z"
  }
}
```

Or use `GET /api/v1/me` which includes:

```json
{
  "data": {
    "onboarding_status": "completed",
    "isMerchant": true,
    "onboarding_state": "APPROVED"
  }
}
```

#### 5. Refresh Expired Link (if needed)

**Endpoint:** `POST /api/v1/marketplace/merchant/onboard/refresh-link`

**Body:**

```json
{
  "idempotency_id": "refresh-abc123"
}
```

---

## Client Implementation

### Web & Mobile: Same Rules

**On App Start:**

```typescript
// 1. Authenticate with Clerk
const { userId, token } = await clerk.authenticate();

// 2. Bootstrap user state
const response = await fetch("/api/v1/me", {
  headers: { Authorization: `Bearer ${token}` },
});
const { data } = await response.json();

// 3. Route based on state
if (data.onboarding_status === "incomplete") {
  navigate("/onboarding");
} else {
  navigate("/app");
}
```

**After Onboarding Completion:**

```typescript
// Submit final acknowledgements
await fetch("/api/v1/onboarding/steps/acknowledgements", {
  method: "PATCH",
  body: JSON.stringify({
    terms_of_service: true,
    privacy_policy: true,
    marketplace_rules: true,
  }),
});

// Refresh and verify
const response = await fetch("/api/v1/me", {
  headers: { "x-refresh-session": "1" },
});
const { data } = await response.json();

if (data.onboarding_status === "completed") {
  navigate("/app");
}
```

**Merchant Onboarding:**

```typescript
// Check if user wants to sell
if (userWantsToSell && !data.isMerchant) {
  // Start merchant onboarding
  const response = await fetch("/api/v1/marketplace/merchant/onboard", {
    method: "POST",
    body: JSON.stringify({
      idempotency_id: generateId(),
      business_name: "My Watch Shop",
      max_transaction_amount: 50000,
    }),
  });

  const { data } = await response.json();

  // Redirect to Finix
  window.location.href = data.onboarding_url;
}

// After returning from Finix, poll status
const checkStatus = async () => {
  const response = await fetch("/api/v1/marketplace/merchant/status");
  const { data } = await response.json();

  if (data.onboarding_state === "APPROVED") {
    // User is now a merchant
    showSellerFeatures();
  } else if (data.onboarding_state === "REJECTED") {
    showRejectionMessage();
  } else {
    // Still processing
    setTimeout(checkStatus, 5000);
  }
};
```

---

## Data Models

### User Collection (MongoDB)

```typescript
{
  _id: ObjectId,
  external_id: string,           // Clerk user ID
  email: string,
  first_name: string,
  last_name: string,
  display_name: string,
  avatar: string,
  location: {
    country: "US" | "CA",
    region: string,
    postal_code: string
  },
  onboarding: {
    status: "incomplete" | "completed",
    completed_at: Date,
    steps: {
      location: { ... },
      display_name: { ... },
      avatar: { ... },
      acknowledgements: { ... }
    }
  }
}
```

### MerchantOnboarding Collection (MongoDB)

```typescript
{
  _id: ObjectId,
  dialist_user_id: ObjectId,     // Reference to User._id
  clerk_id: string,               // Clerk user ID
  form_id: string,                // Finix form ID
  identity_id: string,            // Finix identity ID
  merchant_id: string,            // Finix merchant ID
  onboarding_state: "PENDING" | "PROVISIONING" | "APPROVED" | "REJECTED",
  verification_state: "PENDING" | "SUCCEEDED" | "FAILED",
  onboarded_at: Date,
  verified_at: Date,
  created_at: Date,
  updated_at: Date
}
```

### Clerk JWT Claims (Cache)

```json
{
  "userId": "user_abc123",
  "dialist_id": "mongodb_id",
  "onboarding_status": "completed",
  "display_name": "John Doe",
  "location_country": "US",
  "isMerchant": true,
  "onboarding_state": "APPROVED"
}
```

---

## Summary

**Authentication:**

- Clerk handles sign up/login
- Backend creates user in MongoDB
- Client calls `GET /api/v1/me` to bootstrap

**Platform Onboarding (Required):**

1. Location
2. Display name
3. Avatar
4. Acknowledgements (completes onboarding)

**Merchant Onboarding (Optional):**

1. `POST /api/v1/marketplace/merchant/onboard` → get Finix URL
2. User completes Finix KYC form
3. Finix webhooks update status
4. `GET /api/v1/marketplace/merchant/status` to check approval

**Source of Truth:**

- MongoDB (always correct)
- Clerk JWT (cached, may be stale)
- Always trust `GET /api/v1/me` response
