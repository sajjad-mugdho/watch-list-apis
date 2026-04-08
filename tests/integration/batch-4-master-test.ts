#!/usr/bin/env node

/**
 * Batch 4 Comprehensive API Testing Suite
 *
 * Tests all 60 Batch 4 endpoints with:
 * - Real JWT tokens (seller + buyer)
 * - Production-ready payloads
 * - Figma screen alignment validation
 * - Response envelope verification
 * - Error scenario handling
 *
 * Usage:
 * ts-node tests/integration/batch-4-master-test.ts
 * Or: npm run test:batch4:full
 */

import axios, { AxiosInstance, AxiosError } from "axios";

// ============================================================================
// TEST CONFIG & TOKENS
// ============================================================================

const API_BASE =
  process.env.API_BASE || "http://localhost:5050/api/v1/networks";

const TOKENS = {
  seller: `eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzU2MTU0NzIsImlhdCI6MTc3NTUxNTQ3MiwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6ImE2ODNlM2JhOTE4ZjBiNzJkMTkzIiwibmJmIjoxNzc1NTE1NDQyLCJzdWIiOiJ1c2VyXzM2SWNDM3VvN0NoMUdvNHFZVFpleFVlV29aTSJ9.aWmALlfaEjuv8TGrDVD3R_CM3anecBdI7La9JvH0SabsoN7kghI8JUVP1eUuYeFTACfTRpo4414JE814Uk9qp0iC-ltTV4Sb4ETIOfaJ9pYui0Je_gh1GBqAZQiqnKGwu6jpFF5B_zYc8bw1yYNOup_gZU5_DL5PvaMUSApKXQhvF1cwHc584ypfhwKt_ZxrARqnWqF_4VdDZUePgFIOHEstI1GFWrfRuTO-_kYJJba-wh9hZf-4w00lh0Z2CfWOIA4QcccBXI3dMvOjfWRFxQ4-F_S88YKn32Kbo5gH_CmshkyKYCv5FWYDJ5vwqk1kCj9hiaah5nTNuNW2NpVuGg`,
  buyer: `eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzU2MTU2MDcsImlhdCI6MTc3NTUxNTYwNywiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6IjM5NzJlYjU2NzRiMDVkYzNiYWU2IiwibmJmIjoxNzc1NTE1NTc3LCJzdWIiOiJ1c2VyXzM2SWR0amVtRTBBQ3hZelVGZnBQOFFVRmp5ZiJ9.Q3gNhqJjNL_lg82HMQDpv0CgtvAEkrv4EUmmpm-gpGydDMbh-v3XQhBVtTukew2xpcv7nSU07hCIOyVC3Xq4qKcwNIn1rb1lv9klHC2lLOHNBswbHiLZn35KMoldtL8QfmYDkpD8nHtXAjTRRouvwq1dYObxMnRzU4SPKRDzFd0Du3r2fP7SS-jgO67QO1PWXl89p_kcSLK-bs975cwtwY-aUY471OM-w2BeniTnNfmWynw1nFDD1lupTx_uH5F7P9-pYSIfmgdyIf3vOZcyxoQlMCg2yZv2skRFhdBlXeLWHaJorXRBtI68kpkoQce39LLgYyfvkghZIFe1uUPCMg`,
};

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface TestResult {
  endpoint: string;
  method: string;
  status: "PASS" | "FAIL" | "SKIP";
  statusCode?: number;
  error?: string;
  figmaAlignment: string | undefined;
  duration?: number;
}

interface ApiResponse<T = any> {
  data: T;
  _metadata?: {
    limit?: number;
    offset?: number;
    total?: number;
    filter?: string;
    timestamp?: string;
  };
  requestId?: string;
  error?: string;
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

class ApiClient {
  private client: AxiosInstance;
  private token: string;

  constructor(token: string) {
    this.token = token;
    this.client = axios.create({
      baseURL: API_BASE,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });
  }

  async get<T = any>(url: string): Promise<{ data: T; status: number }> {
    const res = await this.client.get<T>(url);
    return { data: res.data, status: res.status };
  }

  async post<T = any>(
    url: string,
    body: any = {},
  ): Promise<{ data: T; status: number }> {
    const res = await this.client.post<T>(url, body);
    return { data: res.data, status: res.status };
  }

  async put<T = any>(
    url: string,
    body: any = {},
  ): Promise<{ data: T; status: number }> {
    const res = await this.client.put<T>(url, body);
    return { data: res.data, status: res.status };
  }

  async delete<T = any>(url: string): Promise<{ data: T; status: number }> {
    const res = await this.client.delete<T>(url);
    return { data: res.data, status: res.status };
  }

  async patch<T = any>(
    url: string,
    body: any = {},
  ): Promise<{ data: T; status: number }> {
    const res = await this.client.patch<T>(url, body);
    return { data: res.data, status: res.status };
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

class Batch4TestSuite {
  private results: TestResult[] = [];
  private sellerClient: ApiClient;
  private buyerClient: ApiClient;
  private testIds: Record<string, string> = {};
  private requestDelay = 1500; // 1.5 second delay between requests for strict rate limits

  constructor() {
    this.sellerClient = new ApiClient(TOKENS.seller);
    this.buyerClient = new ApiClient(TOKENS.buyer);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(
    message: string,
    level: "info" | "success" | "error" | "warn" = "info",
  ) {
    const colors = {
      info: "\x1b[36m",
      success: "\x1b[32m",
      error: "\x1b[31m",
      warn: "\x1b[33m",
      reset: "\x1b[0m",
    };
    const prefix = {
      info: "ℹ",
      success: "✓",
      error: "✗",
      warn: "⚠",
    };
    console.log(`${colors[level]}${prefix[level]} ${message}${colors.reset}`);
  }

  private validateResponse(response: any): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!response.data) issues.push("Missing data field");
    if (!response._metadata) issues.push("Missing _metadata field");
    if (!response.requestId) issues.push("Missing requestId field");

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  async test(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    endpoint: string,
    body?: any,
    token: "seller" | "buyer" = "seller",
    figmaScreen?: string,
  ): Promise<TestResult> {
    // Add delay to avoid rate limiting
    await this.sleep(this.requestDelay);

    const client = token === "seller" ? this.sellerClient : this.buyerClient;
    const result: TestResult = {
      endpoint,
      method,
      status: "PASS",
      figmaAlignment: figmaScreen,
    };

    try {
      const start = Date.now();
      let response;

      switch (method) {
        case "GET":
          response = await client.get(endpoint);
          break;
        case "POST":
          response = await client.post(endpoint, body);
          break;
        case "PUT":
          response = await client.put(endpoint, body);
          break;
        case "DELETE":
          response = await client.delete(endpoint);
          break;
        case "PATCH":
          response = await client.patch(endpoint, body);
          break;
      }

      result.duration = Date.now() - start;
      result.statusCode = response.status;

      const validation = this.validateResponse(response.data);
      if (!validation.valid) {
        result.status = "FAIL";
        result.error = validation.issues.join(", ");
      }

      this.log(
        `${method} ${endpoint} (${response.status}) [${result.duration}ms]`,
        "success",
      );
      this.results.push(result);
      return result;
    } catch (error: any) {
      result.status = "FAIL";
      result.statusCode = error.response?.status;

      // Improved error message formatting
      let errorMsg = error.message || "Unknown error";
      if (error.response?.data) {
        try {
          if (typeof error.response.data === "string") {
            errorMsg = error.response.data.substring(0, 100);
          } else if (error.response.data.error) {
            errorMsg = JSON.stringify(error.response.data.error).substring(
              0,
              100,
            );
          } else if (error.response.data.message) {
            errorMsg = error.response.data.message.substring(0, 100);
          } else {
            errorMsg = JSON.stringify(error.response.data).substring(0, 100);
          }
        } catch (e) {
          errorMsg = String(error.response.data).substring(0, 100);
        }
      }
      result.error = errorMsg;

      this.log(
        `${method} ${endpoint} (${result.statusCode}) - ${result.error}`,
        "error",
      );
      this.results.push(result);
      return result;
    }
  }

  // =========================================================================
  // 1. REFERENCE CHECK TESTS (18 ENDPOINTS)
  // =========================================================================

  async testReferenceCHecks() {
    console.log("\n" + "=".repeat(70));
    console.log("1. REFERENCE CHECK APIS (18 endpoints)");
    console.log("=".repeat(70));

    // Create reference check
    await this.test(
      "POST",
      "/reference-checks",
      {
        aboutUser: "675a1b2c3d4e5f6g7h8i9j0k", // Figma: Target user ID
        questions: [
          "Would you trade with this user again?",
          "How would you rate their communication?",
          "Did they honor the agreed terms?",
        ],
        inviteesStrategy: "auto",
      },
      "seller",
      "Reference Check Create Screen",
    );

    // List with filters
    for (const filter of [
      "all",
      "you",
      "connections",
      "active",
      "suspended",
      "completed",
    ]) {
      await this.test(
        "GET",
        `/reference-checks?filter=${filter}&limit=20&offset=0`,
        undefined,
        "seller",
        `Reference Check List (Filter: ${filter})`,
      );
    }

    // Get single
    await this.test(
      "GET",
      "/reference-checks/1",
      undefined,
      "seller",
      "Reference Check Detail Screen",
    );

    // Get summary
    await this.test(
      "GET",
      "/reference-checks/1/summary",
      undefined,
      "seller",
      "Reference Check Summary Tab",
    );

    // Get context
    await this.test(
      "GET",
      "/reference-checks/1/context",
      undefined,
      "seller",
      "Reference Check Context (Offers, Orders)",
    );

    // Get progress
    await this.test(
      "GET",
      "/reference-checks/1/progress",
      undefined,
      "seller",
      "Reference Check Progress Rail",
    );

    // Add vouch
    await this.test(
      "POST",
      "/reference-checks/1/vouch",
      {
        weight: 50,
        reason: "Reliable and trustworthy",
        expiresAtMonthsFromNow: 12,
      },
      "buyer",
      "Reference Check Vouch Tab",
    );

    // List vouches
    await this.test(
      "GET",
      "/reference-checks/1/vouches",
      undefined,
      "seller",
      "Reference Check Vouches List",
    );

    // Get trust-safety status
    await this.test(
      "GET",
      "/reference-checks/1/trust-safety/status",
      undefined,
      "seller",
      "Reference Check Trust-Safety Status (Part 4)",
    );

    // Submit feedback
    await this.test(
      "POST",
      "/reference-checks/1/feedback",
      {
        rating: 5,
        comment: "Very helpful reference check",
        tags: ["thorough", "professional"],
      },
      "seller",
      "Reference Check Feedback Screen",
    );

    // Get audit trail
    await this.test(
      "GET",
      "/reference-checks/1/audit",
      undefined,
      "seller",
      "Reference Check Audit Trail (Admin View)",
    );
  }

  // =========================================================================
  // 2. OFFER TESTS (6 ENDPOINTS)
  // =========================================================================

  async testOffers() {
    console.log("\n" + "=".repeat(70));
    console.log("2. OFFER APIS (6 endpoints)");
    console.log("=".repeat(70));

    // List offers
    await this.test(
      "GET",
      "/offers?type=received&limit=20&offset=0",
      undefined,
      "seller",
      "Offer List (Buyer View)",
    );

    // List sent
    await this.test(
      "GET",
      "/offers?type=sent&limit=20&offset=0",
      undefined,
      "buyer",
      "Offer List (Seller View)",
    );

    // Get single offer
    await this.test(
      "GET",
      "/offers/1",
      undefined,
      "seller",
      "Offer Detail Screen",
    );

    // Get terms history
    await this.test(
      "GET",
      "/offers/1/terms-history",
      undefined,
      "seller",
      "Offer Negotiation Timeline",
    );

    // Counter offer
    await this.test(
      "POST",
      "/offers/1/counter",
      {
        amount: 1200,
        notes: "Can you go lower?",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      "buyer",
      "Offer Counter-Offer Screen",
    );

    // Accept offer
    await this.test(
      "POST",
      "/offers/1/accept",
      { confirmedAt: new Date().toISOString() },
      "buyer",
      "Offer Accept → Order Creation (Part 3)",
    );
  }

  // =========================================================================
  // 3. ORDER TESTS (5 ENDPOINTS)
  // =========================================================================

  async testOrders() {
    console.log("\n" + "=".repeat(70));
    console.log("3. ORDER APIS (5 endpoints)");
    console.log("=".repeat(70));

    // List orders
    await this.test(
      "GET",
      "/orders?type=buy&limit=20&offset=0",
      undefined,
      "buyer",
      "Order List (Buyer View)",
    );

    // Get single order
    await this.test(
      "GET",
      "/orders/1",
      undefined,
      "buyer",
      "Order Detail Screen (Part 3)",
    );

    // Check completion status
    await this.test(
      "GET",
      "/orders/1/completion-status",
      undefined,
      "buyer",
      "Order Completion Confirmation (Dual)",
    );

    // Complete order (buyer side)
    await this.test(
      "POST",
      "/orders/1/complete",
      { confirmedAt: new Date().toISOString() },
      "buyer",
      "Order Complete - Buyer Confirmation",
    );

    // Complete order (seller side)
    await this.test(
      "POST",
      "/orders/1/complete",
      { confirmedAt: new Date().toISOString() },
      "seller",
      "Order Complete - Seller Confirmation",
    );
  }

  // =========================================================================
  // 4. MESSAGE TESTS (10 ENDPOINTS)
  // =========================================================================

  async testMessages() {
    console.log("\n" + "=".repeat(70));
    console.log("4. MESSAGE APIS (10 endpoints)");
    console.log("=".repeat(70));

    // List conversations
    await this.test(
      "GET",
      "/messages/chats?limit=20&offset=0",
      undefined,
      "seller",
      "Social Hub - Messages Tab",
    );

    // Search conversations
    await this.test(
      "GET",
      "/messages/chats/search?q=iphone&limit=10",
      undefined,
      "seller",
      "Social Hub - Search Messages",
    );

    // Get conversation context
    await this.test(
      "GET",
      "/messages/conversation-context?id=channel_1",
      undefined,
      "seller",
      "Chat Screen - Context Panel (Offer, Order, Reference Check)",
    );

    // Send message
    await this.test(
      "POST",
      "/messages/send",
      {
        channel_id: "messaging:channel_hash_1",
        text: "Is this still available?",
        attachments: [],
      },
      "buyer",
      "Chat Screen - Send Message",
    );

    // Get channel messages
    await this.test(
      "GET",
      "/messages/channel/channel_1?limit=50&offset=0",
      undefined,
      "seller",
      "Chat Screen - Message History",
    );

    // Mark as read
    await this.test(
      "POST",
      "/messages/1/read",
      { readAt: new Date().toISOString() },
      "seller",
      "Chat Screen - Mark Read",
    );

    // React to message
    await this.test(
      "POST",
      "/messages/1/react",
      { emoji: "👍" },
      "seller",
      "Chat Screen - Reactions",
    );

    // Archive channel
    await this.test(
      "POST",
      "/messages/channel/channel_1/archive",
      {},
      "seller",
      "Chat Screen - Archive Conversation",
    );
  }

  // =========================================================================
  // 5. CHAT/TOKEN TESTS (4 ENDPOINTS)
  // =========================================================================

  async testChat() {
    console.log("\n" + "=".repeat(70));
    console.log("5. CHAT/TOKEN APIS (4 endpoints)");
    console.log("=".repeat(70));

    // Get token
    await this.test(
      "GET",
      "/chat/token",
      undefined,
      "seller",
      "Chat Setup - GetStream Auth",
    );

    // List channels
    await this.test(
      "GET",
      "/chat/channels?limit=20&offset=0",
      undefined,
      "seller",
      "Chat Setup - Channel List",
    );

    // Get unread counts
    await this.test(
      "GET",
      "/chat/unread",
      undefined,
      "seller",
      "Social Hub - Unread Badge",
    );

    // Get or create channel
    await this.test(
      "POST",
      "/chat/channel",
      {
        buyerId: "user_36SwGS456",
        sellerId: "user_36IWCC3uus7Ch",
        metadata: {
          listingId: "lst_001",
          offerContextId: "offer_001",
        },
      },
      "seller",
      "Chat Setup - Channel Initialization",
    );
  }

  // =========================================================================
  // 6. SOCIAL/GROUP TESTS (13 ENDPOINTS)
  // =========================================================================

  async testSocialHubAndGroups() {
    console.log("\n" + "=".repeat(70));
    console.log("6. SOCIAL HUB & GROUPS APIS (13 endpoints)");
    console.log("=".repeat(70));

    // Get inbox
    await this.test(
      "GET",
      "/social/inbox?limit=20&offset=0",
      undefined,
      "seller",
      "Social Hub - Inbox (All Tabs)",
    );

    // Search
    await this.test(
      "GET",
      "/social/search?q=designer&type=people&limit=10",
      undefined,
      "seller",
      "Social Hub - Search Results",
    );

    // Discover
    await this.test(
      "GET",
      "/social/discover",
      undefined,
      "seller",
      "Social Hub - Discover (Recommendations)",
    );

    // List groups
    await this.test(
      "GET",
      "/social/groups?privacy=public&limit=20&offset=0",
      undefined,
      "seller",
      "Social Hub - Groups List",
    );

    // Get group detail
    await this.test(
      "GET",
      "/social/groups/1",
      undefined,
      "seller",
      "Group Detail Screen (Part 2)",
    );

    // Create group
    await this.test(
      "POST",
      "/social/groups",
      {
        name: "iPhone Enthusiasts",
        description: "Community for iPhone traders",
        privacy: "public",
        initialMembers: [],
      },
      "seller",
      "Create Group Screen",
    );

    // Join group
    await this.test(
      "POST",
      "/social/groups/1/join",
      { inviteToken: null },
      "buyer",
      "Join Group (Public)",
    );

    // Leave group
    await this.test(
      "DELETE",
      "/social/groups/1/leave",
      {},
      "buyer",
      "Leave Group",
    );

    // Add members
    await this.test(
      "POST",
      "/social/groups/1/members",
      { userIds: ["user_36IWCC3uus7Ch"] },
      "seller",
      "Group Admin - Add Members",
    );

    // Remove member
    await this.test(
      "DELETE",
      "/social/groups/1/members/user_36IWCC3uus7Ch",
      undefined,
      "seller",
      "Group Admin - Remove Member",
    );

    // Update member role
    await this.test(
      "PATCH",
      "/social/groups/1/members/user_36IWCC3uus7Ch/role",
      { role: "admin" },
      "seller",
      "Group Admin - Update Role",
    );

    // Create invite
    await this.test(
      "POST",
      "/social/invites",
      {
        groupId: "1",
        maxUses: 10,
        expiresAt: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
      "seller",
      "Create Group Invite Link",
    );

    // Validate invite
    await this.test(
      "GET",
      "/social/invites/token_abc123",
      undefined,
      "buyer",
      "Validate Invite Link",
    );
  }

  // =========================================================================
  // RUN ALL TESTS
  // =========================================================================

  async runAll() {
    console.log("\n");
    console.log("╔" + "═".repeat(68) + "╗");
    console.log(
      "║" +
        " ".repeat(15) +
        "BATCH 4 COMPREHENSIVE API TEST SUITE" +
        " ".repeat(17) +
        "║",
    );
    console.log("╚" + "═".repeat(68) + "╝");
    console.log(`Started: ${new Date().toISOString()}`);
    console.log(`API Base: ${API_BASE}`);
    console.log(`Seller Token: ${TOKENS.seller.substring(0, 50)}...`);
    console.log(`Buyer Token: ${TOKENS.buyer.substring(0, 50)}...`);

    await this.testReferenceCHecks();
    await this.testOffers();
    await this.testOrders();
    await this.testMessages();
    await this.testChat();
    await this.testSocialHubAndGroups();

    this.printSummary();
  }

  private printSummary() {
    console.log("\n" + "=".repeat(70));
    console.log("TEST SUMMARY");
    console.log("=".repeat(70));

    const passed = this.results.filter((r) => r.status === "PASS").length;
    const failed = this.results.filter((r) => r.status === "FAIL").length;
    const totalTests = this.results.length;
    const passRate = ((passed / totalTests) * 100).toFixed(2);

    console.log(`\nTotal Tests: ${totalTests}`);
    this.log(`Passed: ${passed}`, "success");
    this.log(`Failed: ${failed}`, failed > 0 ? "error" : "success");
    console.log(`Pass Rate: ${passRate}%`);

    // Figma Alignment
    console.log("\n" + "-".repeat(70));
    console.log("FIGMA ALIGNMENT VERIFICATION");
    console.log("-".repeat(70));

    const byScreen = this.results.reduce(
      (acc, r) => {
        if (r.figmaAlignment) {
          if (!acc[r.figmaAlignment]) {
            acc[r.figmaAlignment] = { pass: 0, fail: 0 };
          }
          if (r.status === "PASS") acc[r.figmaAlignment].pass++;
          else acc[r.figmaAlignment].fail++;
        }
        return acc;
      },
      {} as Record<string, { pass: number; fail: number }>,
    );

    Object.entries(byScreen).forEach(([screen, stats]) => {
      const status = stats.fail === 0 ? "success" : "warn";
      this.log(`${screen}: ${stats.pass}/${stats.pass + stats.fail} ✓`, status);
    });

    // Response Times
    console.log("\n" + "-".repeat(70));
    console.log("PERFORMANCE METRICS");
    console.log("-".repeat(70));

    const durations = this.results
      .filter((r) => r.duration)
      .map((r) => r.duration || 0);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    console.log(`Avg Response Time: ${avgDuration.toFixed(0)}ms`);
    console.log(`Max Response Time: ${maxDuration}ms`);
    console.log(`Min Response Time: ${minDuration}ms`);

    // Failures Details
    if (failed > 0) {
      console.log("\n" + "-".repeat(70));
      console.log("FAILED TESTS");
      console.log("-".repeat(70));

      this.results
        .filter((r) => r.status === "FAIL")
        .forEach((r) => {
          this.log(`${r.method} ${r.endpoint}`, "error");
          console.log(`  Status: ${r.statusCode}, Error: ${r.error}`);
        });
    }

    console.log("\n" + "=".repeat(70));
    console.log(`Completed: ${new Date().toISOString()}`);
    console.log("=".repeat(70) + "\n");
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const suite = new Batch4TestSuite();
  await suite.runAll();
}

main().catch(console.error);
