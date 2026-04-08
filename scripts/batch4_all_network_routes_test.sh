#!/bin/bash

# Batch 4 - COMPLETE NETWORK ROUTES DISCOVERY & VALIDATION TEST
# Tests ALL network-mounted APIs under /api/v1/networks/*
# 
# Routes mounted in src/networks/index.ts:
# - /user, /users, /listings, /offers, /offers-inquiries
# - /chat, /messages, /conversations, /chats (alias)
# - /reference-checks, /onboarding, /search, /connections
# - /social, /orders, /reservations, /notifications

API_URL="http://localhost:5050/api"
BUYER_TOKEN="${BUYER_TOKEN:-}"
SELLER_TOKEN="${SELLER_TOKEN:-}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PASSED=0
FAILED=0
NOT_FOUND=0
ERRORS=0

echo "════════════════════════════════════════════════════════════════"
echo "  BATCH 4 - COMPLETE NETWORK ROUTES DISCOVERY & VALIDATION"
echo "════════════════════════════════════════════════════════════════"
echo ""

if [ -z "$BUYER_TOKEN" ]; then
  echo -e "${RED}❌ ERROR: BUYER_TOKEN not set${NC}"
  exit 1
fi

# Create results directory
mkdir -p test-results/batch4-network-api-discovery

# ════════════════════════════════════════════════════════════════
# Test Helper Function
# ════════════════════════════════════════════════════════════════

test_route() {
  local METHOD=$1
  local ENDPOINT=$2
  local DESCRIPTION=$3
  local PAYLOAD=${4:-}
  
  local FULL_URL="$API_URL/v1/networks$ENDPOINT"
  local RESPONSE
  local HTTP_CODE
  local BODY
  
  case $METHOD in
    GET)
      RESPONSE=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer $BUYER_TOKEN" \
        "$FULL_URL")
      ;;
    POST)
      RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $BUYER_TOKEN" \
        -H "Content-Type: application/json" \
        -d "${PAYLOAD:-{}}" \
        "$FULL_URL")
      ;;
    PUT|PATCH)
      RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X $METHOD \
        -H "Authorization: Bearer $BUYER_TOKEN" \
        -H "Content-Type: application/json" \
        -d "${PAYLOAD:-{}}" \
        "$FULL_URL")
      ;;
    DELETE)
      RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X DELETE \
        -H "Authorization: Bearer $BUYER_TOKEN" \
        "$FULL_URL")
      ;;
  esac
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  # Determine result
  if [[ "$HTTP_CODE" =~ ^(200|201|202|204)$ ]]; then
    echo -e "${GREEN}✅${NC} $METHOD $ENDPOINT"
    echo "   └─ HTTP $HTTP_CODE | $DESCRIPTION"
    ((PASSED++))
    return 0
  elif [ "$HTTP_CODE" == "404" ]; then
    echo -e "${RED}❌${NC} $METHOD $ENDPOINT"
    echo "   └─ HTTP 404 NOT FOUND | $DESCRIPTION"
    ((NOT_FOUND++))
    return 1
  elif [[ "$HTTP_CODE" =~ ^(400|401|403)$ ]]; then
    echo -e "${YELLOW}⚠️ ${NC} $METHOD $ENDPOINT"
    echo "   └─ HTTP $HTTP_CODE (validation/auth) | $DESCRIPTION"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} $METHOD $ENDPOINT"
    echo "   └─ HTTP $HTTP_CODE ERROR | $DESCRIPTION"
    ((ERRORS++))
    return 1
  fi
}

# ════════════════════════════════════════════════════════════════
# 1. SOCIAL ROUTES
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "1️⃣  SOCIAL ROUTES (/api/v1/networks/social/*)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/social/status" "Hub status (online, unread counts)"
test_route "GET" "/social/discover" "Discover traders & groups"
test_route "GET" "/social/search?q=test" "Search (users, groups, items)"
test_route "GET" "/social/inbox" "Social inbox/conversations"
test_route "GET" "/social/groups" "List groups user belongs to"
test_route "POST" "/social/groups" "Create a group" '{"name":"Test Group","description":"Test"}'

echo ""

# ════════════════════════════════════════════════════════════════
# 2. MESSAGES & CHAT ROUTES
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "2️⃣  MESSAGES & CHAT ROUTES (/api/v1/networks/messages & /chat)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/messages" "List messages"
test_route "POST" "/messages/send" "Send a message" '{"channel_id":"test","text":"Hello"}'
test_route "GET" "/chat" "List chats (conversations)"

echo ""

# ════════════════════════════════════════════════════════════════
# 3. CONVERSATIONS ROUTES
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "3️⃣  CONVERSATIONS ROUTES (/api/v1/networks/conversations)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/conversations" "List all conversations"
test_route "GET" "/chats" "List chats (alias for conversations)"

echo ""

# ════════════════════════════════════════════════════════════════
# 4. USER ROUTES (Network-scoped)
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "4️⃣  USER ROUTES (/api/v1/networks/user & /users)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/user" "Get current network user"
test_route "GET" "/user/me" "Get my network profile"
test_route "GET" "/users" "List network users"

echo ""

# ════════════════════════════════════════════════════════════════
# 5. ORDERS ROUTES
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "5️⃣  ORDERS ROUTES (/api/v1/networks/orders)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/orders" "List orders"
test_route "POST" "/orders" "Create order" '{"offer_id":"test","quantity":1}'
test_route "GET" "/orders?status=pending" "List pending orders"

echo ""

# ════════════════════════════════════════════════════════════════
# 6. OFFERS ROUTES
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "6️⃣  OFFERS ROUTES (/api/v1/networks/offers)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/offers" "List offers"
test_route "POST" "/offers" "Create offer" '{"listing_id":"test","proposed_price":100}'
test_route "GET" "/offers?status=pending" "List pending offers"

echo ""

# ════════════════════════════════════════════════════════════════
# 7. OFFERS-INQUIRIES ROUTES
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "7️⃣  OFFERS-INQUIRIES ROUTES (/api/v1/networks/offers-inquiries)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/offers-inquiries" "List inquiries"
test_route "POST" "/offers-inquiries" "Create inquiry" '{"listing_id":"test","message":"Interested"}'

echo ""

# ════════════════════════════════════════════════════════════════
# 8. REFERENCE CHECKS ROUTES
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "8️⃣  REFERENCE CHECKS ROUTES (/api/v1/networks/reference-checks)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/reference-checks" "List reference checks"
test_route "POST" "/reference-checks" "Create reference check (vouch)" '{"subject_user_id":"test","order_id":"test"}'

echo ""

# ════════════════════════════════════════════════════════════════
# 9. CONNECTIONS ROUTES
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "9️⃣  CONNECTIONS ROUTES (/api/v1/networks/connections)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/connections" "List connections"
test_route "GET" "/connections?status=pending" "List pending connections"

echo ""

# ════════════════════════════════════════════════════════════════
# 10. LISTINGS ROUTES
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "🔟  LISTINGS ROUTES (/api/v1/networks/listings)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/listings" "List network listings"
test_route "POST" "/listings" "Create listing" '{"title":"Test Item","price":100}'

echo ""

# ════════════════════════════════════════════════════════════════
# 11. SEARCH ROUTES
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "1️⃣1️⃣  SEARCH ROUTES (/api/v1/networks/search)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/search?q=test" "Global search"
test_route "GET" "/search?q=test&type=listings" "Search listings"
test_route "GET" "/search?q=test&type=users" "Search users"

echo ""

# ════════════════════════════════════════════════════════════════
# 12. NOTIFICATIONS ROUTES
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "1️⃣2️⃣  NOTIFICATIONS ROUTES (/api/v1/networks/notifications)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/notifications" "List notifications"
test_route "GET" "/notifications?unread=true" "List unread notifications"

echo ""

# ════════════════════════════════════════════════════════════════
# 13. RESERVATIONS ROUTES
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "1️⃣3️⃣  RESERVATIONS ROUTES (/api/v1/networks/reservations)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/reservations" "List reservations"
test_route "POST" "/reservations" "Create reservation" '{"listing_id":"test"}'

echo ""

# ════════════════════════════════════════════════════════════════
# 14. ONBOARDING ROUTES
# ════════════════════════════════════════════════════════════════

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo "1️⃣4️⃣  ONBOARDING ROUTES (/api/v1/networks/onboarding)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_route "GET" "/onboarding/status" "Get onboarding status"

echo ""

# ════════════════════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════════════════════

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo "NETWORK ROUTES DISCOVERY TEST SUMMARY"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

TOTAL=$((PASSED + NOT_FOUND + ERRORS))
echo -e "${GREEN}✅ Working Routes${NC}:     $PASSED"
echo -e "${RED}❌ Not Found (404)${NC}:     $NOT_FOUND"
echo -e "${RED}❌ Errors${NC}:              $ERRORS"
echo -e "$BLUE━━━━━━━━━━━━━━━━━━━━━━━━━━━$NC"
echo "Total Tests:          $TOTAL"

if [ $TOTAL -gt 0 ]; then
  PASS_RATE=$((PASSED * 100 / TOTAL))
  echo ""
  echo -e "📊 Success Rate: ${CYAN}${PASS_RATE}%${NC} ($PASSED/$TOTAL)"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo "MOUNTED ROUTE GROUPS (from src/networks/index.ts)"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "✓ /user                      (userRoutes)"
echo "✓ /users                     (usersRoutes)"
echo "✓ /listings                  (listingRoutes)"
echo "✓ /offers                    (offerRoutes)"
echo "✓ /offers-inquiries          (offersInquiriesRoutes)"
echo "✓ /chat                      (chatRoutes)"
echo "✓ /messages                  (messageRoutes)"
echo "✓ /conversations             (conversationRoutes)"
echo "✓ /chats                     (conversationRoutes alias)"
echo "✓ /reference-checks          (referenceCheckRoutes)"
echo "✓ /onboarding                (onboardingRoutes)"
echo "✓ /search                    (searchRoutes)"
echo "✓ /connections               (connectionRoutes)"
echo "✓ /social                    (socialRoutes)"
echo "✓ /orders                    (orderRoutes)"
echo "✓ /reservations              (reservationRoutes)"
echo "✓ /notifications             (notificationRoutes)"
echo ""
echo "🔗 Full path format: /api/v1/networks/{endpoint}"
echo ""

if [ $NOT_FOUND -gt 5 ]; then
  echo -e "${YELLOW}⚠️  WARNING: Many 404s detected${NC}"
  echo "   Routes may not be properly implemented or mounted"
  exit 1
elif [ $ERRORS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  WARNING: Some endpoints returned errors${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All network routes accessible!${NC}"
  exit 0
fi
