# Networks Batch 3, Part 2: Buyer & Listing Details Flow - Gap Analysis

This document traces the screen-by-screen integration for Batch 3 Part 2 Figma screens (Listings Creation Detail, Listing View, Reference Checks, Concierge Service, and Reservations) against the existing APIs and models.

## 📱 Screens 1 & 2: Create Listing

**Features Displayed:** Selection of watch (from catalog), media uploads (3-10 images), subtitle, description, year, condition, contents, price, allow offers, shipping selection, and reservation terms.

### Codebase Alignment & Verification

- **Fields support:** The `INetworkListing` model and `updateListingSchema` cover all these fields successfully (`subtitle`, `description`, `condition`, `contents`, `allow_offers`, `year`, `price`, `shipping`, `reservation_terms`).
- **Media limits:** `validateListingCompleteness` properly ensures `min: 3, max: 10` for `images` and enforces a required `thumbnail`.

### 🚨 Gaps & Discrepancies

1. **Subtitle Enforceability:**
   - **UI:** The Subtitle input is marked as physically required (`Subtitle *`).
   - **Backend:** `validateListingCompleteness` does not enforce the existence of `subtitle`. A user could technically publish a complete listing without a subtitle directly via API.
2. **Shipping Region Options:**
   - **UI:** The "Confirm Reservation" mockups (Screen 7) indicate support for "United States", "Canada", and "International".
   - **Backend:** Resolved. `updateListingSchema` now includes `"International"` in the shipping region enum.

---

## 📱 Screens 3 & 6: Listing Details View

**Goal:** Display the full breakdown of an active listing before a buyer interaction. Includes dynamic metrics like review scores and a CTA for Dialist Concierge.

### Codebase Alignment & Verification

- **Seller Profile Summary:** The API endpoint `getUserPublicProfile` securely provides the required metadata `reviewsCount`, `averageRating`, and `activeListingsCount`.
- **Actions:** "Make an Offer" maps to `POST /api/v1/networks/listings/:id/offers` and "Buy Now" maps to `POST /api/v1/networks/listings/:id/reserve`.

### 🚨 Gaps & Discrepancies

- **Review vs Reference Terminology mismatch:** The UI displays `Rating 4.9 (147 reviews)` alongside a distinct metric `Reference Checks History -> 142`. This perfectly lines up with the separate backend models (`Review.ts` vs `ReferenceCheck.ts`). Implementers need to ensure the profile UI properly bifurcates these models.

---

## 📱 Screen 4: Reference Checks History

**Goal:** Display a scrollable list of user feedback divided into "All", "As Buyer", and "As Seller".

### Codebase Alignment & Verification

- The screen perfectly mirrors the properties of the **`Review`** model (`role` = "buyer" / "seller", `feedback`, `rating`, etc.).

### 🚨 Gaps & Discrepancies

1. **Design Naming Confusion:** The screen is titled "Reference Checks History", but the actual content and tab-functionality ("As Buyer" vs "As Seller") refer to post-transaction **Reviews**. The backend model `ReferenceCheck.ts` is explicitly for pre-transaction vouching and does not have buyer/seller role distinctions.
2. **Frontend Action:** The frontend must call the Reviews endpoints (e.g., `GET /api/v1/users/:targetUserId/reviews`) instead of Reference Checks endpoints to get this data.

---

## 📱 Screen 5: Concierge Service

**Goal:** Sell the buyer on premium Dialist protection.

### Codebase Alignment & Verification

- Backend handles this beautifully via `POST /api/v1/networks/listings/:id/concierge`, which deposits an ongoing request in `ConciergeRequest` collection without disrupting the listing state.
- **Note:** The UI screen features a "Send Inquiry [WhatsApp]" button. The team needs to clarify if clicking this strictly opens an external WhatsApp intent, or if it fires the REST API call simultaneously.

---

## 📱 Screens 7 & 8: Confirm Reservation & Confirmed

**Goal:** Perform the "Buy Now" execution locking the listing to the buyer, confirming shipping/totals, and dispatching next steps.

### Codebase Alignment & Verification

- The direct purchase flow maps exactly to `POST /api/v1/networks/listings/:id/reserve`. The payload accepts `shipping_region`.
- The backend successfully transitions the `NetworkListing` to "reserved" state, establishes a `NetworkListingChannel` if none exists, and outputs an `Order` document.
- **Spelling:** Typo in Figma payload Screen 8: "You'll **recieve** the message".

### 🚨 Gaps & Discrepancies

- The direct reservation path now supports `"International"` end-to-end when the listing includes that configured tier.

---

## 📝 Implementation Action Plan

1. **Status complete:** Shipping enum alignment (`International`) is implemented in schemas.
2. **Pending product decision:** Decide whether subtitle becomes a hard publish requirement in shared listing completeness logic.
3. Establish clear frontend binding notes to point the "Reference Checks History" to `Review` data payloads rather than `ReferenceCheck` endpoints.
