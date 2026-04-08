# Notifications API

In-app notification system for users.

## Overview

The notification system provides:
- ISO match notifications
- Offer/order status updates
- Reference check requests
- New follower alerts
- System announcements

## Endpoints

### GET /api/v1/notifications

Get notifications for the current user.

**Query Parameters:**
- `limit` (optional): Max notifications (default: 20, max: 50)
- `offset` (optional): Pagination offset (default: 0)
- `unread_only` (optional): Only return unread notifications (`true`/`false`)

**Response:**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "type": "iso_match",
      "title": "Match Found!",
      "body": "A listing matching your ISO 'Looking for Rolex Submariner' has been posted!",
      "data": {
        "iso_id": "507f1f77bcf86cd799439012",
        "listing_id": "507f1f77bcf86cd799439013"
      },
      "action_url": "/listings/507f1f77bcf86cd799439013",
      "is_read": false,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 15,
  "unread_count": 3,
  "limit": 20,
  "offset": 0
}
```

### GET /api/v1/notifications/unread-count

Get the count of unread notifications.

**Response:**
```json
{
  "unread_count": 5
}
```

### POST /api/v1/notifications/:id/read

Mark a specific notification as read.

**Response:**
```json
{
  "message": "Notification marked as read"
}
```

### POST /api/v1/notifications/read-all

Mark all notifications as read.

**Response:**
```json
{
  "message": "All notifications marked as read",
  "count": 5
}
```

### DELETE /api/v1/notifications/:id

Delete a notification.

**Response:**
```json
{
  "message": "Notification deleted"
}
```

## Notification Types

| Type | Description | Data Fields |
|------|-------------|-------------|
| `iso_match` | New listing matches user's ISO | `iso_id`, `listing_id` |
| `reference_check_request` | Someone requested a check from you | `reference_check_id`, `requester_id` |
| `reference_check_response` | Someone responded to your check | `reference_check_id`, `responder_id` |
| `offer_received` | New offer on your listing | `offer_id`, `listing_id` |
| `offer_accepted` | Your offer was accepted | `offer_id`, `listing_id`, `order_id` |
| `offer_rejected` | Your offer was rejected | `offer_id`, `listing_id` |
| `counter_offer` | Seller made a counter offer | `offer_id`, `listing_id` |
| `order_update` | Order status changed | `order_id`, `status` |
| `new_follower` | Someone followed you | `follower_id` |
| `new_message` | New message in conversation | `channel_id` |
| `listing_sold` | Your listing was sold | `listing_id`, `order_id` |
| `system` | System announcement | varies |

## Frontend Usage Example

```typescript
// React Native / Expo example
import { useEffect, useState } from 'react';

function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    const response = await fetch('/api/v1/notifications', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    setNotifications(data.data);
    setUnreadCount(data.unread_count);
  };

  const markAsRead = async (id: string) => {
    await fetch(`/api/v1/notifications/${id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchNotifications();
  };

  const markAllAsRead = async () => {
    await fetch('/api/v1/notifications/read-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    setUnreadCount(0);
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
```
