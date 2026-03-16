# Networks API curl Commands

This document contains a comprehensive set of testable cURL commands for the Networks module of the Dialist API, covering GET, POST, PATCH, PUT, and DELETE routes. 
These commands are intended to run against a locally running server (`http://localhost:5050`) using the mock user authentication system.

**IMPORTANT:** Before running these, ensure the server is running (`npm run dev`).

## Base URL
```bash
export API_URL="http://localhost:5050/api/v1"
```

## Mock Users
Use the `x-test-user` header for auth.
- `buyer_us_complete`: A mock user acting as the requester/buyer.
- `merchant_approved`: A mock user acting as the target/seller.

---

## 1. Networks User

### Get Current User Profile (Networks format)
```bash
curl -X GET "$API_URL/networks/user" \
  -H "x-test-user: buyer_us_complete"
```

### Get Current User Inventory (Listings)
```bash
curl -X GET "$API_URL/networks/user/listings" \
  -H "x-test-user: merchant_approved"
```

---

## 2. Networks Listings

### Get Public Network Listings
```bash
curl -X GET "$API_URL/networks/listings?limit=10" \
  -H "x-test-user: buyer_us_complete"
```

### Search Networks Listings
```bash
curl -X GET "$API_URL/networks/listings?q=rolex" \
  -H "x-test-user: buyer_us_complete"
```

### Create a Network Listing
```bash
curl -X POST "$API_URL/networks/listings" \
  -H "x-test-user: merchant_approved" \
  -H "Content-Type: application/json" \
  -d '{
    "watch": "WATCH_ID_HERE",
    "price": 10500,
    "condition": "like-new",
    "year": 2022,
    "contents": "box_papers",
    "allow_offers": true,
    "shipping": [
      { "region": "US", "shippingIncluded": true, "shippingCost": 0 }
    ]
  }'
```

### Update a Network Listing
```bash
curl -X PATCH "$API_URL/networks/listings/LISTING_ID" \
  -H "x-test-user: merchant_approved" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 10000
  }'
```

### Publish a Network Listing
```bash
curl -X POST "$API_URL/networks/listings/LISTING_ID/publish" \
  -H "x-test-user: merchant_approved"
```

### Get Offers for a Listing
```bash
curl -X GET "$API_URL/networks/listings/LISTING_ID/offers" \
  -H "x-test-user: merchant_approved"
```

### Make an Offer on a Listing (Initial)
```bash
curl -X POST "$API_URL/networks/listings/LISTING_ID/offers" \
  -H "x-test-user: buyer_us_complete" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 9500,
    "currency": "USD"
  }'
```

### Inquire on a Listing
```bash
curl -X POST "$API_URL/networks/listings/LISTING_ID/inquire" \
  -H "x-test-user: buyer_us_complete" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Is this still available?"
  }'
```

---

## 3. Networks Offers

### List User Offers
```bash
curl -X GET "$API_URL/networks/offers?type=sent" \
  -H "x-test-user: buyer_us_complete"
```

### Get Specific Offer
```bash
curl -X GET "$API_URL/networks/offers/OFFER_ID" \
  -H "x-test-user: buyer_us_complete"
```

### Accept an Offer
```bash
curl -X POST "$API_URL/networks/offers/OFFER_ID/accept" \
  -H "x-test-user: merchant_approved"
```

### Reject an Offer
```bash
curl -X POST "$API_URL/networks/offers/OFFER_ID/reject" \
  -H "x-test-user: merchant_approved"
```

### Counter an Offer
```bash
curl -X POST "$API_URL/networks/offers/OFFER_ID/counter" \
  -H "x-test-user: merchant_approved" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 9800,
    "note": "Lowest I can go"
  }'
```

---

## 4. Networks Reference Checks

### Request a Reference Check
```bash
curl -X POST "$API_URL/networks/reference-checks" \
  -H "x-test-user: buyer_us_complete" \
  -H "Content-Type: application/json" \
  -d '{
    "target_id": "TARGET_USER_ID",
    "order_id": "ORDER_ID",
    "reason": "Requesting reference for recent transaction"
  }'
```

### List Reference Checks
```bash
curl -X GET "$API_URL/networks/reference-checks" \
  -H "x-test-user: buyer_us_complete"
```

### Get Specific Reference Check
```bash
curl -X GET "$API_URL/networks/reference-checks/REFERENCE_CHECK_ID" \
  -H "x-test-user: buyer_us_complete"
```

### Respond to a Reference Check
```bash
curl -X POST "$API_URL/networks/reference-checks/REFERENCE_CHECK_ID/respond" \
  -H "x-test-user: merchant_approved" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": "positive",
    "comment": "Great buyer, highly recommended",
    "is_anonymous": false
  }'
```

### Complete Reference Check
```bash
curl -X POST "$API_URL/networks/reference-checks/REFERENCE_CHECK_ID/complete" \
  -H "x-test-user: buyer_us_complete"
```

### Delete a Reference Check
```bash
curl -X DELETE "$API_URL/networks/reference-checks/REFERENCE_CHECK_ID" \
  -H "x-test-user: buyer_us_complete"
```

### Add a Vouch to a Reference Check
```bash
curl -X POST "$API_URL/networks/reference-checks/REFERENCE_CHECK_ID/vouch" \
  -H "x-test-user: merchant_approved" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Yes, this transaction was smooth."
  }'
```

### Get Vouches for a Reference Check
```bash
curl -X GET "$API_URL/networks/reference-checks/REFERENCE_CHECK_ID/vouches" \
  -H "x-test-user: buyer_us_complete"
```

---

## 5. Networks Chat

### Get Chat Token
```bash
curl -X GET "$API_URL/networks/chat/token" \
  -H "x-test-user: buyer_us_complete"
```

### Get Chat Channels Overview
```bash
curl -X GET "$API_URL/networks/chat/channels" \
  -H "x-test-user: buyer_us_complete"
```

### Get Unread Counts
```bash
curl -X GET "$API_URL/networks/chat/unread" \
  -H "x-test-user: buyer_us_complete"
```

### Get/Create Chat Channel
```bash
curl -X POST "$API_URL/networks/chat/channel" \
  -H "x-test-user: buyer_us_complete" \
  -H "Content-Type: application/json" \
  -d '{
    "target_user_id": "MERCHANT_USER_ID",
    "listing_id": "LISTING_ID" 
  }'
```

---

## 6. Networks Conversations

### List Conversations
```bash
curl -X GET "$API_URL/networks/conversations" \
  -H "x-test-user: buyer_us_complete"
```

### Search Conversations
```bash
curl -X GET "$API_URL/networks/conversations/search?q=Rolex" \
  -H "x-test-user: buyer_us_complete"
```

### Get Conversation Context
```bash
curl -X GET "$API_URL/networks/conversations/CONV_ID" \
  -H "x-test-user: buyer_us_complete"
```

### Get Conversation Media
```bash
curl -X GET "$API_URL/networks/conversations/CONV_ID/media" \
  -H "x-test-user: buyer_us_complete"
```

---

## 7. Networks Messages

### Send a Message
```bash
curl -X POST "$API_URL/networks/messages/send" \
  -H "x-test-user: buyer_us_complete" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "GETSTREAM_CHANNEL_ID",
    "text": "Hello, is this available?"
  }'
```

### Get Channel Messages
```bash
curl -X GET "$API_URL/networks/messages/channel/GETSTREAM_CHANNEL_ID" \
  -H "x-test-user: buyer_us_complete"
```

### Update a Message
```bash
curl -X PUT "$API_URL/networks/messages/MESSAGE_ID" \
  -H "x-test-user: buyer_us_complete" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Corrected message text"
  }'
```

### Delete a Message
```bash
curl -X DELETE "$API_URL/networks/messages/MESSAGE_ID" \
  -H "x-test-user: buyer_us_complete"
```

### Mark Message as Read
```bash
curl -X POST "$API_URL/networks/messages/MESSAGE_ID/read" \
  -H "x-test-user: buyer_us_complete"
```

### Mark All as Read in Channel
```bash
curl -X POST "$API_URL/networks/messages/channel/GETSTREAM_CHANNEL_ID/read-all" \
  -H "x-test-user: buyer_us_complete"
```

### React to a Message
```bash
curl -X POST "$API_URL/networks/messages/MESSAGE_ID/react" \
  -H "x-test-user: buyer_us_complete" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "like"
  }'
```

### Archive a Channel
```bash
curl -X POST "$API_URL/networks/messages/channel/GETSTREAM_CHANNEL_ID/archive" \
  -H "x-test-user: buyer_us_complete"
```
