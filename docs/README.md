# Dialist API Documentation

Complete documentation for the Dialist marketplace backend API.

---

## Table of Contents

- [Overview](#overview)
- [New Features](#new-features)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)
- [Swagger/OpenAPI](#swaggeropenapi)
- [Environment Setup](#environment-setup)

---

## Overview

Dialist is a luxury watch marketplace platform with two main products:
- **Marketplace**: Public watch marketplace with Finix payment processing
- **Networks**: Private network-based watch trading

This documentation covers all API endpoints, especially the newly implemented social and community features.

---

## New Features

### GetStream Integration
- **Chat** - Real-time messaging using GetStream Chat SDK
- **Activity Feeds** - Social timeline using GetStream Feeds SDK
- **Follow System** - User relationships with feed synchronization

### Community Features
- **ISO (In Search Of)** - Users post wanted listings
- **Reference Checks** - Community vetting system with ratings
- **Subscriptions** - Tiered subscription plans with Finix integration
- **Favorites** - Save listings, watches, users, and ISOs
- **Recent Searches** - Track and replay search history

---

## Getting Started

### Prerequisites
```bash
Node.js >= 16
MongoDB
```

### Installation
```bash
npm install
```

### Environment Variables
```bash
# MongoDB
MONGO_URI=mongodb://localhost:27017/dialist

# Clerk Authentication
CLERK_SECRET_KEY=your_clerk_secret_key

# GetStream
GETSTREAM_API_KEY=your_api_key
GETSTREAM_API_SECRET=your_api_secret
GETSTREAM_APP_ID=your_app_id

# Finix
FINIX_API_KEY=your_finix_api_key
FINIX_USERNAME=your_username
FINIX_PASSWORD=your_password
FINIX_APP_ID=your_app_id
```

### Run Server
```bash
npm run dev
```

Server runs on: `http://localhost:5050`

---

## API Documentation

### Feature Documentation
1. **[DIALIST CHAT MASTER GUIDE](./DIALIST_CHAT_INTEGRATION_MASTER_GUIDE.md)** ⭐⭐
   - **The "One and Only" guide** for the entire chat system.
   - Architecture + API + Frontend implementation in one place.
   - **Use Case:** Start here for everything related to Chat, Offers, and Networks.

2. **[GETSTREAM E2E OVERVIEW](./GETSTREAM_E2E_OVERVIEW.md)** ⭐
   - Simple, human-readable flow of the whole system
   - Perfect for quick understanding
   1. **[NEW FEATURES OVERVIEW](./NEW_FEATURES_OVERVIEW.md)**
   - Quick reference for all new features
   - Integration checklist
   - API endpoint summary

2. **[GetStream APIs](./GETSTREAM_APIs.md)**
   - Chat integration
   - Activity feeds
   - Follow system
   - Client-side setup

3. **[ISO API](./ISO_API.md)**
   - Create/browse ISOs
   - Search criteria
   - Fulfillment tracking
   - Activity feed integration

4. **[Reference Checks API](./REFERENCE_CHECKS_API.md)**
   - Request community feedback
   - Provide ratings and comments
   - Anonymous responses
   - Privacy controls

5. **[Subscriptions API](./SUBSCRIPTIONS_API.md)**
   - Free/Basic/Premium/Enterprise tiers
   - Upgrade/downgrade flows
   - Payment method management
   - Feature gating

6. **[Favorites API](./FAVORITES_API.md)**
   - Save favorite items
   - Track search history
   - Quick access patterns
   - UI integration examples

### Legacy Features

Existing marketplace and networks features are documented in:
- Swagger UI at `/api-docs`
- Inline Swagger annotations in route files

---

## Authentication

All API endpoints require Clerk JWT authentication (except `/api/health` and debug endpoints in dev mode).

### Request Headers
```http
Authorization: Bearer <clerk_jwt_token>
```

### Getting Token (Client-Side)
```typescript
import { useAuth } from '@clerk/nextjs';

const { getToken } = useAuth();
const token = await getToken();

fetch('/api/v1/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Swagger/OpenAPI

### Access Swagger UI
Navigate to: `http://localhost:5050/api-docs`

### API Tags

All endpoints are organized under the following tags:

**Core Features:**
- `Health` - Health check
- `User` - User management  
- `Watches` - Watch catalog
- `Auth` - Authentication
- `Onboarding` - User onboarding

**Marketplace:**
- `Marketplace - User` - User operations
- `Marketplace - Merchant` - Merchant onboarding
- `Marketplace - Listings` - Listing management
- `Marketplace - Orders` - Order processing

**Networks:**
- `Networks - User` - Network user operations
- `Networks - Listings` - Network listings
- `Networks - Offers` - Offer management

**New Social Features:**
- `Chat` - GetStream Chat integration
- `Feeds` - GetStream Activity Feeds
- `Follow` - Follow/unfollow users
- `ISO` - In Search Of listings
- `ReferenceCheck` - Community vetting
- `Subscription` - Tier management
- `Favorites` - Saved items & searches

**System:**
- `Webhooks` - Finix webhooks
- `Debug` - Development utilities

### Swagger Spec Export
```bash
# JSON format
curl http://localhost:5050/api-docs.json > swagger.json

# Access directly
http://localhost:5050/api-docs.json
```

---

## Environment Setup

### Development
```bash
NODE_ENV=development
npm run dev
```

Features in development mode:
- Mock user authentication (see Debug tag in Swagger)
- Extended error messages
- Hot reload

### Production
```bash
NODE_ENV=production
npm run build
npm start
```

Production considerations:
- Mock authentication disabled
- Optimized logging
- Performance monitoring
- Rate limiting enabled

---

## Quick Reference

### Base URL
```
http://localhost:5050/api/v1
```

### Common Endpoints

**Authentication:**
```
GET /api/v1/auth/bootstrap    # Get user info and claims
```

**Chat:**
```
GET /api/v1/chat/token        # Get chat token
GET /api/v1/chat/channels     # List channels
```

**Feeds:**
```
GET /api/v1/feeds/token       # Get feed token
GET /api/v1/feeds/timeline    # Get timeline
```

**Follow:**
```
POST /api/v1/user/following/:id    # Follow user (Networks only)
GET /api/v1/user/following/status  # Check status
```

**ISO:**
```
POST /api/v1/isos             # Create ISO
GET /api/v1/user/isos         # My ISOs
GET /api/v1/isos              # Browse public ISOs
```

**Reference Checks:**
```
POST /api/v1/reference-checks          # Request check
POST /api/v1/reference-checks/:id/respond # Respond
```

**Subscriptions:**
```
GET /api/v1/user/subscription          # Get current
POST /api/v1/subscriptions/upgrade     # Upgrade (Action)
```

**Favorites:**
```
POST /api/v1/user/favorites            # Add favorite
GET /api/v1/user/favorites             # List favorites
```

---

## Response Formats

### Success Response
```json
{
  "data": { ... }
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

## Testing

### Swagger UI Testing
1. Navigate to `http://localhost:5050/api-docs`
2. Click "Authorize" button
3. Enter Clerk JWT token
4. Try endpoints interactively

### Mock Users (Development)
Use `x-test-user` header with mock user IDs:
```http
x-test-user: buyer_us_complete
```

Available mock users:
- `buyer_us_complete` - Approved buyer
- `merchant_approved` - Approved merchant
- `new_user_us` - Fresh user

See full list: `GET /api/v1/debug/mock-users`

---

## Support

### Issues
Report issues or feature requests via your project management system.

### Documentation Updates
Documentation files are in `/docs` directory:
- Edit markdown files directly
- Submit PRs for improvements

### API Changes
When adding new endpoints:
1. Add route in `/src/routes`
2. Update Swagger tags in `/src/config/swagger.ts`
3. Create/update documentation in `/docs`
4. Test with Swagger UI

---

## Version
**API Version:** 1.0.0  
**Documentation Updated:** January 2026

---

## Quick Links

- [Swagger UI](http://localhost:5050/api-docs)
- [Swagger JSON](http://localhost:5050/api-docs.json)
- [Health Check](http://localhost:5050/api/health)
- [GetStream Docs](https://getstream.io/docs/)
- [Finix Docs](https://docs.finixpayments.com/)
- [Clerk Docs](https://clerk.com/docs)
