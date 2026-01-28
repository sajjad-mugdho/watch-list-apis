# 🚀 Quick Start - Testing Finix Implementation

## Prerequisites

- Node.js 18+
- npm or yarn
- Clerk authentication configured
- Finix sandbox credentials

---

## Start Services (2 terminals)

### Terminal 1: Backend API

```bash
cd /home/sajjad-mugdho/Downloads/dialist-api-main

# Install dependencies (first time only)
npm install

# Start development server
npm start

# API available at: http://localhost:5050
# Test: curl http://localhost:5050/health
```

### Terminal 2: Frontend Web App

```bash
cd /home/sajjad-mugdho/clerk-nextjs-app

# Install dependencies (first time only)
npm install

# Start development server
npm run dev

# Frontend available at: http://localhost:3000
# Auto-opens in browser
```

---

## Run Tests

### All Tests (261 tests, ~23 seconds)

```bash
cd /home/sajjad-mugdho/Downloads/dialist-api-main
npm test --silent
```

### Integration Tests Only (31 payment flow tests)

```bash
npm test --silent -- tests/integration/finix-payment-flow.test.ts -i
```

### Debug Endpoint Tests

```bash
npm test --silent -- tests/integration/finix-debug.test.ts -i
```

### Unit Tests Only

```bash
npm test --silent -- tests/unit/finix-utils.test.ts
```

---

## Test Payment Flow

### 1. Navigate to Order Page

```
http://localhost:3000/order
```

### 2. Sign In (if needed)

- Click "Sign In"
- Use Clerk test credentials

### 3. Configure API (if needed)

- Check "API Base URL" shows `http://localhost:5050`
- Click "Load Token" to authenticate

### 4. Load Listings

```
Step 1: Select Listing
├── Click "Load Listings"
├── Browse available items (or create listing first)
└── Click "Reserve" on any listing
```

### 5. Reserve Listing (Auto-proceeds to Step 2)

```
Step 2: Listing Reserved
├── Shows Order ID
├── Shows Fraud Session ID (for Finix tracking)
├── Shows Status: "reserved"
└── Auto-loads payment form after 1 sec (or click "Retry")
```

### 6. Choose Payment Method (Step 3)

Choose one of three methods:

#### Option A: 💳 Token Payment (Production)

```
Select: "💳 Credit Card (Secure)"

Fill in:
├── Postal Code: 94114
├── Address Line 1: 123 Main St
├── Address Line 2: (optional)
├── City: San Francisco
├── State/Region: CA
└── Country: USA

Form shows:
├── Fraud Session ID (copy button)
├── Idempotency ID (copy/regenerate buttons)
├── Buyer Identity ID (copy button)
└── Finix Form Container (auto-initializes)

Submit:
└── Button enabled when form valid ✅
```

#### Option B: 🧪 Card Payment (Sandbox Testing)

```
Select: "🧪 Card (Sandbox)"

Pre-filled with success card:
├── Number: 4895142232120006
├── Exp: 12/29
├── CVV: 123
└── Name: Test Buyer

Fill required fields:
├── Postal Code: 94114
├── Address Line 1: 123 Main St
├── City: San Francisco
└── State/Region: CA

Optional: Change card to test failure scenarios
└── See "Finix Test Data Reference" section for codes
```

#### Option C: 🏦 Bank Transfer (Sandbox Testing)

```
Select: "🏦 Bank Transfer (ACH)"

Select country:
├── 🇺🇸 United States (ACH)
│   ├── Routing Number: 122105278
│   ├── Account Number: 0000000016
│   └── Type: Checking
└── 🇨🇦 Canada (EFT)
    ├── Institution: 001
    ├── Transit: 00002
    ├── Account: 1234567
    └── Type: Checking

Fill address (required):
├── Postal Code: 94114
├── Address Line 1: 123 Main St
├── City: San Francisco
└── Region: CA

See NACHA authorization language ⬇️
```

### 7. Test Specific Scenarios

#### Success Payment

```
Card Method: 🧪 Card
├── Number: 4895142232120006
├── Exp: 12/29
├── CVV: 123
└── Postal: any valid (e.g., 94114)

Expected:
├── ✅ Payment successful
├── Shows amount and order ID
└── Moves to Step 4 (Complete)
```

#### Test: Insufficient Funds

```
Card Method: 🧪 Card
├── Number: 4000000000009995
├── Exp: 12/29
├── CVV: 123
└── Postal: 94114

Expected:
├── ❌ Error displayed
├── Shows "Insufficient Funds"
└── Maps to failure_code
```

#### Test: Generic Decline

```
Card Method: 🧪 Card
├── Number: 4000000000009979
├── Exp: 12/29
├── CVV: 123
└── Postal: 94114

Expected:
├── ❌ Card Declined error
├── Shows failure_code: GENERIC_DECLINE
└── Friendly message shown
```

#### Test: AVS Mismatch

```
Card Method: 🧪 Card
├── Number: 4895142232120006
├── Amount trigger: $1.02
├── Postal: 99999 (wrong)
└── Address: 123 Wrong St

Expected:
├── ❌ Address Mismatch error
├── Shows postal code doesn't match
└── Suggests checking address
```

#### Test: ACH Success

```
Bank Method: 🏦 Bank Transfer
├── Country: United States
├── Routing: 122105278
├── Account: 0000000016
└── Address: valid (e.g., 94114)

Expected:
├── ✅ ACH authorized
├── Shows confirmation language
├── Moves to Step 4
└── Shows ACH confirmation details
```

#### Test: ACH Return (NSF)

```
Bank Method: 🏦 Bank Transfer
├── Routing: 122105278
├── Account: 123120006 (triggers R01 - NSF)
└── Address: valid

Expected:
├── ❌ NSF error
├── Shows "Return: Insufficient funds"
└── Maps to ACH return code
```

### 8. View Finix Debugging

#### Frontend Debug Info

```
Step 3 payment form shows:
├── Fraud Session ID: [FRAUD_SESSION_UUID] (copy button)
├── Idempotency ID: [UUID-xxx] (copy/regenerate buttons)
└── Buyer Identity: ID_xxx (if available)

Dev mode shows:
├── Debug panel at bottom (click to expand)
├── Current state as JSON
├── Form ready status
└── Loading indicator
```

#### Backend Debug Endpoint

```bash
# Get order ID from frontend after payment

curl -X GET http://localhost:5050/api/v1/marketplace/orders/{order_id}/finix-debug \
  -H "Authorization: Bearer {jwt_token}"

# Response shows mock Finix payloads:
# {
#   "createPaymentInstrument": { ... with tags & fraud_session_id ... },
#   "authorize": { ... with fraud_session_id ... },
#   "createTransfer": { ... with tags ... }
# }
```

---

## Test Card Reference (Quick Lookup)

### Success

```
Visa:  4895142232120006  12/29  123
MC:    5420233878140072  12/29  123
Amex:  378282246310005   12/29  1234
```

### Failures by Code

```
Insufficient Funds:  4000000000009995  ↓ 💰
Generic Decline:     4000000000009979  ↓ 💳
Expired:             4000000000000069  ↓ 📅
Fraud:               4000000000000119  ↓ 🚫
```

### Amount-Based Tests

```
$1.02   → AVS Mismatch (wrong postal code)
$1.03   → CVV Mismatch (wrong security code)
$10001+ → May decline on test cards
```

---

## Verify Finix Integration

### Check Tags on Payment Instruments

1. Make payment with token method
2. Go to Finix dashboard
3. Find the PI_xxx created
4. Verify tags:
   - `source_type: tokenized`
   - `token_id: TK_xxx`
   - `created_at: ISO8601`
   - `environment: sandbox`

### Verify Tokenization Flow

1. Watch browser console during payment
2. Look for log: `"✅ Payment Instrument created FROM TOKEN"`
3. Should show TK_xxx creating PI_xxx

### Verify Fraud Tracking

1. Copy fraud_session_id from frontend
2. Check backend logs
3. Verify passed to all Finix operations

### Verify Idempotency

1. Make payment with amount $X
2. Copy idempotency_id
3. Make same payment again with same idempotency_id
4. Should succeed but not duplicate charge
5. Backend detects duplicate and returns same result

---

## Common Issues & Solutions

### Issue: "Not authenticated"

```
Solution: Click "Load Token" in Configuration section
         Wait for JWT to load
         Refresh page if needed
```

### Issue: "No listings available"

```
Solution: Create a listing first via marketplace
         Or check API connection in Configuration
         Verify API URL is http://localhost:5050
```

### Issue: "Reservation expired"

```
Solution: Reservations valid for 2 hours
         Complete payment before expiration
         Or start new order to refresh
```

### Issue: Finix form not loading

```
Solution: Check browser console for errors
         Verify Finix.js script loaded (check Network tab)
         Check browser is allowing external scripts
         Refresh page and try again
```

### Issue: "Address verification failed"

```
Solution: Postal code must be valid (min 5 chars)
         Address line 1, city, region required
         Format must match country (US ZIP vs CA postal)
         Try with postal code 94114 for testing
```

### Issue: Error "Production: token-only"

```
Solution: Only happens if NODE_ENV=production
         Use token method instead of card/bank
         Or set NODE_ENV=development for sandbox testing
```

---

## Check Test Results

### All 261 Tests Pass?

```
✓ 261 passed, 0 failed
✓ 15 test suites passed
✓ ~23 seconds total time

If failures:
- Check database connection
- Verify MongoDB running (for tests)
- Check environment variables set
- Review error output for specific test
```

### Integration Tests (Payment Flows)?

```
✓ 31 tests for payment flows
✓ Token, card, bank, saved instrument paths
✓ AVS/CVV failures
✓ Idempotency checks
✓ Debug endpoint tests
```

### Frontend Running?

```
✓ http://localhost:3000/order accessible
✓ Can sign in with Clerk
✓ Can load listings
✓ Can make payments
✓ Can see Finix integration details
```

---

## Debug Checklist

- [ ] Backend running on 5050
- [ ] Frontend running on 3000
- [ ] Clerk auth working
- [ ] JWT token loads successfully
- [ ] Can load listings
- [ ] Can reserve listing
- [ ] Can select payment method
- [ ] Finix form appears
- [ ] Form accepts card details
- [ ] Form marked ready when valid
- [ ] Payment processes
- [ ] Error codes display correctly
- [ ] Success message shows
- [ ] Step 4 completion screen appears
- [ ] Can start new order

---

## For Finix Certification Reviewer

Provide reviewer access to:

1. **Frontend**: http://your-domain/order
   - Showcases all payment methods
   - Shows fraud_session_id and idempotency
   - Displays error mapping
2. **Backend Debug Endpoint**: `/api/v1/marketplace/orders/{id}/finix-debug`

   - Shows tags on payment instruments
   - Verifies fraud_session_id passed
   - Demonstrates payload structure

3. **Test Cards**: Complete reference in UI

   - Success scenarios
   - Failure scenarios with codes
   - Amount-based tests

4. **Source Code**: Key files for review

   - `src/utils/finix.ts` - API integration
   - `src/handlers/orderHandlers.ts` - Payment flow
   - `src/validation/schemas.ts` - Production enforcement
   - `clerk-nextjs-app/src/app/order/page.tsx` - Frontend UI

5. **Test Results**: 261 passing tests
   - Integration tests for all flows
   - Unit tests for utilities
   - Error mapping coverage

---

## Success Indicators

✅ **Complete**: When you see...

1. Payment form with Finix.js integration
2. Fraud session ID displayed on form
3. Idempotency ID generated
4. Multiple payment methods available
5. Test cards with expected results
6. Address validation working
7. Errors mapped to user messages
8. Step 4 completion screen
9. All 261 tests passing
10. Backend logging token→PI creation

**Status**: System ready for Finix certification review
