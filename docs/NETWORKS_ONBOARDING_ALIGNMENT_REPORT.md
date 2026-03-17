# Dialist API — Integration Guide

## Batch 1: Networks User Onboarding

> **Who this is for:** Mobile frontend developers (Umer, Aman) integrating the Networks platform.
> This guide walks through the complete user lifecycle from first sign-in to a fully onboarded Networks user — step by step, in the exact order it happens.

---

## Table of Contents

1. [Overview — The Full Flow](#1-overview)
2. [Step 1 — User Signs In via Clerk](#2-step-1-clerk-sign-in)
3. [Step 2 — Clerk Webhook Creates User in Database](#3-step-2-clerk-webhook)
4. [Step 3 — Check Onboarding Status on App Launch](#4-step-3-onboarding-status)
5. [Step 4 — Persona Identity Verification](#5-step-4-persona-verification)
6. [Step 5 — Persona Webhook Updates Verification Status](#6-step-5-persona-webhook)
7. [Step 6 — Complete Onboarding Profile](#7-step-6-complete-onboarding)
8. [Error Reference](#8-error-reference)
9. [Environment Variables Chaining](#9-environment-variables)

---

## 1. Overview

The complete Networks onboarding flow has three distinct phases:

```
Phase 1: Account Creation
  User signs up → Clerk issues JWT → Clerk webhook fires → User inserted into DB

Phase 2: Identity Verification
  App requests Persona link → User completes KYC in WebView
  → Persona webhook fires → DB updated → User is verified

Phase 3: Profile Completion
  User sets location → display name → avatar → accepts terms
  → Onboarding marked complete → User lands on Networks home
```

Every step in this guide maps to a specific Figma screen. Complete them in order — skipping steps will cause downstream calls to fail.

---

## 2. Step 1 — User Signs In via Clerk

Clerk handles all authentication. You do not call your own backend for sign-in — Clerk's SDK manages this entirely.

### What happens

1. User enters email/password or uses social login in the Clerk UI
2. Clerk validates credentials and issues a signed JWT
3. Your app receives the JWT from the Clerk SDK
4. All subsequent API calls use this JWT in the `Authorization` header

### Getting the token (React Native example)

```javascript
import { useAuth } from "@clerk/clerk-expo";

const { getToken } = useAuth();

// Call this before any API request
const token = await getToken();

// Use it in your fetch calls
const response = await fetch("https://api.dialist.com/api/v1/...", {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});
```

### Token lifecycle

| Situation                    | What to do                                              |
| ---------------------------- | ------------------------------------------------------- |
| Token valid                  | Use it directly                                         |
| Token expired (401 response) | Call `getToken()` again — Clerk refreshes automatically |
| User signs out               | Clear token from memory                                 |

> **Note for local dev:** You can bypass Clerk entirely using the mock header `x-test-user: buyer_us_complete`. This injects a pre-seeded test user without a real Clerk account. Switch `authMode` in your Postman environment to `mock` for this.

---

## 3. Step 2 — Clerk Webhook Creates User in Database

You do not need to call any API to create a user. When Clerk creates a new account, it automatically fires a webhook to the Dialist backend. The backend listens for `user.created` events and inserts the user into MongoDB.

### What the backend does automatically

```
Clerk fires: user.created event
  ↓
Backend receives: POST /api/v1/webhooks/clerk
  ↓
Backend creates: User document in MongoDB
  - external_id = Clerk user ID
  - email
  - first_name
  - last_name
  - onboarding.status = "incomplete"
  - identityVerified = false
```

### What you need to do

Nothing. This happens server-side. By the time your app calls any user endpoint, the user already exists in the database.

### Verifying it worked (dev only)

```
GET /api/v1/networks/user
Authorization: Bearer {token}
```

If you get a `200` with user data, the webhook fired correctly and the user exists. If you get `404`, the webhook has not fired yet — wait a moment and retry.

---

## 4. Step 3 — Check Onboarding Status on App Launch

Every time the app launches (after sign-in), call this endpoint first. It tells you exactly where in the onboarding flow the user is and what screens to show.

### Endpoint

```
GET /api/v1/onboarding/status
Authorization: Bearer {token}
```

### Response

```json
{
  "data": {
    "status": "incomplete",
    "version": "v1",
    "steps": {
      "location": {
        "country": null,
        "region": null,
        "postal_code": null,
        "updated_at": null
      },
      "display_name": {
        "value": null,
        "confirmed": false,
        "user_provided": false,
        "updated_at": null
      },
      "avatar": {
        "url": null,
        "confirmed": false,
        "user_provided": false,
        "updated_at": null
      },
      "acknowledgements": {
        "tos": false,
        "privacy": false,
        "rules": false,
        "updated_at": null
      }
    },
    "progress": {
      "is_finished": false,
      "completed_steps": 0,
      "total_steps": 4
    }
  }
}
```

### Decision logic

```javascript
const { status, steps, progress } = response.data;

if (status === "completed") {
  // User is fully onboarded → go to Networks home screen
  navigate("NetworksHome");
  return;
}

// Determine first incomplete step
if (!steps.location.country) {
  navigate("OnboardingLocation");
} else if (!steps.display_name.confirmed) {
  navigate("OnboardingDisplayName");
} else if (!steps.avatar.confirmed) {
  navigate("OnboardingAvatar");
} else if (!steps.acknowledgements.tos) {
  navigate("OnboardingAcknowledgements");
} else {
  // All steps done but status not completed — shouldn't happen
  // Re-fetch to get updated status
}
```

> **Important:** Always check `status` first. If it is `"completed"`, skip the entire onboarding flow regardless of what the individual step values say.

---

## 5. Step 4 — Persona Identity Verification

Before a user can access Networks features (send offers, create listings, connect with others), they must complete identity verification via Persona. This is a KYC check.

### How it works

The frontend opens a Persona WebView using the Persona SDK. Persona handles the entire verification form. When the user completes it, Persona fires a webhook to the Dialist backend. You do not call your own backend to start or submit verification — only to check the result.

### Step 4a — Check current verification status

```
GET /api/v1/user/verification
Authorization: Bearer {token}
```

**Response:**

```json
{
  "data": {
    "identityVerified": false,
    "personaStatus": "pending",
    "personaInquiryId": "inq_xxxxxxxx"
  }
}
```

### personaStatus values and what to show

| `personaStatus` | Show to user                                      |
| --------------- | ------------------------------------------------- |
| `null`          | "Verify your identity" CTA — user has not started |
| `"pending"`     | "Verification in progress" — inquiry is open      |
| `"approved"`    | Green verified badge — full Networks access       |
| `"failed"`      | "Verification failed" — show retry option         |
| `"expired"`     | "Session expired" — prompt to restart             |

### Step 4b — Open Persona WebView

When the user taps "Verify Identity", open Persona using their SDK. Pass the inquiry ID from the API response if one exists (to resume an in-progress inquiry).

```javascript
import Persona from "persona";

// Get the inquiry ID from your API first
const { personaInquiryId } = verificationData;

const client = new Persona.Client({
  templateId: "tmpl_xxxxxxxx", // your Persona template ID
  inquiryId: personaInquiryId || undefined, // resume if exists
  onComplete: (inquiryId, status) => {
    // Persona is done — now poll your backend for the result
    pollVerificationStatus();
  },
  onError: (code, details) => {
    // Handle SDK error
  },
});

client.open();
```

### Step 4c — Poll for result after WebView closes

When Persona's `onComplete` fires, poll your backend until the status changes from `pending`:

```javascript
async function pollVerificationStatus() {
  const maxAttempts = 10;
  let attempts = 0;

  const poll = async () => {
    attempts++;
    const res = await fetch("/api/v1/user/verification", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { data } = await res.json();

    if (data.personaStatus === "approved") {
      // Success — update UI
      showVerifiedBadge();
      return;
    }

    if (data.personaStatus === "failed") {
      // Failed — show retry
      showVerificationFailed();
      return;
    }

    if (attempts < maxAttempts) {
      // Still pending — try again in 3 seconds
      setTimeout(poll, 3000);
    }
  };

  poll();
}
```

---

## 6. Step 5 — Persona Webhook Updates Verification Status

You do not need to do anything for this step. When Persona completes verification, it sends a webhook to the Dialist backend at `POST /api/v1/webhooks/persona`. The backend updates the user's `identityVerified` and `personaStatus` fields automatically.

```
Persona fires: inquiry.completed or inquiry.approved
  ↓
Backend receives: POST /api/v1/webhooks/persona
  ↓
Backend updates user:
  - identityVerified = true
  - identityVerifiedAt = now
  - personaStatus = "approved"
  - personaInquiryId = inquiry ID
```

Your polling in Step 4c will pick up this change automatically.

---

## 7. Step 6 — Complete Onboarding Profile

Once identity is verified, the user completes four onboarding steps. Each step is a separate PATCH call. Call them in order.

After each step, re-fetch `GET /api/v1/onboarding/status` to update the progress bar in your UI.

---

### Step 6a — Location

```
PATCH /api/v1/onboarding/steps/location
Authorization: Bearer {token}
Content-Type: application/json
```

**Request body:**

```json
{
  "country": "US",
  "postal_code": "10001",
  "region": "New York",
  "currency": "USD"
}
```

**Field reference:**

| Field         | Type   | Required | Notes                                      |
| ------------- | ------ | -------- | ------------------------------------------ |
| `country`     | string | Yes      | `"US"` or `"CA"` only                      |
| `postal_code` | string | Yes      | 5-digit US zip or 6-char CA postal code    |
| `region`      | string | No       | State or province name                     |
| `currency`    | string | No       | Auto-set to `"USD"` for US, `"CAD"` for CA |

**Response:**

```json
{
  "data": {
    "country": "US",
    "region": "New York",
    "postal_code": "10001",
    "currency": "USD",
    "updated_at": "2026-03-17T10:00:00Z"
  },
  "_metadata": {
    "onboarding": {
      "is_finished": false,
      "completed_steps": 1,
      "total_steps": 4
    }
  }
}
```

**What to do next:** Check `_metadata.onboarding.is_finished`. If `true`, skip remaining steps and redirect to Networks home. Otherwise navigate to the next step.

---

### Step 6b — Display Name

```
PATCH /api/v1/onboarding/steps/display_name
Authorization: Bearer {token}
Content-Type: application/json
```

**Request body:**

```json
{
  "display_name": "john_watches",
  "confirmed": true
}
```

**Rules:**

- 3–30 characters
- Letters, numbers, underscores only — no spaces
- Must be unique across the platform
- Cannot be changed for 30 days after confirmation

**Response:**

```json
{
  "data": {
    "value": "john_watches",
    "confirmed": true,
    "user_provided": true,
    "updated_at": "2026-03-17T10:01:00Z"
  },
  "_metadata": {
    "onboarding": {
      "is_finished": false,
      "completed_steps": 2,
      "total_steps": 4
    }
  }
}
```

**Error — display name taken:**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Display name is already taken"
  }
}
```

When you get this `409` error, show an inline "Username unavailable" message and let the user try another.

---

### Step 6c — Avatar

Two options — URL or file upload. Use whichever fits your flow.

**Option A — Set avatar from URL**

```
PATCH /api/v1/onboarding/steps/avatar
Authorization: Bearer {token}
Content-Type: application/json
```

```json
{
  "url": "https://example.com/my-photo.jpg",
  "confirmed": true
}
```

**Option B — Upload file directly (recommended)**

```
POST /api/v1/onboarding/steps/avatar/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

```
Field: avatar  →  file (jpg / png / webp, max 10MB)
```

**React Native example:**

```javascript
const uploadAvatar = async (imageUri) => {
  const formData = new FormData();
  formData.append("avatar", {
    uri: imageUri,
    type: "image/jpeg",
    name: "avatar.jpg",
  });

  const response = await fetch("/api/v1/onboarding/steps/avatar/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
    body: formData,
  });

  const { data } = await response.json();
  // Save data.url → display as user avatar immediately
};
```

**Response (both options):**

```json
{
  "data": {
    "url": "https://images.dialist.com/avatars/user-uuid.jpg",
    "confirmed": true,
    "user_provided": true,
    "updated_at": "2026-03-17T10:02:00Z"
  },
  "_metadata": {
    "onboarding": {
      "is_finished": false,
      "completed_steps": 3,
      "total_steps": 4
    }
  }
}
```

**Save `data.url`** — use it to display the user's avatar in the app immediately without re-fetching.

---

### Step 6d — Acknowledgements (Terms of Service)

This is the final step. All three fields must be `true`. The backend will set `onboarding.status = "completed"` once this call succeeds.

```
PATCH /api/v1/onboarding/steps/acknowledgements
Authorization: Bearer {token}
Content-Type: application/json
```

**Request body:**

```json
{
  "tos": true,
  "privacy": true,
  "rules": true
}
```

**Response:**

```json
{
  "data": {
    "tos": true,
    "privacy": true,
    "rules": true,
    "updated_at": "2026-03-17T10:03:00Z"
  },
  "_metadata": {
    "onboarding": {
      "is_finished": true,
      "completed_steps": 4,
      "total_steps": 4
    }
  }
}
```

**When `is_finished` is `true`:** Navigate to Networks home screen. Onboarding is complete.

---

### Step 6e — Load Full User Profile (Post-Onboarding)

After onboarding completes, fetch the full user profile and save key fields to your app state.

```
GET /api/v1/networks/user
Authorization: Bearer {token}
```

**Response (key fields):**

```json
{
  "data": {
    "_id": "64f3a1b2c3d4e5f6g7h8i9j0",
    "display_name": "john_watches",
    "avatar": "https://images.dialist.com/avatars/user-uuid.jpg",
    "onboarding_status": "completed",
    "identityVerified": true,
    "networks_published": false,
    "presence_status": "offline",
    "location": {
      "country": "US",
      "region": "New York"
    }
  }
}
```

**Save from this response:**

| Field                    | Save as            | Used for                  |
| ------------------------ | ------------------ | ------------------------- |
| `data._id`               | `userId`           | All subsequent API calls  |
| `data.display_name`      | `displayName`      | Header, profile display   |
| `data.avatar`            | `avatarUrl`        | Avatar display everywhere |
| `data.identityVerified`  | `isVerified`       | Show/hide verified badge  |
| `data.onboarding_status` | `onboardingStatus` | Guard onboarding re-entry |

---

## 8. Error Reference

All endpoints follow the same error shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

| HTTP Status | When it happens                          | What to do                             |
| ----------- | ---------------------------------------- | -------------------------------------- |
| `400`       | Missing required field or wrong format   | Show inline field error                |
| `401`       | Token missing or expired                 | Call `getToken()` and retry once       |
| `409`       | Onboarding already completed             | Skip onboarding, go to home            |
| `409`       | Display name taken                       | Show "Username unavailable" inline     |
| `422`       | Validation failed (e.g. invalid country) | Show specific field error              |
| `429`       | Rate limited — too many requests         | Show "Please wait" and retry after 60s |
| `500`       | Server error                             | Show generic error toast, allow retry  |

---

## 9. Environment Variables

Set these in your Postman environment. Requests auto-save them so chained calls work without copy-pasting.

| Variable           | Set from                                 | Used in                        |
| ------------------ | ---------------------------------------- | ------------------------------ |
| `token`            | Clerk sign-in                            | All authenticated calls        |
| `mockUser`         | Environment setting                      | All mock-mode calls (dev only) |
| `userId`           | `GET /networks/user` → `data._id`        | All Networks calls             |
| `avatarUrl`        | `POST /steps/avatar/upload` → `data.url` | Profile display                |
| `onboardingStatus` | `GET /onboarding/status` → `data.status` | Routing decision               |

---

## Full Flow Summary

```
1.  User opens app
      ↓
2.  Clerk sign-in → JWT issued
      ↓
3.  Clerk webhook fires → User created in DB (automatic)
      ↓
4.  App calls GET /onboarding/status
      → status = "incomplete" → show onboarding screens
      → status = "completed"  → skip to Networks home
      ↓
5.  App opens Persona WebView → user completes KYC
      ↓
6.  Persona webhook fires → identityVerified = true (automatic)
      ↓
7.  App polls GET /user/verification until personaStatus = "approved"
      ↓
8.  Onboarding steps (in order):
      PATCH /onboarding/steps/location
      PATCH /onboarding/steps/display_name
      PATCH /onboarding/steps/avatar  (or POST /steps/avatar/upload)
      PATCH /onboarding/steps/acknowledgements
      ↓
9.  GET /networks/user → save userId, avatarUrl, displayName
      ↓
10. Navigate to Networks home screen ✓
```

---

_For full request/response details and live testing, import the Postman collection from `postman/Dialist-API.postman_collection.json` in the repo._

_Next: Batch 2 — Networks Mobile Screens (Dashboard, Search, Listings, Offers)_
