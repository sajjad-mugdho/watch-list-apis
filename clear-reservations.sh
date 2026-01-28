#!/bin/bash

# ⚠️ DEV UTILITY - Clear All Reservations
# This script calls the temporary dev endpoint to clear all active reservations

API_URL="${API_URL:-http://localhost:5050}"

echo "🧹 Clearing all reservations..."
echo "API: $API_URL"
echo ""

response=$(curl -s -X POST "$API_URL/api/v1/marketplace/orders/dev/clear-reservations" \
  -H "Content-Type: application/json")

echo "Response:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"

echo ""
echo "✅ Done!"
