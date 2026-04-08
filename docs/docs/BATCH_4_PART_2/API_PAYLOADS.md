# Batch 4 Part 2: API Payloads (Group Details + Shared Content + Transaction Timeline)

**Date:** April 6, 2026  
**Purpose:** Copy-ready request/response contracts for Part 2 screens

---

## 1. Group Details

### 1.1 GET /networks/groups/:groupId/details

```http
GET /networks/groups/grp_1001/details
Authorization: Bearer {token}
x-request-id: {uuid}
```

```json
{
  "data": {
    "group_id": "grp_1001",
    "name": "NYC Watch Collectors",
    "avatar_url": "https://cdn.../group.jpg",
    "members_count": 2400,
    "online_members_count": 317,
    "privacy": "private",
    "viewer_role": "admin",
    "can_add_member": true,
    "can_remove_member": true,
    "content_counts": {
      "media": 12,
      "links": 1,
      "files": 2
    },
    "notification_settings": {
      "muted": false,
      "mute_until": null
    }
  },
  "requestId": "uuid"
}
```

### 1.2 POST /networks/groups/:groupId/members/invite

```http
POST /networks/groups/grp_1001/members/invite
Content-Type: application/json
Authorization: Bearer {token}

{
  "user_ids": ["usr_11", "usr_12"],
  "note": "Join our NYC collector community"
}
```

```json
{
  "data": {
    "group_id": "grp_1001",
    "invited": ["usr_11", "usr_12"],
    "failed": [],
    "invited_count": 2
  },
  "requestId": "uuid"
}
```

### 1.3 DELETE /networks/groups/:groupId/members/:memberId

```http
DELETE /networks/groups/grp_1001/members/usr_22
Authorization: Bearer {token}
```

```json
{
  "data": {
    "group_id": "grp_1001",
    "removed_user_id": "usr_22",
    "removed_by": "usr_admin",
    "removed_at": "2026-04-06T13:30:00Z"
  },
  "requestId": "uuid"
}
```

### 1.4 POST /networks/groups/:groupId/leave

```http
POST /networks/groups/grp_1001/leave
Content-Type: application/json
Authorization: Bearer {token}

{
  "reason": "Too many notifications"
}
```

```json
{
  "data": {
    "group_id": "grp_1001",
    "left": true,
    "left_at": "2026-04-06T13:35:00Z"
  },
  "requestId": "uuid"
}
```

### 1.5 POST /networks/groups/:groupId/report

```http
POST /networks/groups/grp_1001/report
Content-Type: application/json
Authorization: Bearer {token}

{
  "reason": "spam",
  "description": "Repeated scam listings in discussion",
  "evidence_message_ids": ["msg_99", "msg_100"]
}
```

```json
{
  "data": {
    "report_id": "rpt_9001",
    "group_id": "grp_1001",
    "status": "open",
    "created_at": "2026-04-06T13:37:00Z"
  },
  "requestId": "uuid"
}
```

---

## 2. Group Members & Common Groups

### 2.1 GET /networks/groups/:groupId/members

```http
GET /networks/groups/grp_1001/members?limit=20&cursor=next_abc
Authorization: Bearer {token}
```

```json
{
  "data": {
    "members": [
      {
        "user_id": "usr_1",
        "display_name": "David Lee",
        "location": "Miami, FL",
        "followers": 8200,
        "avatar_url": "https://cdn...",
        "role": "member",
        "follow_status": "none"
      }
    ],
    "next_cursor": "next_def",
    "has_more": true
  },
  "requestId": "uuid"
}
```

### 2.2 GET /networks/users/:userId/common-groups

```http
GET /networks/users/usr_88/common-groups?limit=20
Authorization: Bearer {token}
```

```json
{
  "data": {
    "groups": [
      {
        "group_id": "grp_1001",
        "name": "NYC Watch Collectors",
        "members_count": 2400,
        "privacy": "private",
        "avatar_url": "https://cdn..."
      },
      {
        "group_id": "grp_1020",
        "name": "Vintage Rolex Market",
        "members_count": 856,
        "privacy": "invite_only",
        "avatar_url": "https://cdn..."
      },
      {
        "group_id": "grp_1027",
        "name": "Patek Philippe Lounge",
        "members_count": 142,
        "privacy": "secret",
        "avatar_url": null
      }
    ],
    "total": 3
  },
  "requestId": "uuid"
}
```

---

## 3. Shared Content Endpoints

### 3.1 GET /networks/chats/:chatId/links

```http
GET /networks/chats/chat_7001/links?limit=20&offset=0
Authorization: Bearer {token}
```

```json
{
  "data": {
    "links": [
      {
        "id": "lnk_1",
        "url": "https://watchcharts.com/rolex-sub",
        "domain": "watchcharts.com",
        "shared_at": "2026-04-05T16:00:00Z",
        "shared_by": {
          "user_id": "usr_3",
          "display_name": "Sarah Kim"
        },
        "message_id": "msg_811"
      }
    ],
    "total": 2,
    "has_more": false
  },
  "requestId": "uuid"
}
```

### 3.2 GET /networks/chats/:chatId/media

```http
GET /networks/chats/chat_7001/media?limit=30&cursor=cur_1
Authorization: Bearer {token}
```

```json
{
  "data": {
    "media": [
      {
        "media_id": "med_1",
        "thumbnail_url": "https://cdn.../thumb1.jpg",
        "url": "https://cdn.../full1.jpg",
        "type": "image",
        "width": 1080,
        "height": 1080,
        "message_id": "msg_901",
        "shared_at": "2026-04-05T20:30:00Z"
      }
    ],
    "next_cursor": "cur_2",
    "has_more": true
  },
  "requestId": "uuid"
}
```

### 3.3 GET /networks/chats/:chatId/files

```http
GET /networks/chats/chat_7001/files?limit=20&offset=0
Authorization: Bearer {token}
```

```json
{
  "data": {
    "files": [
      {
        "file_id": "fil_1",
        "file_name": "Contract_Draft_v2.doc",
        "mime_type": "application/msword",
        "size_bytes": 2516582,
        "size_label": "2.4 MB",
        "shared_at": "2026-04-06T10:30:00Z",
        "uploaded_by": {
          "user_id": "usr_11",
          "display_name": "Michael Lammens"
        },
        "scan_status": "clean"
      },
      {
        "file_id": "fil_2",
        "file_name": "Insurance_Policy.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 1153433,
        "size_label": "1.1 MB",
        "shared_at": "2026-04-05T17:00:00Z",
        "uploaded_by": {
          "user_id": "usr_11",
          "display_name": "Michael Lammens"
        },
        "scan_status": "clean"
      }
    ],
    "total": 2,
    "has_more": false
  },
  "requestId": "uuid"
}
```

---

## 4. Offers & Inquiries Views

### 4.1 GET /networks/user/offers-inquiries

```http
GET /networks/user/offers-inquiries?tab=all&limit=20&offset=0
Authorization: Bearer {token}
```

```json
{
  "data": {
    "items": [
      {
        "id": "ofr_1",
        "kind": "offer",
        "direction": "received",
        "status": "received",
        "listing_snapshot": {
          "listing_id": "lst_100",
          "title": "Omega Speedmaster Professional",
          "subtitle": "Moonwatch",
          "reference_no": "310.30.42.50.01.001",
          "year": 2022,
          "condition": "Excellent",
          "box_papers": "Box & Papers",
          "thumbnail_url": "https://cdn.../lst.jpg"
        },
        "amount": {
          "value": 6200,
          "currency": "USD"
        },
        "offer_amount": {
          "value": 1500,
          "currency": "USD"
        },
        "reservation_terms": "Changed",
        "reference_check_status": "not_started",
        "updated_at": "2026-04-06T08:00:00Z",
        "cta": {
          "label": "View Counter Offer",
          "action": "open_offer",
          "target_id": "ofr_1"
        }
      }
    ],
    "total": 142,
    "counts": {
      "all": 142,
      "sent": 71,
      "received": 71
    }
  },
  "requestId": "uuid"
}
```

---

## 5. Chat History with Transaction Events

### 5.1 GET /networks/messages/:chatId/history

```http
GET /networks/messages/chat_7001/history?limit=50&include_transaction_events=true
Authorization: Bearer {token}
```

```json
{
  "data": {
    "items": [
      {
        "item_type": "text_message",
        "message_id": "msg_1",
        "sender": {
          "user_id": "usr_2",
          "display_name": "Michael Lammens"
        },
        "content": "Hey! I saw your listing for the Submariner.",
        "created_at": "2026-04-06T09:20:00Z"
      },
      {
        "item_type": "transaction_event",
        "event_id": "evt_100",
        "event_type": "offer_sent",
        "offer_id": "ofr_1",
        "status": "sent",
        "snapshot": {
          "title": "Omega Speedmaster Professional",
          "reference_no": "310.30.42.50.01.001",
          "amount": 6200,
          "currency": "USD",
          "offer_amount": 1500,
          "reservation_terms": "Changed"
        },
        "cta": {
          "label": "View Offer Details",
          "target": "offer",
          "target_id": "ofr_1"
        },
        "created_at": "2026-04-06T09:40:00Z"
      },
      {
        "item_type": "transaction_event",
        "event_id": "evt_101",
        "event_type": "counter_received",
        "offer_id": "ofr_1",
        "status": "counter_received",
        "snapshot": {
          "title": "Omega Speedmaster Professional",
          "amount": 6200,
          "currency": "USD",
          "counter_amount": 1000
        },
        "created_at": "2026-04-06T09:55:00Z"
      }
    ],
    "has_more": true,
    "next_cursor": "h_2"
  },
  "requestId": "uuid"
}
```

---

## 6. Error Examples

### Permission Error

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only owner/admin can remove members from this group",
    "statusCode": 403
  },
  "requestId": "uuid"
}
```

### Validation Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid privacy transition",
    "statusCode": 400,
    "details": {
      "from": "secret",
      "to": "public"
    }
  },
  "requestId": "uuid"
}
```

### Not Found

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Group not found",
    "statusCode": 404
  },
  "requestId": "uuid"
}
```
