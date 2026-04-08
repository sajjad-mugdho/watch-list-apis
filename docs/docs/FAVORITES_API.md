# Favorites & Recent Searches API

## Overview

Allow users to save favorite items and track their search history for quick access.

---

## Authentication
All endpoints require `Authorization: Bearer <token>` header with a valid Clerk JWT.

## Base Endpoint
`/api/v1/favorites`

---

## Favorites API

### Supported Item Types
- `listing` - Marketplace listings
- `watch` - Watches from the catalog
- `user` - Other users
- `iso` - ISO (In Search Of) posts

---

### **1. Add Favorite**
Add an item to your favorites.

```http
POST /api/v1/favorites
Content-Type: application/json

{
  "item_type": "listing",
  "item_id": "507f1f77bcf86cd799439011"
}
```

**Request Body:**
- `item_type` (string, required): One of: `listing`, `watch`, `user`, `iso`
- `item_id` (string, required): ObjectId of the item

**Response:**
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "user_id": "507f1f77bcf86cd799439010",
    "item_type": "listing",
    "item_id": "507f1f77bcf86cd799439011",
    "createdAt": "2026-01-06T00:00:00Z"
  }
}
```

**Error Responses:**
- `400` - Invalid item type, invalid ObjectId, or already favorited

---

### **2. Get Favorites**
Retrieve your favorited items.

```http
GET /api/v1/favorites?type=listing&limit=20&offset=0
```

**Query Parameters:**
- `type` (string, optional): Filter by item type (`listing`, `watch`, `user`, `iso`)
- `limit` (number, optional): Results per page (default: 20, max: 100)
- `offset` (number, optional): Pagination offset (default: 0)

**Response:**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "user_id": "507f1f77bcf86cd799439010",
      "item_type": "listing",
      "item_id": "507f1f77bcf86cd799439011",
      "createdAt": "2026-01-06T00:00:00Z"
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

**Note:** To get full item details, make separate requests to respective APIs with the `item_id`.

---

### **3. Remove Favorite**
Remove an item from favorites.

```http
DELETE /api/v1/favorites/:type/:id
```

**Path Parameters:**
- `type` (string, required): Item type
- `id` (string, required): Item ObjectId

**Response:**
```json
{
  "message": "Favorite removed successfully"
}
```

**Error Responses:**
- `400` - Invalid item type or ID
- `404` - Favorite not found

---

### **4. Check if Favorited**
Check whether a specific item is favorited.

```http
GET /api/v1/favorites/check/:type/:id
```

**Path Parameters:**
- `type` (string, required): Item type
- `id` (string, required): Item ObjectId

**Response:**
```json
{
  "is_favorited": true
}
```

---

## Recent Searches API

Track user search queries for quick re-access.

### Limits
- Maximum 20 recent searches per user
- Automatic deduplication (same query removes old entry)
- Newest searches first

---

### **1. Add Recent Search**
Save a search query.

```http
POST /api/v1/favorites/searches/recent
Content-Type: application/json

{
  "query": "rolex submariner",
  "filters": {
    "brand": "Rolex",
    "price_max": 15000
  },
  "result_count": 24
}
```

**Request Body:**
- `query` (string, required): Search query text (max 200 chars)
- `filters` (object, optional): Applied filters
- `result_count` (number, optional): Number of results found

**Response:**
```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "user_id": "507f1f77bcf86cd799439010",
    "query": "rolex submariner",
    "filters": {
      "brand": "Rolex",
      "price_max": 15000
    },
    "result_count": 24,
    "createdAt": "2026-01-06T00:00:00Z"
  }
}
```

**Behavior:**
- If same query exists, old entry is deleted and new one created
- If >20 searches, oldest is automatically deleted
- Query is stored in lowercase and trimmed

---

### **2. Get Recent Searches**
Retrieve your recent search history.

```http
GET /api/v1/favorites/searches/recent?limit=10
```

**Query Parameters:**
- `limit` (number, optional): Number of searches (default: 10, max: 20)

**Response:**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "user_id": "507f1f77bcf86cd799439010",
      "query": "rolex submariner",
      "filters": {
        "brand": "Rolex",
        "price_max": 15000
      },
      "result_count": 24,
      "createdAt": "2026-01-06T00:00:00Z"
    },
    {
      "_id": "507f1f77bcf86cd799439014",
      "query": "omega speedmaster",
      "filters": null,
      "result_count": 12,
      "createdAt": "2026-01-05T23:00:00Z"
    }
  ]
}
```

**Sorted:** Most recent first

---

### **3. Clear All Recent Searches**
Delete all your recent searches.

```http
DELETE /api/v1/favorites/searches/recent
```

**Response:**
```json
{
  "message": "Recent searches cleared"
}
```

---

### **4. Delete Specific Search**
Remove a single search from history.

```http
DELETE /api/v1/favorites/searches/recent/:id
```

**Path Parameters:**
- `id` (string, required): Recent search ObjectId

**Response:**
```json
{
  "message": "Search deleted"
}
```

**Error Responses:**
- `400` - Invalid search ID
- `404` - Search not found

---

## Use Cases & Examples

### Save Favorite Listing
```bash
# User favorites a listing while browsing
POST /api/v1/favorites
{
  "item_type": "listing",
  "item_id": "507f1f77bcf86cd799439011"
}

# Later, check if still favorited
GET /api/v1/favorites/check/listing/507f1f77bcf86cd799439011
```

### Browse Favorites
```bash
# Get all favorite listings
GET /api/v1/favorites?type=listing&limit=50

# Get favorite users (watchlist)
GET /api/v1/favorites?type=user

# Get all favorites (mixed types)
GET /api/v1/favorites?limit=100
```

### Remove Favorite
```bash
# User unfavorites a listing
DELETE /api/v1/favorites/listing/507f1f77bcf86cd799439011
```

### Track Searches
```bash
# User performs search
POST /api/v1/favorites/searches/recent
{
  "query": "vintage omega",
  "filters": {
    "condition": "like-new",
    "year_min": 1960,
    "year_max": 1980
  },
  "result_count": 18
}

# View search history
GET /api/v1/favorites/searches/recent?limit=10

# User clicks a previous search
GET /api/v1/favorites/searches/recent
# Frontend re-applies the query and filters
```

### Clear History
```bash
# Clear all searches (privacy)
DELETE /api/v1/favorites/searches/recent

# Or delete specific search
DELETE /api/v1/favorites/searches/recent/507f1f77bcf86cd799439013
```

---

## UI Integration Patterns

### Favorite Button
```typescript
// Check if item is favorited
const { is_favorited } = await fetch(
  `/api/v1/favorites/check/listing/${listingId}`
).then(r => r.json());

// Toggle favorite
if (is_favorited) {
  await fetch(`/api/v1/favorites/listing/${listingId}`, { method: 'DELETE' });
} else {
  await fetch('/api/v1/favorites', {
    method: 'POST',
    body: JSON.stringify({
      item_type: 'listing',
      item_id: listingId
    })
  });
}
```

### Search History Dropdown
```typescript
// Show recent searches in search bar
const { data: searches } = await fetch(
  '/api/v1/favorites/searches/recent?limit=5'
).then(r => r.json());

// Render as suggestions
searches.map(search => (
  <SearchSuggestion 
    query={search.query}
    filters={search.filters}
    onClick={() => performSearch(search)}
  />
))
```

### Favorites Page
```typescript
// Tabbed interface
const tabs = ['all', 'listing', 'watch', 'user', 'iso'];

// Fetch for active tab
const { data, total } = await fetch(
  `/api/v1/favorites?type=${activeTab}&limit=20&offset=page*20`
 ).then(r => r.json());

// Hydrate with full data
const hydratedFavorites = await Promise.all(
  data.map(fav => fetchItemDetails(fav.item_type, fav.item_id))
);
```

---

## Data Model

### Favorite Document
```typescript
{
  _id: ObjectId,
  user_id: ObjectId,        // User who favorited
  item_type: string,        // listing|watch|user|iso
  item_id: ObjectId,        // Referenced item
  createdAt: Date
}
```

**Indexes:**
- `{ user_id: 1, item_type: 1, item_id: 1 }` (unique)
- `{ user_id: 1, createdAt: -1 }`

### Recent Search Document
```typescript
{
  _id: ObjectId,
  user_id: ObjectId,        // User who searched
  query: string,            // Search text (lowercase, trimmed)
  filters: object,          // Applied filters
  result_count: number,     // Results found
  createdAt: Date
}
```

**Indexes:**
- `{ user_id: 1, createdAt: -1 }`

---

## Privacy & Data

### Favorites
- Private to user only
- Not discoverable by other users
- Deleted when user account deleted

### Recent Searches
- Private to user only
- Automatically capped at 20
- User can clear anytime
- Deleted when user account deleted

---

## Best Practices

### For Favorites
1. **Check Before Adding**: Use `/check` endpoint to avoid duplicate errors
2. **Lazy Load Details**: Fetch item details only when viewing favorites page
3. **Stale Data**: Re-fetch item details to ensure accuracy (listings may be sold)
4. **Handle Deletions**: Item may no longer exist, handle 404s gracefully

### For Searches
1. **Debounce Saves**: Only save when search is executed, not on input
2. **Include Filters**: Save filters for complete search recreation
3. **Store Result Count**: Helps user gauge search quality
4. **Smart Suggestions**: Show searches with higher result counts first

---

## Limitations

- **Favorites**: No hard limit, but reasonable usage expected
- **Recent Searches**: Max 20 per user (auto-managed)
- **Deduplication**: Only exact query matches are deduplicated
- **No Sharing**: Favorites and searches are private

---

## Future Enhancements

- Collections/folders for favorites
- Shared favorite lists
- Search alerts (notify when new results match saved search)
- Trending searches (anonymous aggregation)
- Export favorites list
