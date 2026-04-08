# Implementation Plan Summary — Auth + Onboarding Clarity

**Date:** December 18, 2025  
**Owner:** Backend Team  
**Reviewer:** Michael

---

## What This Delivers

A clear source-of-truth contract and bootstrap flow that eliminates session-claim race conditions across web and mobile.

---

## Core Decisions (No Debate)

1. **Database is source of truth**

   - Clerk session claims are a cache
   - Backend always has DB fallback path

2. **Two separate onboarding flows:**

   - Platform onboarding (4 steps: location, name, avatar, legal)
   - Merchant onboarding (Finix KYC form)

3. **Client bootstrap contract:**
   ```
   Auth → GET /me → UI decision (onboarding vs app)
   ```

---

## Implementation Scope (Small, Backend-Only)

### What We're Adding (1–2 days)

1. **Two new endpoints:**

   - `GET /api/v1/me` — canonical user state (DB-backed)
   - `POST /api/v1/auth/refresh` — force refresh claims

2. **Middleware enhancement:**

   - Honor `x-refresh-session: 1` header to force DB fallback

3. **Standardized mock users:**

   - New incomplete user
   - Onboarded buyer
   - Approved merchant

4. **Integration tests:**

   - Bootstrap with stale JWT
   - Forced refresh after onboarding
   - Merchant approval flow

5. **Swagger docs:**
   - Document /me and /auth/refresh endpoints

---

## What We're NOT Doing (Important)

- ❌ Marketplace offer flows (accept/reject/counter)
- ❌ Payment/subscription system
- ❌ Handler refactors
- ❌ Data model changes
- ❌ Frontend changes (other dev owns that)

**Why:** Focused scope on authentication bootstrap only.

---

## Files Changed (Minimal)

**New:**

- `src/handlers/authHandlers.ts` (me_get, auth_refresh_post)
- `src/routes/auth.ts` (mount /me and /auth/refresh)
- `tests/integration/auth.me.test.ts`

**Modified:**

- `src/middleware/authentication.ts` (add x-refresh-session support)
- `src/middleware/customClerkMw.ts` (standardize mock users)
- `src/routes/index.ts` (mount auth routes)
- `src/config/swagger.ts` (add endpoint docs)

---

## Testing Strategy

### Unit

- getOnboardingProgress, finalizeOnboarding, buildClaimsFromDbUser

### Integration

- GET /me with stale JWT → DB fallback
- POST /auth/refresh → updates claims
- Complete onboarding → claims sync

### E2E Smoke

- Signup → onboard → GET /me shows completed

---

## Open Questions

1. Should we merge to `dev` branch first, or directly to `main`?
2. Should `FEATURE_CLERK_MUTATIONS` always be enabled in production?
3. Do mock users need to be seeded in dev DB, or just in code?

---

## Timeline

- **Doc review:** Today (Dec 18)
- **Implementation:** 1–2 days after approval
- **Testing:** 0.5 day
- **Total:** ~2–3 days end-to-end

---

## Success Criteria

✅ GET /me returns DB-backed claims  
✅ POST /auth/refresh forces sync  
✅ Mock users standardized  
✅ Tests pass  
✅ Swagger updated  
✅ Michael approves contract

---

## Next Steps

1. Michael reviews this doc + `docs/AUTH_ONBOARDING_CLARITY.md`
2. We discuss open questions
3. I open PR with implementation
4. Quick review + merge
5. Frontend dev uses new /me endpoint

---

**Ready for review.**
