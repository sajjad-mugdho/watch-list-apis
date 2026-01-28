# Implementation Checklist — Auth + Onboarding Clarity

**Status:** Planning Complete ✅  
**Date Created:** December 18, 2025  
**Owner:** Backend Team  
**Reviewer:** Michael

---

## Phase 0: Documentation & Review ✅

- [x] Understand current codebase state
- [x] Map two onboarding flows (platform + merchant)
- [x] Document edge cases
- [x] Define mock user states
- [x] Create flow diagrams
- [x] Write implementation plan
- [x] Prepare Slack message for Michael

**Deliverables:**

- `docs/AUTH_ONBOARDING_CLARITY.md` (full design)
- `docs/AUTH_IMPLEMENTATION_PLAN.md` (summary)
- `docs/AUTH_FLOW_DIAGRAMS.md` (visual diagrams)
- `docs/SLACK_MESSAGE_DRAFT.md` (ready to send)

**Status:** ✅ Ready for Michael's review

---

## Phase 1: Core Endpoints (Priority 1)

### 1.1 Create Auth Handlers

- [ ] Create `src/handlers/authHandlers.ts`
  - [ ] Implement `me_get` function
    - [ ] Extract auth from req
    - [ ] Call `fetchAndSyncLocalUser()` if needed
    - [ ] Return `ValidatedUserClaims`
  - [ ] Implement `auth_refresh_post` function
    - [ ] Force DB lookup via `fetchAndSyncLocalUser()`
    - [ ] Return updated claims
- [ ] Add error handling for both handlers
- [ ] Add request logging

**Acceptance Criteria:**

- `me_get` returns claims from DB when session stale
- `auth_refresh_post` always queries DB
- Errors return proper HTTP codes (401, 500)

**Estimated Time:** 1–2 hours

---

### 1.2 Create Auth Routes

- [ ] Create `src/routes/auth.ts`
  - [ ] Mount `GET /me` with `requirePlatformAuth()` middleware
  - [ ] Mount `POST /auth/refresh` with `requirePlatformAuth()` middleware
- [ ] Update `src/routes/index.ts`
  - [ ] Import auth routes
  - [ ] Mount under `/api/v1`

**Acceptance Criteria:**

- Endpoints respond at correct paths
- Middleware blocks unauthenticated requests
- Routes integrate with existing error handlers

**Estimated Time:** 30 minutes

---

### 1.3 Enhance Middleware

- [ ] Update `src/middleware/authentication.ts`
  - [ ] Add support for `x-refresh-session` header
  - [ ] Logic: if header present and value is "1" or "true", skip session claims and force DB
  - [ ] Maintain backward compatibility (existing behavior unchanged)
- [ ] Add debug logging for refresh header

**Acceptance Criteria:**

- Setting `x-refresh-session: 1` forces DB fallback
- Without header, existing fast-path behavior works
- No breaking changes to existing routes

**Estimated Time:** 1 hour

---

## Phase 2: Mock Users & Test Data (Priority 2)

### 2.1 Standardize Mock Users

- [ ] Update `src/middleware/customClerkMw.ts`
  - [ ] Add mock user: `user_new_incomplete`
    - [ ] external_id, email, first_name, last_name
    - [ ] onboarding.status = "incomplete"
    - [ ] Session claims minimal (dialist_id only)
  - [ ] Add mock user: `user_onboarded_buyer`
    - [ ] Complete platform onboarding
    - [ ] onboarding.status = "completed"
    - [ ] No merchant record
    - [ ] Session claims include onboarding_status, isMerchant: false
  - [ ] Add mock user: `user_merchant_approved`
    - [ ] Complete platform + merchant onboarding
    - [ ] merchant.onboarding_state = "APPROVED"
    - [ ] Session claims include isMerchant: true
- [ ] Remove or update old mock users

**Acceptance Criteria:**

- 3 standardized mock users exist
- Each mock user matches documented states
- x-test-user header works in dev mode

**Estimated Time:** 1 hour

---

### 2.2 Create Test Fixtures

- [ ] Create or update `tests/helpers/fixtures.ts`
  - [ ] Export `seedMockUser(state: "incomplete" | "onboarded" | "merchant")`
  - [ ] Export `clearMockUsers()`
- [ ] Ensure fixtures align with customClerkMw mock users

**Acceptance Criteria:**

- Tests can seed DB with standardized users
- Fixtures match mock user definitions

**Estimated Time:** 30 minutes

---

## Phase 3: Integration Tests (Priority 3)

### 3.1 Auth Endpoint Tests

- [ ] Create `tests/integration/auth.me.test.ts`
  - [ ] Test: Authenticated user with valid session claims
    - [ ] GET /me returns claims from session (fast path)
  - [ ] Test: Authenticated user with missing session claims
    - [ ] GET /me falls back to DB
    - [ ] Returns complete claims
  - [ ] Test: Authenticated user with x-refresh-session header
    - [ ] GET /me skips session claims
    - [ ] Always queries DB
  - [ ] Test: POST /auth/refresh
    - [ ] Forces DB lookup
    - [ ] Returns updated claims
  - [ ] Test: Unauthenticated request
    - [ ] Returns 401
- [ ] Run tests locally and verify all pass

**Acceptance Criteria:**

- All test cases pass
- Code coverage ≥ 80% for new handlers

**Estimated Time:** 2–3 hours

---

### 3.2 Onboarding E2E Tests

- [ ] Create `tests/integration/onboarding.e2e.test.ts`
  - [ ] Test: New user → complete platform onboarding
    - [ ] Start with incomplete user
    - [ ] PATCH all 4 steps
    - [ ] GET /me shows onboarding_status: "completed"
  - [ ] Test: Mid-flow user
    - [ ] Seed user with 2 steps complete
    - [ ] GET /onboarding returns correct next_step
  - [ ] Test: Onboarding already complete
    - [ ] PATCH any step returns 409 Conflict
- [ ] Run tests and verify pass

**Acceptance Criteria:**

- Tests simulate real client flows
- Edge cases covered (duplicate completion, incomplete steps)

**Estimated Time:** 2 hours

---

## Phase 4: Documentation Updates (Priority 4)

### 4.1 Update Swagger

- [ ] Update `src/config/swagger.ts`
  - [ ] Add `GET /api/v1/me` endpoint
    - [ ] Description, security (bearerAuth)
    - [ ] Response schema: `ValidatedUserClaims`
    - [ ] Example response
  - [ ] Add `POST /api/v1/auth/refresh` endpoint
    - [ ] Description, security
    - [ ] Response schema: `ValidatedUserClaims`
  - [ ] Add `x-refresh-session` header to common headers section
- [ ] Test Swagger UI displays new endpoints correctly

**Acceptance Criteria:**

- New endpoints visible in Swagger UI
- Example requests/responses accurate
- Try-it-out feature works

**Estimated Time:** 1 hour

---

### 4.2 Update README / Quick Start

- [ ] Update `QUICK_START.md` or equivalent
  - [ ] Add section on client bootstrap flow
  - [ ] Document GET /me usage
  - [ ] Add curl examples
- [ ] Add link to `AUTH_ONBOARDING_CLARITY.md` for detailed design

**Acceptance Criteria:**

- New devs can follow quick start to understand auth
- Curl examples work

**Estimated Time:** 30 minutes

---

## Phase 5: Code Review & Merge

### 5.1 Pre-Review Checklist

- [ ] All tests pass locally (`npm run test`)
- [ ] Linting passes (`npm run lint`)
- [ ] No console.log statements (use logger)
- [ ] Code comments added where logic is complex
- [ ] No hardcoded values (use config)

---

### 5.2 Create Pull Request

- [ ] Create feature branch: `feature/auth-clarity`
- [ ] Commit with clear messages
- [ ] Push and open PR to `dev` (or `main` if agreed)
- [ ] Fill out PR template:
  - [ ] Summary of changes
  - [ ] Link to design docs
  - [ ] Testing performed
  - [ ] Screenshots (Swagger UI if applicable)

---

### 5.3 Code Review

- [ ] Request review from Michael
- [ ] Address feedback
- [ ] Re-run tests after changes
- [ ] Approve and merge

---

## Phase 6: Deployment & Verification

### 6.1 Deploy to Dev/Staging

- [ ] Merge to dev branch
- [ ] Deploy to dev environment
- [ ] Smoke test endpoints:
  - [ ] GET /me with test user
  - [ ] POST /auth/refresh
- [ ] Verify Swagger UI accessible

---

### 6.2 Production Deployment

- [ ] Merge dev → main (when stable)
- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Verify session fallback works in production

---

## Phase 7: Handoff to Frontend

### 7.1 Documentation for Frontend Dev

- [ ] Share API documentation
  - [ ] Swagger link
  - [ ] Example requests/responses
- [ ] Provide test user credentials for dev
- [ ] Document expected client flow:
  - [ ] Auth → GET /me → UI decision
- [ ] Schedule sync call if needed

---

### 7.2 Support Frontend Integration

- [ ] Answer questions about /me response format
- [ ] Debug any integration issues
- [ ] Verify web + mobile use same contract

---

## Timeline Summary

| Phase     | Description            | Time Estimate               | Status         |
| --------- | ---------------------- | --------------------------- | -------------- |
| 0         | Documentation & Review | 4 hours                     | ✅ Complete    |
| 1         | Core Endpoints         | 2–3 hours                   | ⬜ Not Started |
| 2         | Mock Users & Fixtures  | 1.5 hours                   | ⬜ Not Started |
| 3         | Integration Tests      | 4–5 hours                   | ⬜ Not Started |
| 4         | Documentation Updates  | 1.5 hours                   | ⬜ Not Started |
| 5         | Code Review & Merge    | 2 hours                     | ⬜ Not Started |
| 6         | Deployment             | 1 hour                      | ⬜ Not Started |
| 7         | Frontend Handoff       | 1 hour                      | ⬜ Not Started |
| **Total** |                        | **17–19 hours** (~2–3 days) |                |

---

## Risk & Mitigation

| Risk                                    | Impact | Mitigation                                        |
| --------------------------------------- | ------ | ------------------------------------------------- |
| Session claim sync delays in production | Medium | Document that /me is source of truth              |
| Breaking changes to existing routes     | High   | Ensure middleware changes are backward-compatible |
| Test flakiness with webhooks            | Medium | Use mocks for webhook processing in tests         |
| Clerk API rate limits                   | Low    | Implement retry logic and caching                 |

---

## Success Metrics

- [ ] All integration tests pass
- [ ] Code coverage ≥ 80% for new code
- [ ] Zero breaking changes to existing endpoints
- [ ] Frontend dev confirms /me contract works
- [ ] Michael approves implementation

---

## Notes & Open Questions

1. **Branch strategy:** Confirmed with Michael — merge to `dev` first
2. **FEATURE_CLERK_MUTATIONS:** Keep optional for now (default true in prod)
3. **Mock user persistence:** Code-only (customClerkMw), no DB seeding needed

---

**Status:** Ready to start Phase 1 after Michael's approval  
**Next Action:** Send Slack message (use `SLACK_MESSAGE_DRAFT.md`)
