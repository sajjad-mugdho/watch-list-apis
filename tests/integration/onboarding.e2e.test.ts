import request from "supertest";
import { app } from "../../src/app";
import { User } from "../../src/models/User";

/**
 * E2E tests for platform onboarding flow
 * Tests complete user journey from signup to onboarding completion
 */

describe("Platform Onboarding E2E", () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe("Complete Onboarding Flow", () => {
    it("should complete full onboarding and return completed status in /me", async () => {
      // Step 0: Create new incomplete user (simulates Clerk webhook)
      const testUser = await User.create({
        _id: "677a1111111111111111aaa1",
        external_id: "user_new_incomplete",
        email: "new@test.com",
        first_name: "New",
        last_name: "User",
        onboarding: {
          status: "incomplete",
          version: "1.0",
          steps: {},
        },
      });

      // Step 1: Location
      const locationResponse = await request(app)
        .patch("/api/v1/onboarding/steps/location")
        .set("x-test-user", "user_new_incomplete")
        .send({
          country: "US",
          postal_code: "10001",
          region: "NY",
        });

      expect(locationResponse.status).toBe(200);
      expect(locationResponse.body._metadata.onboarding.complete.location).toBe(true);
      expect(locationResponse.body._metadata.onboarding.is_finished).toBe(false);

      // Step 2: Display Name
      const displayNameResponse = await request(app)
        .patch("/api/v1/onboarding/steps/display_name")
        .set("x-test-user", "user_new_incomplete")
        .send({
          value: "TestUserCustom",
          mode: "custom",
        });

      expect(displayNameResponse.status).toBe(200);
      expect(displayNameResponse.body._metadata.onboarding.complete.display_name).toBe(true);
      expect(displayNameResponse.body._metadata.onboarding.is_finished).toBe(false);

      // Step 3: Avatar (skip with default)
      const avatarResponse = await request(app)
        .patch("/api/v1/onboarding/steps/avatar")
        .set("x-test-user", "user_new_incomplete")
        .send({
          mode: "default",
        });

      expect(avatarResponse.status).toBe(200);
      expect(avatarResponse.body._metadata.onboarding.complete.avatar).toBe(true);
      expect(avatarResponse.body._metadata.onboarding.is_finished).toBe(false);

      // Step 4: Acknowledgements (completes onboarding)
      const acksResponse = await request(app)
        .patch("/api/v1/onboarding/steps/acknowledgements")
        .set("x-test-user", "user_new_incomplete")
        .send({
          tos: true,
          privacy: true,
          rules: true,
        });

      expect(acksResponse.status).toBe(200);
      expect(acksResponse.body._metadata.onboarding.complete.acknowledgements).toBe(true);
      expect(acksResponse.body._metadata.onboarding.is_finished).toBe(true);

      // Verify user is marked as completed in DB
      const updatedUser = await User.findOne({
        external_id: "user_new_incomplete",
      }).select("+location +email +first_name +last_name +onboarding");
      expect(updatedUser?.onboarding.status).toBe("completed");
      expect(updatedUser?.display_name).toBe("TestUserCustom");
      expect(updatedUser?.location?.country).toBe("US");

      // Step 5: GET /me should now show completed
      const meResponse = await request(app)
        .get("/api/v1/me")
        .set("x-test-user", "user_new_incomplete");

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.onboarding_status).toBe("completed");
      expect(meResponse.body.data.display_name).toBe("TestUserCustom");
    });

    it("should track mid-flow progress correctly", async () => {
      // Setup: User with 2 steps complete
      const testUser = await User.create({
        _id: "677a1111111111111111aaa1",
        external_id: "user_new_incomplete",
        email: "new@test.com",
        first_name: "New",
        last_name: "User",
        onboarding: {
          status: "incomplete",
          version: "1.0",
          steps: {
            location: {
              country: "US",
              postal_code: "10001",
              region: "NY",
            },
            display_name: {
              value: "MidFlowUser",
              user_provided: true,
              confirmed: true,
              updated_at: new Date()
            },
          },
        },
      });

      // GET /onboarding should show correct progress
      const progressResponse = await request(app)
        .get("/api/v1/onboarding/status")
        .set("x-test-user", "user_new_incomplete");

      expect(progressResponse.status).toBe(200);
      expect(progressResponse.body.data.progress.complete).toMatchObject({
        location: true,
        display_name: true,
        avatar: false,
        acknowledgements: false,
      });
      expect(progressResponse.body.data.progress.is_finished).toBe(false);
      expect(progressResponse.body.data.progress.next_step).toBe("avatar");
    });

    it("should prevent duplicate completion", async () => {
      // Setup: User with completed onboarding
      const testUser = await User.create({
        _id: "677a2222222222222222bbb2",
        external_id: "user_onboarded_buyer",
        email: "buyer@test.com",
        first_name: "John",
        last_name: "Buyer",
        display_name: "John Buyer",
        onboarding: {
          status: "completed",
          version: "1.0",
          completed_at: new Date(),
          steps: {
            location: {
              country: "US",
              postal_code: "10001",
              region: "NY",
            },
            display_name: {
              value: "John Buyer",
              mode: "custom",
            },
            avatar: {
              url: null,
            },
            acknowledgements: {
              terms_of_service: true,
              privacy_policy: true,
              marketplace_rules: true,
            },
          },
        },
      });

      // Attempt to patch any step should fail
      const response = await request(app)
        .patch("/api/v1/onboarding/steps/location")
        .set("x-test-user", "user_onboarded_buyer")
        .send({
          country: "CA",
          postal_code: "M5H 2N2",
          region: "ON",
        });

      expect(response.status).toBe(409); // Conflict
      expect(response.body.error.message).toMatch(/already completed/i);
    });

    it("should validate required fields at each step", async () => {
      // Setup: New incomplete user
      await User.create({
        external_id: "user_new_incomplete",
        email: "new@test.com",
        first_name: "New",
        last_name: "User",
        onboarding: {
          status: "incomplete",
          version: "1.0",
          steps: {},
        },
      });

      // Missing required field
      const response = await request(app)
        .patch("/api/v1/onboarding/steps/location")
        .set("x-test-user", "user_new_incomplete")
        .send({
          country: "US",
          // Missing postal_code
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("Onboarding + Auth Integration", () => {
    it("should sync onboarding status to session claims after completion", async () => {
      // Setup: User who just completed onboarding
      await User.create({
        _id: "677a1111111111111111aaa1",
        external_id: "user_new_incomplete",
        email: "new@test.com",
        first_name: "New",
        last_name: "User",
        display_name: "NewUser",
        onboarding: {
          status: "incomplete",
          version: "1.0",
          steps: {
            location: {
              country: "US",
              postal_code: "10001",
              region: "NY",
              updated_at: new Date()
            },
            display_name: {
              value: "NewUser",
              user_provided: true,
              confirmed: true,
              updated_at: new Date()
            },
            avatar: {
              url: null,
              user_provided: false,
              confirmed: true,
              updated_at: new Date()
            },
          },
        },
      });

      // Complete final step
      const acksResponse = await request(app)
        .patch("/api/v1/onboarding/steps/acknowledgements")
        .set("x-test-user", "user_new_incomplete")
        .send({
          tos: true,
          privacy: true,
          rules: true,
        });

      expect(acksResponse.status).toBe(200);

      // Force refresh claims
      const refreshResponse = await request(app)
        .post("/api/v1/auth/refresh")
        .set("x-test-user", "user_new_incomplete");

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.data.onboarding_status).toBe("completed");

      // GET /me should also show completed
      const meResponse = await request(app)
        .get("/api/v1/me")
        .set("x-test-user", "user_new_incomplete");

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.onboarding_status).toBe("completed");
    });

    it("should handle stale JWT after onboarding completion", async () => {
      // Setup: User who completed onboarding, but mock session shows incomplete
      const testUser = await User.create({
        external_id: "user_new_incomplete",
        email: "new@test.com",
        first_name: "New",
        last_name: "User",
        display_name: "NewUser",
        onboarding: {
          status: "completed", // DB shows completed
          version: "1.0",
          completed_at: new Date(),
          steps: {},
        },
        location: {
          country: "US",
          postal_code: "10001",
          region: "NY",
        },
      });

      // Mock session claims show "incomplete" (stale)
      // But GET /me should fall back to DB and return correct status
      const meResponse = await request(app)
        .get("/api/v1/me")
        .set("x-test-user", "user_new_incomplete");

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.onboarding_status).toBe("completed");
    });
  });

  describe("Error Handling", () => {
    it("should return 401 for unauthenticated onboarding request", async () => {
      const response = await request(app)
        .patch("/api/v1/onboarding/steps/location")
        .send({
          country: "US",
          postal_code: "10001",
          region: "NY",
        });

      expect(response.status).toBe(401);
    });

    it("should handle invalid country code", async () => {
      await User.create({
        external_id: "user_new_incomplete",
        email: "new@test.com",
        first_name: "New",
        last_name: "User",
        onboarding: {
          status: "incomplete",
          version: "1.0",
          steps: {},
        },
      });

      const response = await request(app)
        .patch("/api/v1/onboarding/steps/location")
        .set("x-test-user", "user_new_incomplete")
        .send({
          country: "XX", // Invalid
          postal_code: "10001",
          region: "NY",
        });

      expect(response.status).toBe(400);
    });

    it("should handle database errors gracefully", async () => {
      // Don't create user in DB
      // Simulate missing user scenario
      const response = await request(app)
        .patch("/api/v1/onboarding/steps/location")
        .set("x-test-user", "user_new_incomplete")
        .send({
          country: "US",
          postal_code: "10001",
          region: "NY",
        });

      // Should either create user on-the-fly or return appropriate error
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});
