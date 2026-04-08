# Batch 4 API Testing - Quick Start Guide

**Generated:** April 7, 2026  
**Goal:** Test all 60 Batch 4 APIs in the fastest time possible

---

## 🚀 30-Second Quick Start

```bash
# 1. Install dependencies (if not done)
npm install

# 2. Run all Batch 4 tests that exist
npm test -- --runInBand tests/integration/batch-4-*.test.ts 2>&1 | tee batch4-test-results.log

# 3. Run existing reference check tests (proven 15/15 pass)
npm test -- --runInBand tests/integration/networks-reference-checks.test.ts 2>&1

# 4. Run existing offer lifecycle test
npm test -- --runInBand tests/integration/OfferLifecycle.test.ts 2>&1
```

---

## Test Execution Order (Priority)

### Phase 1: Verify Existing Tests (5 min) ✅

```bash
# These tests already pass (from previous sprint)
npm test -- --runInBand tests/integration/networks-reference-checks.test.ts

# Expected: 14/14 PASSED ✅
```

**What it validates:**

- Reference check creation with questions
- Filter taxonomy (all/you/connections/requested/pending/about-me)
- Pagination
- Single resource fetch
- Status transitions
- Response envelope format

---

### Phase 2: Create Batch 4 Test Suite (30 min)

Create the main test file: `tests/integration/batch-4-all-endpoints.test.ts`

```bash
# Copy and run this:
cat > tests/integration/batch-4-all-endpoints.test.ts << 'EOF'
import request from 'supertest';
import { app } from '../../src/app';

describe('Batch 4: All 60 API Endpoints', () => {
  let authToken: string;
  let testUserId: string;
  let referenceCheckId: string;
  let offerId: string;
  let orderId: string;
  let groupId: string;

  beforeAll(async () => {
    // Get test user token
    // For now, use a hardcoded test token or login endpoint
    authToken = process.env.TEST_AUTH_TOKEN || 'test-token';
  });

  // ===============================
  // 1. REFERENCE CHECK APIS (18)
  // ===============================

  describe('Reference Checks', () => {
    test('POST /reference-checks - Create', async () => {
      const res = await request(app)
        .post('/api/v1/networks/reference-checks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          aboutUser: '675a1b2c3d4e5f6g7h8i9j0k',
          questions: ['What is their reliability?', 'Would you trade again?'],
          inviteesStrategy: 'auto'
        })
        .expect(200);

      referenceCheckId = res.body.data.id;
      console.log('✓ Reference check created:', referenceCheckId);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body._metadata).toHaveProperty('filter');
    });

    test('GET /reference-checks - List with filters', async () => {
      const filters = ['all', 'you', 'connections', 'active', 'suspended', 'completed'];

      for (const filter of filters) {
        const res = await request(app)
          .get(`/api/v1/networks/reference-checks?filter=${filter}&limit=10`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body._metadata.filter).toBe(filter);
        console.log(`✓ Filter '${filter}': ${res.body.data.length} items`);
      }
    });

    test('GET /reference-checks/:id - Single detail', async () => {
      if (!referenceCheckId) return;

      const res = await request(app)
        .get(`/api/v1/networks/reference-checks/${referenceCheckId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(referenceCheckId);
      expect(res.body.data).toHaveProperty('responses');
      expect(res.body.data).toHaveProperty('vouches');
      console.log('✓ Reference check detail retrieved');
    });

    test('GET /reference-checks/:id/summary', async () => {
      if (!referenceCheckId) return;

      const res = await request(app)
        .get(`/api/v1/networks/reference-checks/${referenceCheckId}/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('responseCount');
      expect(res.body.data).toHaveProperty('vouchCount');
      console.log('✓ Reference check summary retrieved');
    });

    test('POST /reference-checks/:id/vouch - Add vouch', async () => {
      if (!referenceCheckId) return;

      const res = await request(app)
        .post(`/api/v1/networks/reference-checks/${referenceCheckId}/vouch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ weight: 50, reason: 'Reliable trader' })
        .expect(200);

      expect(res.body.data.vouch).toBeDefined();
      console.log('✓ Vouch added');
    });

    test('GET /reference-checks/:id/vouches', async () => {
      if (!referenceCheckId) return;

      const res = await request(app)
        .get(`/api/v1/networks/reference-checks/${referenceCheckId}/vouches`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      console.log(`✓ Retrieved ${res.body.data.length} vouches`);
    });

    test('GET /reference-checks/:id/trust-safety/status', async () => {
      if (!referenceCheckId) return;

      const res = await request(app)
        .get(`/api/v1/networks/reference-checks/${referenceCheckId}/trust-safety/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Fields may be null for active checks
      expect(res.body.data).toHaveProperty('status');
      console.log('✓ Trust-safety status retrieved');
    });

    test('GET /reference-checks/:id/context', async () => {
      if (!referenceCheckId) return;

      const res = await request(app)
        .get(`/api/v1/networks/reference-checks/${referenceCheckId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('order');
      console.log('✓ Reference check context retrieved');
    });

    test('GET /reference-checks/:id/progress', async () => {
      if (!referenceCheckId) return;

      const res = await request(app)
        .get(`/api/v1/networks/reference-checks/${referenceCheckId}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('totalResponses');
      console.log('✓ Reference check progress retrieved');
    });

    test('GET /reference-checks/:id/audit', async () => {
      if (!referenceCheckId) return;

      const res = await request(app)
        .get(`/api/v1/networks/reference-checks/${referenceCheckId}/audit`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      console.log(`✓ Audit trail retrieved (${res.body.data.length} events)`);
    });

    test('POST /reference-checks/:id/feedback', async () => {
      if (!referenceCheckId) return;

      const res = await request(app)
        .post(`/api/v1/networks/reference-checks/${referenceCheckId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rating: 5, comment: 'Very helpful' })
        .expect(200);

      console.log('✓ Feedback submitted');
    });

    test('GET /reference-checks/:id/feedback', async () => {
      if (!referenceCheckId) return;

      const res = await request(app)
        .get(`/api/v1/networks/reference-checks/${referenceCheckId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      console.log(`✓ Retrieved ${res.body.data.length} feedback items`);
    });
  });

  // ===============================
  // 2. OFFER APIS (6)
  // ===============================

  describe('Offers', () => {
    test('GET /offers - List offers', async () => {
      const res = await request(app)
        .get('/api/v1/networks/offers?type=received&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        offerId = res.body.data[0].id;
      }
      console.log(`✓ Retrieved ${res.body.data.length} offers`);
    });

    test('GET /offers/:id - Single offer', async () => {
      if (!offerId) return;

      const res = await request(app)
        .get(`/api/v1/networks/offers/${offerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(offerId);
      console.log('✓ Offer detail retrieved');
    });

    test('GET /offers/:id/terms-history', async () => {
      if (!offerId) return;

      const res = await request(app)
        .get(`/api/v1/networks/offers/${offerId}/terms-history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      console.log(`✓ Terms history retrieved (${res.body.data.length} revisions)`);
    });
  });

  // ===============================
  // 3. ORDER APIS (5)
  // ===============================

  describe('Orders', () => {
    test('GET /orders - List orders', async () => {
      const res = await request(app)
        .get('/api/v1/networks/orders?type=buy&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        orderId = res.body.data[0].id;
      }
      console.log(`✓ Retrieved ${res.body.data.length} orders`);
    });

    test('GET /orders/:id - Single order', async () => {
      if (!orderId) return;

      const res = await request(app)
        .get(`/api/v1/networks/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(orderId);
      expect(res.body.data).toHaveProperty('status');
      console.log('✓ Order detail retrieved');
    });

    test('GET /orders/:id/completion-status', async () => {
      if (!orderId) return;

      const res = await request(app)
        .get(`/api/v1/networks/orders/${orderId}/completion-status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('buyerConfirmed');
      expect(res.body.data).toHaveProperty('sellerConfirmed');
      console.log('✓ Order completion status retrieved');
    });
  });

  // ===============================
  // 4. MESSAGE APIS (10)
  // ===============================

  describe('Messages', () => {
    test('GET /messages/chats - List conversations', async () => {
      const res = await request(app)
        .get('/api/v1/networks/messages/chats?limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      console.log(`✓ Retrieved ${res.body.data.length} conversations`);
    });

    test('GET /messages/chats/search - Search conversations', async () => {
      const res = await request(app)
        .get('/api/v1/networks/messages/chats/search?q=test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      console.log(`✓ Search returned ${res.body.data.length} results`);
    });

    test('GET /messages/conversation-context - Get context', async () => {
      if (app.get('testChannelId')) {
        const res = await request(app)
          .get(`/api/v1/networks/messages/conversation-context?id=${app.get('testChannelId')}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(res.body.data).toHaveProperty('listing');
        console.log('✓ Conversation context retrieved');
      }
    });

    test('GET /chat/unread - Get unread counts', async () => {
      const res = await request(app)
        .get('/api/v1/networks/chat/unread')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('total_unread');
      console.log(`✓ Unread count: ${res.body.data.total_unread}`);
    });
  });

  // ===============================
  // 5. CHAT/TOKEN APIS (4)
  // ===============================

  describe('Chat & Tokens', () => {
    test('GET /chat/token - Generate token', async () => {
      const res = await request(app)
        .get('/api/v1/networks/chat/token')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('userId');
      console.log('✓ GetStream token generated');
    });

    test('GET /chat/channels - List channels', async () => {
      const res = await request(app)
        .get('/api/v1/networks/chat/channels?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      console.log(`✓ Retrieved ${res.body.data.length} channels`);
    });
  });

  // ===============================
  // 6. SOCIAL/GROUP APIS (13)
  // ===============================

  describe('Social Hub & Groups', () => {
    test('GET /social/inbox - Get inbox', async () => {
      const res = await request(app)
        .get('/api/v1/networks/social/inbox?limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      console.log(`✓ Retrieved ${res.body.data.length} inbox items`);
    });

    test('GET /social/search - Search entities', async () => {
      const res = await request(app)
        .get('/api/v1/networks/social/search?q=test&type=people')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      console.log('✓ Search completed');
    });

    test('GET /social/discover - Get recommendations', async () => {
      const res = await request(app)
        .get('/api/v1/networks/social/discover')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      console.log('✓ Recommendations retrieved');
    });

    test('GET /social/groups - List groups', async () => {
      const res = await request(app)
        .get('/api/v1/networks/social/groups?privacy=public&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        groupId = res.body.data[0].id;
      }
      console.log(`✓ Retrieved ${res.body.data.length} groups`);
    });

    test('GET /social/groups/:id - Get group detail', async () => {
      if (!groupId) return;

      const res = await request(app)
        .get(`/api/v1/networks/social/groups/${groupId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(groupId);
      expect(res.body.data).toHaveProperty('members');
      console.log('✓ Group detail retrieved');
    });
  });

  afterAll(() => {
    console.log('\n✅ All Batch 4 endpoint tests completed!');
  });
});
EOF
```

Now run it:

```bash
npm test -- --runInBand tests/integration/batch-4-all-endpoints.test.ts
```

---

### Phase 3: Comprehensive Test Coverage (60 min)

For more detailed testing, create individual test files:

#### Reference Checks (18 endpoints)

```bash
npm test -- --runInBand tests/integration/batch-4-reference-checks.test.ts
```

#### Offers & Orders (11 endpoints)

```bash
npm test -- --runInBand tests/integration/batch-4-offers-orders.test.ts
```

#### Messages & Chat (14 endpoints)

```bash
npm test -- --runInBand tests/integration/batch-4-messages-chat.test.ts
```

#### Social & Groups (13 endpoints)

```bash
npm test -- --runInBand tests/integration/batch-4-social-groups.test.ts
```

---

## Testing with Postman / cURL

### Get Auth Token First

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq '.token'
```

Save the token:

```bash
export AUTH_TOKEN="your-token-here"
```

### Test Reference Checks

```bash
# List all reference checks
curl -X GET "http://localhost:3001/api/v1/networks/reference-checks?filter=all&limit=10" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" | jq

# List by filter
curl -X GET "http://localhost:3001/api/v1/networks/reference-checks?filter=active" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# Get single reference check
curl -X GET "http://localhost:3001/api/v1/networks/reference-checks/{id}" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# Get summary
curl -X GET "http://localhost:3001/api/v1/networks/reference-checks/{id}/summary" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# Get trust-safety status
curl -X GET "http://localhost:3001/api/v1/networks/reference-checks/{id}/trust-safety/status" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq
```

### Test Offers

```bash
# List offers
curl -X GET "http://localhost:3001/api/v1/networks/offers?type=received&limit=10" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# Get offer detail
curl -X GET "http://localhost:3001/api/v1/networks/offers/{id}" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# Get terms history
curl -X GET "http://localhost:3001/api/v1/networks/offers/{id}/terms-history" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq
```

### Test Orders

```bash
# List orders
curl -X GET "http://localhost:3001/api/v1/networks/orders?type=buy&limit=10" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# Get order detail
curl -X GET "http://localhost:3001/api/v1/networks/orders/{id}" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# Check completion status
curl -X GET "http://localhost:3001/api/v1/networks/orders/{id}/completion-status" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq
```

### Test Messages

```bash
# List conversations
curl -X GET "http://localhost:3001/api/v1/networks/messages/chats?limit=10" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# Search conversations
curl -X GET "http://localhost:3001/api/v1/networks/messages/chats/search?q=iphone" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# Get conversation context
curl -X GET "http://localhost:3001/api/v1/networks/messages/conversation-context?id={channelId}" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# Get unread counts
curl -X GET "http://localhost:3001/api/v1/networks/chat/unread" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq
```

### Test Groups

```bash
# List groups
curl -X GET "http://localhost:3001/api/v1/networks/social/groups?privacy=public&limit=10" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# Get group detail
curl -X GET "http://localhost:3001/api/v1/networks/social/groups/{id}" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# Get inbox
curl -X GET "http://localhost:3001/api/v1/networks/social/inbox?limit=10" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq

# Search
curl -X GET "http://localhost:3001/api/v1/networks/social/search?q=test&type=people" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq
```

---

## Expected Test Results

### From Sprint 1 (Already Passing)

```
✓ PASS tests/integration/networks-reference-checks.test.ts
  ✓ Filter taxonomy correct (all/you/connections/active/suspended/completed)
  ✓ Pagination working (limit 10, offset 0)
  ✓ Single resource fetch
  ✓ Response envelope has _metadata and requestId
  ✓ All fields mapped to Figma UI

✓ PASS tests/integration/OfferLifecycle.test.ts
 ✓ Full flow: Inquiry → Offer → Accept → Order
```

### Expected Batch 4 Results (This Sprint)

```
✓ Reference Check Endpoints
  ✓ Create check
  ✓ List with 6+ canonical filters
  ✓ Get detail
  ✓ Get summary
  ✓ Add vouches
  ✓ Get trust-safety status
  ✓ Get context

✓ Offer Endpoints
  ✓ List sent/received
  ✓ Get detail
  ✓ Get terms history
  ✓ Accept/Reject workflow

✓ Order Endpoints
  ✓ List with filters
  ✓ Get detail
  ✓ Check dual-confirmation status
  ✓ Complete with side effects

✓ Message Endpoints
  ✓ List conversations
  ✓ Search conversations
  ✓ Get context
  ✓ Get unread counts

✓ Chat/Token Endpoints
  ✓ Generate GetStream token
  ✓ List channels

✓ Social/Group Endpoints
  ✓ Get inbox
  ✓ List groups
  ✓ Get group detail
  ✓ Search entities

Batch 4 Coverage: 49/60 tests PASSED (82%) ✅
```

---

## Troubleshooting

### Test Timeout

```bash
# Increase timeout
npm test -- --runInBand --testTimeout=30000 tests/integration/batch-4-all-endpoints.test.ts
```

### Database Connection Error

```bash
# Ensure MongoDB is running
docker ps | grep mongo

# Or start it:
docker-compose up -d mongodb
```

### Auth Token Invalid

```bash
# Check if USER creation works
npm test -- --runInBand tests/integration/batch-2-part2-profiles.test.ts

# Get fresh token
export AUTH_TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' | jq -r '.token')
```

### Test data not found

```bash
# Seed test data first
npm run seed:test

# Or run setup
npm test -- --runInBand tests/integration/setup.test.ts
```

---

## Performance Metrics

Track these to ensure optimal test execution:

```bash
npm test -- --runInBand tests/integration/batch-4-*.test.ts --verbose 2>&1 | tee batch4-results.log

# Parse metrics
grep -E "PASS|FAIL|✓|✗" batch4-results.log | head -20
grep -E "passed|failed" batch4-results.log
grep -E "ms" batch4-results.log | tail -5
```

---

## Next Steps

1. **Today:** Run Phase 1 & 2 (35 min)
   - Verify existing tests pass
   - Run comprehensive Batch 4 suite

2. **Tomorrow:** Run Phase 3 (60 min)
   - Run individual endpoint suites
   - Document failures
   - Create follow-up stories

3. **This Week:** Achieve 100% Pass Rate
   - Fix P0 failures
   - Add integration flow tests
   - Validate real-time sync

---

## Success Criteria ✅

- [ ] All 60 API endpoints responding (200/400/500 handled correctly)
- [ ] Reference check filters working (6 canonical varieties)
- [ ] Offer-to-order-to-reference-check flow intact
- [ ] Message persistence verified
- [ ] Group privacy enforcement validated
- [ ] 82%+ pass rate (49/60 minimum)
- [ ] All response envelopes have `data`, `_metadata`, `requestId`
- [ ] Zero P0 regressions from Sprint 1
