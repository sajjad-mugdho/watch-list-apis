# Batch 2 API Change Log (Non-Onboarding)

Status: Active tracking file  
Owner: Backend API team + Frontend integration owners  
Last verified: 2026-03-27

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
22. GET /api/v1/networks/user/dashboard/stats
23. GET /api/v1/networks/user/favorites
24. GET /api/v1/networks/user/isos/my
25. GET /api/v1/networks/user/listings
26. GET /api/v1/networks/user/reviews
27. GET /api/v1/networks/user/searches/recent
28. GET /api/v1/networks/users/:id/connection-status
29. GET /api/v1/networks/users/:id/listings
30. GET /api/v1/networks/users/:id/profile
31. GET /api/v1/networks/users/:id/reviews
32. GET /api/v1/networks/users/:id/review-summary
33. GET /api/v1/news
34. GET /api/v1/user/profile
35. GET /api/v1/user/support/tickets/count/open
36. GET /api/v1/user/verification
37. PATCH /api/v1/networks/listings/:id
38. PATCH /api/v1/user/deactivate
39. PATCH /api/v1/user/profile
40. POST /api/v1/networks/connections/:id/accept
41. POST /api/v1/networks/connections/:id/reject
42. POST /api/v1/networks/connections/send-request
43. POST /api/v1/networks/listings/:id/inquire
44. POST /api/v1/networks/listings/:id/offers
45. POST /api/v1/networks/listings/:id/reserve
46. POST /api/v1/networks/notifications/:id/read
47. POST /api/v1/networks/notifications/mark-all-read
48. POST /api/v1/networks/offers/:id/accept
49. POST /api/v1/networks/offers/:id/counter
50. POST /api/v1/networks/offers/:id/reject
51. POST /api/v1/networks/orders/:id/complete
52. POST /api/v1/networks/user/favorites
53. POST /api/v1/networks/user/searches/recent
54. POST /api/v1/user/avatar

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
