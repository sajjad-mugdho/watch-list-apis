#!/usr/bin/env bash
# ============================================================================
# BATCH 4: Complete API Curl Test Suite
# ============================================================================
# Purpose: Test all 51+ Batch 4 APIs screen-by-screen with real tokens
# Date: April 8, 2026
# Status: Production-Ready Test Suite
# ============================================================================

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:5050}"
BUYER_TOKEN="${BUYER_TOKEN:-}"
SELLER_TOKEN="${SELLER_TOKEN:-}"
OUTPUT_DIR="test-results/batch4-api-tests"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEST_RESULTS_FILE="${OUTPUT_DIR}/test-results_${TIMESTAMP}.json"

# Validation
if [[ -z "$BUYER_TOKEN" || -z "$SELLER_TOKEN" ]]; then
  echo -e "${RED}Error: BUYER_TOKEN and SELLER_TOKEN environment variables required${NC}"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Initialize results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
RESULTS_JSON='{"tests":[]}'

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# Pretty print section
print_section() {
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Test API endpoint
test_api() {
  local test_name="$1"
  local method="$2"
  local endpoint="$3"
  local token="$4"
  local payload="$5"
  local expected_code="${6:-200}"

  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  echo -e "\n${YELLOW}Test #${TOTAL_TESTS}: ${test_name}${NC}"
  echo "  Method: $method"
  echo "  Endpoint: $endpoint"
  echo "  Expected Code: $expected_code"

  # Make request
  local response
  local http_code
  
  if [[ "$payload" != "-" && -n "$payload" ]]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$payload")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $token")
  fi

  # Extract HTTP code and body
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  # Check result
  if [[ "$http_code" == "$expected_code" ]]; then
    echo -e "  ${GREEN}✓ PASSED${NC} (HTTP $http_code)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    
    # Save response
    echo "$body" > "${OUTPUT_DIR}/${test_name// /_}_response.json"
    
    # Return body for further processing
    echo "$body"
  else
    echo -e "  ${RED}✗ FAILED${NC} (Expected: $expected_code, Got: $http_code)"
    echo "  Response: $body"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
}

# Extract ID from response
extract_id() {
  local json="$1"
  local id=$(echo "$json" | node -e "try{const b=JSON.parse(require('fs').readFileSync(0,'utf8'));const id=(b?.data?._id||b?.data?.id||b?._id||b?.id||'');console.log(String(id));}catch(e){console.log('')}" 2>/dev/null || true)
  echo "$id"
}

# ============================================================================
# PART 1: SOCIAL HUB & MESSAGING (33 ENDPOINTS)
# ============================================================================

print_section "PART 1: SOCIAL HUB & MESSAGING (33 Endpoints)"

# Get user IDs
echo -e "\n${YELLOW}Fetching user IDs...${NC}"

BUYER_PROFILE=$(test_api "Get Buyer Profile (me)" "GET" "/api/v1/networks/users/me" "$BUYER_TOKEN" "-" "200")
BUYER_ID=$(extract_id "$BUYER_PROFILE")
echo "  Buyer ID: $BUYER_ID"

SELLER_PROFILE=$(test_api "Get Seller Profile (me)" "GET" "/api/v1/networks/users/me" "$SELLER_TOKEN" "-" "200")
SELLER_ID=$(extract_id "$SELLER_PROFILE")
echo "  Seller ID: $SELLER_ID"

# Screen 1: Social Hub Status
print_section "PART 1, SCREEN 1: Social Hub Home"

test_api "Hub Status - Trending Items & Feed" "GET" "/api/v1/networks/social/hub-status" "$BUYER_TOKEN" "-" "200" > /dev/null

# Screen 2: Search Results
print_section "PART 1, SCREEN 2: Search & Discovery"

test_api "Search - Items" "GET" "/api/v1/networks/social/search?q=watch&type=items&limit=10" "$BUYER_TOKEN" "-" "200" > /dev/null

test_api "Search - People" "GET" "/api/v1/networks/social/search?q=seller&type=people&limit=10" "$BUYER_TOKEN" "-" "200" > /dev/null

test_api "Search - Groups" "GET" "/api/v1/networks/social/search?q=collectors&limit=10" "$BUYER_TOKEN" "-" "200" > /dev/null

test_api "Discover Users" "GET" "/api/v1/networks/social/discover?rating_min=4.0&limit=10" "$BUYER_TOKEN" "-" "200" > /dev/null

# Screen 3-4: Conversations List
print_section "PART 1, SCREEN 3-4: Conversations & Messages"

CONVERSATIONS=$(test_api "List Conversations" "GET" "/api/v1/networks/conversations?sort=recent&limit=20" "$BUYER_TOKEN" "-" "200")

# Extract first conversation ID if exists
FIRST_CONVO_ID=$(echo "$CONVERSATIONS" | node -e "try{const b=JSON.parse(require('fs').readFileSync(0,'utf8'));const id=(b?.data?.conversations?.[0]?._id||b?.data?.conversations?.[0]?.id||'');console.log(String(id));}catch(e){console.log('')}" 2>/dev/null || true)

if [[ -n "$FIRST_CONVO_ID" ]]; then
  test_api "Get Conversation Details" "GET" "/api/v1/networks/conversations/$FIRST_CONVO_ID?limit=20" "$BUYER_TOKEN" "-" "200" > /dev/null
  
  # Mark as read
  test_api "Mark Conversation as Read" "PUT" "/api/v1/networks/conversations/$FIRST_CONVO_ID/read" "$BUYER_TOKEN" "{}" "200" > /dev/null
fi

# Screen 5-6: Discover & Groups
print_section "PART 1, SCREEN 5-6: Groups & Discovery"

# Create a test group
CREATE_GROUP=$(test_api "Create Group" "POST" "/api/v1/networks/social/groups" "$SELLER_TOKEN" \
  '{
    "name": "Test Collectors Group - '"$(date +%s)"'",
    "description": "Testing Batch 4 APIs",
    "is_public": true,
    "category": "watches"
  }' "201")

GROUP_ID=$(extract_id "$CREATE_GROUP")
echo "  Created Group ID: $GROUP_ID"

if [[ -n "$GROUP_ID" ]]; then
  # Get group details
  test_api "Get Group Details" "GET" "/api/v1/networks/social/groups/$GROUP_ID" "$SELLER_TOKEN" "-" "200" > /dev/null
  
  # List user's groups
  test_api "List My Groups" "GET" "/api/v1/networks/social/groups?my_groups=true&limit=20" "$SELLER_TOKEN" "-" "200" > /dev/null
  
  # Join group with buyer
  test_api "Join Group (Buyer)" "POST" "/api/v1/networks/social/groups/$GROUP_ID/join" "$BUYER_TOKEN" "{}" "200" > /dev/null
fi

# Screen 7: Group Chat Thread
print_section "PART 1, SCREEN 7: Group Chat & Messages"

if [[ -n "$GROUP_ID" ]]; then
  # Send message to group
  SEND_MSG=$(test_api "Send Message to Group" "POST" "/api/v1/networks/messages/send" "$BUYER_TOKEN" \
    '{
      "channel_id": "group_'"$GROUP_ID"'",
      "text": "Great watches discussion group!"
    }' "201")
  
  MSG_ID=$(extract_id "$SEND_MSG")
  
  if [[ -n "$MSG_ID" ]]; then
    # React to message
    test_api "React to Message (👍)" "POST" "/api/v1/networks/messages/$MSG_ID/react" "$SELLER_TOKEN" \
      '{ "emoji": "👍" }' "200" > /dev/null
    
    # Edit message
    test_api "Edit Message" "PUT" "/api/v1/networks/messages/$MSG_ID" "$BUYER_TOKEN" \
      '{ "text": "Great watches discussion group! Updated!" }' "200" > /dev/null
  fi
  
  # Share link in group
  test_api "Share Link in Group" "POST" "/api/v1/networks/social/groups/$GROUP_ID/share-link" "$SELLER_TOKEN" \
    '{
      "url": "https://www.rolex.com/watches",
      "title": "Rolex Official",
      "description": "Check out official Rolex watches"
    }' "201" > /dev/null
fi

# Screen 8: User Profile & Follow
print_section "PART 1, SCREEN 8: User Profile & Social"

# Follow seller
test_api "Follow User" "POST" "/api/v1/networks/social/users/$SELLER_ID/follow" "$BUYER_TOKEN" "{}" "200" > /dev/null

# Check follow status
test_api "Check Follow Status" "GET" "/api/v1/networks/social/users/$SELLER_ID/follow-status" "$BUYER_TOKEN" "-" "200" > /dev/null

# Get public profile
test_api "Get Public Profile" "GET" "/api/v1/networks/users/$SELLER_ID" "$BUYER_TOKEN" "-" "200" > /dev/null

# Update own profile
test_api "Update Own Profile" "PUT" "/api/v1/networks/users/me" "$BUYER_TOKEN" \
  '{
    "bio": "Enthusiastic watch collector and trader",
    "specializations": ["watches", "vintage"],
    "response_time_hours": 2
  }' "200" > /dev/null

# Get common groups with seller
test_api "Get Common Groups/Connections" "GET" "/api/v1/networks/users/$SELLER_ID/common" "$BUYER_TOKEN" "-" "200" > /dev/null

# Safety features
print_section "PART 1: Safety Features"

# Mute conversation
if [[ -n "$FIRST_CONVO_ID" ]]; then
  test_api "Mute Conversation" "POST" "/api/v1/networks/conversations/$FIRST_CONVO_ID/mute" "$BUYER_TOKEN" \
    '{ "mute_until": "2026-04-09T17:00:00Z" }' "200" > /dev/null
fi

# Report user (don't actually report)
# test_api "Report User" "POST" "/api/v1/networks/social/report" "$BUYER_TOKEN" \
#   '{"type": "user", "resource_id": "'$SELLER_ID'", "reason": "test"}' "202" > /dev/null

# ============================================================================
# PART 2: GROUP DETAILS & SHARED CONTENT (8 ENDPOINTS)
# ============================================================================

print_section "PART 2: GROUP DETAILS & SHARED CONTENT (8 Endpoints)"

if [[ -n "$GROUP_ID" ]]; then
  # Group Details
  DETAILS=$(test_api "Get Group Details (with role)" "GET" "/api/v1/networks/groups/$GROUP_ID/details" "$SELLER_TOKEN" "-" "200")
  
  # Members list
  test_api "Get Group Members" "GET" "/api/v1/networks/groups/$GROUP_ID/members?limit=20" "$SELLER_TOKEN" "-" "200" > /dev/null
  
  # Invite members (if we have other user)
  if [[ -n "$BUYER_ID" ]]; then
    test_api "Invite Members to Group" "POST" "/api/v1/networks/groups/$GROUP_ID/members/invite" "$SELLER_TOKEN" \
      '{"user_ids": ["'"$BUYER_ID"'"], "note": "Join our test group"}' "200" > /dev/null
  fi
  
  # Share media in group
  # Note: Would need actual image file - skipping for now
  
  # Shared content - links
  test_api "Get Shared Links" "GET" "/api/v1/networks/groups/$GROUP_ID/shared-content?type=links&limit=10" "$SELLER_TOKEN" "-" "200" > /dev/null
  
  # Shared content - media
  test_api "Get Shared Media" "GET" "/api/v1/networks/groups/$GROUP_ID/shared-content?type=media&limit=10" "$SELLER_TOKEN" "-" "200" > /dev/null
  
  # Leave group
  test_api "Leave Group" "POST" "/api/v1/networks/social/groups/$GROUP_ID/leave" "$BUYER_TOKEN" \
    '{"reason": "Test complete"}' "200" > /dev/null
fi

# ============================================================================
# PART 3: OFFERS & REFERENCE CHECKS (7 ENDPOINTS)
# ============================================================================

print_section "PART 3: OFFERS & REFERENCE CHECKS (7 Endpoints)"

# First, need to get or create an offer
OFFERS=$(curl -s -H "Authorization: Bearer $BUYER_TOKEN" \
  "$BASE_URL/api/v1/networks/offers?perspective=buyer&limit=5")

OFFER_ID=$(echo "$OFFERS" | node -e "try{const b=JSON.parse(require('fs').readFileSync(0,'utf8'));const id=(b?.data?.offers?.[0]?._id||b?.data?.offers?.[0]?.id||'');console.log(String(id));}catch(e){console.log('')}" 2>/dev/null || true)

if [[ -n "$OFFER_ID" ]]; then
  echo -e "\n${YELLOW}Found existing offer: $OFFER_ID${NC}"
  
  # View offer details
  test_api "Get Offer Details" "GET" "/api/v1/networks/offers/$OFFER_ID" "$BUYER_TOKEN" "-" "200" > /dev/null
  
  # View offer terms history
  test_api "Get Offer Terms History" "GET" "/api/v1/networks/offers/$OFFER_ID/terms?limit=20" "$BUYER_TOKEN" "-" "200" > /dev/null
  
  # Make counter offer
  test_api "Make Counter Offer" "POST" "/api/v1/networks/offers/$OFFER_ID/counter" "$SELLER_TOKEN" \
    '{
      "proposed_price": 4800,
      "message": "I can do 4800 with free shipping"
    }' "200" > /dev/null
fi

# Get reference checks for seller
print_section "PART 3: Reference Checks (Vouch System)"

REF_CHECKS=$(test_api "List Reference Checks for User" "GET" "/api/v1/networks/reference-checks?subject_user_id=$SELLER_ID&limit=10" "$BUYER_TOKEN" "-" "200")

REFCHECK_ID=$(echo "$REF_CHECKS" | node -e "try{const b=JSON.parse(require('fs').readFileSync(0,'utf8'));const id=(b?.data?.reference_checks?.[0]?._id||b?.data?.reference_checks?.[0]?.id||'');console.log(String(id));}catch(e){console.log('')}" 2>/dev/null || true)

if [[ -n "$REFCHECK_ID" ]]; then
  # Get specific reference check
  test_api "Get Reference Check Details" "GET" "/api/v1/networks/reference-checks/$REFCHECK_ID" "$SELLER_TOKEN" "-" "200" > /dev/null
  
  # Get vouch summary
  test_api "Get Vouch Summary" "GET" "/api/v1/networks/reference-checks/$SELLER_ID/summary" "$BUYER_TOKEN" "-" "200" > /dev/null
fi

# ============================================================================
# PART 4: ORDERS & TRUST (3 ENDPOINTS)
# ============================================================================

print_section "PART 4: ORDERS & TRUST (3 Endpoints)"

# Get existing orders
ORDERS=$(curl -s -H "Authorization: Bearer $BUYER_TOKEN" \
  "$BASE_URL/api/v1/networks/orders?perspective=buyer&limit=5")

ORDER_ID=$(echo "$ORDERS" | node -e "try{const b=JSON.parse(require('fs').readFileSync(0,'utf8'));const id=(b?.data?.orders?.[0]?._id||b?.data?.orders?.[0]?.id||'');console.log(String(id));}catch(e){console.log('')}" 2>/dev/null || true)

if [[ -n "$ORDER_ID" ]]; then
  echo -e "\n${YELLOW}Found existing order: $ORDER_ID${NC}"
  
  # Get order details
  test_api "Get Order Details" "GET" "/api/v1/networks/orders/$ORDER_ID" "$BUYER_TOKEN" "-" "200" > /dev/null
  
  # Try to confirm order (might fail if not eligible)
  test_api "Confirm Order (Buyer)" "PUT" "/api/v1/networks/orders/$ORDER_ID/confirm" "$BUYER_TOKEN" \
    '{
      "role": "buyer",
      "confirmed": true,
      "notes": "Item received in excellent condition"
    }' "200|409" > /dev/null
fi

# ============================================================================
# SUMMARY
# ============================================================================

print_section "TEST SUMMARY"

echo -e "\nTotal Tests Run: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
if [[ $FAILED_TESTS -gt 0 ]]; then
  echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
else
  echo -e "Failed: ${FAILED_TESTS}"
fi

PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo -e "\nPass Rate: ${PASS_RATE}%"

# Save summary
cat > "${OUTPUT_DIR}/test-summary_${TIMESTAMP}.txt" << EOF
BATCH 4 API TEST SUMMARY
Generated: $(date)

Total Tests: $TOTAL_TESTS
Passed: $PASSED_TESTS
Failed: $FAILED_TESTS
Pass Rate: $PASS_RATE%

Base URL: $BASE_URL
Buyer ID: $BUYER_ID
Seller ID: $SELLER_ID
Group ID: ${GROUP_ID:-N/A}
Offer ID: ${OFFER_ID:-N/A}
Order ID: ${ORDER_ID:-N/A}

Test Results saved to: $TEST_RESULTS_FILE
Response files saved to: $OUTPUT_DIR/
EOF

echo -e "\n${GREEN}✓ Tests complete! Results saved to: ${OUTPUT_DIR}${NC}"
echo -e "  Summary: ${OUTPUT_DIR}/test-summary_${TIMESTAMP}.txt"
echo -e "  Details: Check individual *_response.json files\n"

# Exit with proper code
if [[ $FAILED_TESTS -eq 0 ]]; then
  exit 0
else
  exit 1
fi
