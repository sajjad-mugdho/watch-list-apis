# User Onboarding Requirement for Marketplace Purchases

## Overview

Only users who have completed their onboarding can purchase watches from the marketplace. This requirement ensures buyers have completed necessary account setup before making purchases.

## Implementation

### Middleware: `requireCompletedOnboarding()`

**Location:** `src/middleware/authentication.ts`

**Purpose:** Validates that authenticated users have `onboarding_status: "completed"` before allowing access to buyer-specific endpoints.

**Usage:**

```typescript
import {
  requirePlatformAuth,
  requireCompletedOnboarding,
} from "../middleware/authentication";

// Apply to order routes
router.use(requirePlatformAuth()); // First: Authenticate user
router.use(requireCompletedOnboarding()); // Second: Check onboarding
```

### How It Works

1. **Authentication Check**: Ensures `req.user` exists (user is authenticated)
2. **Onboarding Status Check**: Verifies `req.user.onboarding_status === "completed"`
3. **Error Response**: Returns `403 Forbidden` with message:
   - "User onboarding must be completed before purchasing watches"
   - Includes context: `userId`, `currentStatus`, `requiredStatus`

### Onboarding Statuses

Users have an `onboarding_status` field stored in their JWT claims and database:

- **`incomplete`**: User has not completed onboarding (default)
- **`completed`**: User has finished all onboarding steps

The status is set via `src/utils/user.ts` when users complete the onboarding flow.

## When to Use

### ✅ Use `requireCompletedOnboarding()` for:

- Order creation endpoints (reserve listing, checkout)
- Payment processing endpoints
- Buyer-specific actions (view purchase history)

### ❌ Don't use for:

- Seller/merchant endpoints (they have separate `MerchantOnboarding` approval check)
- Public listing browsing
- User profile viewing
- Authentication endpoints

## Example: Order Routes

```typescript
// src/routes/orderRoutes.ts
import { Router } from "express";
import * as orderHandlers from "../handlers/orderHandlers";
import {
  requirePlatformAuth,
  requireCompletedOnboarding,
} from "../middleware/authentication";

const router = Router();

// All order routes require authentication AND completed onboarding
router.use(requirePlatformAuth());
router.use(requireCompletedOnboarding()); // ✅ Buyers must complete onboarding

router.post("/reserve", orderHandlers.reserveListing);
router.post("/:id/tokenize", orderHandlers.getTokenizationForm);
router.post("/:id/payment", orderHandlers.processPayment);
router.get("/:id", orderHandlers.getOrder);
router.get("/buyer/list", orderHandlers.getBuyerOrders);
router.get("/seller/list", orderHandlers.getSellerOrders);

export { router as orderRoutes };
```

## Testing

Unit tests are available at `tests/unit/require-completed-onboarding.test.ts`:

```bash
npm test -- tests/unit/require-completed-onboarding.test.ts
```

**Test Coverage:**

- ✅ Allows users with `onboarding_status: "completed"`
- ✅ Rejects users with `onboarding_status: "incomplete"` (403)
- ✅ Rejects unauthenticated users (401)

## API Error Response

When a user with incomplete onboarding tries to access protected endpoints:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "User onboarding must be completed before purchasing watches",
    "statusCode": 403,
    "context": {
      "userId": "507f1f77bcf86cd799439011",
      "currentStatus": "incomplete",
      "requiredStatus": "completed"
    }
  }
}
```

## Implementation Checklist

- [x] Create `requireCompletedOnboarding()` middleware
- [x] Add to `src/middleware/authentication.ts`
- [x] Export from authentication module
- [x] Create unit tests
- [x] Update `ONE_WEEK_SPRINT_PLAN.md` with usage examples
- [ ] Apply to order routes when implementing checkout flow (Day 2 of sprint)
- [ ] Document in API swagger/OpenAPI specs
- [ ] Add to frontend error handling

## Related Files

- `src/middleware/authentication.ts` - Middleware implementation
- `src/models/User.ts` - User model with `onboarding.status` field
- `src/utils/user.ts` - User onboarding status management
- `tests/unit/require-completed-onboarding.test.ts` - Unit tests
- `ONE_WEEK_SPRINT_PLAN.md` - Sprint implementation plan

## Notes

- This is separate from **merchant onboarding** (`MerchantOnboarding` model with `onboarding_state: "APPROVED"`)
- Merchant approval is for **sellers** who want to list watches
- User onboarding completion is for **buyers** who want to purchase watches
- Both checks can apply to the same user (a seller can also be a buyer)
