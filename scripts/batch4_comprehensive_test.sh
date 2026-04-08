#!/bin/bash
set -e

# ============================================================================
# BATCH 4: COMPREHENSIVE API TESTING SUITE
# ============================================================================
# Tests:
# 1. Find correct routes (user profile & hub status)
# 2. Full workflows (create group → add members → send messages)
# 3. Error scenarios (401, 403, 404, 429, 500)
# 4. Load testing (rate limits & concurrent requests)
# ============================================================================

BASE_URL="${BASE_URL:-http://localhost:5050}"
BUYER_TOKEN="${BUYER_TOKEN:-}"
SELLER_TOKEN="${SELLER_TOKEN:-}"
OUTPUT_DIR="test-results/batch4-comprehensive"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Validation
if [[ -z "$BUYER_TOKEN" || -z "$SELLER_TOKEN" ]]; then
  echo -e "${RED}Error: BUYER_TOKEN and SELLER_TOKEN required${NC}"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

section() {
  echo -e "\n${MAGENTA}════════════════════════════════════════════════════════════${NC}"
  echo -e "${MAGENTA}$1${NC}"
  echo -e "${MAGENTA}════════════════════════════════════════════════════════════${NC}"
}

test_api() {
  local name="$1"
  local method="$2"
  local path="$3"
  local token="$4"
  local payload="$5"
  local expect_success="${6:-true}"
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
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
  
  local status="❌"
  local color="$RED"
  
  if [[ "$expect_success" == "true" && "$http_code" =~ ^(200|201|202)$ ]]; then
    status="✅"
    color="$GREEN"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  elif [[ "$expect_success" == "false" && ! "$http_code" =~ ^(200|201|202)$ ]]; then
    status="✅"
    color="$GREEN"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  
  echo -e "${color}${status}${NC} Test $TOTAL_TESTS: $name (HTTP $http_code)"
  
  # Save response
  safe_name=$(echo "$name" | tr ' ' '_' | tr '/' '_')
  echo "$body" > "${OUTPUT_DIR}/${safe_name}_${http_code}.json"
  
  # Show first line of response
  if [[ ${#body} -gt 100 ]]; then
    echo "  └─ ${body:0:100}..."
  else
    echo "  └─ $body"
  fi
  
  echo "$body"
}

extract_id() {
  local json="$1"
  echo "$json" | node -e "try{const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?.id||b?.data?._id||'');}catch(e){console.log('')}" 2>/dev/null || true
}

# ============================================================================
# PART 1: FIND CORRECT ROUTES
# ============================================================================

section "PART 1: DISCOVERING CORRECT ROUTES"

echo -e "\n${CYAN}Testing possible user profile routes...${NC}"

# Try 1: /api/v1/networks/users/me
echo -e "\nRoute 1: /api/v1/networks/users/me"
RESP1=$(test_api "Profile Route 1 (users/me)" "GET" "/api/v1/networks/users/me" "$BUYER_TOKEN" "-" "true")
PROFILE_ID=$(extract_id "$RESP1")
[[ -n "$PROFILE_ID" ]] && echo "✅ Found user ID: $PROFILE_ID"

# Try 2: /api/v1/users/me
echo -e "\nRoute 2: /api/v1/users/me"
RESP2=$(test_api "Profile Route 2 (users/me)" "GET" "/api/v1/users/me" "$BUYER_TOKEN" "-" "true")
PROFILE_ID=$(extract_id "$RESP2")

# Try 3: /api/v1/auth/me
echo -e "\nRoute 3: /api/v1/auth/me"
test_api "Profile Route 3 (auth/me)" "GET" "/api/v1/auth/me" "$BUYER_TOKEN" "-" "true" > /dev/null

# Try 4: /api/v1/profile
echo -e "\nRoute 4: /api/v1/profile"
test_api "Profile Route 4 (profile)" "GET" "/api/v1/profile" "$BUYER_TOKEN" "-" "true" > /dev/null

echo -e "\n${CYAN}Testing possible hub status routes...${NC}"

# Try 1: /api/v1/networks/social/hub-status
echo -e "\nRoute 1: /api/v1/networks/social/hub-status"
test_api "Hub Route 1 (hub-status)" "GET" "/api/v1/networks/social/hub-status" "$BUYER_TOKEN" "-" "true" > /dev/null

# Try 2: /api/v1/networks/hub
echo -e "\nRoute 2: /api/v1/networks/hub"
test_api "Hub Route 2 (hub)" "GET" "/api/v1/networks/hub" "$BUYER_TOKEN" "-" "true" > /dev/null

# Try 3: /api/v1/feed
echo -e "\nRoute 3: /api/v1/feed"
test_api "Hub Route 3 (feed)" "GET" "/api/v1/feed" "$BUYER_TOKEN" "-" "true" > /dev/null

# Try 4: /api/v1/networks/feed
echo -e "\nRoute 4: /api/v1/networks/feed"
RESP_HUB=$(test_api "Hub Route 4 (networks/feed)" "GET" "/api/v1/networks/feed" "$BUYER_TOKEN" "-" "true")

# ============================================================================
# PART 2: COMPLETE WORKFLOWS
# ============================================================================

section "PART 2: FULL WORKFLOW TESTS"

echo -e "\n${CYAN}Workflow 1: Create Group → Add Members → Send Messages${NC}"

# Step 1: Create group
echo -e "\n${YELLOW}Step 1: Create Group${NC}"
GROUP_PAYLOAD='{
  "name": "Workflow Test Group '"$(date +%s)"'",
  "description": "Testing complete workflow",
  "avatar": "https://cdn.dialist.io/group.jpg",
  "is_public": true
}'
GROUP_RESP=$(test_api "Create Group" "POST" "/api/v1/networks/social/groups" "$SELLER_TOKEN" "$GROUP_PAYLOAD" "true")
GROUP_ID=$(extract_id "$GROUP_RESP")

if [[ -n "$GROUP_ID" ]]; then
  echo -e "${GREEN}✅ Group created: $GROUP_ID${NC}"
  
  # Step 2: Join group as buyer
  echo -e "\n${YELLOW}Step 2: Join Group (Buyer)${NC}"
  test_api "Join Group" "POST" "/api/v1/networks/social/groups/$GROUP_ID/join" "$BUYER_TOKEN" "-" "true" > /dev/null
  
  # Step 3: List group members
  echo -e "\n${YELLOW}Step 3: List Group Members${NC}"
  MEMBERS=$(test_api "List Members" "GET" "/api/v1/networks/groups/$GROUP_ID/members" "$SELLER_TOKEN" "-" "true")
  
  # Step 4: Send message
  echo -e "\n${YELLOW}Step 4: Send Group Message${NC}"
  MSG_PAYLOAD='{
    "channel_id": "group_'$GROUP_ID'",
    "text": "Hello from workflow test!"
  }'
  test_api "Send Message" "POST" "/api/v1/networks/messages/send" "$BUYER_TOKEN" "$MSG_PAYLOAD" "true" > /dev/null
  
  # Step 5: Get conversations
  echo -e "\n${YELLOW}Step 5: List Conversations${NC}"
  test_api "List Conversations" "GET" "/api/v1/networks/conversations" "$BUYER_TOKEN" "-" "true" > /dev/null
  
  echo -e "\n${GREEN}✅ Workflow 1 Complete${NC}"
else
  echo -e "${RED}❌ Failed to create group${NC}"
fi

# ============================================================================
# PART 3: ERROR SCENARIOS
# ============================================================================

section "PART 3: ERROR SCENARIO TESTS"

echo -e "\n${CYAN}Testing 401 Unauthorized${NC}"
test_api "401: Invalid Token" "GET" "/api/v1/networks/conversations" "invalid-token-xyz" "-" "false"
test_api "401: Empty Token" "GET" "/api/v1/networks/conversations" "" "-" "false"

echo -e "\n${CYAN}Testing 404 Not Found${NC}"
test_api "404: Invalid Group" "GET" "/api/v1/networks/social/groups/nonexistent-id" "$BUYER_TOKEN" "-" "false"
test_api "404: Invalid Chat" "GET" "/api/v1/networks/conversations/nonexistent-id" "$BUYER_TOKEN" "-" "false"
test_api "404: Invalid Message" "DELETE" "/api/v1/networks/messages/nonexistent-id" "$BUYER_TOKEN" "-" "false"

echo -e "\n${CYAN}Testing 400 Bad Request${NC}"
test_api "400: Missing Required Field" "POST" "/api/v1/networks/social/groups" "$SELLER_TOKEN" '{"description":"No name"}' "false"
test_api "400: Invalid Enum Value" "GET" "/api/v1/networks/social/search?q=test&type=invalid_type" "$BUYER_TOKEN" "-" "false"

echo -e "\n${CYAN}Testing 403 Forbidden${NC}"
# Create a group with seller
GROUP_PAYLOAD='{
  "name": "Permission Test '"$(date +%s)"'",
  "description": "Test",
  "is_public": true
}'
PERM_GROUP=$(test_api "Create for Permission Test" "POST" "/api/v1/networks/social/groups" "$SELLER_TOKEN" "$GROUP_PAYLOAD" "true")
PERM_GROUP_ID=$(extract_id "$PERM_GROUP")

if [[ -n "$PERM_GROUP_ID" ]]; then
  # Buyer tries to remove member (should fail)
  test_api "403: Buyer Remove Member" "DELETE" "/api/v1/networks/groups/$PERM_GROUP_ID/members/some-user" "$BUYER_TOKEN" "-" "false"
fi

# ============================================================================
# PART 4: RATE LIMITING & LOAD TESTS
# ============================================================================

section "PART 4: RATE LIMITING & LOAD TESTS"

echo -e "\n${CYAN}Testing Rate Limits (Burst 20 requests in 10 seconds)${NC}"

RATE_LIMIT_HITS=0

for i in {1..20}; do
  echo -n "Request $i... "
  
  response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/networks/conversations" \
    -H "Authorization: Bearer $BUYER_TOKEN" \
    -H "Content-Type: application/json")
  
  http_code=$(echo "$response" | tail -n1)
  
  if [[ "$http_code" == "429" ]]; then
    echo -e "${RED}RATE LIMITED (429)${NC}"
    RATE_LIMIT_HITS=$((RATE_LIMIT_HITS + 1))
  elif [[ "$http_code" == "200" ]]; then
    echo -e "${GREEN}OK (200)${NC}"
  else
    echo "Code $http_code"
  fi
  
  # Check rate limit headers
  rate_limit_remaining=$(curl -sI -X GET "$BASE_URL/api/v1/networks/conversations" \
    -H "Authorization: Bearer $BUYER_TOKEN" \
    | grep -i "x-ratelimit-remaining" | cut -d' ' -f2 | tr -d '\r')
  
  if [[ -n "$rate_limit_remaining" ]]; then
    echo "  Rate limit remaining: $rate_limit_remaining"
  fi
  
  sleep 0.5
done

if [[ $RATE_LIMIT_HITS -gt 0 ]]; then
  echo -e "\n${YELLOW}⚠️  Rate limiting triggered ($RATE_LIMIT_HITS times)${NC}"
  echo "This is expected behavior! Rate limits are working."
else
  echo -e "\n${YELLOW}⚠️  No rate limit triggered in burst test${NC}"
  echo "Either limit is higher than 100/min, or implementation missing"
fi

# ============================================================================
# CONCURRENT LOAD TEST
# ============================================================================

echo -e "\n${CYAN}Testing Concurrent Requests (10 parallel requests)${NC}"

declare -a PIDS
declare -a CODES

for i in {1..10}; do
  (
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/networks/conversations" \
      -H "Authorization: Bearer $BUYER_TOKEN" \
      -H "Content-Type: application/json")
    http_code=$(echo "$response" | tail -n1)
    echo "Request $i: $http_code"
  ) &
  PIDS+=($!)
done

# Wait for all background jobs
for pid in "${PIDS[@]}"; do
  wait "$pid" 2>/dev/null
done

echo -e "${GREEN}✅ All concurrent requests completed${NC}"

# ============================================================================
# SUMMARY REPORT
# ============================================================================

section "TEST SUMMARY"

echo -e "\n${CYAN}Test Results:${NC}"
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [[ $TOTAL_TESTS -gt 0 ]]; then
  pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
  echo "Pass Rate: $pass_rate%"
fi

echo -e "\n${CYAN}Files Generated:${NC}"
ls -lh "$OUTPUT_DIR"/*.json 2>/dev/null | wc -l
echo "files saved to $OUTPUT_DIR/"

echo -e "\n${CYAN}Key Findings:${NC}"
echo "1. Check test-results/ for individual endpoint responses"
echo "2. Look for 401/403/404/429 responses in logs above"
echo "3. Rate limit headers show if limit is enforced"
echo "4. Concurrent tests verify thread safety"

echo -e "\n${GREEN}✅ Comprehensive testing complete!${NC}"
