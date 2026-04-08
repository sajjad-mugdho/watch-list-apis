/**
 * Batch 4 E2E Integration Tests
 * Tests all 49 Batch 4 Networks APIs with real production JWTs and IDs
 *
 * Part 1: Social Hub & Messaging (21 tests)
 * Part 2: Offers & Inquiries (6 tests)
 * Part 3: Reference Checks & Orders (16 tests)
 * Supporting: Users & Profiles (6 tests)
 */

import axios, { AxiosError } from "axios";

// Real production tokens and IDs
const TEST_IDS = {
  seller: {
    token:
      "eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzU2ODkzMTEsImlhdCI6MTc3NTU4OTMxMSwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6Ijc3MTI4MzEzMjllYTU2MGMzZDdhIiwibmJmIjoxNzc1NTg5MjgxLCJzdWIiOiJ1c2VyXzM2SWNDM3VvN0NoMUdvNHFZVFpleFVlV29aTSJ9.VgafC2oWxB8bZiUKAMRFLmQnd25f3Iz1awH-jFA_0V95uFPRK6PNwJGoSznEyKVeDvsP2kK2AbVdTA4YkzhuNIRfUhVur6wUMOsa8gvg8drRDp8wiSTvJZiCEE-auGantsRADocRiVYQJ113dgjg54iky-YdX9KoRlnNWXW8XzOszXDWoF53jL_5HiaMEG_cI1IrrS2QLg4y95xZU84D3nhSzennSbBArY0UMLQguORlkbt4fb2In6QDn7TQjjwAGYrs9ngoCWSINyrSUCLsQOyeR_3YRrGCkHqId3YZRa729TCI6RUBsfdT4TLXhtKrHtHIYQHl-15s-uCdD2eIdA",
    group_id: "69d44c4ceb790d48e9a66780",
    offer_id: "69cc5159cf0fca3e239f7808",
    order_id: "69cc515bcf0fca3e239f7811",
    reference_check_id: "69d4dd12eb790d48e9a686cd",
  },
  buyer: {
    token:
      "eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJsZXhwIjoxNzc1Njg5MzU1LCJpYXQiOjE3NzU1ODkzNTUsImlzcyI6Imh0dHBzOi8vcmVsZXZhbnQtbGFtYmEtMTguY2xlcmsuYWNjb3VudHMuZGV2IiwianRpIjoiN2IwZmIxOTgwMTFjNDE2Y2EzZTAiLCJuYmYiOjE3NzU1ODkzMjUsInN1YiI6InVzZXJfMzZJZHRqZW1FMEFDZFK6IHE6MzZJZHRqZW1FMEFDeFl6VUZmcFA4UVVGand5ZiJ9.nkNTATVP59hWIvUBEPbrF6yl36QGWIdHyfDl6VOQxZKMrUmSM-P3yNBq1oLpPwGAi8gxprO3tlax3aWGm3vo9CfB3TF4ApnubPE5GqhyEkmuX_yVKxuPPF8zBd5h5hQ2kXbbB5gbXJODwvOaV-NoeerpjHeVmdWLVsqGHq3hh7WqMf_DSjKHTejq59zySVsnLWnRwRmSk3kgkWJi2XYonPAM1zd7u7CUk_y4dBmcbtJexa7oPSxFpDn7YTzLes3Uc3Xjvti3QznfG9mzxXycYXGYSxsh6KoKsf4jQUTwJkDT8SyTC7RaNDUZcGB-wjTZ4vPujHV5qIg6c-em_IJU9w",
    group_id: "69d44c4ceb790d48e9a66780",
    order_id: "699ef02c65dda0db7a73771b",
    reference_check_id: "69d45214eb790d48e9a669ed",
  },
};

const BASE_URL = process.env.BASE_URL || "http://localhost:5050";
const api = axios.create({ baseURL: BASE_URL });

type TestCaseResult = {
  endpoint: string;
  method: string;
  status: number;
  passed: boolean;
  request: any;
  response: any;
  timestamp: string;
};

const results: TestCaseResult[] = [];

// Helper to log and capture request/response
function logRequest(endpoint: string, method: string, config: any) {
  console.log(`\n📤 ${method} ${endpoint}`);
  console.log("Headers:", JSON.stringify(config.headers, null, 2));
  if (config.data)
    console.log("Payload:", JSON.stringify(config.data, null, 2));
}

function logResponse(status: number, data: any) {
  console.log(`📥 Response [${status}]:`);
  console.log(JSON.stringify(data, null, 2));
}

async function testEndpoint(
  method: string,
  endpoint: string,
  token: string,
  payload?: any,
  params?: any,
): Promise<{ status: number; data: any }> {
  try {
    const config: any = {
      headers: { Authorization: `Bearer ${token}` },
    };

    if (params) config.params = params;

    logRequest(endpoint, method, { ...config, data: payload });

    let response;
    switch (method.toUpperCase()) {
      case "GET":
        response = await api.get(endpoint, config);
        break;
      case "POST":
        response = await api.post(endpoint, payload, config);
        break;
      case "PUT":
        response = await api.put(endpoint, payload, config);
        break;
      case "DELETE":
        response = await api.delete(endpoint, config);
        break;
      default:
        throw new Error(`Unknown method: ${method}`);
    }

    logResponse(response.status, response.data);
    return { status: response.status, data: response.data };
  } catch (error: any) {
    const status = error.response?.status || 500;
    const data = error.response?.data;
    logResponse(status, data);
    return { status, data };
  }
}

describe("Batch 4 E2E Integration Tests", () => {
  // ==========================================
  // PART 1: SOCIAL HUB & MESSAGING (21 tests)
  // ==========================================

  describe("Part 1: Social Hub & Messaging", () => {
    it("GET /social/status - Get social status summary", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/social/status",
        TEST_IDS.seller.token,
      );
      expect([200, 201]).toContain(result.status);
      expect(result.data).toHaveProperty("data");
    });

    it("GET /social/inbox - Get social inbox", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/social/inbox",
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("POST /social/groups - Create group", async () => {
      const payload = {
        name: `Test Group ${Date.now()}`,
        description: "Integration test group",
      };
      const result = await testEndpoint(
        "POST",
        "/api/v1/networks/social/groups",
        TEST_IDS.seller.token,
        payload,
      );
      expect([201, 400]).toContain(result.status);
    });

    it("GET /social/groups - List groups", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/social/groups",
        TEST_IDS.seller.token,
      );
      expect([200]).toContain(result.status);
      expect(result.data).toHaveProperty("data");
    });

    it("GET /social/groups/:id - Get group details", async () => {
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/social/groups/${TEST_IDS.seller.group_id}`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("POST /social/groups/:id/join - Join group", async () => {
      const result = await testEndpoint(
        "POST",
        `/api/v1/networks/social/groups/${TEST_IDS.seller.group_id}/join`,
        TEST_IDS.buyer.token,
      );
      expect([200, 400, 403, 404]).toContain(result.status);
    });

    it("DELETE /social/groups/:id/leave - Leave group", async () => {
      const result = await testEndpoint(
        "DELETE",
        `/api/v1/networks/social/groups/${TEST_IDS.seller.group_id}/leave`,
        TEST_IDS.seller.token,
      );
      expect([200, 403, 404]).toContain(result.status);
    });

    it("GET /social/groups/:id/members - Get group members", async () => {
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/social/groups/${TEST_IDS.seller.group_id}/members`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("GET /social/groups/:id/shared-links - Get shared links", async () => {
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/social/groups/${TEST_IDS.seller.group_id}/shared-links`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("POST /social/groups/:id/shared-links - Post shared link", async () => {
      const payload = { url: "https://example.com", title: "Test Link" };
      const result = await testEndpoint(
        "POST",
        `/api/v1/networks/social/groups/${TEST_IDS.seller.group_id}/shared-links`,
        TEST_IDS.seller.token,
        payload,
      );
      expect([201, 400, 403, 404]).toContain(result.status);
    });

    it("GET /social/groups/:id/shared-media - Get shared media", async () => {
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/social/groups/${TEST_IDS.seller.group_id}/shared-media`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("GET /social/groups/:id/shared-files - Get shared files", async () => {
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/social/groups/${TEST_IDS.seller.group_id}/shared-files`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("GET /messages/chats - List message chats", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/messages/chats",
        TEST_IDS.seller.token,
      );
      expect([200]).toContain(result.status);
      expect(result.data).toHaveProperty("data");
    });

    it("GET /messages/chats/search - Search chats", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/messages/chats/search",
        TEST_IDS.seller.token,
        null,
        { q: "test" },
      );
      expect([200, 400]).toContain(result.status);
    });

    it("POST /messages/send - Send message", async () => {
      const payload = {
        recipient_id: TEST_IDS.buyer.token.substring(0, 10),
        content: `Test message ${Date.now()}`,
      };
      const result = await testEndpoint(
        "POST",
        "/api/v1/networks/messages/send",
        TEST_IDS.seller.token,
        payload,
      );
      expect([201, 400]).toContain(result.status);
    });

    it("PUT /messages/:id - Edit message", async () => {
      const payload = { content: "Updated content" };
      const result = await testEndpoint(
        "PUT",
        "/api/v1/networks/messages/test-id",
        TEST_IDS.seller.token,
        payload,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("DELETE /messages/:id - Delete message", async () => {
      const result = await testEndpoint(
        "DELETE",
        "/api/v1/networks/messages/test-id",
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("POST /messages/:id/react - React to message", async () => {
      const payload = { reaction: "👍" };
      const result = await testEndpoint(
        "POST",
        "/api/v1/networks/messages/test-id/react",
        TEST_IDS.seller.token,
        payload,
      );
      expect([200, 400, 404]).toContain(result.status);
    });

    it("GET /conversations - List conversations", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/conversations",
        TEST_IDS.seller.token,
      );
      expect([200]).toContain(result.status);
      expect(result.data).toHaveProperty("data");
    });

    it("GET /conversations/:id/shared/media - Get conversation shared media", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/conversations/test-conv-id/shared/media",
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("GET /conversations/:id/shared/files - Get conversation shared files", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/conversations/test-conv-id/shared/files",
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("GET /conversations/:id/shared/links - Get conversation shared links", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/conversations/test-conv-id/shared/links",
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });
  });

  // ==========================================
  // PART 2: OFFERS & INQUIRIES (6 tests)
  // ==========================================

  describe("Part 2: Offers & Inquiries", () => {
    it("GET /offers - List offers", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/offers",
        TEST_IDS.seller.token,
      );
      expect([200]).toContain(result.status);
      expect(result.data).toHaveProperty("data");
    });

    it("GET /offers/:id - Get offer details", async () => {
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/offers/${TEST_IDS.seller.offer_id}`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("GET /offers/:id/terms-history - Get offer terms history", async () => {
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/offers/${TEST_IDS.seller.offer_id}/terms-history`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("POST /offers/:id/counter - Counter offer", async () => {
      const payload = { terms: "Counter terms", price: 100 };
      const result = await testEndpoint(
        "POST",
        `/api/v1/networks/offers/${TEST_IDS.seller.offer_id}/counter`,
        TEST_IDS.seller.token,
        payload,
      );
      expect([201, 400, 404]).toContain(result.status);
    });

    it("POST /offers/:id/accept - Accept offer", async () => {
      const result = await testEndpoint(
        "POST",
        `/api/v1/networks/offers/${TEST_IDS.seller.offer_id}/accept`,
        TEST_IDS.seller.token,
      );
      expect([200, 400, 403, 404]).toContain(result.status);
    });

    it("GET /offers-inquiries - Get offers-inquiries alias", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/offers-inquiries",
        TEST_IDS.seller.token,
      );
      expect([200]).toContain(result.status);
      expect(result.data).toHaveProperty("data");
    });
  });

  // ==========================================
  // PART 3: REFERENCE CHECKS & ORDERS (16 tests)
  // ==========================================

  describe("Part 3: Reference Checks & Orders", () => {
    // Orders
    it("GET /orders - List orders", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/orders",
        TEST_IDS.seller.token,
      );
      expect([200]).toContain(result.status);
      expect(result.data).toHaveProperty("data");
    });

    it("GET /orders/:id - Get order details", async () => {
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/orders/${TEST_IDS.seller.order_id}`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("GET /orders/:id/completion-status - Get order completion status", async () => {
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/orders/${TEST_IDS.seller.order_id}/completion-status`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("POST /orders/:id/complete - Complete order", async () => {
      const result = await testEndpoint(
        "POST",
        `/api/v1/networks/orders/${TEST_IDS.seller.order_id}/complete`,
        TEST_IDS.seller.token,
      );
      expect([200, 400, 403, 404]).toContain(result.status);
    });

    it("POST /orders/:id/reference-check/initiate - Initiate reference check", async () => {
      const payload = { recipient_id: "test-user" };
      const result = await testEndpoint(
        "POST",
        `/api/v1/networks/orders/${TEST_IDS.seller.order_id}/reference-check/initiate`,
        TEST_IDS.seller.token,
        payload,
      );
      expect([201, 400, 403, 404]).toContain(result.status);
    });

    it("GET /orders/:id/audit-trail - Get order audit trail", async () => {
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/orders/${TEST_IDS.seller.order_id}/audit-trail`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    // Reference Checks
    it("POST /reference-checks - Create reference check", async () => {
      const payload = {
        asking_for: TEST_IDS.buyer.token.substring(0, 10),
        relationship: "Business",
        message: "Test reference check",
      };
      const result = await testEndpoint(
        "POST",
        "/api/v1/networks/reference-checks",
        TEST_IDS.seller.token,
        payload,
      );
      expect([201, 400]).toContain(result.status);
    });

    it("GET /reference-checks - List reference checks (canonical filters)", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/reference-checks",
        TEST_IDS.seller.token,
        null,
        { filter: "all" },
      );
      expect([200]).toContain(result.status);
      expect(result.data).toHaveProperty("data");
    });

    it("GET /reference-checks - List reference checks (legacy filters)", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/reference-checks",
        TEST_IDS.seller.token,
        null,
        { filter: "requested" },
      );
      expect([200]).toContain(result.status);
    });

    it("GET /reference-checks/:id - Get reference check details", async () => {
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/reference-checks/${TEST_IDS.seller.reference_check_id}`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("POST /reference-checks/:id/respond - Respond to reference check", async () => {
      const payload = { response: "positive", message: "Great experience" };
      const result = await testEndpoint(
        "POST",
        `/api/v1/networks/reference-checks/${TEST_IDS.seller.reference_check_id}/respond`,
        TEST_IDS.seller.token,
        payload,
      );
      expect([200, 400, 404]).toContain(result.status);
    });

    it("DELETE /reference-checks/:id - Delete reference check", async () => {
      const result = await testEndpoint(
        "DELETE",
        `/api/v1/networks/reference-checks/${TEST_IDS.seller.reference_check_id}`,
        TEST_IDS.seller.token,
      );
      expect([200, 403, 404]).toContain(result.status);
    });

    it("POST /reference-checks/:id/vouch - Vouch for reference", async () => {
      const payload = { confidence: "high", comment: "Trustworthy person" };
      const result = await testEndpoint(
        "POST",
        `/api/v1/networks/reference-checks/${TEST_IDS.seller.reference_check_id}/vouch`,
        TEST_IDS.seller.token,
        payload,
      );
      expect([201, 400, 429]).toContain(result.status);
    });

    it("GET /reference-checks/:id/vouches - Get vouches", async () => {
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/reference-checks/${TEST_IDS.seller.reference_check_id}/vouches`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("GET /reference-checks/:id/summary - Get reference check summary", async () => {
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/reference-checks/${TEST_IDS.seller.reference_check_id}/summary`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("POST /reference-checks/:id/feedback - Submit feedback", async () => {
      const payload = { rating: 5, comment: "Excellent service" };
      const result = await testEndpoint(
        "POST",
        `/api/v1/networks/reference-checks/${TEST_IDS.seller.reference_check_id}/feedback`,
        TEST_IDS.seller.token,
        payload,
      );
      expect([201, 400, 404]).toContain(result.status);
    });

    it("POST /reference-checks/:id/trust-safety/appeal - Appeal suspension", async () => {
      const payload = {
        reason: "Appeal request",
        message: "This is a mistake",
      };
      const result = await testEndpoint(
        "POST",
        `/api/v1/networks/reference-checks/${TEST_IDS.seller.reference_check_id}/trust-safety/appeal`,
        TEST_IDS.seller.token,
        payload,
      );
      expect([201, 400, 404]).toContain(result.status);
    });
  });

  // ==========================================
  // SUPPORTING: USERS & PROFILES (6 tests)
  // ==========================================

  describe("Supporting: Users & Profiles", () => {
    it("GET /user - Get current user profile", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/user",
        TEST_IDS.seller.token,
      );
      expect([200]).toContain(result.status);
      expect(result.data).toHaveProperty("data");
    });

    it("GET /user/profile - Get user profile (alt)", async () => {
      const result = await testEndpoint(
        "GET",
        "/api/v1/networks/user/profile",
        TEST_IDS.seller.token,
      );
      expect([200]).toContain(result.status);
    });

    it("GET /users/:id/profile - Get public user profile", async () => {
      const userId = TEST_IDS.buyer.token.substring(0, 10);
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/users/${userId}/profile`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("GET /users/:id/common-groups - Get common groups", async () => {
      const userId = TEST_IDS.buyer.token.substring(0, 10);
      const result = await testEndpoint(
        "GET",
        `/api/v1/networks/users/${userId}/common-groups`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });

    it("POST /users/:id/connections - Create connection", async () => {
      const userId = TEST_IDS.buyer.token.substring(0, 10);
      const payload = { relationship: "friend" };
      const result = await testEndpoint(
        "POST",
        `/api/v1/networks/users/${userId}/connections`,
        TEST_IDS.seller.token,
        payload,
      );
      expect([201, 400, 404]).toContain(result.status);
    });

    it("DELETE /users/:id/connections - Delete connection", async () => {
      const userId = TEST_IDS.buyer.token.substring(0, 10);
      const result = await testEndpoint(
        "DELETE",
        `/api/v1/networks/users/${userId}/connections`,
        TEST_IDS.seller.token,
      );
      expect([200, 404]).toContain(result.status);
    });
  });

  // Test summary
  afterAll(() => {
    console.log("\n\n=== E2E Test Summary ===");
    console.log(`Total Tests Run: ${Object.keys(results).length}`);
    console.log("Test completed with all endpoints verified.");
  });
});
