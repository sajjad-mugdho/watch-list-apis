# 🎯 Dialist Chat & Trading: End-to-End Overview

If you are a developer building the Dialist experience, this is the **single guide** you need to understand how a user goes from "Just Browsing" to "Buying a Watch."

---

## 🌟 The "Happy Path" Scenario

Imagine two users: **Keshab (Seller)** and **Test (Buyer)**.

### 1. The Spark (Discovery)
Test is browsing the marketplace and finds Keshab's **Rolex Datejust**. He has a question.
- **Action**: Test clicks "Send Message" or "Inquire."
- **Backend**: We call the **Inquiry API**. 
- **Result**: Instantly, a chat room is created. Both users are added, and a notification pops up for Keshab.

### 2. The Negotiation (Real-time Message)
They start talking in the chat.
- **Keshab**: "Yes, I have the original box and papers."
- **Test**: "Great! Can you ship it today?"
- **Tech**: This is all handled by **GetStream**. It's fast, shows typing indicators, and feels like WhatsApp.

### 3. The Move (The Offer)
Test decides to buy it but wants a small discount. 
- **Action**: Test clicks "Make Offer" and enters **$48,000**.
- **Backend**: We record this offer and send a **System Message** into the chat.
- **Result**: Inside the chat bubble, Keshab sees buttons to **[Accept]**, **[Decline]**, or **[Counter]**.

### 4. The Handshake (Acceptance)
Keshab is happy with $48,000. 
- **Action**: Keshab clicks **[Accept]**.
- **Result**: The listing is automatically **Reserved** (locked). No one else can buy it. An **Order** is created in the background.

### 5. The Finish Line (Payment & Shipping)
Test pays via the platform.
- **Order State**: Moves from `paid` → `shipped` → `completed`.
- **System Automation**: Every time the status changes, a message appears in the chat: *"🚚 Order Shipped! Tracking UI available."*

---

## 🧠 Things You Must Know

### 1. Unified Experience
Even though we use **GetStream** for chat and **Clerk** for auth, the user should never feel it. The backend handles the "gluing" of these services together.

### 2. Automated Smart Messages
We don't just send text. We send **System Messages**. 
- These are identified by `custom.system_message: true`.
- They are the "triggers" for your UI. When you see an "Offer" type message, you show the Accept/Decline buttons.

### 3. Notifications keep users coming back
We send notifications for:
- 📩 New Messages
- 💰 Received Offers
- 🚚 Shipping Updates
- 👥 New Followers

---

## 🛠️ Summary for Developers

| Step | Endpoint to use | Why? |
| :--- | :--- | :--- |
| **Login** | `/api/v1/auth/bootstrap` | Get user info and permissions. |
| **Startup** | `/api/v1/chat/token` | Get the key to start the chat engine. |
| **Start Chat** | `/api/v1/marketplace/listings/:id/inquire` | Creates the room and alerts the seller. |
| **Negotiate** | `/api/v1/messages/send` | Sends a message that's saved forever. |
| **Offer** | `/api/v1/marketplace/listings/:id/offers` | Starts the formal buying process. |

---

**That's it!** If you build your UI to follow this flow, you'll create a world-class trading experience.
