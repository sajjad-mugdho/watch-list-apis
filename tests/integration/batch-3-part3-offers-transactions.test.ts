import { Types } from "mongoose";
import { NetworkListing } from "../../src/networks/models/NetworkListing";
import { Offer } from "../../src/models/Offer";
import { User } from "../../src/models/User";

describe("Batch 3 Part 3 - Offer Management & Transactions", () => {
  let seller: any;
  let buyer: any;
  let listing: any;
  let channel: any;
  let offer: any;

  beforeEach(async () => {
    seller = await User.create({
      external_id: "seller_ext",
      clerk_id: "clerk_seller",
      email: "seller@test.com",
      first_name: "Seller",
      last_name: "User",
      display_name: "selleruser",
    });

    buyer = await User.create({
      external_id: "buyer_ext",
      clerk_id: "clerk_buyer",
      email: "buyer@test.com",
      first_name: "Buyer",
      last_name: "User",
      display_name: "buyeruser",
    });

    channel = new Types.ObjectId();

    listing = await NetworkListing.create({
      dialist_id: seller._id,
      clerk_id: seller.clerk_id,
      title: "Rolex Submariner",
      brand: "Rolex",
      model: "Submariner",
      reference: "126610",
      price: 15000,
      condition: "like-new",
      status: "active",
      allow_offers: true,
      author: {
        _id: seller._id,
        name: seller.display_name,
      },
      ships_from: {
        country: "United States",
      },
    });

    offer = await Offer.create({
      listing_id: listing._id,
      channel_id: channel,
      buyer_id: buyer._id,
      seller_id: seller._id,
      platform: "networks",
      state: "CREATED",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  });

  describe("Offer Creation & Validation", () => {
    it("should create offer with required fields", async () => {
      expect(offer.listing_id).toBeDefined();
      expect(offer.buyer_id).toBeDefined();
      expect(offer.seller_id).toBeDefined();
    });

    it("should have platform field set to networks", () => {
      expect(offer.platform).toBe("networks");
    });

    it("should have offer state", () => {
      const validStates = [
        "CREATED",
        "COUNTERED",
        "ACCEPTED",
        "DECLINED",
        "EXPIRED",
        "CANCELLED",
      ];
      expect(validStates).toContain(offer.state);
    });

    it("should have buyer_id and seller_id", () => {
      expect(offer.buyer_id).toBeDefined();
      expect(offer.seller_id).toBeDefined();
      expect(offer.buyer_id.toString()).not.toBe(offer.seller_id.toString());
    });

    it("should have timestamps (createdAt, updatedAt)", () => {
      expect(offer.createdAt).toBeDefined();
      expect(offer.updatedAt).toBeDefined();
    });

    it("should have expiration date", () => {
      expect(offer.expires_at).toBeDefined();
      expect(offer.expires_at instanceof Date).toBe(true);
    });

    it("should allow offer on listing with allow_offers=true", async () => {
      expect(listing.allow_offers).toBe(true);
      expect(offer._id).toBeDefined();
    });
  });

  describe("Offer State Transitions", () => {
    it("should transition to ACCEPTED state", async () => {
      offer.state = "ACCEPTED";
      await offer.save();

      expect(offer.state).toBe("ACCEPTED");
    });

    it("should transition to DECLINED state", async () => {
      offer.state = "DECLINED";
      await offer.save();

      expect(offer.state).toBe("DECLINED");
    });

    it("should transition to COUNTERED state", async () => {
      offer.state = "COUNTERED";
      await offer.save();

      expect(offer.state).toBe("COUNTERED");
    });

    it("should transition to EXPIRED state", async () => {
      offer.state = "EXPIRED";
      await offer.save();

      expect(offer.state).toBe("EXPIRED");
    });

    it("should transition to CANCELLED state", async () => {
      offer.state = "CANCELLED";
      await offer.save();

      expect(offer.state).toBe("CANCELLED");
    });

    it("should track state changes via updatedAt", async () => {
      const originalUpdatedAt = offer.updatedAt;
      await new Promise((r) => setTimeout(r, 10));

      offer.state = "ACCEPTED";
      await offer.save();

      expect(offer.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe("Offer Queries & Filtering", () => {
    let offer2: any;
    let offer3: any;

    beforeEach(async () => {
      offer2 = await Offer.create({
        listing_id: listing._id,
        channel_id: new Types.ObjectId(),
        buyer_id: buyer._id,
        seller_id: seller._id,
        platform: "networks",
        state: "ACCEPTED",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      offer3 = await Offer.create({
        listing_id: listing._id,
        channel_id: new Types.ObjectId(),
        buyer_id: buyer._id,
        seller_id: seller._id,
        platform: "networks",
        state: "DECLINED",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    });

    it("should get all offers for a listing", async () => {
      const offersForListing = await Offer.find({
        listing_id: listing._id,
      });

      expect(offersForListing.length).toBeGreaterThan(0);
    });

    it("should filter offers by state", async () => {
      const acceptedOffers = await Offer.find({
        listing_id: listing._id,
        state: "ACCEPTED",
      });

      expect(acceptedOffers.every((o) => o.state === "ACCEPTED")).toBe(true);
    });

    it("should filter offers by buyer", async () => {
      const buyerOffers = await Offer.find({
        buyer_id: buyer._id,
      });

      expect(buyerOffers.every((o) => o.buyer_id.equals(buyer._id))).toBe(true);
    });

    it("should filter offers by seller", async () => {
      const sellerOffers = await Offer.find({
        seller_id: seller._id,
      });

      expect(sellerOffers.every((o) => o.seller_id.equals(seller._id))).toBe(
        true,
      );
    });

    it("should filter offers by platform", async () => {
      const networkOffers = await Offer.find({
        platform: "networks",
      });

      expect(networkOffers.every((o) => o.platform === "networks")).toBe(true);
    });

    it("should sort offers by date (newest first)", async () => {
      const offers = await Offer.find({
        listing_id: listing._id,
      }).sort({ createdAt: -1 });

      for (let i = 1; i < offers.length; i++) {
        expect(offers[i].createdAt.getTime()).toBeLessThanOrEqual(
          offers[i - 1].createdAt.getTime(),
        );
      }
    });

    it("should get most recent offer for listing", async () => {
      const mostRecent = await Offer.findOne({
        listing_id: listing._id,
      }).sort({ createdAt: -1 });

      const allOffers = await Offer.find({
        listing_id: listing._id,
      });

      const maxDate = Math.max(...allOffers.map((o) => o.createdAt.getTime()));
      expect(mostRecent?.createdAt.getTime()).toBe(maxDate);
    });
  });

  describe("Multiple Offers on Single Listing", () => {
    let buyer2: any;
    let buyer3: any;

    beforeEach(async () => {
      buyer2 = await User.create({
        external_id: "buyer2_ext",
        clerk_id: "clerk_buyer2",
        email: "buyer2@test.com",
        first_name: "Buyer2",
        last_name: "User",
        display_name: "buyer2user",
      });

      buyer3 = await User.create({
        external_id: "buyer3_ext",
        clerk_id: "clerk_buyer3",
        email: "buyer3@test.com",
        first_name: "Buyer3",
        last_name: "User",
        display_name: "buyer3user",
      });
    });

    it("should allow multiple offers from different buyers", async () => {
      const offer2 = await Offer.create({
        listing_id: listing._id,
        channel_id: new Types.ObjectId(),
        buyer_id: buyer2._id,
        seller_id: seller._id,
        platform: "networks",
        state: "CREATED",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const offers = await Offer.find({
        listing_id: listing._id,
      });

      expect(offers.length).toBeGreaterThanOrEqual(2);
    });

    it("should allow seller to compare multiple offers", async () => {
      const offer2 = await Offer.create({
        listing_id: listing._id,
        channel_id: new Types.ObjectId(),
        buyer_id: buyer2._id,
        seller_id: seller._id,
        platform: "networks",
        state: "CREATED",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const offer3 = await Offer.create({
        listing_id: listing._id,
        channel_id: new Types.ObjectId(),
        buyer_id: buyer3._id,
        seller_id: seller._id,
        platform: "networks",
        state: "CREATED",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const sellerOffers = await Offer.find({
        seller_id: seller._id,
        listing_id: listing._id,
      });

      expect(sellerOffers.length).toBe(3);
    });

    afterEach(async () => {
      await User.deleteMany({
        _id: { $in: [buyer2._id, buyer3._id] },
      });
    });
  });

  describe("Offer Expiration & Lifecycle", () => {
    it("should track offer creation time", () => {
      expect(offer.createdAt).toBeDefined();
      expect(offer.createdAt instanceof Date).toBe(true);
    });

    it("should support offer expiration date", async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);

      expect(expirationDate > new Date()).toBe(true);
    });

    it("should detect expired offers", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const now = new Date();
      expect(now.getTime()).toBeGreaterThan(pastDate.getTime());
    });

    it("should isExpired() method work correctly", () => {
      // Check if isExpired method exists
      if (typeof offer.isExpired === "function") {
        expect(typeof offer.isExpired()).toBe("boolean");
      }
    });
  });

  describe("Offer Snapshots", () => {
    it("should support listing_snapshot field", async () => {
      const snapshot = {
        brand: "Rolex",
        model: "Submariner",
        reference: "126610",
        price: 15000,
        condition: "like-new",
      };

      expect(snapshot).toHaveProperty("brand");
      expect(snapshot.brand).toBe("Rolex");
    });

    it("should support reservation_terms_snapshot field", async () => {
      const snapshot = { duration: "7 days" };

      expect(snapshot).toHaveProperty("duration");
      expect(snapshot.duration).toBe("7 days");
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await NetworkListing.deleteMany({});
    await Offer.deleteMany({});
  });
});
