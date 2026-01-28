import request from "supertest";
import { app } from "../../src/app";
import { User } from "../../src/models/User";
import { NetworkListing } from "../../src/models/Listings";
import { Watch } from "../../src/models/Watches";
import mongoose from "mongoose";

describe("Profile and Wishlist Endpoints Integration", () => {
  let userA: any;
  let watch: any;
  let listing: any;

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});
    await NetworkListing.deleteMany({});
    await Watch.deleteMany({});

    // Create User A (Buyer US Complete)
    userA = await User.create({
      _id: "ccc111111111111111111111",
      external_id: "buyer_us_complete",
      email: "usera@test.com",
      first_name: "User",
      last_name: "A",
      display_name: "User A",
      onboarding: { status: "completed", steps: {} },
    });

    // Create Watch
    watch = await Watch.create({
      brand: "Rolex",
      model: "Submariner",
      reference: "126610LN",
      diameter: "41mm",
      bezel: "Ceramic",
      materials: "Steel",
      bracelet: "Oyster",
      category: "Luxury",
    });

    // Create Network Listing
    listing = await NetworkListing.create({
      dialist_id: userA._id,
      clerk_id: "buyer_us_complete",
      watch_id: watch._id,
      status: "active",
      type: "for_sale",
      brand: "Rolex",
      model: "Submariner",
      reference: "126610LN",
      diameter: "41mm",
      bezel: "Ceramic",
      materials: "Steel",
      bracelet: "Oyster",
      ships_from: { country: "US" },
      price: 10000,
    });
  });

  describe("Profile Management", () => {
    it("should update user profile bio and social links", async () => {
      const response = await request(app)
        .patch("/api/v1/user/profile")
        .set("x-test-user", "buyer_us_complete")
        .send({
          bio: "I love watches!",
          social_links: {
            instagram: "watch_lover",
            website: "https://watches.com",
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.bio).toBe("I love watches!");
      expect(response.body.data.social_links.instagram).toBe("watch_lover");
    });

    it("should get user profile", async () => {
      // First update
      await User.findByIdAndUpdate(userA._id, {
        bio: "Bio Test",
      });

      const response = await request(app)
        .get("/api/v1/user/profile")
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.data.bio).toBe("Bio Test");
      expect(response.body.data.stats).toBeDefined();
    });
  });

  describe("Wishlist Management", () => {
    it("should add a listing to wishlist", async () => {
      const response = await request(app)
        .post("/api/v1/user/wishlist")
        .set("x-test-user", "buyer_us_complete")
        .send({
          listing_id: listing._id.toString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.data.added).toBe(true);

      const user = await User.findById(userA._id);
      if (!user) throw new Error("User not found");
      expect(user.wishlist).toHaveLength(1);
      expect(user.wishlist![0].toString()).toBe(listing._id.toString());
    });

    it("should get user wishlist", async () => {
      // Add to wishlist directly
      await User.findByIdAndUpdate(userA._id, {
        $addToSet: { wishlist: listing._id },
      });

      const response = await request(app)
        .get("/api/v1/user/wishlist")
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]._id).toBe(listing._id.toString());
    });

    it("should remove from wishlist", async () => {
      await User.findByIdAndUpdate(userA._id, {
        $addToSet: { wishlist: listing._id },
      });

      const response = await request(app)
        .delete(`/api/v1/user/wishlist/${listing._id}`)
        .set("x-test-user", "buyer_us_complete");

      expect(response.status).toBe(200);
      expect(response.body.data.removed).toBe(true);

      const user = await User.findById(userA._id);
      if (!user) throw new Error("User not found");
      expect(user.wishlist).toHaveLength(0);
    });
  });
});
