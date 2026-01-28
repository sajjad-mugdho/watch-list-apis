# Complete Chat Architecture with Business Logic

## Overview

This document explains how real-time chat works with GetStream while maintaining full control over your data and business logic through webhooks.

---

## Architecture Summary

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Frontend   │◄───────►│  GetStream   │◄───────►│  Frontend   │
│  (User A)   │ WebSocket   Cloud     │ WebSocket   (User B)   │
└─────┬───────┘         └──────┬───────┘         └─────┬───────┘
      │                        │                        │
      │ REST                   │ Webhooks               │
      │                        ▼                        │
      │              ┌──────────────────┐              │
      └─────────────►│  Your Backend    │◄─────────────┘
                     │  - Auth tokens   │
                     │  - Channels      │
                     │  - Webhooks      │
                     │  - Business logic│
                     └────────┬─────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │  MongoDB    │
                       │  - Messages │
                       │  - Analytics│
                       └─────────────┘
```

---

## How It Works

### Phase 1: Real-Time Messaging (GetStream)

1. **User A sends message** → Goes to GetStream Cloud via WebSocket
2. **GetStream delivers message** → To User B via WebSocket (real-time!)
3. **GetStream fires webhook** → To your backend with message data

### Phase 2: Business Logic (Your Backend)

4. **Your backend receives webhook** → Signature verified
5. **Store message in MongoDB** → Full message history
6. **Apply business logic**:
   - Spam detection
   - Content moderation
   - Analytics tracking
   - Custom notifications
   - Engagement metrics
7. **Trigger custom actions**:
   - Send email notifications
   - Update user scores
   - Log for compliance
   - Generate reports

---

## Implementation

### 1. Backend Components

#### a) ChatMessage Model (`/src/models/ChatMessage.ts`)

Stores every message from GetStream with:
- Message content and metadata
- Marketplace context (listing, offer, order)
- Moderation flags
- Analytics data

```typescript
const message = await ChatMessage.create({
  stream_message_id: "msg_123",
  stream_channel_id: "listing_abc_buyer_seller",
  text: "Is this watch still available?",
  sender_id: buyerId,
  listing_id: listingId,
  type: "regular"
});
```

#### b) Webhook Handler (`/src/routes/getstreamWebhookRoutes.ts`)

Receives webhooks from GetStream for:
- `message.new` - New message sent
- `message.updated` - Message edited
- `message.deleted` - Message removed
- `message.read` - Message read receipt
- `channel.created` - New channel
- `channel.updated` - Channel modified

#### c) Business Logic Functions

**Spam Detection:**
```typescript
async function isSpamMessage(text: string): Promise<boolean> {
  const spamKeywords = ["buy now", "click here"];
  return spamKeywords.some(k => text.toLowerCase().includes(k));
}
```

**Analytics Tracking:**
```typescript
async function trackMessageActivity(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, {
    $set: { last_activity: new Date() },
    $inc: { message_count: 1 }
  });
}
```

**Custom Notifications:**
```typescript
async function sendOfferNotification(senderId: string, offerData: any): Promise<void> {
  // Send email, push notification, SMS, etc.
  await emailService.send({
    to: seller.email,
    template: 'new_offer',
    data: offerData
  });
}
```

---

### 2. GetStream Dashboard Configuration

**Set Webhook URL in GetStream Dashboard:**

1. Go to: https://dashboard.getstream.io
2. Select your app
3. Navigate to **Chat** → **Webhooks**
4. Add webhook URL: `https://yourdomain.com/api/v1/webhooks/getstream`
5. Select events:
   - ✅ message.new
   - ✅ message.updated
   - ✅ message.deleted
   - ✅ message.read
   - ✅ channel.created
   - ✅ channel.updated
6. Set webhook secret (for signature verification)

---

### 3. Environment Variables

```bash
# .env
GETSTREAM_API_KEY=your_api_key
GETSTREAM_API_SECRET=your_api_secret
GETSTREAM_APP_ID=your_app_id
GETSTREAM_WEBHOOK_SECRET=your_webhook_secret  # Optional, uses API_SECRET if not set
```

---

## Complete Flow Example

### Scenario: Buyer sends offer message

```
1. Buyer clicks "Make Offer" → Frontend
                                  ↓
2. POST /api/v1/networks/listings/{id}/offers → Backend
                                  ↓
3. Backend creates offer in MongoDB
                                  ↓
4. Backend creates GetStream chat channel
                                  ↓
5. Backend sends system message via GetStream
                                  ↓
6. Seller receives message instantly via WebSocket ← GetStream Cloud
                                  ↓
7. GetStream fires webhook → POST /api/v1/webhooks/getstream
                                  ↓
8. Backend receives webhook, verifies signature
                                  ↓
9. Backend stores message in MongoDB (ChatMessage)
                                  ↓
10. Backend applies business logic:
    - Tracks seller engagement
    - Sends email notification
    - Updates listing "last_message" timestamp
    - Logs for analytics
                                  ↓
11. Webhook processed, returns 200 OK
```

---

## What You Can Track & Control

### ✅ Full Message History
```typescript
// Get all messages for a listing
const messages = await ChatMessage.getMessagesByListing(listingId);

// Get all messages from a user
const userMessages = await ChatMessage.getMessagesByUser(userId);
```

### ✅ Analytics & Reporting
```typescript
// Message statistics
GET /api/v1/webhooks/getstream/analytics/messages?startDate=2026-01-01&endDate=2026-01-31

// Response:
{
  "total_messages": 1542,
  "unique_users": 234,
  "messages_by_type": [
    { "_id": "regular", "count": 1200 },
    { "_id": "system", "count": 200 },
    { "_id": "offer", "count": 142 }
  ]
}
```

### ✅ Content Moderation
```typescript
// Flag message for review
await ChatMessage.flagMessage(
  messageId,
  "Inappropriate content",
  moderatorId
);

// Query flagged messages
const flagged = await ChatMessage.find({ is_flagged: true });
```

### ✅ User Activity Tracking
```typescript
// Track user engagement
await User.findByIdAndUpdate(userId, {
  $set: { last_message_at: new Date() },
  $inc: { 
    total_messages_sent: 1,
    engagement_score: 5
  }
});
```

### ✅ Listing Engagement Metrics
```typescript
// Update listing metrics
await MarketplaceListing.findByIdAndUpdate(listingId, {
  $inc: { message_count: 1, engagement_score: 1 },
  $set: { last_message_at: new Date() }
});
```

### ✅ Custom Notifications
```typescript
// Send notifications based on message content
if (messageType === "offer") {
  await sendEmailNotification(sellerId, {
    type: "new_offer",
    amount: offerAmount,
    buyer: buyerName
  });
}
```

---

## Business Logic Examples

### Example 1: Spam Detection & Auto-Moderation

```typescript
async function handleMessageNew(event: any): Promise<void> {
  const { message } = event;
  
  // Store message
  const chatMessage = await ChatMessage.create({...});
  
  // Check for spam
  if (await isSpamMessage(message.text)) {
    // Flag in database
    await ChatMessage.flagMessage(
      message.id,
      "Potential spam",
      "system"
    );
    
    // Delete from GetStream if needed
    await chatService.deleteMessage(message.channel_id, message.id);
    
    // Notify moderators
    await notifyModerators({
      type: "spam_detected",
      messageId: message.id,
      userId: message.user.id
    });
  }
}
```

### Example 2: Auto-Response System

```typescript
async function handleMessageNew(event: any): Promise<void> {
  const { message, channel_id } = event;
  
  // Detect common questions
  if (message.text.toLowerCase().includes("is this available")) {
    const listing = await getListingFromChannel(channel_id);
    
    if (listing.status === "sold") {
      // Auto-respond
      await chatService.sendSystemMessage(
        channel_id,
        {
          type: "auto_response",
          message: "This item has been sold. Check out similar watches in our marketplace!"
        },
        "system"
      );
    }
  }
}
```

### Example 3: Analytics Dashboard Data

```typescript
// Track response times
async function handleMessageRead(event: any): Promise<void> {
  const { user, channel_id, last_read_message_id } = event;
  
  const message = await ChatMessage.findOne({
    stream_message_id: last_read_message_id
  });
  
  if (message) {
    const responseTime = Date.now() - message.createdAt.getTime();
    
    // Track seller response time
    await SellerMetrics.updateOne(
      { seller_id: user.id },
      {
        $push: { response_times: responseTime },
        $set: { avg_response_time: calculateAverage(responseTimes) }
      }
    );
  }
}
```

---

## Querying Your Data

### Get Messages for a Listing
```typescript
GET /api/v1/webhooks/getstream/messages/listing/{listingId}

// Returns all messages with sender details
{
  "data": [
    {
      "_id": "...",
      "text": "Is this watch still available?",
      "sender_id": {
        "display_name": "John Doe",
        "avatar": "https://..."
      },
      "createdAt": "2026-01-06T00:00:00Z",
      "type": "regular"
    }
  ],
  "total": 15
}
```

### Analytics Query
```typescript
GET /api/v1/webhooks/getstream/analytics/messages?startDate=2026-01-01&listingId=123

// Returns aggregated stats
{
  "total_messages": 150,
  "unique_users": 25,
  "messages_by_type": {...},
  "avg_messages_per_day": 5,
  "peak_hours": [14, 15, 16]
}
```

---

## Security

### Webhook Signature Verification

Every webhook is verified using HMAC-SHA256:

```typescript
function verifyWebhookSignature(req: Request): boolean {
  const signature = req.headers["x-signature"];
  const secret = process.env.GETSTREAM_WEBHOOK_SECRET;
  
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**Important:** Only process webhooks with valid signatures!

---

## Benefits of This Architecture

### ✅ Real-Time Delivery
- Messages delivered instantly via WebSocket
- No polling required
- Typing indicators, presence, read receipts

### ✅ Full Data Control
- Every message stored in your MongoDB
- Complete message history
- Data ownership and privacy compliance
- Can migrate away from GetStream if needed

### ✅ Business Logic
- Spam detection and moderation
- Custom notifications
- Analytics and reporting
- Compliance and audit trails

### ✅ Scalability
- GetStream handles WebSocket connections
- Your backend processes asynchronously
- No impact on real-time performance

### ✅ Flexibility
- Easy to add new business rules
- Integrate with any service
- Custom notification channels
- Advanced analytics

---

## Testing

### Test Webhook Locally

Use ngrok to expose local server:

```bash
# Terminal 1: Start your backend
npm run dev

# Terminal 2: Start ngrok
ngrok http 5050

# Copy ngrok URL and set in GetStream dashboard:
# https://abc123.ngrok.io/api/v1/webhooks/getstream
```

### Send Test Webhook

```bash
curl -X POST http://localhost:5050/api/v1/webhooks/getstream \
  -H "Content-Type: application/json" \
  -H "x-signature: <calculated_signature>" \
  -d '{
    "type": "message.new",
    "message": {
      "id": "test_msg_123",
      "text": "Test message",
      "user": { "id": "user_123" }
    },
    "channel_id": "test_channel",
    "channel_type": "messaging"
  }'
```

---

## Summary

**🎯 You get the best of both worlds:**

1. **Real-Time Performance** from GetStream
   - WebSocket connections
   - Instant message delivery
   - Typing indicators
   - Presence

2. **Full Business Control** in your backend
   - Every message stored in MongoDB
   - Apply any business logic
   - Complete analytics
   - Data ownership

**The flow is:**
```
User sends message → GetStream (instant delivery) → Other user receives
                           ↓
                     Webhook to your backend
                           ↓
                   MongoDB + Business Logic
```

**You control everything through webhooks while GetStream handles the complex real-time infrastructure!**
