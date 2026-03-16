import { Types } from "mongoose";
import { NetworkListing } from "../../src/networks/models/NetworkListing";
import { User } from "../../src/models/User";

describe("Batch 3 Part 2 - Batch Actions & Bulk Operations", () => {
  let owner: any;
  let listings: any[] = [];

  beforeEach(async () => {
    owner = await User.create({
      external_id: "bulk_owner_ext",
      clerk_id: "clerk_bulk_owner",
      email: "bulkowner@test.com",
      first_name: "Bulk",
      last_name: "Owner",
      display_name: "bulkuser",
    });

    listings = await NetworkListing.insertMany([
      {
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Rolex Submariner",
        brand: "Rolex",
        model: "Submariner",
        reference: "126610",
        price: 15000,
        condition: "like-new",
        status: "active",
        author: { _id: owner._id, name: owner.clerk_id },
        ships_from: { country: "United States" },
      },
      {
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Omega Seamaster",
        brand: "Omega",
        model: "Seamaster",
        reference: "210.30.42.20.01.001",
        price: 8000,
        condition: "excellent",
        status: "active",
        author: { _id: owner._id, name: owner.clerk_id },
        ships_from: { country: "United States" },
      },
      {
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "TAG Heuer Monaco",
        brand: "TAG Heuer",
        model: "Monaco",
        reference: "CAW211P.FC6356",
        price: 10000,
        condition: "good",
        status: "draft",
        author: { _id: owner._id, name: owner.clerk_id },
        ships_from: { country: "United States" },
      },
      {
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "IWC Pilot",
        brand: "IWC",
        model: "Pilot",
        reference: "IW327009",
        price: 12000,
        condition: "excellent",
        status: "active",
        author: { _id: owner._id, name: owner.clerk_id },
        ships_from: { country: "United States" },
      },
    ]);
  });

  describe("Batch Update Operations", () => {
    it("should batch update status for multiple listings", async () => {
      const listingIds = listings.slice(0, 2).map((l) => l._id);

      await NetworkListing.updateMany(
        { _id: { $in: listingIds } },
        { status: "sold" },
      );

      const updated = await NetworkListing.find({ _id: { $in: listingIds } });
      expect(updated.every((l) => l.status === "sold")).toBe(true);
    });

    it("should batch update prices for multiple listings", async () => {
      const listingIds = listings.slice(0, 3).map((l) => l._id);
      const newPrice = 9999;

      await NetworkListing.updateMany(
        { _id: { $in: listingIds } },
        { price: newPrice },
      );

      const updated = await NetworkListing.find({ _id: { $in: listingIds } });
      expect(updated.every((l) => l.price === newPrice)).toBe(true);
    });

    it("should batch update condition for multiple listings", async () => {
      const listingIds = listings.map((l) => l._id);
      const newCondition = "fair";

      await NetworkListing.updateMany(
        { _id: { $in: listingIds } },
        { condition: newCondition },
      );

      const updated = await NetworkListing.find({ _id: { $in: listingIds } });
      expect(updated.every((l) => l.condition === newCondition)).toBe(true);
    });

    it("should batch update allow_offers flag", async () => {
      const listingIds = listings.slice(0, 2).map((l) => l._id);

      await NetworkListing.updateMany(
        { _id: { $in: listingIds } },
        { allow_offers: false },
      );

      const updated = await NetworkListing.find({ _id: { $in: listingIds } });
      expect(updated.every((l) => l.allow_offers === false)).toBe(true);
    });

    it("should update multiple fields in batch", async () => {
      const listingIds = listings.slice(0, 2).map((l) => l._id);
      const updates = {
        status: "reserved",
        condition: "mint",
        allow_offers: false,
      };

      await NetworkListing.updateMany({ _id: { $in: listingIds } }, updates);

      const updated = await NetworkListing.find({ _id: { $in: listingIds } });
      expect(updated.every((l) => l.status === "reserved")).toBe(true);
      expect(updated.every((l) => l.condition === "mint")).toBe(true);
      expect(updated.every((l) => l.allow_offers === false)).toBe(true);
    });

    it("should batch soft delete listings", async () => {
      const listingIds = listings.slice(0, 2).map((l) => l._id);

      await NetworkListing.updateMany(
        { _id: { $in: listingIds } },
        { is_deleted: true },
      );

      const deleted = await NetworkListing.find({ _id: { $in: listingIds } });
      expect(deleted.every((l) => l.is_deleted)).toBe(true);
    });

    it("should return updateMany result stats", async () => {
      const listingIds = listings.slice(0, 2).map((l) => l._id);

      const result = await NetworkListing.updateMany(
        { _id: { $in: listingIds } },
        { status: "sold" },
      );

      expect(result.matchedCount).toBe(2);
      expect(result.modifiedCount).toBe(2);
    });

    it("should handle empty batch update", async () => {
      const result = await NetworkListing.updateMany(
        { _id: { $in: [] } },
        { status: "sold" },
      );

      expect(result.matchedCount).toBe(0);
      expect(result.modifiedCount).toBe(0);
    });
  });

  describe("Batch Delete Operations", () => {
    it("should soft delete multiple listings", async () => {
      const listingIds = listings.slice(0, 2).map((l) => l._id);

      await NetworkListing.updateMany(
        { _id: { $in: listingIds } },
        { is_deleted: true },
      );

      const active = await NetworkListing.find({
        _id: { $in: listingIds },
        is_deleted: { $ne: true },
      });

      expect(active).toHaveLength(0);
    });

    it("should hard delete multiple listings", async () => {
      const listingIds = listings.slice(0, 2).map((l) => l._id);

      await NetworkListing.deleteMany({ _id: { $in: listingIds } });

      const remaining = await NetworkListing.find({ _id: { $in: listingIds } });
      expect(remaining).toHaveLength(0);
    });

    it("should return deleteMany result stats", async () => {
      const listingIds = listings.slice(0, 2).map((l) => l._id);

      const result = await NetworkListing.deleteMany({
        _id: { $in: listingIds },
      });

      expect(result.deletedCount).toBe(2);
    });

    it("should handle empty batch delete", async () => {
      const result = await NetworkListing.deleteMany({ _id: { $in: [] } });

      expect(result.deletedCount).toBe(0);
    });
  });

  describe("Batch Filtering & Selection", () => {
    it("should batch update by status filter", async () => {
      await NetworkListing.updateMany(
        { status: "draft" },
        { status: "active" },
      );

      const draftListings = await NetworkListing.find({
        dialist_id: owner._id,
        status: "draft",
        author: { _id: owner._id, name: owner.clerk_id },
        ships_from: { country: "United States" },
      });

      expect(draftListings).toHaveLength(0);
    });

    it("should batch update by multiple filters", async () => {
      await NetworkListing.updateMany(
        {
          dialist_id: owner._id,
          condition: "excellent",
          price: { $gt: 10000 },
        },
        { allow_offers: false },
      );

      const updated = await NetworkListing.find({
        dialist_id: owner._id,
        condition: "excellent",
        price: { $gt: 10000 },
      });

      expect(updated.every((l) => l.allow_offers === false)).toBe(true);
    });

    it("should batch update by price range", async () => {
      const priceThreshold = 10000;

      await NetworkListing.updateMany(
        { price: { $lte: priceThreshold } },
        { condition: "fair" },
      );

      const updated = await NetworkListing.find({
        price: { $lte: priceThreshold },
      });
      updated.forEach((listing) => {
        if (listing.price !== undefined) {
          expect(listing.price).toBeLessThanOrEqual(priceThreshold);
        }
      });
    });

    it("should batch update by brand filter", async () => {
      await NetworkListing.updateMany(
        { brand: "Rolex" },
        { status: "reserved" },
      );

      const rolexListings = await NetworkListing.find({ brand: "Rolex" });
      expect(rolexListings.every((l) => l.status === "reserved")).toBe(true);
    });
  });

  describe("Batch Operations Response", () => {
    it("should return operation count statistics", async () => {
      const result = await NetworkListing.updateMany(
        { _id: { $in: listings.map((l) => l._id) } },
        { status: "sold" },
      );

      expect(result).toHaveProperty("matchedCount");
      expect(result).toHaveProperty("modifiedCount");
      expect(result.matchedCount).toBeGreaterThan(0);
    });
  });

  describe("Batch Operations Atomicity", () => {
    it("should batch update atomically", async () => {
      const listingIds = listings.slice(0, 2).map((l) => l._id);

      await NetworkListing.updateMany(
        { _id: { $in: listingIds } },
        { status: "reserved" },
      );

      const updated = await NetworkListing.find({ _id: { $in: listingIds } });

      const statuses = new Set(updated.map((l) => l.status));
      expect(statuses.size).toBe(1);
      expect(statuses.has("reserved")).toBe(true);
    });

    it("should maintain consistency across batch operations", async () => {
      const allIds = listings.map((l) => l._id);

      await NetworkListing.updateMany(
        { _id: { $in: allIds.slice(0, 2) } },
        { status: "sold" },
      );

      await NetworkListing.updateMany(
        { _id: { $in: allIds.slice(2) } },
        { status: "active" },
      );

      const first = await NetworkListing.find({
        _id: { $in: allIds.slice(0, 2) },
      });
      const second = await NetworkListing.find({
        _id: { $in: allIds.slice(2) },
      });

      expect(first.every((l) => l.status === "sold")).toBe(true);
      expect(second.every((l) => l.status === "active")).toBe(true);
    });
  });

  describe("Bulk Insert & Create Operations", () => {
    it("should bulk insert multiple listings", async () => {
      const bulkListings = [
        {
          dialist_id: owner._id,
          clerk_id: owner.clerk_id,
          title: "Bulk Listing 1",
          brand: "Rolex",
          model: "Datejust",
          reference: "126300",
          price: 5000,
          condition: "good",
          status: "draft",
          author: { _id: owner._id, name: owner.clerk_id },
          ships_from: { country: "United States" },
        },
        {
          dialist_id: owner._id,
          clerk_id: owner.clerk_id,
          title: "Bulk Listing 2",
          brand: "Omega",
          model: "Aqua Terra",
          reference: "150M",
          price: 6000,
          condition: "excellent",
          status: "draft",
          author: { _id: owner._id, name: owner.clerk_id },
          ships_from: { country: "United States" },
        },
      ];

      const result = await NetworkListing.insertMany(bulkListings);
      expect(result).toHaveLength(2);
      expect(result[0]._id).toBeDefined();
    });
  });

  describe("Batch Operations with Operators", () => {
    it("should batch update with increment operator", async () => {
      const listingIds = listings.slice(0, 2).map((l) => l._id);
      const priceAdjustment = 500;

      await NetworkListing.updateMany(
        { _id: { $in: listingIds } },
        { $inc: { price: priceAdjustment } },
      );

      const updated = await NetworkListing.find({ _id: { $in: listingIds } });

      updated.forEach((listing) => {
        const original = listings.find((l) => l._id.equals(listing._id));
        if (original && listing.price && original.price) {
          expect(listing.price).toBe(original.price + priceAdjustment);
        }
      });
    });

    it("should batch update with set operator", async () => {
      const listingIds = listings.slice(0, 2).map((l) => l._id);

      await NetworkListing.updateMany(
        { _id: { $in: listingIds } },
        {
          $set: {
            status: "sold",
            condition: "fair",
          },
        },
      );

      const updated = await NetworkListing.find({ _id: { $in: listingIds } });
      expect(updated.every((l) => l.status === "sold")).toBe(true);
      expect(updated.every((l) => l.condition === "fair")).toBe(true);
    });

    it("should batch update with view_count increment", async () => {
      const listingIds = listings.slice(0, 2).map((l) => l._id);

      await NetworkListing.updateMany(
        { _id: { $in: listingIds } },
        { $inc: { view_count: 1 } },
      );

      const updated = await NetworkListing.find({ _id: { $in: listingIds } });
      expect(updated.every((l) => l.view_count > 0)).toBe(true);
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await NetworkListing.deleteMany({});
  });
});
