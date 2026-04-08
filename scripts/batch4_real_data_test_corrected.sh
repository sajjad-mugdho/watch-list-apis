#!/bin/bash

################################################################################
#
# BATCH 4 - REAL DATA TEST SUITE (CORRECTED ENDPOINTS)
# =====================================================
# Tests all Batch 4 network APIs with REAL database entity IDs
# Validates that CREATE operations (POST) work with correct payloads
#
# Usage: bash batch4_real_data_test_corrected.sh <SELLER_TOKEN> <BUYER_TOKEN>
#
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Configuration
API_URL="http://localhost:5050/api"
BASE_URL="$API_URL/v1/networks"

# Get tokens from args
SELLER_TOKEN="$1"
BUYER_TOKEN="$2"

# Exit if no tokens provided
if [[ -z "$SELLER_TOKEN" || -z "$BUYER_TOKEN" ]]; then
  echo -e "${RED}Error: Tokens required${NC}"
  echo "Usage: bash $0 <SELLER_TOKEN> <BUYER_TOKEN>"
  exit 1
fi

# Real Data - From Database
GROUP_ID="69d562a89f198eb7ba33d117"
SELLER_OFFER_ID="69cc5159cf0fca3e239f7808"
SELLER_ORDER_ID="69cc515bcf0fca3e239f7811"
BUYER_ORDER_ID="699ef02c65dda0db7a73771b"
SELLER_REF_CHECK_ID="69d55b179f198eb7ba33ce7f"
BUYER_REF_CHECK_ID="69d45214eb790d48e9a669ed"
LISTING_ID="69cc568de174dbd07eae5bba"

# Extract User IDs from JWT tokens (for reference check target)
extract_user_id() {
  local token=$1
  # JWT structure: header.payload.signature
  local payload=$(echo "$token" | cut -d. -f2)
  # Decode base64 (add padding if needed)
  local padding=$((${#payload} % 4))
  if [ $padding -gt 0 ]; then
    payload="${payload}$(printf '%0.s=' {1..$((4 - $padding))})"
  fi
  echo "$payload" | base64 -d 2>/dev/null | jq -r '.sub // empty'
}

SELLER_USER_ID=$(extract_user_id "$SELLER_TOKEN")
BUYER_USER_ID=$(extract_user_id "$BUYER_TOKEN")

# Initialize counters
PASSED=0
FAILED=0
TOTAL=0

# Test endpoint function
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local token=$4
  local description=$5
  
  TOTAL=$((TOTAL + 1))
  
  # Construct full URL
  local url="$BASE_URL$endpoint"
  
  # Make request based on method
  if [[ "$method" == "GET" ]]; then
    response=$(curl -s -w "\n%{http_code}" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      "$url")
  else
    response=$(curl -s -w "\n%{http_code}" \
      -X "$method" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$url")
  fi
  
  # Extract status code and body
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  # Check if successful (2xx status code)
  if [[ "$http_code" =~ ^2[0-9]{2}$ ]]; then
    PASSED=$((PASSED + 1))
    echo -e "${GREEN}✅${NC} HTTP $http_code - $description"
    
    # Extract resource ID if present
    local resource_id=$(echo "$body" | jq -r '._id // .id // .data._id // .data.id // empty' 2>/dev/null)
    if [[ -n "$resource_id" ]]; then
      echo -e "   ${BLUE}└─ Resource ID: $resource_id${NC}"
    fi
  else
    FAILED=$((FAILED + 1))
    
    # Better status code display
    if [[ "$http_code" =~ ^[45][0-9]{2}$ ]]; then
      echo -e "${RED}❌${NC} HTTP $http_code - $description"
    else
      echo -e "${YELLOW}⚠️${NC} HTTP $http_code - $description"
    fi
    
    # Extract error message
    local error_msg=$(echo "$body" | jq -r '.message // .error // .errors.message // empty' 2>/dev/null)
    if [[ -n "$error_msg" ]]; then
      echo -e "   ${BLUE}└─ Error: $error_msg${NC}"
    fi
  fi
}

# Display header
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  BATCH 4 - REAL DATA TEST SUITE (CORRECTED ENDPOINTS)"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Display loaded data
echo -e "${BLUE}📊 REAL DATA LOADED:${NC}"
echo "Seller User ID:          $SELLER_USER_ID"
echo "Buyer User ID:           $BUYER_USER_ID"
echo "Group ID:                $GROUP_ID"
echo "Seller Offer ID:         $SELLER_OFFER_ID"
echo "Seller Order ID:         $SELLER_ORDER_ID"
echo "Buyer Order ID:          $BUYER_ORDER_ID"
echo "Listing ID:              $LISTING_ID"
echo ""

################################################################################
# 1️⃣  SOCIAL & GROUPS OPERATIONS
################################################################################
echo "═══════════════════════════════════════════════════════════════"
echo "1️⃣  SOCIAL & GROUPS OPERATIONS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

test_endpoint "GET" "/social/groups" "" "$SELLER_TOKEN" "List groups (verify group exists)"

test_endpoint "POST" "/social/groups" \
  '{"name":"Test Group Real","description":"Testing with real data"}' \
  "$SELLER_TOKEN" \
  "Create new group"

echo ""

################################################################################
# 2️⃣  LISTINGS OPERATIONS (Base for offers/orders)
################################################################################
echo "═══════════════════════════════════════════════════════════════"
echo "2️⃣  LISTINGS OPERATIONS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

test_endpoint "GET" "/listings" "" "$SELLER_TOKEN" "List all listings"

test_endpoint "GET" "/listings/$LISTING_ID" "" "$SELLER_TOKEN" "Get specific listing"

echo ""

################################################################################
# 3️⃣  OFFERS OPERATIONS (CORRECTED: via /listings/:id/offers)
################################################################################
echo "═══════════════════════════════════════════════════════════════"
echo "3️⃣  OFFERS OPERATIONS (create via listings)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Create offer on listing with correct fields (amount + shipping_region - uppercase enum)
test_endpoint "POST" "/listings/$LISTING_ID/offers" \
  '{"amount":100,"shipping_region":"US","message":"Interested in purchasing this item"}' \
  "$BUYER_TOKEN" \
  "Create offer on listing (buyer perspective)"

test_endpoint "GET" "/offers" "" "$SELLER_TOKEN" "List offers (seller perspective)"

test_endpoint "GET" "/offers" "" "$BUYER_TOKEN" "List offers (buyer perspective)"

echo ""

################################################################################
# 4️⃣  ORDERS OPERATIONS (CORRECTED: via /listings/:id/reserve)
################################################################################
echo "═══════════════════════════════════════════════════════════════"
echo "4️⃣  ORDERS OPERATIONS (reserve listing = buy now)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Buy Now (reserve listing) - creates order directly with shipping_region (uppercase enum)
# Note: This might fail if listing already has active orders, but we test it
test_endpoint "POST" "/listings/$LISTING_ID/reserve" \
  '{"shipping_region":"US"}' \
  "$BUYER_TOKEN" \
  "Buy Now/Reserve listing (creates order)"

test_endpoint "GET" "/orders" "" "$SELLER_TOKEN" "List pending orders (seller perspective)"

test_endpoint "GET" "/orders" "" "$BUYER_TOKEN" "List pending orders (buyer perspective)"

echo ""

################################################################################
# 5️⃣  REFERENCE CHECKS / VOUCHING
################################################################################
echo "═══════════════════════════════════════════════════════════════"
echo "5️⃣  REFERENCE CHECKS / VOUCHING"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Create reference check with buyer user ID and order ID
# Note: target_id must be a valid MongoDB ObjectId, order_id must exist
test_endpoint "POST" "/reference-checks" \
  "{\"target_id\":\"$BUYER_USER_ID\",\"order_id\":\"$BUYER_ORDER_ID\",\"reason\":\"Verified transaction completion\"}" \
  "$SELLER_TOKEN" \
  "Create reference check (seller vouching buyer)"

test_endpoint "GET" "/reference-checks" "" "$SELLER_TOKEN" "List reference checks (seller perspective)"

test_endpoint "GET" "/reference-checks" "" "$BUYER_TOKEN" "List reference checks (buyer perspective)"

echo ""

################################################################################
# 6️⃣  INQUIRIES / QUESTIONS (CORRECTED: via /listings/:id/inquire)
################################################################################
echo "═══════════════════════════════════════════════════════════════"
echo "6️⃣  INQUIRIES / QUESTIONS (create via listings)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Ask inquiry on listing
test_endpoint "POST" "/listings/$LISTING_ID/inquire" \
  '{"message":"Are you still selling this? Can you deliver by Friday?"}' \
  "$BUYER_TOKEN" \
  "Create inquiry question on listing"

# Note: Inquiries are accessed via conversations, not separate endpoint
test_endpoint "GET" "/conversations" "" "$SELLER_TOKEN" "List conversations with inquiries (seller perspective)"

echo ""

################################################################################
# 7️⃣  CONVERSATIONS & MESSAGING
################################################################################
echo "═══════════════════════════════════════════════════════════════"
echo "7️⃣  CONVERSATIONS & MESSAGING"
echo "═══════════════════════════════════════════════════════════════"
echo ""

test_endpoint "GET" "/conversations" "" "$BUYER_TOKEN" "List conversations (buyer)"

test_endpoint "GET" "/chats" "" "$SELLER_TOKEN" "List chats (seller)"

# Get or create conversation channel first (required before messaging)
channel_response=$(curl -s -X POST \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"seller_id\":\"$SELLER_USER_ID\",\"listing_id\":\"$LISTING_ID\"}" \
  "$BASE_URL/chat/channel")

channel_id=$(echo "$channel_response" | jq -r '._id // .id // .data._id // empty' 2>/dev/null)

if [[ -n "$channel_id" ]]; then
  test_endpoint "POST" "/messages/send" \
    "{\"channel_id\":\"$channel_id\",\"text\":\"Testing message with real data\"}" \
    "$BUYER_TOKEN" \
    "Send message (with valid channel membership)"
else
  test_endpoint "POST" "/messages/send" \
    "{\"channel_id\":\"invalid\",\"text\":\"Testing message\"}" \
    "$BUYER_TOKEN" \
    "Send message (test message route)"
fi

echo ""

################################################################################
# 8️⃣  SOCIAL DISCOVERY & STATUS
################################################################################
echo "═══════════════════════════════════════════════════════════════"
echo "8️⃣  SOCIAL DISCOVERY & STATUS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

test_endpoint "GET" "/social/status" "" "$SELLER_TOKEN" "Get hub status (user online, unread counts)"

test_endpoint "GET" "/social/discover" "" "$BUYER_TOKEN" "Discover traders & groups"

test_endpoint "GET" "/search" "" "$SELLER_TOKEN" "Search for items/users/groups"

echo ""

################################################################################
# SUMMARY
################################################################################
echo "════════════════════════════════════════════════════════════════"
echo "REAL DATA TEST SUMMARY"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total:    $TOTAL"

if [[ $TOTAL -gt 0 ]]; then
  percentage=$((PASSED * 100 / TOTAL))
  echo -e "📊 Success Rate: ${GREEN}${percentage}%${NC}"
else
  echo "📊 Success Rate: 0%"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "ENDPOINT CORRECTIONS APPLIED"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "1. POST /offers → POST /listings/:id/offers"
echo "   └─ Send offer on a specific listing"
echo ""
echo "2. POST /orders → POST /listings/:id/reserve"
echo "   └─ Buy now/reserve listing (creates order)"
echo ""
echo "3. POST /offers-inquiries → POST /listings/:id/inquire"
echo "   └─ Ask inquiry question on listing"
echo ""
echo "4. POST /reference-checks"
echo "   └─ Now includes target_id field (buyer user ID)"
echo ""
echo "════════════════════════════════════════════════════════════════"

# Exit with appropriate code
if [[ $FAILED -gt 0 ]]; then
  exit 1
else
  exit 0
fi
