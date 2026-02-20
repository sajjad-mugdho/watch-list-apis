#!/bin/bash

# Configuration
API_URL="http://localhost:5050/api/v1"
SELLER_TOKEN="eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzE2Nzc3NzUsImlhdCI6MTc3MTU3Nzc3NSwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6IjMwOWZmY2ZjOWM1OWIzZTg4MzVmIiwibmJmIjoxNzcxNTc3NzQ1LCJzdWIiOiJ1c2VyXzM2SWR0amVtRTBBQ3hZelVGZnBQOFFVRmp5ZiJ9.m9My2gDYfLgVtSja-z4f7Qm8pYS1HXSSjiUKHjAibjHU2L6w-d0OMgHH8a4Ni_PrVfkMXdszU50TZREfWV-EiRyUsBsfqKTzBEJT83SRQRnThlafvSD0R66vJ8znSDDzhXIAN8vhaCn-uOL-6_iTev66BR03eFs_sPZNFzQ2ulh5EMsuI39zwHTsZsQOo-vRxBX1ikKIncQL8Pjm85SDEPuTm6pr7_QFHzizRHs7I4OAQA2Mff1IUFxvgkobJrNPkjPmwWnKb_40Nx8iHYJg-1KiZQii-o_8XzD8Q0GV-dGtiB3vYOAkeiG_VOXVhi2jDYb7pwaC_S-BXh8KCzcO2Q"
BUYER_TOKEN="eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzE2Nzc3NjksImlhdCI6MTc3MTU3Nzc2OSwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6IjUxYjM2ZGM0NDMxZGM2NGE0MWY2IiwibmJmIjoxNzcxNTc3NzM5LCJzdWIiOiJ1c2VyXzM2SWR0amVtRTBBQ3hZelVGZnBQOFFVRmp5ZiJ9.wKT2xcMcxtXTKyYPfWNAPTEMnEWrJBqq-4zxttcBnTHdd0w0W4XkEhKiIlKkzzCS0pQt-S8iA0iO30oAeWjBDl9ulpnIbupxWsjv4MHjCL775y3n2uEiwRPccxpnVmZi6aZ26pH_sndlww50nXabTSwsiEAQ2zGQc3LtvwQkehIBala2rzhQxqwsbXXVEVKQPsEJFDXbF7jM-YPtUlrCwGqgDfCr7boMkfF286BgjxPziAosyyeHPmAzGUV3oxK7PYZspp3JdlsEZTPeSfrToAYL6kRLDhR-Fom51zswgZuY_gz_vYtduH2cXbLySuYqoOZnJKMAbsc6mOaokWvTCg"

# Entities IDs (Known from previous tests or to be fetched)
# Replacing these with valid IDs is crucial for 200 OK responses.
# If an ID is missing, the test will fallback to using the placeholder or failing gracefully (404/400).
LISTING_ID="6995de6ee8e61632a3632dc3"
ORDER_ID="6995de72e8e61632a3632dce"
WATCH_ID="67a5c078a1e38c82f635ca33"
# Fetch User ID from Profile
SELLER_ID=$(curl -s -H "Authorization: Bearer $SELLER_TOKEN" "http://localhost:5050/api/v1/user" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['_id'])" 2>/dev/null)
BUYER_ID=$(curl -s -H "Authorization: Bearer $BUYER_TOKEN" "http://localhost:5050/api/v1/user" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['_id'])" 2>/dev/null)

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
    PLATFORM=$5

    # Replace placeholders
    URL="${ENDPOINT/\{id\}/$LISTING_ID}" # Default {id} to listing unless specified
    URL="${URL/\{listing_id\}/$LISTING_ID}"
    URL="${URL/\{order_id\}/$ORDER_ID}"
    URL="${URL/\{user_id\}/$BUYER_ID}"      # Use Buyer ID for user lookups
    URL="${URL/\{watchId\}/$WATCH_ID}"
    
    # Specific ID overrides based on context
    if [[ "$ENDPOINT" == *"/orders/"* ]]; then URL="${ENDPOINT/\{id\}/$ORDER_ID}"; fi
    if [[ "$ENDPOINT" == *"/users/"* ]]; then URL="${ENDPOINT/\{id\}/$BUYER_ID}"; fi
    if [[ "$ENDPOINT" == *"/trust-cases/"* ]]; then URL="${ENDPOINT/\{id\}/case_123}"; fi 
    if [[ "$ENDPOINT" == *"/messages/"* ]]; then URL="${ENDPOINT/\{id\}/msg_123}"; fi 
    if [[ "$ENDPOINT" == *"/notifications/"* ]]; then URL="${ENDPOINT/\{id\}/notif_123}"; fi 
    
    FULL_URL="http://localhost:5050$URL"

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
test_api "GET" "/api/v1/marketplace/orders/{id}" "Get Order" "marketplace"
test_api "GET" "/api/v1/marketplace/orders/buyer/list" "Buyer Orders" "marketplace"
test_api "GET" "/api/v1/marketplace/orders/seller/list" "Seller Orders" "marketplace"

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
test_api "GET" "/api/v1/subscriptions/current" "Current Subscription" "marketplace"
test_api "GET" "/api/v1/subscriptions/tiers" "Subscription Tiers" "marketplace"

# --- ISOs ---
test_api "GET" "/api/v1/isos" "List ISOs" "" "networks"

# --- Admin (Should 403 or 200 if Admin) ---
test_api "GET" "/api/v1/admin/trust-cases" "List Trust Cases (Admin)" "" "marketplace"

echo "=== COMPLETED COMPREHENSIVE API TEST ==="
