import request from "supertest";
import { app } from "../../src/app";
import { User } from "../../src/models/User";
import { Connection } from "../../src/models/Connection";

describe("Connection Endpoints Integration", () => {
  let userA: any;
  let userB: any;
  let userC: any;

  beforeEach(async () => {
    // Clean up first (though setup.ts does this, being explicit helps)
    await User.deleteMany({});
    await Connection.deleteMany({});

    // Create User A (Buyer US Complete) - ID from customClerkMw
    userA = await User.create({
      _id: "ccc111111111111111111111",
      external_id: "buyer_us_complete",
      email: "usera@test.com",
      first_name: "User",
      last_name: "A",
      display_name: "User A",
      onboarding: { status: "completed", steps: {} },
    });

    // Create User B (Merchant Approved) - ID from customClerkMw
    userB = await User.create({
      _id: "ddd333333333333333333333",
      external_id: "merchant_approved",
      email: "userb@test.com",
      first_name: "User",
      last_name: "B",
      display_name: "User B",
      onboarding: { status: "completed", steps: {} },
    });

    // Create User C (New User CA) - ID from customClerkMw ALIGNED
    userC = await User.create({
      _id: "aaa222222222222222222222", // Aligned with customClerkMw
      external_id: "new_user_ca",
      email: "userc@test.com",
      first_name: "User",
      last_name: "C",
      display_name: "User C",
      onboarding: { status: "completed", steps: {} },
    });
  });

  describe("POST /api/v1/networks/user/connections/:id", () => {
    it("should send a connection request", async () => {
      const response = await request(app)
        .post(`/api/v1/networks/user/connections/${userB._id}`)
        .set("x-test-user", "buyer_us_complete")
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Connection request sent");
      expect(response.body.connection.status).toBe("pending");
      expect(response.body.connection.following_id).toBe(userB._id.toString());
    });

    it("should return 400 if sending to self", async () => {
      const response = await request(app)
        .post(`/api/v1/networks/user/connections/${userA._id}`)
        .set("x-test-user", "buyer_us_complete")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        "Cannot connect with yourself",
      );
    });
  });

  describe("GET /api/v1/networks/user/connections/requests", () => {
    it("should get pending requests received by user", async () => {
      await Connection.create({
        follower_id: userB._id,
        following_id: userA._id,
        status: "pending",
      });

      const response = await request(app)
        .get("/api/v1/networks/user/connections/requests")
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(1);
      expect(response.body.requests[0].user._id).toBe(userB._id.toString());
    });
  });

  describe("POST /api/v1/networks/user/connections/requests/:id/accept", () => {
    it("should accept a connection request", async () => {
      const connection = await Connection.create({
        follower_id: userB._id,
        following_id: userA._id,
        status: "pending",
      });

      const response = await request(app)
        .post(
          `/api/v1/networks/user/connections/requests/${connection._id}/accept`,
        )
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Connection request accepted");
      expect(response.body.connection.status).toBe("accepted");
    });
  });

  describe("GET /api/v1/networks/user/connections/outgoing", () => {
    it("should return outgoing accepted connections", async () => {
      await Connection.create({
        follower_id: userA._id,
        following_id: userB._id,
        status: "accepted",
        accepted_at: new Date(),
      });

      const response = await request(app)
        .get("/api/v1/networks/user/connections/outgoing")
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(1);
      expect(response.body.connections.length).toBe(1);
    });
  });

  describe("GET /api/v1/networks/users/:id/connection-status", () => {
    it("should return directional connection status", async () => {
      await Connection.create({
        follower_id: userA._id,
        following_id: userC._id,
        status: "accepted",
        accepted_at: new Date(),
      });

      await Connection.create({
        follower_id: userC._id,
        following_id: userA._id,
        status: "accepted",
        accepted_at: new Date(),
      });

      const response = await request(app)
        .get(`/api/v1/networks/users/${userC._id}/connection-status`)
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.is_connected_to).toBe(true);
      expect(response.body.is_connected_by).toBe(true);
      expect(response.body.outgoing_status).toBe("accepted");
      expect(response.body.incoming_status).toBe("accepted");
    });
  });

  describe("DELETE /api/v1/networks/user/connections/:id", () => {
    it("should remove an outgoing connection", async () => {
      await Connection.create({
        follower_id: userA._id,
        following_id: userB._id,
        status: "accepted",
        accepted_at: new Date(),
      });

      const response = await request(app)
        .delete(`/api/v1/networks/user/connections/${userB._id}`)
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Connection removed");

      const exists = await Connection.findOne({
        follower_id: userA._id,
        following_id: userB._id,
      });
      expect(exists).toBeNull();
    });
  });
});
