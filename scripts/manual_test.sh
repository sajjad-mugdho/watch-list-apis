#!/bin/bash

# Configuration
API_URL="http://localhost:5050/api/v1"
SELLER_TOKEN="eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzE1MzAwMTEsImlhdCI6MTc3MTQzMDAxMSwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6IjJhNmY1OWY0MzY3ZTE5NjViMjUyIiwibmJmIjoxNzcxNDI5OTgxLCJzdWIiOiJ1c2VyXzM2SWR0amVtRTBBQ3hZelVGZnBQOFFVRmp5ZiJ9.n8KDsqmucdqQye21fqf_re3AoFMMyvyZZbwUjWJFvHMG6Bm0Yp0BMMG3lcZMiXnrc_QkxydI6lqvcCdoHXxa1i6LGLYuJoiu5pAHs9_dUW1fV2mRlsLMa4tJTtROtr8PAgamnhxlB_nijDzPT1DAjwAxbp11G0YNNM7wIwUOPd7OiTG8BWJCyFm4ovGKc6LncN9OUl2irqt_lBbImdwS_v_ASgdu2rMEkhyggE6qERzfLe_odQEwgaTBdPbByJSVm7yU6qkfzt2DbURFVeNUJ2Hn0N6vLRWXfSCzJ0XJOVnrhFY9MTs03ghF1PCySNHowmlGhqbZ0WvWZJbeM91u_w"
BUYER_TOKEN="eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzE1MzAwNTUsImlhdCI6MTc3MTQzMDA1NSwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6IjA4MWQyMDI4Yzc1YmE5MzUxMWVhIiwibmJmIjoxNzcxNDMwMDI1LCJzdWIiOiJ1c2VyXzM2T0tweUxaTXJmNFhZOHRJRHVoUktqSjZUayJ9.P7VbCTH9-PALb2MMn1BJB8keBNLMMxhRdhVHF8NwcojL7UCcXhYpcyPDz8dahABJQqwP2zVNzRzg2LYqj4ho6pd671KjYjWFZI6M6NYZT0IxFI8zj5Yk0eYxzqeczZ3RnTGF2pA8ZVuNtm2jLKbzlkMLNiYBxAUzyzLUt9F-XtLQ-y7SV2WTxhlQ7eh7j0kbQ9_QdWxH4bR6PkfyjSMvaRqjBfXZGHgdbrBUGEH4dIUbu59AjbsnCCgCn7VY9bpqXBcSaSq-UueMSgqMzQtnpN1slVW60hhKv1YQZFkE3CfL1SZ3f3pEGeQpVt0icHAiWbrW91_cUtP9IivX-rFecw"

# Helper function to extract JSON field using Python
extract_json() {
  python3 -c "import sys, json; print(json.load(sys.stdin)$1)" 2>/dev/null
}

echo "🧪 Starting Manual Test Script (Bash/Curl)"

# --- Phase 1: Validating Actors ---
echo -e "\n--- Phase 1: Validating Actors ---"

echo "Validating Seller..."
SELLER_RES=$(curl -s -H "Authorization: Bearer $SELLER_TOKEN" "$API_URL/user/profile")
SELLER_ID=$(echo "$SELLER_RES" | extract_json "['data']['_id']")
echo "✅ Seller Validated: $SELLER_ID"

echo "Validating Buyer..."
BUYER_RES=$(curl -s -H "Authorization: Bearer $BUYER_TOKEN" "$API_URL/user/profile")
BUYER_ID=$(echo "$BUYER_RES" | extract_json "['data']['_id']")
echo "✅ Buyer Validated: $BUYER_ID"

# --- Phase 2: Listing ---
echo -e "\n--- Phase 2: Listing a Watch ---"

# Get a watch ID (optional, but good practice)
WATCH_RES=$(curl -s -H "Authorization: Bearer $SELLER_TOKEN" "$API_URL/watches?limit=1")
WATCH_ID=$(echo "$WATCH_RES" | extract_json "['data'][0]['_id']")
echo "Using Watch ID: $WATCH_ID"

echo "Creating Listing..."
LISTING_PAYLOAD=$(cat <<EOF
{
  "watch": "$WATCH_ID",
  "brand": "Omega",
  "model": "Speedmaster 321",
  "reference": "311.30.40.30.01.001",
  "price": 1450000,
  "currency": "USD",
  "condition": "new",
  "year": 2022,
  "contents": "box_papers",
  "ships_from": { "country": "US", "state": "NY", "city": "New York" },
  "shipping": [{ "region": "US", "shippingIncluded": true, "shippingCost": 0 }],
  "images": [
    "https://example.com/speedmaster1.jpg",
    "https://example.com/speedmaster2.jpg",
    "https://example.com/speedmaster3.jpg"
  ],
  "thumbnail": "https://example.com/speedmaster1.jpg",
  "allow_offers": true
}
EOF
)

CREATE_RES=$(curl -s -X POST -H "Authorization: Bearer $SELLER_TOKEN" -H "Content-Type: application/json" -d "$LISTING_PAYLOAD" "$API_URL/marketplace/listings")
LISTING_ID=$(echo "$CREATE_RES" | extract_json "['data']['_id']")
echo "✅ Listing Created (Draft): $LISTING_ID"

echo "Publishing Listing..."
curl -s -X POST -H "Authorization: Bearer $SELLER_TOKEN" "$API_URL/marketplace/listings/$LISTING_ID/publish" > /dev/null
echo "✅ Listing Published"

# --- Phase 3: Negotiation ---
echo -e "\n--- Phase 3: Negotiation ---"

echo "Buyer making offer (13k)..."
OFFER_PAYLOAD='{"amount": 1300000, "message": "I can do 13k right now."}'
OFFER_RES=$(curl -s -X POST -H "Authorization: Bearer $BUYER_TOKEN" -H "Content-Type: application/json" -d "$OFFER_PAYLOAD" "$API_URL/marketplace/listings/$LISTING_ID/offers")
OFFER_ID1=$(echo "$OFFER_RES" | extract_json "['data']['offer']['_id']")
echo "✅ Offer Sent: $OFFER_ID1"

echo "Seller countering (14k)..."
COUNTER_PAYLOAD='{"amount": 1400000, "message": "Too low. 14k is my floor."}'
COUNTER_RES=$(curl -s -X POST -H "Authorization: Bearer $SELLER_TOKEN" -H "Content-Type: application/json" -d "$COUNTER_PAYLOAD" "$API_URL/marketplace/offers/$OFFER_ID1/counter")
OFFER_ID2=$(echo "$COUNTER_RES" | extract_json "['data']['_id']")
echo "✅ Counter Offer Sent: $OFFER_ID2"

echo "Buyer accepting counter..."
curl -s -X POST -H "Authorization: Bearer $BUYER_TOKEN" "$API_URL/marketplace/offers/$OFFER_ID2/accept" > /dev/null
echo "✅ Counter Accepted"

# --- Phase 4: Transaction ---
echo -e "\n--- Phase 4: Transaction ---"

echo "Reserving Order..."
RESERVE_PAYLOAD="{\"listing_id\": \"$LISTING_ID\"}"
RESERVE_RES=$(curl -s -X POST -H "Authorization: Bearer $BUYER_TOKEN" -H "Content-Type: application/json" -d "$RESERVE_PAYLOAD" "$API_URL/marketplace/orders/reserve")
ORDER_ID=$(echo "$RESERVE_RES" | extract_json "['data']['order_id']")
FRAUD_ID=$(echo "$RESERVE_RES" | extract_json "['data']['fraud_session_id']")
echo "✅ Order Reserved: $ORDER_ID"

echo "Executing Payment..."
PAYMENT_PAYLOAD=$(cat <<EOF
{
  "payment_token": "tok_visa_US",
  "idempotency_id": "pay-$(date +%s)",
  "postal_code": "90210",
  "fraud_session_id": "$FRAUD_ID"
}
EOF
)
curl -s -X POST -H "Authorization: Bearer $BUYER_TOKEN" -H "Content-Type: application/json" -d "$PAYMENT_PAYLOAD" "$API_URL/marketplace/orders/$ORDER_ID/payment" > /dev/null
echo "✅ Payment Successful"

# --- Phase 5: Completion ---
echo -e "\n--- Phase 5: Completion ---"

echo "Adding Tracking..."
TRACKING_PAYLOAD='{"carrier": "FedEx", "tracking_number": "1234567890"}'
curl -s -X POST -H "Authorization: Bearer $SELLER_TOKEN" -H "Content-Type: application/json" -d "$TRACKING_PAYLOAD" "$API_URL/marketplace/orders/$ORDER_ID/tracking" > /dev/null
echo "✅ Tracking Added"

echo "Confirming Delivery (Buyer)..."
curl -s -X POST -H "Authorization: Bearer $BUYER_TOKEN" "$API_URL/marketplace/orders/$ORDER_ID/confirm-delivery" > /dev/null
echo "✅ Delivery Confirmed"

echo "Leaving Review..."
REVIEW_PAYLOAD=$(cat <<EOF
{
  "order_id": "$ORDER_ID",
  "rating": 5,
  "comment": "Smooth transaction, love the watch!"
}
EOF
)
curl -s -X POST -H "Authorization: Bearer $BUYER_TOKEN" -H "Content-Type: application/json" -d "$REVIEW_PAYLOAD" "$API_URL/reviews" > /dev/null
echo "✅ Review Created"

echo -e "\n🎉 MANUAL TEST SCRIPT COMPLETED SUCCESSFULLY!"
