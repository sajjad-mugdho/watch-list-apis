# New Features Frontend Integration Guide

This guide covers the integration of the recently implemented features: Backend-Controlled Messaging, In-App Notifications, ISO Match notifications, and Enhanced Subscriptions.

## 1. Backend-Controlled Messaging

We have moved from a GetStream-only approach to a backend-first architecture. This ensures all messages are stored in our MongoDB for moderation, analytics, and business logic.

### Endpoints
- `POST /api/v1/messages/send`: Send a message.
- `GET /api/v1/messages/channel/:channelId`: Get message history for a channel.
- `PUT /api/v1/messages/:id`: Edit a message.
- `DELETE /api/v1/messages/:id`: Delete a message.
- `POST /api/v1/messages/:id/read`: Mark a specific message as read.
- `POST /api/v1/messages/channel/:channelId/read-all`: Mark all messages in a channel as read.

### Implementation Pattern
Instead of using the GetStream SDK's `channel.sendMessage()`, use our backend endpoint:

```typescript
// Example: Sending a message
const sendMessage = async (channelId, text) => {
  const response = await api.post("/messages/send", {
    channel_id: channelId,
    text: text,
    type: "regular"
  });
  return response.data;
};
```

**Note:** The backend delivers the message to GetStream in parallel, so real-time delivery remains instant for other participants listening via the GetStream SDK.

---

## 2. In-App Notifications

A unified notification system is now available.

### Endpoints
- `GET /api/v1/notifications`: List notifications (paginated).
- `GET /api/v1/notifications/unread-count`: Get count of unread notifications.
- `POST /api/v1/notifications/:id/read`: Mark one notification as read.
- `POST /api/v1/notifications/read-all`: Mark all notifications as read.

### Notification Types
| Type | Usage |
|------|-------|
| `iso_match` | Triggered when a new listing matches an ISO. |
| `reference_check_request` | Triggered when someone requests a reference check from you. |
| `reference_check_response` | Triggered when someone responds to your reference check request. |
| `new_follower` | Triggered when someone follows you. |

### Example Hook (React)
```typescript
export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = async () => {
    const [notifs, count] = await Promise.all([
      api.get("/notifications"),
      api.get("/notifications/unread-count")
    ]);
    setNotifications(notifs.data.data);
    setUnreadCount(count.data.unread_count);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000); // Poll once a minute
    return () => clearInterval(interval);
  }, []);

  return { notifications, unreadCount, refresh };
};
```

---

## 3. ISO (In Search Of) Matching

When you publish a listing, the backend automatically checks it against active ISOs. Owners of matching ISOs will receive:
1. An activity item in their Feed.
2. An in-app Notification.

Frontend developers just need to ensure they handle the `iso_match` notification type and navigate the user to the listing detail.

---

## 4. Enhanced Subscriptions (Finix)

Subscription upgrades now process real payments via Finix.

### Flow
1. Fetch available tiers: `GET /api/v1/subscriptions/tiers`
2. Tokenize the payment instrument via Finix SDK (Frontend).
3. Call `POST /api/v1/subscriptions/upgrade` with the `payment_instrument_id`.

### Listing Limits
Draft and Active listing counts are now enforced based on subscription tier:
- **Free**: 10 Drafts, 25 Active.
- **Premium**: 10 Drafts, 50 Active.
- **Enterprise**: Custom/Unlimited.

If a limit is reached, the backend will return a `403 Forbidden` with a message like `"Draft listing limit reached"`.

---

## 5. Summary of Mock User Scenarios

For development, you can use the following mock users to test different states:
- `merchant_approved`: Has a subscription, can create listings.
- `buyer_us_complete`: Can search and view listings, create ISOs.

Check `GET /api/v1/debug/mock-users` for the full list of test users.
