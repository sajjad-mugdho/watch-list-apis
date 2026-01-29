#!/bin/bash
# API Audit Script

BUYER_TOKEN="eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDEiLCJleHAiOjE3Njk3OTE1NDgsImlhdCI6MTc2OTY5MTU0OCwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6IjdjNmY0Mzc2YjE1ODZjZDFhYmE4IiwibmJmIjoxNzY5NjkxNTE4LCJzdWIiOiJ1c2VyXzM2T0tweUxaTXJmNFhZOHRJRHVoUktqSjZUayJ9.QX52VoAtPbC2NcHau29tAnHqlthVHeHFxNyozlpy0MtSTvncb3vkTWmzVbW0Ov70S_2k-qFVtZX76O7wvWeH8I1Em5KBGjpiv9ZvV62t6lgvi9JoxSM5798nS0V9LGjdkOPHQabed1ruAIhNVz6f46ywr1QwXLTObF3D6Giue0m9jKAxFNv66O5byzaVTHJ-JaiFIdy1o8_gvtQKh33q_VdAqpAa48E91nnq3TPX9gZ5IhSQEIAbC0aEfriWqV4ScrkeXFzte2_tBzK0qy0mO0TNPVfK-4s4yWcq1R_nf978ybHozHYsem1xBBnoKVxAdKtjJiI0_E1d-KC2mkG89Q"
SELLER_TOKEN="eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDEiLCJleHAiOjE3Njk3OTE1MzAsImlhdCI6MTc2OTY5MTUzMCwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6ImUyZmY0M2M3NGE4MWVjNTgwOGFlIiwibmJmIjoxNzY5NjkxNTAwLCJzdWIiOiJ1c2VyXzM2SWR0amVtRTBBQ3hZelVGZnBQOFFVRmp5ZiJ9.GjutJSZzgwTcKkwcYI208f_SU4srLDRV7fhM97OYKHKnMO4rwdQcQIBZbInunpm5MYzclyDgT9-Wr6JTFNx6tMO65X3wXrry09A_Bs0Py2F41hxkrbWSxaaxJCj-gJzSKmBNGUKTOkrV9AXSjjByS-WogkLSzTnQmdImcldMUHZAYF-6bhxDpvw7_HrnddvDN6D9Rp28iHGwH5JsJr5zdsEiID9BdC9hZ3whyLTV7FxXUFNTEFpfKHM-BtSWhwBZzFW2UjPXnyVq6ZFUIjbof0rZR21AQZOXnjt_Y73rn50ppiUzGjlywlnYymD0DIoFOeT38vPoH242u1zu7ZTWFQ"

BASE="http://localhost:5050/api/v1"
RESULTS=""

test_endpoint() {
  local method="$1"
  local path="$2"
  local token="$3"
  local body="$4"
  local platform="$5"
  
  local headers="-H 'Authorization: Bearer $token' -H 'Content-Type: application/json'"
  if [ -n "$platform" ]; then
    headers="$headers -H 'x-platform: $platform'"
  fi
  
  if [ "$method" = "GET" ]; then
    local response=$(curl -s -w "|||%{http_code}" -H "Authorization: Bearer $token" -H "x-platform: $platform" "$BASE$path" 2>&1)
  elif [ "$method" = "POST" ]; then
    local response=$(curl -s -w "|||%{http_code}" -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/json" -H "x-platform: $platform" -d "$body" "$BASE$path" 2>&1)
  fi
  
  local http_body=$(echo "$response" | sed 's/|||[0-9]*$//')
  local http_code=$(echo "$response" | grep -oE '[0-9]+$')
  
  echo "[$http_code] $method $path"
  if [ "$http_code" != "200" ] && [ "$http_code" != "201" ]; then
    echo "  -> $(echo $http_body | head -c 200)..."
  fi
}

echo "=========================================="
echo "API AUDIT REPORT - $(date)"
echo "=========================================="

echo ""
echo "## User Endpoints (Buyer Token)"
echo ""

test_endpoint "GET" "/user" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/user/profile" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/user/notifications" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/user/favorites?platform=networks" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/user/wishlist" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/user/friends" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/user/friends/requests/pending" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/user/support/tickets" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/user/isos" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/user/followers" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/user/following" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/user/searches?platform=networks" "$BUYER_TOKEN" "" ""

echo ""
echo "## Reviews Endpoints"
echo ""

test_endpoint "GET" "/reviews/me" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/reviews/users/6931d0ad8f88ced1cd48b052" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/reviews/users/6931d0ad8f88ced1cd48b052/summary" "$BUYER_TOKEN" "" ""

echo ""
echo "## Listings Endpoints"
echo ""

test_endpoint "GET" "/networks/listings" "$BUYER_TOKEN" "" "networks"
test_endpoint "GET" "/marketplace/listings" "$BUYER_TOKEN" "" "marketplace"
test_endpoint "GET" "/watches" "$BUYER_TOKEN" "" ""

echo ""
echo "## ISOs Endpoints"
echo ""

test_endpoint "GET" "/isos" "$BUYER_TOKEN" "" "networks"

echo ""
echo "## Onboarding Endpoints"
echo ""

test_endpoint "GET" "/onboarding/status" "$BUYER_TOKEN" "" ""

echo ""
echo "## Feeds Endpoints"
echo ""

test_endpoint "GET" "/feeds/timeline" "$BUYER_TOKEN" "" "networks"
test_endpoint "GET" "/feeds/home?platform=networks" "$BUYER_TOKEN" "" "networks"

echo ""
echo "## Seller Endpoints (Seller Token)"
echo ""

test_endpoint "GET" "/user" "$SELLER_TOKEN" "" ""
test_endpoint "GET" "/marketplace/merchant/status" "$SELLER_TOKEN" "" "marketplace"
test_endpoint "GET" "/marketplace/merchant/listings" "$SELLER_TOKEN" "" "marketplace"
test_endpoint "GET" "/networks/listings/my" "$SELLER_TOKEN" "" "networks"

echo ""
echo "## Chat/Channel Endpoints"
echo ""

test_endpoint "GET" "/user/tokens/chat" "$BUYER_TOKEN" "" ""
test_endpoint "GET" "/user/tokens/feed" "$BUYER_TOKEN" "" ""

echo ""
echo "=========================================="
echo "AUDIT COMPLETE"
echo "=========================================="
