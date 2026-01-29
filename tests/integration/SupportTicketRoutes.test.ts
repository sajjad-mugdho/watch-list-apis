import request from "supertest";
import { app } from "../../src/app";
import { User } from "../../src/models/User";
import { SupportTicket } from "../../src/models/SupportTicket";

describe("Support Ticket Endpoints Integration", () => {
  let userA: any;

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});
    await SupportTicket.deleteMany({});

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
  });

  describe("POST /api/v1/user/support/tickets", () => {
    it("should create a support ticket", async () => {
      const response = await request(app)
        .post("/api/v1/user/support/tickets")
        .set("x-test-user", "buyer_us_complete")
        .send({
          subject: "Issue with my order",
          category: "order_issue",
          priority: "medium",
          message: "I did not receive my order yet.",
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Support ticket created successfully");
      expect(response.body.data.subject).toBe("Issue with my order");
      expect(response.body.data.status).toBe("open");
    });
  });

  describe("GET /api/v1/user/support/tickets", () => {
    it("should get user tickets", async () => {
      await SupportTicket.create({
        user_id: userA._id,
        subject: "Existing Ticket",
        category: "payment_issue",
        priority: "high",
        status: "open",
        messages: [{
          sender_id: userA._id,
          sender_type: "user",
          message: "Payment failed",
          created_at: new Date()
        }],
      });

      const response = await request(app)
        .get("/api/v1/user/support/tickets")
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].subject).toBe("Existing Ticket");
    });
  });

  describe("POST /api/v1/user/support/tickets/:ticket_id/messages", () => {
    it("should add a message to ticket", async () => {
      const ticket = await SupportTicket.create({
        user_id: userA._id,
        subject: "Message Test",
        description: "Initial message",
        category: "other",
        status: "open",
        messages: [],
      });

      const response = await request(app)
        .post(`/api/v1/user/support/tickets/${ticket._id}/messages`)
        .set("x-test-user", "buyer_us_complete")
        .send({
          message: "Follow up message",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.messages.length).toBe(1);
      expect(response.body.data.messages[0].message).toBe("Follow up message");
    });
  });
});
