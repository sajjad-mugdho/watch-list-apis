#!/bin/bash

# Configuration
API_URL="http://localhost:5050/api/v1"
TEST_USER="buyer_us_complete"
NETWORKS_USER="user_with_networks"

echo "🔍 Starting Edge Case Verification..."
echo "======================================"

# 1. Test Favorites Type Validation
echo -e "\n1. Testing Favorites Type Validation (Should fail for 'watch')"
curl -s -X POST "$API_URL/user/favorites" \
  -H "x-test-user: $TEST_USER" \
  -H "Content-Type: application/json" \
  -d '{"item_type": "watch", "item_id": "123", "platform": "marketplace"}' | grep -q "Invalid enum value" && echo "✅ PASSED: Rejected invalid type 'watch'" || echo "❌ FAILED: Accepted invalid type 'watch'"

# 2. Test WTB on Marketplace Validation
echo -e "\n2. Testing WTB on Marketplace Validation (Should fail)"
curl -s -X POST "$API_URL/user/favorites" \
  -H "x-test-user: $TEST_USER" \
  -H "Content-Type: application/json" \
  -d '{"item_type": "wtb", "item_id": "123", "platform": "marketplace"}' | grep -q "Networks platform" && echo "✅ PASSED: Rejected WTB on Marketplace" || echo "❌ FAILED: Accepted WTB on Marketplace"

# 3. Test Search Platform Requirement
echo -e "\n3. Testing Search Platform Requirement (Should fail without platform)"
curl -s -X POST "$API_URL/user/searches/recent" \
  -H "x-test-user: $TEST_USER" \
  -H "Content-Type: application/json" \
  -d '{"query": "rolex"}' | grep -q "Required" && echo "✅ PASSED: Rejected search without platform" || echo "❌ FAILED: Accepted search without platform"

# 4. Test User Token Endpoints
echo -e "\n4. Testing User Token Endpoints"
CHAT_TOKEN=$(curl -s -X GET "$API_URL/user/tokens/chat" -H "x-test-user: $TEST_USER" | jq -r '.data.token')
if [ "$CHAT_TOKEN" != "null" ] && [ -n "$CHAT_TOKEN" ]; then
  echo "✅ PASSED: Received Chat Token"
else
  echo "❌ FAILED: Failed to get Chat Token"
fi

FEED_TOKEN=$(curl -s -X GET "$API_URL/user/tokens/feed" -H "x-test-user: $NETWORKS_USER" -H "x-platform: networks" | jq -r '.data.token')
if [ "$FEED_TOKEN" != "null" ] && [ -n "$FEED_TOKEN" ]; then
  echo "✅ PASSED: Received Feed Token"
else
  echo "❌ FAILED: Failed to get Feed Token"
fi

# 5. Test Feed Token Platform Check
echo -e "\n5. Testing Feed Token Platform Check (Should fail without networks header)"
curl -s -X GET "$API_URL/user/tokens/feed" \
  -H "x-test-user: $TEST_USER" \
  -H "x-platform: marketplace" | grep -q "Networks platform" && echo "✅ PASSED: Rejected Feed token request on marketplace" || echo "❌ FAILED: Accepted Feed token request on marketplace"

# 6. Test ISO Networks-Only Middleware
echo -e "\n6. Testing ISO Networks-Only Middleware"
curl -s -X GET "$API_URL/isos" \
  -H "x-test-user: $TEST_USER" \
  -H "x-platform: marketplace" | grep -q "Networks platform" && echo "✅ PASSED: Rejected ISO request on marketplace" || echo "❌ FAILED: Accepted ISO request on marketplace"

echo -e "\n======================================"
echo "Verification Complete!"
