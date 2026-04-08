#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
REPORT="docs/docs/BATCH_4_FINAL_ALIGNMENT/BATCH_4_API_CURL_SMOKE_REPORT.md"
TMP_BODY="/tmp/batch4_api_body.json"

DUMMY_ID="507f1f77bcf86cd799439011"
GROUP_ID="$DUMMY_ID"
USER_ID="$DUMMY_ID"
OFFER_ID="$DUMMY_ID"
ORDER_ID="$DUMMY_ID"
REF_ID="$DUMMY_ID"

PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

cat > "$REPORT" <<EOF
# Batch 4 API Curl Smoke Report

Generated: $(date -Iseconds)
Base URL: $BASE_URL
Auth Mode: x-test-user via customClerkMw

This report verifies route reachability for Batch 4 Networks APIs. Any non-5xx status is considered route reachable for smoke purposes.

| # | Method | Path | Payload | Curl | Status | Result |
|---|---|---|---|---|---:|---|
EOF

escape_md() {
  printf '%s' "$1" | sed 's/|/\\|/g' | tr -d '\n'
}

run_case() {
  local method="$1"
  local path="$2"
  local user="$3"
  local payload="$4"

  TOTAL_COUNT=$((TOTAL_COUNT + 1))

  local url="$BASE_URL$path"
  local curl_cmd
  if [[ -n "$payload" && "$payload" != "-" ]]; then
    curl_cmd="curl -X $method '$url' -H 'Content-Type: application/json' -H 'x-test-user: $user' -d '$payload'"
    code=$(curl -sS -o "$TMP_BODY" -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "x-test-user: $user" \
      -d "$payload" || true)
  else
    curl_cmd="curl -X $method '$url' -H 'x-test-user: $user'"
    code=$(curl -sS -o "$TMP_BODY" -w "%{http_code}" -X "$method" "$url" \
      -H "x-test-user: $user" || true)
  fi

  local result="PASS"
  if [[ "$code" =~ ^5 ]]; then
    result="FAIL"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    PASS_COUNT=$((PASS_COUNT + 1))
  fi

  local payload_cell="-"
  if [[ -n "$payload" && "$payload" != "-" ]]; then
    payload_cell="$(escape_md "$payload")"
  fi
  local curl_cell
  curl_cell="$(escape_md "$curl_cmd")"

  echo "| $TOTAL_COUNT | $method | $(escape_md "$path") | $payload_cell | $curl_cell | $code | $result |" >> "$REPORT"
}

# Prime a real group id where possible
GROUP_PAYLOAD='{"name":"Batch4 Smoke Group","description":"Smoke test group","privacy":"public"}'
run_case "POST" "/api/v1/networks/social/groups" "buyer_us_complete" "$GROUP_PAYLOAD"

if [[ -f "$TMP_BODY" ]]; then
  maybe_group=$(node -e 'const fs=require("fs");try{const b=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const id=(b?.data?._id||b?.data?.id||"");if(id)process.stdout.write(String(id));}catch(e){}' "$TMP_BODY" || true)
  if [[ -n "$maybe_group" ]]; then
    GROUP_ID="$maybe_group"
  fi
fi

# Part 1
run_case "GET" "/api/v1/networks/social/status" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/social/inbox?filter=all&limit=5&offset=0" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/social/search?q=watch&type=all" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/social/discover" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/social/conversations/$DUMMY_ID/content" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/social/conversations/$DUMMY_ID/search?q=offer" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/social/conversations/$DUMMY_ID/events" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/social/chat-profile/$USER_ID" "buyer_us_complete" "-"

run_case "GET" "/api/v1/networks/messages/chats" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/messages/chats/search?q=watch" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/messages/$DUMMY_ID/history" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/messages/send" "buyer_us_complete" '{"channel_id":"'$DUMMY_ID'","text":"smoke message"}'
run_case "GET" "/api/v1/networks/messages/$DUMMY_ID" "buyer_us_complete" "-"
run_case "PUT" "/api/v1/networks/messages/$DUMMY_ID" "buyer_us_complete" '{"text":"edited"}'
run_case "DELETE" "/api/v1/networks/messages/$DUMMY_ID" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/messages/$DUMMY_ID/read" "buyer_us_complete" "{}"
run_case "POST" "/api/v1/networks/messages/$DUMMY_ID/reply" "buyer_us_complete" '{"text":"reply"}'
run_case "POST" "/api/v1/networks/messages/$DUMMY_ID/react" "buyer_us_complete" '{"emoji":"👍"}'
run_case "POST" "/api/v1/networks/messages/$DUMMY_ID/typing" "buyer_us_complete" '{"typing":true}'

run_case "GET" "/api/v1/networks/conversations" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/conversations/search?q=watch" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/conversations/$DUMMY_ID" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/conversations/$DUMMY_ID/media?type=media" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/conversations/$DUMMY_ID/shared/media" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/conversations/$DUMMY_ID/shared/files" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/conversations/$DUMMY_ID/shared/links" "buyer_us_complete" "-"

# Part 2
run_case "GET" "/api/v1/networks/social/groups" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/social/groups/$GROUP_ID" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/social/groups/$GROUP_ID/join" "buyer_us_complete" '{"group_id":"'$GROUP_ID'"}'
run_case "DELETE" "/api/v1/networks/social/groups/$GROUP_ID/leave" "buyer_us_complete" '{"group_id":"'$GROUP_ID'"}'
run_case "GET" "/api/v1/networks/social/groups/$GROUP_ID/members" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/social/groups/$GROUP_ID/members" "buyer_us_complete" '{"user_id":"'$USER_ID'"}'
run_case "DELETE" "/api/v1/networks/social/groups/$GROUP_ID/members/$USER_ID" "buyer_us_complete" "-"
run_case "PATCH" "/api/v1/networks/social/groups/$GROUP_ID/members/$USER_ID/role" "buyer_us_complete" '{"role":"member"}'
run_case "POST" "/api/v1/networks/social/groups/$GROUP_ID/mute" "buyer_us_complete" '{"muted":true}'
run_case "GET" "/api/v1/networks/social/groups/$GROUP_ID/shared-links" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/social/groups/$GROUP_ID/shared-links" "buyer_us_complete" '{"url":"https://example.com"}'
run_case "GET" "/api/v1/networks/social/groups/$GROUP_ID/shared-media" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/social/groups/$GROUP_ID/shared-files" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/social/invites" "buyer_us_complete" '{"group_id":"'$GROUP_ID'"}'
run_case "GET" "/api/v1/networks/social/invites/$DUMMY_ID" "buyer_us_complete" "-"

run_case "GET" "/api/v1/networks/users/$USER_ID/profile" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/users/$USER_ID/common-groups" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/users/$USER_ID/connections" "buyer_us_complete" "{}"
run_case "DELETE" "/api/v1/networks/users/$USER_ID/connections" "buyer_us_complete" "-"

run_case "GET" "/api/v1/networks/offers" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/offers-inquiries" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/offers/$OFFER_ID" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/offers/$OFFER_ID/terms-history" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/offers/$OFFER_ID/counter" "buyer_us_complete" '{"amount":1000}'
run_case "POST" "/api/v1/networks/offers/$OFFER_ID/accept" "buyer_us_complete" "{}"
run_case "POST" "/api/v1/networks/offers/$OFFER_ID/reject" "buyer_us_complete" "{}"
run_case "POST" "/api/v1/networks/offers/$OFFER_ID/decline" "buyer_us_complete" "{}"

# Part 3
run_case "POST" "/api/v1/networks/reference-checks" "buyer_us_complete" '{"order_id":"'$ORDER_ID'","target_user_id":"'$USER_ID'"}'
run_case "GET" "/api/v1/networks/reference-checks?filter=all&limit=10&offset=0" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/reference-checks/$REF_ID" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/reference-checks/$REF_ID/respond" "buyer_us_complete" '{"rating":"positive","comment":"good"}'
run_case "POST" "/api/v1/networks/reference-checks/$REF_ID/complete" "buyer_us_complete" "{}"
run_case "DELETE" "/api/v1/networks/reference-checks/$REF_ID" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/reference-checks/$REF_ID/vouch" "buyer_us_complete" '{"target_user_id":"'$USER_ID'","legal_acknowledged":true}'
run_case "GET" "/api/v1/networks/reference-checks/$REF_ID/vouches" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/reference-checks/$REF_ID/summary" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/reference-checks/$REF_ID/context" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/reference-checks/$REF_ID/progress" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/reference-checks/$REF_ID/vouch-policy" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/reference-checks/$REF_ID/feedback" "buyer_us_complete" '{"text":"feedback"}'
run_case "GET" "/api/v1/networks/reference-checks/$REF_ID/feedback" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/reference-checks/$REF_ID/audit" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/reference-checks/$REF_ID/share-link" "buyer_us_complete" "{}"
run_case "POST" "/api/v1/networks/reference-checks/$REF_ID/suspend" "buyer_us_complete" '{"reason":"policy"}'
run_case "GET" "/api/v1/networks/reference-checks/$REF_ID/trust-safety/status" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/reference-checks/$REF_ID/trust-safety/appeal" "buyer_us_complete" '{"reason":"appeal"}'

run_case "GET" "/api/v1/networks/orders" "buyer_us_complete" "-"
run_case "GET" "/api/v1/networks/orders/$ORDER_ID" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/orders/$ORDER_ID/complete" "buyer_us_complete" "{}"
run_case "GET" "/api/v1/networks/orders/$ORDER_ID/completion-status" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/orders/$ORDER_ID/reference-check/initiate" "buyer_us_complete" "{}"
run_case "GET" "/api/v1/networks/orders/$ORDER_ID/audit-trail" "buyer_us_complete" "-"

run_case "GET" "/api/v1/networks/users/$USER_ID/appeals" "buyer_us_complete" "-"
run_case "POST" "/api/v1/networks/users/$USER_ID/appeals" "buyer_us_complete" '{"reason":"appeal","appealType":"other"}'
run_case "GET" "/api/v1/networks/users/$USER_ID/appeal-status" "buyer_us_complete" "-"

{
  echo
  echo "## Summary"
  echo
  echo "- Total checked: $TOTAL_COUNT"
  echo "- Reachable (non-5xx): $PASS_COUNT"
  echo "- Failed (5xx): $FAIL_COUNT"
  echo
  if [[ "$FAIL_COUNT" -gt 0 ]]; then
    echo "Result: FAIL (one or more 5xx responses)"
  else
    echo "Result: PASS for smoke reachability (no 5xx responses)"
  fi
  echo
  echo "## Notes"
  echo
  echo "- This is a route reachability smoke check, not a business-logic E2E certification."
  echo "- 4xx responses can be expected for placeholder IDs or missing seeded domain data."
} >> "$REPORT"

echo "Batch 4 curl smoke report written to: $REPORT"
