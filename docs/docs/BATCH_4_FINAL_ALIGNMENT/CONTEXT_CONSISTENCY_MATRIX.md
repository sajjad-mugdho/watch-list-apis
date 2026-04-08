# Batch 4 Context Consistency Matrix (Codebase vs Figma)

Date: April 7, 2026
Scope: Networks domain only, aligned across Batch 4 Part 1, Part 2, Part 3

---

## 1. Cross-Part Non-Drift Checks

1. Networks route namespace exists and includes key modules (`offers`, `messages`, `social`, `reference-checks`, `orders`).
2. Reference Checks are implemented as a dedicated domain, not merged into reviews.
3. Orders support dual confirmation completion.
4. Social groups support role controls and membership operations.
5. Final gap analysis and API inventory are now locked to Batch 4 only scope.

Evidence:

- src/networks/index.ts:28
- src/networks/index.ts:30
- src/networks/index.ts:32
- src/networks/index.ts:36
- src/networks/index.ts:37

---

## 2. Core Consistency Status (Updated)

### A. Naming and Contract Consistency

Status: Mostly aligned

Findings:

1. Offer routes now validate offer ID and resolve by offer-id first, with legacy channel-id fallback for backward compatibility.
2. Social/shared-content handler now accepts canonical `media/files/links` and compatibility aliases (`image/file/url_enrichment`).
3. Social inbox schema now uses preprocess defaults that transform correctly to numbers.
4. Conversation shared-content aliases now accept canonical `media/files/links` and normalize internally for legacy handlers.
5. Final gap docs now consistently exclude standalone Batch 2 and Batch 3 analysis.

Evidence:

- src/networks/routes/offerRoutes.ts:19
- src/networks/handlers/NetworksOfferHandlers.ts:85
- src/networks/handlers/SocialHubHandlers.ts:297
- src/networks/routes/conversationRoutes.ts:15
- src/validation/schemas.ts:1390

### B. Figma State-Machine Consistency

Status: Mostly aligned

Findings:

1. Reference check completion now uses bilateral confirmation with waiting states before terminal completion.
2. Trust-safety status and appeal endpoints are exposed for suspended checks.
3. Order completion now orchestrates reference-check completion side effects, matching route contract.
4. Order detail flow now includes completion-status and reference-check initiation endpoints.

Evidence:

- src/networks/handlers/NetworksReferenceCheckHandlers.ts:464
- src/networks/handlers/NetworksReferenceCheckHandlers.ts:507
- src/networks/routes/referenceCheckRoutes.ts:70
- src/networks/routes/referenceCheckRoutes.ts:75
- src/networks/routes/orderRoutes.ts:54
- src/networks/handlers/NetworksOrderHandlers.ts:132

### C. Group Privacy Enum Consistency

Status: Mostly aligned

Findings:

1. Group model accepts both `invite_only` and legacy `invite-only` values for compatibility.
2. Group creation accepts canonical `privacy` with deprecated `is_private` fallback.
3. Remaining caution: both fields still coexist for backward compatibility, so consumers should treat `privacy` as source of truth.

Evidence:

- src/networks/models/SocialGroup.ts:10
- src/networks/models/SocialGroup.ts:40
- src/networks/handlers/SocialGroupHandlers.ts:30
- src/validation/schemas.ts:1363

---

## 3. Context Alignment Rules for Remediation

1. Keep route IDs semantically aligned with resource namespace:
   - `/offers/:id` should represent offer ID, not channel ID.
2. Normalize enum naming across all layers:
   - choose one canonical value for invite-only (`invite_only` recommended).
3. Keep reference-check completion model consistent with figma flow:
   - separate party confirmations + terminal status transition.
4. Standardize shared-content type vocabulary across route layer and handler layer.
5. Keep legal policy acknowledgment explicit for vouch submissions and track policy version.

---

## 4. Priority Consistency Risks (Current)

P0:

1. No open P0 inconsistency currently identified for this matrix scope.

P1:

1. Remaining P1 risk is shared-content route duplication across social and conversation namespaces.
2. Remaining P1 risk is final payload-shape consistency across legacy and canonical endpoints.

P2:

1. Response envelope consistency varies on some endpoints for backward compatibility.

---

## 5. Final Gap Closure Snapshot

Final status for Networks Batch 4 handoff:

1. Part 1 alignment: partial-to-strong, with remaining contract naming cleanup.
2. Part 2 alignment: strong core route coverage, with one aggregator naming mismatch (`offers-inquiries`).
3. Part 3 alignment: strong functional coverage, with remaining filter/envelope normalization.

Open final gaps to close before sign-off:

1. Freeze canonical response envelope shape across all Batch 4 endpoints.
2. Finalize deprecation timeline for duplicate shared-content route family.
3. Finalize deprecation timeline for legacy compatibility routes in `userRoutes.ts`.

---

## 6. Recommendation

Use this matrix as a gate before any Batch 4 production handoff:

1. Keep this matrix and the screen-by-screen gap file as the single source of truth for final Batch 4 sign-off.
2. Keep canonical enum and offer-id semantics frozen.
3. Re-run screen-by-screen contract verification after the remaining contract cleanups.
