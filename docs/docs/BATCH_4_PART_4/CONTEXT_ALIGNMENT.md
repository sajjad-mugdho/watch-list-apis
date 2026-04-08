# Batch 4 Part 4 Context Alignment

Date: April 6, 2026
Scope: Finalize Batch 4 trust-and-closure states without drifting from Parts 1-3.

## Non-Drift Rules

1. Keep messaging, offers, orders, and reference checks as separate bounded domains with linked IDs.
2. Reference Checks remain distinct from Reviews and cannot be remapped implicitly.
3. Completion states in UI must be derived from canonical backend state machines.
4. Trust & Safety suspension is authoritative server state and overrides normal interaction actions.
5. ApiResponse envelope remains consistent with prior batches.

## What Part 4 Adds

1. Post-completion and suspension states for reference checks.
2. Legal-risk vouch confirmation modal before submitting a vouch.
3. Order detail orchestration that embeds reference check initiation/progress/completion states.
4. Dual-party order completion confirmation and waiting state.
5. Transaction history timeline normalization across inquiry -> offer -> order -> reference check.

## Reused Contracts

- Part 1: chat/presence/action envelope and safety conventions.
- Part 2: transaction cards and group/member display consistency.
- Part 3: reference check lifecycle, vouch vs feedback separation, terms versioning.

## Special Guardrails

1. Suspended checks are read-only except allowed Trust & Safety interactions.
2. Vouch action requires explicit warning acknowledgment.
3. Order completion cannot finalize if reference check policy gate not satisfied (configurable).
