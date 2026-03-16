import { Types } from "mongoose";
import { NetworkListing } from "../../src/networks/models/NetworkListing";
import { User } from "../../src/models/User";

describe("Batch 3 Part 1 - Networks Listing Fields & Features", () => {
  let owner: any;
  let listing: any;

  beforeEach(async () => {
    owner = await User.create({
      external_id: "listing_owner_ext",
      clerk_id: "clerk_owner",
      email: "owner@test.com",
      first_name: "Owner",
      last_name: "User",
      display_name: "owneruser",
    });

    listing = await NetworkListing.create({
      dialist_id: owner._id,
      clerk_id: owner.clerk_id,
      title: "Rolex Submariner",
      brand: "Rolex",
      model: "Submariner",
      reference: "126610LN",
      description: "Excellent condition watch",
      price: 15000,
      condition: "like-new",
      images: [
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg",
      ],
      status: "active",
      author: {
        _id: owner._id,
        name: owner.display_name,
      },
      ships_from: {
        country: "United States",
      },
    });
  });

  describe("NetworkListing Fields - Schema Validation", () => {
    it("should have dialist_id field", () => {
      expect(listing.dialist_id).toBeDefined();
      expect(listing.dialist_id).toEqual(owner._id);
    });

    it("should have clerk_id field", () => {
      expect(listing.clerk_id).toBeDefined();
      expect(listing.clerk_id).toBe(owner.clerk_id);
    });

    it("should have title field (required)", () => {
      expect(listing.title).toBeDefined();
      expect(listing.title).toBe("Rolex Submariner");
    });

    it("should have price field (number)", () => {
      expect(typeof listing.price).toBe("number");
      expect(listing.price).toBe(15000);
    });

    it("should have condition field", () => {
      expect(listing.condition).toBe("like-new");
    });

    it("should have brand and model fields", () => {
      expect(listing.brand).toBe("Rolex");
      expect(listing.model).toBe("Submariner");
    });

    it("should have reference field", () => {
      expect(listing.reference).toBe("126610LN");
    });

    it("should have images array", () => {
      expect(Array.isArray(listing.images)).toBe(true);
      expect(listing.images.length).toBeGreaterThan(0);
    });

    it("should have status field", () => {
      const validStatuses = ["draft", "active", "reserved", "sold", "inactive"];
      expect(validStatuses).toContain(listing.status);
    });

    it("should have allow_offers field (default true)", () => {
      expect(listing.allow_offers).toBe(true);
    });

    it("should have timestamp fields", () => {
      expect(listing.createdAt).toBeDefined();
      expect(listing.updatedAt).toBeDefined();
    });

    it("should have is_deleted field (soft delete)", () => {
      expect(listing).toHaveProperty("is_deleted");
      expect(listing.is_deleted).toBeFalsy();
    });

    it("should have offers_count and view_count", () => {
      expect(typeof listing.offers_count).toBe("number");
      expect(typeof listing.view_count).toBe("number");
    });
  });

  describe("Inventory Search & Sort", () => {
    let listing1: any;
    let listing2: any;
    let listing3: any;

    beforeEach(async () => {
      listing1 = await NetworkListing.create({
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Rolex GMT-Master",
        brand: "Rolex",
        model: "GMT-Master",
        reference: "126710",
        price: 25000,
        condition: "mint",
        status: "active",
        author: { _id: owner._id, name: owner.display_name },
        ships_from: { country: "United States" },
      });

      listing2 = await NetworkListing.create({
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Omega Speedmaster",
        brand: "Omega",
        model: "Speedmaster",
        reference: "311.30.42.30.01.005",
        price: 8000,
        condition: "excellent",
        status: "active",
        author: { _id: owner._id, name: owner.display_name },
        ships_from: { country: "United States" },
      });

      listing3 = await NetworkListing.create({
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "TAG Heuer Carrera",
        brand: "TAG Heuer",
        model: "Carrera",
        reference: "WAR211A",
        price: 12000,
        condition: "good",
        status: "draft",
        author: { _id: owner._id, name: owner.display_name },
        ships_from: { country: "United States" },
      });
    });

    it("should search by brand", async () => {
      const results = await NetworkListing.find({
        dialist_id: owner._id,
        brand: "Rolex",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((l) => l.brand === "Rolex")).toBe(true);
    });

    it("should search by title with regex", async () => {
      const results = await NetworkListing.find({
        dialist_id: owner._id,
        title: { $regex: "Omega", $options: "i" },
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it("should filter by status", async () => {
      const activeListings = await NetworkListing.find({
        dialist_id: owner._id,
        status: "active",
      });

      expect(activeListings.every((l) => l.status === "active")).toBe(true);
    });

    it("should filter by price range", async () => {
      const results = await NetworkListing.find({
        dialist_id: owner._id,
        price: { $gte: 10000, $lte: 20000 },
      });

      results.forEach((l) => {
        if (l.price !== undefined) {
          expect(l.price).toBeGreaterThanOrEqual(10000);
          expect(l.price).toBeLessThanOrEqual(20000);
        }
      });
    });

    it("should sort by price ascending", async () => {
      const results = await NetworkListing.find({
        dialist_id: owner._id,
      }).sort({ price: 1 });

      for (let i = 1; i < results.length; i++) {
        const prevPrice = results[i - 1].price ?? 0;
        const currPrice = results[i].price ?? 0;
        expect(currPrice).toBeGreaterThanOrEqual(prevPrice);
      }
    });

    it("should sort by price descending", async () => {
      const results = await NetworkListing.find({
        dialist_id: owner._id,
      }).sort({ price: -1 });

      for (let i = 1; i < results.length; i++) {
        const prevPrice = results[i - 1].price ?? Infinity;
        const currPrice = results[i].price ?? 0;
        expect(currPrice).toBeLessThanOrEqual(prevPrice);
      }
    });

    it("should combine multiple filters and sort", async () => {
      const results = await NetworkListing.find({
        dialist_id: owner._id,
        status: "active",
        brand: { $in: ["Rolex", "Omega"] },
      }).sort({ price: 1 });

      expect(results.every((l) => l.status === "active")).toBe(true);
      expect(results.every((l) => ["Rolex", "Omega"].includes(l.brand))).toBe(
        true,
      );
    });
  });

  describe("Image Management", () => {
    it("should store images array", async () => {
      expect(Array.isArray(listing.images)).toBe(true);
      expect(listing.images.length).toBeGreaterThan(0);
    });

    it("should accept multiple images", async () => {
      const newListing = await NetworkListing.create({
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Multi-image watch",
        brand: "Seiko",
        model: "SKX007",
        reference: "SKX007K2",
        price: 5000,
        condition: "excellent",
        images: Array.from(
          { length: 5 },
          (_, i) => `https://example.com/${i + 1}.jpg`,
        ),
        status: "draft",
        author: { _id: owner._id, name: owner.display_name },
        ships_from: { country: "United States" },
      });

      expect(newListing.images.length).toBe(5);
    });

    it("should validate image URLs", () => {
      const validUrls = listing.images.every(
        (url: string) => typeof url === "string" && url.length > 0,
      );
      expect(validUrls).toBe(true);
    });

    it("should support image reordering", async () => {
      if (listing.images.length >= 2) {
        const original = listing.images.slice();
        listing.images = [
          listing.images[1],
          listing.images[0],
          ...listing.images.slice(2),
        ];
        await listing.save();

        expect(listing.images[0]).toEqual(original[1]);
        expect(listing.images[1]).toEqual(original[0]);
      }
    });
  });

  describe("Listing Deletion - Soft Delete", () => {
    it("should support soft delete via is_deleted flag", async () => {
      expect(listing.is_deleted).toBeFalsy();

      listing.is_deleted = true;
      await listing.save();

      expect(listing.is_deleted).toBe(true);
    });

    it("should exclude deleted listings from active queries", async () => {
      listing.is_deleted = true;
      await listing.save();

      const activeListings = await NetworkListing.find({
        dialist_id: owner._id,
        is_deleted: { $ne: true },
      });

      const hasDeleted = activeListings.some((l) => l._id.equals(listing._id));
      expect(hasDeleted).toBe(false);
    });

    it("should be able to restore (undelete)", async () => {
      listing.is_deleted = true;
      await listing.save();

      listing.is_deleted = false;
      await listing.save();

      const restored = await NetworkListing.findById(listing._id);
      expect(restored?.is_deleted).toBe(false);
    });
  });

  describe("Search & Indexing", () => {
    beforeEach(async () => {
      await NetworkListing.create({
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Vintage Rolex Submariner",
        brand: "Rolex",
        model: "Submariner",
        reference: "VINTAGE-1960",
        description: "Vintage 1960s Submariner with original dial",
        status: "active",
        author: { _id: owner._id, name: owner.display_name },
        ships_from: { country: "United States" },
      });

      await NetworkListing.create({
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Omega Speedmaster Professional",
        brand: "Omega",
        model: "Speedmaster",
        reference: "MOON-WATCH",
        description: "The professional chronograph",
        status: "active",
        author: { _id: owner._id, name: owner.display_name },
        ships_from: { country: "United States" },
      });
    });

    it("should support search on brand (indexed)", async () => {
      const results = await NetworkListing.find({
        brand: "Rolex",
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it("should support search on reference (indexed)", async () => {
      const results = await NetworkListing.find({
        reference: "126610LN",
      });

      expect(results).toBeDefined();
    });

    it("should be case-insensitive in searches", async () => {
      const upperResults = await NetworkListing.find({
        brand: { $regex: "ROLEX", $options: "i" },
      });

      const lowerResults = await NetworkListing.find({
        brand: { $regex: "rolex", $options: "i" },
      });

      expect(upperResults.length).toBe(lowerResults.length);
    });
  });

  describe("Listing Optional Fields", () => {
    it("should support description field", async () => {
      const withDescription = await NetworkListing.create({
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Described Watch",
        brand: "Tissot",
        model: "PRX",
        reference: "T137.407.11.351.00",
        description: "Beautiful watch in great condition",
        price: 5000,
        status: "draft",
        author: { _id: owner._id, name: owner.display_name },
        ships_from: { country: "United States" },
      });

      expect(withDescription.description).toBe(
        "Beautiful watch in great condition",
      );
    });

    it("should support year field", async () => {
      const withYear = await NetworkListing.create({
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Dated Watch",
        brand: "Patek Philippe",
        model: "Nautilus",
        reference: "5711",
        year: 2023,
        status: "draft",
        author: { _id: owner._id, name: owner.display_name },
        ships_from: { country: "United States" },
      });

      expect(withYear.year).toBe(2023);
    });

    it("should support reservation_terms field", async () => {
      const withTerms = await NetworkListing.create({
        dialist_id: owner._id,
        clerk_id: owner.clerk_id,
        title: "Reserved Watch",
        brand: "Audemars Piguet",
        model: "Royal Oak",
        reference: "15400ST",
        reservation_terms: "One month reserve",
        status: "draft",
        author: { _id: owner._id, name: owner.display_name },
        ships_from: { country: "United States" },
      });

      expect(withTerms.reservation_terms).toBe("One month reserve");
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await NetworkListing.deleteMany({});
  });
});
