# User Onboarding Final Contract

Status: Frozen baseline  
Owner: Backend API team  
Last verified: 2026-04-02

**Security Update (2026-03-29):** FINIX_WEBHOOK_SECRET now required in production (blocks unsigned webhook forgery)

## Purpose

This file is the source-of-truth contract for user onboarding behavior.
All future onboarding changes must stay aligned with this document.

## Alignment Rules (Must Follow)

1. Do not change onboarding API behavior without updating this file in the same change.
2. Do not change required request fields silently.
3. Keep schema, handlers, and tests aligned to this contract.
4. If behavior changes, update examples, status rules, and error rules here first.

## Scope

This contract covers:

- Networks onboarding
- Marketplace onboarding
- Merchant onboarding (Finix session)
- Finix webhook intake for merchant/payment progression

Not in scope:

- Listings, offers, orders business logic outside onboarding
- General profile updates unrelated to onboarding

## Base URL

- Local: http://localhost:5050/api
- Versioned prefix: /api/v1

## Auth Model

- Platform onboarding and merchant endpoints require authenticated platform user.
- Local testing can use x-test-user header.
- Finix webhook endpoint does not use platform auth; it validates Finix auth and signature.

## Canonical Flow

1. GET /api/v1/networks/onboarding/status
2. PATCH /api/v1/networks/onboarding/complete
3. GET /api/v1/marketplace/onboarding/status
4. PATCH /api/v1/marketplace/onboarding/complete
5. If intent is dealer, merchant session is auto-started best effort.
6. Merchant lifecycle continues via:
   - POST /api/v1/marketplace/merchant/onboard
   - GET /api/v1/marketplace/merchant/status
   - POST /api/v1/marketplace/merchant/onboard/refresh-link

## Endpoint Contract Index

### Networks Onboarding

- GET /api/v1/networks/onboarding/status
- PATCH /api/v1/networks/onboarding/complete

### Marketplace Onboarding

- GET /api/v1/marketplace/onboarding/status
- PATCH /api/v1/marketplace/onboarding/complete

### Merchant (Finix)

- GET /api/v1/marketplace/merchant
- GET /api/v1/marketplace/merchant/profile (alias)
- POST /api/v1/marketplace/merchant/onboard
- GET /api/v1/marketplace/merchant/status
- GET /api/v1/marketplace/merchant/onboard/status (alias)
- POST /api/v1/marketplace/merchant/onboard/refresh-link

### Finix Webhook

- POST /api/v1/marketplace/webhooks/finix

## Request Contracts

### PATCH /api/v1/networks/onboarding/complete

Required body fields:

- profile.first_name
- profile.last_name
- location.country (CA or US)
- location.region
- avatar

Optional location fields:

- location.postal_code
- location.city
- location.line1
- location.line2
- location.currency (USD or CAD when provided)

Avatar rules:

- If type is monogram: monogram_initials, monogram_color, monogram_style required
- If type is upload: url required

Notes:

- Atomic write in a transaction
- Re-completion returns conflict
- Optional location fields may be omitted or sent as empty values; server normalizes empty optional values during validation.

### PATCH /api/v1/marketplace/onboarding/complete

Required body fields:

- intent (buyer or dealer)
- profile.first_name
- profile.last_name
- location.country (CA or US)
- location.region
- location.currency (USD or CAD)
- avatar.type must be upload
- avatar.url
- acknowledgements.marketplace_tos must be true

Optional location fields:

- location.postal_code
- location.city
- location.line1
- location.line2

Notes:

- Atomic write in a transaction
- Re-completion returns conflict
- Dealer intent tries to auto-start merchant onboarding session

### POST /api/v1/marketplace/merchant/onboard

Required body fields:

- idempotency_id

Optional body fields:

- business_name
- max_transaction_amount
- return_url

Precondition:

- Marketplace onboarding status must be completed

### POST /api/v1/marketplace/merchant/onboard/refresh-link

Required body fields:

- idempotency_id

## Body Payload Examples (Copy/Paste)

### 1) Networks user onboarding body

Endpoint:

- PATCH /api/v1/networks/onboarding/complete

Example body (upload avatar):

```json
{
  "profile": {
    "first_name": "John",
    "last_name": "Network"
  },
  "location": {
    "country": "US",
    "region": "California",
    "postal_code": "94102",
    "city": "San Francisco",
    "line1": "123 Market Street",
    "line2": "Suite 100",
    "currency": "USD"
  },
  "avatar": {
    "type": "upload",
    "url": "https://images.example.com/avatar-network.jpg"
  }
}
```

Example body (monogram avatar):

```json
{
  "profile": {
    "first_name": "John",
    "last_name": "Network"
  },
  "location": {
    "country": "US",
    "region": "California",
    "postal_code": "94102",
    "city": "San Francisco",
    "line1": "123 Market Street",
    "currency": "USD"
  },
  "avatar": {
    "type": "monogram",
    "monogram_initials": "JN",
    "monogram_color": "#2563EB",
    "monogram_style": "circle"
  }
}
```

Notes:

- No payment fields in Networks onboarding
- No acknowledgements field in Networks onboarding
- currency is optional; when provided it must be USD or CAD

### 2) Marketplace user onboarding body (buyer)

Endpoint:

- PATCH /api/v1/marketplace/onboarding/complete

Example body:

```json
{
  "intent": "buyer",
  "profile": {
    "first_name": "John",
    "last_name": "Buyer"
  },
  "location": {
    "country": "US",
    "region": "California",
    "postal_code": "94102",
    "city": "San Francisco",
    "line1": "123 Market Street",
    "line2": "Suite 100",
    "currency": "USD"
  },
  "avatar": {
    "type": "upload",
    "url": "https://images.example.com/avatar-buyer.jpg"
  },
  "acknowledgements": {
    "marketplace_tos": true
  }
}
```

### 3) Marketplace user onboarding body (dealer)

Endpoint:

- PATCH /api/v1/marketplace/onboarding/complete

Example body:

```json
{
  "intent": "dealer",
  "profile": {
    "first_name": "Jane",
    "last_name": "Dealer"
  },
  "location": {
    "country": "US",
    "region": "New York",
    "postal_code": "10001",
    "city": "New York",
    "line1": "456 Broadway",
    "line2": "Suite 20",
    "currency": "USD"
  },
  "avatar": {
    "type": "upload",
    "url": "https://images.example.com/avatar-dealer.jpg"
  },
  "acknowledgements": {
    "marketplace_tos": true
  }
}
```

Notes:

- Dealer intent can auto-start merchant onboarding session (best effort)
- currency is required and must be USD or CAD

### 4) Dealer merchant onboard body (Finix session)

Endpoint:

- POST /api/v1/marketplace/merchant/onboard

Minimal body:

```json
{
  "idempotency_id": "dealer-onboard-001"
}
```

Full body example:

```json
{
  "idempotency_id": "dealer-onboard-001",
  "business_name": "Dialist Dealer LLC",
  "max_transaction_amount": 100000,
  "return_url": "https://app.example.com/merchant/onboarding-complete"
}
```

### 5) Dealer merchant refresh-link body

Endpoint:

- POST /api/v1/marketplace/merchant/onboard/refresh-link

Example body:

```json
{
  "idempotency_id": "dealer-refresh-001"
}
```

## Response Contracts

### Networks status response

Includes:

- data.status: incomplete or completed
- data.progress and step confirmations
- data.requires when incomplete
- data.pre_populated when Marketplace completed first and prefill is possible

### Marketplace status response

Includes:

- data.status: incomplete or completed
- data.requires when incomplete
- data.pre_populated when Networks completed first and prefill is possible
- data.intent when completed
- data.user_type: buyer unless merchant onboarding state is APPROVED
- merchant onboarding snippet when record exists

### Merchant onboard response

- 201 when new Finix form created
- 200 when existing form reused
- data.onboarding_url
- data.form_id
- data.expires_at
- data.existing_form on reuse path

### Merchant status response

No merchant record:

- status NOT_STARTED
- is_merchant false

Merchant record exists:

- onboarding_state
- verification_state
- identity_id
- merchant_id
- form_id
- is_merchant true only when onboarding_state is APPROVED

## State Model

### Networks onboarding

- incomplete
- completed

### Marketplace onboarding

- incomplete
- completed
- intent is buyer or dealer after completion

### Merchant onboarding_state

- PENDING
- PROVISIONING
- APPROVED
- REJECTED
- UPDATE_REQUESTED

### Merchant verification_state

- PENDING
- SUCCEEDED
- FAILED

## Error Contract

Common status codes:

- 200 success
- 201 created (new merchant form)
- 400 validation or precondition failure
- 401 unauthorized
- 409 conflict for already completed onboarding

Validation failures return:

- error.message
- error.code
- error.details array for field-level issues

## Behavior Guarantees

1. Networks complete endpoint is atomic.
2. Marketplace complete endpoint is atomic.
3. Merchant onboard is idempotent by required idempotency_id and supports form reuse.
4. Finix webhook intake is idempotent by event id and queues async processing.

## Test Gate For Alignment

Run these checks before merging onboarding changes:

1. npm test -- tests/integration/onboarding.e2e.test.ts tests/integration/auth.me.test.ts tests/integration/bank-tokenization.test.ts tests/integration/finix-debug.test.ts
2. bash ./scripts/test_all_endpoints.sh

Expected baseline:

- Onboarding-focused suites pass
- Smoke script passes Networks, Marketplace buyer/dealer, Merchant onboarding, refresh-link, and error scenarios

## Source Files That Must Stay Aligned

- src/networks/routes/onboardingRoutes.ts
- src/networks/handlers/onboardingHandlers.ts
- src/marketplace/routes/onboardingRoutes.ts
- src/marketplace/handlers/MarketplaceUserHandlers.ts
- src/marketplace/routes/merchantRoutes.ts
- src/marketplace/handlers/MarketplaceMerchantHandlers.ts
- src/marketplace/routes/webhookRoutes.ts
- src/marketplace/handlers/MarketplaceWebhookHandlers.ts
- src/validation/schemas.ts
- src/marketplace/models/MerchantOnboarding.ts
- tests/integration/onboarding.e2e.test.ts
- tests/integration/bank-tokenization.test.ts
- tests/integration/finix-debug.test.ts
- scripts/test_all_endpoints.sh

## Change Log

### 2026-04-02

- Updated Networks onboarding contract: location.currency is optional (still constrained to USD/CAD when provided).
- Clarified optional location normalization behavior so UI can omit non-collected fields without onboarding failure.

### 2026-03-24

- Created frozen onboarding contract document for Networks, Marketplace, and Finix merchant flow.
- Locked baseline request and response expectations.
- Added required validation and test gate checklist.

### 2026-03-27

- Verified Batch 2 non-onboarding API coverage alignment between:
  - docs/BATCH_2_PART1_PART2_FINAL_INTEGRATION_GUIDE.md
  - docs/BATCH_2_NEEDED_FEATURE_APIS_SPEC.md
- Added dedicated non-onboarding Batch 2 API change log file:
  - change-log/batch2-apis.md
- Future Batch 2 API changes must update change-log/batch2-apis.md in the same PR.
- Coverage result (canonical method + path):
  - Guide (non-onboarding): 54
  - Spec: 54
  - Missing: 0
  - Extra: 0

500 status failure:

- Keep previous UI state and show retry path.
- Do not clear local view model on transient 500 failures.

12. Working Rules for the Frontend

- Always send canonical query keys from UI code.
- Treat 409 as a state drift signal and re-fetch.
- Normalize pagination into one internal model per screen.
- Use a shared adapter to map page/limit and limit/offset into the UI paging state.
- Keep route state separate from server entity state.
- For notifications, re-fetch unread count after every read mutation.
- For favorites, prefer Set<string> in UI memory for fast membership checks.
- For offers/orders, always trust the latest server response for terminal state.

13. Excluded From This Spec

The following are intentionally excluded:

- /api/v1/networks/onboarding/status
- /api/v1/networks/onboarding/complete

14. Status Code Summary

- 200: Success -> Render/update UI
- 201: Created -> Store returned entity
- 400: Validation/business error -> Show field or rule message
- 401: Unauthorized -> Redirect to sign-in
- 403: Forbidden -> Show permission denied state
- 404: Not found -> Show empty state or remove stale row
- 409: Conflict -> Re-fetch and reconcile
- 500: Server error -> Keep previous state and retry

15. Canonical Key Reference

- year_min <- min_year (Search, Listings)
- year_max <- max_year (Search, Listings)
- sort_by <- sort (Search, Listings)
- sort_order <- encoded in sort value (Search, Listings)

Note:

- Backend accepts legacy aliases via normalization middleware.
- Frontend should always send canonical keys.
