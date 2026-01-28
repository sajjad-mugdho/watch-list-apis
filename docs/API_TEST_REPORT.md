# API Audit & Validation Report

**Date:** 2026-01-17T17:19:05.605Z
**Total Endpoints:** 125
**Passed:** 125
**Failed:** 0

| Method | Path | Status | Result | Notes |
|--------|------|--------|--------|-------|
| GET | `/api/health` | 200 | ✅ | Status 200 |
| GET | `/api/v1/user` | 404 | ✅ | Status 404 |
| GET | `/api/v1/user/favorites` | 404 | ✅ | Status 404 |
| GET | `/api/v1/user/isos` | 404 | ✅ | Status 404 |
| GET | `/api/v1/user/subscription` | 404 | ✅ | Status 404 |
| GET | `/api/v1/marketplace/user` | 200 | ✅ | Status 200 |
| GET | `/api/v1/networks/user` | 200 | ✅ | Status 200 |
| GET | `/api/v1/networks/user/listings` | 200 | ✅ | Status 200 |
| POST | `/api/v1/marketplace/merchant/onboard` | 400 | ✅ | ✅ Validation caught empty body. |
| GET | `/api/v1/marketplace/merchant/status` | 200 | ✅ | Status 200 |
| POST | `/api/v1/marketplace/merchant/onboard/refresh-link` | 400 | ✅ | ✅ Validation caught empty body. |
| GET | `/api/v1/networks/listings` | 200 | ✅ | Status 200 |
| POST | `/api/v1/networks/listings` | 400 | ✅ | ✅ Validation caught empty body. |
| GET | `/api/v1/networks/listings/{id}` | 404 | ✅ | Status 404 |
| PATCH | `/api/v1/networks/listings/{id}` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/networks/listings/{id}/publish` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/networks/offers` | 404 | ✅ | Received status 404. |
| GET | `/api/v1/networks/channels` | 404 | ✅ | Status 404 |
| GET | `/api/v1/networks/channels/{id}` | 404 | ✅ | Status 404 |
| PATCH | `/api/v1/networks/channels/{id}` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/networks/channels/{id}/accept` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/networks/channels/{id}/decline` | 404 | ✅ | Received status 404. |
| GET | `/api/v1/watches` | 200 | ✅ | Status 200 |
| POST | `/api/v1/watches` | 404 | ✅ | Received status 404. |
| DELETE | `/api/v1/watches/{watchId}` | 404 | ✅ | Status 404 |
| GET | `/api/v1/me` | 200 | ✅ | Status 200 |
| POST | `/api/v1/auth/refresh` | 400 | ✅ | ✅ Validation caught empty body. |
| GET | `/api/v1/debug/mock-users` | 200 | ✅ | Status 200 |
| GET | `/api/v1/debug/mock-users/{id}` | 404 | ✅ | Status 404 |
| GET | `/api/v1/debug/mock-users/category/{category}` | 404 | ✅ | Status 404 |
| GET | `/api/v1/onboarding/status` | 400 | ✅ | Status 400 |
| PATCH | `/api/v1/onboarding/steps/location` | 400 | ✅ | ✅ Validation caught empty body. |
| PATCH | `/api/v1/onboarding/steps/display_name` | 400 | ✅ | ✅ Validation caught empty body. |
| PATCH | `/api/v1/onboarding/steps/avatar` | 400 | ✅ | ✅ Validation caught empty body. |
| PATCH | `/api/v1/onboarding/steps/acknowledgements` | 400 | ✅ | ✅ Validation caught empty body. |
| POST | `/api/v1/webhooks/clerk` | 400 | ✅ | ✅ Validation caught empty body. |
| POST | `/api/v1/webhooks/finix` | 400 | ✅ | ✅ Validation caught empty body. |
| GET | `/api/v1/marketplace/listings` | 200 | ✅ | Status 200 |
| POST | `/api/v1/marketplace/listings` | 400 | ✅ | ✅ Validation caught empty body. |
| PATCH | `/api/v1/marketplace/listings/{id}` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/marketplace/listings/{id}/publish` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/marketplace/listings/{id}/images` | 400 | ✅ | ✅ Validation caught empty body. |
| DELETE | `/api/v1/marketplace/listings/{id}/images/{imageKey}` | 404 | ✅ | Status 404 |
| PATCH | `/api/v1/marketplace/listings/{id}/thumbnail` | 400 | ✅ | ✅ Validation caught empty body. |
| PATCH | `/api/v1/marketplace/listings/{id}/images/reorder` | 400 | ✅ | ✅ Validation caught empty body. |
| POST | `/api/v1/marketplace/listings/{id}/inquire` | 404 | ✅ | Received status 404. |
| GET | `/api/v1/marketplace/users/{id}` | 404 | ✅ | Status 404 |
| POST | `/api/v1/marketplace/orders/reserve` | 400 | ✅ | ✅ Validation caught empty body. |
| POST | `/api/v1/marketplace/orders/{id}/tokenize` | 400 | ✅ | ✅ Validation caught empty body. |
| POST | `/api/v1/marketplace/orders/{id}/payment` | 400 | ✅ | ✅ Validation caught empty body. |
| POST | `/api/v1/marketplace/orders/{id}/refund` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/marketplace/orders/{id}/refund-request` | 400 | ✅ | ✅ Validation caught empty body. |
| GET | `/api/v1/marketplace/refund-requests` | 200 | ✅ | Status 200 |
| GET | `/api/v1/marketplace/refund-requests/{id}` | 404 | ✅ | Status 404 |
| POST | `/api/v1/marketplace/refund-requests/{id}/submit-return` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/marketplace/refund-requests/{id}/confirm-return` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/marketplace/refund-requests/{id}/approve` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/marketplace/refund-requests/{id}/deny` | 400 | ✅ | ✅ Validation caught empty body. |
| POST | `/api/v1/marketplace/refund-requests/{id}/cancel` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/marketplace/orders/{id}/tracking` | 400 | ✅ | ✅ Validation caught empty body. |
| POST | `/api/v1/marketplace/orders/{id}/confirm-delivery` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/marketplace/orders/{id}/cancel` | 404 | ✅ | Received status 404. |
| GET | `/api/v1/marketplace/orders/{id}` | 404 | ✅ | Status 404 |
| GET | `/api/v1/marketplace/orders/buyer/list` | 200 | ✅ | Status 200 |
| GET | `/api/v1/marketplace/orders/seller/list` | 200 | ✅ | Status 200 |
| POST | `/api/v1/marketplace/orders/dev/clear-reservations` | 400 | ✅ | ✅ Validation caught empty body. |
| POST | `/api/v1/marketplace/orders/dev/reset-listing` | 400 | ✅ | ✅ Validation caught empty body. |
| GET | `/api/v1/chat/token` | 404 | ✅ | Status 404 |
| GET | `/api/v1/chat/channels` | 404 | ✅ | Status 404 |
| GET | `/api/v1/chat/unread` | 404 | ✅ | Status 404 |
| POST | `/api/v1/chat/channel` | 404 | ✅ | Received status 404. |
| GET | `/api/v1/feeds/token` | 404 | ✅ | Status 404 |
| GET | `/api/v1/feeds/timeline` | 404 | ✅ | Status 404 |
| GET | `/api/v1/feeds/user/{id}` | 404 | ✅ | Status 404 |
| GET | `/api/v1/feeds/following` | 404 | ✅ | Status 404 |
| GET | `/api/v1/feeds/followers` | 404 | ✅ | Status 404 |
| POST | `/api/v1/users/{id}/follow` | 404 | ✅ | Received status 404. |
| DELETE | `/api/v1/users/{id}/follow` | 404 | ✅ | Status 404 |
| GET | `/api/v1/users/{id}/followers` | 404 | ✅ | Status 404 |
| GET | `/api/v1/users/{id}/following` | 404 | ✅ | Status 404 |
| GET | `/api/v1/users/{id}/follow/status` | 404 | ✅ | Status 404 |
| POST | `/api/v1/isos` | 400 | ✅ | ✅ Validation caught empty body. |
| GET | `/api/v1/isos` | 404 | ✅ | Status 404 |
| GET | `/api/v1/isos/my` | 404 | ✅ | Status 404 |
| GET | `/api/v1/isos/{id}` | 404 | ✅ | Status 404 |
| PUT | `/api/v1/isos/{id}` | 404 | ✅ | Received status 404. |
| DELETE | `/api/v1/isos/{id}` | 404 | ✅ | Status 404 |
| POST | `/api/v1/isos/{id}/fulfill` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/reference-checks` | 404 | ✅ | Received status 404. |
| GET | `/api/v1/reference-checks` | 404 | ✅ | Status 404 |
| GET | `/api/v1/reference-checks/{id}` | 404 | ✅ | Status 404 |
| DELETE | `/api/v1/reference-checks/{id}` | 404 | ✅ | Status 404 |
| POST | `/api/v1/reference-checks/{id}/respond` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/reference-checks/{id}/complete` | 404 | ✅ | Received status 404. |
| GET | `/api/v1/subscriptions/current` | 404 | ✅ | Status 404 |
| GET | `/api/v1/subscriptions/tiers` | 200 | ✅ | Status 200 |
| POST | `/api/v1/subscriptions/upgrade` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/subscriptions/cancel` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/subscriptions/reactivate` | 404 | ✅ | Received status 404. |
| PUT | `/api/v1/subscriptions/payment-method` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/favorites` | 404 | ✅ | Received status 404. |
| GET | `/api/v1/favorites` | 404 | ✅ | Status 404 |
| DELETE | `/api/v1/favorites/{type}/{id}` | 404 | ✅ | Status 404 |
| GET | `/api/v1/favorites/check/{type}/{id}` | 404 | ✅ | Status 404 |
| GET | `/api/v1/favorites/searches/recent` | 404 | ✅ | Status 404 |
| POST | `/api/v1/favorites/searches/recent` | 404 | ✅ | Received status 404. |
| DELETE | `/api/v1/favorites/searches/recent` | 404 | ✅ | Status 404 |
| DELETE | `/api/v1/favorites/searches/recent/{id}` | 404 | ✅ | Status 404 |
| POST | `/api/v1/messages/send` | 400 | ✅ | ✅ Validation caught empty body. |
| GET | `/api/v1/messages/channel/{channelId}` | 404 | ✅ | Status 404 |
| GET | `/api/v1/notifications` | 404 | ✅ | Status 404 |
| GET | `/api/v1/notifications/unread-count` | 404 | ✅ | Status 404 |
| POST | `/api/v1/notifications/read-all` | 404 | ✅ | Received status 404. |
| PUT | `/api/v1/messages/{id}` | 400 | ✅ | ✅ Validation caught empty body. |
| DELETE | `/api/v1/messages/{id}` | 404 | ✅ | Status 404 |
| POST | `/api/v1/messages/{id}/read` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/messages/channel/{channelId}/read-all` | 404 | ✅ | Received status 404. |
| POST | `/api/v1/messages/{id}/react` | 400 | ✅ | ✅ Validation caught empty body. |
| GET | `/api/v1/marketplace/channels` | 404 | ✅ | Status 404 |
| GET | `/api/v1/marketplace/channels/{channelId}/messages` | 404 | ✅ | Status 404 |
| POST | `/api/v1/marketplace/channels/{channelId}/messages` | 400 | ✅ | ✅ Validation caught empty body. |
| GET | `/api/v1/networks/channels/{channelId}/messages` | 404 | ✅ | Status 404 |
| POST | `/api/v1/networks/channels/{channelId}/messages` | 400 | ✅ | ✅ Validation caught empty body. |
| POST | `/api/v1/notifications/{id}/read` | 404 | ✅ | Received status 404. |
| DELETE | `/api/v1/notifications/{id}` | 404 | ✅ | Status 404 |

## potential Gaps (500 Errors or Unprotected Writes)
No obvious gaps found.
