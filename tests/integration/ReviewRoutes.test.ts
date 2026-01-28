import request from "supertest";
import { app } from "../../src/app";
import { User } from "../../src/models/User";
import { Order } from "../../src/models/Order";
import { Review } from "../../src/models/Review";
import { NetworkListing } from "../../src/models/Listings";
import { Watch } from "../../src/models/Watches";
import { Types } from "mongoose";

describe("Review Endpoints Integration", () => {
  let buyer: any;
  let seller: any;
  let watch: any;
  let listing: any;
  let order: any;

  beforeAll(async () => {
    // Setup Watch
    watch = await Watch.create({
      brand: "Rolex",
      model: "Submariner",
      reference: "126610LN",
      diameter: "41mm",
      bezel: "Ceramic",
      materials: "Oystersteel",
      bracelet: "Oyster",
    });
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Order.deleteMany({});
    await Review.deleteMany({});
    await NetworkListing.deleteMany({});

    // Create Buyer with ID matching customClerkMw.ts
    buyer = await User.create({
      _id: "ccc111111111111111111111",
      external_id: "buyer_us_complete",
      email: "buyer@test.com",
      first_name: "Buyer",
      last_name: "Test",
      display_name: "Buyer Test",
      onboarding: { status: "completed", steps: {} },
    });

    // Create Seller with ID matching customClerkMw.ts
    seller = await User.create({
      _id: "ddd333333333333333333333",
      external_id: "merchant_approved",
      email: "seller@test.com",
      first_name: "Seller",
      last_name: "Test",
      display_name: "Seller Test",
      onboarding: { status: "completed", steps: {} },
    });

    // Create Listing
    listing = await NetworkListing.create({
      dialist_id: seller._id,
      clerk_id: "seller_test",
      watch_id: watch._id,
      brand: watch.brand,
      model: watch.model,
      reference: watch.reference,
      diameter: watch.diameter,
      bezel: watch.bezel,
      materials: watch.materials,
      bracelet: watch.bracelet,
      price: 10000,
      status: "active",
      author: {
        _id: seller._id,
        name: seller.display_name,
      },
      ships_from: { country: "US" },
    });

    // Create Completed Order
    order = await Order.create({
      buyer_id: buyer._id,
      seller_id: seller._id,
      listing_id: listing._id,
      listing_type: "NetworkListing",
      listing_snapshot: {
        brand: watch.brand,
        model: watch.model,
        price: 10000,
      },
      amount: 10000,
      currency: "usd",
      status: "delivered",
      payment_status: "paid",
    });
  });

  describe("POST /api/v1/reviews", () => {
    it("should create a review for a completed order", async () => {
      // Create a fresh completed order
      const completedOrder = await Order.create({
        buyer_id: buyer._id,
        seller_id: seller._id,
        listing_id: listing._id,
        listing_type: "NetworkListing",
        listing_snapshot: { brand: watch.brand, model: watch.model, price: 10000 },
        amount: 10000,
        status: "completed",
      });

      const response = await request(app)
        .post("/api/v1/reviews")
        .set("x-test-user", "buyer_us_complete")
        .send({
          order_id: completedOrder._id.toString(),
          target_user_id: seller._id.toString(),
          rating: 5,
          feedback: "Great seller, fast shipping!",
          role: "buyer",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.rating).toBe(5);
      expect(response.body.data.feedback).toBe("Great seller, fast shipping!");

      // Verify user stats updated
      const updatedSeller = await User.findById(seller._id);
      expect(updatedSeller?.stats?.avg_rating).toBe(5);
      expect(updatedSeller?.stats?.rating_count).toBe(1);
    });

    it("should return 400 if order is not completed", async () => {
      const pendingOrder = await Order.create({
        buyer_id: buyer._id,
        seller_id: seller._id,
        listing_id: listing._id,
        listing_type: "NetworkListing",
        listing_snapshot: {
          brand: watch.brand,
          model: watch.model,
          price: 10000,
        },
        amount: 10000,
        status: "paid", // Not delivered or completed
      });

      const response = await request(app)
        .post("/api/v1/reviews")
        .set("x-test-user", "buyer_us_complete")
        .send({
          order_id: pendingOrder._id.toString(),
          target_user_id: seller._id.toString(),
          rating: 4,
          feedback: "Order still in progress",
          role: "buyer",
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain("must be delivered or completed");
    });

    it("should prevent duplicate reviews", async () => {
      const completedOrder = await Order.create({
        buyer_id: buyer._id,
        seller_id: seller._id,
        listing_id: listing._id,
        listing_type: "NetworkListing",
        listing_snapshot: { brand: watch.brand, model: watch.model, price: 10000 },
        amount: 10000,
        status: "completed",
      });

      // Create first review
      await Review.create({
        reviewer_id: buyer._id,
        target_user_id: seller._id,
        order_id: completedOrder._id,
        rating: 5,
        feedback: "First review message is long enough",
        role: "buyer",
      });

      // Try to create duplicate
      const response = await request(app)
        .post("/api/v1/reviews")
        .set("x-test-user", "buyer_us_complete")
        .send({
          order_id: completedOrder._id.toString(),
          target_user_id: seller._id.toString(),
          rating: 1,
          feedback: "Trying to review again with another long message",
          role: "buyer",
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain("already reviewed");
    });
  });

  describe("GET /api/v1/reviews/me", () => {
    it("should return reviews for current user", async () => {
      const feedback = "Excellent communication, highly recommended!";
      const bId = "ccc111111111111111111111"; // current user (buyer)
      const sId = "ddd333333333333333333333";
      
      await Review.create({
        reviewer_id: bId, // I AM THE REVIEWER
        target_user_id: sId,
        order_id: new Types.ObjectId(),
        rating: 5,
        feedback,
        role: "buyer",
      });

      const response = await request(app)
        .get("/api/v1/reviews/me")
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].feedback).toBe(feedback);
    });
  });

  describe("GET /api/v1/reviews/users/:id", () => {
    it("should return public reviews for another user", async () => {
      const feedback = "Good transaction, would buy again soon.";
      await Review.create({
        reviewer_id: buyer._id,
        target_user_id: seller._id,
        order_id: new Types.ObjectId(),
        rating: 4,
        feedback,
        role: "buyer",
      });

      const response = await request(app)
        .get(`/api/v1/reviews/users/${seller._id}`)
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].feedback).toBe(feedback);
    });
  });

  describe("GET /api/v1/reviews/users/:id/summary", () => {
    it("should return rating aggregated stats", async () => {
      // Create actual reviews so aggregation works
      await Review.create([
        {
          reviewer_id: buyer._id,
          target_user_id: seller._id,
          order_id: new Types.ObjectId(),
          rating: 5,
          feedback: "Great seller, very fast!",
          role: "buyer",
        },
        {
          reviewer_id: buyer._id,
          target_user_id: seller._id,
          order_id: new Types.ObjectId(),
          rating: 4,
          feedback: "Good seller, accurate.",
          role: "buyer",
        }
      ]);

      const response = await request(app)
        .get(`/api/v1/reviews/users/${seller._id}/summary`)
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.data.avg_rating).toBeGreaterThan(0);
      expect(response.body.data.rating_count).toBeGreaterThanOrEqual(2);
    });
  });
});
