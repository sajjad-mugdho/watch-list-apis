# Plan: Architecture Segregation

## Overview
The goal is to enforce a strict conceptual and physical code boundary between the **Marketplace** (web-based public e-commerce with vetted merchants and Finix payments) and **Networks** (private, invite-only mobile community for dealers with no platform-facilitated payments). The **Shared** module will handle user accounts, authentication, and overarching infrastructure. Additionally, we must ensure that all other existing systems (e.g., background workers, webhooks, utility scripts) are updated to correctly interface with the newly segregated module paths so the entire platform remains completely functional at every step.

## Project Type
**BACKEND**

## Success Criteria
1. `Marketplace` module exclusively owns order fulfillment, payments (Finix), and public marketplace-tier listings.
2. `Networks` module exclusively owns peer-to-peer negotiation, reference checks, ISOs, and community feeds.
3. `Shared` module exclusively owns Clerk auth, overarching user profiles, and core vendor initializations.
4. Absolute isolation: No cross-contamination of concerns (e.g., Networks code should never import or invoke Finix payments).
5. All background workers, webhooks, and standalone scripts execute successfully with the newly segregated module configurations.
6. The codebase compiles with zero TypeScript errors (`npm run build` passes).

## Tech Stack
- **TypeScript & Node.js (Express)**: Core API framework.
- **Mongoose / MongoDB**: Data persistence (models strictly scoped by platform where appropriate).
- **Finix**: Payment processing pipeline (Marketplace only).
- **GetStream**: Chat functionality (listing-scoped channels for Marketplace, persistent peer-to-peer channels for Networks).
- **Clerk**: Identity and Authentication (Shared).

## File Structure
```text
src/
├── marketplace/
│   ├── handlers/        # Marketplace API handlers
│   ├── services/        # Finix, Marketplace Listings, Orders, Scoped Channels
│   └── routes/          # Marketplace API routers
├── networks/
│   ├── handlers/        # Networks API handlers
│   ├── services/        # Reference Checks, Feeds, ISOs, Peer Channels
│   └── routes/          # Networks API routers
├── shared/
│   ├── auth/            # Authentication middleware/services
│   ├── models/          # Base schemas (User, Notification)
│   └── infra/           # System bootstrapping/clients
```

## Task Breakdown

### Phase 1: System-Wide Audit & Integration
- **Task 1.1**: Audit and migrate existing background workers & cron jobs to use the new segregated service layer.
  - **Agent**: `backend-specialist` | **Skill**: `nodejs-best-practices`
  - **INPUT**: Existing cron jobs, queue processors, and worker files.
  - **OUTPUT**: Updated worker imports pointing strictly to `marketplace/services` or `networks/services`.
  - **VERIFY**: Run worker scripts locally `/ npm run build` to ensure successful execution without import/type errors.
- **Task 1.2**: Audit and migrate existing webhooks (Finix, GetStream) to align with the new routing.
  - **Agent**: `backend-specialist` | **Skill**: `api-patterns`
  - **INPUT**: Webhook route definitions and handler logic.
  - **OUTPUT**: Webhooks correctly routed to either Marketplace (Finix) or Shared/Networks (GetStream).
  - **VERIFY**: Trigger mock webhooks locally and ensure a 200 OK response from the expected module handler.

### Phase 2: Strict Conceptual Boundary Enforcement
- **Task 2.1**: Eradicate legacy payment/order logic from the `Networks` module.
  - **Agent**: `backend-specialist` | **Skill**: `clean-code`
  - **INPUT**: `src/networks/` directory.
  - **OUTPUT**: A `Networks` module completely decoupled from platform-facilitated order processing.
  - **VERIFY**: `grep` for `finix` or `order` in `src/networks/` returns 0 functional matches.
- **Task 2.2**: Eradicate peer-to-peer, feed, or reference check logic from the `Marketplace` module.
  - **Agent**: `backend-specialist` | **Skill**: `clean-code`
  - **INPUT**: `src/marketplace/` directory.
  - **OUTPUT**: A `Marketplace` module focused solely on structured B2C e-commerce flows.
  - **VERIFY**: `grep` for `reference` or `feed` in `src/marketplace/` returns 0 functional matches.

### Phase 3: Shared Core Consolidation
- **Task 3.1**: Solidify the `Shared` module by properly centralizing Auth, Notifications, and Database connections.
  - **Agent**: `architecture` | **Skill**: `architecture`
  - **INPUT**: Root level utils, middleware, and common services.
  - **OUTPUT**: A clean `shared` boundary used uniformly and safely by both platform modules.
  - **VERIFY**: Codebase builds successfully with no circular dependencies.

### Phase X: Final Verification
- [ ] Code compiles without errors (`npm run build`).
- [ ] Webhooks and background tasks initialized without crashes.
- [ ] Security scan passes (`python .agent/skills/vulnerability-scanner/scripts/security_scan.py .`).
- [ ] No strict dependency violations between Marketplace and Networks.
- [ ] Socratic Gate was respected.
- [ ] Test suite executes successfully (`npm run test`).
