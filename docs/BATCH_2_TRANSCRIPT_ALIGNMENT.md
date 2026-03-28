# Batch 2 Transcript vs Code Alignment

Related detailed Figma audit (Part-1): see docs/BATCH_2_FIGMA_PART1_NETWORKS_GAP_ANALYSIS.md.

## Scope

This document compares Batch 2 transcript expectations against implemented Networks APIs in the current codebase.

- Comparison type: transcript vs implemented code only
- No backend changes included here
- Source of truth: mounted routes + handlers + schema/model contracts

## Canonical Base Paths

- Networks APIs: /api/v1/networks/\*
- Current user APIs in Networks: /api/v1/networks/user/\*
- Other user APIs in Networks: /api/v1/networks/users/\*

## Severity Legend

- P0: Integration-breaking mismatch
- P1: Behavioral mismatch or missing convenience endpoint
- P2: Naming/shape mismatch with low implementation risk

## Screen 1 - Dashboard

| Transcript Expectation                                              | Implemented API                                                                      | Status   | Severity | Frontend-safe Replacement                                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/networks/user returns profile/dashboard fields          | GET /api/v1/networks/user returns minimal payload { data: { platform: "networks" } } | Mismatch | P0       | Use GET /api/v1/networks/user/dashboard/stats for dashboard cards and onboarding; treat /user as platform ping only |
| GET dashboard stats endpoint under /api/v1/networks/dashboard/stats | Mounted endpoint is GET /api/v1/networks/user/dashboard/stats                        | Partial  | P1       | Call GET /api/v1/networks/user/dashboard/stats                                                                      |
| My listings are fetched from user-scoped listing endpoint           | GET /api/v1/networks/user/listings with status/search/sort/page/limit                | Match    | -        | Keep using GET /api/v1/networks/user/listings                                                                       |

## Screen 2 - Search and Discovery

| Transcript Expectation                                                       | Implemented API                                                                                            | Status   | Severity | Frontend-safe Replacement                         |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- | -------- | ------------------------------------------------- |
| Search sort supports transcript values (for example recent/popular defaults) | GET /api/v1/networks/search uses sort in { newest, priceAsc, priceDesc } (default newest)                  | Mismatch | P1       | Map UI sort to newest, priceAsc, priceDesc        |
| Search type values listing/iso/user                                          | GET /api/v1/networks/search supports type in { listing, iso, user }                                        | Match    | -        | Keep using type listing/iso/user                  |
| Recent search context supports plural/multi labels                           | RecentSearch context enum is singular { listing, iso, user }                                               | Mismatch | P1       | Send singular context only: listing, iso, or user |
| Recent searches endpoints are available under current user scope             | GET/POST/DELETE /api/v1/networks/user/searches/recent and DELETE /api/v1/networks/user/searches/recent/:id | Match    | -        | Keep using these routes                           |

## Screen 3 - Listing Detail

| Transcript Expectation                               | Implemented API                              | Status   | Severity | Frontend-safe Replacement                             |
| ---------------------------------------------------- | -------------------------------------------- | -------- | -------- | ----------------------------------------------------- |
| Listing counters returned as offer_count / views     | Model fields are offers_count and view_count | Mismatch | P2       | Read offers_count and view_count from listing payload |
| Offer action endpoint on listing detail              | POST /api/v1/networks/listings/:id/offers    | Match    | -        | Keep using POST /api/v1/networks/listings/:id/offers  |
| Inquiry action endpoint creates user-to-user channel | POST /api/v1/networks/listings/:id/inquire   | Match    | -        | Keep using POST /api/v1/networks/listings/:id/inquire |
| Reserve (buy now) action endpoint                    | POST /api/v1/networks/listings/:id/reserve   | Match    | -        | Keep using POST /api/v1/networks/listings/:id/reserve |

## Screen 4 - Offers and Orders

| Transcript Expectation                     | Implemented API                                                | Status   | Severity | Frontend-safe Replacement                     |
| ------------------------------------------ | -------------------------------------------------------------- | -------- | -------- | --------------------------------------------- |
| Orders list query type uses buying/selling | GET /api/v1/networks/orders uses type in { buy, sell }         | Mismatch | P0       | Convert UI values to buy or sell              |
| Complete order uses PATCH                  | Complete endpoint is POST /api/v1/networks/orders/:id/complete | Mismatch | P1       | Use POST /api/v1/networks/orders/:id/complete |
| Order detail route under networks orders   | GET /api/v1/networks/orders/:id                                | Match    | -        | Keep using GET /api/v1/networks/orders/:id    |

## Screen 5 - User Profile

| Transcript Expectation                                 | Implemented API                                                                    | Status   | Severity | Frontend-safe Replacement                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------- | -------- | ----------------------------------------------------------- |
| Other user profile under /api/v1/networks/user/:id/... | Other user routes are under /api/v1/networks/users/:id/...                         | Mismatch | P1       | Use /api/v1/networks/users/:id/profile, /listings, /reviews |
| Connection relationship status endpoint naming differs | Implemented endpoint is GET /api/v1/networks/users/:id/connection-status           | Partial  | P1       | Use /api/v1/networks/users/:id/connection-status            |
| Other user listings/reviews available                  | GET /api/v1/networks/users/:id/listings and GET /api/v1/networks/users/:id/reviews | Match    | -        | Keep using these routes                                     |

## Screen 6 - Favorites

| Transcript Expectation                                           | Implemented API                                                         | Status  | Severity | Frontend-safe Replacement                                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- | ------- | -------- | -------------------------------------------------------------------------------- |
| Favorites check shortcut endpoint (for example /favorites/check) | No dedicated check endpoint is mounted                                  | Missing | P1       | Fetch list via GET /api/v1/networks/user/favorites and resolve state client-side |
| Toggle/remove by single item id route                            | Remove route is typed: DELETE /api/v1/networks/user/favorites/:type/:id | Partial | P1       | Use item type and id on delete route                                             |
| Add/list favorites under current user scope                      | GET/POST /api/v1/networks/user/favorites                                | Match   | -        | Keep using GET/POST /api/v1/networks/user/favorites                              |

## Screen 7 - Notifications

| Transcript Expectation                                                 | Implemented API                                                                                                            | Status   | Severity | Frontend-safe Replacement                                  |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ---------------------------------------------------------- |
| Notifications under /api/v1/user/notifications with full functionality | /api/v1/user/notifications is deprecated info router only                                                                  | Mismatch | P0       | Use /api/v1/networks/notifications routes directly         |
| Mark read / mark all read use PATCH semantics                          | Implemented methods are POST /api/v1/networks/notifications/:id/read and POST /api/v1/networks/notifications/mark-all-read | Mismatch | P0       | Update client calls to POST methods                        |
| Unread count endpoint exists                                           | GET /api/v1/networks/notifications/unread-count                                                                            | Match    | -        | Keep using GET /api/v1/networks/notifications/unread-count |

## Michael Escalation Summary

### P0 (fix first)

1. Notifications route family mismatch: transcript references deprecated /api/v1/user/notifications patterns.
2. Notifications method mismatch: transcript PATCH vs implemented POST for read actions.
3. Orders query enum mismatch: transcript buying/selling vs implemented buy/sell.
4. /api/v1/networks/user payload assumption mismatch: endpoint is minimal and not a profile payload.

### P1 (important)

1. Search sort values do not match transcript assumptions.
2. Other-user path namespace should be /users/:id (not /user/:id).
3. Favorites convenience/check endpoint is not implemented.
4. Favorites delete requires both type and id.

### P2 (polish)

1. Listing metrics field names are offers_count and view_count, not transcript aliases.

## Evidence Files

- src/networks/index.ts
- src/networks/routes/userRoutes.ts
- src/networks/routes/usersRoutes.ts
- src/networks/routes/listingRoutes.ts
- src/networks/routes/searchRoutes.ts
- src/networks/routes/orderRoutes.ts
- src/networks/routes/notificationRoutes.ts
- src/routes/user/notifications.ts
- src/networks/handlers/NetworksUserHandlers.ts
- src/networks/handlers/NetworksDashboardHandlers.ts
- src/networks/handlers/NetworksSearchHandlers.ts
- src/networks/models/NetworkListing.ts
- src/models/RecentSearch.ts
