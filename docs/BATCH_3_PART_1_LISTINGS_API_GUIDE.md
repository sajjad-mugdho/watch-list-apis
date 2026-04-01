# Networks Batch 3, Part 1: Listings Management & Creation

This document outlines the API integration points and architectural flows for the first phase of Batch 3, focusing entirely on **Listing Creation, Watch Catalog Search, and the Listing Management Dashboard**.

---

## 📱 Screens 1 & 2: Listing Management Feed & Overflow Actions

**Goal:** Display the user's active, drafted, and reserved inventory. Provide quick actions via an overflow menu.

### 1. Fetch Listings by Tab

Populates the tabs (`All`, `Active`, `Drafts`, `Reserved`).

- **Endpoint:** `GET /api/v1/networks/listings`
- **Query Parameters:**
  - `status`: Filter by `draft`, `active`, `reserved`, `sold`. (Omit to get all).
  - `limit`, `offset`: For pagination.
- **Response Details:** Returns `INetworkListing` objects containing `offers_count`, `view_count`, `thumbnail`, and watch reference data.

### 2. Overflow Menu Actions

The three-dot menu on each card offers several actions.

- **Preview:** App-side routing to the listing detail view (or via `GET /api/v1/networks/listings/:id/preview`).
- **Share:** App-side share sheet using the listing's public URL.
- **Deactivate / Activate:**
  - **Endpoint:** `PATCH /api/v1/networks/listings/:id/status`
  - **Payload:** `{ "status": "draft" }` (to deactivate) or `{ "status": "active" }`
- **Edit Listing:** Navigates to Screen 7 (Draft mode) with the listing data fetched.
- **Delete:**
  - **Endpoint:** `DELETE /api/v1/networks/listings/:id`
- **Boost Listing:** _[⚠️ GAP IDENTIFIED - See Pending Backend Fixes below]_

---

## 📱 Screens 3, 4, 5, 6: Watch Catalog Search & Confirmation

**Goal:** Users must select a structured watch from the global database before providing their specific item condition and photos.

### 1. Unified Watch Search

As the user types (e.g., "Rolex Yacht"), the systemic catalog is queried using MongoDB Atlas Search.

- **Endpoint:** `GET /api/v1/watches`
- **Query Parameters:**
  - `q`: Search string (e.g., `q=Rolex Yacht`).
- **UI Mapping:** The response contains `reference`, `color` (Dial), `bezel`, `bracelet`, and `materials` matching the pill-tags in Figma.

### 2. Confirm Watch & Mint Draft

Once the user confirms the exact reference (Screen 6 "Yes, List This Watch"), the frontend must **create a draft** before continuing to the details form.

- **Endpoint:** `POST /api/v1/networks/listings`
- **Payload:**
  ```json
  {
    "watch": "60d5ecb54... (MongoDB ObjectId of the Watch)",
    "type": "for_sale"
  }
  ```
- **Behavior:** Returns a newly minted `INetworkListing` in `"draft"` status. Save this `listing._id` for the next screen.

---

## 📱 Screen 7: Listing Details & Publishing

**Goal:** Capture dynamic listing data for the specific watch (photos, condition, price, shipping).

### 1. Auto-Saving / Patching the Draft

As the user fills out the form, or upon hitting "Publish", send the data to update the draft.

- **Endpoint:** `PATCH /api/v1/networks/listings/:id`
- **Payload Requirements:**
  ```json
  {
    "subtitle": "Mint condition with full set",
    "description": "...",
    "condition": "New", // Enums: "New", "Used - Very Good", "Used - Good", "Used - Fair", "Used - Damaged"
    "contents": "Box & Papers", // Enums: "Box & Papers", "Box Only", "Papers Only", "Watch Only"
    "images": ["url1", "url2", "url3"], // 3 to 10 images
    "thumbnail": "url1",
    "price": 14500,
    "allow_offers": true,
    "shipping": [
      {
        "region": "US",
        "shippingIncluded": false,
        "shippingCost": 50
      }
    ],
    "reservation_terms": "Must have solid references..." // Min 10 chars
  }
  ```

### 2. Publishing the Listing

Once everything is patched successfully, trigger the publish action. The backend will run a strict completeness check.

- **Endpoint:** `POST /api/v1/networks/listings/:id/publish`
- **Payload:** `{}` (Empty body)
- **Backend Validation Rules (`validateListingCompleteness`):**
  - Must have `shipping` array with > 0 items.
  - Must have a valid `price` > 0.
  - Must have `images` (minimum 3, maximum 10).
  - Must have `thumbnail`.
  - Must have `contents`.
  - Must have `condition`.
  - Must have `reservation_terms` (minimum 10 characters).

---

## ⚠️ GAP Analysis & Required Backend Fixes

_Frontend should be aware of these status-tracked notes._

1. **Watch color persistence:**

- **Status:** Resolved.
- **Notes:** `color` is now present in the schema; strict mode dropping occurs at write/casting time, not at query read time.

2. **Shipping regions include International:**

- **Status:** Resolved.
- **Notes:** Listing/update and offer validation now use the canonical token `International`.

3. **Publish validation for Subtitle:**

- **Status:** Open by product decision.
- **Notes:** UI marks subtitle required, but backend publish completeness intentionally does not enforce subtitle to avoid shared-flow regression until product confirms hard requirement.

4. **"Boost Listing" Feature Non-Existent (Screens 1/2):**

- **Status:** Open.
- **Notes:** The overflow menu has "Boost Listing", but there is no underlying architecture, pricing model, or model flag (`is_boosted`). UI should hide this action until a dedicated backend flow exists.
