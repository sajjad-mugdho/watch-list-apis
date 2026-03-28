# Batch 2 Screen-by-Screen API Implementation Guides

Home Dashboard — Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Networks Dashboard, Networks Offers, Networks Orders, User Profile, User Verification, Support Tickets Count, News
Depends On: Auth (x-test-user or JWT), User record mapped by external_id, Networks domain services

---

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  User sees home summary cards, verification state, quick actions, and live content.
- When does it start?
  When the Networks home dashboard screen is opened.
- When does it end?
  After dashboard cards and quick-access widgets are fully rendered.
- Any important constraints (atomic, async, multi-step, etc.)
  Multi-call async composition; no single aggregate endpoint currently exists.

---

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- User is authenticated and resolved to a DB User.
- Networks onboarding is at least partially initialized.
- Backend services for offers/orders/support/news are reachable.

---

3. FLOW SUMMARY

High-level step sequence:

<Home Screen Open>
  -> Step 1: Load dashboard stats
  -> Step 2: Load profile + verification
  -> Step 3: Load quick-access counts and cards
  -> Final Action -> Render complete dashboard state

---

4. API CALLS USED

4.1 Dashboard Metrics
GET /api/v1/networks/user/dashboard/stats

Used for:

- Initial dashboard cards
- Onboarding progress card

  4.2 Profile and Verification
  GET /api/v1/user/profile
  GET /api/v1/user/verification

Used for:

- Header identity and avatar
- Verification badge state

  4.3 Quick Access Data
  GET /api/v1/networks/offers?type=received&status=active&limit=20&offset=0
  GET /api/v1/networks/orders?type=buy&status=reserved&limit=20&offset=0
  GET /api/v1/user/support/tickets/count/open
  GET /api/v1/news?limit=10
  GET /api/v1/networks/social/inbox?filter=inquiries&limit=20&offset=0

Used for:

- Offers, orders, tickets, news, and inquiries quick widgets

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

---

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:

- Keep per-widget loading states to avoid blocking whole screen.
- Treat each API as independently recoverable.
- Compute quick counts from list payloads where no dedicated count API exists.

Example:

```ts
type HomeDashboardState = {
  stats: any | null;
  profile: any | null;
  verification: any | null;
  offersCount: number;
  reservedOrdersCount: number;
  inquiriesCount: number;
  openTicketsCount: number;
  news: any[];
  loading: boolean;
  errors: Record<string, string | null>;
};
```

---

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User enters Home Dashboard

Behavior:

- Fire dashboard, profile, verification first.
- Fire quick-access and news calls in parallel.
- Merge responses into a single UI state model.

Example:

```ts
await Promise.all([
  api.get("/api/v1/networks/user/dashboard/stats"),
  api.get("/api/v1/user/profile"),
  api.get("/api/v1/user/verification"),
  api.get("/api/v1/networks/offers", {
    params: { type: "received", status: "active", limit: 20, offset: 0 },
  }),
  api.get("/api/v1/networks/orders", {
    params: { type: "buy", status: "reserved", limit: 20, offset: 0 },
  }),
  api.get("/api/v1/user/support/tickets/count/open"),
  api.get("/api/v1/news", { params: { limit: 10 } }),
]);
```

---

7. SUCCESS HANDLING

On successful response:

- Populate all dashboard cards.
- Show verification state in header.
- Render quick-access counts and fallback to 0 when arrays are empty.
- Navigate to Home steady state.

---

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show card-level fallback and continue other cards.
401 -> Redirect to auth gate.
403 -> Show restricted-access state.
404 -> For optional cards (news/tickets), render empty state.
409 -> Not typical in this read flow; log and continue.
500 -> Show retry CTA per widget.

---

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Partial API Success

- Description: Some widgets load and others fail.
- Expected behavior: Keep successful widgets visible, show inline retry only on failed widgets.

  9.2 Empty Offer/Order Arrays

- Description: New user has no offers or orders.
- Expected behavior: Show zero-state counts and onboarding hints.

  9.3 User Not Found via attachUser

- Description: Mock auth exists but User.external_id is missing.
- Expected behavior: Surface controlled error and suggest seed/mock-user mapping.

---

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

```ts
type DashboardStatsPayload = {
  data: {
    stats: {
      listings: { active: number };
      offers: { pending: number };
      isos: { active: number };
      reference_checks: { pending: number };
      social: { followers: number; following: number };
      verified_dealers_global: number;
    };
    onboarding: {
      completed_count: number;
      total_count: number;
      percentage: number;
      items: any[];
    };
    user: {
      verification_status: string;
      rating: { average: number; count: number };
    };
  };
};
```

---

11. STATE TRANSITIONS

loading -> partially_loaded -> ready

Rules:

- Dashboard is considered ready when mandatory blocks (stats/profile/verification) are loaded.
- Optional widgets can fail without blocking ready state.

---

Search Landing — Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Networks Search, Popular Brands, Recent Searches
Depends On: Auth, Search indexing, Recent search persistence

---

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  User enters query context, explores top brands, and resumes recent searches.
- When does it start?
  On Search landing screen open.
- When does it end?
  When user executes a query or resumes a recent search.
- Any important constraints (atomic, async, multi-step, etc.)
  Query context must use singular enum values: listing, iso, user.

---

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- User auth is valid.
- Search endpoint is reachable.
- Recent search storage is available.

---

3. FLOW SUMMARY

High-level step sequence:

<Search Screen Open>
  -> Step 1: Load recent searches
  -> Step 2: Load popular brands
  -> Step 3: User enters query and selects tab
  -> Final Action -> Trigger search request

---

4. API CALLS USED

4.1 Recent Search Retrieval
GET /api/v1/networks/user/searches/recent

Used for:

- Initial landing history list

  4.2 Popular Brand Chips
  GET /api/v1/networks/search/popular-brands

Used for:

- Quick chips and discovery shortcuts

  4.3 Save Recent Search
  POST /api/v1/networks/user/searches/recent

Used for:

- Persisting successful/intentful query actions

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

---

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:

- Keep selected tab mapped to type=listing|iso|user.
- Keep recent search list normalized by id.
- Save search only when query is meaningful.

Example:

```ts
type SearchLandingState = {
  tab: "listing" | "iso" | "user";
  query: string;
  recent: Array<{ _id: string; query: string; context: string }>;
  popularBrands: Array<{ brand: string; count: number }>;
};
```

---

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User clicks Search or brand chip

Behavior:

- Build query with canonical keys.
- Send GET search call.
- Save recent search asynchronously.

Example:

```ts
await api.get("/api/v1/networks/search", {
  params: { type: tab, q: query, page: 1, limit: 10 },
});
await api.post("/api/v1/networks/user/searches/recent", {
  query,
  context: tab,
  filters: {},
  result_count: 0,
});
```

---

7. SUCCESS HANDLING

On successful response:

- Navigate to search results screen.
- Refresh recent list.
- Keep selected tab persistent.
- Navigate to Results route with query params.

---

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show query validation hint.
401 -> Redirect to auth.
403 -> Show permission message.
404 -> Show no-result empty state.
409 -> Not common; retry safe.
500 -> Show retry toast and keep user input.

---

9. EDGE CASES

9.1 Empty Query

- Description: User submits blank/whitespace text.
- Expected behavior: Prevent call and prompt input.

  9.2 Large Recent List

- Description: Many stored entries.
- Expected behavior: Client caps display and supports clear-all.

  9.3 Unsupported Context

- Description: UI uses plural enum accidentally.
- Expected behavior: Force singular mapping before POST recent search.

---

10. DATA CONTRACT (OPTIONAL)

```ts
type RecentSearchCreate = {
  query: string;
  context: "listing" | "iso" | "user";
  filters?: Record<string, any>;
  result_count?: number;
};
```

---

11. STATE TRANSITIONS

idle -> searching -> results_loaded

Rules:

- Do not transition to results_loaded on network error.
- Keep user query sticky through failures.

---

Search Results (Grid/List) — Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Networks Search, Networks Listings, Favorites, Recent Searches
Depends On: Auth, listing filters/sort normalization

---

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  User filters/sorts for-sale inventory and toggles favorites from results.
- When does it start?
  After a search submission or filter/sort change.
- When does it end?
  When result set and metadata are rendered.
- Any important constraints (atomic, async, multi-step, etc.)
  /search and /listings return different envelopes; client adapter required.

---

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Valid search type and query state.
- Filters within supported values.
- User session valid for favorite actions.

---

3. FLOW SUMMARY

High-level step sequence:

<Query/Filter Change>
-> Step 1: Call /search or /listings
-> Step 2: Normalize response shape
-> Step 3: Render cards/list rows
-> Final Action -> Optional favorite toggle actions

---

4. API CALLS USED

4.1 Search-Based Results
GET /api/v1/networks/search

Used for:

- Mixed-type discovery
- Search tab flows

  4.2 Listing-Focused Results
  GET /api/v1/networks/listings

Used for:

- Rich listing filters and sorting

  4.3 Favorite Controls
  GET /api/v1/networks/user/favorites
  POST /api/v1/networks/user/favorites
  DELETE /api/v1/networks/user/favorites/:type/:id

Used for:

- Display and update favorite state

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

---

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:

- Maintain canonical filter keys (year_min/year_max, sort_by/sort_order).
- Normalize search/listings payload to one view model.
- Maintain optimistic favorite state with rollback.

Example:

```ts
type ResultsState = {
  items: any[];
  paging: { total: number; page?: number; limit: number; offset?: number };
  filters: Record<string, any>;
  favorites: Set<string>;
};
```

---

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User changes filter, sort, tab, view mode, or favorite action

Behavior:

- Debounce filter updates.
- Call endpoint with canonical query keys.
- Persist recent search if query changed.

Example:

```ts
await api.get("/api/v1/networks/listings", {
  params: {
    page: 1,
    limit: 20,
    sort_by: "relevance",
    allow_offers: true,
    year_min: 2020,
    year_max: 2025,
    contents: "box",
  },
});
```

---

7. SUCCESS HANDLING

On successful response:

- Render result cards/rows.
- Show total count and pagination controls.
- Keep applied filters visible.
- Stay on current results route.

---

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show invalid filter message.
401 -> Redirect to auth.
403 -> Show access denial.
404 -> Render empty results state.
409 -> Retry with latest filters.
500 -> Keep filters and show retry button.

---

9. EDGE CASES

9.1 Alias Parameters in Deep Links

- Description: Incoming links use legacy min_year/max_year.
- Expected behavior: Convert to canonical keys before dispatch.

  9.2 Empty Favorites Set

- Description: No favorites for user.
- Expected behavior: Render non-favorited state without extra errors.

  9.3 Mixed Result Types

- Description: Search returns listings, users, and isos.
- Expected behavior: Tab-specific rendering with strict adapters.

---

10. DATA CONTRACT (OPTIONAL)

```ts
type ListingFilterPayload = {
  page: number;
  limit: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  allow_offers?: boolean;
  year_min?: number;
  year_max?: number;
  contents?: string;
};
```

---

11. STATE TRANSITIONS

results_loading -> results_ready -> favorite_mutating

Rules:

- Preserve results_ready while favorite_mutating.
- Roll back favorite state on mutation failure.

---

Listing Detail and Actions — Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Listing Detail, Send Offer, Listing Offers, Inquire, Reserve
Depends On: Auth, valid listingId, listing status and ownership constraints

---

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  User inspects a listing and takes action: offer, inquiry, or reserve.
- When does it start?
  On listing card click from results/feed.
- When does it end?
  When action response is reflected in UI and channel/order state is updated.
- Any important constraints (atomic, async, multi-step, etc.)
  Some actions are status-constrained; edit is draft-only; reserve requires active listing.

---

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- listingId is available.
- User is authenticated and not owner for buyer actions.
- Listing status supports selected action.

---

3. FLOW SUMMARY

High-level step sequence:

<Listing Open>
  -> Step 1: Load listing details
  -> Step 2: User chooses offer/inquire/reserve
  -> Step 3: Execute action API
  -> Final Action -> Update channel/order state and CTA buttons

---

4. API CALLS USED

4.1 Listing View
GET /api/v1/networks/listings/:id

Used for:

- Initial detail render

  4.2 Negotiation and Inquiry
  POST /api/v1/networks/listings/:id/offers
  GET /api/v1/networks/listings/:id/offers
  POST /api/v1/networks/listings/:id/inquire

Used for:

- Offer lifecycle and message channel creation

  4.3 Buy Now
  POST /api/v1/networks/listings/:id/reserve

Used for:

- Direct reservation order creation

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

---

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:

- Keep listing snapshot immutable during action submission.
- Lock CTA buttons while mutation in flight.
- Store returned channel_id or orderId for navigation.

Example:

```ts
type ListingDetailState = {
  listing: any | null;
  submitting: "offer" | "inquiry" | "reserve" | null;
  channelId?: string;
  orderId?: string;
};
```

---

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User taps Make Offer, Inquire, or Buy Now

Behavior:

- Validate client-side preconditions.
- Submit payload.
- Persist returned IDs to local state and environment (QA).

Example:

```ts
await api.post(`/api/v1/networks/listings/${listingId}/offers`, {
  amount: 5800,
  message: "Can close today",
  shipping_region: "US",
  request_free_shipping: false,
});
```

---

7. SUCCESS HANDLING

On successful response:

- Show confirmation toast.
- Update CTA state from response.
- Store channel/order reference.
- Navigate to offers or order detail when appropriate.

---

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show validation message (own listing, invalid amount, unsupported shipping region).
401 -> Redirect to auth.
403 -> Show unauthorized action.
404 -> Show listing unavailable state.
409 -> Show listing already reserved/conflict state.
500 -> Retry CTA with preserved user inputs.

---

9. EDGE CASES

9.1 Listing Becomes Reserved During Viewing

- Description: Status changes between load and action submit.
- Expected behavior: Refresh listing and disable invalid actions.

  9.2 Existing User-to-User Channel

- Description: Inquire call reuses existing channel.
- Expected behavior: Reuse channel ID, do not duplicate chat threads.

  9.3 Draft-Only Edit Rule

- Description: User attempts to patch active listing.
- Expected behavior: Show draft-only constraint message.

---

10. DATA CONTRACT (OPTIONAL)

```ts
type OfferCreatePayload = {
  amount: number;
  message?: string;
  shipping_region?: string;
  request_free_shipping?: boolean;
};
```

---

11. STATE TRANSITIONS

detail_loaded -> action_submitting -> action_committed

Rules:

- Only one listing action can be in-flight at a time.
- On failure, return to detail_loaded with preserved form values.

---

Offers and Orders — Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Offers list/detail/counter/accept/reject, Orders list/detail/complete
Depends On: Auth, offerId/orderId chaining, order status constraints

---

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  User manages negotiations and confirms transaction completion.
- When does it start?
  On Offers or Orders screen open.
- When does it end?
  When desired negotiation/order state transition is saved.
- Any important constraints (atomic, async, multi-step, etc.)
  Completion uses dual confirmation; both buyer and seller must confirm.

---

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Valid authenticated user.
- Existing offer channel or order.
- Order is in confirmable status for completion.

---

3. FLOW SUMMARY

High-level step sequence:

<Offers/Orders Open>
-> Step 1: Load list
-> Step 2: Open detail
-> Step 3: Counter/accept/reject/complete action
-> Final Action -> Refresh list and detail state

---

4. API CALLS USED

4.1 Offer Operations
GET /api/v1/networks/offers
GET /api/v1/networks/offers/:id
POST /api/v1/networks/offers/:id/counter
POST /api/v1/networks/offers/:id/accept
POST /api/v1/networks/offers/:id/reject

Used for:

- Negotiation lifecycle

  4.2 Order Operations
  GET /api/v1/networks/orders
  GET /api/v1/networks/orders/:id
  POST /api/v1/networks/orders/:id/complete

Used for:

- Transaction tracking and completion handshake

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

---

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:

- Maintain selected offer and order IDs.
- Distinguish offer list filters by sent/received and status.
- Keep completion status flags from response (buyer_confirmed/seller_confirmed).

Example:

```ts
type OffersOrdersState = {
  offers: any[];
  orders: any[];
  selectedOfferId?: string;
  selectedOrderId?: string;
  completion?: {
    buyer_confirmed: boolean;
    seller_confirmed: boolean;
    completed: boolean;
  };
};
```

---

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User taps counter, accept, reject, or complete

Behavior:

- Execute action endpoint.
- Re-fetch detail for canonical state.
- Re-fetch list to keep counters fresh.

Example:

```ts
await api.post(`/api/v1/networks/offers/${offerId}/counter`, {
  amount: 6000,
  note: "Meet in the middle",
});
```

---

7. SUCCESS HANDLING

On successful response:

- Update selected card state.
- Show action-specific success feedback.
- Keep user on same tab/filter.
- Navigate to order detail after accept when order_id appears.

---

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Invalid state transition (already confirmed/invalid counter range).
401 -> Redirect to auth.
403 -> Show unauthorized participant error.
404 -> Offer or order not found.
409 -> Conflict due to concurrent updates; refresh detail.
500 -> Preserve pending form values and allow retry.

---

9. EDGE CASES

9.1 Duplicate Completion Attempt

- Description: Same party calls complete twice.
- Expected behavior: Show already-confirmed warning.

  9.2 Offer Expired During Action

- Description: Offer no longer active at submit time.
- Expected behavior: Refresh list and disable action.

  9.3 Out-of-Date Detail Tab

- Description: Another client changes state.
- Expected behavior: Pull latest detail before mutation.

---

10. DATA CONTRACT (OPTIONAL)

```ts
type OrderCompleteResponse = {
  data: {
    order: any;
    buyer_confirmed: boolean;
    seller_confirmed: boolean;
    completed: boolean;
  };
};
```

---

11. STATE TRANSITIONS

offer_open -> offer_mutated -> order_updated

Rules:

- Always trust server detail payload over local assumptions.
- completion.completed is the final order terminal condition in this flow.

---

Other User Profile and Connections — Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Connections APIs, users/:id profile/listings/reviews/review-summary/connection-status
Depends On: Auth, targetUserId source, connection graph consistency

---

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  User views another profile, relationship status, and manages connection requests.
- When does it start?
  On profile card click or connection action.
- When does it end?
  When relationship and profile data are synchronized in UI.
- Any important constraints (atomic, async, multi-step, etc.)
  Namespace is /networks/users/:id for other-user resources.

---

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- targetUserId is available.
- Authenticated user exists in DB.
- Connection service and review service are operational.

---

3. FLOW SUMMARY

High-level step sequence:

<Profile Open>
  -> Step 1: Load connection status + public profile
  -> Step 2: Load listings/reviews summary
  -> Step 3: Trigger send/accept/reject/remove action if needed
  -> Final Action -> Refresh status and profile blocks

---

4. API CALLS USED

4.1 Connection Graph
GET /api/v1/networks/connections/my-incoming
GET /api/v1/networks/connections/my-outgoing
POST /api/v1/networks/connections/send-request
POST /api/v1/networks/connections/:id/accept
POST /api/v1/networks/connections/:id/reject
GET /api/v1/networks/connections
DELETE /api/v1/networks/connections/:id

Used for:

- Request lifecycle and accepted graph

  4.2 Other User Data
  GET /api/v1/networks/users/:id/profile
  GET /api/v1/networks/users/:id/listings
  GET /api/v1/networks/users/:id/reviews
  GET /api/v1/networks/users/:id/review-summary
  GET /api/v1/networks/users/:id/connection-status

Used for:

- Public profile and reputation modules

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

---

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:

- Keep targetUserId as primary route state.
- Keep relationship status in dedicated store.
- Reconcile request IDs with status endpoint output.

Example:

```ts
type OtherUserState = {
  targetUserId: string;
  profile: any | null;
  listings: any[];
  reviews: any[];
  reviewSummary: any | null;
  connectionStatus: {
    is_connected_to: boolean;
    is_connected_by: boolean;
    outgoing_status: string | null;
    incoming_status: string | null;
  } | null;
};
```

---

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User presses Connect/Accept/Reject/Remove

Behavior:

- Perform mutation API.
- Re-fetch connection-status and incoming/outgoing lists.
- Repaint CTA based on canonical status.

Example:

```ts
await api.post("/api/v1/networks/connections/send-request", {
  target_user_id: targetUserId,
});
await api.get(`/api/v1/networks/users/${targetUserId}/connection-status`);
```

---

7. SUCCESS HANDLING

On successful response:

- Update relationship badge.
- Update CTA text (Requested, Connected, etc.).
- Refresh mutual context where relevant.
- Stay on profile unless user explicitly navigates.

---

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Invalid target/self-connect/already connected.
401 -> Redirect to auth.
403 -> Block relationship restrictions.
404 -> User or connection request not found.
409 -> Status conflict; refresh connection-status.
500 -> Show retry control and keep last known status.

---

9. EDGE CASES

9.1 Target User Deleted/Unavailable

- Description: Profile open with stale ID.
- Expected behavior: Show unavailable profile state and back navigation.

  9.2 Simultaneous Accept/Reject

- Description: Action taken in another client.
- Expected behavior: Refresh and show resulting canonical status.

  9.3 Blocked Relationship

- Description: Either party has blocked the other.
- Expected behavior: Disable connect actions with explanatory message.

---

10. DATA CONTRACT (OPTIONAL)

```ts
type ConnectionStatus = {
  is_connected_to: boolean;
  is_connected_by: boolean;
  outgoing_status: string | null;
  incoming_status: string | null;
};
```

---

11. STATE TRANSITIONS

profile_loading -> profile_ready -> relationship_mutating

Rules:

- Always refresh connection-status after mutation.
- Profile modules remain visible during relationship mutation.

---

Favorites and Account Settings — Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Favorites, User Profile PATCH, Avatar Upload, Deactivate, Delete Account, ISOs, Reviews
Depends On: Auth, listingId availability, file upload support for avatar

---

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  User manages favorites, profile metadata, avatar, and account lifecycle controls.
- When does it start?
  On Favorites or Profile settings screen open.
- When does it end?
  After mutation responses are reflected in UI state.
- Any important constraints (atomic, async, multi-step, etc.)
  Delete account is destructive and must be guarded in UI.

---

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Authenticated user context exists.
- listingId is known for favorite toggles.
- For avatar upload, multipart file is provided.

---

3. FLOW SUMMARY

High-level step sequence:

<Settings/Favorites Open>
-> Step 1: Load current favorites and profile fields
-> Step 2: Perform add/remove or profile mutations
-> Step 3: Refresh affected panels
-> Final Action -> Persist updated user preferences/state

---

4. API CALLS USED

4.1 Favorites
GET /api/v1/networks/user/favorites
POST /api/v1/networks/user/favorites
DELETE /api/v1/networks/user/favorites/:type/:id

Used for:

- Listing save/unsave behavior

  4.2 Profile and Account
  PATCH /api/v1/user/profile
  POST /api/v1/user/avatar
  PATCH /api/v1/user/deactivate
  DELETE /api/v1/user

Used for:

- Profile updates and account controls

  4.3 Supporting Tabs
  GET /api/v1/networks/user/reviews
  GET /api/v1/networks/user/isos/my
  GET /api/v1/networks/user/feeds/timeline

Used for:

- Activity-related tabs in profile area

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

---

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:

- Keep favorites as a Set for fast toggle checks.
- Use optimistic UI for favorite mutations only.
- Gate destructive account actions with confirmation workflow.

Example:

```ts
type SettingsState = {
  profile: any;
  favorites: Set<string>;
  savingProfile: boolean;
  uploadingAvatar: boolean;
  accountActionPending: boolean;
};
```

---

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User toggles favorite or submits settings form

Behavior:

- Dispatch mutation.
- Apply optimistic update where safe.
- Re-fetch current profile/favorites on success.

Example:

```ts
await api.post("/api/v1/networks/user/favorites", {
  item_type: "listing",
  item_id: listingId,
});
```

---

7. SUCCESS HANDLING

On successful response:

- Reflect saved profile/favorite immediately.
- Show confirmation toast.
- Keep user in current settings section.
- For deactivate/delete, redirect to safe exit route.

---

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show validation failure (invalid fields, duplicate favorite).
401 -> Redirect to auth.
403 -> Show forbidden action.
404 -> Show not-found for stale listing/favorite ids.
409 -> Resolve conflict by refetching canonical state.
500 -> Revert optimistic state and prompt retry.

---

9. EDGE CASES

9.1 Duplicate Favorite Add

- Description: Item already favorited.
- Expected behavior: Keep state unchanged, show info message.

  9.2 Avatar Upload Too Large

- Description: File exceeds backend limits.
- Expected behavior: Show file size guidance and retry option.

  9.3 Active Orders During Delete

- Description: Delete blocked due to active orders.
- Expected behavior: Explain blocker and link to orders tab.

---

10. DATA CONTRACT (OPTIONAL)

```ts
type FavoriteMutation = {
  item_type: "listing";
  item_id: string;
};
```

---

11. STATE TRANSITIONS

settings_idle -> mutating -> synced

Rules:

- destructive action states must require explicit confirmation.
- favorites sync runs after any potential stale response.

---

Notifications Center — Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Networks Notifications list, unread count, mark read, mark all read
Depends On: Auth, notification category mapping, tab filter handling

---

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  User triages buying/selling/social/system notifications quickly.
- When does it start?
  On notifications screen open.
- When does it end?
  When list and unread badges are synchronized after actions.
- Any important constraints (atomic, async, multi-step, etc.)
  Mark-all-read can be tab-scoped by category mapping.

---

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Authenticated user.
- Notification service connectivity.
- Valid tab filter value.

---

3. FLOW SUMMARY

High-level step sequence:

<Notifications Open>
  -> Step 1: Load unread count
  -> Step 2: Load tab-filtered notifications
  -> Step 3: User marks one or all as read
  -> Final Action -> Refresh list + unread count

---

4. API CALLS USED

4.1 Notifications List
GET /api/v1/networks/notifications?tab=buying&unread_only=false&limit=20&offset=0

Used for:

- Main list rendering

  4.2 Unread Badge
  GET /api/v1/networks/notifications/unread-count

Used for:

- Global bell badge and tab summary

  4.3 Read Actions
  POST /api/v1/networks/notifications/:id/read
  POST /api/v1/networks/notifications/mark-all-read?tab=buying

Used for:

- Item-level and bulk read operations

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

---

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:

- Keep selected tab in local route/UI state.
- Maintain unread_count from dedicated endpoint.
- Optimistically set read=true, then reconcile by re-fetch.

Example:

```ts
type NotificationsState = {
  tab: "all" | "buying" | "selling" | "social" | "system";
  items: any[];
  unreadCount: number;
  loading: boolean;
};
```

---

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User taps notification row or mark-all button

Behavior:

- Call read endpoint.
- Refresh unread count and current tab list.
- Keep scroll position where practical.

Example:

```ts
await api.post(`/api/v1/networks/notifications/${notificationId}/read`);
await Promise.all([
  api.get("/api/v1/networks/notifications/unread-count"),
  api.get("/api/v1/networks/notifications", {
    params: { tab, unread_only: false, limit: 20, offset: 0 },
  }),
]);
```

---

7. SUCCESS HANDLING

On successful response:

- Update unread badges.
- Reflect read styling immediately.
- Preserve selected tab.
- Navigate to actionUrl when notification click is actionable.

---

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Invalid tab/type filters.
401 -> Redirect to auth.
403 -> Show permissions issue.
404 -> Notification no longer exists; remove from UI.
409 -> Conflict with concurrent read action; refresh list.
500 -> Show inline retry on action row.

---

9. EDGE CASES

9.1 Stale Notification ID

- Description: Item deleted before read action.
- Expected behavior: Remove item and refresh list silently.

  9.2 Tab Switch During Load

- Description: User changes tab quickly.
- Expected behavior: Cancel previous request and bind response to latest tab.

  9.3 Large Notification Backlog

- Description: Pagination spans many pages.
- Expected behavior: Infinite scroll with dedupe by id.

---

10. DATA CONTRACT (OPTIONAL)

```ts
type NotificationItem = {
  id: string;
  type: string;
  category: "buying" | "selling" | "social" | "system";
  title: string;
  body?: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, any>;
};
```

---

11. STATE TRANSITIONS

tab_loading -> tab_ready -> read_mutating

Rules:

- unreadCount must be refreshed after any read mutation.
- read_mutating never clears current item array.

---

Onboarding Completion — Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Networks Onboarding Status, Networks Onboarding Complete
Depends On: Auth, schema-valid onboarding payload, user not already completed

---

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  User completes Networks onboarding with profile, location, and avatar setup.
- When does it start?
  When onboarding gate determines status is incomplete.
- When does it end?
  When complete endpoint succeeds and status becomes completed.
- Any important constraints (atomic, async, multi-step, etc.)
  Completion is atomic transaction on backend.

---

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- User authenticated and mapped in DB.
- Status endpoint returns incomplete.
- Required payload fields are prepared by frontend.

---

3. FLOW SUMMARY

High-level step sequence:

<App Launch>
  -> Step 1: Get onboarding status
  -> Step 2: Collect required user inputs
  -> Step 3: Submit completion payload
  -> Final Action -> Enter Networks home state

---

4. API CALLS USED

4.1 Onboarding Status
GET /api/v1/networks/onboarding/status

Used for:

- Determine whether onboarding gate is required

  4.2 Onboarding Complete
  PATCH /api/v1/networks/onboarding/complete

Used for:

- Atomic completion of onboarding flow

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

---

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:

- Maintain draft onboarding form in local state.
- Track required fields from status.requires.
- Freeze submit button during completion call.

Example:

```ts
type OnboardingFormState = {
  location: {
    country: string;
    region: string;
    postal_code?: string;
    city?: string;
    line1?: string;
    line2?: string | null;
    currency: string;
  };
  profile: { first_name: string; last_name: string };
  avatar: { type: "monogram" | "upload"; [k: string]: any };
  submitting: boolean;
};
```

---

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User clicks Complete Onboarding

Behavior:

- Validate required fields.
- Send complete payload.
- Re-fetch status to confirm transition.

Example:

```ts
await api.patch("/api/v1/networks/onboarding/complete", payload);
await api.get("/api/v1/networks/onboarding/status");
```

---

7. SUCCESS HANDLING

On successful response:

- Persist completed onboarding state.
- Unlock Networks dashboard/home routes.
- Show success confirmation.
- Navigate to Home Dashboard.

---

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Highlight invalid fields.
401 -> Redirect to auth.
403 -> Show permission issue.
404 -> User record missing.
409 -> Already completed; skip gate and continue.
500 -> Keep form values and offer retry.

---

9. EDGE CASES

9.1 Already Completed Mid-Flow

- Description: User completes on another device.
- Expected behavior: detect 409/successful status and continue to home.

  9.2 Partial Client State Loss

- Description: App reloads before submit.
- Expected behavior: refill from pre_populated/status response where available.

  9.3 Invalid Currency/Region Pair

- Description: Unsupported location combination.
- Expected behavior: block submit with field-specific message.

---

10. DATA CONTRACT (OPTIONAL)

```ts
type OnboardingCompletePayload = {
  location: {
    country: string;
    region: string;
    postal_code?: string;
    city?: string;
    line1?: string;
    line2?: string | null;
    currency: string;
  };
  profile: {
    first_name: string;
    last_name: string;
  };
  avatar: {
    type: "monogram" | "upload";
    monogram_initials?: string;
    monogram_color?: string;
    monogram_style?: string;
    url?: string;
  };
};
```

---

11. STATE TRANSITIONS

status_incomplete -> collecting_inputs -> submitting -> status_completed

Rules:

- Only transition to status_completed after server confirms completion.
- Do not rely solely on local success toast for gate bypass.

---
