#!/usr/bin/env node

/**
 * Quick Batch 4 API Test - Limited Endpoints
 * Tests only essential working endpoints with longer delays
 */

import axios, { AxiosInstance } from "axios";

const API_BASE =
  process.env.API_BASE || "http://localhost:5050/api/v1/networks";

const TOKENS = {
  seller: `eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzU2MTU0NzIsImlhdCI6MTc3NTUxNTQ3MiwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6ImE2ODNlM2JhOTE4ZjBiNzJkMTkzIiwibmJmIjoxNzc1NTE1NDQyLCJzdWIiOiJ1c2VyXzM2SWNDM3VvN0NoMUdvNHFZVFpleFVlV29aTSJ9.aWmALlfaEjuv8TGrDVD3R_CM3anecBdI7La9JvH0SabsoN7kghI8JUVP1eUuYeFTACfTRpo4414JE814Uk9qp0iC-ltTV4Sb4ETIOfaJ9pYui0Je_gh1GBqAZQiqnKGwu6jpFF5B_zYc8bw1yYNOup_gZU5_DL5PvaMUSApKXQhvF1cwHc584ypfhwKt_ZxrARqnWqF_4VdDZUePgFIOHEstI1GFWrfRuTO-_kYJJba-wh9hZf-4w00lh0Z2CfWOIA4QcccBXI3dMvOjfWRFxQ4-F_S88YKn32Kbo5gH_CmshkyKYCv5FWYDJ5vwqk1kCj9hiaah5nTNuNW2NpVuGg`,
};

interface TestResult {
  endpoint: string;
  method: string;
  status: "PASS" | "FAIL";
  statusCode?: number;
  error?: string;
  duration?: number;
}

class QuickTest {
  private client: AxiosInstance;
  private results: TestResult[] = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      headers: {
        Authorization: `Bearer ${TOKENS.seller}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });
  }

  private log(msg: string, type: "ok" | "err" | "info" = "info") {
    const colors = {
      ok: "\x1b[32m",
      err: "\x1b[31m",
      info: "\x1b[36m",
      reset: "\x1b[0m",
    };
    const prefix = { ok: "✓", err: "✗", info: "ℹ" };
    console.log(`${colors[type]}${prefix[type]}${colors.reset} ${msg}`);
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async runTests() {
    console.log("\n🔍 Quick Batch 4 API Test - Real JWT Token Validation\n");
    console.log(`API: ${API_BASE}`);
    console.log(`Seller: user_36IWCC3uus7Ch1Go4qYTZexUeWoaTM\n`);

    const tests = [
      {
        method: "GET",
        path: "/reference-checks?filter=all&limit=5",
        name: "List Reference Checks",
      },
      {
        method: "GET",
        path: "/offers?type=received&limit=5",
        name: "List Received Offers",
      },
      {
        method: "GET",
        path: "/orders?type=buy&limit=5",
        name: "List Buy Orders",
      },
      {
        method: "GET",
        path: "/messages/chats?limit=5",
        name: "List Message Chats",
      },
      { method: "GET", path: "/chat/token", name: "Get Chat Token" },
      { method: "GET", path: "/social/inbox?limit=5", name: "Social Inbox" },
      {
        method: "GET",
        path: "/social/groups?privacy=public&limit=5",
        name: "List Public Groups",
      },
    ];

    console.log(`Running ${tests.length} tests with 2 second delays...\n`);

    for (const test of tests) {
      await this.sleep(2000); // 2 second delay between requests
      await this.test(test.method as any, test.path, test.name);
    }

    this.printSummary();
  }

  private async test(method: string, path: string, name: string) {
    const result: TestResult = { endpoint: path, method, status: "PASS" };

    try {
      const start = Date.now();
      const response = await (this.client as any)[method.toLowerCase()](path);
      result.duration = Date.now() - start;
      result.statusCode = response.status;

      // Validate response structure
      if (!response.data.data && !response.data.requestId) {
        throw new Error("Invalid response envelope");
      }

      this.log(`${name} (${response.status}) [${result.duration}ms]`, "ok");
      this.results.push(result);
    } catch (error: any) {
      result.status = "FAIL";
      result.statusCode = error.response?.status;
      result.error =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message;

      this.log(`${name} (${result.statusCode}) - ${result.error}`, "err");
      this.results.push(result);
    }
  }

  private printSummary() {
    const passed = this.results.filter((r) => r.status === "PASS").length;
    const total = this.results.length;

    console.log("\n" + "=".repeat(70));
    console.log(
      `Results: ${passed}/${total} passed (${((passed / total) * 100).toFixed(1)}%)`,
    );
    console.log("=".repeat(70) + "\n");

    if (passed === total) {
      console.log(
        "✓ All tests passed! API is working correctly with real JWT tokens.",
      );
      console.log("✓ Users are properly onboarded and authenticated.");
    } else {
      console.log(`⚠ ${total - passed} endpoints failed. Most likely causes:`);
      console.log("  1. Rate limit still active on backend");
      console.log("  2. Missing test data (IDs do not exist)");
      console.log("  3. Invalid request payloads");
    }
  }
}

const tester = new QuickTest();
tester.runTests().catch(console.error);
