# Batch 2 Postman Step-by-Step Runbook

This runbook defines a deterministic execution order for Batch 2 Part 1 and Part 2 using the Postman assets in:

- postman/Dialist-API.postman_collection.json
- postman/Dialist-LocalDev.postman_environment.json
- postman/Dialist-Staging.postman_environment.json

## 1) Setup

Required environment values:

- `baseUrl`
- `authMode` (`mock` or `jwt`)

For `mock` mode:

- `mockUser` (recommended: `user_with_networks`)

For `jwt` mode:

- `token` (valid Clerk JWT)

Recommended pre-seeded variables (can be auto-captured during flow):

- `listingId`
- `offerId`
- `orderId`
- `connectionId`
- `targetUserId`
- `notificationId`
- `recentSearchId`

## 2) Required Execution Order

1. Health and Base Checks

- Run health request and ensure API responds.

2. Screen 1 - Home Dashboard

- Run all requests in order.
- This often auto-captures early `offerId` and `orderId` candidates.

3. Screen 2 - Search and Discovery

- Run listings/search requests.
- Ensure `listingId` is captured from results.
- Run recent-search lifecycle and capture `recentSearchId` if present.

4. Screen 3 - Listing Detail and Actions

- Requires `listingId`.
- Run detail -> offer -> listing offers -> inquire -> reserve.
- Verify `offerId`, `channelId`, `orderId` captures.

5. Screen 4 - Offers and Orders

- Requires `offerId` and `orderId`.
- Run offer actions then order actions.

6. Screen 5 - Other User Profile and Connections

- Run incoming/outgoing first to capture `connectionId` and `targetUserId` where available.
- Then run send/accept/reject/remove flows.

7. Screen 6 - Favorites, ISOs, and Profile

- Requires `listingId` for favorite toggles.
- Run profile/reviews/isos/feed/favorite operations.

8. Screen 7 - Notifications

- Run list first to capture `notificationId`.
- Then run single-read and mark-all-read.

9. Screen 8 - Onboarding and Reference Checks

- Run onboarding status/complete and reference-check endpoints.

## 3) Variable Dependency Rules

- `listingId` must exist before listing-action and favorite-action calls.
- `offerId` must exist before counter/accept/reject operations.
- `orderId` must exist before order detail/complete operations.
- `connectionId` must exist before accept/reject operations.
- `notificationId` must exist before single-read operation.

If a variable is missing:

1. Re-run the upstream list endpoint that sets it.
2. Manually set it in environment only if needed for targeted retest.

## 4) Auth Guidance

Local development:

- Prefer `authMode=mock` and `mockUser=user_with_networks` for deterministic runs.

Staging validation:

- Use `authMode=jwt` with a real token.
- Ensure target user has required Batch 2 data (listings, offers, connections) for non-empty flows.

## 5) Pass/Fail Criteria

Pass criteria:

- Endpoint method/path resolves (no 404 from malformed route).
- Response envelope matches expected shape in docs.
- Required dependent variables are captured and reused successfully.

Investigate if any of these occur:

- 400 on valid payload templates
- 401 with known-good auth mode setup
- 409 conflicts in normal non-race execution
- repeated missing capture variables from list endpoints

## 6) Reference Docs

- docs/BATCH_2_PART1_PART2_FINAL_INTEGRATION_GUIDE.md
- docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md
- docs/BATCH_2_API_PAYLOADS.md
