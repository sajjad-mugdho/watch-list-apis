# Batch 2 Production Certification

Use this after smoke testing and before production deployment.

## 1) Required Environment

```bash
export API_BASE_URL="https://<your-env>/api/v1"
export NETWORKS_SELLER_TOKEN="<jwt>"
```

Optional:

```bash
export NETWORKS_BUYER_TOKEN="<jwt>"
export CERT_ITERATIONS="3"
export DEFAULT_LATENCY_THRESHOLD_MS="1200"
export RUN_MUTATION_TESTS="true"
```

## 2) Run Certification

```bash
npm run test:batch2:cert
```

Or run full gate (smoke + certification):

```bash
npm run test:batch2:gate
```

## 3) What Certification Enforces

1. Endpoint status correctness across repeated iterations.
2. Response shape assertions for critical Batch 2 APIs.
3. Query contract compatibility checks (canonical and alias handling).
4. Notification tab segmentation checks (`all`, `buying`, `selling`, `social`).
5. Latency gates using p95 thresholds per endpoint.

## 4) Artifacts

The certification run writes:

1. JSON report:

- `logs/batch2-production-certification-report.json`

2. Human-readable summary:

- `logs/batch2-production-certification-summary.txt`

## 5) Release Decision Rules

Block production if any condition is true:

1. `overallPassed` is `false`.
2. Any endpoint has `allPassed=false`.
3. Any endpoint has `latencyPassed=false`.
4. Any required dependency endpoint (`/user/profile`, `/user/verification`, `/user/support/tickets/count/open`, `/news`) fails.

## 6) Recommended Threshold Policy

1. Keep `DEFAULT_LATENCY_THRESHOLD_MS` at 1200ms for staging baseline.
2. Tighten per environment once data volume is stable.
3. Track p95 trend over releases, not only pass/fail snapshots.

## 7) Final Pre-Prod Sequence

1. `npm run type-check`
2. `npm run test:batch2:preprod`
3. `npm run test:batch2:cert`
4. Review both generated reports under `logs/`
5. Approve release only if all gates pass
