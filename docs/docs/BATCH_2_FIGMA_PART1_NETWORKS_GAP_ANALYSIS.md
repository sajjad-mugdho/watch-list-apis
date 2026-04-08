# Batch 2 Figma Part-1: Networks Screen-by-Screen Alignment and Gap Analysis

## Objective

Align Part-1 Figma screens to implemented backend features (primary scope: Networks domain) and identify concrete API gaps.

## Scope and Evidence

Primary code scope:

- src/networks/\*\*

Dependent platform routes used by these screens:

- src/routes/user/profile.ts
- src/routes/user/support.ts
- src/routes/newsRoutes.ts

This document is based on mounted route behavior, handler logic, and schema/model contracts.

## Status Legend

- Aligned: Direct endpoint support exists for expected behavior.
- Partial: Behavior can be built, but needs multi-call composition, field mapping, or has constraints.
- Gap: Missing endpoint/field/behavior for expected UI contract.

---

## Screen 1: Home Dashboard (both variants)

### UI-to-API alignment

| UI block                                     | API mapping                                                                        | Status  | Notes                                                                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome header (name/avatar)                 | GET /api/v1/user/profile                                                           | Partial | Uses platform route, not Networks route.                                                                                                                |
| Verification pill (Unverified / ID Verified) | GET /api/v1/user/verification                                                      | Aligned | Direct status available via persona fields.                                                                                                             |
| Account setup progress (2/5 style)           | GET /api/v1/networks/user/dashboard/stats                                          | Partial | Dashboard onboarding returns 5-item progress; separate onboarding status endpoint returns 3-step progress, so product must choose one canonical source. |
| Search input (home quick search)             | GET /api/v1/networks/search                                                        | Aligned | Supports q + type listing/iso/user.                                                                                                                     |
| Quick access: Offers and Inquiries           | GET /api/v1/networks/offers + GET /api/v1/networks/social/inbox?filter=inquiries   | Partial | No single endpoint returns combined count.                                                                                                              |
| Quick access: Tickets                        | GET /api/v1/user/support/tickets/count/open                                        | Partial | Available outside Networks namespace.                                                                                                                   |
| Quick access: Reference Checks               | GET /api/v1/networks/user/dashboard/stats or GET /api/v1/networks/reference-checks | Partial | Pending count exists, but exact card semantics (received/total/active) need UI decision.                                                                |
| Quick access: Reserved Orders                | GET /api/v1/networks/orders?status=reserved&type=buy                               | Partial | Requires deriving count from list metadata.                                                                                                             |
| Verified dealers online                      | GET /api/v1/networks/user/dashboard/stats                                          | Gap     | Implemented field is verified_dealers_global, not online presence.                                                                                      |
| Featured content grid                        | GET /api/v1/networks/listings                                                      | Partial | No dedicated featured curation endpoint/flag in Networks route contract.                                                                                |
| Recommended for you                          | None in Networks for listing recommendations                                       | Gap     | social/discover returns people/groups, not listing recommendations.                                                                                     |
| From your connections (listing cards)        | GET /api/v1/networks/user/feeds/timeline (activities) + connection routes          | Partial | No direct "listings from connections" endpoint with card-ready listing payload.                                                                         |
| Events and news card                         | GET /api/v1/news                                                                   | Partial | Exists outside Networks namespace.                                                                                                                      |

### Key gaps for Screen 1

1. No single "home aggregate" endpoint for all quick-access counts + sections.
2. No listing recommendation endpoint (personalized or connections-based) with card-ready listing data.
3. No online-verified-dealers metric, only global verified count.

---

## Screen 2: Profile - Activity Tab

### UI-to-API alignment

| UI block                                  | API mapping                                                                    | Status  | Notes                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------- |
| Profile header (name, rating, references) | GET /api/v1/user/profile                                                       | Partial | Core stats available; joined date/location are not fully shaped for this screen in one call.                 |
| Location + joined date line               | GET /api/v1/networks/users/:id/profile (with current user id)                  | Partial | Data exists in public profile route, but no dedicated self-profile endpoint in Networks with complete shape. |
| Verify identity banner                    | GET /api/v1/user/verification                                                  | Aligned | Supports identity state.                                                                                     |
| Activity cards: Active Orders             | GET /api/v1/networks/orders?status=reserved                                    | pending | paid                                                                                                         | Partial | Derived count via list metadata; no direct count endpoint. |
| Activity cards: Pending Offers            | GET /api/v1/networks/offers?status=active                                      | Partial | Derived count via list metadata; no dedicated dashboard metric for this exact card.                          |
| Activity cards: Wishlist                  | GET /api/v1/networks/user/favorites?type=listing                               | Partial | Count derivation from paginated response; no dedicated count endpoint.                                       |
| Activity cards: Reference Checks          | GET /api/v1/networks/user/dashboard/stats or /api/v1/networks/reference-checks | Partial | Needs mapping to exact card semantics.                                                                       |
| Tickets and resolutions count             | GET /api/v1/user/support/tickets/count/open + GET /api/v1/user/support/tickets | Partial | Open count exists; "resolutions" split requires additional queries.                                          |
| Learning materials list                   | None                                                                           | Gap     | No content endpoint for learning materials in current scope.                                                 |

### Key gaps for Screen 2

1. No unified self-profile payload with all header fields (location, joined date, social metrics) and activity-card counts.
2. No content service for learning materials.

---

## Screen 3: Profile - For Sale Tab

### UI-to-API alignment

| UI block                          | API mapping                                         | Status  | Notes                                                                                                             |
| --------------------------------- | --------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| My listings grid                  | GET /api/v1/networks/user/listings                  | Aligned | Supports pagination and inventory groups.                                                                         |
| Filters: All / Active / Sold      | GET /api/v1/networks/user/listings?status=all       | active  | sold                                                                                                              | Aligned | Supported status values include all, draft, active, reserved, sold, inactive. |
| Search your listings              | GET /api/v1/networks/user/listings?search=...       | Aligned | Supported.                                                                                                        |
| Listing count text                | \_metadata.paging.total from user listings response | Aligned | Available.                                                                                                        |
| Listing delete action             | DELETE /api/v1/networks/listings/:id                | Partial | Blocked if active negotiation exists or status is reserved/sold.                                                  |
| Listing edit action (pencil icon) | PATCH /api/v1/networks/listings/:id                 | Gap     | Backend only allows edits when listing status is draft. Active listing edit flow in UI is not directly supported. |
| Manage button (bulk management)   | None dedicated                                      | Gap     | No bulk management route for multi-listing operations.                                                            |

### Key gaps for Screen 3

1. Active listing edit behavior conflicts with backend rule "only draft listings can be updated".
2. No bulk manage endpoint.

---

## Screen 4: Profile - WTB Tab

### UI-to-API alignment

| UI block                          | API mapping                                  | Status  | Notes                                                                                          |
| --------------------------------- | -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- | ------- | -------------------- |
| My WTB list                       | GET /api/v1/networks/user/isos/my            | Aligned | Direct route exists.                                                                           |
| Filters: All / Active / Fulfilled | GET /api/v1/networks/user/isos/my?status=all | active  | fulfilled                                                                                      | Aligned | Supported by schema. |
| WTB card condition/year/status    | ISO criteria + status fields                 | Partial | Condition and year range are supported as criteria.year_min/year_max; UI must map accordingly. |
| WTB card contents                 | None in ISO criteria model                   | Gap     | ISO schema has no contents field.                                                              |
| Listing count text                | total in response                            | Aligned | Available.                                                                                     |

### Key gaps for Screen 4

1. ISO data model lacks contents field used by UI cards.

---

## Screen 5: Profile - References Tab

### UI-to-API alignment

| UI block                            | API mapping                                                                   | Status                         | Notes                                          |
| ----------------------------------- | ----------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| Reviews list for profile            | GET /api/v1/networks/user/reviews                                             | Aligned                        | Returns review list with pagination metadata.  |
| Filters: All / As Buyer / As Seller | GET /api/v1/networks/user/reviews?role=buyer                                  | seller (or /users/:id/reviews) | Aligned                                        | Role filter now exists on both current-user and users/:id reviews endpoints. |
| Feedback count                      | total from reviews response, or GET /api/v1/networks/users/:id/review-summary | Aligned                        | Available via response total/summary endpoint. |
| Reviewer identity + avatar + text   | Review service populates reviewer_id (display_name, avatar)                   | Aligned                        | Supported in review service.                   |

### Key gaps for Screen 5

No major backend gaps for this screen.

---

## Screen 6: Edit Profile

### UI-to-API alignment

| UI block                                          | API mapping                          | Status  | Notes                                                             |
| ------------------------------------------------- | ------------------------------------ | ------- | ----------------------------------------------------------------- |
| Load profile data                                 | GET /api/v1/user/profile             | Aligned | Returns display_name/full_name, bio, social links, stats, avatar. |
| Save basic info (name, bio)                       | PATCH /api/v1/user/profile           | Aligned | first_name, last_name, display_name/fullName, bio supported.      |
| Save social links (website, instagram, twitter/x) | PATCH /api/v1/user/profile           | Aligned | social_links.website/instagram/twitter supported.                 |
| Change photo                                      | POST /api/v1/user/avatar (multipart) | Aligned | Upload supported.                                                 |
| Remove photo                                      | None dedicated                       | Gap     | No DELETE/PATCH avatar-null endpoint.                             |
| Edit location in profile form                     | None in profile update schema        | Gap     | updateProfileSchema does not include location fields.             |
| Deactivate account                                | PATCH /api/v1/user/deactivate        | Aligned | Supported.                                                        |
| Delete account                                    | DELETE /api/v1/user                  | Aligned | Supported with active-order guard.                                |

### Key gaps for Screen 6

1. No explicit avatar removal endpoint.
2. No profile location update endpoint (outside onboarding).

---

## Screen 7: Search Landing

### UI-to-API alignment

| UI block                              | API mapping                                      | Status  | Notes                                             |
| ------------------------------------- | ------------------------------------------------ | ------- | ------------------------------------------------- | ------- | ----------------------- |
| Search tabs: For Sale / WTB / Members | GET /api/v1/networks/search?type=listing         | iso     | user                                              | Aligned | Type filters supported. |
| Recent searches list                  | GET /api/v1/networks/user/searches/recent        | Aligned | Supported.                                        |
| Delete one recent search              | DELETE /api/v1/networks/user/searches/recent/:id | Aligned | Supported.                                        |
| Clear all recent searches             | DELETE /api/v1/networks/user/searches/recent     | Aligned | Supported.                                        |
| Save search from query                | POST /api/v1/networks/user/searches/recent       | Aligned | Supported.                                        |
| Popular brands chips                  | GET /api/v1/networks/search/popular-brands       | Aligned | Returns top brands from active for-sale listings. |

### Key gaps for Screen 7

No major backend gaps for this screen.

---

## Screen 8: Search Results (Grid)

### UI-to-API alignment

| UI block                 | API mapping                                                                                           | Status                                                  | Notes                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------- |
| Result cards and count   | GET /api/v1/networks/search or GET /api/v1/networks/listings                                          | Partial                                                 | Works, but response shape differs by endpoint.                                                                 |
| Filter: Offers Accepted  | GET /api/v1/networks/listings?allow_offers=true                                                       | false and GET /api/v1/networks/search?allow_offers=true | false                                                                                                          | Aligned | Supported on both listings and unified search. |
| Filter: Year             | GET /api/v1/networks/listings?year_min=&year_max= and GET /api/v1/networks/search?year_min=&year_max= | Aligned                                                 | Canonical year params are unified; legacy min_year/max_year aliases are normalized for backward compatibility. |
| Filter: Condition        | GET /api/v1/networks/search?condition=... OR listings?condition=...                                   | Aligned                                                 | Supported.                                                                                                     |
| Filter: Contents         | GET /api/v1/networks/listings?contents= and GET /api/v1/networks/search?contents=                     | Aligned                                                 | Supported in both listings and unified search.                                                                 |
| Sort: Relevance          | GET /api/v1/networks/listings?sort_by=relevance and GET /api/v1/networks/search?sort_by=relevance     | Aligned                                                 | Canonical sort keys are unified; legacy search sort aliases are normalized for backward compatibility.         |
| Favorite toggle          | GET/POST/DELETE /api/v1/networks/user/favorites                                                       | Aligned                                                 | Supported for listing favorites.                                                                               |
| Grid/List display toggle | Client-side UI concern                                                                                | Aligned                                                 | No backend dependency.                                                                                         |

### Key gaps for Screen 8

1. Response-shape parity remains split across /search and /listings.

---

## Screen 9: Search Results (List)

### UI-to-API alignment

| UI block                               | API mapping                     | Status  | Notes                                  |
| -------------------------------------- | ------------------------------- | ------- | -------------------------------------- |
| List rows with same data as grid cards | Same as Screen 8                | Partial | Same backend constraints as grid view. |
| Share icon                             | Client-side/share deep link     | Aligned | No backend requirement.                |
| Favorite icon                          | /api/v1/networks/user/favorites | Aligned | Supported.                             |

### Key gaps for Screen 9

Same backend constraints as Screen 8 (response-shape parity differences).

---

## Cross-Screen Priority Gaps

### P0 (high-impact)

1. Active listing edit conflict: UI supports editing active listings, backend allows edits only in draft status.
2. Missing recommendation APIs for home sections (recommended listings and listings from connections).

### P1 (important)

1. No unified home aggregate endpoint for all dashboard widgets.
2. No dedicated self-profile endpoint with full header payload (location + joined + social metrics in one response).
3. No avatar remove endpoint.
4. No profile location update endpoint.
5. Search/listings response contract parity remains split.

### P2 (improvement)

1. Namespace consistency issues (some required UI data currently in /api/v1/user and /api/v1/news instead of Networks).
2. Split filter capabilities between /networks/search and /networks/listings may increase frontend branching.

---

## Alignment Implementation Backlog

1. Add a Networks home aggregate endpoint, for example:
   - GET /api/v1/networks/user/home
   - returns: verification, onboarding progress, quick-access counts, featured/recommended/from-connections listings, news snippets.

2. Standardize search/listings response contract parity for Part-1 screens:
   - align response envelope and metadata shape between /search and /listings
   - publish canonical query key guidance with alias deprecation timeline
   - keep endpoint-level consistency where possible.

3. Update listing management rules or UX contract:
   - either allow safe edits for active listings,
   - or enforce "deactivate -> edit -> republish" flow explicitly in API and docs.

4. Add missing profile operations:
   - DELETE /api/v1/user/avatar (or PATCH profile avatar null)
   - PATCH /api/v1/user/profile to include location fields.

5. Add recommendation endpoints for listings:
   - recommended for you
   - from connections
     with card-ready listing payload.

---

## Immediate Frontend-Safe Mapping (without backend changes)

1. Home screen:
   - Use /api/v1/networks/user/dashboard/stats for cards/progress,
   - /api/v1/user/verification for ID state,
   - /api/v1/networks/listings for featured fallback,
   - /api/v1/news for events.

2. Profile tabs:
   - For Sale: /api/v1/networks/user/listings
   - WTB: /api/v1/networks/user/isos/my
   - References: /api/v1/networks/users/:id/reviews for role filter.

3. Search:
   - Landing + multi-entity query: /api/v1/networks/search
   - Rich for-sale filtering fallback: /api/v1/networks/listings
   - Recent searches + popular brands via current implemented routes.
