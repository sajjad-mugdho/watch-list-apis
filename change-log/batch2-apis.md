# Batch 2 API Change Log (Non-Onboarding)

Status: Active tracking file  
Owner: Backend API team + Frontend integration owners  
Last verified: 2026-03-29

## Recent Security & Bug Fixes (2026-03-29)

**Status:** Critical fixes implemented and verified  
**PR:** Review fixes for CodeRabbit/Copilot feedback

### Fixes Applied

1. **Notification Mutations Now User-Scoped** (P1 Security)
   - Issue: NotificationService.markAsRead() and delete() mutated by \_id only, allowing privilege escalation
   - Fix: Added userId parameter, now filters by {\_id, user_id, platform: "networks"}
   - Files: src/networks/services/NotificationService.ts, src/networks/routes/notificationRoutes.ts
   - Impact: 401/403 responses if user not owner of notification

2. **Regex Injection Escape** (P1 Security)
   - Issue: Raw user input in $regex for category/contents (ReDoS/injection risk)
   - Fix: Added escapeRegex() helper, escapes all metacharacters before pattern
   - Files: src/utils/listingFilters.ts
   - Impact: Prevents regex injection attacks, blocks ReDoS patterns

3. **Finix Webhook Secret Required** (P1 Security)
   - Issue: Empty secret allows unsigned webhook forgery in production
   - Fix: Added FINIX_WEBHOOK_SECRET to requiredEnvVars, app now fails to start without it
   - Files: src/config/index.ts
   - Impact: Prevents unsigned webhook acceptance

4. **Query Mode Parameter Added** (P2 Logic)
   - Issue: Both $regex and $text applied to same query, changing ranking semantics
   - Fix: Added queryMode parameter ("regex" | "text"), skips $or when mode="text"
   - Files: src/utils/listingFilters.ts
   - Impact: Correct search results for relevance-based queries

5. **Offset Pagination Precision Preserved** (P2 Logic)
   - Issue: Math.floor(offset/limit) loses precision (offset=15&limit=10 → skip=10, loses 5 items)
   - Fix: Removed page conversion, keep offset-based pagination intact
   - Files: src/networks/middleware/normalizeListingQuery.ts
   - Impact: No duplicate/skipped items with non-multiple offsets

---

## Consolidated Profile API Update (2026-03-29)

**Status:** Implemented in backend and promoted for frontend integration

### New Primary Endpoint

- GET /api/v1/networks/user/profile

### Purpose

- Reduce profile/home page fan-out calls by consolidating:
  - profile identity fields
  - verification state
  - onboarding progress
  - top activity/stat counts (orders/offers/wishlist/reference checks/tickets)

### Migration Guidance

- Frontend home/profile screens should use GET /api/v1/networks/user/profile as the primary source.
- Keep /api/v1/user/profile and /api/v1/networks/user/dashboard/stats as legacy compatibility endpoints during transition.
- Other-user routes remain separate and unchanged under /api/v1/networks/users/:id/\*.

---

## Purpose

This file is the persistent change log and contract tracker for Batch 2 non-onboarding APIs.

If any Batch 2 API changes, update this file in the same PR.

## Update Rule (Mandatory)

When any of these change, update this file immediately:

- endpoint path or method
- required request fields
- response envelope or key names
- status code behavior
- pagination model for an endpoint
- canonical query key mapping

## Coverage Verification Snapshot

Verification source:

- docs/BATCH_2_PART1_PART2_FINAL_INTEGRATION_GUIDE.md
- docs/BATCH_2_NEEDED_FEATURE_APIS_SPEC.md

Normalization used:

- compare method + path only
- remove query examples from comparison
- exclude onboarding endpoints by policy

Coverage result on 2026-03-27:

- Guide non-onboarding endpoints: 54
- Spec endpoints: 54
- Missing in spec: 0
- Extra in spec: 0
- Final status: Fully covered

## Endpoint Inventory (Canonical, Non-Onboarding)

1. DELETE /api/v1/networks/connections/:id
2. DELETE /api/v1/networks/listings/:id
3. DELETE /api/v1/networks/user/favorites/:type/:id
4. DELETE /api/v1/networks/user/searches/recent
5. DELETE /api/v1/networks/user/searches/recent/:id
6. DELETE /api/v1/user
7. GET /api/v1/networks/connections
8. GET /api/v1/networks/connections/my-incoming
9. GET /api/v1/networks/connections/my-outgoing
10. GET /api/v1/networks/listings
11. GET /api/v1/networks/listings/:id
12. GET /api/v1/networks/listings/:id/offers
13. GET /api/v1/networks/notifications
14. GET /api/v1/networks/notifications/unread-count
15. GET /api/v1/networks/offers
16. GET /api/v1/networks/offers/:id
17. GET /api/v1/networks/orders
18. GET /api/v1/networks/orders/:id
19. GET /api/v1/networks/search
20. GET /api/v1/networks/search/popular-brands
21. GET /api/v1/networks/social/inbox
22. GET /api/v1/networks/user/dashboard/stats (legacy compatibility)
23. GET /api/v1/networks/user/profile
24. GET /api/v1/networks/user/favorites
25. GET /api/v1/networks/user/isos/my
26. GET /api/v1/networks/user/listings
27. GET /api/v1/networks/user/reviews
28. GET /api/v1/networks/user/searches/recent
29. GET /api/v1/networks/users/:id/connection-status
30. GET /api/v1/networks/users/:id/listings
31. GET /api/v1/networks/users/:id/profile
32. GET /api/v1/networks/users/:id/reviews
33. GET /api/v1/networks/users/:id/review-summary
34. GET /api/v1/news
35. GET /api/v1/user/profile (legacy compatibility)
36. GET /api/v1/user/support/tickets/count/open
37. GET /api/v1/user/verification
38. PATCH /api/v1/networks/listings/:id
39. PATCH /api/v1/user/deactivate
40. PATCH /api/v1/user/profile
41. POST /api/v1/networks/connections/:id/accept
42. POST /api/v1/networks/connections/:id/reject
43. POST /api/v1/networks/connections/send-request
44. POST /api/v1/networks/listings/:id/inquire
45. POST /api/v1/networks/listings/:id/offers
46. POST /api/v1/networks/listings/:id/reserve
47. POST /api/v1/networks/notifications/:id/read
48. POST /api/v1/networks/notifications/mark-all-read
49. POST /api/v1/networks/offers/:id/accept
50. POST /api/v1/networks/offers/:id/counter
51. POST /api/v1/networks/offers/:id/reject
52. POST /api/v1/networks/orders/:id/complete
53. POST /api/v1/networks/user/favorites
54. POST /api/v1/networks/user/searches/recent
55. POST /api/v1/user/avatar

## 500 Status Failure

Frontend behavior on 500:

- Keep previous state
- Show retry action
- Do not clear current screen model
- Preserve user input where applicable

## 12. Working Rules for the Frontend

- Always send canonical query keys from UI code.
- Treat 409 as a state drift signal and re-fetch.
- Normalize pagination into one internal model per screen.
- Use a shared adapter to map page/limit and limit/offset into the UI paging state.
- Keep route state separate from server entity state.
- For notifications, re-fetch unread count after every read mutation.
- For favorites, prefer Set<string> in UI memory for fast membership checks.
- For offers/orders, always trust the latest server response for terminal state.

## 13. Excluded From This Spec

The following are intentionally excluded:

- /api/v1/networks/onboarding/status
- /api/v1/networks/onboarding/complete

## 14. Status Code Summary

- 200 Success: Render/update UI
- 201 Created: Store returned entity
- 400 Validation/business error: Show field or rule message
- 401 Unauthorized: Redirect to sign-in
- 403 Forbidden: Show permission denied state
- 404 Not found: Show empty state or remove stale row
- 409 Conflict: Re-fetch and reconcile
- 500 Server error: Keep previous state and retry

## 15. Canonical Key Reference

- year_min <- min_year (Search, Listings)
- year_max <- max_year (Search, Listings)
- sort_by <- sort (Search, Listings)
- sort_order <- encoded in sort value (Search, Listings)

Note:

- Backend accepts legacy aliases via normalization middleware.
- Frontend should always send canonical keys.

## Change History

### 2026-03-27

- Created dedicated Batch 2 API change log file for non-onboarding endpoints.
- Recorded endpoint inventory (54 canonical endpoints).
- Recorded working rules, exclusions, status summary, and canonical key mapping.
- Marked this file as mandatory update target for any Batch 2 API contract changes.
