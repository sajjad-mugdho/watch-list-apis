# New Features API Overview

This document provides a high-level overview of all new features added to the Dialist marketplace backend.

---

## Feature Summary

| Feature | Endpoints | Purpose | Integration |
|---------|-----------|---------|-------------|
| **Chat** | `/api/v1/chat/*` | Real-time messaging | GetStream Chat |
| **Activity Feeds** | `/api/v1/feeds/*` | Social timeline | GetStream Feeds |
| **Follow System** | `/api/v1/users/:id/follow*` | User relationships | MongoDB + GetStream |
| **ISO** | `/api/v1/isos/*` | Wanted listings | MongoDB |
| **Reference Checks** | `/api/v1/reference-checks/*` | Community vetting | MongoDB |
| **Subscriptions** | `/api/v1/subscriptions/*` | Tier management | MongoDB + Finix (TODO) |
| **Favorites** | `/api/v1/favorites/*` | Saved items | MongoDB |
| **Recent Searches** | `/api/v1/favorites/searches/*` | Search history | MongoDB |

---

## Quick Start

### 1. GetStream Features (Chat + Feeds + Follow)

**Setup:**
```bash
# Environment variables
GETSTREAM_API_KEY=your_key
GETSTREAM_API_SECRET=your_secret
GETSTREAM_APP_ID=your_app_id
```

**Client Integration:**
```typescript
// Get tokens
const chatToken = await fetch('/api/v1/chat/token').then(r => r.json());
const feedToken = await fetch('/api/v1/feeds/token').then(r => r.json());

// Initialize SDKs
const chatClient = StreamChat.getInstance(chatToken.apiKey);
await chatClient.connectUser({ id: chatToken.userId }, chatToken.token);

const feedsClient = stream.connect(feedToken.apiKey, feedToken.token, feedToken.appId);
```

**Common Operations:**
```bash
# Chat: Get channels
GET /api/v1/chat/channels

# Feeds: Get timeline
GET /api/v1/feeds/timeline

# Follow user
POST /api/v1/users/:id/follow

# Check follow status
GET /api/v1/users/:id/follow/status
```

---

### 2. ISO (In Search Of)

**Create ISO:**
```bash
POST /api/v1/isos
{
  "title": "Looking for Rolex Submariner",
  "criteria": {
    "brand": "Rolex",
    "model": "Submariner",
    "max_price": 12000
  },
  "urgency": "high"
}
```

**Browse ISOs:**
```bash
GET /api/v1/isos?limit=20
```

**Mark as fulfilled:**
```bash
POST /api/v1/isos/:id/fulfill
```

---

### 3. Reference Checks

**Request check:**
```bash
POST /api/v1/reference-checks
{
  "target_id": "user_id_to_check",
  "reason": "Considering large purchase"
}
```

**Respond to check:**
```bash
POST /api/v1/reference-checks/:id/respond
{
  "rating": "positive",
  "comment": "Trustworthy seller",
  "is_anonymous": false
}
```

**Complete check:**
```bash
POST /api/v1/reference-checks/:id/complete
```

---

### 4. Subscriptions

**View tiers:**
```bash
GET /api/v1/subscriptions/tiers
```

**Upgrade:**
```bash
POST /api/v1/subscriptions/upgrade
{
  "tier": "premium",
  "billing_cycle": "yearly"
}
```

**Cancel:**
```bash
POST /api/v1/subscriptions/cancel
```

---

### 5. Favorites & Searches

**Add favorite:**
```bash
POST /api/v1/favorites
{
  "item_type": "listing",
  "item_id": "listing_id"
}
```

**Get favorites:**
```bash
GET /api/v1/favorites?type=listing
```

**Save search:**
```bash
POST /api/v1/favorites/searches/recent
{
  "query": "rolex submariner",
  "filters": { "price_max": 15000 }
}
```

**Get searches:**
```bash
GET /api/v1/favorites/searches/recent
```

---

## Documentation

Detailed documentation for each feature:

- **[GetStream APIs](./GETSTREAM_APIs.md)** - Chat, Feeds, Follow System
- **[ISO API](./ISO_API.md)** - In Search Of feature
- **[Reference Checks API](./REFERENCE_CHECKS_API.md)** - Community vetting
- **[Subscriptions API](./SUBSCRIPTIONS_API.md)** - Tier management
- **[Favorites API](./FAVORITES_API.md)** - Favorites and search history

---

## Authentication

All endpoints require authentication via Clerk JWT:

```http
Authorization: Bearer <clerk_jwt_token>
```

Get the user's Clerk token on the frontend and include it in all API requests.

---

## Response Format

### Success Response
```json
{
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

### Paginated Response
```json
{
  "data": [ ... ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

---

## Models

### New Database Models

1. **Follow** (`/src/models/Follow.ts`)
   - Tracks user follow relationships
   - Syncs with GetStream Feeds

2. **ISO** (`/src/models/ISO.ts`)
   - In Search Of listings
   - Text search indexed

3. **ReferenceCheck** (`/src/models/ReferenceCheck.ts`)
   - Community reference checks
   - Response collection

4. **Subscription** (`/src/models/Subscription.ts`)
   - User subscription tiers
   - Finix integration fields

5. **Favorite** (`/src/models/Favorite.ts`)
   - User favorites (listings/watches/users/ISOs)
   - Unique compound index

6. **RecentSearch** (`/src/models/RecentSearch.ts`)
   - Search history tracking
   - Auto-deduplication

---

## Services

### GetStream Integration

**ChatService** (`/src/services/ChatService.ts`)
- User token generation
- Channel management
- System messages
- Unread counts

**FeedService** (`/src/services/FeedService.ts`)
- User timeline/user feeds
- Activity creation (listing, ISO, reference check)
- Follow/unfollow
- Feed tokens

---

## Feature Matrix

### By User Tier

| Feature | Free | Basic | Premium | Enterprise |
|---------|------|-------|---------|------------|
| Max Listings | 3 | 10 | 50 | ∞ |
| Max ISOs | 2 | 5 | 20 | ∞ |
| Chat | ✓ | ✓ | ✓ | ✓ |
| Activity Feeds | ✓ | ✓ | ✓ | ✓ |
| Follow Users | ✓ | ✓ | ✓ | ✓ |
| Reference Checks | ✓ | ✓ | ✓ | ✓ |
| Favorites | ✓ | ✓ | ✓ | ✓ |
| Analytics | ✗ | ✓ | ✓ | ✓ |
| Priority Support | ✗ | ✗ | ✓ | ✓ |
| Custom Branding | ✗ | ✗ | ✗ | ✓ |

Check subscription endpoint for current tier and features:
```bash
GET /api/v1/subscriptions/current
```

---

## Integration Checklist

### Frontend Setup

- [ ] Install GetStream SDKs
  ```bash
  npm install stream-chat stream-chat-react getstream
  ```

- [ ] Configure environment variables
  ```bash
  NEXT_PUBLIC_GETSTREAM_API_KEY=your_key
  NEXT_PUBLIC_GETSTREAM_APP_ID=your_app_id
  ```

- [ ] Initialize clients on app load
  ```typescript
  useEffect(() => {
    initializeStreamClients();
  }, []);
  ```

- [ ] Add UI components for:
  - [ ] Chat interface
  - [ ] Activity feed
  - [ ] Follow buttons
  - [ ] ISO creation/browsing
  - [ ] Reference check forms
  - [ ] Subscription management
  - [ ] Favorites buttons
  - [ ] Search history

---

### Backend Setup

- [ ] Environment variables configured
  ```bash
  GETSTREAM_API_KEY=xxx
  GETSTREAM_API_SECRET=xxx
  GETSTREAM_APP_ID=xxx
  ```

- [ ] All routes mounted in `/src/routes/index.ts`
  - [x] Chat routes
  - [x] Feed routes
  - [x] Follow routes
  - [x] ISO routes
  - [x] Reference check routes
  - [x] Subscription routes
  - [x] Favorites routes

- [ ] Database indexes created (automatic on first query)

---

## Testing

### Manual Testing with Swagger

Access Swagger UI at: `http://localhost:5050/api-docs`

All new endpoints are documented with:
- Request/response schemas
- Example payloads
- Authentication requirements
- Error responses

### API Testing Flow

1. **Authenticate** - Get Clerk token
2. **Test Chat** - Generate token, create channel
3. **Test Feeds** - Generate token, view timeline
4. **Test Follow** - Follow/unfollow users
5. **Test ISO** - Create, browse, fulfill ISO
6. **Test Reference** - Create, respond, complete check
7. **Test Subscription** - View tiers, upgrade
8. **Test Favorites** - Add, list, remove favorites
9. **Test Searches** - Save, list, delete searches

---

## Production Deployment

### Environment Variables
Ensure all required variables are set in production:
```bash
GETSTREAM_API_KEY=
GETSTREAM_API_SECRET=
GETSTREAM_APP_ID=
MONGO_URI=
CLERK_SECRET_KEY=
```

### Database Migrations
No migrations needed - models auto-create indexes on first use.

### Monitoring
Monitor these metrics:
- GetStream API usage (quota limits)
- Database query performance
- Subscription upgrade/cancel rates
- ISO fulfillment rates
- Reference check response rates

---

## Support & Resources

### Documentation Links
- [GetStream Chat Docs](https://getstream.io/chat/docs/)
- [GetStream Feeds Docs](https://getstream.io/activity-feeds/docs/)
- [Finix API Docs](https://docs.finixpayments.com/)
- [Clerk Auth Docs](https://clerk.com/docs)

### Internal Docs
- [GETSTREAM_APIs.md](./GETSTREAM_APIs.md)
- [ISO_API.md](./ISO_API.md)
- [REFERENCE_CHECKS_API.md](./REFERENCE_CHECKS_API.md)
- [SUBSCRIPTIONS_API.md](./SUBSCRIPTIONS_API.md)
- [FAVORITES_API.md](./FAVORITES_API.md)

### API Endpoints Summary
```
Chat:
  GET    /api/v1/chat/token
  GET    /api/v1/chat/channels
  GET    /api/v1/chat/unread
  POST   /api/v1/chat/channel

Feeds:
  GET    /api/v1/feeds/token
  GET    /api/v1/feeds/timeline
  GET    /api/v1/feeds/user/:id
  GET    /api/v1/feeds/following
  GET    /api/v1/feeds/followers

Follow:
  POST   /api/v1/users/:id/follow
  DELETE /api/v1/users/:id/follow
  GET    /api/v1/users/:id/followers
  GET    /api/v1/users/:id/following
  GET    /api/v1/users/:id/follow/status

ISO:
  POST   /api/v1/isos
  GET    /api/v1/isos
  GET    /api/v1/isos/my
  GET    /api/v1/isos/:id
  PUT    /api/v1/isos/:id
  DELETE /api/v1/isos/:id
  POST   /api/v1/isos/:id/fulfill

Reference Checks:
  POST   /api/v1/reference-checks
  GET    /api/v1/reference-checks
  GET    /api/v1/reference-checks/:id
  POST   /api/v1/reference-checks/:id/respond
  POST   /api/v1/reference-checks/:id/complete
  DELETE /api/v1/reference-checks/:id

Subscriptions:
  GET    /api/v1/subscriptions/current
  GET    /api/v1/subscriptions/tiers
  POST   /api/v1/subscriptions/upgrade
  POST   /api/v1/subscriptions/cancel
  POST   /api/v1/subscriptions/reactivate
  PUT    /api/v1/subscriptions/payment-method

Favorites:
  POST   /api/v1/favorites
  GET    /api/v1/favorites
  DELETE /api/v1/favorites/:type/:id
  GET    /api/v1/favorites/check/:type/:id
  
Recent Searches:
  POST   /api/v1/favorites/searches/recent
  GET    /api/v1/favorites/searches/recent
  DELETE /api/v1/favorites/searches/recent
  DELETE /api/v1/favorites/searches/recent/:id
```
