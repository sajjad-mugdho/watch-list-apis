# GetStream Integration Architecture

## Overview: Server vs Stream Responsibilities

This document clarifies the roles and responsibilities of our backend vs GetStream, addressing the reviewer's questions.

---

## Role Distribution

| Responsibility | Our Server | GetStream |
|----------------|------------|-----------|
| **User Authentication** | Issues JWT tokens | Validates tokens |
| **Channel Creation** | Creates via API call | Stores & manages |
| **Message Storage** | MongoDB (source of truth) | Redis/cache (real-time) |
| **Real-time Delivery** | ❌ | ✅ WebSocket |
| **Push Notifications** | Triggers | Delivers (optional) |
| **Moderation** | Business logic | Content filtering |
| **Analytics** | Full tracking | Limited |

---

## Message Flow Patterns

### 1. User-to-User Chat (Real-time Path)
```
Client → GetStream WebSocket → Instant Delivery to Recipient
                             ↓
                     Webhook → Our Server → MongoDB
```
- **Latency:** ~50-100ms (real-time)
- **Our Role:** Persist to MongoDB via webhook for analytics/audit

### 2. Backend-Controlled Messages (API Path)
```
Client → POST /messages/send → MongoDB + GetStream (sequential)
                                        ↓
                            Webhook → Idempotency check → Skip
```
- **Latency:** ~100-200ms
- **Our Role:** Store first, then deliver for guaranteed persistence

### 3. System Messages (Offers, Orders)
```
Backend Event → chatService.sendSystemMessage() → GetStream
                                                    ↓
                                    Webhook → MongoDB (backup)
```

---

## Idempotency Handling

| Resource | Idempotency Key | Storage |
|----------|-----------------|---------|
| Channels | MD5(listing_id + buyer + seller) | Deterministic ID |
| Webhooks | `x-webhook-id` header | GetstreamWebhookEvent |
| Messages | `stream_message_id` | ChatMessage |

### Channel ID Generation
```typescript
// Deterministic - same inputs = same channel
const channelId = crypto.createHash("md5").update(
  `listing_${listingId}_${buyer}_${seller}`
).digest("hex");
```

---

## Failure Handling Scenarios

### Scenario A: Our DB writes → Stream throws error
```typescript
// In /messages/send
const dbMessage = await ChatMessage.create({...});  // ✅ Saved
try {
  await streamChannel.sendMessage({...});           // ❌ Failed
  dbMessage.status = "delivered";
} catch (error) {
  dbMessage.status = "pending_delivery";            // Marked for retry
}
```

### Scenario B: Stream success → Our DB error
```typescript
// In webhookProcessor
try {
  await processEvent(payload);
  event.status = "processed";                       // ✅ Success
} catch (error) {
  event.status = "failed";                          // Marked for retry
  throw error;                                      // Bull will retry
}
```

---

## API Routing Decisions

### Current: `/api/v1/feeds/following`
**Rationale:** Groups all Stream Activity Feed-related routes together:
- `/feeds/following` - Get users I follow
- `/feeds/followers` - Get my followers
- `/feeds/timeline` - Get my activity feed

**Trade-off:** "feeds" is not a REST resource, but it keeps Stream-specific functionality isolated.

### Alternative: `/api/v1/user/following`
This would treat it as a user resource property, which is more RESTful but couples the route structure to the underlying implementation.

**Recommendation:** Current approach is fine for now. If "feeds" grows complex, consider refactoring to `/api/v1/social/*` namespace.

---

## Key Design Principles

1. **Backend as Controller**
   - All critical operations go through our server
   - Stream handles real-time delivery, not business logic

2. **MongoDB as Source of Truth**
   - All messages stored in our database
   - Stream data is for real-time UX only

3. **Async Webhook Processing**
   - Webhooks enqueue to Bull immediately (<50ms response)
   - Processing happens in background worker

4. **Graceful Degradation**
   - If Stream is down, messages are stored locally
   - System continues to function, just without real-time
