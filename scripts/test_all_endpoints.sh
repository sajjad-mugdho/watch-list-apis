#!/bin/bash

# Configuration
API_URL="http://localhost:5050/api/v1"
# Export these from your shell environment before running the script:
# export SELLER_TOKEN="<your-seller-jwt>"
# export BUYER_TOKEN="<your-buyer-jwt>"
: "${SELLER_TOKEN:?SELLER_TOKEN must be set in the environment}"
: "${BUYER_TOKEN:?BUYER_TOKEN must be set in the environment}"

# Entities IDs (Known from previous tests or to be fetched)
# Replacing these with valid IDs is crucial for 200 OK responses.
# If an ID is missing, the test will fallback to using the placeholder or failing gracefully (404/400).
LISTING_ID="6995de6ee8e61632a3632dc3"
ORDER_ID="6995de72e8e61632a3632dce"
WATCH_ID="67a5c078a1e38c82f635ca33"
# Fetch User ID from Profile
SELLER_ID=$(curl -s -H "Authorization: Bearer $SELLER_TOKEN" "$API_URL/user" | jq -r '.data._id' 2>/dev/null)
BUYER_ID=$(curl -s -H "Authorization: Bearer $BUYER_TOKEN" "$API_URL/user" | jq -r '.data._id' 2>/dev/null)

if [ -z "$SELLER_ID" ] || [ "$SELLER_ID" == "null" ]; then SELLER_ID="000000000000000000000001"; fi
if [ -z "$BUYER_ID" ] || [ "$BUYER_ID" == "null" ]; then BUYER_ID="000000000000000000000002"; fi

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
    PLATFORM=$5

    # Replace placeholders
    # Replace placeholders
    URL="${ENDPOINT//\{id\}/$LISTING_ID}" # Default {id} to listing unless specified
    URL="${URL//\{listing_id\}/$LISTING_ID}"
    URL="${URL//\{order_id\}/$ORDER_ID}"
    URL="${URL//\{user_id\}/$BUYER_ID}"      # Use Buyer ID for user lookups
    URL="${URL//\{watchId\}/$WATCH_ID}"
    
    # Specific ID overrides based on context (applied on top of $URL, not $ENDPOINT)
    if [[ "$ENDPOINT" == *"/orders/"* ]];       then URL="${URL//\{id\}/$ORDER_ID}"; fi
    if [[ "$ENDPOINT" == *"/users/"* ]];         then URL="${URL//\{id\}/$BUYER_ID}"; fi
    if [[ "$ENDPOINT" == *"/trust-cases/"* ]];   then URL="${URL//\{id\}/case_123}"; fi
    if [[ "$ENDPOINT" == *"/messages/"* ]];      then URL="${URL//\{id\}/msg_123}"; fi
    if [[ "$ENDPOINT" == *"/notifications/"* ]]; then URL="${URL//\{id\}/notif_123}"; fi
    
    FULL_URL="${API_URL}${URL#/api/v1}"

    echo -ne "Testing $METHOD $URL ... "

    HEADERS=(-H "Authorization: Bearer $SELLER_TOKEN")
    if [ ! -z "$PLATFORM" ]; then
        HEADERS+=(-H "x-platform: $PLATFORM")
    fi

    if [ "$METHOD" == "GET" ] || [ "$METHOD" == "DELETE" ]; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X $METHOD "${HEADERS[@]}" "$FULL_URL")
    else
        if [ -z "$BODY" ]; then BODY="{}"; fi
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X $METHOD "${HEADERS[@]}" -H "Content-Type: application/json" -d "$BODY" "$FULL_URL")
    fi

    # Determine status
    if [[ "$HTTP_CODE" =~ ^2 ]]; then
        echo -e "${GREEN}PASSED ($HTTP_CODE)${NC} - $DESC"
    elif [[ "$HTTP_CODE" == "400" ]] || [[ "$HTTP_CODE" == "401" ]] || [[ "$HTTP_CODE" == "403" ]] || [[ "$HTTP_CODE" == "404" ]] || [[ "$HTTP_CODE" == "409" ]]; then
        echo -e "${GREEN}REACHABLE ($HTTP_CODE)${NC} - $DESC"
    else
        echo -e "${RED}FAILED ($HTTP_CODE)${NC} - $DESC"
    fi
}

echo "=== STARTING COMPREHENSIVE API TEST ==="

# --- Health & User ---
test_api "GET" "/api/health" "Health Check"
test_api "GET" "/api/v1/user" "User Profile (Core)"
test_api "GET" "/api/v1/user/profile" "User Profile (Detailed)"
test_api "GET" "/api/v1/user/favorites?platform=marketplace" "User Favorites" "marketplace"
test_api "GET" "/api/v1/user/notifications" "User Notifications" "marketplace"

# --- Marketplace Listings ---
test_api "GET" "/api/v1/marketplace/listings" "List Listings" "marketplace"
test_api "POST" "/api/v1/marketplace/listings" "Create Listing" '{"brand":"Rolex","model":"Submariner","reference":"124060","price":10000,"currency":"USD"}' "marketplace"
test_api "PATCH" "/api/v1/marketplace/listings/{id}" "Update Listing" '{"price":10500}' "marketplace"
test_api "POST" "/api/v1/marketplace/listings/{id}/publish" "Publish Listing" "" "marketplace"

# --- Marketplace Orders ---
test_api "GET" "/api/v1/marketplace/orders/{id}" "Get Order" "" "marketplace"
test_api "GET" "/api/v1/marketplace/orders/buyer/list" "Buyer Orders" "" "marketplace"
test_api "GET" "/api/v1/marketplace/orders/seller/list" "Seller Orders" "" "marketplace"

# --- Watches ---
test_api "GET" "/api/v1/watches" "List Watches"

# --- Chat/Feeds ---
test_api "GET" "/api/v1/marketplace/chat/token" "Chat Token" "" "marketplace"
test_api "GET" "/api/v1/marketplace/chat/channels" "Chat Channels" "" "marketplace"
test_api "GET" "/api/v1/feeds/token" "Feeds Token" "" "networks"
test_api "GET" "/api/v1/feeds/timeline" "Feeds Timeline" "" "networks"

# --- Reference Checks ---
test_api "GET" "/api/v1/reference-checks" "List Reference Checks" "" "networks"
test_api "POST" "/api/v1/reference-checks" "Create Reference Check" '{"seller_id":"'$SELLER_ID'","order_id":"'$ORDER_ID'"}' "networks"

# --- Subscriptions ---
test_api "GET" "/api/v1/subscriptions/current" "Current Subscription" "" "marketplace"
test_api "GET" "/api/v1/subscriptions/tiers" "Subscription Tiers" "" "marketplace"

# --- ISOs ---
test_api "GET" "/api/v1/isos" "List ISOs" "" "networks"

# --- Admin (Should 403 or 200 if Admin) ---
test_api "GET" "/api/v1/admin/trust-cases" "List Trust Cases (Admin)" "" "marketplace"

echo "=== COMPLETED COMPREHENSIVE API TEST ==="
