# Subscriptions API

## Overview

The subscription system manages user tier plans with Finix payment integration. Users can upgrade from free to paid tiers to unlock additional features.

---

## Authentication
All endpoints require `Authorization: Bearer <token>` header with a valid Clerk JWT.

## Base Endpoint
`/api/v1/subscriptions`

---

## Subscription Tiers

| Tier | Monthly Price | Yearly Price | Max Listings | Max ISOs | Features |
|------|--------------|--------------|--------------|----------|----------|
| **Free** | $0 | $0 | 3 | 2 | Chat |
| **Basic** | $9.99 | $99.99 | 10 | 5 | Chat + Analytics |
| **Premium** | $24.99 | $249.99 | 50 | 20 | + Priority Support |
| **Enterprise** | $99.99 | $999.99 | Unlimited | Unlimited | + Custom Branding |

---

## Endpoints

### **1. Get Current Subscription**
Retrieve the current user's subscription details.

```http
GET /api/v1/subscriptions/current
```

**Response:**
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "user_id": "507f1f77bcf86cd799439012",
    "clerk_id": "user_abc123",
    "tier": "basic",
    "status": "active",
    "billing_cycle": "monthly",
    "price_cents": 999,
    "currency": "USD",
    "current_period_start": "2026-01-06T00:00:00Z",
    "current_period_end": "2026-02-06T00:00:00Z",
    "cancel_at_period_end": false,
    "createdAt": "2026-01-06T00:00:00Z",
    "updatedAt": "2026-01-06T00:00:00Z",
    "tier_info": {
      "name": "Basic",
      "price_monthly": 999,
      "price_yearly": 9999,
      "features": {
        "max_listings": 10,
        "max_iso": 5,
        "chat_enabled": true,
        "analytics_enabled": true
      }
    },
    "is_active": true,
    "is_paid": true,
    "features": {
      "max_listings": 10,
      "max_iso": 5,
      "chat_enabled": true,
      "analytics_enabled": true
    }
  }
}
```

**Note:** If no subscription exists, a free tier subscription is automatically created.

---

### **2. Get Available Tiers**
List all available subscription tiers with pricing and features.

```http
GET /api/v1/subscriptions/tiers
```

**Response:**
```json
{
  "data": [
    {
      "id": "free",
      "name": "Free",
      "price_monthly": 0,
      "price_yearly": 0,
      "features": {
        "max_listings": 3,
        "max_iso": 2,
        "chat_enabled": true,
        "analytics_enabled": false
      }
    },
    {
      "id": "basic",
      "name": "Basic",
      "price_monthly": 999,
      "price_yearly": 9999,
      "features": {
        "max_listings": 10,
        "max_iso": 5,
        "chat_enabled": true,
        "analytics_enabled": true
      }
    },
    {
      "id": "premium",
      "name": "Premium",
      "price_monthly": 2499,
      "price_yearly": 24999,
      "features": {
        "max_listings": 50,
        "max_iso": 20,
        "chat_enabled": true,
        "analytics_enabled": true,
        "priority_support": true
      }
    },
    {
      "id": "enterprise",
      "name": "Enterprise",
      "price_monthly": 9999,
      "price_yearly": 99999,
      "features": {
        "max_listings": -1,
        "max_iso": -1,
        "chat_enabled": true,
        "analytics_enabled": true,
        "priority_support": true,
        "custom_branding": true
      }
    }
  ]
}
```

**Note:** `-1` in max_listings/max_iso means unlimited.

---

### **3. Upgrade Subscription**
Upgrade to a higher tier.

```http
POST /api/v1/subscriptions/upgrade
Content-Type: application/json

{
  "tier": "premium",
  "billing_cycle": "yearly",
  "payment_instrument_id": "PI_abc123xyz"
}
```

**Request Body:**
- `tier` (string, required): Target tier (`basic`, `premium`, or `enterprise`)
- `billing_cycle` (string, optional): `monthly` or `yearly` (default: `monthly`)
- `payment_instrument_id` (string, optional): Finix payment instrument ID

**Response:**
```json
{
  "message": "Subscription upgraded successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "tier": "premium",
    "billing_cycle": "yearly",
    "price_cents": 24999,
    "status": "active",
    "current_period_start": "2026-01-06T00:00:00Z",
    "current_period_end": "2027-01-06T00:00:00Z",
    "tier_info": {
      "name": "Premium",
      "features": {
        "max_listings": 50,
        "max_iso": 20,
        "chat_enabled": true,
        "analytics_enabled": true,
        "priority_support": true
      }
    },
    "is_active": true,
    "features": {
      "max_listings": 50,
      "max_iso": 20,
      "chat_enabled": true,
      "analytics_enabled": true,
      "priority_support": true
    }
  }
}
```

**Rules:**
- Can only upgrade to higher tiers
- Cannot "upgrade" to free tier (use downgrade/cancel)
- Billing immediately starts new period

**Error Responses:**
- `400` - Invalid tier, not an upgrade, or invalid billing cycle

**TODO Integration:**
The endpoint currently updates the database directly. Full Finix payment integration for:
- Creating authorization with payment instrument
- Capturing payment
- Setting up recurring billing

---

### **4. Cancel Subscription**
Cancel subscription at the end of the current billing period.

```http
POST /api/v1/subscriptions/cancel
```

**Response:**
```json
{
  "message": "Subscription will be cancelled at period end",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "tier": "premium",
    "status": "active",
    "cancel_at_period_end": true,
    "cancelled_at": "2026-01-06T05:00:00Z",
    "current_period_end": "2027-01-06T00:00:00Z",
    "cancellation_effective_date": "2027-01-06T00:00:00Z"
  }
}
```

**Behavior:**
- Subscription remains active until `current_period_end`
- No refunds for remaining time
- User keeps paid features until period ends
- After period end, automatically downgrades to free tier

**Rules:**
- Cannot cancel free tier
- Cannot cancel already-cancelled subscription

**Error Responses:**
- `400` - Free tier or already cancelled
- `404` - No subscription found

---

### **5. Reactivate Subscription**
Reactivate a cancelled subscription before the period ends.

```http
POST /api/v1/subscriptions/reactivate
```

**Response:**
```json
{
  "message": "Subscription reactivated",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "tier": "premium",
    "status": "active",
    "cancel_at_period_end": false,
    "cancelled_at": null,
    "current_period_end": "2027-01-06T00:00:00Z"
  }
}
```

**Rules:**
- Can only reactivate if period hasn't ended
- Removes cancellation flag
- Resumes normal billing

**Error Responses:**
- `400` - Not set to cancel or period has ended
- `404` - No subscription found

---

### **6. Update Payment Method**
Update the payment instrument for recurring billing.

```http
PUT /api/v1/subscriptions/payment-method
Content-Type: application/json

{
  "payment_instrument_id": "PI_new123xyz"
}
```

**Request Body:**
- `payment_instrument_id` (string, required): New Finix payment instrument ID

**Response:**
```json
{
  "message": "Payment method updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "finix_instrument_id": "PI_new123xyz",
    "updatedAt": "2026-01-06T06:00:00Z"
  }
}
```

**TODO Integration:**
Currently stores the ID. Full integration would:
- Verify instrument with Finix
- Check instrument validity
- Update Finix merchant settings

**Error Responses:**
- `400` - Missing payment_instrument_id
- `404` - No subscription found

---

## Subscription Status Values

| Status | Description |
|--------|-------------|
| `active` | Subscription is active and in good standing |
| `cancelled` | Period ended, downgraded to free |
| `past_due` | Payment failed, requires attention |
| `expired` | Subscription expired |
| `trial` | In trial period (future use) |

---

## Feature Access

Use the subscription features object to gate functionality:

```javascript
const { features } = subscription;

// Check listing limit
if (userListings.length >= features.max_listings && features.max_listings !== -1) {
  throw new Error('Max listings reached for your tier');
}

// Check ISO limit
if (userISOs.length >= features.max_iso && features.max_iso !== -1) {
  throw new Error('Max ISOs reached for your tier');
}

// Check analytics access
if (!features.analytics_enabled) {
  throw new Error('Analytics requires Basic tier or higher');
}
```

---

## Billing Cycles

### Monthly
- Billed every month
- Period: 30 days
- Lower commitment
- Higher total cost

### Yearly
- Billed annually
- Period: 365 days
- ~17% discount vs monthly
- Lower effective monthly cost

**Example:**
- Premium Monthly: $24.99/month = $299.88/year
- Premium Yearly: $249.99/year (saves ~$50)

---

## Example Workflows

### Upgrade to Paid Tier
```bash
# 1. Check current subscription
GET /api/v1/subscriptions/current

# 2. View available tiers
GET /api/v1/subscriptions/tiers

# 3. Upgrade to premium
POST /api/v1/subscriptions/upgrade
{
  "tier": "premium",
  "billing_cycle": "yearly",
  "payment_instrument_id": "PI_abc123"
}
```

### Cancel and Reactivate
```bash
# 1. Cancel subscription
POST /api/v1/subscriptions/cancel

# 2. Change your mind
POST /api/v1/subscriptions/reactivate
```

### Update Payment Method
```bash
# 1. Get new payment instrument from Finix
# (via Finix.js CardTokenForm or BankTokenForm)

# 2. Update subscription
PUT /api/v1/subscriptions/payment-method
{
  "payment_instrument_id": "PI_new456"
}
```

---

## Finix Integration Notes

### Payment Instruments
Payment instruments are created via:
1. Finix.js CardTokenForm (frontend)
2. Finix.js BankTokenForm (frontend)
3. Returns payment token
4. Backend creates payment instrument
5. Store `instrument_id` in subscription

### Recurring Billing
**Current State:** Manual upgrade/downgrade
**TODO:** Implement:
- Automatic billing at period end
- Retry logic for failed payments
- Webhook handling for payment events
- Grace periods for past_due status

### Webhook Events
Handle these Finix webhooks for subscriptions:
- `transfer.succeeded` - Payment captured
- `transfer.failed` - Payment failed
- `authorization.succeeded` - Pre-auth successful
- `authorization.failed` - Pre-auth failed

---

## Migration & Downgrade

### Downgrade Behavior
When a user cancels or downgrades:

1. **Immediate Effects:**
   - `cancel_at_period_end` set to `true`
   - `cancelled_at` timestamp recorded
   - Status remains `active`

2. **At Period End:**
   - Status changes to `cancelled`
   - Tier changes to `free`
   - Features limited to free tier

3. **Exceeding Limits:**
   - Existing content stays
   - Cannot create new content beyond free limits
   - Example: Premium user with 30 listings downgrades to Free
     - All 30 listings remain visible
     - Cannot create 4th listing (Free limit: 3)

### Upgrade Behavior
When upgrading:
- Immediate access to new features
- New period starts immediately
- Pro-rated credit not implemented (TODO)
