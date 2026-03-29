#!/usr/bin/env node

/**
 * Batch 2 (Part-1 + Part-2) pre-production API smoke test.
 *
 * Usage:
 *   NETWORKS_SELLER_TOKEN=... NETWORKS_BUYER_TOKEN=... node scripts/preprod_batch2_api_smoke.js
 *
 * Optional env:
 *   API_BASE_URL=http://localhost:5050/api/v1
 *   NETWORKS_SELLER_TEST_USER=merchant_approved
 *   NETWORKS_BUYER_TEST_USER=buyer_us_complete
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
const RUN_MUTATION_TESTS = process.env.RUN_MUTATION_TESTS === "true";

if (!SELLER_TOKEN && !SELLER_TEST_USER) {
  console.error(
    "Missing auth: set NETWORKS_SELLER_TOKEN (or API_TOKEN) OR NETWORKS_SELLER_TEST_USER.",
  );
  process.exit(1);
}

const results = [];
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

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function callApi({
  name,
  method,
  urlPath,
  auth,
  expected = 200,
  body,
  validate,
}) {
  const expectedStatuses = asArray(expected);
  const fullUrl = `${API_BASE_URL}${urlPath}`;
  const reqInit = {
    method,
    headers: authHeaders(auth, body !== undefined),
  };

  if (body !== undefined) {
    reqInit.body = JSON.stringify(body);
  }

  const startedAt = Date.now();
  let status = 0;
  let ok = false;
  let error = null;
  let responseJson = null;
  let responseText = "";

  try {
    const response = await fetch(fullUrl, reqInit);
    status = response.status;
    responseText = await response.text();
    try {
      responseJson = responseText ? JSON.parse(responseText) : null;
    } catch (_e) {
      responseJson = null;
    }

    ok = expectedStatuses.includes(status);

    if (ok && typeof validate === "function") {
      const validationError = validate(responseJson);
      if (validationError) {
        ok = false;
        error = `Validation failed: ${validationError}`;
      }
    }

    if (!ok && !error) {
      error = `Expected status ${expectedStatuses.join("/")}, got ${status}`;
    }
  } catch (e) {
    ok = false;
    error = `Request error: ${e.message}`;
  }

  const durationMs = Date.now() - startedAt;
  const result = {
    name,
    method,
    urlPath,
    fullUrl,
    expected: expectedStatuses,
    status,
    ok,
    durationMs,
    error,
    responsePreview: responseText ? responseText.slice(0, 500) : "",
  };

  results.push(result);

  const prefix = ok ? "PASS" : "FAIL";
  console.log(
    `${prefix} ${method} ${urlPath} (${status}) ${durationMs}ms - ${name}`,
  );
  if (!ok && error) {
    console.log(`  -> ${error}`);
  }

  return { result, responseJson };
}

function requireObject(value) {
  return value && typeof value === "object";
}

(async () => {
  console.log("Batch 2 pre-production smoke test starting...");
  console.log(`Base URL: ${API_BASE_URL}`);
  console.log(`Mutation tests: ${RUN_MUTATION_TESTS ? "enabled" : "disabled"}`);
  console.log(
    `Auth mode: ${SELLER_TEST_USER ? `mock-user (${SELLER_TEST_USER})` : "token"}`,
  );

  let listingId = null;
  let notificationId = null;

  await callApi({
    name: "Profile dependency check",
    method: "GET",
    urlPath: "/user/profile",
    auth: SELLER_AUTH,
    expected: 200,
    validate: (json) => {
      if (!requireObject(json) || !requireObject(json.data))
        return "missing data object";
      return null;
    },
  });

  await callApi({
    name: "Verification dependency check",
    method: "GET",
    urlPath: "/user/verification",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "Support count dependency check",
    method: "GET",
    urlPath: "/user/support/tickets/count/open",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "News dependency check",
    method: "GET",
    urlPath: "/news",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "Networks dashboard stats",
    method: "GET",
    urlPath: "/networks/user/dashboard/stats",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "Unified search canonical query",
    method: "GET",
    urlPath:
      "/networks/search?type=listing&q=rolex&page=1&limit=5&sort_by=created&sort_order=desc",
    auth: SELLER_AUTH,
    expected: 200,
    validate: (json) => {
      if (!requireObject(json) || !requireObject(json.data))
        return "missing data";
      if (!requireObject(json.pagination)) return "missing pagination";
      return null;
    },
  });

  await callApi({
    name: "Unified search alias compatibility",
    method: "GET",
    urlPath:
      "/networks/search?type=listing&min_year=2020&max_year=2025&sort=mostPopular&offset=0&limit=5",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "Unified search offers filter parity",
    method: "GET",
    urlPath: "/networks/search?type=listing&allow_offers=true&page=1&limit=5",
    auth: SELLER_AUTH,
    expected: 200,
  });

  const listingsResponse = await callApi({
    name: "Listings canonical query",
    method: "GET",
    urlPath:
      "/networks/listings?page=1&limit=5&year_min=2000&year_max=2030&sort_by=popularity&sort_order=desc",
    auth: SELLER_AUTH,
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
  });

  if (
    listingsResponse.responseJson &&
    Array.isArray(listingsResponse.responseJson.data)
  ) {
    const first = listingsResponse.responseJson.data[0];
    if (first && first._id) {
      listingId = first._id;
    }
  }

  await callApi({
    name: "Listings offers filter parity",
    method: "GET",
    urlPath: "/networks/listings?allow_offers=true&page=1&limit=5",
    auth: SELLER_AUTH,
    expected: 200,
  });

  if (listingId) {
    await callApi({
      name: "Listing detail",
      method: "GET",
      urlPath: `/networks/listings/${listingId}`,
      auth: SELLER_AUTH,
      expected: 200,
    });
  } else {
    results.push({
      name: "Listing detail",
      method: "GET",
      urlPath: "/networks/listings/:id",
      expected: [200],
      status: 0,
      ok: false,
      durationMs: 0,
      error: "Skipped: no listing id returned from listings query",
      responsePreview: "",
      skipped: true,
    });
    console.log(
      "FAIL GET /networks/listings/:id (skipped) - no listing id available",
    );
  }

  await callApi({
    name: "Popular brands",
    method: "GET",
    urlPath: "/networks/search/popular-brands",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "User listings",
    method: "GET",
    urlPath: "/networks/user/listings?status=all&limit=5",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "User ISOs",
    method: "GET",
    urlPath: "/networks/user/isos/my?status=all&limit=5",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "User reviews role filter (buyer)",
    method: "GET",
    urlPath: "/networks/user/reviews?role=buyer&limit=5",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "Favorites listing filter",
    method: "GET",
    urlPath: "/networks/user/favorites?type=listing&limit=5",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "Recent searches",
    method: "GET",
    urlPath: "/networks/user/searches/recent?limit=5",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "Connections incoming",
    method: "GET",
    urlPath: "/networks/connections/my-incoming?limit=5&offset=0",
    auth: SELLER_AUTH,
    expected: 200,
  });

  const notificationsAll = await callApi({
    name: "Notifications all tab",
    method: "GET",
    urlPath: "/networks/notifications?tab=all&limit=5&offset=0",
    auth: SELLER_AUTH,
    expected: 200,
    validate: (json) => {
      if (!requireObject(json)) return "missing body";
      if (!Array.isArray(json.data)) return "missing data array";
      if (typeof json.unread_count !== "number") return "missing unread_count";
      return null;
    },
  });

  await callApi({
    name: "Notifications buying tab",
    method: "GET",
    urlPath: "/networks/notifications?tab=buying&limit=5&offset=0",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "Notifications selling tab",
    method: "GET",
    urlPath: "/networks/notifications?tab=selling&limit=5&offset=0",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "Notifications social tab",
    method: "GET",
    urlPath: "/networks/notifications?tab=social&limit=5&offset=0",
    auth: SELLER_AUTH,
    expected: 200,
  });

  await callApi({
    name: "Notifications unread count",
    method: "GET",
    urlPath: "/networks/notifications/unread-count",
    auth: SELLER_AUTH,
    expected: 200,
  });

  if (
    notificationsAll.responseJson &&
    Array.isArray(notificationsAll.responseJson.data)
  ) {
    const first = notificationsAll.responseJson.data[0];
    if (first && first.id) {
      notificationId = first.id;
    }
  }

  if (RUN_MUTATION_TESTS) {
    await callApi({
      name: "Notifications mark all read (buying)",
      method: "POST",
      urlPath: "/networks/notifications/mark-all-read?tab=buying",
      auth: SELLER_AUTH,
      expected: 200,
      body: {},
    });

    if (notificationId) {
      await callApi({
        name: "Notification mark one read",
        method: "POST",
        urlPath: `/networks/notifications/${notificationId}/read`,
        auth: SELLER_AUTH,
        expected: 200,
        body: {},
      });
    }
  }

  if (
    (BUYER_TEST_USER && BUYER_TEST_USER !== SELLER_TEST_USER) ||
    (BUYER_TOKEN && BUYER_TOKEN !== SELLER_TOKEN)
  ) {
    await callApi({
      name: "Buyer perspective smoke",
      method: "GET",
      urlPath: "/networks/search?type=listing&page=1&limit=5",
      auth: BUYER_AUTH,
      expected: 200,
    });
  }

  const failed = results.filter((r) => !r.ok);
  const skipped = results.filter((r) => r.skipped);
  const passed = results.filter((r) => r.ok);

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: API_BASE_URL,
    runMutationTests: RUN_MUTATION_TESTS,
    totals: {
      total: results.length,
      passed: passed.length,
      failed: failed.length,
      skipped: skipped.length,
    },
    results,
  };

  const reportDir = path.join(process.cwd(), "logs");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, "batch2-preprod-api-report.json");
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log("\nSummary:");
  console.log(`  Passed: ${passed.length}`);
  console.log(`  Failed: ${failed.length}`);
  console.log(`  Skipped: ${skipped.length}`);
  console.log(`  Report: ${reportFile}`);

  if (failed.length > 0) {
    process.exit(1);
  }
})();
