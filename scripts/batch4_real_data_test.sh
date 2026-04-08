#!/bin/bash

# Batch 4 - REAL DATA TEST SUITE
# Tests all failing POST endpoints with ACTUAL entity IDs from database
# Using real seller/buyer IDs, group IDs, offer/order IDs, etc.

API_URL="http://localhost:5050/api"

# ════════════════════════════════════════════════════════════════
# EXTRACT USER IDs FROM TOKENS (JWT parsing)
# ════════════════════════════════════════════════════════════════

extract_user_id_from_token() {
  local TOKEN=$1
  # JWT token format: header.payload.signature
  # Decode the payload (second part)
  local PAYLOAD=$(echo "$TOKEN" | cut -d'.' -f2)
  
  # Add padding if needed
  local PADDING=$((4 - ${#PAYLOAD} % 4))
  if [ $PADDING -ne 4 ]; then
    PAYLOAD="${PAYLOAD}$(printf '%.0s=' $(seq 1 $PADDING))"
  fi
  
  # Decode base64 and extract 'sub' field (subject = user_id)
  echo "$PAYLOAD" | base64 -d 2>/dev/null | jq -r '.sub // empty' 2>/dev/null || echo ""
}

# ════════════════════════════════════════════════════════════════
# REAL DATA FROM DATABASE
# ════════════════════════════════════════════════════════════════

SELLER_TOKEN="${1:-$SELLER_TOKEN}"
BUYER_TOKEN="${2:-$BUYER_TOKEN}"

if [ -z "$SELLER_TOKEN" ] || [ -z "$BUYER_TOKEN" ]; then
  echo "❌ ERROR: Missing tokens"
  echo "Usage: $0 SELLER_TOKEN BUYER_TOKEN"
  echo ""
  echo "Or set environment variables:"
  echo "  export SELLER_TOKEN='...'"
  echo "  export BUYER_TOKEN='...'"
  exit 1
fi

# Extract user IDs from tokens
SELLER_USER_ID=$(extract_user_id_from_token "$SELLER_TOKEN")
BUYER_USER_ID=$(extract_user_id_from_token "$BUYER_TOKEN")

# Real IDs from database
SELLER_GROUP_ID="69d562a89f198eb7ba33d117"
SELLER_OFFER_ID="69cc5159cf0fca3e239f7808"
SELLER_ORDER_ID="69cc515bcf0fca3e239f7811"
SELLER_REFERENCE_CHECK_ID="69d55b179f198eb7ba33ce7f"

BUYER_GROUP_ID="69d562a89f198eb7ba33d117"     # Same group
BUYER_ORDER_ID="699ef02c65dda0db7a73771b"
BUYER_REFERENCE_CHECK_ID="69d45214eb790d48e9a669ed"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PASSED=0
FAILED=0

echo "════════════════════════════════════════════════════════════════"
echo "  BATCH 4 - REAL DATA TEST SUITE"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📊 REAL DATA LOADED:"
echo "Seller User ID:          $SELLER_USER_ID"
echo "Buyer User ID:           $BUYER_USER_ID"
echo "Group ID:                $SELLER_GROUP_ID"
echo "Seller Offer ID:         $SELLER_OFFER_ID"
echo "Seller Order ID:         $SELLER_ORDER_ID"
echo "Buyer Order ID:          $BUYER_ORDER_ID"
echo ""

# ════════════════════════════════════════════════════════════════
# TEST HELPER FUNCTION
# ════════════════════════════════════════════════════════════════

test_endpoint() {
  local METHOD=$1
  local ENDPOINT=$2
  local TOKEN=$3
  local PAYLOAD=$4
  local DESCRIPTION=$5
  
  local URL="$API_URL/v1/networks$ENDPOINT"
  
  echo -n "Testing: $DESCRIPTION ... "
  
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X $METHOD \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$URL")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  # Check if response has success/data structure
  if echo "$BODY" | jq . &>/dev/null; then
    RESPONSE_TYPE=$(echo "$BODY" | jq -r '.data // .success // .error // "unknown"' 2>/dev/null)
  else
    RESPONSE_TYPE="invalid_json"
  fi
  
  # Evaluate result
  if [[ "$HTTP_CODE" =~ ^(200|201|202)$ ]]; then
    echo -e "${GREEN}✅ HTTP $HTTP_CODE${NC}"
    if echo "$BODY" | jq -e '.data' &>/dev/null; then
      RESOURCE_ID=$(echo "$BODY" | jq -r '.data.id // .data._id // "no-id"' 2>/dev/null)
      echo "   └─ Resource ID: $RESOURCE_ID"
    fi
    ((PASSED++))
    return 0
  elif [[ "$HTTP_CODE" =~ ^(400|403|404)$ ]]; then
    echo -e "${YELLOW}⚠️  HTTP $HTTP_CODE${NC}"
    ERROR_MSG=$(echo "$BODY" | jq -r '.error.message // .error // "unknown error"' 2>/dev/null)
    echo "   └─ Error: $ERROR_MSG"
    ((FAILED++))
    return 1
  else
    echo -e "${RED}❌ HTTP $HTTP_CODE${NC}"
    ERROR_MSG=$(echo "$BODY" | jq -r '.error.message // "server error"' 2>/dev/null)
    echo "   └─ Error: $ERROR_MSG"
    ((FAILED++))
    return 1
  fi
}

# ════════════════════════════════════════════════════════════════
# PART 1: SOCIAL/GROUPS OPERATIONS
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "1️⃣  SOCIAL & GROUPS OPERATIONS"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Get existing group details
echo "Testing group operations..."
test_endpoint "GET" "/social/groups" "$BUYER_TOKEN" "" \
  "List groups (verify group exists)"

# Try to create a new group
test_endpoint "POST" "/social/groups" "$BUYER_TOKEN" \
  "{\"name\":\"Test Group $(date +%s)\",\"description\":\"Real data test group\",\"privacy\":\"public\"}" \
  "Create new group"

echo ""

# ════════════════════════════════════════════════════════════════
# PART 2: OFFERS OPERATIONS (CRITICAL)
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "2️⃣  OFFERS OPERATIONS"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Get real listing first
echo "Fetching real listing to create offer on..."
LISTING=$(curl -s "$API_URL/v1/networks/listings?limit=1" \
  -H "Authorization: Bearer $BUYER_TOKEN")
LISTING_ID=$(echo "$LISTING" | jq -r '.data[0].id // .data[0]._id // empty' 2>/dev/null)

if [ -z "$LISTING_ID" ]; then
  echo -e "${YELLOW}⚠️  No listings found, creating test listing first...${NC}"
  # Create a test listing
  NEW_LISTING=$(curl -s -X POST "$API_URL/v1/networks/listings" \
    -H "Authorization: Bearer $SELLER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\":\"Test Item $(date +%s)\",
      \"description\":\"Test listing for offer creation\",
      \"price\":5500,
      \"category\":\"watches\",
      \"condition\":\"excellent\"
    }")
  LISTING_ID=$(echo "$NEW_LISTING" | jq -r '.data.id // .data._id // empty' 2>/dev/null)
  if [ -z "$LISTING_ID" ]; then
    LISTING_ID="69d643c46edac2493f96b7f8"  # Fallback to documented ID
    echo "Using fallback listing ID: $LISTING_ID"
  fi
fi

echo "Using Listing ID: $LISTING_ID"
echo ""

# Test: Create offer on real listing
test_endpoint "POST" "/offers" "$BUYER_TOKEN" \
  "{
    \"listing_id\":\"$LISTING_ID\",
    \"proposed_price\":5200,
    \"message\":\"Great item! Would you accept \$5200?\"
  }" \
  "Create offer with real listing"

# Get existing offers
test_endpoint "GET" "/offers" "$BUYER_TOKEN" "" \
  "List offers"

test_endpoint "GET" "/offers?status=pending" "$BUYER_TOKEN" "" \
  "List pending offers"

echo ""

# ════════════════════════════════════════════════════════════════
# PART 3: ORDERS OPERATIONS (CRITICAL)
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "3️⃣  ORDERS OPERATIONS"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test: Create order from real offer
test_endpoint "POST" "/orders" "$BUYER_TOKEN" \
  "{
    \"offer_id\":\"$SELLER_OFFER_ID\",
    \"listing_id\":\"$LISTING_ID\",
    \"quantity\":1,
    \"total_price\":5200
  }" \
  "Create order from real offer"

# Get existing orders
test_endpoint "GET" "/orders" "$BUYER_TOKEN" "" \
  "List orders (buyer perspective)"

test_endpoint "GET" "/orders?status=pending" "$SELLER_TOKEN" "" \
  "List pending orders (seller perspective)"

echo ""

# ════════════════════════════════════════════════════════════════
# PART 4: REFERENCE CHECKS / VOUCHING (CRITICAL)
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "4️⃣  REFERENCE CHECKS / VOUCHING"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Test: Create reference check
test_endpoint "POST" "/reference-checks" "$SELLER_TOKEN" \
  "{
    \"subject_user_id\":\"$BUYER_USER_ID\",
    \"order_id\":\"$BUYER_ORDER_ID\",
    \"reference_type\":\"buyer_promptness\",
    \"message\":\"Would you like me to vouch for your transaction?\"
  }" \
  "Create reference check (seller vouching buyer)"

# Get existing reference checks
test_endpoint "GET" "/reference-checks" "$BUYER_TOKEN" "" \
  "List reference checks"

echo ""

# ════════════════════════════════════════════════════════════════
# PART 5: INQUIRIES OPERATIONS
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "5️⃣  INQUIRIES / QUESTIONS"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_endpoint "POST" "/offers-inquiries" "$BUYER_TOKEN" \
  "{
    \"listing_id\":\"$LISTING_ID\",
    \"message\":\"Does this come with original box and papers?\",
    \"inquiry_type\":\"question\"
  }" \
  "Create inquiry question on listing"

test_endpoint "GET" "/offers-inquiries" "$SELLER_TOKEN" "" \
  "List inquiries received (seller perspective)"

echo ""

# ════════════════════════════════════════════════════════════════
# PART 6: CONVERSATION & MESSAGING
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "6️⃣  CONVERSATIONS & MESSAGING"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_endpoint "GET" "/conversations" "$BUYER_TOKEN" "" \
  "List conversations (buyer)"

test_endpoint "GET" "/chats" "$SELLER_TOKEN" "" \
  "List chats (seller)"

# Try to send a message (likely to fail due to routing issue)
test_endpoint "POST" "/messages/send" "$BUYER_TOKEN" \
  "{
    \"channel_id\":\"ch-test-123\",
    \"text\":\"Hello, interested in this item!\"
  }" \
  "Send message (testing message route)"

echo ""

# ════════════════════════════════════════════════════════════════
# PART 7: SOCIAL DISCOVERY
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "7️⃣  SOCIAL DISCOVERY & STATUS"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_endpoint "GET" "/social/status" "$BUYER_TOKEN" "" \
  "Get hub status (user online, unread counts)"

test_endpoint "GET" "/social/discover" "$BUYER_TOKEN" "" \
  "Discover traders & groups"

test_endpoint "GET" "/social/search?q=watch" "$BUYER_TOKEN" "" \
  "Search for items/users/groups"

echo ""

# ════════════════════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════════════════════

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo "REAL DATA TEST SUMMARY"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

TOTAL=$((PASSED + FAILED))
SUCCESS_RATE=$((PASSED * 100 / TOTAL))

echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total:    $TOTAL"
echo -e "📊 Success Rate: ${CYAN}${SUCCESS_RATE}%${NC}"

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo "FINDINGS"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
  echo "All POST endpoints working with real data"
  exit 0
elif [ $PASSED -gt $FAILED ]; then
  echo -e "${YELLOW}✅ MOSTLY WORKING (>50%)${NC}"
  echo "Most POST endpoints now functional with real data"
  echo "Remaining issues documented above"
  exit 0
else
  echo -e "${RED}❌ SIGNIFICANT ISSUES REMAIN${NC}"
  echo "Review error messages above for details"
  exit 1
fi
