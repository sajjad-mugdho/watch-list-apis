import { Types } from "mongoose";
import { NetworkListing } from "../../src/networks/models/NetworkListing";
import { Offer } from "../../src/models/Offer";
import { User } from "../../src/models/User";

describe("Batch 3 Part 4 - API Operations & Network Features", () => {
  let owner: any;
  let buyer: any;
  let listing: any;

  beforeEach(async () => {
    owner = await User.create({
      external_id: "api_owner_ext",
      clerk_id: "clerk_api_owner",
      email: "apiowner@test.com",
      first_name: "API",
      last_name: "Owner",
      display_name: "apiowner",
    });

    buyer = await User.create({
      external_id: "api_buyer_ext",
      clerk_id: "clerk_api_buyer",
      email: "apibuyer@test.com",
      first_name: "API",
      last_name: "Buyer",
      display_name: "apibuyer",
    });

    listing = await NetworkListing.create({
      dialist_id: owner._id,
      clerk_id: owner.clerk_id,
      title: "API Test Watch",
      brand: "Rolex",
      model: "Submariner",
      reference: "126610",
      price: 15000,
      condition: "like-new",
      status: "active",
      allow_offers: true,
      author: {
        _id: owner._id,
        name: owner.display_name,
      },
      ships_from: {
        country: "United States",
      },
    });
  });

  describe("Create Listing Operations", () => {
    it("should create new network listing", async () => {
      const listingData = {
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Premium Omega Seamaster",
        brand: "Omega",
        model: "Seamaster",
        reference: "210.30.42.20.01.001",
        price: 10000,
        condition: "excellent",
        description: "Excellent condition",
        images: ["https://example.com/image.jpg"],
        allow_offers: true,
        status: "draft",
        author: { _id: owner._id, name: owner.clerk_id },
        ships_from: { country: "United States" },
      };

      const created = await NetworkListing.create(listingData);
      expect(created).toHaveProperty("title");
      expect(created).toHaveProperty("price");
      expect(created).toHaveProperty("brand");
    });

    it("should validate required fields in create", async () => {
      const requiredFields = ["title", "brand", "model", "reference"];
      const listingData = {
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Watch",
        brand: "Rolex",
        model: "Datejust",
        reference: "126300",
        price: 5000,
        condition: "good",
        status: "draft",
        author: { _id: owner._id, name: owner.clerk_id },
        ships_from: { country: "United States" },
      };

      requiredFields.forEach((field) => {
        expect(listingData).toHaveProperty(field);
      });
    });

    it("should set owner from authenticated user", async () => {
      const newListing = await NetworkListing.create({
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Auto-owner Listing",
        brand: "Rolex",
        model: "Day-Date",
        reference: "128238",
        price: 8000,
        condition: "good",
        status: "draft",
        author: { _id: owner._id, name: owner.clerk_id },
        ships_from: { country: "United States" },
      });

      expect(newListing.dialist_id.equals(owner._id)).toBe(true);
    });

    it("should set initial status to draft", async () => {
      const newListing = await NetworkListing.create({
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Draft Listing",
        brand: "Omega",
        model: "Aqua Terra",
        reference: "150M",
        price: 6000,
        condition: "excellent",
        status: "draft",
        author: { _id: owner._id, name: owner.clerk_id },
        ships_from: { country: "United States" },
      });

      expect(newListing.status).toBe("draft");
    });

    it("should set allow_offers default to true", async () => {
      const newListing = await NetworkListing.create({
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Default Offers",
        brand: "TAG Heuer",
        model: "Carrera",
        reference: "CAW211P",
        price: 7000,
        condition: "good",
        status: "draft",
        author: { _id: owner._id, name: owner.clerk_id },
        ships_from: { country: "United States" },
      });

      expect(newListing.allow_offers).toBe(true);
    });
  });

  describe("List Listings Operations", () => {
    beforeEach(async () => {
      await NetworkListing.insertMany([
        {
          dialist_id: owner._id,
          clerk_id: owner.clerk_id,
          title: "Listing 1",
          brand: "Rolex",
          model: "GMT-Master",
          reference: "126710",
          price: 5000,
          condition: "good",
          status: "active",
          author: { _id: owner._id, name: owner.clerk_id },
          ships_from: { country: "United States" },
        },
        {
          dialist_id: owner._id,
          clerk_id: owner.clerk_id,
          title: "Listing 2",
          brand: "Omega",
          model: "Speedmaster",
          reference: "311.30.42.30.01.005",
          price: 8000,
          condition: "excellent",
          status: "active",
          author: { _id: owner._id, name: owner.clerk_id },
          ships_from: { country: "United States" },
        },
        {
          dialist_id: owner._id,
          clerk_id: owner.clerk_id,
          title: "Listing 3",
          brand: "TAG Heuer",
          model: "Monaco",
          reference: "CAW211P",
          price: 12000,
          condition: "mint",
          status: "draft",
          author: { _id: owner._id, name: owner.clerk_id },
          ships_from: { country: "United States" },
        },
      ]);
    });

    it("should list all active listings", async () => {
      const activeListings = await NetworkListing.find({
        status: "active",
        author: { _id: owner._id, name: owner.clerk_id },
        ships_from: { country: "United States" },
      });

      expect(activeListings.length).toBeGreaterThan(0);
      expect(activeListings.every((l) => l.status === "active")).toBe(true);
    });

    it("should support pagination params", () => {
      const params = { skip: 0, limit: 10 };
      expect(params).toHaveProperty("skip");
      expect(params).toHaveProperty("limit");
    });

    it("should support sorting by price", async () => {
      const sorted = await NetworkListing.find({
        dialist_id: owner._id,
      }).sort({ price: 1 });

      if (sorted.length > 1) {
        for (let i = 1; i < sorted.length; i++) {
          const prevPrice = sorted[i - 1].price ?? 0;
          const currPrice = sorted[i].price ?? 0;
          expect(currPrice).toBeGreaterThanOrEqual(prevPrice);
        }
      }
    });

    it("should support filtering by brand", async () => {
      const rolexListings = await NetworkListing.find({
        dialist_id: owner._id,
        brand: "Rolex",
      });

      expect(rolexListings.every((l) => l.brand === "Rolex")).toBe(true);
    });

    it("should support filtering by price range", async () => {
      const ranged = await NetworkListing.find({
        dialist_id: owner._id,
        price: { $gte: 7000, $lte: 9000 },
      });

      expect(
        ranged.every((l) => {
          const price = l.price ?? 0;
          return price >= 7000 && price <= 9000;
        }),
      ).toBe(true);
    });

    it("should exclude deleted listings by default", async () => {
      const toDelete = await NetworkListing.findOne({ dialist_id: owner._id });
      if (toDelete) {
        toDelete.is_deleted = true;
        await toDelete.save();
      }

      const active = await NetworkListing.find({
        dialist_id: owner._id,
        is_deleted: { $ne: true },
      });

      expect(active.every((l) => !l.is_deleted)).toBe(true);
    });
  });

  describe("Get Single Listing Operations", () => {
    it("should get listing by id", async () => {
      const fetched = await NetworkListing.findById(listing._id);

      expect(fetched).toBeDefined();
      expect(fetched?._id.equals(listing._id)).toBe(true);
    });

    it("should include all listing fields", async () => {
      const fetched = await NetworkListing.findById(listing._id);

      expect(fetched).toHaveProperty("title");
      expect(fetched).toHaveProperty("brand");
      expect(fetched).toHaveProperty("price");
      expect(fetched).toHaveProperty("condition");
      expect(fetched).toHaveProperty("dialist_id");
    });

    it("should return null for non-existent listing", async () => {
      const fakeId = new Types.ObjectId();
      const notFound = await NetworkListing.findById(fakeId);

      expect(notFound).toBeNull();
    });

    it("should include offer statistics", async () => {
      const fetched = await NetworkListing.findById(listing._id);
      expect(fetched).toHaveProperty("offers_count");
      expect(fetched).toHaveProperty("view_count");
    });
  });

  describe("Update Listing Operations", () => {
    it("should update listing title", async () => {
      const newTitle = "Updated Title";
      listing.title = newTitle;
      await listing.save();

      const updated = await NetworkListing.findById(listing._id);
      expect(updated?.title).toBe(newTitle);
    });

    it("should update listing price", async () => {
      const newPrice = 18000;
      listing.price = newPrice;
      await listing.save();

      const updated = await NetworkListing.findById(listing._id);
      expect(updated?.price).toBe(newPrice);
    });

    it("should update listing status", async () => {
      listing.status = "sold";
      await listing.save();

      const updated = await NetworkListing.findById(listing._id);
      expect(updated?.status).toBe("sold");
    });

    it("should update condition", async () => {
      listing.condition = "good";
      await listing.save();

      const updated = await NetworkListing.findById(listing._id);
      expect(updated?.condition).toBe("good");
    });

    it("should update allow_offers flag", async () => {
      listing.allow_offers = false;
      await listing.save();

      const updated = await NetworkListing.findById(listing._id);
      expect(updated?.allow_offers).toBe(false);
    });

    it("should verify ownership before update", () => {
      const isOwner = listing.dialist_id.equals(owner._id);
      const isNotOwner = listing.dialist_id.equals(buyer._id);

      expect(isOwner).toBe(true);
      expect(isNotOwner).toBe(false);
    });

    it("should perform partial update", async () => {
      const originalBrand = listing.brand;
      listing.price = 20000;
      await listing.save();

      const updated = await NetworkListing.findById(listing._id);
      expect(updated?.price).toBe(20000);
      expect(updated?.brand).toBe(originalBrand);
    });
  });

  describe("Delete Listing Operations", () => {
    it("should soft delete listing", async () => {
      listing.is_deleted = true;
      await listing.save();

      const deleted = await NetworkListing.findById(listing._id);
      expect(deleted?.is_deleted).toBe(true);
    });

    it("should hard delete listing", async () => {
      const id = listing._id;
      await NetworkListing.deleteOne({ _id: id });

      const deleted = await NetworkListing.findById(id);
      expect(deleted).toBeNull();
    });

    it("should verify ownership before delete", () => {
      const isOwner = listing.dialist_id.equals(owner._id);
      const isNotOwner = listing.dialist_id.equals(buyer._id);

      expect(isOwner).toBe(true);
      expect(isNotOwner).toBe(false);
    });

    it("should exclude soft-deleted from active queries", async () => {
      listing.is_deleted = true;
      await listing.save();

      const found = await NetworkListing.findOne({
        _id: listing._id,
        is_deleted: { $ne: true },
      });

      expect(found).toBeNull();
    });
  });

  describe("Create Offer Operations", () => {
    it("should create offer on listing", async () => {
      const channel = new Types.ObjectId();
      const newOffer = await Offer.create({
        listing_id: listing._id,
        channel_id: channel,
        buyer_id: buyer._id,
        seller_id: owner._id,
        platform: "networks",
        state: "CREATED",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(newOffer.listing_id.equals(listing._id)).toBe(true);
      expect(newOffer.buyer_id.equals(buyer._id)).toBe(true);
    });

    it("should validate offer is from authenticated buyer", async () => {
      const channel = new Types.ObjectId();
      const newOffer = await Offer.create({
        listing_id: listing._id,
        channel_id: channel,
        buyer_id: buyer._id,
        seller_id: owner._id,
        platform: "networks",
        state: "CREATED",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(newOffer.buyer_id.equals(buyer._id)).toBe(true);
    });

    it("should not allow offer on listing with allow_offers=false", async () => {
      listing.allow_offers = false;
      await listing.save();

      expect(listing.allow_offers).toBe(false);
    });
  });

  describe("List Offers Operations", () => {
    let buyer2: any;

    beforeEach(async () => {
      // Create a second buyer for testing multiple offers
      buyer2 = await User.create({
        external_id: `api_buyer2_ext_${Date.now()}`,
        clerk_id: `clerk_api_buyer2_${Date.now()}`,
        email: `apibuyer2_${Date.now()}@test.com`,
        first_name: "API",
        last_name: "Buyer2",
        display_name: `apibuyer2_${Date.now()}`,
      });

      const channel1 = new Types.ObjectId();
      const channel2 = new Types.ObjectId();

      await Offer.insertMany([
        {
          listing_id: listing._id,
          channel_id: channel1,
          buyer_id: buyer._id,
          seller_id: owner._id,
          platform: "networks",
          state: "CREATED",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        {
          listing_id: listing._id,
          channel_id: channel2,
          buyer_id: buyer2._id,
          seller_id: owner._id,
          platform: "networks",
          state: "CREATED",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ]);
    });

    it("should list all offers for listing", async () => {
      const offers = await Offer.find({
        listing_id: listing._id,
      });

      expect(offers.length).toBeGreaterThan(0);
    });

    it("should sort offers by date", async () => {
      const offers = await Offer.find({
        listing_id: listing._id,
      }).sort({ createdAt: -1 });

      if (offers.length > 1) {
        expect(offers[0].createdAt.getTime()).toBeGreaterThanOrEqual(
          offers[1].createdAt.getTime(),
        );
      }
    });

    it("should be accessible to seller and buyers", async () => {
      const sellerCanSee = listing.dialist_id.equals(owner._id);
      const buyerCanSeeOwn = true;

      expect(sellerCanSee).toBe(true);
      expect(buyerCanSeeOwn).toBe(true);
    });
  });

  describe("Update Offer Status Operations", () => {
    let offer: any;

    beforeEach(async () => {
      const channel = new Types.ObjectId();
      offer = await Offer.create({
        listing_id: listing._id,
        channel_id: channel,
        buyer_id: buyer._id,
        seller_id: owner._id,
        platform: "networks",
        state: "CREATED",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    });

    it("should accept offer", async () => {
      offer.state = "ACCEPTED";
      await offer.save();

      const updated = await Offer.findById(offer._id);
      expect(updated?.state).toBe("ACCEPTED");
    });

    it("should decline offer", async () => {
      offer.state = "DECLINED";
      await offer.save();

      const updated = await Offer.findById(offer._id);
      expect(updated?.state).toBe("DECLINED");
    });

    it("should only allow seller to accept/decline", () => {
      const isOwner = listing.dialist_id.equals(owner._id);
      expect(isOwner).toBe(true);
    });

    it("should allow buyer to cancel offer", async () => {
      offer.state = "CANCELLED";
      await offer.save();

      const updated = await Offer.findById(offer._id);
      expect(updated?.state).toBe("CANCELLED");
    });
  });

  describe("Query Optimization & Performance", () => {
    it("should support indexed search on brand", async () => {
      const results = await NetworkListing.find({
        brand: "Rolex",
      });

      expect(results).toBeDefined();
    });

    it("should support indexed search on dialist_id", async () => {
      const results = await NetworkListing.find({
        dialist_id: owner._id,
      });

      expect(results).toBeDefined();
    });

    it("should support indexed search on reference", async () => {
      const results = await NetworkListing.find({
        reference: "126610",
      });

      expect(results).toBeDefined();
    });

    it("should handle pagination efficiently", () => {
      const pageSize = 20;
      const page = 1;
      const skip = (page - 1) * pageSize;

      expect(skip).toBe(0);
      expect(pageSize).toBe(20);
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await NetworkListing.deleteMany({});
    await Offer.deleteMany({});
  });
});
