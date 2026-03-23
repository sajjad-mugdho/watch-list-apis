# User Onboarding Final Contract

Status: Frozen baseline
Owner: Backend API team
Last verified: 2026-03-24

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
- location.postal_code
- location.city
- location.line1
- avatar

Avatar rules:

- If type is monogram: monogram_initials, monogram_color, monogram_style required
- If type is upload: url required

Notes:

- Atomic write in a transaction
- Re-completion returns conflict

### PATCH /api/v1/marketplace/onboarding/complete

Required body fields:

- intent (buyer or dealer)
- profile.first_name
- profile.last_name
- location.country (CA or US)
- location.region
- location.postal_code
- location.city
- location.line1
- avatar.type must be upload
- avatar.url
- acknowledgements.marketplace_tos must be true

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
2. bash ./test-onboarding-apis.sh

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
- test-onboarding-apis.sh

## Change Log

### 2026-03-24

- Created frozen onboarding contract document for Networks, Marketplace, and Finix merchant flow.
- Locked baseline request and response expectations.
- Added required validation and test gate checklist.
