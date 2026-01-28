# Swagger API Testing Guide

> How to test APIs using Swagger UI with mock users

## 🚀 Quick Start

1. **Start the server:**

```bash
npm run dev
```

2. **Open Swagger UI:**

```
http://localhost:5050/api-docs
```

3. **You'll see the Swagger interface with all API endpoints**

---

## 🔐 Authentication Options

Swagger now supports **3 authentication methods**:

### Option 1: Mock User (Recommended for Development)

1. Click the **"Authorize"** button (🔓 icon) at the top right
2. You'll see three options:

   - **bearerAuth** (Clerk JWT - production)
   - **basicAuth** (Webhooks only)
   - **mockUser** (Development testing) ← **USE THIS**

3. In the **mockUser** section:

   - Enter a mock user ID (e.g., `buyer_us_complete`)
   - Click **"Authorize"**
   - Click **"Close"**

4. All subsequent API requests will include `x-test-user: buyer_us_complete` header

### Option 2: Bearer Token (Production-like)

1. Get a JWT token from Clerk (from your frontend app console)
2. Click **"Authorize"**
3. In **bearerAuth** section, enter: `Bearer YOUR_JWT_TOKEN`
4. Click **"Authorize"** and **"Close"**

### Option 3: Manual Header Per Request

You can also add `x-test-user` header manually for each request:

1. Expand any endpoint
2. Click **"Try it out"**
3. Scroll to **"Headers"** section
4. Add: `x-test-user: buyer_us_complete`
5. Click **"Execute"**

---

## 📋 Available Mock Users

| Mock User ID                   | Description                    | Use Case                                   |
| ------------------------------ | ------------------------------ | ------------------------------------------ |
| `buyer_us_complete`            | Fully onboarded US buyer       | Test buyer endpoints, marketplace browsing |
| `buyer_ca_complete`            | Fully onboarded Canadian buyer | Test Canadian buyer flows                  |
| `merchant_approved`            | Approved merchant (can sell)   | Test listing creation, merchant dashboard  |
| `merchant_approved_ca`         | Approved Canadian merchant     | Test Canadian merchant flows               |
| `merchant_pending`             | Merchant onboarding started    | Test merchant onboarding states            |
| `merchant_provisioning`        | Awaiting Finix verification    | Test provisioning state                    |
| `merchant_rejected`            | Rejected merchant              | Test rejection handling                    |
| `new_user_us`                  | Fresh user, no onboarding      | Test onboarding flow from start            |
| `onboarding_step1_location`    | At location step               | Test onboarding step 1                     |
| `onboarding_step2_displayname` | At display name step           | Test onboarding step 2                     |
| `onboarding_step3_avatar`      | At avatar step                 | Test onboarding step 3                     |
| `onboarding_step4_acks`        | At acknowledgements step       | Test onboarding step 4                     |

**See all available mock users:**

```
GET /api/v1/debug/mock-users
```

---

## 🎯 Example Testing Scenarios

### Scenario 1: Test User Onboarding Flow

1. Authorize with: `new_user_us`
2. Test **GET /api/v1/me**
   - Response shows: `onboarding_status: "incomplete"`
3. Test **POST /api/v1/onboarding/steps/location**
   - Body: `{ "country": "US", "postal_code": "94102", "region": "California" }`
4. Test **POST /api/v1/onboarding/steps/display_name**
   - Body: `{ "mode": "default", "confirm": true }`
5. Continue with avatar and acknowledgements steps

### Scenario 2: Test Merchant Onboarding

1. Authorize with: `buyer_us_complete`
2. Test **POST /api/v1/marketplace/merchant/onboard**
   - Response includes `onboarding_url` (Finix form link)
3. Switch to: `merchant_provisioning`
4. Test **GET /api/v1/me**
   - Response shows: `onboarding_state: "PROVISIONING"`

### Scenario 3: Test Marketplace Operations

1. Authorize with: `merchant_approved`
2. Test **POST /api/v1/marketplace/listings** (create listing)
3. Test **GET /api/v1/marketplace/listings** (view all listings)
4. Switch to: `buyer_us_complete`
5. Test **POST /api/v1/marketplace/orders/reserve** (reserve item)
6. Test **POST /api/v1/marketplace/orders/{id}/tokenize** (get payment form config)

### Scenario 4: Test Payment Flow

1. Authorize with: `buyer_us_complete`
2. Test **POST /api/v1/marketplace/orders/reserve**
   - Get `order_id` from response
3. Test **POST /api/v1/marketplace/orders/{order_id}/tokenize**
   - Get `session_key` for Finix.js
4. (In frontend) Tokenize payment with Finix.js → get `payment_token`
5. Test **POST /api/v1/marketplace/orders/{order_id}/payment**
   - Body: `{ "payment_token": "...", "postal_code": "94102", "idempotency_id": "..." }`

---

## 💡 Tips

1. **Persist Authorization:** Swagger remembers your authorization, so you only need to authorize once per session

2. **Switch Users Easily:** Click "Authorize" again and enter a different mock user ID to test different user states

3. **View All Endpoints:** Use the search bar in Swagger to quickly find specific endpoints

4. **Download OpenAPI Spec:** Available at the top of Swagger UI for importing into Postman or other tools

5. **Debug Endpoint:** Use `GET /api/v1/debug/mock-users` to see all available mock users with descriptions

---

## 🔍 Troubleshooting

**Q: I get 401 Unauthorized**

- Make sure you clicked "Authorize" and entered a valid mock user ID
- Check that the server is running in development mode

**Q: Mock user not working**

- Verify you're using `NODE_ENV=development`
- Check the mock user ID spelling (case-sensitive)
- Use `GET /api/v1/debug/mock-users` to see valid IDs

**Q: I want to test with real Clerk tokens**

- Get token from your frontend app console: `await window.Clerk.session.getToken()`
- Use **bearerAuth** instead of **mockUser** in Swagger
- Enter: `Bearer <your-token>`

---

## 📚 Related Documentation

- **[Frontend Integration Guide](./FRONTEND_INTEGRATION_GUIDE.md)** - Complete guide for using mock users in your frontend code ← **START HERE**
- [Mock User System](./MOCK_USER_SYSTEM.md) - Complete mock user reference
- [API Documentation](../README.md) - General API overview
- [Finix Integration](../FINIX_CERTIFICATION_COMPLETE.md) - Payment processing docs

---

## 🔗 Quick Links

- **Debug Endpoint:** `GET /api/v1/debug/mock-users` - List all available mock users with descriptions
- **Swagger UI:** `http://localhost:5050/api-docs` - Interactive API testing
- **Frontend Guide:** Essential for integrating mock users into your React/Vue/Next.js app
