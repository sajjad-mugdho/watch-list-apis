# Auth, Onboarding & Merchant Journey

## 1. Why this exists

Michael and Umair raised fair concerns:

- What’s the **source of truth**?
- How do **session claims vs backend** really work?
- Are **web and mobile** using the same rules?
- What happens in all the weird **edge cases**?

This doc answers those questions in plain language and ties them directly to real endpoints:

- `GET /api/v1/me`
- `POST /api/v1/auth/refresh`
- `/api/v1/onboarding/...`
- `/api/v1/marketplace/merchant/...`

---

## 2. Core rule: who do we trust?

**MongoDB is the source of truth.**  
**Clerk session claims (JWT `publicMetadata`) are a cache.**

Session claims can be out of date right after:

- First signup (webhooks still running)
- Completing the 4‑step onboarding
- Merchant approval/rejection from Finix webhooks

Because of that, the backend is written to always be able to ignore the token and go back to the database.

Swagger reflects this directly:

- `GET /api/v1/me` (tagged **Auth**) is the **canonical bootstrap endpoint**.
- `POST /api/v1/auth/refresh` forces a **DB lookup → Clerk claims sync**.

> If there’s ever a disagreement between Clerk and MongoDB, **MongoDB wins**, and `/api/v1/me` is how the client sees the truth.

---

## 3. One golden rule for clients

Same rule for **web and mobile**:

```text
Authenticate with Clerk → call GET /api/v1/me → decide what to show
```

No client should be trying to reverse‑engineer Clerk `publicMetadata` on its own.

---

## 4. The key fields

You’ll keep seeing three fields in responses and session claims:

### `onboarding_status` – platform onboarding

- Values: `"incomplete" | "completed"`
- Backed by: `User.onboarding.status`
- Meaning: has the user finished the 4‑step platform onboarding wizard?

### `onboarding_state` – merchant onboarding (Finix)

- Only present if the user has **started** merchant onboarding.
- Backed by: `MerchantOnboarding.onboarding_state`
- Values (from Finix):
  - `"PENDING"`
  - `"PROVISIONING"`
  - `"APPROVED"`
  - `"REJECTED"`
  - `"UPDATE_REQUESTED"`

### `isMerchant`

- Always present in claims.
- Backed by: `MerchantOnboarding` (via `buildClaimsFromDbUser`).
- `false` for regular buyers and for merchants still under review.
- `true` only when the merchant has been **fully approved** and can sell.

All of this is built in one place: `buildClaimsFromDbUser` in `src/utils/user.ts`, which is also what `/api/v1/me` and `/api/v1/auth/refresh` use under the hood.

---

## 5. The important endpoints (from Swagger)

These are the endpoints that matter for this story. Their definitions in `swagger.ts` match what’s described here.

### Auth / bootstrap

**`GET /api/v1/me`**

- Tag: `Auth`
- Description in Swagger: “Get current user state (canonical bootstrap endpoint).”
- Behavior:
  - Always reads from MongoDB.
  - Does **not** trust session claims if they look wrong.
- Header support:
  - Optional `x-refresh-session: 1` or `x-refresh-session: true` to force a fresh DB lookup and skip any cache.

**`POST /api/v1/auth/refresh`**

- Tag: `Auth`
- Description in Swagger: “Force refresh user session claims from database.”
- Behavior:
  - Always queries the DB.
  - Best‑effort sync back to Clerk `publicMetadata`.
  - Useful right after onboarding or merchant approval.

### Platform onboarding (4 steps)

All tagged `Onboarding` in Swagger:

- `GET /api/v1/onboarding/status` – returns detailed progress, next step, etc.
- `PATCH /api/v1/onboarding/steps/location` – updates location.
- `PATCH /api/v1/onboarding/steps/display_name` – updates display name.
- `PATCH /api/v1/onboarding/steps/avatar` – updates avatar.
- `PATCH /api/v1/onboarding/steps/acknowledgements` – final step; marks onboarding complete.

### Merchant onboarding (Finix)

All tagged `Marketplace - Merchant` in Swagger:

- `POST /api/v1/marketplace/merchant/onboard`
  - Creates a Finix **hosted onboarding form**.
  - Returns `onboarding_url`, `form_id`, and expiry.
- `GET /api/v1/marketplace/merchant/status`
  - Returns a normalized view of merchant state:
  - `is_merchant`, `identity_id`, `merchant_id`, `onboarding_state`, `verification_state`, timestamps.
- `POST /api/v1/marketplace/merchant/onboard/refresh-link`
  - Regenerates a link if the existing Finix onboarding URL has expired.

---

## 6. Flow 1 – Signup and first bootstrap

**Goal:** After a user signs up with Clerk, both web and mobile know exactly what screen to show next.

1. **User signs up / logs in via Clerk**

   - Clerk handles UI and authentication.
   - Clerk fires `user.created` on first signup.
   - Backend creates a `User` document with `onboarding.status = "incomplete"`.

2. **Client gets a Clerk JWT**

   - Web or mobile stores the token.

3. **Client bootstraps via `/me`**

   - Immediately after successful auth, client calls:
     - `GET /api/v1/me` with the bearer token.
   - Backend:
     - Loads the `User` row (and `MerchantOnboarding` if it exists).
     - Builds `ValidatedUserClaims` from the DB.
     - Returns fields like:
       - `onboarding_status` (likely `"incomplete"` for a new user),
       - `isMerchant` (false),
       - location, display name, etc. when available.

4. **Client decides what to show**

```text
If onboarding_status === "incomplete"  → show the 4‑step onboarding wizard
If onboarding_status === "completed"  → drop the user into the main app
```

That’s the same for web and mobile.

---

## 7. Flow 2 – Platform onboarding (4‑step wizard)

**Goal:** Collect just enough information for the user to be a proper buyer on the platform.

The steps are implemented in the onboarding handlers and are documented in Swagger:

1. **Location**

   - `PATCH /api/v1/onboarding/steps/location`
   - Body: `country`, `region`, `postal_code` (see Swagger for exact schema).
   - Stored under `User.onboarding.steps.location` and promoted into `User.location`.

2. **Display name**

   - `PATCH /api/v1/onboarding/steps/display_name`
   - Stores an auto or custom display name.

3. **Avatar**

   - `PATCH /api/v1/onboarding/steps/avatar`
   - Stores an avatar URL.

4. **Acknowledgements (final)**
   - `PATCH /api/v1/onboarding/steps/acknowledgements`.
   - This is the “finish onboarding” button:
     - Sets `User.onboarding.status = "completed"`.
     - Sets `User.onboarding.completed_at`.
     - Calls `finalizeOnboarding` → `buildClaimsFromDbUser` → best‑effort sync to Clerk.

### What the client should do after the last step

Because Clerk may not have refreshed immediately, the client should **re‑bootstrap through the API**, not guess:

- Either call `GET /api/v1/me` again, or
- Call `POST /api/v1/auth/refresh` and then `GET /api/v1/me`.

At that point, `onboarding_status` should read `"completed"` and the app can safely open the main experience.

---

## 8. Flow 3 – Merchant onboarding (Finix KYC)

**Goal:** Turn a completed user into a merchant who can actually receive payouts.

This is optional and only allowed when `onboarding_status === "completed"`.

1. **User clicks “Become a Merchant”**

   - Client calls `POST /api/v1/marketplace/merchant/onboard`.
   - Backend validates that platform onboarding is done.

2. **Backend creates a Finix onboarding form**

   - Calls Finix to create a hosted onboarding form.
   - Writes a `MerchantOnboarding` document with:
     - `dialist_user_id`, `clerk_id`,
     - `form_id`,
     - initial `onboarding_state` (e.g. `"PENDING"`).
   - Returns `onboarding_url`, `form_id`, and expiry.

3. **User completes the Finix form**

   - Client redirects the user to `onboarding_url`.
   - User finishes the KYC / business / bank steps on Finix’s side.

4. **Finix webhooks update our DB**

   - Finix sends events like `onboarding_form.updated`, `merchant.created`, `merchant.updated` to `/api/v1/webhooks/finix`.
   - A worker processes them and updates `MerchantOnboarding`:
     - Sets `identity_id`, `merchant_id`.
     - Moves `onboarding_state` through `PENDING → PROVISIONING → APPROVED/REJECTED`.
     - Updates `verification_state` and timestamps.

5. **Client checks merchant status**

   - Either:
     - `GET /api/v1/marketplace/merchant/status`, or
     - `GET /api/v1/me` (which will include `onboarding_state` + `isMerchant`).
   - Once `onboarding_state === "APPROVED"`, `buildClaimsFromDbUser` sets `isMerchant = true`.

6. **UI when approved**

```text
If isMerchant === true and onboarding_state === "APPROVED" → show seller tools
Else → show "in review" / "action required" states based on onboarding_state
```

For full payload examples, see `finix-onboarding.md` and the Swagger definitions for the merchant endpoints.

---

## 9. How web and mobile should behave

To keep behavior identical across platforms, both web and mobile should follow this small set of rules:

1. **On app start (user already authenticated with Clerk):**

   - Call `GET /api/v1/me`.

2. **Decide initial screen:**

   - If `onboarding_status === "incomplete"` → show onboarding.
   - If `onboarding_status === "completed"` → show main app.

3. **After completing the last onboarding step:**

   - Option A: `POST /api/v1/auth/refresh` then `GET /api/v1/me`.
   - Option B: call `GET /api/v1/me` with `x-refresh-session: 1`.

4. **When user wants to sell:**

   - If `isMerchant === true` → go directly to seller features.
   - Otherwise:
     - `POST /api/v1/marketplace/merchant/onboard`.
     - Redirect to the returned `onboarding_url`.

5. **After returning from Finix:**
   - Poll `GET /api/v1/marketplace/merchant/status` or `GET /api/v1/me` until:
     - `onboarding_state === "APPROVED"` and `isMerchant === true`.

No client needs to read or interpret raw Clerk `publicMetadata` for these flows — they just follow the API contract.

---

## 10. Edge cases (and how we’ve covered them)

We hit these in implementation and tests; here’s how they are handled.

- **Signup before webhooks finish**

  - If a user signs up and hits the app before webhooks are done, `/api/v1/me` will still go to the DB and create/normalize the user record.

- **Onboarding completed but JWT still says `incomplete`**

  - The UI should rely on `/api/v1/me`, not on the local token.
  - `POST /api/v1/auth/refresh` exists to push the updated state into Clerk, but the client doesn’t have to wait for that to route correctly.

- **Merchant approved while user is active in the app**

  - The moment webhooks update `MerchantOnboarding`, `/api/v1/me` and `/api/v1/marketplace/merchant/status` will reflect the new state.
  - Again, we don’t have to wait on Clerk.

- **Local / test environments**
  - `customClerkMw` defines mock users for key states:
    - new + incomplete
    - completed buyer (not merchant)
    - approved merchant
  - Integration tests (`tests/integration/auth.me.test.ts`) exercise `/api/v1/me` and `/api/v1/auth/refresh` against these states and are currently all passing.

---

## 11. What’s intentionally out of scope

This document and this phase of work focus only on:

- Authentication bootstrap (`/api/v1/me`, `/api/v1/auth/refresh`)
- Platform onboarding (4 steps)
- Merchant onboarding and status (Finix)
- Keeping session claims consistent with the DB

Not covered here (but present in `Project_requrement.md` and future phases):

- Subscription systems (RevenueCat, Apple/Google IAP)
- Offer / order flows and checkout
- Networks onboarding flows
- Social / messaging features

Those can safely build on top of these stable flows.

---

## 12. Direct answers to Michael’s points

> **“What’s the source of truth?”**

- MongoDB, always. `/api/v1/me` and `/api/v1/marketplace/merchant/status` return DB‑backed state. Clerk is a cache we keep in sync.

> **“What happens with session claims and edge cases?”**

- We never trust claims blindly. `/api/v1/me` can ignore them and go straight to the DB; `/api/v1/auth/refresh` can push the fresh DB state back into Clerk when needed.

> **“Are web and mobile going to behave the same?”**

- Yes. Both use: `Auth with Clerk → GET /api/v1/me → decide UI`.

> **“Where are the core flows documented?”**

- Here:
  - Signup + bootstrap
  - 4‑step onboarding
  - Merchant onboarding and status
  - How `/api/v1/me` and `/api/v1/auth/refresh` fit into that.

This is the doc you can point to when someone asks, “What actually happens when a user signs in and becomes a merchant?”

It’s grounded in the current Swagger spec and the code that just passed all integration tests, and it’s small enough that people will actually read it.
