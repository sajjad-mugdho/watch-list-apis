# Batch 2 Figma Part-2: Networks Implementation Update

## Objective

Track what was implemented for Batch 2 Part-2 screen alignment under Networks routes, with minimal backend changes and no overengineering.

## Implemented Changes

### 1) Listings and Search filter/sort parity

Implemented in:

- src/networks/models/NetworkListing.ts
- src/validation/schemas.ts
- src/utils/listingFilters.ts
- src/networks/handlers/NetworksListingHandlers.ts
- src/networks/handlers/NetworksSearchHandlers.ts
- src/networks/middleware/normalizeListingQuery.ts
- src/networks/routes/searchRoutes.ts
- src/networks/routes/listingRoutes.ts
- src/utils/watchDataExtraction.ts

What changed:

- Added listing `type` (`for_sale` | `wtb`) to `NetworkListing`.
- Added listing `category` (watch category enum) to `NetworkListing`.
- Added listing text index for relevance search (`title`, `brand`, `model`, `reference`).
- Added listings query filters:
  - `category`
  - `contents`
  - `year_min`, `year_max`
- Added listings sort options:
  - `popularity`
  - `relevance`
- Added unified search support for:
  - `contents`
  - `year_min`, `year_max`
  - `allow_offers`
  - `sort_by=relevance|popularity`
- Added shared query alias normalization middleware for backward compatibility:
  - `min_year/max_year` -> `year_min/year_max`
  - `sort` aliases -> `sort_by/sort_order`
  - `offset` -> `page`
- Added route-level validation for unified search queries.
- Added `category` extraction in watch data utility.

Result:

- Search/filter modal parity is materially improved for Part-2 listing discovery screens.

### 2) Friend requests payload enrichment (members/friends screens)

Implemented in:

- src/networks/handlers/NetworksConnectionHandlers.ts

What changed:

- Incoming friend request response now includes:
  - requester `handle` (derived from display name)
  - requester `mutual_friends_count`

Result:

- Friend-request cards can render richer Figma-like UI data without extra frontend fan-out calls.

### 3) Networks notification persistence foundation

Implemented in:

- src/models/Notification.ts (new)
- src/networks/constants/notificationTypes.ts
- src/networks/services/NotificationService.ts
- src/networks/routes/notificationRoutes.ts
- src/services/connection/ConnectionService.ts
- src/networks/handlers/NetworksOfferHandlers.ts

What changed:

- Added persistent `Notification` model with platform scope (`networks`, `marketplace`) and read state.
- Added explicit notification `category` taxonomy (`buying`, `selling`, `social`, `system`).
- Added canonical type-to-category resolver for stable tab grouping.
- Replaced placeholder `NetworksNotificationService` methods with DB-backed operations:
  - create
  - list (with pagination)
  - unread count
  - total count
  - mark read
  - mark all read
  - delete
- Added notification route query support:
  - `types` (comma-separated)
  - `tab=all|buying|selling|social|system`
- Updated notification list route to return real `total` count.
- Added category-scoped unread and mark-all-read behavior.
- Wired notification creation into:
  - friend request received
  - friend request accepted
  - offer received
  - counter offer

Result:

- Notifications are no longer stub-only and can back Part-2 notification screens with persisted data.

### 4) Part-1 carryover fix completed during Part-2 implementation

Implemented in:

- src/networks/routes/userRoutes.ts

What changed:

- Added `role` filter support to current-user reviews endpoint:
  - `GET /api/v1/networks/user/reviews?role=buyer|seller`

Result:

- Part-1 references tab filter requirement is now directly supported.

## Current API Usage Notes (Frontend)

### Listings endpoint

- `GET /api/v1/networks/listings`
- New filters/sorts:
  - `category`, `contents`, `year_min`, `year_max`
  - `sort_by=relevance|popularity`

### Unified search endpoint

- `GET /api/v1/networks/search`
- New filters/sorts:
  - `category`, `contents`, `year_min`, `year_max`, `allow_offers`
  - `sort_by=relevance|popularity`, `sort_order=asc|desc`
  - Pagination: `page`, `limit`
  - Backward-compatible aliases accepted: `min_year/max_year`, `sort`, `offset`

### Notifications endpoint

- `GET /api/v1/networks/notifications`
- Query options:
  - `unread_only=true|false`
  - `types=offer_received,counter_offer,friend_request_received`
  - `tab=all|buying|selling|social|system`

- `POST /api/v1/networks/notifications/mark-all-read`
  - Optional query: `tab=all|buying|selling|social|system`

## Remaining Gaps (Minimal and Explicit)

1. Search/listings response envelope parity is still split (search pagination shape vs listings metadata shape).

2. Settings screen APIs are mostly cross-domain (`/api/v1/user/*`) and were intentionally not force-migrated into `/api/v1/networks/*`.

## Validation Status

- TypeScript compile check (`npm run type-check`) passes after these changes.
- Full test-suite and route-level integration tests are not yet executed in this update.

## Recommended Next Small Steps

1. Align response envelope shape between `/networks/search` and `/networks/listings`.
2. Add explicit API doc examples for `tab` plus `types` combined filtering.
3. Run targeted integration tests for:
   - `/networks/search`
   - `/networks/listings`
   - `/networks/notifications`
   - `/networks/connections/my-incoming`
