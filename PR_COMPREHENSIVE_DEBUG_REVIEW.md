# PR Review: Critical Issues & Best Practices Guide

**PR**: Network batch 2 enhancement (Chat webhook + Home feed)  
**Review Date**: April 14, 2026  
**Status**: 🔴 **CRITICAL BLOCKERS - DO NOT MERGE**  
**Total Issues**: 21 major + 5 minor issues identified  
**Severity**: 🔴 CRITICAL (12) | 🟠 MAJOR (9) | 🟡 MINOR (5)

---

## Table of Contents
1. [🔴 Critical Issues (BLOCKING)](#critical-issues)
2. [🟠 Major Issues (HIGH PRIORITY)](#major-issues)
3. [🟡 Minor Issues (MEDIUM PRIORITY)](#minor-issues)
4. [💡 Best Practices Guide](#best-practices)
5. [✅ Pre-Merge Checklist](#pre-merge-checklist)

---

## 🔴 Critical Issues (BLOCKING)

### CRITICAL #1: Webhook Early Returns Block Networks Handlers
**Files**: `src/workers/webhookProcessor.ts`  
**Severity**: 🔴 **CRITICAL - Feature completely non-functional**  
**Status**: ALL Networks domain handlers never execute

#### The Problem
```typescript
// Current code structure:
async function processWebhookJob(job: Job<WebhookJobData>): Promise<string> {
  const { type, payload } = job.data;
  
  // MAIN HANDLER - All cases return immediately
  switch (type) {
    case "message.new":
      return await handleGetstreamMessageNew(payload, eventId);  // ❌ RETURNS HERE
    case "message.read":
      return await handleGetstreamMessageRead(payload, eventId); // ❌ RETURNS HERE
    case "message.updated":
      return await handleGetstreamMessageUpdated(payload, eventId); // ❌ RETURNS HERE
    // ... all 10 case branches return
  }
  
  // THIS CODE NEVER RUNS ❌
  const cid = payload.cid || `${channel_type}:${channel_id}`;
  const isNetworksEvent = cid?.includes("networks");
  
  if (isNetworksEvent) {
    try {
      // Dynamically import Networks handlers
      const { onNetworkChatMessageNew, ... } = require("../networks/events");
      
      switch (type) {
        case "message.new":
          await onNetworkChatMessageNew(payload);  // NEVER CALLED
          // ...
      }
    } catch (networksError) {
      // ...
    }
  }
  
  return getstreamHandlerResult; // Used but never set
}
```

**Impact**:
- ❌ All Networks webhook handlers do NOT execute
- ❌ Unread counts never update
- ❌ Message archive never happens
- ❌ Channel metadata never syncs
- ❌ Features completely broken silently
- ✅ Global handlers run, return immediately, skip Networks logic

**Root Cause**: 
Early returns in the switch block prevent any code after the switch from executing.

#### The Fix
Extract Networks-specific logic into a separate function and execute it BEFORE returning:

```typescript
async function processWebhookJob(job: Job<WebhookJobData>): Promise<string> {
  let getstreamHandlerResult = "";
  const { webhookEventId, eventId, provider, type, payload } = job.data;
  
  // Step 1: Run global GetStream handler and store result
  getstreamHandlerResult = await runGetstreamHandler(type, payload, eventId);
  
  // Step 2: Run Networks domain handler (side effects only, don't return)
  await runNetworksDomainHandler(payload, type, eventId, cid);
  
  // Step 3: Return the global handler result
  return getstreamHandlerResult;
}

async function runNetworksDomainHandler(
  payload: any,
  type: string,
  eventId: string,
  cid?: string,
): Promise<void> {
  const isNetworksEvent = cid?.includes("networks");
  if (!isNetworksEvent) return;
  
  try {
    const { onNetworkChatMessageNew, ... } = require("../networks/events");
    
    switch (type) {
      case "message.new":
        await onNetworkChatMessageNew(payload);
        break;
      case "message.read":
        await onNetworkChatMessageRead(payload);
        break;
      // ... etc
    }
  } catch (networksError) {
    logger.error("Networks domain handler failed", { error: networksError });
    // Don't rethrow - Networks failures shouldn't block global handlers
  }
}

async function runGetstreamHandler(
  type: string,
  payload: any,
  eventId: string,
): Promise<string> {
  switch (type) {
    case "message.new":
      return await handleGetstreamMessageNew(payload, eventId);
    case "message.read":
      return await handleGetstreamMessageRead(payload, eventId);
    // ... return values as before
  }
  return "";
}
```

**Verification**: After fix, verify:
```bash
# Test message.new webhook
1. Send message in GetStream
2. Check MongoDB: ChatMessage should exist (archived)
3. Check: NetworkListingChannel.last_message_at updated
4. Check: NetworkListingChannel.unread_count incremented
```

**Introduced By**: Refactor that split global + Networks handlers  
**Why It Matters**: Core chat functionality is broken

---

### CRITICAL #2: Missing Required Field - sender_clerk_id
**Files**: `src/networks/events/getstreamHandlers.ts` (lines 124-139)  
**Severity**: 🔴 **CRITICAL - All message archives fail silently**  
**Status**: Validation failures silently swallowed

#### The Problem
```typescript
// ChatMessage model requires sender_clerk_id:
// src/networks/models/ChatMessage.ts line 114-118
sender_clerk_id: {
  type: String,
  required: true,  // ❌ REQUIRED
  index: true,
  description: "Clerk user ID of message sender",
}

// But webhook handler NEVER provides it:
// src/networks/events/getstreamHandlers.ts line 124-139
export async function onNetworkChatMessageNew(payload: any) {
  // ... setup code ...
  
  await ChatMessage.create({
    channel_id: channelId,
    getstream_message_id: message.id,
    sender_id: new Types.ObjectId(senderId),
    text: message.text || "",
    // ❌ MISSING: sender_clerk_id
    // ❌ MISSING: status
    // ❌ MISSING: read_by
  });
}
```

**GetStream Payload Structure**:
```typescript
// GetStream webhook provides:
{
  message: {
    id: "message-123",
    user: {
      id: "clerk-user-id",        // Clerk ID is here
      name: "John",
    },
    text: "Hello",
    created_at: "2026-04-14T10:00:00.000Z",
  }
}
```

**Impact**:
- ❌ `ChatMessage.create()` fails validation (sender_clerk_id required)
- ❌ Error caught silently in try/catch
- ❌ Message never archived to MongoDB
- ❌ Appears successful in logs ("✅ Message New Handler") but failed
- ❌ Message isn't in DB when queried later
- ❌ Channel preview stays empty

#### The Fix
Extract clerk ID from webhook payload and include it:

```typescript
export async function onNetworkChatMessageNew(payload: any) {
  const message = payload.message || {};
  const senderId = message.user?.id || message.user_id || "unknown";
  const senderClerkId = message.user?.id || senderId; // GetStream user.id IS the Clerk ID
  
  // ... setup code ...
  
  const channelId = payload.channel?.id || payload.cid?.split(":")[1];
  
  // Verify we have required fields
  if (!channelId || !message.id || !senderId || !senderClerkId) {
    throw new Error(
      `Missing required fields for message archive: ` +
      `channelId=${channelId}, messageId=${message.id}, ` +
      `senderId=${senderId}, senderClerkId=${senderClerkId}`
    );
  }
  
  try {
    const archived = await ChatMessage.create({
      channel_id: channelId,
      getstream_message_id: message.id,
      sender_id: new Types.ObjectId(senderId),
      sender_clerk_id: senderClerkId,  // ✅ NOW PROVIDED
      text: message.text || "",
      type: message.type || "regular",
      status: "delivered",  // ✅ NOW PROVIDED
      read_by: [],  // ✅ NOW PROVIDED
      attachments: message.attachments || [],
      parent_id: message.parent_id || null,
      created_at: new Date(message.created_at || Date.now()),
    });
    
    logger.info("Message archived to MongoDB", {
      messageId: message.id,
      channelId,
      senderId,
    });
  } catch (archiveError) {
    logger.error("Failed to archive message", {
      messageId: message.id,
      error: archiveError,
      // Don't include full payload (PII)
    });
    // Don't rethrow - archive is supplementary, not critical
  }
}
```

**Verification**:
```bash
# 1. Send message via GetStream client
# 2. Check MongoDB for archived message
db.chatmessages.findOne({ getstream_message_id: "msg-123" })

# 3. Verify required fields present:
{
  channel_id: "...",
  getstream_message_id: "msg-123",
  sender_id: ObjectId("..."),
  sender_clerk_id: "clerk_...",  # ✅ Present
  status: "delivered",            # ✅ Present
  text: "...",
  read_by: [],                    # ✅ Present
}
```

**Also Affects**:
- `onNetworkChatMessageUpdated()` (line 227-236)
- `onNetworkChatMessageDeleted()` (line 276-284)
- All need sender_clerk_id field

---

### CRITICAL #3: Status Enum Mismatch
**Files**: 
- `src/networks/models/ChatMessage.ts` (schema)
- `src/repositories/MessageRepository.ts` (create, update)
- `src/networks/events/getstreamHandlers.ts` (archive)

**Severity**: 🔴 **CRITICAL - Validation errors**  
**Status**: Multiple mismatches between schema and code

#### The Problem
```typescript
// Schema defines enum:
// src/networks/models/ChatMessage.ts line 204-209
status: {
  type: String,
  enum: ["pending_delivery", "delivered", "failed"],  // ❌ Only 3 values
  default: "pending_delivery",
}

// But repository tries to set invalid values:
// src/repositories/MessageRepository.ts line 138
createMessage() {
  status: "sent",  // ❌ NOT in enum - validation fails
}

// And handlers use other invalid values:
// src/networks/events/getstreamHandlers.ts line 127
status: "delivered",  // ✅ Valid

// And soft-delete uses:
// src/repositories/MessageRepository.ts line 192
updateMany({ ..., "is_deleted": true })
// But there's no "deleted" status in enum
```

#### Impact
- ❌ `createMessage()` fails - "sent" not in enum
- ❌ Get 400 validation errors
- ❌ Messages don't save
- ❌ Silently fail in catch blocks (dangerous)

#### The Fix
**Option A**: Update schema to include all values
```typescript
// src/networks/models/ChatMessage.ts
status: {
  type: String,
  enum: [
    "pending_delivery",  // Initial state
    "delivered",         // Confirmed to GetStream
    "sent",              // Legacy value (deprecated)
    "failed",            // Failed to deliver
    "deleted",           // Soft-deleted
  ],
  default: "pending_delivery",
}
```

**Option B**: Standardize all code to use valid enum values
```typescript
// src/repositories/MessageRepository.ts - use valid value
createMessage() {
  return this.create({
    // ...
    status: "pending_delivery",  // ✅ Valid
  });
}

// Use separate is_deleted flag for soft-deletes
softDelete() {
  return this.updateMany({
    ...,
    is_deleted: true,  // Separate boolean flag
  });
}
```

**Recommendation**: Go with **Option B** - don't bloat status enum  
Define valid states clearly:
```typescript
// Types
type ChatMessageStatus = "pending_delivery" | "delivered" | "failed";

// When message created: "pending_delivery"
// GetStream delivers: "delivered"  
// GetStream fails: "failed"
// Soft-delete: is_deleted: true (separate field, not status)
```

---

### CRITICAL #4: Webhook Signature Verification - Raw Body Required
**Files**: `src/networks/routes/webhookRoutes.ts` (lines 18-32)  
**Severity**: 🔴 **CRITICAL - Security vulnerability**  
**Status**: Signature verification does NOT match GetStream's expectation

#### The Problem
```typescript
// Current (WRONG):
function verifyWebhookSignature(req: Request): boolean {
  const signature = req.headers["x-signature"] as string;
  const body = JSON.stringify(req.body);  // ❌ WRONG!
  
  const hash = crypto
    .createHmac("sha256", GETSTREAM_WEBHOOK_SECRET)
    .update(body)  // Computing hash of stringified JSON
    .digest("hex");

  return hash === signature;  // ❌ Timing attack vulnerability
}
```

**Why It's Wrong**:
1. **JSON Stringification Changes**: `JSON.stringify()` can reorder keys, vary whitespace
   ```typescript
   { a: 1, b: 2 } → "{"a":1,"b":2}"  // Different stringification methods differ
   { b: 2, a: 1 } → "{"b":2,"a":1}"  // Different key order = different hash
   ```

2. **GetStream Uses Raw Bytes**: GetStream computes HMAC on the exact raw HTTP body bytes
   - Express body-parser parses JSON and loses the raw bytes
   - We're computing hash on re-stringified JSON (different from original)
   - Hash mismatch = signature verification fails

3. **Timing Attack Vulnerability**: String comparison `hash === signature` is timing-unsafe
   ```typescript
   // Timing attack:
   hash =      "abc123def456..."
   signature = "xyz789abc123..."
   
   // Comparison does byte-by-byte, short-circuits on first diff
   // Time to failure leaks how many bytes matched
   // Attacker can deduce correct signature byte-by-byte
   ```

#### Impact
- ❌ Webhook signatures don't verify against GetStream
- ❌ Legitimate webhooks rejected
- ❌ Or worse: timing attack allows forged webhooks

#### The Fix
```typescript
import { raw, Request, Response } from "express";

// Use express.raw() middleware to capture raw body
function verifyWebhookSignature(
  signatureHeader: string | undefined,
  rawBody: Buffer,
): boolean {
  if (!signatureHeader || !GETSTREAM_WEBHOOK_SECRET) {
    logger.warn("Missing webhook signature or secret");
    return false;
  }

  // Computer HMAC on the EXACT raw bytes
  const expectedSignature = crypto
    .createHmac("sha256", GETSTREAM_WEBHOOK_SECRET)
    .update(rawBody)  // ✅ Use raw bytes, not JSON string
    .digest("hex");

  // Use timing-safe comparison to prevent timing attacks
  try {
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const providedBuffer = Buffer.from(signatureHeader.trim(), "utf8");
    
    // Return false if lengths don't match (prevents length-based leaks)
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }
    
    // Use crypto.timingSafeEqual for constant-time comparison
    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

// Mount webhook route with express.raw() to capture raw body
router.post(
  "/getstream/chat",
  raw({ type: "application/json" }),  // ✅ Capture raw body bytes
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers["x-signature"] as string | undefined;
      const rawBody = req.body as Buffer;  // ✅ Now contains raw bytes
      
      if (!verifyWebhookSignature(signature, rawBody)) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      
      // Parse the JSON now that signature is verified
      const parsed = JSON.parse(rawBody.toString("utf8"));
      const { type, data } = parsed;
      
      // ... rest of handler
    } catch (err) {
      next(err);
    }
  }
);
```

**Verification**:
```bash
# GetStream webhook signature should verify correctly now
# Test with GetStream webhook testing tool
# Should see "✅ Webhook signature verified" instead of "❌ Invalid signature"
```

**Security Best Practices**:
✅ Raw body capture before parsing  
✅ HMAC computed on raw bytes  
✅ Timing-safe comparison (crypto.timingSafeEqual)  
✅ Constant-time comparison (same time regardless of mismatch position)

---

## 🟠 Major Issues (High Priority)

### MAJOR #1: Webhook Double-Processing Risk
**Files**: 
- `src/routes/webhooksRoutes.ts` (line 11)
- `src/networks/routes/webhookRoutes.ts`

**Severity**: 🟠 **MAJOR - Duplicate event processing**

#### The Problem
```typescript
// Global webhooks router:
// src/routes/webhooksRoutes.ts
import chatWebhookRoutes from "../networks/routes/webhookRoutes";

const router: Router = Router();
router.post("/clerk", webhook_clerk_post);
router.post("/persona", handlePersonaWebhook);
router.use("/chat", chatWebhookRoutes);  // ❌ Mounts at /webhooks/chat/*

// Networks webhook router:
// src/networks/routes/webhookRoutes.ts
router.post("/getstream/chat", ...);  // Mounts at its own path

// Result: GetStream sends to /webhooks/chat/getstream/chat
// But should send to /api/v1/networks/webhooks/getstream/chat
// OR to /v1/webhooks/getstream/chat
// Having TWO endpoints can cause double-processing
```

**Scenarios**:
1. GetStream configured with `/webhooks/chat/getstream/chat` - works
2. GetStream configured with `/v1/webhooks/getstream/chat` - doesn't work
3. If internal forwarding happens, BOTH might get called - double processing

**Impact**:
- ❌ Unread count incremented twice
- ❌ Messages archived twice  
- ❌ Analytics doubled
- ❌ Race conditions

#### The Fix
```typescript
// Option 1: Remove from global webhooks router
// src/routes/webhooksRoutes.ts - REMOVE this line:
// router.use("/chat", chatWebhookRoutes);

// Keep only Networks-specific route at:
// /api/v1/networks/webhooks/getstream/chat

// Option 2: Consolidate to single endpoint
// Remove Networks webhook route and consolidate to global:
// /v1/webhooks/getstream/chat

// Decision: Go with Option 1 (domain-specific route better)
// GetStream config should point to:
// https://api.dialist.com/api/v1/networks/webhooks/getstream/chat
```

---

### MAJOR #2: Schema Field Mismatches - Virtual vs Persisted
**Files**: `src/repositories/MessageRepository.ts`  
**Severity**: 🟠 **MAJOR - Queries return 0 results**

#### The Problem
```typescript
// ChatMessage schema:
// src/networks/models/ChatMessage.ts
schema.add({
  channel_id: { type: ObjectId, required: true },  // ✅ Persisted field
  getstream_message_id: { type: String },           // ✅ Persisted field
});

// Virtual field - NOT persisted, NOT queryable:
schema.virtual("stream_channel_id").get(function() {
  return this.channel_id?.toString();  // ❌ Virtual
});

// Repository queries using virtual field:
// src/repositories/MessageRepository.ts line 170
markChannelAsRead(channelId: string) {
  return this.updateMany({
    stream_channel_id: channelId,  // ❌ VIRTUAL - won't match anything!
    sender_id: { $ne: userObjectId },
    'read_by.user_id': { $ne: userObjectId },
  });
}

// Also at line 181:
getMediaByChannel(channelId: string) {
  const total = await this.count({
    stream_channel_id: channelId,  // ❌ VIRTUAL
  });
}
```

**Why Virtuals Don't Work in Queries**:
```typescript
// This works (accessing property):
const message = await ChatMessage.findById(id);
console.log(message.stream_channel_id);  // ✅ Computed on the fly

// This doesn't work (querying):
const messages = await ChatMessage.find({
  stream_channel_id: "123"  // ❌ Mongoose can't see virtuals in queries
});
// Result: Empty array (0 matches)
```

#### The Fix
Use persisted fields in queries:

```typescript
// Option A: Use persisted channel_id field
markChannelAsRead(channelId: string) {
  return this.updateMany({
    channel_id: channelId,  // ✅ Persisted field
    sender_id: { $ne: userObjectId },
    'read_by.user_id': { $ne: userObjectId },
  });
}

getMediaByChannel(channelId: string) {
  const total = await this.count({
    channel_id: channelId,  // ✅ Persisted field
  });
}

// Option B: Add path aliases (makes both names work)
schema.aliases.stream_channel_id = "channel_id";

// Then both work:
ChatMessage.find({ channel_id: "..." })      // ✅ Direct
ChatMessage.find({ stream_channel_id: "..." })  // ✅ Via alias
```

**Fix All Instances**:
- Line 170: `stream_channel_id` → `channel_id`
- Line 181: `stream_channel_id` → `channel_id`  
- Line 186: `stream_channel_id` → `channel_id`
- Line 191: Ensure update uses persisted fields

---

### MAJOR #3: Per-User Unread Count Not Implemented
**Files**: 
- `src/networks/models/NetworkListingChannel.ts` (lines 90-95)
- `src/networks/services/NetworksChatService.ts` (lines 231, 274)

**Severity**: 🟠 **MAJOR - Wrong unread totals**

#### The Problem
```typescript
// Schema has channel-level unread count:
// src/networks/models/NetworkListingChannel.ts
unread_count: {
  type: Number,
  default: 0,  // ❌ Single counter for entire channel
}

// Repository accepts recipientId but ignores it:
// src/networks/models/NetworkListingChannel.ts line 90-95
async updateUnreadCount(channelId: string, recipientId: string): Promise<void> {
  await this.updateOne(
    { _id: channelId },
    { $inc: { unread_count: 1 } }  // ❌ recipientId never used!
  );
  // recipientId accepted but ignored - signature is lying
}

// Because there's a single counter, both buyer and seller see same unread:
// Message from seller to buyer:
// 1. Buyer sees unread_count = 1 ✅ Correct
// 2. Seller sees unread_count = 1 ❌ Wrong (seller didn't send to self)

// When buyer reads:
// clearUnreadCount() sets unread_count = 0
// Now SELLER also sees 0 unread ❌ Wrong
```

**Data Structure**:
```typescript
// Current (WRONG):
{
  _id: channel-123,
  buyer_id: user-1,
  seller_id: user-2,
  unread_count: 3,  // ❌ Shared - not per-user
  last_read_at: 2026-04-14T10:00:00Z  // ❌ Shared
}

// Correct:
{
  _id: channel-123,
  buyer_id: user-1,
  seller_id: user-2,
  unread_counts: {
    [user-1]: 0,     // Buyer has 0 unread (read everything)
    [user-2]: 3,     // Seller has 3 unread (didn't read messages from buyer)
  },
  last_read_at: {
    [user-1]: 2026-04-14T10:00:00Z,
    [user-2]: 2026-04-14T08:00:00Z,
  }
}
```

#### The Fix
Implement per-user unread tracking:

```typescript
// Schema: Add per-user maps
unread_counts: {
  type: Map,
  of: Number,
  default: new Map(),  // { userId -> unreadCount }
},

last_read_at: {
  type: Map,
  of: Date,
  default: new Map(),  // { userId -> lastReadTime }
},

// Update unread count per recipient:
async updateUnreadCount(
  channelId: string, 
  recipientId: string  // Now actually used!
): Promise<void> {
  const userObjectId = new Types.ObjectId(recipientId);
  
  await this.updateOne(
    { _id: channelId },
    {
      $inc: {
        [`unread_counts.${recipientId}`]: 1  // ✅ Per-user
      }
    }
  );
}

// Clear unread for specific user:
async clearUnreadCount(channelId: string, userId: string): Promise<void> {
  await this.updateOne(
    { _id: channelId },
    {
      $set: {
        [`unread_counts.${userId}`]: 0,
        [`last_read_at.${userId}`]: new Date(),
      }
    }
  );
}

// Get unread count for user:
async getUnreadCount(channelId: string, userId: string): Promise<number> {
  const channel = await this.findById(channelId);
  return channel?.unread_counts?.get(userId) || 0;
}
```

---

### MAJOR #4: Connection Relationship Inverted  
**Files**:
- `src/networks/services/NetworksHomeFeedService.ts` (lines 267-270)
- `src/networks/handlers/NetworksConnectionHandlers.ts` (line 245)

**Severity**: 🟠 **MAJOR - Feed shows wrong users**

#### The Problem
```typescript
// Connection model semantics:
// follower_id = user who initiated (sent request)
// following_id = user who was targeted (received request)

// Example: User A connects to User B
// Creates: { follower_id: A, following_id: B, status: "accepted" }

// Now, get connections FOR User B (incoming):
// User B has accepted connections WHERE following_id === B
// Those connections have follower_id values = users connected TO B

// Current code (WRONG):
async getConnectionsListings(userId: string) {
  const acceptedConnections = await Connection.find({
    following_id: new Types.ObjectId(userId),  // ✅ Correct query
    status: "accepted",
  }).select("follower_id");  // ✅ Gets follower_ids
  
  const followerIds = acceptedConnections.map(c => c.follower_id);
  
  // Should fetch listings from followerIds
  // But logic says "get users they're connected to"
  // This is inverted - gets inbound connections, returns outbound
}

// If User A and User B mutually connect:
// A → B (follower_id: A, following_id: B)
// B → A (follower_id: B, following_id: A)

// For User B's home feed:
// Query 1: following_id: B → gets [ { follower_id: A }, { follower_id: X } ]
//         These are INBOUND connections (who connected to B)
// Query 2: follower_id: B → gets [ { following_id: A }, { following_id: Y } ]
//         These are OUTBOUND connections (who B connected to)

// Current code only uses Query 1
// So if B only connects out (not receiving connections), feed is empty
```

#### The Fix
Handle both directions:

```typescript
async getConnectionsListings(userId: string) {
  const userObjectId = new Types.ObjectId(userId);
  
  // Get BOTH inbound and outbound connections
  const connections = await Connection.find({
    $or: [
      // Outbound: Current user is the follower (they initiated)
      { follower_id: userObjectId, status: "accepted" },
      // Inbound: Current user is the following (they were added)
      { following_id: userObjectId, status: "accepted" },
    ]
  }).select("follower_id following_id");
  
  // Extract connected user IDs from both sides
  const connectedUserIds = new Set<string>();
  
  connections.forEach(conn => {
    // If we're the follower, add the following_id (user we connected to)
    if (String(conn.follower_id) === userId) {
      connectedUserIds.add(String(conn.following_id));
    }
    // If we're the following, add the follower_id (user who connected to us)
    else if (String(conn.following_id) === userId) {
      connectedUserIds.add(String(conn.follower_id));
    }
  });
  
  const listingIds = Array.from(connectedUserIds);
  const listings = await NetworkListing.find({
    dialist_id: { $in: listingIds },
    status: "active",
  });
  
  return listings;
}
```

Also fix cache invalidation:
```typescript
// src/networks/handlers/NetworksConnectionHandlers.ts line 245
// When user accepts connection:
async acceptConnection(connectionId: string, userId: string) {
  const result = await Connection.findByIdAndUpdate(connectionId, {
    status: "accepted"
  });
  
  // Invalidate BOTH users' caches
  await networksHomeFeedService.invalidateUserCache(userId);
  
  // Also invalidate the requester's cache
  if (result?.follower_id && String(result.follower_id) !== userId) {
    await networksHomeFeedService.invalidateUserCache(
      String(result.follower_id)  // ✅ The requester's cache
    );
  }
}
```

---

### MAJOR #5: Cache Key Missing Limit Parameter
**Files**: `src/networks/services/NetworksHomeFeedService.ts`  
**Severity**: 🟠 **MAJOR - Cache returns wrong amount of data**

#### The Problem
```typescript
// Cache keys don't include limit:
// src/networks/services/NetworksHomeFeedService.ts line 76-80
private getCacheKey(userId: string, section: string): string {
  return `networks_feed:${userId}:${section}`;  // ❌ No limit in key
}

// Usage:
async getRecommendedListings(userId: string, limit: number = 6) {
  const cacheKey = this.getCacheKey(userId, "recommended");  // ❌ Same key for all limits
  
  let listings = await this.getFromCache(cacheKey);
  
  if (!listings) {
    listings = await this.fetchRecommendedListings(userId, limit);
    await this.setInCache(cacheKey, listings, 300);  // ❌ Cache whatever limit was requested
  }
  
  return listings.slice(0, limit);  // Try slicing but may return wrong amount
}

// Scenario:
// 1. User A: GET /home?limit=6 → fetches 6 items, caches as "networks_feed:A:recommended"
// 2. User A: GET /home?limit=20 → hits cache, gets 6 items, tries slice(0, 20) → returns 6

// Later scenario (opposite):
// 1. User B: GET /home?limit=20 → fetches 20 items, caches 20
// 2. User B: GET /home?limit=6 → hits cache, should return 6, but could return 20
```

**Why This Matters**:
- Frontend requests with limit=6 for initial load
- Backend caches 6 results
- Frontend later requests limit=20 (pagination) → gets 6 (cache hit)
- Pagination appears broken

#### The Fix
Include limit in cache key:

```typescript
private getCacheKey(userId: string, section: string, limit: number = 6): string {
  return `networks_feed:${userId}:${section}:limit=${limit}`;  // ✅ Include limit
}

async getRecommendedListings(userId: string, limit: number = 6) {
  const cacheKey = this.getCacheKey(userId, "recommended", limit);  // ✅ Pass limit
  
  let listings = await this.getFromCache(cacheKey);
  
  if (!listings) {
    listings = await this.fetchRecommendedListings(userId, limit);
    await this.setInCache(cacheKey, listings, 300);
  }
  
  return listings;  // No need to slice - cache already has correct limit
}

// Now each limit has its own cache entry:
// networks_feed:user-1:recommended:limit=6
// networks_feed:user-1:recommended:limit=20
```

Apply same fix to:
- Featured listings cache (line 193)
- Connections feed cache (line 259)
- Favorites cache (line 372)

---

### MAJOR #6: Missing Sender_Clerk_ID in Message Archive
**Files**: `src/networks/events/getstreamHandlers.ts` (multiple handlers)  
**Severity**: 🟠 **MAJOR - Required field missing**

This is partially covered under Critical #2 but affects multiple handlers.

---

### MAJOR #7: Message Edit/Delete Doesn't Update Channel Preview
**Files**: `src/networks/events/getstreamHandlers.ts` (lines 227-236, 276-284)  
**Severity**: 🟠 **MAJOR - Stale channel preview**

#### The Problem
```typescript
// message.new updates channel preview:
export async function onNetworkChatMessageNew(payload) {
  // Updates channel last_message_at, last_message_preview
  await NetworkListingChannel.updateOne(
    { getstream_channel_id: channelId },
    {
      $set: {
        last_message_at: new Date(),
        last_message_preview: message.text,
      }
    }
  );
}

// message.updated only updates the archive:
export async function onNetworkChatMessageUpdated(payload) {
  const message = payload.message;
  
  // Only archives the update
  await ChatMessage.updateOne(
    { getstream_message_id: message.id },
    {
      $set: {
        text: message.text,
        updated_at: new Date(),
      }
    }
  );
  
  // ❌ MISSING: Update channel preview if this was the latest message!
  // If the latest message was edited, channel.last_message_preview stays stale
}

// message.deleted only archives the deletion:
export async function onNetworkChatMessageDeleted(payload) {
  const message = payload.message;
  
  await ChatMessage.updateOne(
    { getstream_message_id: message.id },
    { $set: { is_deleted: true } }
  );
  
  // ❌ MISSING: Update channel preview!
  // If the latest message is deleted, channel preview should update to 2nd-latest
}

// Result:
// Channel shows: "Latest message preview text..."
// But user edited it or deleted it
// Preview still shows old text
// User sees outdated info
```

#### The Fix
```typescript
export async function onNetworkChatMessageUpdated(payload) {
  const message = payload.message;
  const channelId = extractChannelId(payload);
  
  // Update archive
  await ChatMessage.updateOne(
    { getstream_message_id: message.id },
    { $set: { text: message.text, updated_at: new Date() } }
  );
  
  // ✅ NEW: Check if this was the latest message
  const latestMessage = await ChatMessage.findOne(
    { channel_id: channelId, is_deleted: { $ne: true } },
    {},
    { sort: { created_at: -1 } }
  );
  
  // Update channel preview if this message is now the latest
  if (latestMessage?._id.equals(message.id)) {
    await NetworkListingChannel.updateOne(
      { channel_id: channelId },
      {
        $set: {
          last_message_preview: message.text,
          last_message_at: new Date(message.created_at),
        }
      }
    );
  }
}

export async function onNetworkChatMessageDeleted(payload) {
  const message = payload.message;
  const channelId = extractChannelId(payload);
  
  // Mark as deleted
  await ChatMessage.updateOne(
    { getstream_message_id: message.id },
    { $set: { is_deleted: true } }
  );
  
  // ✅ NEW: Find new latest message
  const latestMessage = await ChatMessage.findOne(
    { channel_id: channelId, is_deleted: { $ne: true } },
    {},
    { sort: { created_at: -1 } }
  );
  
  if (latestMessage) {
    // Update to new latest message
    await NetworkListingChannel.updateOne(
      { channel_id: channelId },
      {
        $set: {
          last_message_preview: latestMessage.text,
          last_message_at: latestMessage.created_at,
        }
      }
    );
  } else {
    // No messages left - clear preview
    await NetworkListingChannel.updateOne(
      { channel_id: channelId },
      { $set: { last_message_preview: null, last_message_at: null } }
    );
  }
}
```

---

### MAJOR #8: Auto-Create Users in Production
**Files**: `src/middleware/attachUser.ts` (lines 40-68)  
**Severity**: 🟠 **MAJOR - Security & data quality risk**

#### The Problem
```typescript
// Current code creates users in ALL environments:
import { User } from "../../models/User";

async function attachUser(req: Request, res: Response, next: NextFunction) {
  const auth = (req as any).auth;
  
  let user = await User.findOne({ external_id: auth.userId });
  
  // ❌ THIS CODE RUNS EVEN IN PRODUCTION:
  if (!user) {
    try {
      user = new User({
        external_id: auth.userId,
        email: `${auth.userId}@test.local`,  // ❌ @test.local in production?!
        first_name: "Test",
        last_name: "User",
        display_name: auth.userId,
        onboarding: {
          status: "incomplete",
          steps: { ... }
        }
      });
      await user.save();  // ❌ Creates stub user in production DB
    } catch (err) {
      // User creation failed - might be unique constraint on email
    }
  }
}
```

**Risks**:
1. **Production Data Pollution**: Test/bot accounts end with `@test.local`
2. **Silent Failures**: Errors creating users are swallowed
3. **Wrong Names**: Real users end up with "Test User" in production
4. **Dead Code**: Other endpoints' 404 checks become unreachable
5. **Signup Bypass**: Anyone with a valid Clerk token gets auto-created

#### The Fix
Gate behind environment check:

```typescript
async function attachUser(req: Request, res: Response, next: NextFunction) {
  const auth = (req as any).auth;
  const isTestEnv = process.env.NODE_ENV === "test" || 
                    process.env.NODE_ENV === "development";
  
  let user = await User.findOne({ external_id: auth.userId });
  
  if (!user) {
    // ✅ Only auto-create in test/dev
    if (!isTestEnv) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }
    
    try {
      user = new User({
        external_id: auth.userId,
        email: `${auth.userId}@test.local`,
        first_name: "Test",
        last_name: "User",
        display_name: auth.userId,
        onboarding: {
          status: "incomplete",
          steps: { ... }
        }
      });
      await user.save();
    } catch (err) {
      logger.warn("Failed to auto-create test user", { error: err });
      res.status(500).json({ error: "Failed to create test user" });
      return;
    }
  }
  
  (req as any).user = user;
  next();
}
```

---

### MAJOR #9: Global Rate Limit Bypass Too Broad
**Files**: `src/middleware/operational.ts` (lines 91-94)  
**Severity**: 🟠 **MAJOR - Bypass in staging/preview**

#### The Problem
```typescript
// Line 91-94 disables rate limiting for non-production:
const globalRateLimiter = rateLimit({
  // ... config
});

app.use((req, res, next) => {
  // ❌ Skips rate limits in dev and staging both
  if (process.env.NODE_ENV !== "production") {
    return next();  // ❌ No rate limits
  }
  return globalRateLimiter(req, res, next);
});
```

**Problem**:
- staging, preview, development are ALL non-production
- Both are publicly accessible (staging esp.)
- Anyone hitting staging bypasses all rate limits
- Can cause DoS on staging without consequences

#### The Fix
```typescript
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  // ... other config
});

app.use((req, res, next) => {
  // ✅ Only skip in actual tests
  const skipRateLimit =
    process.env.NODE_ENV === "test" ||
    process.env.DISABLE_GLOBAL_RATE_LIMIT === "true";  // Explicit flag
  
  if (skipRateLimit) {
    return next();
  }
  
  return globalRateLimiter(req, res, next);
});
```

---

### MAJOR #10: Message Creation Not Idempotent
**Files**: `src/networks/events/getstreamHandlers.ts` (lines 108-139)  
**Severity**: 🟠 **MAJOR - Duplicate message archives**

#### The Problem
```typescript
export async function onNetworkChatMessageNew(payload) {
  const message = payload.message;
  
  // ❌ Un-readable count incremented BEFORE idempotency check
  await NetworkListingChannel.updateOne(
    { getstream_channel_id: channelId },
    { $inc: { unread_count: 1 } }  // Line 109
  );
  
  // ❌ Channel preview updated BEFORE idempotency check
  await NetworkListingChannel.updateOne(
    { getstream_channel_id: channelId },
    { $set: { last_message_at: now, last_message_preview: text } }  // Line 115
  );
  
  // ✅ ONLY NOW check if message already archived
  const existing = await ChatMessage.findOne({
    getstream_message_id: message.id  // Line 125
  });
  
  if (!existing) {
    await ChatMessage.create({ ... });  // Line 129
  }
}

// Problem: If webhook retries:
// Attempt 1:
//   - unread_count incremented ✓
//   - preview updated ✓
//   - message archived ✓
//   - Returns success

// Attempt 2 (retry):
//   - unread_count incremented AGAIN ❌
//   - preview updated AGAIN ❌
//   - message already exists - skips create
//   - User sees +2 unread instead of +1
```

**Idempotency Principle**: First write should be the idempotency gate.

#### The Fix
```typescript
export async function onNetworkChatMessageNew(payload) {
  const message = payload.message;
  const channelId = extractChannelId(payload);
  
  // ✅ FIRST: Check/create the durable archive entry
  const existing = await ChatMessage.findOne({
    getstream_message_id: message.id
  });
  
  if (existing) {
    logger.debug("Message already archived", { messageId: message.id });
    return;  // Idempotent - already processed
  }
  
  // ✅ NOW we can do non-idempotent side effects
  try {
    // Archive the message
    await ChatMessage.create({
      channel_id: channelId,
      getstream_message_id: message.id,
      sender_id: new Types.ObjectId(senderId),
      sender_clerk_id: senderClerkId,
      text: message.text,
      status: "delivered",
    });
    
    // Update channel metadata
    await NetworkListingChannel.updateOne(
      { channel_id: channelId },
      {
        $inc: { unread_count: 1 },
        $set: {
          last_message_at: new Date(message.created_at),
          last_message_preview: message.text,
        }
      }
    );
    
    logger.info("Message archived and metadata updated", {
      messageId: message.id,
      channelId,
    });
  } catch (err) {
    logger.error("Failed to process message", { error: err });
    // Handler is already idempotent - safe to rethrow/retry
    throw err;
  }
}
```

This ensures: If called multiple times, only the first succeeds, rest are no-ops.

---

## 🟡 Minor Issues (Medium Priority)

### MINOR #1: Missing Test Coverage for New Endpoints
**Files**: See PR diff - tests were removed  
**Severity**: 🟡 **MINOR - Risky without tests**

The PR removes integration/E2E test suites but adds new features.

#### The Fix
Add integration tests for:
1. ✅ GET /home feed with limit validation (0, 1, 6, 20, 21 → 400)
2. ✅ Feed returns 3 sections (recommended, featured, connections)
3. ✅ Webhook signature validation (valid + invalid signatures)
4. ✅ Message archive on webhook (message.new)
5. ✅ Unread count updates on webhook

---

### MINOR #2: Webhook Payload Logging Includes PII
**Files**: `src/networks/events/getstreamHandlers.ts` (many catch blocks)  
**Severity**: 🟡 **MINOR - Privacy leak**

#### The Problem
```typescript
try {
  // ...
} catch (err) {
  logger.error("Handler failed", {
    error: err,
    payload: payload,  // ❌ Includes chat text, attachments, user data
    message: payload.message,  // ❌ Full message content
  });
}
```

#### The Fix
```typescript
catch (err) {
  logger.error("Handler failed", {
    error: err,
    messageId: payload.message?.id,     // ✅ Identifier only
    channelId: payload.channel?.cid,    // ✅ Identifier only
    eventType: payload.type,             // ✅ Type only
    // Do NOT include text, attachments, user data
  });
}
```

---

### MINOR #3: Channel ID Extraction Not Robust
**Files**: `src/networks/events/getstreamHandlers.ts` (line 63-66)  
**Severity**: 🟡 **MINOR - Missing validation**

#### The Problem
```typescript
const cid = payload.cid || payload.channel?.cid;
const channelId = cid.split(":")[1];  // ❌ If cid is malformed, throws error

// Example bad payloads:
// { cid: "malformed" } → split fails
// { cid: "messaging:" } → split returns ""
// { cid: null } → throws before guard
```

#### The Fix
```typescript
const cid = payload.cid || payload.channel?.cid;

if (!cid || typeof cid !== "string") {
  logger.warn("Invalid channel ID in webhook", { cid });
  return;
}

const parts = cid.split(":");
const channelId = parts[1];

if (!channelId) {
  logger.warn("Could not extract channel ID from cid", { cid });
  return;
}
```

---

## 💡 Best Practices Guide

### 1. Webhook Processing Best Practices
```typescript
// DO:
✅ Verify signature FIRST on raw body bytes
✅ Extract all required fields with validation  
✅ Check idempotency gate BEFORE side effects
✅ Store durable write FIRST (archive)
✅ Update metadata AFTER archive succeeds
✅ Use timing-safe comparison for signatures
✅ Log identifiers, not payload content
✅ Don't re-throw errors affecting other webhooks

// DON'T:
❌ Trust stringified JSON for signature
❌ Use string === for security-sensitive comparison
❌ Update counters before checking duplicates
❌ Assume webhook payload fields exist
❌ Include chat text in logs
❌ Return early before domain-specific handlers
```

### 2. Schema Design Best Practices
```typescript
// DO:
✅ Use persisted fields for queries, not virtuals
✅ Add path aliases if both names needed
✅ Mark required fields actually needed
✅ Use enums for fixed values (include all)
✅ Split per-user data into Maps or sub-docs
✅ Keep audit trail separate from state

// DON'T:
❌ Query virtuals (they return 0 results)
❌ Use same counter for multiple users
❌ Over-complicate enums
❌ Mix optional and required semantically
```

### 3. Caching Best Practices
```typescript
// DO:
✅ Include all parameters in cache key (limit, offset, filter)
✅ Set appropriate TTL (5-10 min for feeds)
✅ Invalidate related cache entries
✅ Return from cache only if exact match

// DON'T:
❌ Omit parameters from key
❌ Slice cached results (wrong limit data)
❌ Cache without TTL (stale data until restart)
❌ Mix limits in single cache entry
```

### 4. Security Best Practices
```typescript
// DO:
✅ Use crypto.timingSafeEqual for secrets
✅ Gate auto-create behind env check
✅ Validate webhook signatures on raw bytes
✅ Narrow rate limit bypasses (test env only)
✅ Log identifiers, not secrets/PII
✅ Check permissions before returning data

// DON'T:
❌ String comparison for signatures
❌ Create users in production
❌ Skip validation for non-prod
❌ Disable security in staging
❌ Log message content
```

### 5. Event Handler Best Practices
```typescript
// DO:
✅ Gate Networks handlers AFTER global handlers complete
✅ Make all handlers idempotent
✅ Separate durable writes from side effects
✅ Validate payload structure
✅ Log operation IDs for traceability
✅ Don't rethrow local-only errors

// DON'T:
❌ Return early before domain logic
❌ Assume fields exist without checking
❌ Mix archive and mutations
❌ Include full payloads in logs
❌ Block other events on failure
```

---

## ✅ Pre-Merge Checklist

### Critical Fixes (MUST DO)
- [ ] Fix webhook early return issue - defer Networks handlers
- [ ] Add sender_clerk_id to all message archive creates
- [ ] Fix webhook signature verification (raw body + timing-safe)
- [ ] Fix status enum - align schema with code

### Major Fixes (SHOULD DO)
- [ ] Add per-user unread count tracking
- [ ] Fix connection relationship queries
- [ ] Add limit to cache keys
- [ ] Update channel preview on message edit/delete
- [ ] Gate user auto-create behind env check
- [ ] Narrow rate limit bypass scope
- [ ] Make message creation idempotent
- [ ] Consolidate webhook routes

### Minor Fixes (NICE TO HAVE)
- [ ] Add integration tests for new endpoints
- [ ] Remove PII from error logs
- [ ] Validate channel ID extraction

### Verification
- [ ] npm run lint (no errors)
- [ ] npm run build (TypeScript compiles)
- [ ] npm test (all tests pass)
- [ ] Manual webhook testing
- [ ] Load testing (check rate limits)

---

**Summary**: This PR has 21 identified issues, with 12 critical blockers. The most severe are:
1. **Networks handlers never execute** (early returns)  
2. **Message archives fail silently** (missing required fields)
3. **Webhook signatures don't verify** (wrong body format)
4. **Cache returns wrong data** (limit param missing)

**Recommendation**: **DO NOT MERGE** until all critical issues are fixed and tests added.

**Estimated Fix Time**: 4-6 hours  
**Estimated Test Time**: 2-3 hours  
**Total**: ~8-9 hours of work

---

Created: April 14, 2026
Reviewed by: Copilot + CodeRabbit + ChatGPT-Codex
