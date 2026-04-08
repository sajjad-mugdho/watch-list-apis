#!/bin/bash
set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:5050}"
BUYER_TOKEN="${BUYER_TOKEN:-}"
SELLER_TOKEN="${SELLER_TOKEN:-}"
OUTPUT_DIR="test-results/batch4-api-tests"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Validation
if [[ -z "$BUYER_TOKEN" || -z "$SELLER_TOKEN" ]]; then
  echo -e "${RED}Error: BUYER_TOKEN and SELLER_TOKEN environment variables required${NC}"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Counters
TOTAL=0
PASSED=0
FAILED=0

# Test function
test_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  local token="$4"
  local payload="$5"
  
  TOTAL=$((TOTAL + 1))
  
  echo -e "\n${YELLOW}Test $TOTAL: $name${NC}"
  
  if [[ -z "$payload" || "$payload" == "-" ]]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$path" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$path" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$payload")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  echo "  Request: $method $path"
  echo "  Status: $http_code"
  
  # Save response
  safe_name=$(echo "$name" | tr ' ' '_' | tr '/' '_')
  echo "$body" > "${OUTPUT_DIR}/${safe_name}_${http_code}.json"
  
  if [[ "$http_code" =~ ^(200|201|204)$ ]]; then
    echo -e "  ${GREEN}✓ PASSED${NC}"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${RED}✗ FAILED${NC}"
    FAILED=$((FAILED + 1))
    if [[ ${#body} -gt 200 ]]; then
      echo "  Response: ${body:0:200}..."
    else
      echo "  Response: $body"
    fi
  fi
}

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}BATCH 4: Quick API Test Suite${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo "Base URL: $BASE_URL"
echo "Output: $OUTPUT_DIR"

# PART 1: SOCIAL HUB
echo -e "\n${BLUE}━━━ PART 1: SOCIAL HUB & MESSAGING ━━━${NC}"

test_endpoint "1. Get Buyer Profile" "GET" "/api/v1/networks/users/me" "$BUYER_TOKEN" "-"
test_endpoint "2. Get Seller Profile" "GET" "/api/v1/networks/users/me" "$SELLER_TOKEN" "-"
test_endpoint "3. Hub Status" "GET" "/api/v1/networks/social/hub-status" "$BUYER_TOKEN" "-"
test_endpoint "4. Search Items" "GET" "/api/v1/networks/social/search?q=watch&type=items" "$BUYER_TOKEN" "-"
test_endpoint "5. Discover Users" "GET" "/api/v1/networks/social/discover" "$BUYER_TOKEN" "-"
test_endpoint "6. List Conversations" "GET" "/api/v1/networks/conversations" "$BUYER_TOKEN" "-"

# PART 1: GROUPS
echo -e "\n${BLUE}━━━ PART 1: GROUPS ━━━${NC}"

test_endpoint "7. List Groups" "GET" "/api/v1/networks/social/groups?my_groups=true" "$SELLER_TOKEN" "-"
test_endpoint "8. Create Group" "POST" "/api/v1/networks/social/groups" "$SELLER_TOKEN" \
  '{"name":"Test Watch Traders","description":"Quick Test Group","avatar":"https://cdn.dialist.io/group.jpg","is_public":true}'

# Extract group ID from last response
GROUP_ID=$(ls -t ${OUTPUT_DIR}/8_Create_Group_201.json 2>/dev/null | head -1 | xargs cat 2>/dev/null | node -e "try{const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?.id||b?.data?._id||'');}catch(e){console.log('')}" 2>/dev/null || true)

if [[ -n "$GROUP_ID" ]]; then
  echo "  → Extracted Group ID: $GROUP_ID"
  test_endpoint "9. Get Group Details" "GET" "/api/v1/networks/social/groups/$GROUP_ID" "$SELLER_TOKEN" "-"
  test_endpoint "10. List Group Members" "GET" "/api/v1/networks/groups/$GROUP_ID/members" "$SELLER_TOKEN" "-"
fi

# PART 2: SHARED CONTENT
echo -e "\n${BLUE}━━━ PART 2: SHARED CONTENT ━━━${NC}"

if [[ -n "$GROUP_ID" ]]; then
  test_endpoint "11. Get Shared Links" "GET" "/api/v1/networks/groups/$GROUP_ID/shared-content?type=links" "$SELLER_TOKEN" "-"
  test_endpoint "12. Get Shared Media" "GET" "/api/v1/networks/groups/$GROUP_ID/shared-content?type=media" "$SELLER_TOKEN" "-"
fi

# PART 3: OFFERS & REFERENCE
echo -e "\n${BLUE}━━━ PART 3: OFFERS & REFERENCE CHECKS ━━━${NC}"

test_endpoint "13. List Offers" "GET" "/api/v1/networks/offers" "$BUYER_TOKEN" "-"
test_endpoint "14. List Reference Checks" "GET" "/api/v1/networks/reference-checks" "$BUYER_TOKEN" "-"

# PART 4: ORDERS
echo -e "\n${BLUE}━━━ PART 4: ORDERS ━━━${NC}"

test_endpoint "15. List Orders" "GET" "/api/v1/networks/orders" "$BUYER_TOKEN" "-"

# SUMMARY
echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [[ $TOTAL -gt 0 ]]; then
  pass_rate=$((PASSED * 100 / TOTAL))
  echo "Pass Rate: $pass_rate%"
fi

echo -e "\n✓ Results saved to: $OUTPUT_DIR"
ls -lh ${OUTPUT_DIR}/*.json 2>/dev/null | tail -20

if [[ $FAILED -gt 0 ]]; then
  exit 1
fi
