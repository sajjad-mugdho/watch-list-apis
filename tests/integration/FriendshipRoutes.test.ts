import request from "supertest";
import { Types } from "mongoose";
import { app } from "../../src/app";
import { User } from "../../src/models/User";
import { Friendship } from "../../src/models/Friendship";

describe("Friendship Endpoints Integration", () => {
  let userA: any;
  let userB: any;
  let userC: any;

  beforeAll(async () => {
    // Clean up
    await User.deleteMany({});
    await Friendship.deleteMany({});

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

    // Create User C (New User CA) - ID from customClerkMw
    userC = await User.create({
      _id: "aaa444444444444444444444",
      external_id: "new_user_ca",
      email: "userc@test.com",
      first_name: "User",
      last_name: "C",
      display_name: "User C",
      onboarding: { status: "completed", steps: {} },
    });
  });

  beforeEach(async () => {
    await Friendship.deleteMany({});
  });

  describe("POST /api/v1/user/friends/requests", () => {
    it("should send a friend request", async () => {
      const response = await request(app)
        .post("/api/v1/user/friends/requests")
        .set("x-test-user", "buyer_us_complete")
        .send({ user_id: userB._id.toString() });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Friend request sent");
      expect(response.body.data.status).toBe("pending");
      expect(response.body.data.addressee_id).toBe(userB._id.toString());
    });

    it("should return 400 if sending to self", async () => {
      const response = await request(app)
        .post("/api/v1/user/friends/requests")
        .set("x-test-user", "buyer_us_complete")
        .send({ user_id: userA._id.toString() });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain("cannot friend yourself");
    });
  });

  describe("GET /api/v1/user/friends/requests/pending", () => {
    it("should get pending requests received by user", async () => {
      // Create a pending request from B to A
      await Friendship.create({
        requester_id: userB._id,
        addressee_id: userA._id,
        status: "pending",
      });

      const response = await request(app)
        .get("/api/v1/user/friends/requests/pending")
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.data[0].requester_id._id).toBe(userB._id.toString());
    });
  });

  describe("POST /api/v1/user/friends/requests/:friendship_id/accept", () => {
    it("should accept a friend request", async () => {
      const friendship = await Friendship.create({
        requester_id: userB._id,
        addressee_id: userA._id,
        status: "pending",
      });

      const response = await request(app)
        .post(`/api/v1/user/friends/requests/${friendship._id}/accept`)
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Friend request accepted");
      expect(response.body.data.status).toBe("accepted");
    });
  });

  describe("GET /api/v1/user/friends", () => {
    it("should return friends list", async () => {
      // Create an accepted friendship
      await Friendship.create({
        requester_id: userA._id,
        addressee_id: userB._id,
        status: "accepted",
      });

      const response = await request(app)
        .get("/api/v1/user/friends")
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      // Depending on serialization, friend might be userB
    });
  });

  describe("GET /api/v1/user/friends/mutual/:user_id", () => {
    it("should return mutual friends", async () => {
      // A is friends with C
      await Friendship.create({
        requester_id: userA._id,
        addressee_id: userC._id,
        status: "accepted",
      });

      // B is friends with C
      await Friendship.create({
        requester_id: userB._id,
        addressee_id: userC._id,
        status: "accepted",
      });

      const response = await request(app)
        .get(`/api/v1/user/friends/mutual/${userB._id}`)
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0]._id).toBe(userC._id.toString());
    });
  });

  describe("DELETE /api/v1/user/friends/:friendship_id", () => {
    it("should remove a friend", async () => {
      const friendship = await Friendship.create({
        requester_id: userA._id,
        addressee_id: userB._id,
        status: "accepted",
      });

      const response = await request(app)
        .delete(`/api/v1/user/friends/${friendship._id}`)
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Friend removed");

      const exists = await Friendship.findById(friendship._id);
      expect(exists).toBeNull();
    });
  });
});
