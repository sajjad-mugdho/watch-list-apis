# 🛠️ Dialist Chat & Trading: The "One & Only" Integration Guide

This is the definitive guide for developers to understand, build, and maintain the Dialist real-time messaging and commerce system. It explains the "why," the "how," and the code.

---

## 🏛️ 1. The Architecture (The "Mental Model")

We follow a **"Backend-First"** approach. While GetStream handles the real-time pipes, our API stays in control of the business rules.

### The Triangle of Power:
1.  **Clerk (Identity)**: Confirms who the user is.
2.  **Dialist API (The Brain)**: Validates trades, saves messages to our DB, and keeps "Snapshots" of data.
3.  **GetStream (The Engine)**: Pushes messages instantly to the UI, handles typing indicators, and presence.

### Why this way?
If GetStream goes down, we still have every message in our MongoDB. If a user tries to scam someone, our API blocks the message before it ever hits the "pipes."

---

## 🔌 2. API Reference (The "What")

You only need these 5 core patterns to build the entire experience.

### A. Authentication
`GET /api/v1/chat/token`
- **What it does**: Exchanges a Clerk token for a Stream Chat token.
- **Frontend Step**: Call this on app load or whenever the user logs in.

### B. The "First Contact" (Inquiry)
`POST /api/v1/marketplace/listings/:id/inquire`
- **What it does**: Creates the chat channel, adds both users, and sends the first message.
- **Human Note**: Never use GetStream's client-side channel creation. Always use this API so the backend can track the trade.

### C. Sending Messages
`POST /api/v1/messages/send`
- **What it does**: Sends a message to the channel and saves it to MongoDB.
- **Frontend Step**: Use this instead of `channel.sendMessage()` if you want the message to be officially recorded in our commerce history.

### D. The Trade (Offers)
`POST /api/v1/marketplace/listings/:id/offers`
- **What it does**: Starts a formal offer flow.
- **The Result**: Triggers a **System Message** inside the chat with action buttons.

### E. Notifications
`GET /api/v1/notifications`
- **What it does**: Lists all alerts (New Message, New Offer, Order Shipped).
- **Frontend Step**: Poll this or use WebSockets to update those red "unread" badges.

---

## 🚀 3. Step-by-Step Frontend Implementation

Follow these steps to build the UI from scratch.

### Step 1: Initialize the Engine
In your Root layout, wrap everything in a provider.
```tsx
// 1. Fetch token from our API
const { token, apiKey } = await api.getChatToken();
// 2. Connect
const client = StreamChat.getInstance(apiKey);
await client.connectUser({ id: userId }, token);
```

### Step 2: The Inquiry Flow
When a user clicks "Buy" or "Ask a Question":
1. Call our `inquire` API.
2. Use the returned `getstream_channel_id`.
3. Route the user to `/chat/[channelId]`.

### Step 3: Customizing the Chat Bubble
We use **Custom System Messages**. You must style messages where `message.custom.system_message === true`.
- **Offer Message**: Show a card with "Accept/Decline" buttons.
- **Status Message**: Show centered, neutral text like "User has paid."

### Step 4: Tracking Everything
Listen for the `message.new` event from the Stream client to:
- Play a "ping" sound.
- Increment the unread count in your navbar.
- Trigger a local browser notification.

---

## 💡 4. Architectural "Pro-Tips"

### 1. The "Snapshot" Rule
Our backend takes a "Snapshot" of the watch (Price, Images, Title) the moment the chat starts. Even if the seller deletes their listing later, the chat record remains a valid history of the deal.

### 2. Deterministic IDs
Channel IDs are calculated via a secure hash of (Buyer + Seller + Listing). This means the same buyer and seller talking about the same watch always land in the **same room**, no matter which device they use.

### 3. System Message Logic
| Type | ID Field | UI Action |
| :--- | :--- | :--- |
| `offer` | `offer_id` | Show [Accept] [Counter] [Decline] buttons |
| `order_paid`| `order_id` | Show "View Order Receipt" link |
| `inquiry` | `listing_id` | Show listing preview card at top of chat |

---

## 🎯 Summary
You are building more than a chat app; you are building a **Trading Platform**. Use our API to control the logic, and use GetStream to make it feel fast.

**Happy Coding!** 🚀
