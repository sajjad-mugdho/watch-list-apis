# Frontend Integration Guide - Mock User Testing

> **Complete guide for frontend developers** - Test ALL API endpoints without backend setup

## 🎯 Quick Start (60 seconds)

### Step 1: Add Mock User Header to Your API Client

```javascript
// In your API client (axios, fetch, etc.)
const API_BASE = "http://localhost:5050/api/v1";

// Option A: Axios
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "x-test-user": "buyer_us_complete", // ← Add this!
  },
});

// Option B: Fetch wrapper
async function apiCall(endpoint, options = {}) {
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "x-test-user": "buyer_us_complete", // ← Add this!
      ...options.headers,
    },
  });
}
```

### Step 2: Test It

```javascript
// Get current user
const response = await api.get("/me");
console.log(response.data);
// ✅ Returns mock user data instantly!
```

**That's it!** You can now test ALL protected API endpoints without:

- Real authentication
- Clerk setup
- Database seeding
- Backend configuration

---

## 📱 Framework-Specific Setup

### React / Next.js

```typescript
// lib/api.ts
import axios from "axios";

const MOCK_USER = process.env.NEXT_PUBLIC_MOCK_USER || "buyer_us_complete";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050/api/v1",
  headers: {
    ...(process.env.NODE_ENV === "development" && {
      "x-test-user": MOCK_USER,
    }),
  },
});

// Usage in components
import { api } from "@/lib/api";

function MyComponent() {
  useEffect(() => {
    api.get("/me").then((res) => {
      console.log("User:", res.data.data);
    });
  }, []);
}
```

**Environment variables (.env.local):**

```bash
NEXT_PUBLIC_API_URL=http://localhost:5050/api/v1
NEXT_PUBLIC_MOCK_USER=buyer_us_complete
```

### Vue.js

```javascript
// plugins/api.js
import axios from "axios";

const mockUser = import.meta.env.VITE_MOCK_USER || "buyer_us_complete";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5050/api/v1",
  headers: {
    ...(import.meta.env.DEV && {
      "x-test-user": mockUser,
    }),
  },
});

// Usage
import { api } from "@/plugins/api";

api.get("/me").then((res) => {
  console.log("User:", res.data.data);
});
```

### Plain JavaScript / HTML

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Dialist Test</title>
  </head>
  <body>
    <div id="user-info"></div>

    <script>
      const API_BASE = "http://localhost:5050/api/v1";
      const MOCK_USER = "buyer_us_complete";

      async function getUser() {
        const response = await fetch(`${API_BASE}/me`, {
          headers: {
            "x-test-user": MOCK_USER,
          },
        });
        const data = await response.json();
        document.getElementById("user-info").textContent = JSON.stringify(
          data,
          null,
          2
        );
      }

      getUser();
    </script>
  </body>
</html>
```

---

## 🧪 Testing Different Scenarios

### Scenario 1: New User Onboarding Flow

```javascript
// Start with new user
const api = axios.create({
  baseURL: "http://localhost:5050/api/v1",
  headers: { "x-test-user": "new_user_us" },
});

// Step 1: Check onboarding status
const user = await api.get("/me");
console.log(user.data.data.onboarding_status); // "incomplete"
console.log(user.data.data.next_step); // "location"

// Step 2: Submit location
await api.post("/onboarding/steps/location", {
  country: "US",
  postal_code: "94102",
  region: "California",
});

// Step 3: Submit display name
await api.post("/onboarding/steps/display_name", {
  mode: "default",
  confirm: true,
});

// Step 4: Submit avatar
await api.post("/onboarding/steps/avatar", {
  mode: "default",
  confirm: true,
});

// Step 5: Submit acknowledgements
await api.post("/onboarding/steps/acknowledgements", {
  tos: true,
  privacy: true,
  rules: true,
});

// ✅ Onboarding complete!
```

### Scenario 2: Buyer Browsing Marketplace

```javascript
// Use complete buyer
const api = axios.create({
  baseURL: "http://localhost:5050/api/v1",
  headers: { "x-test-user": "buyer_us_complete" },
});

// Browse listings
const listings = await api.get("/marketplace/listings");

// Reserve an item
const order = await api.post("/marketplace/orders/reserve", {
  listing_id: "some_listing_id",
});

// Get tokenization config
const tokenConfig = await api.post(
  `/marketplace/orders/${order.data.data._id}/tokenize`,
  {
    idempotency_id: crypto.randomUUID(),
    fraud_session_id: order.data.data.fraud_session_id,
  }
);

// ✅ Can now use Finix.js to tokenize payment
```

### Scenario 3: Merchant Creating Listing

```javascript
// Use approved merchant
const api = axios.create({
  baseURL: "http://localhost:5050/api/v1",
  headers: { "x-test-user": "merchant_approved" },
});

// Create a listing
const listing = await api.post("/marketplace/listings", {
  brand: "Rolex",
  model: "Submariner",
  reference: "116610LN",
  condition: "Excellent",
  price: 50000,
  description: "Beautiful condition",
  images: ["https://example.com/image.jpg"],
});

// Update listing
await api.patch(`/marketplace/listings/${listing.data.data._id}`, {
  price: 48000,
});

// Delete listing
await api.delete(`/marketplace/listings/${listing.data.data._id}`);

// ✅ Full merchant capabilities!
```

### Scenario 4: Testing Merchant Onboarding States

```javascript
// Pending merchant (just started)
let api = axios.create({
  baseURL: "http://localhost:5050/api/v1",
  headers: { "x-test-user": "merchant_pending" },
});

let user = await api.get("/me");
console.log(user.data.data.onboarding_state); // "PENDING"
console.log(user.data.data.isMerchant); // false

// Provisioning merchant (waiting for Finix)
api.defaults.headers["x-test-user"] = "merchant_provisioning";
user = await api.get("/me");
console.log(user.data.data.onboarding_state); // "PROVISIONING"

// Rejected merchant
api.defaults.headers["x-test-user"] = "merchant_rejected";
user = await api.get("/me");
console.log(user.data.data.onboarding_state); // "REJECTED"

// Approved merchant
api.defaults.headers["x-test-user"] = "merchant_approved";
user = await api.get("/me");
console.log(user.data.data.isMerchant); // true ✅
```

---

## 🔄 Switching Between Mock Users

### Method 1: Update Header Dynamically

```javascript
const api = axios.create({
  baseURL: "http://localhost:5050/api/v1",
});

// Function to switch users
function switchUser(mockUserId) {
  api.defaults.headers["x-test-user"] = mockUserId;
}

// Test as buyer
switchUser("buyer_us_complete");
await api.get("/me"); // Buyer data

// Test as merchant
switchUser("merchant_approved");
await api.get("/me"); // Merchant data

// Test as new user
switchUser("new_user_us");
await api.get("/me"); // New user data
```

### Method 2: Per-Request Override

```javascript
const api = axios.create({
  baseURL: "http://localhost:5050/api/v1",
});

// Default to buyer
api.defaults.headers["x-test-user"] = "buyer_us_complete";

// Override for specific request
await api.get("/me", {
  headers: { "x-test-user": "merchant_approved" },
});
```

### Method 3: User Selector Component (React)

```tsx
import { useState } from "react";
import { api } from "@/lib/api";

function MockUserSelector() {
  const [currentUser, setCurrentUser] = useState("buyer_us_complete");

  const switchUser = (userId: string) => {
    setCurrentUser(userId);
    api.defaults.headers["x-test-user"] = userId;
  };

  return (
    <select
      value={currentUser}
      onChange={(e) => switchUser(e.target.value)}
      className="border p-2 rounded"
    >
      <option value="buyer_us_complete">Buyer (US)</option>
      <option value="merchant_approved">Merchant (Approved)</option>
      <option value="new_user_us">New User</option>
      <option value="merchant_pending">Merchant (Pending)</option>
    </select>
  );
}
```

---

## 📋 All Available Mock Users

### Quick Reference Table

| Mock User ID                   | Category   | Can Buy? | Can Sell? | Onboarding Status   |
| ------------------------------ | ---------- | -------- | --------- | ------------------- |
| `new_user_us`                  | New        | ❌       | ❌        | incomplete          |
| `new_user_ca`                  | New        | ❌       | ❌        | incomplete          |
| `onboarding_step1_location`    | Onboarding | ❌       | ❌        | incomplete (step 1) |
| `onboarding_step2_displayname` | Onboarding | ❌       | ❌        | incomplete (step 2) |
| `onboarding_step3_avatar`      | Onboarding | ❌       | ❌        | incomplete (step 3) |
| `onboarding_step4_acks`        | Onboarding | ❌       | ❌        | incomplete (step 4) |
| `buyer_us_complete`            | Buyer      | ✅       | ❌        | completed           |
| `buyer_ca_complete`            | Buyer      | ✅       | ❌        | completed           |
| `buyer_with_custom_name`       | Buyer      | ✅       | ❌        | completed           |
| `merchant_pending`             | Merchant   | ✅       | ❌        | PENDING             |
| `merchant_provisioning`        | Merchant   | ✅       | ❌        | PROVISIONING        |
| `merchant_approved`            | Merchant   | ✅       | ✅        | APPROVED            |
| `merchant_approved_ca`         | Merchant   | ✅       | ✅        | APPROVED            |
| `merchant_rejected`            | Merchant   | ✅       | ❌        | REJECTED            |
| `merchant_update_requested`    | Merchant   | ✅       | ❌        | UPDATE_REQUESTED    |
| `user_with_networks`           | Edge Case  | ✅       | ❌        | completed           |
| `user_minimal_claims`          | Edge Case  | ❌       | ❌        | incomplete          |

### Get Full List Programmatically

```javascript
const response = await fetch("http://localhost:5050/api/v1/debug/mock-users");
const data = await response.json();

console.log("Total mock users:", data.total);
console.log("Categories:", data.categories);
console.log("All users:", data.all_users);

// Get users by category
data.all_users
  .filter((u) => u.category === "buyer")
  .forEach((u) => console.log(u.id, "-", u.description));
```

---

## 🔍 Debugging Tips

### Check Which Mock User Is Active

```javascript
// Current user endpoint tells you everything
const response = await api.get("/me");
console.log("Mock User Data:", {
  dialist_id: response.data.data.dialist_id,
  display_name: response.data.data.display_name,
  onboarding_status: response.data.data.onboarding_status,
  isMerchant: response.data.data.isMerchant,
  onboarding_state: response.data.data.onboarding_state,
});
```

### View Mock User Details

```javascript
// Get details for specific mock user
const response = await fetch(
  "http://localhost:5050/api/v1/debug/mock-users/buyer_us_complete"
);
const data = await response.json();

console.log("User:", data.user);
console.log("Claims:", data.session_claims);
console.log("Expected Behavior:", data.expected_behavior);
```

### Log All API Requests (Debugging)

```javascript
// Add axios interceptor
api.interceptors.request.use((request) => {
  console.log("API Request:", {
    method: request.method,
    url: request.url,
    mockUser: request.headers["x-test-user"],
    data: request.data,
  });
  return request;
});

api.interceptors.response.use(
  (response) => {
    console.log("API Response:", {
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error("API Error:", {
      status: error.response?.status,
      message: error.response?.data,
    });
    return Promise.reject(error);
  }
);
```

---

## ⚠️ Common Pitfalls & Solutions

### Problem: Getting 401 Unauthorized

**Solution:** Make sure you added the `x-test-user` header:

```javascript
// ❌ Wrong
await fetch("http://localhost:5050/api/v1/me");

// ✅ Correct
await fetch("http://localhost:5050/api/v1/me", {
  headers: { "x-test-user": "buyer_us_complete" },
});
```

### Problem: Mock user not found

**Solution:** Check spelling (case-sensitive) and verify user exists:

```javascript
// Check available users
const response = await fetch("http://localhost:5050/api/v1/debug/mock-users");
const { all_users } = await response.json();
console.log(
  "Valid IDs:",
  all_users.map((u) => u.id)
);
```

### Problem: Getting 403 Forbidden

**Solution:** You're using a user that can't access that endpoint.

Example: `new_user_us` can't access buyer endpoints because onboarding isn't complete.

```javascript
// ❌ Won't work
api.defaults.headers["x-test-user"] = "new_user_us";
await api.get("/marketplace/listings"); // 403 Forbidden

// ✅ Use complete buyer
api.defaults.headers["x-test-user"] = "buyer_us_complete";
await api.get("/marketplace/listings"); // Works!
```

### Problem: Mock users not working in production

**Solution:** Mock users are **development-only**. In production:

- Use real Clerk authentication
- Get JWT token from Clerk
- Pass as `Authorization: Bearer <token>` header

---

## 🚀 Production Transition

When moving to production, update your API client:

```javascript
// development: use mock users
// production: use real Clerk tokens

const getHeaders = () => {
  if (process.env.NODE_ENV === 'development') {
    return {
      'x-test-user': process.env.NEXT_PUBLIC_MOCK_USER || 'buyer_us_complete'
    };
  } else {
    // Get token from Clerk
    const token = await window.Clerk?.session?.getToken();
    return {
      'Authorization': `Bearer ${token}`
    };
  }
};

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: await getHeaders()
});
```

---

## 📚 Additional Resources

- **Debug Endpoint:** `GET /api/v1/debug/mock-users` - List all mock users
- **Swagger UI:** `http://localhost:5050/api-docs` - Test APIs visually
- **Mock User System Docs:** `/docs/MOCK_USER_SYSTEM.md` - Complete reference
- **Swagger Testing Guide:** `/docs/SWAGGER_TESTING_GUIDE.md` - Swagger usage

---

## 💡 Pro Tips

1. **Use environment variables** for mock user IDs so you can change them quickly
2. **Build a user switcher component** for easy testing during development
3. **Log the active mock user** in your app's header during development
4. **Test edge cases** like rejected merchants and incomplete onboarding
5. **Combine with Swagger** for API endpoint discovery

---

## 🎯 Example: Complete Test Suite

```javascript
// test-api.js - Run all test scenarios

const scenarios = [
  {
    name: 'New User Flow',
    user: 'new_user_us',
    tests: [
      { endpoint: '/me', expect: { onboarding_status: 'incomplete' } }
    ]
  },
  {
    name: 'Buyer Flow',
    user: 'buyer_us_complete',
    tests: [
      { endpoint: '/me', expect: { isMerchant: false } },
      { endpoint: '/marketplace/listings', expect: { status: 200 } }
    ]
  },
  {
    name: 'Merchant Flow',
    user: 'merchant_approved',
    tests: [
      { endpoint: '/me', expect: { isMerchant: true } },
      { method: 'post', endpoint: '/marketplace/listings', data: {...} }
    ]
  }
];

async function runTests() {
  for (const scenario of scenarios) {
    console.log(`\n🧪 Testing: ${scenario.name}`);
    api.defaults.headers['x-test-user'] = scenario.user;

    for (const test of scenario.tests) {
      const method = test.method || 'get';
      const response = await api[method](test.endpoint, test.data);
      console.log(`  ✅ ${method.toUpperCase()} ${test.endpoint}:`,
        response.status);
    }
  }
}

runTests();
```

---

**You're ready to test!** Start with `buyer_us_complete` and explore from there. No backend setup needed! 🎉
