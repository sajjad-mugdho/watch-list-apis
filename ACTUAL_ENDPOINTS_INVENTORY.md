# COMPLETE API ENDPOINT INVENTORY
## Total: 250 Endpoints
### Generated from actual codebase routes (not documentation)

## TOP-LEVEL / CORE ENDPOINTS (16)

### Admin (9)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/admin/trust-cases/` | trustCaseRoutes.ts |
| POST   | `/v1/admin/trust-cases/` | trustCaseRoutes.ts |
| GET    | `/v1/admin/trust-cases/:id` | trustCaseRoutes.ts |
| PUT    | `/v1/admin/trust-cases/:id/assign` | trustCaseRoutes.ts |
| PUT    | `/v1/admin/trust-cases/:id/close` | trustCaseRoutes.ts |
| PUT    | `/v1/admin/trust-cases/:id/escalate` | trustCaseRoutes.ts |
| POST   | `/v1/admin/trust-cases/:id/note` | trustCaseRoutes.ts |
| PUT    | `/v1/admin/trust-cases/:id/resolve` | trustCaseRoutes.ts |
| POST   | `/v1/admin/trust-cases/:id/suspend-user` | trustCaseRoutes.ts |

### Analytics (2)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/analytics/listing/:listingId/messages` | analyticsRoutes.ts |
| GET    | `/v1/analytics/messages` | analyticsRoutes.ts |

### User (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/user/verification` | profile.ts |

### News (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/news/` | newsRoutes.ts |

### Webhooks (3)
| Method | Endpoint | Route File |
|--------|----------|------------|
| POST   | `/v1/webhooks/` | getstreamWebhookRoutes.ts |
| POST   | `/v1/webhooks/clerk` | webhooksRoutes.ts |
| POST   | `/v1/webhooks/persona` | webhooksRoutes.ts |


## NETWORKS ENDPOINTS (164)

### /:chatId (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/:chatId/history` | messageRoutes.ts |

### /:id (81)
| Method | Endpoint | Route File |
|--------|----------|------------|
| DELETE | `/v1/networks/:id` | connectionRoutes.ts |
| GET    | `/v1/networks/:id` | conversationRoutes.ts |
| GET    | `/v1/networks/:id` | isoRoutes.ts |
| PUT    | `/v1/networks/:id` | isoRoutes.ts |
| DELETE | `/v1/networks/:id` | isoRoutes.ts |
| GET    | `/v1/networks/:id` | listingRoutes.ts |
| PATCH  | `/v1/networks/:id` | listingRoutes.ts |
| DELETE | `/v1/networks/:id` | listingRoutes.ts |
| PUT    | `/v1/networks/:id` | messageRoutes.ts |
| DELETE | `/v1/networks/:id` | messageRoutes.ts |
| DELETE | `/v1/networks/:id` | notificationRoutes.ts |
| GET    | `/v1/networks/:id` | offerRoutes.ts |
| GET    | `/v1/networks/:id` | orderRoutes.ts |
| GET    | `/v1/networks/:id` | referenceCheckRoutes.ts |
| DELETE | `/v1/networks/:id` | referenceCheckRoutes.ts |
| GET    | `/v1/networks/:id` | reservationRoutes.ts |
| GET    | `/v1/networks/:id` | userRoutes.ts |
| PATCH  | `/v1/networks/:id` | userRoutes.ts |
| POST   | `/v1/networks/:id/accept` | connectionRoutes.ts |
| POST   | `/v1/networks/:id/accept` | offerRoutes.ts |
| GET    | `/v1/networks/:id/appeal-status` | usersRoutes.ts |
| GET    | `/v1/networks/:id/appeals` | usersRoutes.ts |
| POST   | `/v1/networks/:id/appeals` | usersRoutes.ts |
| GET    | `/v1/networks/:id/audit` | referenceCheckRoutes.ts |
| GET    | `/v1/networks/:id/audit-trail` | orderRoutes.ts |
| POST   | `/v1/networks/:id/block` | usersRoutes.ts |
| DELETE | `/v1/networks/:id/block` | usersRoutes.ts |
| GET    | `/v1/networks/:id/common-groups` | userRoutes.ts |
| GET    | `/v1/networks/:id/common-groups` | usersRoutes.ts |
| POST   | `/v1/networks/:id/complete` | orderRoutes.ts |
| POST   | `/v1/networks/:id/complete` | referenceCheckRoutes.ts |
| GET    | `/v1/networks/:id/completion-status` | orderRoutes.ts |
| POST   | `/v1/networks/:id/concierge` | listingRoutes.ts |
| GET    | `/v1/networks/:id/connection-status` | usersRoutes.ts |
| POST   | `/v1/networks/:id/connections` | usersRoutes.ts |
| DELETE | `/v1/networks/:id/connections` | usersRoutes.ts |
| GET    | `/v1/networks/:id/connections/incoming` | usersRoutes.ts |
| GET    | `/v1/networks/:id/connections/outgoing` | usersRoutes.ts |
| GET    | `/v1/networks/:id/context` | referenceCheckRoutes.ts |
| POST   | `/v1/networks/:id/counter` | offerRoutes.ts |
| POST   | `/v1/networks/:id/decline` | offerRoutes.ts |
| POST   | `/v1/networks/:id/feedback` | referenceCheckRoutes.ts |
| GET    | `/v1/networks/:id/feedback` | referenceCheckRoutes.ts |
| POST   | `/v1/networks/:id/fulfill` | isoRoutes.ts |
| POST   | `/v1/networks/:id/images` | listingRoutes.ts |
| DELETE | `/v1/networks/:id/images/:imageKey` | listingRoutes.ts |
| POST   | `/v1/networks/:id/inquire` | listingRoutes.ts |
| GET    | `/v1/networks/:id/listings` | usersRoutes.ts |
| GET    | `/v1/networks/:id/media` | conversationRoutes.ts |
| POST   | `/v1/networks/:id/offers` | listingRoutes.ts |
| GET    | `/v1/networks/:id/offers` | listingRoutes.ts |
| GET    | `/v1/networks/:id/preview` | listingRoutes.ts |
| GET    | `/v1/networks/:id/profile` | usersRoutes.ts |
| GET    | `/v1/networks/:id/progress` | referenceCheckRoutes.ts |
| POST   | `/v1/networks/:id/publish` | listingRoutes.ts |
| POST   | `/v1/networks/:id/react` | messageRoutes.ts |
| POST   | `/v1/networks/:id/read` | messageRoutes.ts |
| POST   | `/v1/networks/:id/read` | notificationRoutes.ts |
| POST   | `/v1/networks/:id/reference-check/initiate` | orderRoutes.ts |
| GET    | `/v1/networks/:id/references` | userRoutes.ts |
| GET    | `/v1/networks/:id/references` | usersRoutes.ts |
| POST   | `/v1/networks/:id/reject` | connectionRoutes.ts |
| POST   | `/v1/networks/:id/reject` | offerRoutes.ts |
| POST   | `/v1/networks/:id/report` | usersRoutes.ts |
| POST   | `/v1/networks/:id/reserve` | listingRoutes.ts |
| POST   | `/v1/networks/:id/respond` | referenceCheckRoutes.ts |
| GET    | `/v1/networks/:id/review-summary` | usersRoutes.ts |
| GET    | `/v1/networks/:id/reviews` | usersRoutes.ts |
| POST   | `/v1/networks/:id/share-link` | referenceCheckRoutes.ts |
| GET    | `/v1/networks/:id/shared/files` | conversationRoutes.ts |
| GET    | `/v1/networks/:id/shared/links` | conversationRoutes.ts |
| GET    | `/v1/networks/:id/shared/media` | conversationRoutes.ts |
| PATCH  | `/v1/networks/:id/status` | listingRoutes.ts |
| GET    | `/v1/networks/:id/summary` | referenceCheckRoutes.ts |
| POST   | `/v1/networks/:id/suspend` | referenceCheckRoutes.ts |
| GET    | `/v1/networks/:id/terms-history` | offerRoutes.ts |
| POST   | `/v1/networks/:id/trust-safety/appeal` | referenceCheckRoutes.ts |
| GET    | `/v1/networks/:id/trust-safety/status` | referenceCheckRoutes.ts |
| POST   | `/v1/networks/:id/vouch` | referenceCheckRoutes.ts |
| GET    | `/v1/networks/:id/vouch-policy` | referenceCheckRoutes.ts |
| GET    | `/v1/networks/:id/vouches` | referenceCheckRoutes.ts |

### /blocks (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/blocks` | userRoutes.ts |

### /channel (4)
| Method | Endpoint | Route File |
|--------|----------|------------|
| POST   | `/v1/networks/channel` | chatRoutes.ts |
| GET    | `/v1/networks/channel/:channelId` | messageRoutes.ts |
| POST   | `/v1/networks/channel/:channelId/archive` | messageRoutes.ts |
| POST   | `/v1/networks/channel/:channelId/read-all` | messageRoutes.ts |

### /channels (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/channels` | chatRoutes.ts |

### /chat-profile (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/chat-profile/:userId` | socialRoutes.ts |

### /chats (2)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/chats` | messageRoutes.ts |
| GET    | `/v1/networks/chats/search` | messageRoutes.ts |

### /complete (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| PATCH  | `/v1/networks/complete` | onboardingRoutes.ts |

### /connections (7)
| Method | Endpoint | Route File |
|--------|----------|------------|
| POST   | `/v1/networks/connections/:id` | userRoutes.ts |
| DELETE | `/v1/networks/connections/:id` | userRoutes.ts |
| GET    | `/v1/networks/connections/incoming` | userRoutes.ts |
| GET    | `/v1/networks/connections/outgoing` | userRoutes.ts |
| GET    | `/v1/networks/connections/requests` | userRoutes.ts |
| POST   | `/v1/networks/connections/requests/:id/accept` | userRoutes.ts |
| POST   | `/v1/networks/connections/requests/:id/reject` | userRoutes.ts |

### /conversations (3)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/conversations/:id/content` | socialRoutes.ts |
| GET    | `/v1/networks/conversations/:id/events` | socialRoutes.ts |
| GET    | `/v1/networks/conversations/:id/search` | socialRoutes.ts |

### /dashboard (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/dashboard/stats` | userRoutes.ts |

### /discover (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/discover` | socialRoutes.ts |

### /favorites (3)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/favorites` | userRoutes.ts |
| POST   | `/v1/networks/favorites` | userRoutes.ts |
| DELETE | `/v1/networks/favorites/:type/:id` | userRoutes.ts |

### /followers (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/followers` | feedRoutes.ts |

### /following (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/following` | feedRoutes.ts |

### /groups (14)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/groups` | socialRoutes.ts |
| POST   | `/v1/networks/groups` | socialRoutes.ts |
| POST   | `/v1/networks/groups/:group_id/join` | socialRoutes.ts |
| DELETE | `/v1/networks/groups/:group_id/leave` | socialRoutes.ts |
| GET    | `/v1/networks/groups/:id` | socialRoutes.ts |
| GET    | `/v1/networks/groups/:id/members` | socialRoutes.ts |
| POST   | `/v1/networks/groups/:id/members` | socialRoutes.ts |
| DELETE | `/v1/networks/groups/:id/members/:userId` | socialRoutes.ts |
| PATCH  | `/v1/networks/groups/:id/members/:userId/role` | socialRoutes.ts |
| POST   | `/v1/networks/groups/:id/mute` | socialRoutes.ts |
| GET    | `/v1/networks/groups/:id/shared-files` | socialRoutes.ts |
| GET    | `/v1/networks/groups/:id/shared-links` | socialRoutes.ts |
| POST   | `/v1/networks/groups/:id/shared-links` | socialRoutes.ts |
| GET    | `/v1/networks/groups/:id/shared-media` | socialRoutes.ts |

### /inbox (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/inbox` | socialRoutes.ts |

### /invites (2)
| Method | Endpoint | Route File |
|--------|----------|------------|
| POST   | `/v1/networks/invites` | socialRoutes.ts |
| GET    | `/v1/networks/invites/:token` | socialRoutes.ts |

### /listings (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/listings` | userRoutes.ts |

### /mark-all-read (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| POST   | `/v1/networks/mark-all-read` | notificationRoutes.ts |

### /my (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/my` | isoRoutes.ts |

### /my-incoming (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/my-incoming` | connectionRoutes.ts |

### /my-outgoing (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/my-outgoing` | connectionRoutes.ts |

### /popular-brands (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/popular-brands` | searchRoutes.ts |

### /profile (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/profile` | userRoutes.ts |

### /reviews (2)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/reviews` | userRoutes.ts |
| POST   | `/v1/networks/reviews` | userRoutes.ts |

### /root (13)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/` | connectionRoutes.ts |
| GET    | `/v1/networks/` | conversationRoutes.ts |
| POST   | `/v1/networks/` | isoRoutes.ts |
| GET    | `/v1/networks/` | isoRoutes.ts |
| GET    | `/v1/networks/` | listingRoutes.ts |
| POST   | `/v1/networks/` | listingRoutes.ts |
| GET    | `/v1/networks/` | notificationRoutes.ts |
| GET    | `/v1/networks/` | offerRoutes.ts |
| GET    | `/v1/networks/` | orderRoutes.ts |
| POST   | `/v1/networks/` | referenceCheckRoutes.ts |
| GET    | `/v1/networks/` | referenceCheckRoutes.ts |
| GET    | `/v1/networks/` | searchRoutes.ts |
| GET    | `/v1/networks/` | userRoutes.ts |

### /search (2)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/search` | conversationRoutes.ts |
| GET    | `/v1/networks/search` | socialRoutes.ts |

### /searches (4)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/searches/recent` | userRoutes.ts |
| POST   | `/v1/networks/searches/recent` | userRoutes.ts |
| DELETE | `/v1/networks/searches/recent` | userRoutes.ts |
| DELETE | `/v1/networks/searches/recent/:id` | userRoutes.ts |

### /send (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| POST   | `/v1/networks/send` | messageRoutes.ts |

### /send-request (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| POST   | `/v1/networks/send-request` | connectionRoutes.ts |

### /status (2)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/status` | onboardingRoutes.ts |
| GET    | `/v1/networks/status` | socialRoutes.ts |

### /timeline (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/timeline` | feedRoutes.ts |

### /token (2)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/token` | chatRoutes.ts |
| GET    | `/v1/networks/token` | feedRoutes.ts |

### /unread (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/unread` | chatRoutes.ts |

### /unread-count (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/unread-count` | notificationRoutes.ts |

### /user (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/networks/user/:id` | feedRoutes.ts |


## MARKETPLACE ENDPOINTS (70)

### /:id (38)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/marketplace/:id` | conversationRoutes.ts |
| GET    | `/v1/marketplace/:id` | listingRoutes.ts |
| PATCH  | `/v1/marketplace/:id` | listingRoutes.ts |
| PUT    | `/v1/marketplace/:id` | messageRoutes.ts |
| DELETE | `/v1/marketplace/:id` | messageRoutes.ts |
| DELETE | `/v1/marketplace/:id` | notificationRoutes.ts |
| GET    | `/v1/marketplace/:id` | offerRoutes.ts |
| GET    | `/v1/marketplace/:id` | orderRoutes.ts |
| GET    | `/v1/marketplace/:id` | refundRequestRoutes.ts |
| POST   | `/v1/marketplace/:id/accept` | offerRoutes.ts |
| POST   | `/v1/marketplace/:id/approve` | refundRequestRoutes.ts |
| POST   | `/v1/marketplace/:id/cancel` | orderRoutes.ts |
| POST   | `/v1/marketplace/:id/cancel` | refundRequestRoutes.ts |
| POST   | `/v1/marketplace/:id/checkout` | offerRoutes.ts |
| POST   | `/v1/marketplace/:id/confirm-delivery` | orderRoutes.ts |
| POST   | `/v1/marketplace/:id/confirm-return` | refundRequestRoutes.ts |
| POST   | `/v1/marketplace/:id/counter` | offerRoutes.ts |
| POST   | `/v1/marketplace/:id/deny` | refundRequestRoutes.ts |
| GET    | `/v1/marketplace/:id/dispute` | orderRoutes.ts |
| GET    | `/v1/marketplace/:id/finix-debug` | orderRoutes.ts |
| POST   | `/v1/marketplace/:id/images` | listingRoutes.ts |
| DELETE | `/v1/marketplace/:id/images/:imageKey` | listingRoutes.ts |
| PATCH  | `/v1/marketplace/:id/images/reorder` | listingRoutes.ts |
| POST   | `/v1/marketplace/:id/inquire` | listingRoutes.ts |
| GET    | `/v1/marketplace/:id/media` | conversationRoutes.ts |
| POST   | `/v1/marketplace/:id/offers` | listingRoutes.ts |
| GET    | `/v1/marketplace/:id/offers` | listingRoutes.ts |
| POST   | `/v1/marketplace/:id/payment` | orderRoutes.ts |
| POST   | `/v1/marketplace/:id/publish` | listingRoutes.ts |
| POST   | `/v1/marketplace/:id/react` | messageRoutes.ts |
| POST   | `/v1/marketplace/:id/read` | messageRoutes.ts |
| POST   | `/v1/marketplace/:id/read` | notificationRoutes.ts |
| POST   | `/v1/marketplace/:id/refund-request` | orderRoutes.ts |
| POST   | `/v1/marketplace/:id/reject` | offerRoutes.ts |
| POST   | `/v1/marketplace/:id/submit-return` | refundRequestRoutes.ts |
| PATCH  | `/v1/marketplace/:id/thumbnail` | listingRoutes.ts |
| POST   | `/v1/marketplace/:id/tokenize` | orderRoutes.ts |
| POST   | `/v1/marketplace/:id/tracking` | orderRoutes.ts |

### /buyer (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/marketplace/buyer/list` | orderRoutes.ts |

### /channel (4)
| Method | Endpoint | Route File |
|--------|----------|------------|
| POST   | `/v1/marketplace/channel` | chatRoutes.ts |
| GET    | `/v1/marketplace/channel/:channelId` | messageRoutes.ts |
| POST   | `/v1/marketplace/channel/:channelId/archive` | messageRoutes.ts |
| POST   | `/v1/marketplace/channel/:channelId/read-all` | messageRoutes.ts |

### /channels (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/marketplace/channels` | chatRoutes.ts |

### /complete (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| PATCH  | `/v1/marketplace/complete` | onboardingRoutes.ts |

### /finix (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| POST   | `/v1/marketplace/finix` | webhookRoutes.ts |

### /listings (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/marketplace/listings` | userRoutes.ts |

### /mark-all-read (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| POST   | `/v1/marketplace/mark-all-read` | notificationRoutes.ts |

### /offers (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/marketplace/offers` | userRoutes.ts |

### /onboard (3)
| Method | Endpoint | Route File |
|--------|----------|------------|
| POST   | `/v1/marketplace/onboard` | merchantRoutes.ts |
| POST   | `/v1/marketplace/onboard/refresh-link` | merchantRoutes.ts |
| GET    | `/v1/marketplace/onboard/status` | merchantRoutes.ts |

### /profile (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/marketplace/profile` | merchantRoutes.ts |

### /reserve (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| POST   | `/v1/marketplace/reserve` | orderRoutes.ts |

### /root (8)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/marketplace/` | conversationRoutes.ts |
| GET    | `/v1/marketplace/` | listingRoutes.ts |
| POST   | `/v1/marketplace/` | listingRoutes.ts |
| GET    | `/v1/marketplace/` | merchantRoutes.ts |
| GET    | `/v1/marketplace/` | notificationRoutes.ts |
| GET    | `/v1/marketplace/` | offerRoutes.ts |
| GET    | `/v1/marketplace/` | refundRequestRoutes.ts |
| GET    | `/v1/marketplace/` | userRoutes.ts |

### /search (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/marketplace/search` | conversationRoutes.ts |

### /seller (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/marketplace/seller/list` | orderRoutes.ts |

### /send (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| POST   | `/v1/marketplace/send` | messageRoutes.ts |

### /status (2)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/marketplace/status` | merchantRoutes.ts |
| GET    | `/v1/marketplace/status` | onboardingRoutes.ts |

### /token (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/marketplace/token` | chatRoutes.ts |

### /unread (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/marketplace/unread` | chatRoutes.ts |

### /unread-count (1)
| Method | Endpoint | Route File |
|--------|----------|------------|
| GET    | `/v1/marketplace/unread-count` | notificationRoutes.ts |

