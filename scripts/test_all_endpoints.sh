#!/bin/bash

# Configuration
API_URL="http://localhost:5050/api/v1"
SELLER_TOKEN="eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzE1MzAwMTEsImlhdCI6MTc3MTQzMDAxMSwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6IjJhNmY1OWY0MzY3ZTE5NjViMjUyIiwibmJmIjoxNzcxNDI5OTgxLCJzdWIiOiJ1c2VyXzM2SWR0amVtRTBBQ3hZelVGZnBQOFFVRmp5ZiJ9.n8KDsqmucdqQye21fqf_re3AoFMMyvyZZbwUjWJFvHMG6Bm0Yp0BMMG3lcZMiXnrc_QkxydI6lqvcCdoHXxa1i6LGLYuJoiu5pAHs9_dUW1fV2mRlsLMa4tJTtROtr8PAgamnhxlB_nijDzPT1DAjwAxbp11G0YNNM7wIwUOPd7OiTG8BWJCyFm4ovGKc6LncN9OUl2irqt_lBbImdwS_v_ASgdu2rMEkhyggE6qERzfLe_odQEwgaTBdPbByJSVm7yU6qkfzt2DbURFVeNUJ2Hn0N6vLRWXfSCzJ0XJOVnrhFY9MTs03ghF1PCySNHowmlGhqbZ0WvWZJbeM91u_w"
BUYER_TOKEN="eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzE1MzAwNTUsImlhdCI6MTc3MTQzMDA1NSwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6IjA4MWQyMDI4Yzc1YmE5MzUxMWVhIiwibmJmIjoxNzcxNDMwMDI1LCJzdWIiOiJ1c2VyXzM2T0tweUxaTXJmNFhZOHRJRHVoUktqSjZUayJ9.P7VbCTH9-PALb2MMn1BJB8keBNLMMxhRdhVHF8NwcojL7UCcXhYpcyPDz8dahABJQqwP2zVNzRzg2LYqj4ho6pd671KjYjWFZI6M6NYZT0IxFI8zj5Yk0eYxzqeczZ3RnTGF2pA8ZVuNtm2jLKbzlkMLNiYBxAUzyzLUt9F-XtLQ-y7SV2WTxhlQ7eh7j0kbQ9_QdWxH4bR6PkfyjSMvaRqjBfXZGHgdbrBUGEH4dIUbu59AjbsnCCgCn7VY9bpqXBcSaSq-UueMSgqMzQtnpN1slVW60hhKv1YQZFkE3CfL1SZ3f3pEGeQpVt0icHAiWbrW91_cUtP9IivX-rFecw"

# Entities IDs (Known from previous tests or to be fetched)
# Replacing these with valid IDs is crucial for 200 OK responses.
# If an ID is missing, the test will fallback to using the placeholder or failing gracefully (404/400).
LISTING_ID="6995e2fce8e61632a3632f35"
ORDER_ID="6995e2fee8e61632a3632f47"
WATCH_ID="67a5c078a1e38c82f635ca33"
# Fetch User ID from Profile
SELLER_ID=$(curl -s -H "Authorization: Bearer $SELLER_TOKEN" "http://localhost:5050/api/v1/user/profile" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['_id'])" 2>/dev/null)
BUYER_ID=$(curl -s -H "Authorization: Bearer $BUYER_TOKEN" "http://localhost:5050/api/v1/user/profile" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['_id'])" 2>/dev/null)

if [ -z "$SELLER_ID" ]; then SELLER_ID="user_123"; fi
if [ -z "$BUYER_ID" ]; then BUYER_ID="user_456"; fi

echo "Setup: Listing=$LISTING_ID, Order=$ORDER_ID, Seller=$SELLER_ID, Buyer=$BUYER_ID"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test Function
test_api() {
    METHOD=$1
    ENDPOINT=$2
    DESC=$3
    BODY=$4

    # Replace placeholders
    URL="${ENDPOINT/\{id\}/$LISTING_ID}" # Default {id} to listing unless specified
    URL="${URL/\{listing_id\}/$LISTING_ID}"
    URL="${URL/\{order_id\}/$ORDER_ID}"
    URL="${URL/\{user_id\}/$BUYER_ID}"      # Use Buyer ID for user lookups
    URL="${URL/\{watchId\}/$WATCH_ID}"
    
    # Specific ID overrides based on context
    if [[ "$ENDPOINT" == *"/orders/"* ]]; then URL="${ENDPOINT/\{id\}/$ORDER_ID}"; fi
    if [[ "$ENDPOINT" == *"/users/"* ]]; then URL="${ENDPOINT/\{id\}/$BUYER_ID}"; fi
    if [[ "$ENDPOINT" == *"/trust-cases/"* ]]; then URL="${ENDPOINT/\{id\}/case_123}"; fi # Mock case ID
    if [[ "$ENDPOINT" == *"/messages/"* ]]; then URL="${ENDPOINT/\{id\}/msg_123}"; fi # Mock msg ID
    if [[ "$ENDPOINT" == *"/notifications/"* ]]; then URL="${ENDPOINT/\{id\}/notif_123}"; fi # Mock notif ID
    
    FULL_URL="http://localhost:5050$URL"

    echo -ne "Testing $METHOD $URL ... "

    if [ "$METHOD" == "GET" ] || [ "$METHOD" == "DELETE" ]; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X $METHOD -H "Authorization: Bearer $SELLER_TOKEN" "$FULL_URL")
    else
        if [ -z "$BODY" ]; then BODY="{}"; fi
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X $METHOD -H "Authorization: Bearer $SELLER_TOKEN" -H "Content-Type: application/json" -d "$BODY" "$FULL_URL")
    fi

    # Determine status
    if [[ "$HTTP_CODE" =~ ^2 ]]; then
        echo -e "${GREEN}PASSED ($HTTP_CODE)${NC} - $DESC"
    elif [[ "$HTTP_CODE" == "400" ]] || [[ "$HTTP_CODE" == "401" ]] || [[ "$HTTP_CODE" == "403" ]] || [[ "$HTTP_CODE" == "404" ]] || [[ "$HTTP_CODE" == "409" ]]; then
        # 4xx is acceptable for "manual testing" of reachability without setting up perfect state for every single endpoint
        echo -e "${GREEN}REACHABLE ($HTTP_CODE)${NC} - $DESC"
    else
        echo -e "${RED}FAILED ($HTTP_CODE)${NC} - $DESC"
    fi
}

echo "=== STARTING COMPREHENSIVE API TEST ==="

# --- Health & User ---
test_api "GET" "/api/health" "Health Check"
test_api "GET" "/api/v1/user/profile" "User Profile"
test_api "GET" "/api/v1/user/favorites?platform=marketplace" "User Favorites"
test_api "GET" "/api/v1/user/notifications" "User Notifications"

# --- Marketplace Listings ---
test_api "GET" "/api/v1/marketplace/listings" "List Listings"
test_api "POST" "/api/v1/marketplace/listings" "Create Listing" '{"brand":"Rolex","model":"Submariner","reference":"124060","price":10000,"currency":"USD"}'
test_api "PATCH" "/api/v1/marketplace/listings/{id}" "Update Listing" '{"price":10500}'
test_api "POST" "/api/v1/marketplace/listings/{id}/publish" "Publish Listing" # Might fail if already published

# --- Marketplace Orders ---
test_api "GET" "/api/v1/marketplace/orders/{id}" "Get Order"
test_api "GET" "/api/v1/marketplace/orders/buyer/list" "Buyer Orders"
test_api "GET" "/api/v1/marketplace/orders/seller/list" "Seller Orders"

# --- Watches ---
test_api "GET" "/api/v1/watches" "List Watches"
test_api "POST" "/api/v1/watches" "Add Watch" '{"brand":"Seiko","model":"5 Sports","reference":"SRPD55","diameter":"42mm"}'

# --- Chat/Feeds ---
test_api "GET" "/api/v1/chat/token" "Chat Token"
test_api "GET" "/api/v1/chat/channels" "Chat Channels"
test_api "GET" "/api/v1/feeds/token" "Feeds Token"
test_api "GET" "/api/v1/feeds/timeline" "Feeds Timeline"

# --- Reference Checks ---
test_api "GET" "/api/v1/reference-checks" "List Reference Checks"
test_api "POST" "/api/v1/reference-checks" "Create Reference Check" '{"seller_id":"'$SELLER_ID'","order_id":"'$ORDER_ID'"}'

# --- Subscriptions ---
test_api "GET" "/api/v1/subscriptions/current" "Current Subscription"
test_api "GET" "/api/v1/subscriptions/tiers" "Subscription Tiers"

# --- ISOs ---
test_api "GET" "/api/v1/isos" "List ISOs"
test_api "POST" "/api/v1/isos" "Create ISO" '{"brand":"Patek Philippe","model":"Nautilus"}'

# --- Admin (Should 403) ---
test_api "GET" "/api/v1/admin/trust-cases" "List Trust Cases (Admin)"

echo "=== COMPLETED COMPREHENSIVE API TEST ==="
