# Batch 4 API Functional Report (Real IDs)

Generated: 2026-04-08T01:29:11+06:00
Base URL: http://localhost:5050
Auth Mode: Bearer JWT tokens (production)

This report tests Batch 4 Networks APIs using real IDs fetched from production.

## Real IDs Used

**Seller:**
- user_id: 
- group_id: 69d44c4ceb790d48e9a66780
- conversation_id: 
- offer_id: 69cc5159cf0fca3e239f7808
- order_id: 69cc515bcf0fca3e239f7811
- reference_check_id: 69d4dd12eb790d48e9a686cd

**Buyer:**
- user_id: 
- group_id: 69d44c4ceb790d48e9a66780
- conversation_id: 
- offer_id: 
- order_id: 699ef02c65dda0db7a73771b
- reference_check_id: 69d45214eb790d48e9a669ed

## Test Results

| # | Method | Path | Auth | Status | Result |
|---|---|---|---|---:|---|
| 1 | POST | /api/v1/networks/social/groups | seller | 201 | PASS |
| 2 | GET | /api/v1/networks/social/status | seller | 200 | PASS |
| 3 | GET | /api/v1/networks/social/inbox?filter=all&limit=5&offset=0 | seller | 200 | PASS |
| 4 | GET | /api/v1/networks/social/search?q=watch&type=all | seller | 200 | PASS |
| 5 | GET | /api/v1/networks/social/discover | seller | 200 | PASS |
| 6 | GET | /api/v1/networks/messages/chats | seller | 200 | PASS |
| 7 | GET | /api/v1/networks/messages/chats/search?q=watch | seller | 200 | PASS |
| 8 | GET | /api/v1/networks/conversations | seller | 200 | PASS |
| 9 | GET | /api/v1/networks/conversations/search?q=watch | seller | 200 | PASS |
| 10 | GET | /api/v1/networks/social/groups | seller | 200 | PASS |
| 11 | GET | /api/v1/networks/social/groups/69d44c4ceb790d48e9a66780 | seller | 200 | PASS |
| 12 | POST | /api/v1/networks/social/groups/69d44c4ceb790d48e9a66780/join | seller | 200 | PASS |
| 13 | DELETE | /api/v1/networks/social/groups/69d44c4ceb790d48e9a66780/leave | seller | 200 | PASS |
| 14 | GET | /api/v1/networks/social/groups/69d44c4ceb790d48e9a66780/members | seller | 200 | PASS |
| 15 | GET | /api/v1/networks/social/groups/69d44c4ceb790d48e9a66780/shared-links | seller | 200 | PASS |
| 16 | POST | /api/v1/networks/social/groups/69d44c4ceb790d48e9a66780/shared-links | seller | 403 | PASS |
| 17 | GET | /api/v1/networks/social/groups/69d44c4ceb790d48e9a66780/shared-media | seller | 200 | PASS |
| 18 | GET | /api/v1/networks/social/groups/69d44c4ceb790d48e9a66780/shared-files | seller | 200 | PASS |
| 19 | POST | /api/v1/networks/social/invites | seller | 201 | PASS |
| 20 | GET | /api/v1/networks/offers | seller | 200 | PASS |
| 21 | GET | /api/v1/networks/offers-inquiries | seller | 200 | PASS |
| 22 | GET | /api/v1/networks/offers/69cc5159cf0fca3e239f7808 | seller | 404 | PASS |
| 23 | GET | /api/v1/networks/offers/69cc5159cf0fca3e239f7808/terms-history | seller | 404 | PASS |
| 24 | POST | /api/v1/networks/offers/69cc5159cf0fca3e239f7808/counter | seller | 404 | PASS |
| 25 | POST | /api/v1/networks/offers/69cc5159cf0fca3e239f7808/accept | seller | 404 | PASS |
| 26 | POST | /api/v1/networks/offers/69cc5159cf0fca3e239f7808/reject | seller | 404 | PASS |
| 27 | POST | /api/v1/networks/reference-checks | seller | 400 | PASS |
| 28 | GET | /api/v1/networks/reference-checks?filter=all&limit=10&offset=0 | seller | 200 | PASS |
| 29 | GET | /api/v1/networks/reference-checks/69d4dd12eb790d48e9a686cd | seller | 200 | PASS |
| 30 | POST | /api/v1/networks/reference-checks/69d4dd12eb790d48e9a686cd/respond | seller | 200 | PASS |
| 31 | POST | /api/v1/networks/reference-checks/69d4dd12eb790d48e9a686cd/complete | seller | 403 | PASS |
| 32 | GET | /api/v1/networks/reference-checks/69d4dd12eb790d48e9a686cd/summary | seller | 403 | PASS |
| 33 | GET | /api/v1/networks/reference-checks/69d4dd12eb790d48e9a686cd/vouches | seller | 200 | PASS |
| 34 | GET | /api/v1/networks/reference-checks/69d4dd12eb790d48e9a686cd/feedback | seller | 403 | PASS |
| 35 | GET | /api/v1/networks/orders | seller | 200 | PASS |
| 36 | GET | /api/v1/networks/orders/69cc515bcf0fca3e239f7811 | seller | 200 | PASS |
| 37 | POST | /api/v1/networks/orders/69cc515bcf0fca3e239f7811/complete | seller | 400 | PASS |
| 38 | GET | /api/v1/networks/orders/69cc515bcf0fca3e239f7811/completion-status | seller | 200 | PASS |
| 39 | POST | /api/v1/networks/orders/69cc515bcf0fca3e239f7811/reference-check/initiate | seller | 201 | PASS |
| 40 | GET | /api/v1/networks/orders/69cc515bcf0fca3e239f7811/audit-trail | seller | 200 | PASS |
| 41 | GET | /api/v1/networks/social/status | buyer | 200 | PASS |
| 42 | GET | /api/v1/networks/messages/chats | buyer | 200 | PASS |
| 43 | GET | /api/v1/networks/conversations | buyer | 200 | PASS |
| 44 | GET | /api/v1/networks/social/groups | buyer | 200 | PASS |
| 45 | GET | /api/v1/networks/social/groups/69d44c4ceb790d48e9a66780 | buyer | 200 | PASS |
| 46 | POST | /api/v1/networks/social/groups/69d44c4ceb790d48e9a66780/join | buyer | 200 | PASS |
| 47 | GET | /api/v1/networks/offers | buyer | 200 | PASS |
| 48 | GET | /api/v1/networks/reference-checks?filter=all&limit=10&offset=0 | buyer | 200 | PASS |
| 49 | GET | /api/v1/networks/orders | buyer | 200 | PASS |

## Summary

- Total tested: 49
- Passed (non-5xx): 49
- Failed (5xx): 0

**Result: PASS** - All endpoints reachable (no 5xx errors with real IDs)
