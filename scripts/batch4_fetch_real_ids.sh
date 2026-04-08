#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5050}"
SELLER_TOKEN="${SELLER_TOKEN:-}"
BUYER_TOKEN="${BUYER_TOKEN:-}"
IDS_FILE="scripts/batch4_real_ids.json"

if [[ -z "$SELLER_TOKEN" || -z "$BUYER_TOKEN" ]]; then
  echo "Error: SELLER_TOKEN and BUYER_TOKEN environment variables required"
  exit 1
fi

mkdir -p "$(dirname "$IDS_FILE")"

echo "Fetching real IDs from production APIs..."

# Helper function to extract nested ID from JSON
extract_id() {
  local json="$1"
  local id=$(echo "$json" | node -e "try{const b=JSON.parse(require('fs').readFileSync(0,'utf8'));const id=(b?.data?._id||b?.data?.id||b?._id||b?.id||'');console.log(String(id));}catch(e){console.log('')}" 2>/dev/null || true)
  echo "$id"
}

# Function to fetch data and extract ID
fetch_and_extract() {
  local method="$1"
  local path="$2"
  local token="$3"
  local payload="$4"
  
  if [[ -n "$payload" && "$payload" != "-" ]]; then
    curl -sS -X "$method" "$BASE_URL$path" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$payload" 2>/dev/null || echo "{}"
  else
    curl -sS -X "$method" "$BASE_URL$path" \
      -H "Authorization: Bearer $token" 2>/dev/null || echo "{}"
  fi
}

# Fetch seller IDs
echo "Fetching seller IDs..."
seller_user=$(fetch_and_extract "POST" "/api/v1/networks/users/me" "$SELLER_TOKEN" "{}")
SELLER_UID=$(echo "$seller_user" | node -e "const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?._id||b?.data?.id||'')" 2>/dev/null || true)

seller_groups=$(fetch_and_extract "GET" "/api/v1/networks/social/groups?limit=1" "$SELLER_TOKEN" "-")
SELLER_GID=$(echo "$seller_groups" | node -e "const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?.[0]?._id||b?.data?.[0]?.id||'')" 2>/dev/null || true)

seller_convs=$(fetch_and_extract "GET" "/api/v1/networks/conversations?limit=1" "$SELLER_TOKEN" "-")
SELLER_CID=$(echo "$seller_convs" | node -e "const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?.[0]?._id||b?.data?.[0]?.id||'')" 2>/dev/null || true)

seller_offers=$(fetch_and_extract "GET" "/api/v1/networks/offers?limit=1" "$SELLER_TOKEN" "-")
SELLER_OID=$(echo "$seller_offers" | node -e "const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?.[0]?._id||b?.data?.[0]?.id||'')" 2>/dev/null || true)

seller_orders=$(fetch_and_extract "GET" "/api/v1/networks/orders?limit=1" "$SELLER_TOKEN" "-")
SELLER_ORDERID=$(echo "$seller_orders" | node -e "const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?.[0]?._id||b?.data?.[0]?.id||'')" 2>/dev/null || true)

seller_refs=$(fetch_and_extract "GET" "/api/v1/networks/reference-checks?filter=all&limit=1" "$SELLER_TOKEN" "-")
SELLER_REFID=$(echo "$seller_refs" | node -e "const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?.[0]?._id||b?.data?.[0]?.id||'')" 2>/dev/null || true)

# Fetch buyer IDs
echo "Fetching buyer IDs..."
buyer_user=$(fetch_and_extract "POST" "/api/v1/networks/users/me" "$BUYER_TOKEN" "{}")
BUYER_UID=$(echo "$buyer_user" | node -e "const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?._id||b?.data?.id||'')" 2>/dev/null || true)

buyer_groups=$(fetch_and_extract "GET" "/api/v1/networks/social/groups?limit=1" "$BUYER_TOKEN" "-")
BUYER_GID=$(echo "$buyer_groups" | node -e "const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?.[0]?._id||b?.data?.[0]?.id||'')" 2>/dev/null || true)

buyer_convs=$(fetch_and_extract "GET" "/api/v1/networks/conversations?limit=1" "$BUYER_TOKEN" "-")
BUYER_CID=$(echo "$buyer_convs" | node -e "const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?.[0]?._id||b?.data?.[0]?.id||'')" 2>/dev/null || true)

buyer_offers=$(fetch_and_extract "GET" "/api/v1/networks/offers?limit=1" "$BUYER_TOKEN" "-")
BUYER_OID=$(echo "$buyer_offers" | node -e "const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?.[0]?._id||b?.data?.[0]?.id||'')" 2>/dev/null || true)

buyer_orders=$(fetch_and_extract "GET" "/api/v1/networks/orders?limit=1" "$BUYER_TOKEN" "-")
BUYER_ORDERID=$(echo "$buyer_orders" | node -e "const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?.[0]?._id||b?.data?.[0]?.id||'')" 2>/dev/null || true)

buyer_refs=$(fetch_and_extract "GET" "/api/v1/networks/reference-checks?filter=all&limit=1" "$BUYER_TOKEN" "-")
BUYER_REFID=$(echo "$buyer_refs" | node -e "const b=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(b?.data?.[0]?._id||b?.data?.[0]?.id||'')" 2>/dev/null || true)

# Write persisted IDs file
node << NODESCRIPT
const fs = require('fs');
const ids = {
  seller: {
    token: "$SELLER_TOKEN",
    user_id: "$SELLER_UID",
    group_id: "$SELLER_GID",
    conversation_id: "$SELLER_CID",
    offer_id: "$SELLER_OID",
    order_id: "$SELLER_ORDERID",
    reference_check_id: "$SELLER_REFID"
  },
  buyer: {
    token: "$BUYER_TOKEN",
    user_id: "$BUYER_UID",
    group_id: "$BUYER_GID",
    conversation_id: "$BUYER_CID",
    offer_id: "$BUYER_OID",
    order_id: "$BUYER_ORDERID",
    reference_check_id: "$BUYER_REFID"
  }
};
fs.writeFileSync("$IDS_FILE", JSON.stringify(ids, null, 2));
console.log('IDs written to ' + "$IDS_FILE");
NODESCRIPT

echo "Real IDs persisted to: $IDS_FILE"
cat "$IDS_FILE"
