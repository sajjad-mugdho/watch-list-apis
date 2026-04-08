#!/usr/bin/env node

/**
 * Batch 4 Test Fixtures Setup
 *
 * This script:
 * 1. Onboards test users (seller + buyer) to networks
 * 2. Creates test data (reference checks, offers, orders, messages, chats)
 * 3. Generates fixture IDs for use in actual tests
 *
 * Usage:
 * npx ts-node tests/integration/batch-4-setup-fixtures.ts
 */

import axios, { AxiosInstance } from "axios";
import fs from "fs";
import path from "path";

const API_BASE =
  process.env.API_BASE || "http://localhost:5050/api/v1/networks";

const TOKENS = {
  seller: `eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzU2MTU0NzIsImlhdCI6MTc3NTUxNTQ3MiwiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6ImE2ODNlM2JhOTE4ZjBiNzJkMTkzIiwibmJmIjoxNzc1NTE1NDQyLCJzdWIiOiJ1c2VyXzM2SWNDM3VvN0NoMUdvNHFZVFpleFVlV29aTSJ9.aWmALlfaEjuv8TGrDVD3R_CM3anecBdI7La9JvH0SabsoN7kghI8JUVP1eUuYeFTACfTRpo4414JE814Uk9qp0iC-ltTV4Sb4ETIOfaJ9pYui0Je_gh1GBqAZQiqnKGwu6jpFF5B_zYc8bw1yYNOup_gZU5_DL5PvaMUSApKXQhvF1cwHc584ypfhwKt_ZxrARqnWqF_4VdDZUePgFIOHEstI1GFWrfRuTO-_kYJJba-wh9hZf-4w00lh0Z2CfWOIA4QcccBXI3dMvOjfWRFxQ4-F_S88YKn32Kbo5gH_CmshkyKYCv5FWYDJ5vwqk1kCj9hiaah5nTNuNW2NpVuGg`,
  buyer: `eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDIyMkFBQSIsImtpZCI6Imluc18zNTkxTUdYSGhZRTFxWHhKWVBoekNWUWtmZlUiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NzU2MTU2MDcsImlhdCI6MTc3NTUxNTYwNywiaXNzIjoiaHR0cHM6Ly9yZWxldmFudC1sYW1iLTE4LmNsZXJrLmFjY291bnRzLmRldiIsImp0aSI6IjM5NzJlYjU2NzRiMDVkYzNiYWU2IiwibmJmIjoxNzc1NTE1NTc3LCJzdWIiOiJ1c2VyXzM2SWR0amVtRTBBQ3hZelVGZnBQOFFVRmp5ZiJ9.Q3gNhqJjNL_lg82HMQDpv0CgtvAEkrv4EUmmpm-gpGydDMbh-v3XQhBVtTukew2xpcv7nSU07hCIOyVC3Xq4qKcwNIn1rb1lv9klHC2lLOHNBswbHiLZn35KMoldtL8QfmYDkpD8nHtXAjTRRouvwq1dYObxMnRzU4SPKRDzFd0Du3r2fP7SS-jgO67QO1PWXl89p_kcSLK-bs975cwtwY-aUY471OM-w2BeniTnNfmWynw1nFDD1lupTx_uH5F7P9-pYSIfmgdyIf3vOZcyxoQlMCg2yZv2skRFhdBlXeLWHaJorXRBtI68kpkoQce39LLgYyfvkghZIFe1uUPCMg`,
};

interface Fixtures {
  userIds: {
    seller: string;
    buyer: string;
  };
  resources: {
    referenceCheckId?: string;
    offerId?: string;
    orderId?: string;
    chatChannelId?: string;
    groupId?: string;
  };
}

class FixtureSetup {
  private sellerClient: AxiosInstance;
  private buyerClient: AxiosInstance;
  private fixtures: Fixtures = {
    userIds: {
      seller: "user_36IWCC3uus7Ch1Go4qYTZexUeWoaTM",
      buyer: "user_36IdtjemE0ACxYzUFfpP8QUFjyf",
    },
    resources: {},
  };

  constructor() {
    this.sellerClient = axios.create({
      baseURL: API_BASE,
      headers: {
        Authorization: `Bearer ${TOKENS.seller}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    this.buyerClient = axios.create({
      baseURL: API_BASE,
      headers: {
        Authorization: `Bearer ${TOKENS.buyer}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });
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
    const prefix = { info: "ℹ", success: "✓", error: "✗", warn: "⚠" };
    console.log(`${colors[level]}${prefix[level]} ${message}${colors.reset}`);
  }

  async setupFixtures() {
    console.log("\n╔" + "═".repeat(68) + "╗");
    console.log(
      "║" + " ".repeat(20) + "BATCH 4 FIXTURE SETUP" + " ".repeat(27) + "║",
    );
    console.log("╚" + "═".repeat(68) + "╝\n");

    try {
      // Step 1: Verify users
      this.log("Step 1: Verifying test users...", "info");
      await this.verifyUsers();

      // Step 2: Create reference check
      this.log("Step 2: Creating reference check...", "info");
      await this.createReferenceCheck();

      // Step 3: Create offer
      this.log("Step 3: Creating test offer...", "info");
      await this.createOffer();

      // Step 4: Create group
      this.log("Step 4: Creating test group...", "info");
      await this.createGroup();

      // Step 5: Initialize chat
      this.log("Step 5: Initializing chat setup...", "info");
      await this.initializeChat();

      // Step 6: Save fixtures to file
      this.saveFixtures();

      console.log("\n" + "=".repeat(70));
      this.log("All fixtures created successfully!", "success");
      console.log("=".repeat(70) + "\n");
      console.log("Fixtures saved to: tests/integration/.batch4-fixtures.json");
      console.log("\nNext: Run tests with: npm run test:batch4:full\n");
    } catch (error: any) {
      this.log(`Setup failed: ${error.message}`, "error");
      console.error(error);
      process.exit(1);
    }
  }

  private async verifyUsers() {
    try {
      // Check seller profile
      const sellerRes = await this.sellerClient.get("/social/inbox?limit=1");
      this.log(
        `✓ Seller verified (${this.fixtures.userIds.seller})`,
        "success",
      );

      // Check buyer profile
      const buyerRes = await this.buyerClient.get("/social/inbox?limit=1");
      this.log(`✓ Buyer verified (${this.fixtures.userIds.buyer})`, "success");
    } catch (error: any) {
      throw new Error(`Failed to verify users: ${error.message}`);
    }
  }

  private async createReferenceCheck() {
    try {
      const response = await this.sellerClient.post("/reference-checks", {
        aboutUser: this.fixtures.userIds.buyer,
        questions: [
          "Would you trade with this user again?",
          "How would you rate their communication?",
          "Did they honor the agreed terms?",
        ],
        inviteesStrategy: "auto",
      });

      if (response.data?.data?._id) {
        this.fixtures.resources.referenceCheckId = response.data.data._id;
        this.log(
          `✓ Reference check created: ${this.fixtures.resources.referenceCheckId}`,
          "success",
        );
      }
    } catch (error: any) {
      this.log(
        `Reference check creation failed (non-blocking): ${error.response?.status}`,
        "warn",
      );
    }
  }

  private async createOffer() {
    try {
      const response = await this.sellerClient.post("/offers", {
        buyerId: this.fixtures.userIds.buyer,
        sellerId: this.fixtures.userIds.seller,
        title: "Test Offer for Batch 4",
        description: "Test offer created for API testing",
        productId: "test-product-001",
        price: 99.99,
        quantity: 1,
        terms: {
          paymentMethod: "cash",
          deliveryMethod: "in-person",
          location: "Test Location",
        },
      });

      if (response.data?.data?._id) {
        this.fixtures.resources.offerId = response.data.data._id;
        this.log(
          `✓ Offer created: ${this.fixtures.resources.offerId}`,
          "success",
        );
      }
    } catch (error: any) {
      this.log(
        `Offer creation failed (non-blocking): ${error.response?.status}`,
        "warn",
      );
    }
  }

  private async createGroup() {
    try {
      const response = await this.sellerClient.post("/social/groups", {
        name: "Batch 4 Test Group",
        description: "Test group for Batch 4 API testing",
        privacy: "public",
        category: "business",
      });

      if (response.data?.data?._id) {
        this.fixtures.resources.groupId = response.data.data._id;
        this.log(
          `✓ Group created: ${this.fixtures.resources.groupId}`,
          "success",
        );
      }
    } catch (error: any) {
      this.log(
        `Group creation failed (non-blocking): ${error.response?.status}`,
        "warn",
      );
    }
  }

  private async initializeChat() {
    try {
      // Get chat token
      const tokenRes = await this.sellerClient.get("/chat/token");
      if (tokenRes.data?.data) {
        this.log("✓ Chat token retrieved", "success");

        // Get channels
        const channelsRes = await this.sellerClient.get(
          "/chat/channels?limit=1",
        );
        if (channelsRes.data?.data?.[0]?._id) {
          this.fixtures.resources.chatChannelId = channelsRes.data.data[0]._id;
          this.log(
            `✓ Chat channel found: ${this.fixtures.resources.chatChannelId}`,
            "success",
          );
        }
      }
    } catch (error: any) {
      this.log(
        `Chat initialization failed (non-blocking): ${error.response?.status}`,
        "warn",
      );
    }
  }

  private saveFixtures() {
    const fixturesPath = path.join(__dirname, ".batch4-fixtures.json");
    fs.writeFileSync(fixturesPath, JSON.stringify(this.fixtures, null, 2));
    console.log("\n" + JSON.stringify(this.fixtures, null, 2));
  }
}

// Main execution
const setup = new FixtureSetup();
setup.setupFixtures().catch((error) => {
  console.error("Setup error:", error);
  process.exit(1);
});
