# 💬 Dialist Chat: Frontend Integration Guide

Hey Frontend Team! This is your go-to guide for building the real-time messaging, offers, and notification system. 

We use **GetStream** for the heavy lifting of real-time messaging, but our **Backend (Dialist API)** is the "Brain" that handles the money, listings, and database. Here is how they work together and how you should build it.

---

## 🏗️ The Big Picture (How it works)

1. **GetStream** handles the "Live" stuff: Typing indicators, presence (online/offline), and instant message delivery.
2. **Dialist API** handles the "Business" stuff: Who can talk to who, creating orders, managing offers, and sending system notifications.
3. **Synchronization**: When you send a message through our API, we save it to our database and simultaneously push it to GetStream so the other person sees it instantly.

---

## 🔑 Phase 1: Authentication (Getting "In")

Before you can show any chat, you need a **Stream Token**. This is different from your Clerk token.

**The Flow:**
1. Get the **Clerk JWT** as usual.
2. Call `GET /api/v1/chat/token` with the Clerk token in the header.
3. The API returns a `token` and `apiKey`.
4. Use these to initialize the Stream Chat client in your app.

> **Human Note:** Think of the Clerk token as your ID card for the building, and the Stream Token as your specific key to the chat room.

---

## 💬 Phase 2: Starting a Conversation (Inquiries)

We don't just "open a chat." Conversations are started by **Inquiries**.

**To start a chat:**
1. Call `POST /api/v1/marketplace/listings/:id/inquire`.
2. Send an optional message: `{"message": "Is this still available?"}`.
3. **Magic happens:** The backend creates a channel, adds the buyer and seller, sends the first message, and triggers a notification.
4. Use the `getstream_channel_id` from the response to navigate the user directly into that chat room.

---

## 💸 Phase 3: The Commerce Flow (Offers & Orders)

This is where the chat gets "Smart." We use **System Messages** to show buttons inside the chat.

### 1. Sending an Offer
When a buyer clicks "Make Offer," call `POST /api/v1/marketplace/listings/:id/offers`.
This will:
- Record the offer in the database.
- Send a **System Message** to the chat that says "💰 New Offer: $12,000" with buttons (Accept/Decline).
- Send a push notification to the seller.

### 2. Resolving an Offer
The seller interacts with buttons in the chat which call:
- `POST /api/v1/marketplace/channels/:channelId/offers/:id/accept`
- `POST /api/v1/marketplace/channels/:channelId/offers/:id/reject`
- `POST /api/v1/marketplace/channels/:channelId/offers/:id/counter`

### 3. Order Updates
As the order moves from **Paid** → **Shipped** → **Completed**, the backend automatically sends system messages into the chat. You just need to listen for messages where `custom.system_message === true` and style them differently.

---

## 🔔 Phase 4: Notifications & Unread Counts

Users hate missing messages. You have two places to check:

1. **Global Unread Count**: Call `GET /api/v1/chat/unread` to get a single number to show on your navbar/tab bar.
2. **Notification Feed**: Call `GET /api/v1/notifications` to show a list of things like "New Offer," "Order Shipped," or "New Follower."

---

## 🎨 Phase 5: UI Checklist (Style these!)

To make the app feel premium, you should have different "looks" for these message types:

| Message Type | What it looks like | Example Text |
| :--- | :--- | :--- |
| **Regular** | Normal chat bubble | "Hey, can we meet today?" |
| **Inquiry** | Card with Listing info | "Inquiry about Rolex Submariner" |
| **Offer** | Box with amount + Action Buttons | "💰 New Offer: $10,000 [Accept] [Decline]" |
| **System** | Small grey text in center | "🔒 Listing Reserved" or "🚚 Order Shipped" |

---

## 🚀 Frontend Implementation Steps

1. **Setup Provider**: Wrap your app in a `ChatProvider` that handles the `StreamChat.connectUser()` dance.
2. **Channel List**: Use the `ChannelList` component to show all active trades.
3. **Message List**: Use `MessageList` but add a `MessageComponent` prop to handle our custom **System Messages**.
4. **Action Headers**: In the chat header, you should show the **Listing Status** (Available / Reserved / Sold) which comes from the `channel.data`.

---

## 💡 Pro Tips for Frontend Devs

- **Deterministic IDs**: Our channel IDs are hashed (e.g., `1283623...`). Never try to guess them; always get them from the API responses.
- **Member Check**: If a user isn't in a channel, the API will block them. If you see a 403, check if the `buyer_id` or `seller_id` matches the current user.
- **Offline Support**: Stream handles offline messaging automatically. When the user comes back online, everything will sync up.

---

**Questions?** Reach out to the Backend team via the `#dev-chat` channel! 🚀
