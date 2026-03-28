# Batch 2 Pre-Production API Checklist

This checklist is for Batch 2 Part-1 and Part-2 Networks release readiness.

## 1) Required Inputs

Set at minimum:

```bash
export API_BASE_URL="https://<your-env>/api/v1"
export NETWORKS_SELLER_TOKEN="<jwt>"
```

Optional:

```bash
export NETWORKS_BUYER_TOKEN="<jwt>"
export RUN_MUTATION_TESTS="true"
```

Notes:

- Use non-production test users in staging/UAT.
- `RUN_MUTATION_TESTS=true` will call mark-read endpoints.

## 2) Run Smoke Test

```bash
npm run test:batch2:preprod
```

The script executes API calls across:

- Networks search/listings parity (canonical + alias compatibility)
- Notifications tabs and unread counts
- Connections incoming requests
- User reviews role filter
- Favorites/recent searches/user listings/ISOs
- Cross-domain dependencies used by Batch 2 screens (`/user/profile`, `/user/verification`, `/user/support/tickets/count/open`, `/news`)

## 3) Pass Criteria

- Exit code is `0`
- JSON report generated at:
  - `logs/batch2-preprod-api-report.json`
- `failed` count is `0`

## 4) Mandatory Manual Verification Before Production

1. Validate at least one real user flow on target env:

- Search listing with filters
- Open listing detail
- Friend request list
- Notification tabs (`all`, `buying`, `selling`)

2. Confirm notification behavior:

- Notification created from at least one offer event
- Notification created from at least one friend-request event
- `tab` filtering returns expected categories

3. Confirm critical dependency endpoints respond:

- `/api/v1/user/profile`
- `/api/v1/user/verification`
- `/api/v1/user/support/tickets/count/open`
- `/api/v1/news`

## 5) Release Gate

Do not proceed to production if any of the following is true:

- Smoke script has one or more failures
- Notification tab filtering returns inconsistent data
- Search and listings parity checks fail for canonical query keys
- Cross-domain dependency endpoints are unstable

## 6) Rollback Preparedness

Before deployment, prepare:

- Previous known-good image/tag
- DB backup snapshot
- Rollback command runbook
- On-call owner and alert channel
