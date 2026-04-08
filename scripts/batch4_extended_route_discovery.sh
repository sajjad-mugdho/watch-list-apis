#!/bin/bash

# Extended Route Discovery Test - Batch 4 APIs
# Investigates correct endpoints for user profile and hub status
# URL: http://localhost:5050/api

API_URL="http://localhost:5050/api"

# Use tokens from environment (set by user)
BUYER_TOKEN="${BUYER_TOKEN:-}"
SELLER_TOKEN="${SELLER_TOKEN:-}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0

echo "════════════════════════════════════════════════════════════"
echo "EXTENDED ROUTE DISCOVERY TEST - BATCH 4"
echo "════════════════════════════════════════════════════════════"
echo ""

if [ -z "$BUYER_TOKEN" ]; then
  echo -e "${RED}❌ ERROR: BUYER_TOKEN not set${NC}"
  echo "Please set BUYER_TOKEN environment variable with a valid Clerk JWT"
  exit 1
fi

echo -e "${BLUE}Testing Routes Found in Code Analysis${NC}"
echo ""

# ════════════════════════════════════════════════════════════
# PART 1: USER PROFILE ENDPOINTS (Found in /src/routes/user/profile.ts)
# ════════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo "PART 1: USER PROFILE ENDPOINTS"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

declare -a PROFILE_ROUTES=(
  "GET:/v1/user/profile"
  "PATCH:/v1/user/profile"
  "GET:/v1/user/verification"
  "PATCH:/v1/user/status"
  "POST:/v1/user/avatar"
  "GET:/v1/user/wishlist"
  "PATCH:/v1/user/deactivate"
)

for route in "${PROFILE_ROUTES[@]}"; do
  IFS=: read -r METHOD ENDPOINT <<< "$route"
  
  if [ "$METHOD" == "GET" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -H "Authorization: Bearer $BUYER_TOKEN" \
      "$API_URL$ENDPOINT")
  elif [ "$METHOD" == "PATCH" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X PATCH \
      -H "Authorization: Bearer $BUYER_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"bio":"Test"}' \
      "$API_URL$ENDPOINT")
  elif [ "$METHOD" == "POST" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X POST \
      -H "Authorization: Bearer $BUYER_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"url":"https://example.com/avatar.jpg"}' \
      "$API_URL$ENDPOINT")
  fi
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [[ "$HTTP_CODE" =~ ^(200|201|204)$ ]]; then
    echo -e "${GREEN}✅ $METHOD $ENDPOINT${NC} → HTTP $HTTP_CODE"
    ((PASSED++))
  elif [ "$HTTP_CODE" == "404" ]; then
    echo -e "${RED}❌ $METHOD $ENDPOINT${NC} → HTTP $HTTP_CODE (NOT FOUND)"
    ((FAILED++))
  else
    echo -e "${YELLOW}⚠️  $METHOD $ENDPOINT${NC} → HTTP $HTTP_CODE"
    if [[ "$HTTP_CODE" =~ ^(400|401)$ ]]; then
      ((PASSED++))
    else
      ((FAILED++))
    fi
  fi
done

echo ""

# ════════════════════════════════════════════════════════════
# PART 2: PRIMARY HUB/SOCIAL ENDPOINTS (Found in socialRoutes.ts)
# ════════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo "PART 2: HUB/SOCIAL ENDPOINTS"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

declare -a SOCIAL_ROUTES=(
  "GET:/v1/networks/social/status"
  "GET:/v1/networks/social/inbox"
  "GET:/v1/networks/social/search"
  "GET:/v1/networks/social/discover"
  "GET:/v1/networks/social/groups"
)

for route in "${SOCIAL_ROUTES[@]}"; do
  IFS=: read -r METHOD ENDPOINT <<< "$route"
  
  if [ "$METHOD" == "GET" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -H "Authorization: Bearer $BUYER_TOKEN" \
      "$API_URL$ENDPOINT")
  fi
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [[ "$HTTP_CODE" =~ ^(200|201)$ ]]; then
    echo -e "${GREEN}✅ $METHOD $ENDPOINT${NC} → HTTP $HTTP_CODE"
    # Show a brief preview if it's JSON
    if echo "$BODY" | jq . &>/dev/null; then
      echo "   Response preview: $(echo "$BODY" | jq -c '.data // .message // .error' 2>/dev/null | head -c 100)..."
    fi
    ((PASSED++))
  elif [ "$HTTP_CODE" == "404" ]; then
    echo -e "${RED}❌ $METHOD $ENDPOINT${NC} → HTTP $HTTP_CODE (NOT FOUND)"
    ((FAILED++))
  else
    echo -e "${YELLOW}⚠️  $METHOD $ENDPOINT${NC} → HTTP $HTTP_CODE"
    if [[ "$HTTP_CODE" =~ ^(400|401)$ ]]; then
      ((PASSED++))
    else
      ((FAILED++))
    fi
  fi
done

echo ""

# ════════════════════════════════════════════════════════════
# PART 3: FEED ENDPOINTS (Found in feedRoutes.ts)
# ════════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo "PART 3: FEED ENDPOINTS"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

declare -a FEED_ROUTES=(
  "GET:/v1/feeds/token"
  "GET:/v1/feeds/timeline"
)

for route in "${FEED_ROUTES[@]}"; do
  IFS=: read -r METHOD ENDPOINT <<< "$route"
  
  if [ "$METHOD" == "GET" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -H "Authorization: Bearer $BUYER_TOKEN" \
      "$API_URL$ENDPOINT")
  fi
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [[ "$HTTP_CODE" =~ ^(200|201)$ ]]; then
    echo -e "${GREEN}✅ $METHOD $ENDPOINT${NC} → HTTP $HTTP_CODE"
    if echo "$BODY" | jq . &>/dev/null; then
      echo "   Response preview: $(echo "$BODY" | jq -c 'keys' 2>/dev/null | head -c 100)..."
    fi
    ((PASSED++))
  elif [ "$HTTP_CODE" == "404" ]; then
    echo -e "${RED}❌ $METHOD $ENDPOINT${NC} → HTTP $HTTP_CODE (NOT FOUND)"
    ((FAILED++))
  else
    echo -e "${YELLOW}⚠️  $METHOD $ENDPOINT${NC} → HTTP $HTTP_CODE"
    if [[ "$HTTP_CODE" =~ ^(400|401)$ ]]; then
      ((PASSED++))
    else
      ((FAILED++))
    fi
  fi
done

echo ""

# ════════════════════════════════════════════════════════════
# PART 4: DETAILED USER PROFILE TEST
# ════════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo "PART 4: DETAILED USER PROFILE RESPONSE"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

echo "Testing: GET /api/v1/user/profile"
PROFILE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  "$API_URL/v1/user/profile")

PROFILE_CODE=$(echo "$PROFILE_RESPONSE" | tail -1)
PROFILE_BODY=$(echo "$PROFILE_RESPONSE" | sed '$d')

echo "HTTP Status: $PROFILE_CODE"
echo ""
echo "Response:"
if echo "$PROFILE_BODY" | jq . &>/dev/null; then
  echo "$PROFILE_BODY" | jq .
else
  echo "$PROFILE_BODY"
fi

echo ""

# ════════════════════════════════════════════════════════════
# PART 5: DETAILED HUB STATUS TEST  
# ════════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo "PART 5: DETAILED HUB STATUS RESPONSE"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

echo "Testing: GET /api/v1/networks/social/status"
HUB_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  "$API_URL/v1/networks/social/status")

HUB_CODE=$(echo "$HUB_RESPONSE" | tail -1)
HUB_BODY=$(echo "$HUB_RESPONSE" | sed '$d')

echo "HTTP Status: $HUB_CODE"
echo ""
echo "Response:"
if echo "$HUB_BODY" | jq . &>/dev/null; then
  echo "$HUB_BODY" | jq .
else
  echo "$HUB_BODY"
fi

echo ""

# ════════════════════════════════════════════════════════════
# TEST SUMMARY
# ════════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo "EXTENDED ROUTE DISCOVERY SUMMARY"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"

TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
  PASS_RATE=$((PASSED * 100 / TOTAL))
  echo "📊 Pass Rate: $PASS_RATE% ($PASSED/$TOTAL)"
fi

echo ""
echo "Finding Summary:"
echo "- User Profile Routes: /api/v1/user/* (NOT /users/me)"
echo "- Hub Status Route: /api/v1/networks/social/status (NOT /networks/hub)"
echo "- Feed Routes: /api/v1/feeds/* (NOT /networks/feed)"
echo "- Social Routes: /api/v1/networks/social/* (discover, inbox, search, groups)"
echo ""

# Exit with success if most endpoints found
if [ $FAILED -le 2 ]; then
  echo -e "${GREEN}✅ Extended route discovery SUCCESSFUL${NC}"
  exit 0
else
  echo -e "${RED}❌ Extended route discovery found missing endpoints${NC}"
  exit 1
fi
