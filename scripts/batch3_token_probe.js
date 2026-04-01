#!/usr/bin/env node

/**
 * Batch 3 bearer-token probe for Networks APIs.
 *
 * Usage:
 *   NETWORKS_SELLER_TOKEN=... NETWORKS_BUYER_TOKEN=... node scripts/batch3_token_probe.js
 *
 * Optional env:
 *   API_BASE_URL=http://localhost:5050/api/v1
 *   RUN_MUTATION_TESTS=true
 */

const fs = require("fs");
const path = require("path");

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5050/api/v1";
const SELLER_TOKEN = process.env.NETWORKS_SELLER_TOKEN || process.env.API_TOKEN;
const BUYER_TOKEN = process.env.NETWORKS_BUYER_TOKEN;
const RUN_MUTATION_TESTS = process.env.RUN_MUTATION_TESTS === "true";
const RETRY_ON_429 = process.env.RETRY_ON_429 !== "false";
const MAX_429_RETRIES = Number(process.env.MAX_429_RETRIES || 4);
const RETRY_BASE_DELAY_MS = Number(process.env.RETRY_BASE_DELAY_MS || 400);
const INTER_REQUEST_DELAY_MS = Number(process.env.INTER_REQUEST_DELAY_MS || 5000); // 5s by default for low-rate pacing
const ENABLE_CHECKPOINT = process.env.ENABLE_CHECKPOINT !== "false";

if (!SELLER_TOKEN || !BUYER_TOKEN) {
  console.error(
    "Missing auth: set NETWORKS_SELLER_TOKEN and NETWORKS_BUYER_TOKEN.",
  );
  process.exit(1);
}

// Checkpoint file for resume support
const checkpointFile = path.join(process.cwd(), "logs", "batch3-token-probe-checkpoint.json");
let checkpoint = {};
function loadCheckpoint() {
  if (ENABLE_CHECKPOINT && fs.existsSync(checkpointFile)) {
    try {
      checkpoint = JSON.parse(fs.readFileSync(checkpointFile, "utf-8"));
      console.log(`[Checkpoint] Loaded ${Object.keys(checkpoint).length} completed endpoints`);
    } catch (_e) {
      checkpoint = {};
    }
  }
}

function saveCheckpoint() {
  if (ENABLE_CHECKPOINT) {
    fs.mkdirSync(path.dirname(checkpointFile), { recursive: true });
    fs.writeFileSync(checkpointFile, JSON.stringify(checkpoint, null, 2));
  }
}

const results = [];

function authHeaders(token, includeJson = false) {
  const headers = { Authorization: `Bearer ${token}` };
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRateLimitReset(resetEpochMs) {
  const now = Date.now();
  const waitMs = Math.max(0, resetEpochMs - now);
  if (waitMs > 0) {
    console.log(`[Rate-Limit] Window expires in ${(waitMs / 1000).toFixed(1)}s, waiting...`);
    await sleep(waitMs + 100); // +100ms buffer
  }
}

async function callApi({
  name,
  method,
  urlPath,
  token,
  expected,
  body,
  validate,
}) {
  // Check if already completed via checkpoint
  const checkpointKey = `${method} ${urlPath}`;
  if (checkpoint[checkpointKey]) {
    console.log(`[Checkpoint] SKIP ${method} ${urlPath} (already tested)`);
    return checkpoint[checkpointKey];
  }

  const fullUrl = `${API_BASE_URL}${urlPath}`;
  const expectedStatuses = asArray(expected);

  const reqInit = {
    method,
    headers: authHeaders(token, body !== undefined),
  };

  if (body !== undefined) reqInit.body = JSON.stringify(body);

  const startedAt = Date.now();

  let status = 0;
  let ok = false;
  let error = null;
  let responseText = "";
  let responseJson = null;
  let attempts = 0;
  let rateLimitRemaining = null;
  let rateLimitReset = null;

  try {
    while (true) {
      attempts += 1;
      const response = await fetch(fullUrl, reqInit);
      status = response.status;
      responseText = await response.text();

      // Capture rate-limit headers
      rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
      const rateLimitResetRaw = response.headers.get("x-ratelimit-reset");
      if (rateLimitResetRaw) {
        rateLimitReset = Number(rateLimitResetRaw) * 1000; // Convert to ms
      }

      if (status !== 429 || !RETRY_ON_429 || attempts > MAX_429_RETRIES) {
        break;
      }

      // If 429 and we have reset time, wait until reset
      if (status === 429 && rateLimitReset) {
        await waitForRateLimitReset(rateLimitReset);
      } else {
        const retryAfterRaw = response.headers.get("retry-after");
        const retryAfterMs = retryAfterRaw
          ? Number(retryAfterRaw) * 1000
          : RETRY_BASE_DELAY_MS * attempts;
        await sleep(Number.isFinite(retryAfterMs) ? retryAfterMs : RETRY_BASE_DELAY_MS * attempts);
      }
    }

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

  const row = {
    name,
    method,
    urlPath,
    fullUrl,
    expected: expectedStatuses,
    status,
    ok,
    attempts,
    durationMs,
    error,
    rateLimitRemaining,
    rateLimitReset,
    responsePreview: responseText ? responseText.slice(0, 400) : "",
  };

  results.push(row);
  const statusIndicator = ok ? "PASS" : "FAIL";
  const rateInfo = rateLimitRemaining !== null ? ` [RateLimit: ${rateLimitRemaining}/100]` : "";
  console.log(`${statusIndicator} ${method} ${urlPath} (${status}) ${durationMs}ms attempts=${attempts}${rateInfo} - ${name}`);
  if (!ok && error) console.log(`  -> ${error}`);

  // Save to checkpoint
  checkpoint[checkpointKey] = { row, responseJson };
  saveCheckpoint();

  if (INTER_REQUEST_DELAY_MS > 0 && !checkpoint[checkpointKey]) {
    // Only sleep if we just completed (not skipped from checkpoint)
    await sleep(INTER_REQUEST_DELAY_MS);
  }

  return { row, responseJson };
}

function requireObject(value) {
  return value && typeof value === "object";
}

function requireArray(value) {
  return Array.isArray(value);
}

(async () => {
  console.log("Batch 3 token probe starting...");
  console.log(`Base URL: ${API_BASE_URL}`);
  console.log(`Mutation tests: ${RUN_MUTATION_TESTS ? "enabled" : "disabled"}`);
  console.log(`Checkpoint support: ${ENABLE_CHECKPOINT ? "enabled" : "disabled"}`);
  console.log(`Inter-request delay: ${INTER_REQUEST_DELAY_MS}ms (rate-limit aware)`);

  // Load any prior checkpoint
  loadCheckpoint();

  // Seller stable endpoints
  const sellerListings = await callApi({
    name: "Seller listings feed",
    method: "GET",
    urlPath: "/networks/listings?page=1&limit=5",
    token: SELLER_TOKEN,
    expected: 200,
    validate: (json) => {
      if (!requireObject(json) || !requireArray(json.data)) return "missing data array";
      return null;
    },
  });

  await callApi({
    name: "Seller listings search",
    method: "GET",
    urlPath:
      "/networks/search?type=listing&q=rolex&page=1&limit=5&sort_by=created&sort_order=desc",
    token: SELLER_TOKEN,
    expected: 200,
    validate: (json) => {
      if (!requireObject(json) || !requireObject(json.data)) return "missing data object";
      return null;
    },
  });

  await callApi({
    name: "Seller offers received",
    method: "GET",
    urlPath: "/networks/offers?type=received&limit=10&offset=0",
    token: SELLER_TOKEN,
    expected: 200,
  });

  await callApi({
    name: "Seller offers sent",
    method: "GET",
    urlPath: "/networks/offers?type=sent&limit=10&offset=0",
    token: SELLER_TOKEN,
    expected: 200,
  });

  await callApi({
    name: "Seller orders",
    method: "GET",
    urlPath: "/networks/orders?limit=10&offset=0",
    token: SELLER_TOKEN,
    expected: 200,
  });

  await callApi({
    name: "Seller dashboard stats",
    method: "GET",
    urlPath: "/networks/user/dashboard/stats",
    token: SELLER_TOKEN,
    expected: 200,
  });

  await callApi({
    name: "Seller current user",
    method: "GET",
    urlPath: "/networks/user",
    token: SELLER_TOKEN,
    expected: 200,
  });

  await callApi({
    name: "Seller notifications all",
    method: "GET",
    urlPath: "/networks/notifications?tab=all&limit=10&offset=0",
    token: SELLER_TOKEN,
    expected: 200,
  });

  await callApi({
    name: "Seller notifications unread count",
    method: "GET",
    urlPath: "/networks/notifications/unread-count",
    token: SELLER_TOKEN,
    expected: 200,
    validate: (json) => {
      if (!requireObject(json) || !requireArray(json.data)) return null;
      return null;
    },
  });

  await callApi({
    name: "Seller connections incoming",
    method: "GET",
    urlPath: "/networks/connections/my-incoming?limit=10&offset=0",
    token: SELLER_TOKEN,
    expected: 200,
  });

  await callApi({
    name: "Seller connections outgoing",
    method: "GET",
    urlPath: "/networks/connections/my-outgoing?limit=10&offset=0",
    token: SELLER_TOKEN,
    expected: 200,
  });

  await callApi({
    name: "Seller accepted connections",
    method: "GET",
    urlPath: "/networks/connections?page=1&limit=10",
    token: SELLER_TOKEN,
    expected: 200,
  });

  const sellerOwnListings = await callApi({
    name: "Seller own listings",
    method: "GET",
    urlPath: "/networks/user/listings?status=all&limit=5",
    token: SELLER_TOKEN,
    expected: 200,
    validate: (json) => {
      if (!requireObject(json) || !requireArray(json.data)) return "missing data array";
      return null;
    },
  });

  // Buyer stable endpoints
  const buyerListings = await callApi({
    name: "Buyer listings feed",
    method: "GET",
    urlPath: "/networks/listings?page=1&limit=5",
    token: BUYER_TOKEN,
    expected: 200,
    validate: (json) => {
      if (!requireObject(json) || !requireArray(json.data)) return "missing data array";
      return null;
    },
  });

  await callApi({
    name: "Buyer listings search",
    method: "GET",
    urlPath: "/networks/search?type=listing&page=1&limit=5",
    token: BUYER_TOKEN,
    expected: 200,
  });

  await callApi({
    name: "Buyer favorites",
    method: "GET",
    urlPath: "/networks/user/favorites?type=listing&limit=5",
    token: BUYER_TOKEN,
    expected: 200,
  });

  await callApi({
    name: "Buyer recent searches",
    method: "GET",
    urlPath: "/networks/user/searches/recent?limit=5",
    token: BUYER_TOKEN,
    expected: 200,
  });

  await callApi({
    name: "Buyer reviews as buyer",
    method: "GET",
    urlPath: "/networks/user/reviews?role=buyer&limit=5",
    token: BUYER_TOKEN,
    expected: 200,
  });

  await callApi({
    name: "Buyer user ISOs",
    method: "GET",
    urlPath: "/networks/user/isos/my?status=all&limit=5",
    token: BUYER_TOKEN,
    expected: 200,
  });

  await callApi({
    name: "Buyer notifications unread count",
    method: "GET",
    urlPath: "/networks/notifications/unread-count",
    token: BUYER_TOKEN,
    expected: 200,
  });

  // Derive entity IDs dynamically from listing feed
  const sellerListing = sellerListings.responseJson?.data?.find(
    (x) => x && x._id,
  );
  const sellerOwnedListing = sellerOwnListings.responseJson?.data?.find(
    (x) => x && x._id,
  );
  const buyerListing = buyerListings.responseJson?.data?.find((x) => x && x._id);

  if (sellerOwnedListing?._id) {
    await callApi({
      name: "Seller listing detail",
      method: "GET",
      urlPath: `/networks/listings/${sellerOwnedListing._id}`,
      token: SELLER_TOKEN,
      expected: 200,
    });

    await callApi({
      name: "Seller listing preview",
      method: "GET",
      urlPath: `/networks/listings/${sellerOwnedListing._id}/preview`,
      token: SELLER_TOKEN,
      expected: [200, 403, 404],
    });
  }

  if (buyerListing?._id) {
    await callApi({
      name: "Buyer listing detail",
      method: "GET",
      urlPath: `/networks/listings/${buyerListing._id}`,
      token: BUYER_TOKEN,
      expected: 200,
    });
  }

  const candidateUserId =
    sellerListing?.author?._id || sellerListing?.dialist_id || sellerListing?.user_id;

  if (candidateUserId) {
    await callApi({
      name: "Buyer views seller profile",
      method: "GET",
      urlPath: `/networks/users/${candidateUserId}/profile`,
      token: BUYER_TOKEN,
      expected: [200, 404],
    });

    await callApi({
      name: "Buyer views seller listings",
      method: "GET",
      urlPath: `/networks/users/${candidateUserId}/listings?status=active&type=for_sale&page=1&limit=10`,
      token: BUYER_TOKEN,
      expected: [200, 404],
    });
  }

  if (RUN_MUTATION_TESTS && candidateUserId) {
    const connect = await callApi({
      name: "Buyer send connection request",
      method: "POST",
      urlPath: `/networks/users/${candidateUserId}/connections`,
      token: BUYER_TOKEN,
      expected: [201, 400, 404],
    });

    if (connect.row.status === 201 || connect.row.status === 400) {
      await callApi({
        name: "Buyer remove connection",
        method: "DELETE",
        urlPath: `/networks/users/${candidateUserId}/connections`,
        token: BUYER_TOKEN,
        expected: [200, 404],
      });
    }
  }

  const totals = {
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    checkpointRecovered: Object.keys(checkpoint).length,
  };

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: API_BASE_URL,
    authMode: "token",
    runMutationTests: RUN_MUTATION_TESTS,
    checkpointSupport: ENABLE_CHECKPOINT,
    interRequestDelayMs: INTER_REQUEST_DELAY_MS,
    totals,
    results,
    checkpointSummary: {
      file: checkpointFile,
      recoveredCount: Object.keys(checkpoint).length,
    },
  };

  const reportDir = path.join(process.cwd(), "logs");
  fs.mkdirSync(reportDir, { recursive: true });

  const reportPath = path.join(reportDir, "batch3-token-probe-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("\nSummary:");
  console.log(`  Passed: ${totals.passed}`);
  console.log(`  Failed: ${totals.failed}`);
  console.log(`  Total: ${totals.total}`);
  console.log(`  Checkpoint recovered: ${totals.checkpointRecovered}`);
  console.log(`  Report: ${reportPath}`);
  console.log(`  Checkpoint: ${checkpointFile}`);

  if (totals.failed > 0) process.exit(1);
})();
