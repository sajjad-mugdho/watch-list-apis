# Batch 2 Part 1 and Part 2 Final Integration Guide

This is the consolidated final integration documentation for full Batch 2 (Part 1 + Part 2), formatted in a screen/flow implementation pattern.

Reference docs:
- docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md
- docs/BATCH_2_API_PAYLOADS.md
- docs/BATCH_2_SCREEN_BY_SCREEN_INTEGRATION_GUIDE.md
- docs/BATCH_2_POSTMAN_STEP_BY_STEP_RUNBOOK.md

Validation and execution notes:
- API contracts are validated via Batch 2 pre-production and certification checks.
- Frontend should normalize pagination across endpoint families (`page/limit` vs `limit/offset`) using one adapter layer.

Latest verification snapshot (executed: 2026-03-27, local mock-auth mode):
- Command profile:
  - `NETWORKS_SELLER_TEST_USER=merchant_approved NETWORKS_BUYER_TEST_USER=buyer_us_complete RUN_MUTATION_TESTS=true npm run test:batch2:preprod`
  - `NETWORKS_SELLER_TEST_USER=merchant_approved NETWORKS_BUYER_TEST_USER=buyer_us_complete RUN_MUTATION_TESTS=true CERT_ITERATIONS=1 npm run test:batch2:cert`
- Smoke report:
  - Total: 25
  - Passed: 25
  - Failed: 0
  - Mutation coverage included: `POST /networks/notifications/mark-all-read?tab=buying` (PASS)
- Certification report:
  - Total calls: 23
  - Passed calls: 23
  - Failed calls: 0
  - Failed endpoints: 0
  - Latency failed endpoints: 0
  - Mutation coverage included: `POST /networks/notifications/mark-all-read?tab=buying` (PASS)
- Current conclusion:
  - Canonical search keys are stable.
  - Legacy alias query path (`min_year`/`max_year` + `sort=mostPopular` + `offset`) is now accepted via backend normalization and validated in smoke/certification runs.
  - Consistency audit result: no runtime/API contract inconsistencies found across the Batch 2 gate endpoint set in this guide.

Home Dashboard - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Networks Dashboard, User Profile, User Verification, Offers, Orders, Social Inbox, Support Count, News
Depends On: Auth, attachUser DB mapping, networks services

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  Show home summary cards, account progress, and quick action counts.
- When does it start?
  When user lands on Networks Home.
- When does it end?
  When all mandatory home modules are rendered.
- Any important constraints (atomic, async, multi-step, etc.)
  Multi-call async composition with partial rendering support.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- User is authenticated and resolved to User in DB.
- Home dependencies are reachable.
- Initial routing context is valid.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<Home Open>
  -> Step 1: Load dashboard stats
  -> Step 2: Load profile and verification
  -> Step 3: Load quick widgets
  -> Final Action -> Render home steady state

--------------------------------------------------

4. API CALLS USED

4.1 Dashboard Composition
GET /api/v1/networks/user/dashboard/stats

Used for:
- Top-level activity cards
- Onboarding progress summary

4.2 Identity and Verification
GET /api/v1/user/profile
GET /api/v1/user/verification

Used for:
- Header identity
- Verification badge

4.3 Quick Access Widgets
GET /api/v1/networks/offers?type=received&status=active&limit=20&offset=0
GET /api/v1/networks/orders?type=buy&status=reserved&limit=20&offset=0
GET /api/v1/networks/social/inbox?filter=inquiries&limit=20&offset=0
GET /api/v1/user/support/tickets/count/open
GET /api/v1/news?limit=10

Used for:
- Offers/orders/inquiries/tickets/news blocks

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- Widget list APIs use offset-based pagination (`limit/offset`).
- Keep one adapter so card counts and list rows normalize into a common paging model.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Keep widget-level loading and error boundaries.
- Treat profile/verification/stats as mandatory blocks.
- Compute count badges from list payloads where needed.

Example:

type HomeState = {
  stats: any | null;
  profile: any | null;
  verification: any | null;
  quick: { offers: number; orders: number; inquiries: number; tickets: number };
  news: any[];
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- Home route mounts

Behavior:
- Fetch mandatory blocks first.
- Fetch optional widgets in parallel.
- Merge into normalized home model.

Example:

api.get('/api/v1/networks/user/dashboard/stats')

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Render mandatory modules.
- Render optional modules when available.
- Show zero-state where lists are empty.
- Navigate to Home ready state

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show per-widget validation fallback
401 -> Redirect to sign-in/session restore
403 -> Show restricted access state
404 -> Show empty state for optional widgets
409 -> Re-fetch impacted module only
500 -> Show retry CTA per widget

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Partial Widget Failure
- Description: One or more cards fail while others succeed.
- Expected behavior: Keep successful cards rendered and show inline retry on failed cards.

9.2 Empty Activity
- Description: New user has no offers/orders/inquiries.
- Expected behavior: Display onboarding-oriented empty states with zero counts.

9.3 Mock Auth Without DB User
- Description: x-test-user resolves claims but no User record exists.
- Expected behavior: Show controlled account-state error and stop write actions.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type DashboardStats = {
  data: { stats: Record<string, any>; onboarding: Record<string, any>; user: Record<string, any> };
};

--------------------------------------------------

11. STATE TRANSITIONS

loading -> partial_ready -> ready

Rules:
- Mandatory blocks gate ready state.
- Optional blocks never block page-level ready.

--------------------------------------------------

Profile Activity Tab - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: User Profile, User Verification, Dashboard Stats, Orders, Offers, Favorites, Support
Depends On: Auth, user profile data availability

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  Show personal activity summary, profile reputation, and account status.
- When does it start?
  When Profile Activity tab opens.
- When does it end?
  When summary cards and profile header are rendered.
- Any important constraints (atomic, async, multi-step, etc.)
  Multi-source composition from networks and cross-domain routes.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Valid authenticated user.
- Profile exists in user domain.
- Network activity endpoints are reachable.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<Activity Tab Open>
  -> Step 1: Load profile and verification
  -> Step 2: Load dashboard stats
  -> Step 3: Load activity card sources
  -> Final Action -> Render activity tab

--------------------------------------------------

4. API CALLS USED

4.1 Profile and Identity
GET /api/v1/user/profile
GET /api/v1/user/verification

Used for:
- Header data
- Verification banner

4.2 Activity Sources
GET /api/v1/networks/user/dashboard/stats
GET /api/v1/networks/orders?type=buy&status=reserved&limit=20&offset=0
GET /api/v1/networks/offers?type=received&status=active&limit=20&offset=0
GET /api/v1/networks/user/favorites?type=listing&limit=20&offset=0
GET /api/v1/user/support/tickets/count/open

Used for:
- Activity cards and badges

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- Activity list APIs use offset-based pagination (`limit/offset`).
- Normalize list metadata into the same card-count adapter used by Home widgets.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Keep card data independently cached.
- Derive card counts from source arrays/metadata.
- Avoid tab-wide loading lock after first paint.

Example:

type ProfileActivityState = {
  profile: any | null;
  verification: any | null;
  cards: { activeOrders: number; pendingOffers: number; wishlist: number; ticketsOpen: number };
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- Activity tab becomes active

Behavior:
- Fetch identity first.
- Fetch cards in parallel.
- Convert to unified card model.

Example:

api.get('/api/v1/networks/user/dashboard/stats')

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Paint profile header and verification status.
- Render card counts and statuses.
- Keep navigation in Profile area.
- Navigate to Profile Activity ready

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Validate incoming query params and fallback
401 -> Redirect to sign-in
403 -> Hide restricted cards
404 -> Show missing profile/account fallback
409 -> Re-fetch stale card source
500 -> Keep prior state and show retry

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Cross-Domain Delay
- Description: user profile route is slower than networks stats route.
- Expected behavior: Keep cards visible and show skeleton in header only.

9.2 Count Mismatch
- Description: dashboard card count differs from list totals.
- Expected behavior: Prefer latest list metadata when available.

9.3 Empty Verification Data
- Description: verification endpoint returns incomplete payload.
- Expected behavior: show unverified fallback state.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type ActivityCards = {
  activeOrders: number;
  pendingOffers: number;
  wishlist: number;
  ticketsOpen: number;
};

--------------------------------------------------

11. STATE TRANSITIONS

idle -> loading -> ready

Rules:
- Header and cards can transition independently.
- Ready state can be reached with optional blocks missing.

--------------------------------------------------

Profile For Sale Tab - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: User Listings, Listing Detail, Listing Update, Listing Delete
Depends On: Auth, listing ownership, listing status constraints

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  Manage own for-sale inventory by status, search, and actions.
- When does it start?
  When For Sale tab opens.
- When does it end?
  When inventory list and actions are synchronized.
- Any important constraints (atomic, async, multi-step, etc.)
  Listing edits are draft-only; delete is constrained by status/business rules.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Authenticated owner user.
- Networks user listings endpoint available.
- Listing ids available for row actions.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<For Sale Tab Open>
  -> Step 1: Load my listings with filters
  -> Step 2: Apply status/search controls
  -> Step 3: Run row action (view/edit/delete)
  -> Final Action -> Re-fetch and render current list

--------------------------------------------------

4. API CALLS USED

4.1 Inventory Query
GET /api/v1/networks/user/listings?status=all&search=&page=1&limit=20

Used for:
- Initial and filtered list rendering
- Count/group metadata

4.2 Row-Level Operations
GET /api/v1/networks/listings/:id
PATCH /api/v1/networks/listings/:id
DELETE /api/v1/networks/listings/:id

Used for:
- Detail preview
- Edit and delete actions

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- User listings API is page-based (`page/limit`).
- Preserve page state across edit/delete refreshes and map to shared paging UI.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Persist filter and search state in tab context.
- Disable edit action for non-draft items based on status.
- Optimistically remove row only after confirmed delete.

Example:

type ForSaleState = {
  statusFilter: 'all' | 'draft' | 'active' | 'reserved' | 'sold' | 'inactive';
  search: string;
  items: any[];
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User updates filters or taps row action

Behavior:
- Re-query list on filter/search changes.
- Validate status before edit.
- Re-fetch list after mutation.

Example:

api.get('/api/v1/networks/user/listings', { params: { status: 'active', page: 1, limit: 20 } })

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Update list rows and counts.
- Keep current filter context.
- Confirm row mutation result.
- Navigate to listing detail/editor when selected

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show action rule error message
401 -> Redirect to auth
403 -> Show ownership/permission denied
404 -> Remove stale row and notify user
409 -> Show status conflict and refresh row/list
500 -> Keep previous list and allow retry

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Edit Attempt On Active Listing
- Description: user taps edit on active/reserved/sold listing.
- Expected behavior: block edit and show draft-only rule.

9.2 Delete Conflict
- Description: listing has active negotiation or terminal status.
- Expected behavior: show conflict explanation and keep row.

9.3 Stale Listing ID
- Description: row item deleted from another session.
- Expected behavior: remove stale row on next refresh.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type UserListingsResponse = {
  data: any[];
  _metadata: { paging: Record<string, number>; groups: Record<string, number> };
};

--------------------------------------------------

11. STATE TRANSITIONS

tab_loading -> tab_ready -> mutating -> tab_ready

Rules:
- Keep selected filter during mutation.
- Always reconcile with server after write actions.

--------------------------------------------------

Profile WTB Tab - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: User ISOs, ISO filters by status
Depends On: Auth, ISO ownership

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  Manage wanted-to-buy posts and monitor fulfillment lifecycle.
- When does it start?
  When WTB tab opens.
- When does it end?
  When WTB list and status filters are rendered.
- Any important constraints (atomic, async, multi-step, etc.)
  Status and criteria mappings should remain consistent across cards.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Authenticated user.
- ISO endpoint available.
- Status filter value is valid.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<WTB Tab Open>
  -> Step 1: Load ISOs with status filter
  -> Step 2: Apply user-selected status
  -> Step 3: Render criteria/status cards
  -> Final Action -> Present WTB list state

--------------------------------------------------

4. API CALLS USED

4.1 ISO Retrieval
GET /api/v1/networks/user/isos/my?status=all&limit=20&offset=0

Used for:
- WTB list rendering
- Status segmented tabs

4.2 Optional Refresh
GET /api/v1/networks/user/isos/my?status=active&limit=20&offset=0

Used for:
- Tab switch refresh

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- User ISO APIs in this flow are offset-based (`limit/offset`).
- Keep status-tab pagination independent so switching tabs does not mix offsets.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Keep active status tab in local state.
- Normalize criteria fields for card rendering.
- Show explicit empty-state for each status tab.

Example:

type WtbState = {
  status: 'all' | 'active' | 'fulfilled';
  isos: any[];
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User opens tab or changes WTB status filter

Behavior:
- Query using selected status.
- Render total and rows.
- Keep tab state on navigation back.

Example:

api.get('/api/v1/networks/user/isos/my', { params: { status: 'active', limit: 20, offset: 0 } })

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Render WTB rows.
- Render status totals.
- Keep current filter sticky.
- Navigate to WTB item detail when selected

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show invalid status/filter warning
401 -> Redirect to auth
403 -> Show forbidden state
404 -> Show no-items state
409 -> Refresh list on conflict
500 -> Keep previous cached rows

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Unsupported Content Badge
- Description: UI expects contents in ISO that is not modeled.
- Expected behavior: hide badge and use available criteria fields only.

9.2 Mixed Legacy Status Labels
- Description: upstream payload contains legacy status naming.
- Expected behavior: map to canonical tab labels before render.

9.3 Large ISO List
- Description: user has many ISOs.
- Expected behavior: paginate with offset/limit and lazy rendering.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type IsoItem = {
  _id: string;
  status: string;
  criteria?: Record<string, any>;
};

--------------------------------------------------

11. STATE TRANSITIONS

loading -> ready -> filtering -> ready

Rules:
- Filtering should not clear current list until new payload arrives.
- Apply stable row keys by _id.

--------------------------------------------------

Profile References Tab - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: User Reviews, User Review Summary
Depends On: Auth, review service

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  Review feedback and trust signals by buyer/seller role.
- When does it start?
  When References tab opens.
- When does it end?
  When role-filtered reviews and totals are displayed.
- Any important constraints (atomic, async, multi-step, etc.)
  Role filtering must remain consistent between tabs and API query.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Authenticated user.
- Review endpoints reachable.
- Role filter value is valid.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<References Tab Open>
  -> Step 1: Load reviews with default role filter
  -> Step 2: Load summary if needed
  -> Step 3: Apply role switch (buyer/seller/all)
  -> Final Action -> Render reviews list

--------------------------------------------------

4. API CALLS USED

4.1 Current User Reviews
GET /api/v1/networks/user/reviews?role=seller&limit=20&offset=0

Used for:
- Role-filtered references list

4.2 Summary (Optional)
GET /api/v1/networks/users/:id/review-summary

Used for:
- Aggregate rating block

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- Reviews API in this flow is offset-based (`limit/offset`).
- Maintain separate offsets per role tab (`all`, `buyer`, `seller`).

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Persist selected role tab.
- Keep pagination state by role.
- Normalize reviewer identity fields.

Example:

type ReferencesState = {
  role: 'all' | 'buyer' | 'seller';
  reviews: any[];
  total: number;
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User switches role tab

Behavior:
- Query reviews with role.
- Replace list payload.
- Update totals and summary badges.

Example:

api.get('/api/v1/networks/user/reviews', { params: { role: 'buyer', limit: 20, offset: 0 } })

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Render review cards.
- Render total review count.
- Keep selected role visible.
- Navigate to reviewer profile when selected

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show invalid role selection message
401 -> Redirect to auth
403 -> Hide protected review data
404 -> Show no-reviews state
409 -> Refresh role tab on stale query
500 -> Preserve last successful reviews

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Empty Role Segment
- Description: user has no reviews for selected role.
- Expected behavior: show role-specific empty message.

9.2 Missing Reviewer Avatar
- Description: review payload has null avatar.
- Expected behavior: render fallback avatar.

9.3 Offset Drift
- Description: new reviews arrive while paginating.
- Expected behavior: support refresh/reset to offset 0.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type ReviewsResponse = {
  data: any[];
  total: number;
  limit: number;
  offset: number;
};

--------------------------------------------------

11. STATE TRANSITIONS

loading -> ready -> role_switching -> ready

Rules:
- Reset list scroll on role change.
- Keep prior role data cached for quick switch.

--------------------------------------------------

Edit Profile and Account Controls - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: User Profile GET/PATCH, User Avatar Upload, Deactivate, Delete Account
Depends On: Auth, multipart upload support

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  Update personal profile and manage account lifecycle controls.
- When does it start?
  When user opens Edit Profile.
- When does it end?
  When profile mutations are persisted or account action completes.
- Any important constraints (atomic, async, multi-step, etc.)
  Delete account is destructive and must be strongly confirmed.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- User is authenticated.
- Current profile data can be fetched.
- Upload transport supports multipart.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<Edit Profile Open>
  -> Step 1: Load current profile
  -> Step 2: Edit fields/avatar
  -> Step 3: Submit mutation
  -> Final Action -> Refresh profile and persist UI state

--------------------------------------------------

4. API CALLS USED

4.1 Profile Read/Update
GET /api/v1/user/profile
PATCH /api/v1/user/profile

Used for:
- Initial form load
- Save profile fields

4.2 Avatar and Account Controls
POST /api/v1/user/avatar
PATCH /api/v1/user/deactivate
DELETE /api/v1/user

Used for:
- Avatar change
- Account deactivation/deletion

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- No list pagination for profile/account mutations in this screen.
- Keep this flow outside the pagination adapter path.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Keep dirty form tracking.
- Separate avatar upload loading from profile save loading.
- Require confirmation state for destructive actions.

Example:

type EditProfileState = {
  form: Record<string, any>;
  isDirty: boolean;
  saving: boolean;
  uploadingAvatar: boolean;
  accountActionPending: boolean;
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User taps Save, Upload Avatar, Deactivate, or Delete

Behavior:
- Validate editable fields.
- Submit target mutation endpoint.
- Re-fetch profile after success.

Example:

api.patch('/api/v1/user/profile', payload)

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Show updated profile fields.
- Confirm avatar upload state.
- Clear dirty flags.
- Navigate to profile summary screen

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show field-level validation messages
401 -> Redirect to auth
403 -> Show forbidden mutation state
404 -> Show missing profile/account state
409 -> Show account action conflict details
500 -> Preserve form and allow retry

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Avatar Upload Fails Mid-Save
- Description: avatar request fails while profile save succeeds.
- Expected behavior: keep profile updates and isolate avatar retry.

9.2 Delete Blocked By Active Orders
- Description: account delete cannot proceed due to active constraints.
- Expected behavior: explain blocker and route to orders context.

9.3 Social Link Validation
- Description: malformed website/social URL submitted.
- Expected behavior: reject and highlight field.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type ProfilePatchPayload = {
  first_name?: string;
  last_name?: string;
  display_name?: string;
  bio?: string;
  social_links?: Record<string, string>;
};

--------------------------------------------------

11. STATE TRANSITIONS

viewing -> editing -> submitting -> saved

Rules:
- Prevent parallel destructive actions.
- Keep unsaved changes warning on navigation.

--------------------------------------------------

Search Landing - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Unified Search, Popular Brands, Recent Searches
Depends On: Auth, search indexing

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  Enter discovery context and launch targeted search.
- When does it start?
  When Search landing opens.
- When does it end?
  When user triggers query or selects recent/brand shortcut.
- Any important constraints (atomic, async, multi-step, etc.)
  Context values should be singular: listing, iso, user.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Authenticated user.
- Search APIs reachable.
- Recent searches storage available.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<Search Landing Open>
  -> Step 1: Load recent searches
  -> Step 2: Load popular brands
  -> Step 3: User enters query and chooses tab
  -> Final Action -> Trigger results request

--------------------------------------------------

4. API CALLS USED

4.1 Landing Data
GET /api/v1/networks/user/searches/recent
GET /api/v1/networks/search/popular-brands

Used for:
- Recent list and brand chips

4.2 Persist Search Intent
POST /api/v1/networks/user/searches/recent
DELETE /api/v1/networks/user/searches/recent/:id
DELETE /api/v1/networks/user/searches/recent

Used for:
- Save/delete/clear recent searches

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- Landing support APIs are simple bounded lists (limit-only or server-default).
- Treat these as non-paginated UI blocks unless backend explicitly returns paging metadata.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Keep selected tab and input query in route state.
- Prevent empty-query submit.
- Dedupe recent entries client-side by id.

Example:

type SearchLandingState = {
  tab: 'listing' | 'iso' | 'user';
  query: string;
  recent: any[];
  popularBrands: any[];
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User submits search or taps chip/recent item

Behavior:
- Build canonical query payload.
- Navigate to results view.
- Save recent search asynchronously.

Example:

api.get('/api/v1/networks/search', { params: { type: 'listing', q: query, page: 1, limit: 10 } })

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Forward results payload to next screen.
- Update recent searches list.
- Keep selected tab persistent.
- Navigate to Search Results screen

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show query validation guidance
401 -> Redirect to auth
403 -> Show access restrictions
404 -> Show no-results state
409 -> Retry with refreshed parameters
500 -> Keep query and show retry action

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Whitespace Query
- Description: user submits only spaces.
- Expected behavior: block request and prompt for valid query.

9.2 Recent Search Overflow
- Description: very large recent history.
- Expected behavior: render top N with pagination or lazy load.

9.3 Alias Deep Link
- Description: incoming links use legacy filter aliases.
- Expected behavior: normalize to canonical keys before dispatch.
- Current verified note: backend accepts alias query and normalizes to canonical search shape.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type RecentSearchPayload = {
  query: string;
  context: 'listing' | 'iso' | 'user';
  filters?: Record<string, any>;
  result_count?: number;
};

--------------------------------------------------

11. STATE TRANSITIONS

idle -> searching -> results_ready

Rules:
- Never clear query on transient failure.
- Keep tab context stable across retries.

--------------------------------------------------

Search Results Grid - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Unified Search, Networks Listings, Favorites
Depends On: Auth, canonical filter keys, response adapter layer

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  View card-based listing results with filters/sort/favorite toggles.
- When does it start?
  After search submit or filter change.
- When does it end?
  After result set and pagination are rendered.
- Any important constraints (atomic, async, multi-step, etc.)
  /search and /listings response envelopes differ and require adapter.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Valid query or filter set.
- Results endpoint selected by context.
- Favorite APIs available for toggle.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<Results Grid Enter>
  -> Step 1: Fetch grid results
  -> Step 2: Normalize payload
  -> Step 3: Render cards and favorite state
  -> Final Action -> Persist current filter/sort view

--------------------------------------------------

4. API CALLS USED

4.1 Result Retrieval
GET /api/v1/networks/search
GET /api/v1/networks/listings

Used for:
- Filtered/sorted result pages

4.2 Favorites
GET /api/v1/networks/user/favorites?type=listing&limit=20&offset=0
POST /api/v1/networks/user/favorites
DELETE /api/v1/networks/user/favorites/:type/:id

Used for:
- Card favorite indicators and toggles

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- Search and listings result APIs use page-based pagination (`page/limit`).
- Keep one normalized page model across result sources and filters.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Store filters using canonical keys (year_min/year_max, sort_by/sort_order).
- Keep normalized paging object regardless of source endpoint.
- Apply optimistic favorite toggles with rollback on failure.

Example:

type SearchGridState = {
  items: any[];
  page: number;
  limit: number;
  total: number;
  filters: Record<string, any>;
  favorites: Set<string>;
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User changes filter, sort, or pagination

Behavior:
- Build canonical query params.
- Fetch selected endpoint.
- Adapt payload and render.

Example:

api.get('/api/v1/networks/listings', { params: { page: 1, limit: 20, sort_by: 'relevance', sort_order: 'desc' } })

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Render grid cards.
- Render total and paging controls.
- Preserve filter chips and sort state.
- Navigate to Listing Detail on card click

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show invalid filter combination message
401 -> Redirect to auth
403 -> Show restricted listing state
404 -> Show empty result layout
409 -> Re-fetch current page with latest params
500 -> Keep prior page cache and show retry

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Filter Alias Input
- Description: client receives legacy min_year/max_year params.
- Expected behavior: normalize to year_min/year_max before request.
- Current verified note: sending legacy alias query directly to `/networks/search` is accepted and normalized.

9.2 Missing Favorite List
- Description: favorites call fails while results succeed.
- Expected behavior: render cards without favorite fill and retry quietly.

9.3 Relevance Sort Without Query
- Description: sort_by=relevance used with empty q.
- Expected behavior: fallback to created sort.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type ListingQuery = {
  page: number;
  limit: number;
  sort_by?: 'price' | 'created' | 'updated' | 'popularity' | 'relevance';
  sort_order?: 'asc' | 'desc';
};

--------------------------------------------------

11. STATE TRANSITIONS

results_loading -> results_ready -> mutating_favorite -> results_ready

Rules:
- Do not clear grid while changing page.
- Roll back favorite state if mutation fails.

--------------------------------------------------

Search Results List - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Unified Search, Networks Listings, Favorites
Depends On: Auth, shared adapter with grid mode

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  View row/list representation of the same results dataset.
- When does it start?
  When user switches display mode to list.
- When does it end?
  When list rows are synchronized with active filters and favorites.
- Any important constraints (atomic, async, multi-step, etc.)
  Must reuse same source query state as grid mode.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Existing results context is available.
- List mode toggle is selected.
- Favorite actions are permitted.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<List Mode Toggle>
  -> Step 1: Reuse or fetch results payload
  -> Step 2: Map to row view model
  -> Step 3: Enable row actions
  -> Final Action -> Persist list-mode state

--------------------------------------------------

4. API CALLS USED

4.1 Result Source
GET /api/v1/networks/search
GET /api/v1/networks/listings

Used for:
- Row content and pagination

4.2 Row Favorite Actions
POST /api/v1/networks/user/favorites
DELETE /api/v1/networks/user/favorites/:type/:id

Used for:
- Row-level save/unsave actions

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- List mode reuses the same page-based source query (`page/limit`) as grid mode.
- Do not maintain separate pagination contracts between view modes.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Share one canonical query state with grid mode.
- Keep scroll position per mode if possible.
- Use the same favorite set backing both modes.

Example:

type SearchListState = {
  mode: 'list';
  rows: any[];
  paging: { page: number; limit: number; total: number };
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User switches to list mode or changes row-level controls

Behavior:
- Reuse cached result payload if valid.
- Otherwise fetch with current query state.
- Render list rows and actions.

Example:

api.get('/api/v1/networks/listings', { params: currentFilters })

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Render list rows.
- Keep active filter/sort controls.
- Keep favorite states consistent with grid.
- Navigate to detail/profile row destinations

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show query error inline
401 -> Redirect to auth
403 -> Show restricted content row placeholders
404 -> Show no-results list state
409 -> Refresh from latest query state
500 -> Fallback to prior cached rows

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Grid/List Divergence
- Description: grid and list show inconsistent row data.
- Expected behavior: both views consume same normalized model.

9.2 Fast Mode Switching
- Description: user toggles quickly between modes.
- Expected behavior: cancel stale requests and keep latest mode only.

9.3 Row Action Conflict
- Description: favorite mutation returns conflict.
- Expected behavior: re-sync favorite set from server.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type SearchRow = {
  id: string;
  title: string;
  price?: number;
  isFavorite: boolean;
};

--------------------------------------------------

11. STATE TRANSITIONS

mode_switching -> list_loading -> list_ready

Rules:
- Keep query state immutable during mode transition.
- Do not trigger duplicate fetches for identical params.

--------------------------------------------------

Listing Detail and Actions - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Listing Detail, Send Offer, Listing Offers, Inquire, Reserve
Depends On: Auth, listing id, listing status/ownership checks

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  Inspect listing and execute offer/inquiry/reserve actions.
- When does it start?
  On listing selection from search/feed.
- When does it end?
  When selected action is persisted and reflected in UI.
- Any important constraints (atomic, async, multi-step, etc.)
  Action validity depends on listing status and actor role.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- listing id exists.
- user is authenticated.
- listing action is allowed by current state.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<Listing Open>
  -> Step 1: Fetch listing detail
  -> Step 2: User chooses action
  -> Step 3: Execute selected mutation
  -> Final Action -> Update detail CTA state

--------------------------------------------------

4. API CALLS USED

4.1 Listing Read
GET /api/v1/networks/listings/:id

Used for:
- Detail render and status checks

4.2 Listing Actions
POST /api/v1/networks/listings/:id/offers
GET /api/v1/networks/listings/:id/offers
POST /api/v1/networks/listings/:id/inquire
POST /api/v1/networks/listings/:id/reserve

Used for:
- Negotiation, inquiry channel creation, direct reserve order

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- Listing detail/actions are entity-level (non-paginated).
- Keep action responses mapped to route state, not paging state.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Keep listing snapshot and action forms separate.
- Lock action buttons during in-flight mutation.
- Persist returned channel/order ids in route state.

Example:

type ListingDetailState = {
  listing: any | null;
  submitting: 'offer' | 'inquiry' | 'reserve' | null;
  channelId?: string;
  orderId?: string;
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User taps Make Offer, Inquire, or Reserve

Behavior:
- Validate action payload.
- Submit mutation endpoint.
- Re-query key detail blocks as needed.

Example:

api.post(`/api/v1/networks/listings/${listingId}/offers`, { amount: 5800 })

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Show confirmation.
- Update CTA/button state.
- Save returned entity ids.
- Navigate to offer/order/inbox destination when requested

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show payload/business rule error
401 -> Redirect to auth
403 -> Show forbidden action state
404 -> Show unavailable listing state
409 -> Show conflict (already reserved/changed)
500 -> Keep form state and allow retry

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Listing Status Changed Mid-Action
- Description: listing switches state while user is viewing.
- Expected behavior: refresh detail and disable invalid CTAs.

9.2 Existing Inquiry Channel
- Description: inquire endpoint returns reused channel.
- Expected behavior: route to existing conversation.

9.3 Self-Action Attempt
- Description: owner attempts buyer action.
- Expected behavior: block mutation and display guidance.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type OfferPayload = {
  amount: number;
  message?: string;
  shipping_region?: string;
  request_free_shipping?: boolean;
};

--------------------------------------------------

11. STATE TRANSITIONS

detail_loading -> detail_ready -> action_submitting -> detail_ready

Rules:
- Only one action mutation at a time.
- Always trust latest server status for CTA enablement.

--------------------------------------------------

Offers and Orders - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Offers list/detail/counter/accept/reject, Orders list/detail/complete
Depends On: Auth, offer/order role permissions

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  Manage offer negotiation and order completion lifecycle.
- When does it start?
  When user opens Offers or Orders module.
- When does it end?
  When action state is reflected in list and detail views.
- Any important constraints (atomic, async, multi-step, etc.)
  Order completion is dual-confirmation logic.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Authenticated participant.
- Valid offer/order ids.
- Current status permits selected action.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<Offers/Orders Open>
  -> Step 1: Load list by filter
  -> Step 2: Open entity detail
  -> Step 3: Execute action
  -> Final Action -> Re-sync list and detail

--------------------------------------------------

4. API CALLS USED

4.1 Offer Lifecycle
GET /api/v1/networks/offers
GET /api/v1/networks/offers/:id
POST /api/v1/networks/offers/:id/counter
POST /api/v1/networks/offers/:id/accept
POST /api/v1/networks/offers/:id/reject

Used for:
- Negotiation and transition events

4.2 Order Lifecycle
GET /api/v1/networks/orders
GET /api/v1/networks/orders/:id
POST /api/v1/networks/orders/:id/complete

Used for:
- Order tracking and completion confirmations

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- Offers and orders list endpoints should be normalized through the shared adapter.
- Do not hardcode one pagination family; map from response metadata to common UI paging.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Keep independent filters for offers and orders tabs.
- Store selected entity ids.
- Track complete response flags for order state.

Example:

type OffersOrdersState = {
  offers: any[];
  orders: any[];
  selectedOfferId?: string;
  selectedOrderId?: string;
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User counters, accepts, rejects, or completes

Behavior:
- Execute selected mutation.
- Re-fetch detail.
- Re-fetch active list tab.

Example:

api.post(`/api/v1/networks/offers/${offerId}/counter`, { amount: 6000, note: 'counter' })

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Update entity card status.
- Show action feedback.
- Keep user in current tab/filter.
- Navigate to order detail when offer creates order linkage

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show invalid transition/action message
401 -> Redirect to auth
403 -> Show role/permission denied
404 -> Remove stale entity from list
409 -> Re-sync due to concurrent state change
500 -> Keep pending input and allow retry

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Concurrent Counter Offers
- Description: both participants counter near-simultaneously.
- Expected behavior: show latest canonical offer history from server.

9.2 Completion Double Submit
- Description: same user submits complete twice.
- Expected behavior: show idempotent/confirmed result.

9.3 Expired Offer Action
- Description: action attempted on expired channel.
- Expected behavior: disable actions and refresh status.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type OrderCompleteResponse = {
  data: {
    order: any;
    buyer_confirmed: boolean;
    seller_confirmed: boolean;
    completed: boolean;
  };
};

--------------------------------------------------

11. STATE TRANSITIONS

list_loading -> list_ready -> detail_mutating -> list_ready

Rules:
- Always refresh both detail and list after mutation.
- Do not infer terminal status without server response.

--------------------------------------------------

Other User Profile and Connections - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: users/:id profile/listings/reviews/review-summary/connection-status, connections request lifecycle
Depends On: Auth, target user id, connection graph service

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  View another user and manage connection relationship.
- When does it start?
  On opening another user profile.
- When does it end?
  When relationship and profile modules are synchronized.
- Any important constraints (atomic, async, multi-step, etc.)
  Other-user routes are namespaced under /networks/users/:id.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- targetUserId exists.
- Authenticated user is present.
- Connection APIs are reachable.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<Other Profile Open>
  -> Step 1: Load profile and connection status
  -> Step 2: Load listings/reviews/review summary
  -> Step 3: Execute connection action if requested
  -> Final Action -> Reconcile relationship state

--------------------------------------------------

4. API CALLS USED

4.1 Other User Modules
GET /api/v1/networks/users/:id/profile
GET /api/v1/networks/users/:id/listings
GET /api/v1/networks/users/:id/reviews
GET /api/v1/networks/users/:id/review-summary
GET /api/v1/networks/users/:id/connection-status

Used for:
- Public profile and trust context

4.2 Connection Mutations
GET /api/v1/networks/connections/my-incoming
GET /api/v1/networks/connections/my-outgoing
POST /api/v1/networks/connections/send-request
POST /api/v1/networks/connections/:id/accept
POST /api/v1/networks/connections/:id/reject
GET /api/v1/networks/connections
DELETE /api/v1/networks/connections/:id

Used for:
- Request lifecycle and accepted connection management

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- Other-user modules and connection lists may vary by endpoint family.
- Always normalize from server response metadata before rendering list controls.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Keep target user modules in separate loading/error scopes.
- Cache relationship state from connection-status endpoint.
- Reconcile CTA labels from canonical status response.

Example:

type OtherUserState = {
  targetUserId: string;
  profile: any | null;
  status: any | null;
  listings: any[];
  reviews: any[];
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User taps connect/accept/reject/remove

Behavior:
- Execute mutation endpoint.
- Re-fetch connection status.
- Refresh incoming/outgoing lists when needed.

Example:

api.post('/api/v1/networks/connections/send-request', { target_user_id: targetUserId })

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Update relationship CTA and badge.
- Keep profile modules visible.
- Refresh dependent counts if displayed.
- Navigate to connections list when user chooses

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show invalid relationship action
401 -> Redirect to auth
403 -> Show blocked/forbidden state
404 -> Show unavailable target profile
409 -> Re-sync connection status after conflict
500 -> Keep current state and allow retry

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Simultaneous Accept/Reject
- Description: status changes on another client during action.
- Expected behavior: refresh and show current canonical state.

9.2 Blocked User Relationship
- Description: target/user is blocked.
- Expected behavior: disable connect actions and show reason.

9.3 Missing Target Module
- Description: one profile module fails (reviews/listings).
- Expected behavior: keep page partial and isolate failed module.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type ConnectionStatusPayload = {
  is_connected_to: boolean;
  is_connected_by: boolean;
  outgoing_status: string | null;
  incoming_status: string | null;
};

--------------------------------------------------

11. STATE TRANSITIONS

profile_loading -> profile_ready -> relationship_mutating -> profile_ready

Rules:
- Always refresh connection-status after mutation.
- Do not infer relationship state only from button clicks.

--------------------------------------------------

Favorites and Saved Items - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Favorites list/create/delete
Depends On: Auth, listing ids, favorites endpoint availability

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  Save and manage favorite listings.
- When does it start?
  On Favorites tab open or favorite icon interactions.
- When does it end?
  When favorite state is synced with server.
- Any important constraints (atomic, async, multi-step, etc.)
  Delete requires type and id path params.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Authenticated user.
- listingId available for toggle.
- Favorites APIs reachable.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<Favorites Open Or Toggle>
  -> Step 1: Load current favorites
  -> Step 2: Execute add/remove action
  -> Step 3: Re-sync favorite set
  -> Final Action -> Render canonical favorite state

--------------------------------------------------

4. API CALLS USED

4.1 Favorites Read
GET /api/v1/networks/user/favorites?type=listing&limit=20&offset=0

Used for:
- Favorites page and icon prefill

4.2 Favorites Mutations
POST /api/v1/networks/user/favorites
DELETE /api/v1/networks/user/favorites/:type/:id

Used for:
- Add/remove favorites

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- Favorites list is offset-based (`limit/offset`).
- Keep favorites paging separate from search results paging state.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Track favorites in Set for fast membership checks.
- Use optimistic update only when rollback is implemented.
- Re-fetch list after mutation on conflict/error.

Example:

type FavoritesState = {
  favoriteIds: Set<string>;
  loading: boolean;
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User taps favorite icon or opens favorites tab

Behavior:
- Load initial favorites.
- Toggle add/remove endpoint by current state.
- Reconcile with canonical list as needed.

Example:

api.post('/api/v1/networks/user/favorites', { item_type: 'listing', item_id: listingId })

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Update icon state immediately.
- Update favorites tab list.
- Keep user in current context.
- Navigate to favorites detail screen when requested

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show invalid favorite payload error
401 -> Redirect to auth
403 -> Show forbidden mutation state
404 -> Drop stale listing from local favorites
409 -> Re-sync favorites list and retry toggle
500 -> Roll back optimistic update

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Duplicate Favorite Add
- Description: client tries to add already-favorited listing.
- Expected behavior: keep current state without duplication.

9.2 Deleted Listing In Favorites
- Description: favorite references deleted listing.
- Expected behavior: show unavailable row and allow removal.

9.3 Rapid Toggle Spam
- Description: repeated taps create race conditions.
- Expected behavior: lock icon during in-flight mutation.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type FavoriteMutation = {
  item_type: 'listing';
  item_id: string;
};

--------------------------------------------------

11. STATE TRANSITIONS

loading -> ready -> mutating -> ready

Rules:
- Only one mutation per listing at a time.
- Canonical server state wins after conflict.

--------------------------------------------------

Notifications Center - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Notifications list, unread count, mark read, mark all read
Depends On: Auth, notification category mapping

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  Triage buying/selling/social/system notifications.
- When does it start?
  On Notifications screen open.
- When does it end?
  When read state and unread badges are synchronized.
- Any important constraints (atomic, async, multi-step, etc.)
  Mark-all-read supports optional tab scoping.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Authenticated user.
- notifications endpoints available.
- valid tab filter value.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<Notifications Open>
  -> Step 1: Load unread count
  -> Step 2: Load tab-filtered list
  -> Step 3: Run read/mark-all actions
  -> Final Action -> Refresh badges and list

--------------------------------------------------

4. API CALLS USED

4.1 Notifications Read APIs
GET /api/v1/networks/notifications?tab=all&limit=20&offset=0
GET /api/v1/networks/notifications/unread-count

Used for:
- Main list and unread badges

4.2 Read Mutations
POST /api/v1/networks/notifications/:id/read
POST /api/v1/networks/notifications/mark-all-read?tab=buying

Used for:
- Row-level and tab-level read actions

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- Notifications list uses offset-based pagination (`limit/offset`).
- Re-fetch unread count independently of paged list responses.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Keep selected tab in state and URL if applicable.
- Store unread_count separately from list data.
- Re-fetch unread count after any read mutation.

Example:

type NotificationsState = {
  tab: 'all' | 'buying' | 'selling' | 'social' | 'system';
  items: any[];
  unreadCount: number;
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User marks one item or all items as read

Behavior:
- Execute read mutation.
- Re-fetch unread count.
- Re-fetch current tab list.

Example:

api.post(`/api/v1/networks/notifications/${notificationId}/read`)

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Update row read styling.
- Update unread badge count.
- Keep user on current tab.
- Navigate to notification action URL when clicked

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Show invalid filter/tab message
401 -> Redirect to auth
403 -> Show permission denied state
404 -> Remove stale notification row
409 -> Refresh list after concurrent read update
500 -> Keep current list and show retry

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Rapid Tab Switching
- Description: user switches tabs before previous request returns.
- Expected behavior: cancel stale request and render latest tab only.

9.2 Large Unread Backlog
- Description: very high unread count with deep pagination.
- Expected behavior: paginate incrementally and keep badge accurate.

9.3 Missing Action URL
- Description: notification row has no navigation target.
- Expected behavior: mark as read and remain in list.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type NotificationItem = {
  id: string;
  type: string;
  category: 'buying' | 'selling' | 'social' | 'system';
  title: string;
  read: boolean;
};

--------------------------------------------------

11. STATE TRANSITIONS

list_loading -> list_ready -> read_mutating -> list_ready

Rules:
- unreadCount refresh is required after mutation.
- Keep previous rows until new payload resolves.

--------------------------------------------------

Onboarding Completion and Re-entry - Integration Guide

Version: 1.0
Last Updated: March 2026
Related APIs: Onboarding Status, Onboarding Complete
Depends On: Auth, required onboarding fields, user record consistency

--------------------------------------------------

1. OVERVIEW

Describe what this flow does.

- What user goal does this flow accomplish?
  Complete onboarding gate and unlock full networks experience.
- When does it start?
  When app detects incomplete onboarding status.
- When does it end?
  When status transitions to completed and user enters app.
- Any important constraints (atomic, async, multi-step, etc.)
  Completion is a single server-side completion mutation.

--------------------------------------------------

2. ENTRY CONDITIONS

User/system must meet these conditions before starting:

- Authenticated user with networks context.
- Status endpoint reports incomplete.
- Required payload fields are available.

--------------------------------------------------

3. FLOW SUMMARY

High-level step sequence:

<App Boot / Gate Check>
  -> Step 1: Fetch onboarding status
  -> Step 2: Collect missing fields
  -> Step 3: Submit completion payload
  -> Final Action -> Enter home/dashboard routes

--------------------------------------------------

4. API CALLS USED

4.1 Gate Status
GET /api/v1/networks/onboarding/status

Used for:
- Determining onboarding gate
- Computing remaining required fields

4.2 Completion
PATCH /api/v1/networks/onboarding/complete

Used for:
- Final onboarding submission

Full endpoint specs: See docs/BATCH_2_API_REQUEST_RESPONSE_ALIGNMENT.md

Pagination contract for this flow:
- Onboarding status/completion are entity-level APIs (non-paginated).
- Keep gate state management independent from any list paging adapter.

--------------------------------------------------

5. LOCAL STATE MANAGEMENT (FRONTEND)

Describe how frontend handles data during flow.

Requirements:
- Keep onboarding draft form state until submit success.
- Track required fields from status response.
- Disable submit while request is in flight.

Example:

type OnboardingState = {
  status: 'incomplete' | 'completed';
  required: string[];
  draft: Record<string, any>;
  submitting: boolean;
};

--------------------------------------------------

6. SUBMISSION / ACTION LOGIC

Triggered when:

- User taps Complete Onboarding

Behavior:
- Validate required fields client-side.
- Submit completion payload.
- Re-fetch status to confirm transition.

Example:

api.patch('/api/v1/networks/onboarding/complete', payload)

--------------------------------------------------

7. SUCCESS HANDLING

On successful response:

- Store completed onboarding state.
- Unlock protected routes.
- Clear onboarding draft cache.
- Navigate to Home Dashboard

--------------------------------------------------

8. ERROR HANDLING

Refer to Core API Spec -> Error Handling

Flow-specific handling:

400 -> Highlight invalid/missing fields
401 -> Redirect to auth
403 -> Show blocked onboarding message
404 -> Show missing user state
409 -> Treat as already-completed and continue
500 -> Keep draft data and allow retry

--------------------------------------------------

9. EDGE CASES

List real-world scenarios that must be handled:

9.1 Already Completed On Another Device
- Description: user completes onboarding elsewhere.
- Expected behavior: detect and skip gate after status refresh.

9.2 Partial Draft Loss
- Description: app reload before submit.
- Expected behavior: restore draft from local storage if available.

9.3 Invalid Region/Currency Combo
- Description: unsupported location payload submitted.
- Expected behavior: show field-specific backend validation message.

--------------------------------------------------

10. DATA CONTRACT (OPTIONAL)

Request/response shapes used in this flow.

Example:

type OnboardingCompletePayload = {
  location: Record<string, any>;
  profile: { first_name: string; last_name: string };
  avatar: Record<string, any>;
};

--------------------------------------------------

11. STATE TRANSITIONS

status_checking -> collecting -> submitting -> completed

Rules:
- Only exit onboarding gate after confirmed completed status.
- Keep gate idempotent on retry/re-entry.

--------------------------------------------------
