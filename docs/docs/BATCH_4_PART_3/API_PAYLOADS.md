# Batch 4 Part 3 API Payloads

Date: April 6, 2026
Purpose: Request/response examples for negotiation and reference check flows

---

## 1. Offer Details and Terms History

### GET /networks/offers/:offerId/details

```http
GET /networks/offers/ofr_8821/details
Authorization: Bearer {token}
x-request-id: {uuid}
```

```json
{
  "data": {
    "offer_id": "ofr_8821",
    "status": "pending",
    "listing_snapshot": {
      "listing_id": "lst_120",
      "title": "Audemars Piguet Royal Oak",
      "reference_no": "15500ST.OO.1220ST.01",
      "description": "Excellent condition with minimal wear",
      "thumbnail_url": "https://cdn.example/listing.jpg",
      "price": 52000,
      "currency": "USD"
    },
    "seller": {
      "user_id": "usr_10",
      "display_name": "John Dealer",
      "verified": true,
      "rating": 4.9,
      "reviews_count": 147
    },
    "current_offer": {
      "amount": 48500,
      "currency": "USD",
      "expires_at": "2026-04-07T12:00:00Z"
    },
    "shipping_country": "US",
    "reservation_terms": {
      "current_version": 3,
      "current_text": "Buyer agrees to pay the full amount online through ChronoTrust within 24 hours.",
      "has_previous": true
    }
  },
  "requestId": "uuid"
}
```

### GET /networks/offers/:offerId/terms-history

```http
GET /networks/offers/ofr_8821/terms-history
Authorization: Bearer {token}
```

```json
{
  "data": {
    "offer_id": "ofr_8821",
    "versions": [
      {
        "version": 3,
        "terms_text": "Buyer agrees to pay the full amount online through ChronoTrust within 24 hours.",
        "changed_by": "usr_10",
        "changed_at": "2026-04-06T08:10:00Z"
      },
      {
        "version": 2,
        "terms_text": "Payment within 48h and insured shipping.",
        "changed_by": "usr_10",
        "changed_at": "2026-04-05T19:00:00Z"
      }
    ]
  },
  "requestId": "uuid"
}
```

---

## 2. Counter Offer Submission

### POST /networks/offers/:offerId/counter

```http
POST /networks/offers/ofr_8821/counter
Authorization: Bearer {token}
Content-Type: application/json
x-idempotency-key: 98d18a02-6ad9-4d76-84de-1ce6f3b22d14

{
  "amount": 50000,
  "currency": "USD",
  "reservation_terms": "Buyer agrees to pay the full amount online through ChronoTrust within 24 hours. Local pickup only.",
  "note": "Can meet in the middle if completed today."
}
```

```json
{
  "data": {
    "counter_offer_id": "cof_9001",
    "offer_id": "ofr_8821",
    "status": "counter_sent",
    "amount": 50000,
    "currency": "USD",
    "delta_from_current": 1500,
    "binding_expires_at": "2026-04-07T12:15:00Z",
    "terms_version": 4,
    "created_at": "2026-04-06T12:15:00Z"
  },
  "requestId": "uuid"
}
```

---

## 3. Accept/Decline Offer

### POST /networks/offers/:offerId/accept

```http
POST /networks/offers/ofr_8821/accept
Authorization: Bearer {token}
```

```json
{
  "data": {
    "offer_id": "ofr_8821",
    "status": "accepted",
    "accepted_at": "2026-04-06T12:20:00Z",
    "order_id": "ord_1101",
    "reference_check_id": "rchk_8821"
  },
  "requestId": "uuid"
}
```

### POST /networks/offers/:offerId/decline

```http
POST /networks/offers/ofr_8821/decline
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "terms_not_acceptable"
}
```

```json
{
  "data": {
    "offer_id": "ofr_8821",
    "status": "declined",
    "declined_at": "2026-04-06T12:23:00Z",
    "reason": "terms_not_acceptable"
  },
  "requestId": "uuid"
}
```

---

## 4. Reference Checks Feed

### GET /networks/reference-checks

```http
GET /networks/reference-checks?filter=all&query=&limit=20&offset=0
Authorization: Bearer {token}
```

```json
{
  "data": {
    "items": [
      {
        "check_id": "rchk_8821",
        "status": "active",
        "transaction_value": 6200,
        "currency": "USD",
        "time_left_seconds": 82800,
        "seller": {
          "user_id": "usr_21",
          "display_name": "Michael Lammens",
          "vouches": 42,
          "avatar_url": "https://cdn.../michael.jpg"
        },
        "buyer": {
          "user_id": "usr_22",
          "display_name": "Sarah Kim",
          "vouches": 12,
          "avatar_url": "https://cdn.../sarah.jpg"
        },
        "community_vouches": 8,
        "comments_count": 3
      },
      {
        "check_id": "rchk_8740",
        "status": "completed",
        "transaction_value": 100500,
        "currency": "USD",
        "seller": {
          "display_name": "David Chen",
          "vouches": 156
        },
        "buyer": {
          "display_name": "You",
          "vouches": 5
        },
        "community_vouches": 24,
        "comments_count": 12
      }
    ],
    "total": 3,
    "counts": {
      "active": 2,
      "completed": 1
    }
  },
  "requestId": "uuid"
}
```

---

## 5. Reference Check Detail

### GET /networks/reference-checks/:checkId

```http
GET /networks/reference-checks/rchk_8821
Authorization: Bearer {token}
```

```json
{
  "data": {
    "check_id": "rchk_8821",
    "ref_code": "#8821",
    "status": "active",
    "expires_at": "2026-04-07T12:00:00Z",
    "transaction_value": 6200,
    "currency": "USD",
    "seller": {
      "user_id": "usr_21",
      "display_name": "Michael L.",
      "vouches": 42,
      "avatar_url": "https://cdn.../m.jpg"
    },
    "buyer": {
      "user_id": "usr_22",
      "display_name": "Sarah K.",
      "vouches": 12,
      "avatar_url": "https://cdn.../s.jpg"
    },
    "reservation_terms_snapshot": "Buyer agrees to pay the full amount online through ChronoTrust within 24 hours.",
    "policy": {
      "title": "Important Info & Actions",
      "items": [
        "By vouching, you become part of the transaction within the Dialist community.",
        "Vouching is not a like or review.",
        "You are required to uphold Dialist integrity standards."
      ]
    },
    "completion": {
      "buyer_confirmed": false,
      "seller_confirmed": false,
      "can_confirm_current_user": true
    }
  },
  "requestId": "uuid"
}
```

### GET /networks/reference-checks/:checkId/feedback

```http
GET /networks/reference-checks/rchk_8821/feedback?limit=20&offset=0
Authorization: Bearer {token}
```

```json
{
  "data": {
    "items": [
      {
        "feedback_id": "fb_1",
        "author": {
          "user_id": "usr_31",
          "display_name": "James Wilson",
          "avatar_url": "https://cdn.../j.jpg"
        },
        "vouch_tag": "vouched_for_seller",
        "message": "I've done multiple deals with Michael. Always smooth and accurate.",
        "created_at": "2026-04-06T10:00:00Z"
      },
      {
        "feedback_id": "fb_2",
        "author": {
          "user_id": "usr_40",
          "display_name": "Ricky K.",
          "avatar_url": null
        },
        "vouch_tag": null,
        "message": "Is this the same watch listed on the forums last week?",
        "created_at": "2026-04-06T07:00:00Z"
      }
    ],
    "total": 8
  },
  "requestId": "uuid"
}
```

---

## 6. Vouch, Comment, Complete

### POST /networks/reference-checks/:checkId/vouches

```http
POST /networks/reference-checks/rchk_8821/vouches
Authorization: Bearer {token}
Content-Type: application/json

{
  "target_user_id": "usr_21",
  "reason": "Accurate descriptions and consistent communication"
}
```

```json
{
  "data": {
    "vouch_id": "vch_501",
    "check_id": "rchk_8821",
    "target_user_id": "usr_21",
    "created_at": "2026-04-06T12:40:00Z",
    "updated_vouch_count_for_target": 43
  },
  "requestId": "uuid"
}
```

### POST /networks/reference-checks/:checkId/feedback

```http
POST /networks/reference-checks/rchk_8821/feedback
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "Please confirm serial and original invoice details."
}
```

```json
{
  "data": {
    "feedback_id": "fb_30",
    "check_id": "rchk_8821",
    "created_at": "2026-04-06T12:44:00Z"
  },
  "requestId": "uuid"
}
```

### POST /networks/reference-checks/:checkId/confirm-complete

```http
POST /networks/reference-checks/rchk_8821/confirm-complete
Authorization: Bearer {token}
```

```json
{
  "data": {
    "check_id": "rchk_8821",
    "status": "active",
    "completion": {
      "buyer_confirmed": true,
      "seller_confirmed": false,
      "completed": false
    },
    "message": "Waiting for partner confirmation"
  },
  "requestId": "uuid"
}
```

Final confirmation response:

```json
{
  "data": {
    "check_id": "rchk_8821",
    "status": "completed",
    "completed_at": "2026-04-06T13:00:00Z",
    "completion": {
      "buyer_confirmed": true,
      "seller_confirmed": true,
      "completed": true
    }
  },
  "requestId": "uuid"
}
```

---

## 7. Error Samples

```json
{
  "error": {
    "code": "CHECK_EXPIRED",
    "message": "Reference check window has expired",
    "statusCode": 409
  },
  "requestId": "uuid"
}
```

```json
{
  "error": {
    "code": "ALREADY_VOUCHED",
    "message": "You have already vouched for this participant",
    "statusCode": 409
  },
  "requestId": "uuid"
}
```

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only buyer or seller can confirm completion",
    "statusCode": 403
  },
  "requestId": "uuid"
}
```
