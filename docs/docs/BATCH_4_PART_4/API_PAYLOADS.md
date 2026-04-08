# Batch 4 Part 4 API Payloads

Date: April 6, 2026
Purpose: Request/response contracts for suspension, vouch warning, and order closure orchestration

---

## 1. Reference Check Detail with Status Variants

### GET /networks/reference-checks/:checkId

```http
GET /networks/reference-checks/rchk_8821
Authorization: Bearer {token}
```

### Response: completed

```json
{
  "data": {
    "check_id": "rchk_8821",
    "status": "completed",
    "banner": {
      "type": "completed",
      "title": "REFERENCE CHECK COMPLETED"
    },
    "transaction": {
      "value": 6200,
      "currency": "USD"
    },
    "seller": {
      "user_id": "usr_21",
      "display_name": "Michael L.",
      "vouches": 42
    },
    "buyer": {
      "user_id": "usr_22",
      "display_name": "Sarah K.",
      "vouches": 12
    },
    "reservation_terms_snapshot": "Buyer agrees to pay the full amount online through ChronoTrust within 24 hours.",
    "actions": {
      "can_vouch": false,
      "can_confirm_complete": false,
      "can_comment": false
    },
    "completion": {
      "buyer_confirmed": true,
      "seller_confirmed": true,
      "completed_at": "2026-04-06T13:00:00Z"
    }
  },
  "requestId": "uuid"
}
```

### Response: suspended

```json
{
  "data": {
    "check_id": "rchk_8821",
    "status": "suspended",
    "banner": {
      "type": "suspended",
      "title": "SUSPENDED",
      "subtitle": "Under Review by Trust & Safety"
    },
    "trust_safety": {
      "review_id": "tsr_1002",
      "status": "under_review",
      "reason_code": "misrepresentation_reported",
      "opened_at": "2026-04-06T14:00:00Z"
    },
    "actions": {
      "can_vouch": false,
      "can_confirm_complete": false,
      "can_comment": false,
      "can_appeal": true
    }
  },
  "requestId": "uuid"
}
```

---

## 2. Vouch Policy and Submission

### GET /networks/reference-checks/:checkId/vouch-policy

```http
GET /networks/reference-checks/rchk_8821/vouch-policy
Authorization: Bearer {token}
```

```json
{
  "data": {
    "policy_version": "2026-04-01",
    "title": "Wait! Read Before Vouching",
    "items": [
      "Not a like: your vouch may be used in civil disputes.",
      "No legal protection: platform does not shield legal consequences."
    ],
    "requires_explicit_ack": true
  },
  "requestId": "uuid"
}
```

### POST /networks/reference-checks/:checkId/vouches

```http
POST /networks/reference-checks/rchk_8821/vouches
Authorization: Bearer {token}
Content-Type: application/json

{
  "target_user_id": "usr_21",
  "policy_version_accepted": "2026-04-01",
  "ack_timestamp": "2026-04-06T14:11:00Z",
  "reason": "Completed prior deals with accurate communication"
}
```

```json
{
  "data": {
    "vouch_id": "vch_991",
    "check_id": "rchk_8821",
    "target_user_id": "usr_21",
    "created_at": "2026-04-06T14:11:01Z",
    "target_vouch_count": 43
  },
  "requestId": "uuid"
}
```

---

## 3. Order Details with Reference Check Module

### GET /networks/orders/:orderId/details

```http
GET /networks/orders/ord_849302/details
Authorization: Bearer {token}
```

```json
{
  "data": {
    "order_id": "ord_849302",
    "status": "reserved_pending",
    "status_card": {
      "title": "Reserved & Pending",
      "subtitle": "Both parties have agreed to terms. Waiting for shipment confirmation."
    },
    "listing_snapshot": {
      "title": "Audemars Piguet Royal Oak",
      "reference_no": "15500ST.OO.1220ST.01",
      "price": 52000,
      "currency": "USD",
      "thumbnail_url": "https://cdn.example/l.jpg"
    },
    "participants": {
      "seller": {
        "user_id": "usr_10",
        "display_name": "John Dealer",
        "country": "US"
      },
      "buyer": {
        "user_id": "usr_11",
        "display_name": "alexsmith mobbin",
        "country": "CA"
      }
    },
    "reservation_terms_snapshot": "Buyer agrees to pay the full amount online through ChronoTrust within 24 hours.",
    "shipping_country": "US",
    "reference_check": {
      "required": true,
      "state": "not_started",
      "cta": {
        "label": "Initiate Reference Check",
        "action": "initiate_reference_check"
      }
    },
    "completion": {
      "state": "idle",
      "you_confirmed": false,
      "partner_confirmed": false,
      "can_confirm": false,
      "reason_blocked": "reference_check_required"
    }
  },
  "requestId": "uuid"
}
```

### GET /networks/orders/:orderId/details (reference check in progress)

```json
{
  "data": {
    "order_id": "ord_849302",
    "status": "reference_check_in_progress",
    "reference_check": {
      "required": true,
      "state": "in_progress",
      "check_id": "rchk_8821",
      "time_remaining": "14h 27m",
      "progress": {
        "started": true,
        "vouches_count": 4,
        "completed": false
      },
      "cta": {
        "label": "View Details",
        "action": "open_reference_check",
        "target_id": "rchk_8821"
      }
    },
    "completion": {
      "state": "waiting_partner",
      "you_confirmed": true,
      "partner_confirmed": false,
      "can_confirm": false
    }
  },
  "requestId": "uuid"
}
```

---

## 4. Order and Reference Check Actions

### POST /networks/orders/:orderId/reference-check/initiate

```http
POST /networks/orders/ord_849302/reference-check/initiate
Authorization: Bearer {token}
Content-Type: application/json

{
  "visibility": "community",
  "duration_hours": 24
}
```

```json
{
  "data": {
    "order_id": "ord_849302",
    "check_id": "rchk_8821",
    "status": "active",
    "expires_at": "2026-04-07T14:20:00Z"
  },
  "requestId": "uuid"
}
```

### POST /networks/orders/:orderId/confirm-complete

```http
POST /networks/orders/ord_849302/confirm-complete
Authorization: Bearer {token}
```

```json
{
  "data": {
    "order_id": "ord_849302",
    "completion": {
      "you_confirmed": true,
      "partner_confirmed": false,
      "state": "waiting_partner"
    },
    "message": "Waiting for the other party to confirm"
  },
  "requestId": "uuid"
}
```

Final completion example:

```json
{
  "data": {
    "order_id": "ord_849302",
    "status": "completed",
    "completed_at": "2026-04-06T15:10:00Z",
    "completion": {
      "you_confirmed": true,
      "partner_confirmed": true,
      "state": "completed"
    }
  },
  "requestId": "uuid"
}
```

---

## 5. History and Trust-Safety Endpoints

### GET /networks/orders/:orderId/history

```http
GET /networks/orders/ord_849302/history
Authorization: Bearer {token}
```

```json
{
  "data": {
    "events": [
      {
        "event_type": "inquiry_started",
        "label": "Inquiry Started",
        "created_at": "2026-04-05T10:00:00Z"
      },
      {
        "event_type": "offer_received",
        "label": "Offer Received",
        "metadata": {
          "amount": 11000,
          "currency": "USD"
        },
        "created_at": "2026-04-05T10:30:00Z"
      },
      {
        "event_type": "counter_offer_sent",
        "label": "Counter Offer Sent",
        "metadata": {
          "amount": 11500,
          "currency": "USD"
        },
        "created_at": "2026-04-05T15:30:00Z"
      },
      {
        "event_type": "offer_accepted",
        "label": "Offer Accepted",
        "created_at": "2026-04-05T16:15:00Z"
      },
      {
        "event_type": "reference_check_completed",
        "label": "Reference Check Complete",
        "created_at": "2026-04-06T14:28:00Z"
      },
      {
        "event_type": "order_completed",
        "label": "Order Completed",
        "created_at": "2026-04-06T14:30:00Z"
      }
    ]
  },
  "requestId": "uuid"
}
```

### GET /networks/reference-checks/:checkId/trust-safety/status

```http
GET /networks/reference-checks/rchk_8821/trust-safety/status
Authorization: Bearer {token}
```

```json
{
  "data": {
    "check_id": "rchk_8821",
    "review": {
      "status": "under_review",
      "reason_code": "misrepresentation_reported",
      "opened_at": "2026-04-06T14:00:00Z",
      "eta_hours": 24
    }
  },
  "requestId": "uuid"
}
```

---

## 6. Error Responses

```json
{
  "error": {
    "code": "POLICY_ACK_REQUIRED",
    "message": "You must accept the vouch policy before submitting",
    "statusCode": 400
  },
  "requestId": "uuid"
}
```

```json
{
  "error": {
    "code": "CHECK_SUSPENDED",
    "message": "Reference check is suspended and cannot be modified",
    "statusCode": 409
  },
  "requestId": "uuid"
}
```

```json
{
  "error": {
    "code": "ORDER_COMPLETION_BLOCKED",
    "message": "Reference check policy requirements not satisfied",
    "statusCode": 409
  },
  "requestId": "uuid"
}
```
