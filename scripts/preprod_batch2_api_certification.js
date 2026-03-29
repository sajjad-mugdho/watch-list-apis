#!/usr/bin/env node

/**
 * Batch 2 production certification API pass.
 *
 * Usage:
 *   NETWORKS_SELLER_TOKEN=... NETWORKS_BUYER_TOKEN=... node scripts/preprod_batch2_api_certification.js
 *
 * Optional env:
 *   API_BASE_URL=http://localhost:5050/api/v1
 *   NETWORKS_SELLER_TEST_USER=merchant_approved
 *   NETWORKS_BUYER_TEST_USER=buyer_us_complete
 *   CERT_ITERATIONS=3
 *   DEFAULT_LATENCY_THRESHOLD_MS=1200
 *   RUN_MUTATION_TESTS=true
 */

const fs = require("fs");
const path = require("path");

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5050/api/v1";
const SELLER_TOKEN = process.env.NETWORKS_SELLER_TOKEN || process.env.API_TOKEN;
const BUYER_TOKEN = process.env.NETWORKS_BUYER_TOKEN || SELLER_TOKEN;
const SELLER_TEST_USER = process.env.NETWORKS_SELLER_TEST_USER;
const BUYER_TEST_USER =
  process.env.NETWORKS_BUYER_TEST_USER || SELLER_TEST_USER;

const CERT_ITERATIONS = Number(process.env.CERT_ITERATIONS || 3);
const DEFAULT_LATENCY_THRESHOLD_MS = Number(
  process.env.DEFAULT_LATENCY_THRESHOLD_MS || 1200,
);
const RUN_MUTATION_TESTS = process.env.RUN_MUTATION_TESTS === "true";

if (!SELLER_TOKEN && !SELLER_TEST_USER) {
  console.error(
    "Missing auth: set NETWORKS_SELLER_TOKEN (or API_TOKEN) OR NETWORKS_SELLER_TEST_USER.\n",
  );
  process.exit(1);
}

const SELLER_AUTH = { token: SELLER_TOKEN, testUser: SELLER_TEST_USER };
const BUYER_AUTH = { token: BUYER_TOKEN, testUser: BUYER_TEST_USER };

function authHeaders(auth, includeJson = false) {
  const headers = {};
  if (auth?.testUser) {
    headers["x-test-user"] = auth.testUser;
  } else {
    headers.Authorization = `Bearer ${auth?.token}`;
  }
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}

function requireObject(value) {
  return value && typeof value === "object";
}

function average(numbers) {
  if (!numbers.length) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function percentile(numbers, p) {
  if (!numbers.length) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function sanitizePathForMap(pathValue) {
  return pathValue
    .replace(/\?.*$/, "")
    .replace(/[{}]/g, "")
    .replace(/\//g, "_")
    .replace(/^_+/, "");
}

async function callEndpoint(endpoint, auth, iteration) {
  const startedAt = Date.now();
  const fullUrl = `${API_BASE_URL}${endpoint.urlPath}`;
  let status = 0;
  let responseText = "";
  let responseJson = null;
  let error = null;

  try {
    const response = await fetch(fullUrl, {
      method: endpoint.method,
      headers: authHeaders(auth, endpoint.body !== undefined),
      ...(endpoint.body !== undefined
        ? { body: JSON.stringify(endpoint.body) }
        : {}),
    });

    status = response.status;
    responseText = await response.text();
    try {
      responseJson = responseText ? JSON.parse(responseText) : null;
    } catch (_e) {
      responseJson = null;
    }
  } catch (e) {
    error = `Request error: ${e.message}`;
  }

  const durationMs = Date.now() - startedAt;
  const expectedStatuses = Array.isArray(endpoint.expected)
    ? endpoint.expected
    : [endpoint.expected];

  let ok = !error && expectedStatuses.includes(status);
  let validationError = null;

  if (ok && typeof endpoint.validate === "function") {
    validationError = endpoint.validate(responseJson);
    if (validationError) ok = false;
  }

  if (!ok && !error && !validationError) {
    validationError = `Expected status ${expectedStatuses.join("/")}, got ${status}`;
  }

  return {
    endpointName: endpoint.name,
    endpointPath: endpoint.urlPath,
    method: endpoint.method,
    iteration,
    durationMs,
    status,
    ok,
    error: error || validationError,
    responsePreview: responseText.slice(0, 300),
  };
}

async function runCertification() {
  const runRows = [];
  console.log(
    `Auth mode: ${SELLER_TEST_USER ? `mock-user (${SELLER_TEST_USER})` : "token"}`,
  );

  const endpoints = [
    {
      name: "Profile dependency",
      method: "GET",
      urlPath: "/user/profile",
      expected: 200,
      validate: (json) => {
        if (!requireObject(json) || !requireObject(json.data))
          return "missing data";
        return null;
      },
    },
    {
      name: "Verification dependency",
      method: "GET",
      urlPath: "/user/verification",
      expected: 200,
    },
    {
      name: "Support dependency",
      method: "GET",
      urlPath: "/user/support/tickets/count/open",
      expected: 200,
    },
    {
      name: "News dependency",
      method: "GET",
      urlPath: "/news",
      expected: 200,
    },
    {
      name: "Dashboard stats",
      method: "GET",
      urlPath: "/networks/user/dashboard/stats",
      expected: 200,
    },
    {
      name: "Search canonical",
      method: "GET",
      urlPath:
        "/networks/search?type=listing&q=rolex&page=1&limit=10&sort_by=created&sort_order=desc",
      expected: 200,
      validate: (json) => {
        if (!requireObject(json)) return "missing body";
        if (!requireObject(json.data)) return "missing data";
        if (!requireObject(json.pagination)) return "missing pagination";
        return null;
      },
      latencyThresholdMs: 1000,
    },
    {
      name: "Search aliases",
      method: "GET",
      urlPath:
        "/networks/search?type=listing&min_year=2020&max_year=2025&sort=mostPopular&offset=0&limit=10",
      expected: 200,
      latencyThresholdMs: 1000,
    },
    {
      name: "Search offers parity",
      method: "GET",
      urlPath:
        "/networks/search?type=listing&allow_offers=true&page=1&limit=10",
      expected: 200,
      latencyThresholdMs: 1000,
    },
    {
      name: "Listings canonical",
      method: "GET",
      urlPath:
        "/networks/listings?page=1&limit=10&year_min=2000&year_max=2030&sort_by=popularity&sort_order=desc",
      expected: 200,
      validate: (json) => {
        if (!requireObject(json)) return "missing body";
        if (!Array.isArray(json.data)) return "missing data array";
        if (
          !requireObject(json._metadata) ||
          !requireObject(json._metadata.paging)
        ) {
          return "missing metadata paging";
        }
        return null;
      },
      latencyThresholdMs: 1000,
    },
    {
      name: "Listings offers parity",
      method: "GET",
      urlPath: "/networks/listings?allow_offers=true&page=1&limit=10",
      expected: 200,
      latencyThresholdMs: 1000,
    },
    {
      name: "Popular brands",
      method: "GET",
      urlPath: "/networks/search/popular-brands",
      expected: 200,
      latencyThresholdMs: 900,
    },
    {
      name: "User listings",
      method: "GET",
      urlPath: "/networks/user/listings?status=all&limit=10",
      expected: 200,
    },
    {
      name: "User ISOs",
      method: "GET",
      urlPath: "/networks/user/isos/my?status=all&limit=10",
      expected: 200,
    },
    {
      name: "User reviews buyer",
      method: "GET",
      urlPath: "/networks/user/reviews?role=buyer&limit=10",
      expected: 200,
    },
    {
      name: "User reviews seller",
      method: "GET",
      urlPath: "/networks/user/reviews?role=seller&limit=10",
      expected: 200,
    },
    {
      name: "Connections incoming",
      method: "GET",
      urlPath: "/networks/connections/my-incoming?limit=10&offset=0",
      expected: 200,
    },
    {
      name: "Notifications all",
      method: "GET",
      urlPath: "/networks/notifications?tab=all&limit=10&offset=0",
      expected: 200,
      validate: (json) => {
        if (!requireObject(json)) return "missing body";
        if (!Array.isArray(json.data)) return "missing data array";
        if (typeof json.unread_count !== "number")
          return "missing unread_count";
        return null;
      },
      latencyThresholdMs: 1000,
    },
    {
      name: "Notifications buying",
      method: "GET",
      urlPath: "/networks/notifications?tab=buying&limit=10&offset=0",
      expected: 200,
      latencyThresholdMs: 1000,
    },
    {
      name: "Notifications selling",
      method: "GET",
      urlPath: "/networks/notifications?tab=selling&limit=10&offset=0",
      expected: 200,
      latencyThresholdMs: 1000,
    },
    {
      name: "Notifications social",
      method: "GET",
      urlPath: "/networks/notifications?tab=social&limit=10&offset=0",
      expected: 200,
      latencyThresholdMs: 1000,
    },
    {
      name: "Notifications unread count",
      method: "GET",
      urlPath: "/networks/notifications/unread-count",
      expected: 200,
      latencyThresholdMs: 800,
    },
  ];

  if (
    (BUYER_TEST_USER && BUYER_TEST_USER !== SELLER_TEST_USER) ||
    (BUYER_TOKEN && BUYER_TOKEN !== SELLER_TOKEN)
  ) {
    endpoints.push({
      name: "Buyer perspective search",
      method: "GET",
      urlPath: "/networks/search?type=listing&page=1&limit=10",
      expected: 200,
      auth: BUYER_AUTH,
      latencyThresholdMs: 1000,
    });
  }

  if (RUN_MUTATION_TESTS) {
    endpoints.push({
      name: "Notifications mark all read buying",
      method: "POST",
      urlPath: "/networks/notifications/mark-all-read?tab=buying",
      expected: 200,
      body: {},
    });
  }

  for (const endpoint of endpoints) {
    for (let i = 1; i <= CERT_ITERATIONS; i += 1) {
      const auth = endpoint.auth || SELLER_AUTH;
      const row = await callEndpoint(endpoint, auth, i);
      runRows.push(row);

      const prefix = row.ok ? "PASS" : "FAIL";
      console.log(
        `${prefix} ${endpoint.method} ${endpoint.urlPath} iter=${i} status=${row.status} ${row.durationMs}ms`,
      );
      if (!row.ok && row.error) {
        console.log(`  -> ${row.error}`);
      }
    }
  }

  const grouped = {};
  for (const row of runRows) {
    const groupKey = `${row.method} ${row.endpointPath}`;
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(row);
  }

  const endpointSummaries = Object.entries(grouped).map(([groupKey, rows]) => {
    const durations = rows.map((r) => r.durationMs);
    const allPassed = rows.every((r) => r.ok);
    const p95 = percentile(durations, 95);
    const avg = average(durations);

    const endpoint = endpoints.find(
      (e) => `${e.method} ${e.urlPath}` === groupKey,
    );
    const thresholdMs =
      endpoint?.latencyThresholdMs || DEFAULT_LATENCY_THRESHOLD_MS;
    const latencyPassed = p95 <= thresholdMs;

    return {
      endpoint: groupKey,
      iterations: rows.length,
      allPassed,
      latencyPassed,
      latencyThresholdMs: thresholdMs,
      avgMs: Number(avg.toFixed(2)),
      p95Ms: p95,
      minMs: Math.min(...durations),
      maxMs: Math.max(...durations),
      failures: rows
        .filter((r) => !r.ok)
        .map((r) => ({
          iteration: r.iteration,
          status: r.status,
          error: r.error,
        })),
    };
  });

  const totals = {
    totalCalls: runRows.length,
    passedCalls: runRows.filter((r) => r.ok).length,
    failedCalls: runRows.filter((r) => !r.ok).length,
    totalEndpoints: endpointSummaries.length,
    passedEndpoints: endpointSummaries.filter((s) => s.allPassed).length,
    failedEndpoints: endpointSummaries.filter((s) => !s.allPassed).length,
    latencyFailedEndpoints: endpointSummaries.filter((s) => !s.latencyPassed)
      .length,
  };

  const overallPassed =
    totals.failedCalls === 0 &&
    totals.failedEndpoints === 0 &&
    totals.latencyFailedEndpoints === 0;

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: API_BASE_URL,
    iterations: CERT_ITERATIONS,
    defaultLatencyThresholdMs: DEFAULT_LATENCY_THRESHOLD_MS,
    runMutationTests: RUN_MUTATION_TESTS,
    overallPassed,
    totals,
    endpointSummaries,
    runRows,
  };

  const reportDir = path.join(process.cwd(), "logs");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(
    reportDir,
    "batch2-production-certification-report.json",
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const summaryFile = path.join(
    reportDir,
    "batch2-production-certification-summary.txt",
  );
  const summaryLines = [
    `Batch 2 Production Certification`,
    `Timestamp: ${report.timestamp}`,
    `Base URL: ${API_BASE_URL}`,
    `Iterations: ${CERT_ITERATIONS}`,
    `Overall Passed: ${overallPassed}`,
    `Total Calls: ${totals.totalCalls}`,
    `Failed Calls: ${totals.failedCalls}`,
    `Failed Endpoints: ${totals.failedEndpoints}`,
    `Latency Failed Endpoints: ${totals.latencyFailedEndpoints}`,
    "",
    "Latency Violations:",
    ...endpointSummaries
      .filter((s) => !s.latencyPassed)
      .map(
        (s) =>
          `- ${s.endpoint} p95=${s.p95Ms}ms threshold=${s.latencyThresholdMs}ms`,
      ),
    "",
    "Endpoint Failures:",
    ...endpointSummaries
      .filter((s) => !s.allPassed)
      .map((s) => `- ${s.endpoint}`),
  ];
  fs.writeFileSync(summaryFile, `${summaryLines.join("\n")}\n`);

  console.log("\nCertification Summary:");
  console.log(`  Overall Passed: ${overallPassed}`);
  console.log(`  Failed Calls: ${totals.failedCalls}`);
  console.log(`  Failed Endpoints: ${totals.failedEndpoints}`);
  console.log(`  Latency Failed Endpoints: ${totals.latencyFailedEndpoints}`);
  console.log(`  JSON Report: ${reportPath}`);
  console.log(`  Text Summary: ${summaryFile}`);

  if (!overallPassed) {
    process.exit(1);
  }
}

runCertification().catch((err) => {
  console.error(`Unhandled certification error: ${err.message}`);
  process.exit(1);
});
