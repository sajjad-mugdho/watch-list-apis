#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5050}"
IDS_FILE="scripts/batch4_real_ids.json"
REPORT="docs/docs/BATCH_4_FINAL_ALIGNMENT/BATCH_4_API_FUNCTIONAL_REPORT.md"

if [[ ! -f "$IDS_FILE" ]]; then
  echo "Error: $IDS_FILE not found. Run batch4_fetch_real_ids.sh first."
  exit 1
fi

# Load IDs from file
IDS_JSON=$(cat "$IDS_FILE")

SELLER_UID=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).seller.user_id || '')" 2>/dev/null || true)
SELLER_GID=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).seller.group_id || '')" 2>/dev/null || true)
SELLER_CID=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).seller.conversation_id || '')" 2>/dev/null || true)
SELLER_OID=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).seller.offer_id || '')" 2>/dev/null || true)
SELLER_ORDERID=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).seller.order_id || '')" 2>/dev/null || true)
SELLER_REFID=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).seller.reference_check_id || '')" 2>/dev/null || true)
SELLER_TOKEN=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).seller.token || '')" 2>/dev/null || true)

BUYER_UID=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).buyer.user_id || '')" 2>/dev/null || true)
BUYER_GID=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).buyer.group_id || '')" 2>/dev/null || true)
BUYER_CID=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).buyer.conversation_id || '')" 2>/dev/null || true)
BUYER_OID=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).buyer.offer_id || '')" 2>/dev/null || true)
BUYER_ORDERID=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).buyer.order_id || '')" 2>/dev/null || true)
BUYER_REFID=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).buyer.reference_check_id || '')" 2>/dev/null || true)
BUYER_TOKEN=$(echo "$IDS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).buyer.token || '')" 2>/dev/null || true)

PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

mkdir -p "$(dirname "$REPORT")"

cat > "$REPORT" <<EOF
# Batch 4 API Functional Report (Real IDs)

Generated: $(date -Iseconds)
Base URL: $BASE_URL
Auth Mode: Bearer JWT tokens (production)

This report tests Batch 4 Networks APIs using real IDs fetched from production.

## Real IDs Used

**Seller:**
- user_id: $SELLER_UID
- group_id: $SELLER_GID
- conversation_id: $SELLER_CID
- offer_id: $SELLER_OID
- order_id: $SELLER_ORDERID
- reference_check_id: $SELLER_REFID

**Buyer:**
- user_id: $BUYER_UID
- group_id: $BUYER_GID
- conversation_id: $BUYER_CID
- offer_id: $BUYER_OID
- order_id: $BUYER_ORDERID
- reference_check_id: $BUYER_REFID

## Test Results

| # | Method | Path | Auth | Status | Result |
|---|---|---|---|---:|---|
EOF

run_case() {
  local method="$1"
  local path="$2"
  local token="$3"
  local payload="$4"

  TOTAL_COUNT=$((TOTAL_COUNT + 1))

  local url="$BASE_URL$path"
  if [[ -n "$payload" && "$payload" != "-" ]]; then
    code=$(curl -sS -o /dev/null -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      -d "$payload" || true)
  else
    code=$(curl -sS -o /dev/null -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $token" || true)
  fi

  local result="PASS"
  if [[ "$code" =~ ^5 ]]; then
    result="FAIL"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    PASS_COUNT=$((PASS_COUNT + 1))
  fi

  local auth_label="seller"
  if [[ "$token" == "$BUYER_TOKEN" ]]; then auth_label="buyer"; fi

  echo "| $TOTAL_COUNT | $method | $path | $auth_label | $code | $result |" >> "$REPORT"
}

# Test with seller token and IDs
run_case "POST" "/api/v1/networks/social/groups" "$SELLER_TOKEN" '{"name":"Real Test Group","description":"Testing","privacy":"public"}'
run_case "GET" "/api/v1/networks/social/status" "$SELLER_TOKEN" "-"
run_case "GET" "/api/v1/networks/social/inbox?filter=all&limit=5&offset=0" "$SELLER_TOKEN" "-"
run_case "GET" "/api/v1/networks/social/search?q=watch&type=all" "$SELLER_TOKEN" "-"
run_case "GET" "/api/v1/networks/social/discover" "$SELLER_TOKEN" "-"

if [[ -n "$SELLER_CID" ]]; then
  run_case "GET" "/api/v1/networks/social/conversations/$SELLER_CID/content" "$SELLER_TOKEN" "-"
  run_case "GET" "/api/v1/networks/social/conversations/$SELLER_CID/search?q=offer" "$SELLER_TOKEN" "-"
  run_case "GET" "/api/v1/networks/social/conversations/$SELLER_CID/events" "$SELLER_TOKEN" "-"
fi

run_case "GET" "/api/v1/networks/messages/chats" "$SELLER_TOKEN" "-"
run_case "GET" "/api/v1/networks/messages/chats/search?q=watch" "$SELLER_TOKEN" "-"

if [[ -n "$SELLER_CID" ]]; then
  run_case "GET" "/api/v1/networks/messages/$SELLER_CID/history" "$SELLER_TOKEN" "-"
  run_case "POST" "/api/v1/networks/messages/send" "$SELLER_TOKEN" '{"channel_id":"'$SELLER_CID'","text":"test message"}'
fi

run_case "GET" "/api/v1/networks/conversations" "$SELLER_TOKEN" "-"
run_case "GET" "/api/v1/networks/conversations/search?q=watch" "$SELLER_TOKEN" "-"

if [[ -n "$SELLER_CID" ]]; then
  run_case "GET" "/api/v1/networks/conversations/$SELLER_CID" "$SELLER_TOKEN" "-"
  run_case "GET" "/api/v1/networks/conversations/$SELLER_CID/media?type=media" "$SELLER_TOKEN" "-"
  run_case "GET" "/api/v1/networks/conversations/$SELLER_CID/shared/media" "$SELLER_TOKEN" "-"
  run_case "GET" "/api/v1/networks/conversations/$SELLER_CID/shared/files" "$SELLER_TOKEN" "-"
  run_case "GET" "/api/v1/networks/conversations/$SELLER_CID/shared/links" "$SELLER_TOKEN" "-"
fi

run_case "GET" "/api/v1/networks/social/groups" "$SELLER_TOKEN" "-"

if [[ -n "$SELLER_GID" ]]; then
  run_case "GET" "/api/v1/networks/social/groups/$SELLER_GID" "$SELLER_TOKEN" "-"
  run_case "POST" "/api/v1/networks/social/groups/$SELLER_GID/join" "$SELLER_TOKEN" '{"group_id":"'$SELLER_GID'"}'
  run_case "DELETE" "/api/v1/networks/social/groups/$SELLER_GID/leave" "$SELLER_TOKEN" '{"group_id":"'$SELLER_GID'"}'
  run_case "GET" "/api/v1/networks/social/groups/$SELLER_GID/members" "$SELLER_TOKEN" "-"
  run_case "GET" "/api/v1/networks/social/groups/$SELLER_GID/shared-links" "$SELLER_TOKEN" "-"
  run_case "POST" "/api/v1/networks/social/groups/$SELLER_GID/shared-links" "$SELLER_TOKEN" '{"url":"https://example.com"}'
  run_case "GET" "/api/v1/networks/social/groups/$SELLER_GID/shared-media" "$SELLER_TOKEN" "-"
  run_case "GET" "/api/v1/networks/social/groups/$SELLER_GID/shared-files" "$SELLER_TOKEN" "-"
fi

run_case "POST" "/api/v1/networks/social/invites" "$SELLER_TOKEN" '{"group_id":"'$SELLER_GID'"}'

if [[ -n "$SELLER_UID" ]]; then
  run_case "GET" "/api/v1/networks/users/$SELLER_UID/profile" "$SELLER_TOKEN" "-"
  run_case "GET" "/api/v1/networks/users/$SELLER_UID/common-groups" "$SELLER_TOKEN" "-"
  run_case "POST" "/api/v1/networks/users/$SELLER_UID/connections" "$SELLER_TOKEN" "{}"
fi

run_case "GET" "/api/v1/networks/offers" "$SELLER_TOKEN" "-"
run_case "GET" "/api/v1/networks/offers-inquiries" "$SELLER_TOKEN" "-"

if [[ -n "$SELLER_OID" ]]; then
  run_case "GET" "/api/v1/networks/offers/$SELLER_OID" "$SELLER_TOKEN" "-"
  run_case "GET" "/api/v1/networks/offers/$SELLER_OID/terms-history" "$SELLER_TOKEN" "-"
  run_case "POST" "/api/v1/networks/offers/$SELLER_OID/counter" "$SELLER_TOKEN" '{"amount":1000}'
  run_case "POST" "/api/v1/networks/offers/$SELLER_OID/accept" "$SELLER_TOKEN" "{}"
  run_case "POST" "/api/v1/networks/offers/$SELLER_OID/reject" "$SELLER_TOKEN" "{}"
fi

run_case "POST" "/api/v1/networks/reference-checks" "$SELLER_TOKEN" '{"order_id":"'$SELLER_ORDERID'","target_user_id":"'$BUYER_UID'"}'
run_case "GET" "/api/v1/networks/reference-checks?filter=all&limit=10&offset=0" "$SELLER_TOKEN" "-"

if [[ -n "$SELLER_REFID" ]]; then
  run_case "GET" "/api/v1/networks/reference-checks/$SELLER_REFID" "$SELLER_TOKEN" "-"
  run_case "POST" "/api/v1/networks/reference-checks/$SELLER_REFID/respond" "$SELLER_TOKEN" '{"rating":"positive","comment":"good"}'
  run_case "POST" "/api/v1/networks/reference-checks/$SELLER_REFID/complete" "$SELLER_TOKEN" "{}"
  run_case "GET" "/api/v1/networks/reference-checks/$SELLER_REFID/summary" "$SELLER_TOKEN" "-"
  run_case "GET" "/api/v1/networks/reference-checks/$SELLER_REFID/vouches" "$SELLER_TOKEN" "-"
  run_case "GET" "/api/v1/networks/reference-checks/$SELLER_REFID/feedback" "$SELLER_TOKEN" "-"
fi

run_case "GET" "/api/v1/networks/orders" "$SELLER_TOKEN" "-"

if [[ -n "$SELLER_ORDERID" ]]; then
  run_case "GET" "/api/v1/networks/orders/$SELLER_ORDERID" "$SELLER_TOKEN" "-"
  run_case "POST" "/api/v1/networks/orders/$SELLER_ORDERID/complete" "$SELLER_TOKEN" "{}"
  run_case "GET" "/api/v1/networks/orders/$SELLER_ORDERID/completion-status" "$SELLER_TOKEN" "-"
  run_case "POST" "/api/v1/networks/orders/$SELLER_ORDERID/reference-check/initiate" "$SELLER_TOKEN" "{}"
  run_case "GET" "/api/v1/networks/orders/$SELLER_ORDERID/audit-trail" "$SELLER_TOKEN" "-"
fi

# Test with buyer token
run_case "GET" "/api/v1/networks/social/status" "$BUYER_TOKEN" "-"
run_case "GET" "/api/v1/networks/messages/chats" "$BUYER_TOKEN" "-"
run_case "GET" "/api/v1/networks/conversations" "$BUYER_TOKEN" "-"
run_case "GET" "/api/v1/networks/social/groups" "$BUYER_TOKEN" "-"

if [[ -n "$BUYER_GID" ]]; then
  run_case "GET" "/api/v1/networks/social/groups/$BUYER_GID" "$BUYER_TOKEN" "-"
  run_case "POST" "/api/v1/networks/social/groups/$BUYER_GID/join" "$BUYER_TOKEN" '{"group_id":"'$BUYER_GID'"}'
fi

run_case "GET" "/api/v1/networks/offers" "$BUYER_TOKEN" "-"
run_case "GET" "/api/v1/networks/reference-checks?filter=all&limit=10&offset=0" "$BUYER_TOKEN" "-"
run_case "GET" "/api/v1/networks/orders" "$BUYER_TOKEN" "-"

if [[ -n "$BUYER_UID" ]]; then
  run_case "GET" "/api/v1/networks/users/$BUYER_UID/profile" "$BUYER_TOKEN" "-"
  run_case "GET" "/api/v1/networks/users/$BUYER_UID/common-groups" "$BUYER_TOKEN" "-"
fi

{
  echo
  echo "## Summary"
  echo
  echo "- Total tested: $TOTAL_COUNT"
  echo "- Passed (non-5xx): $PASS_COUNT"
  echo "- Failed (5xx): $FAIL_COUNT"
  echo
  if [[ "$FAIL_COUNT" -gt 0 ]]; then
    echo "**Result: FAIL** - $FAIL_COUNT endpoints returned 5xx errors"
  else
    echo "**Result: PASS** - All endpoints reachable (no 5xx errors with real IDs)"
  fi
} >> "$REPORT"

echo "Functional report written to: $REPORT"
cat "$REPORT"
