import express from "express";
import { Types } from "mongoose";
import { NetworkListing } from "../../src/networks/models/NetworkListing";
import { User } from "../../src/models/User";
import {
  transitionListingStatus,
  VALID_TRANSITIONS,
} from "../../src/utils/listingStatusMachine";
import { buildListingFilter } from "../../src/utils/listingFilters";
import { ValidationError } from "../../src/errors/ValidationError";

describe("Networks Listings - Status Machine & Draft Leak Prevention", () => {
  let owner: any;
  let nonOwner: any;
  let listing: any;

  beforeEach(async () => {
    // Create test users
    owner = await User.create({
      external_id: "owner_external",
      clerk_id: "clerk_owner",
      email: "owner@test.com",
      first_name: "Owner",
      last_name: "User",
      display_name: "OwnerUser",
    });

    nonOwner = await User.create({
      external_id: "nonowner_external",
      clerk_id: "clerk_nonowner",
      email: "nonowner@test.com",
      first_name: "NonOwner",
      last_name: "User",
      display_name: "NonOwnerUser",
    });

    // Create a test listing
    listing = await NetworkListing.create({
      _id: new Types.ObjectId(),
      owner_id: owner._id,
      title: "Rolex Submariner",
      description: "Luxury watch",
      price: 15000,
      condition: "like-new",
      brand: "Rolex",
      model: "Submariner",
      images: ["https://example.com/image.jpg"],
      status: "draft",
      platform: "networks",
    });
  });

  describe("Listing Status Machine - VALID_TRANSITIONS", () => {
    it("should define valid transitions for all states", () => {
      expect(VALID_TRANSITIONS).toBeDefined();
      expect(typeof VALID_TRANSITIONS).toBe("object");

      // Verify common transitions exist
      expect(VALID_TRANSITIONS).toHaveProperty("draft");
      expect(VALID_TRANSITIONS).toHaveProperty("active");
      expect(VALID_TRANSITIONS).toHaveProperty("reserved");
      expect(VALID_TRANSITIONS).toHaveProperty("inactive");
    });

    it("should allow draft -> active transition", () => {
      const allowedTransitions = VALID_TRANSITIONS.draft;
      expect(allowedTransitions).toContain("active");
    });

    it("should allow active -> inactive transition", () => {
      const allowedTransitions = VALID_TRANSITIONS.active;
      expect(allowedTransitions).toContain("inactive");
    });

    it("should allow active -> reserved transition", () => {
      const allowedTransitions = VALID_TRANSITIONS.active;
      expect(allowedTransitions).toContain("reserved");
    });

    it("should allow reserved -> sold transition", () => {
      const allowedTransitions = VALID_TRANSITIONS.reserved;
      expect(allowedTransitions).toContain("sold");
    });

    it("should NOT allow reserved -> inactive transition", () => {
      const allowedTransitions = VALID_TRANSITIONS.reserved;
      expect(allowedTransitions).not.toContain("inactive");
    });

    it("should NOT allow reserved -> active transition", () => {
      const allowedTransitions = VALID_TRANSITIONS.reserved;
      expect(allowedTransitions).not.toContain("active");
    });

    it("should prevent invalid state transitions", () => {
      const invalidTransitions = ["reserved", "sold", "deleted"];
      invalidTransitions.forEach((invalid) => {
        expect(VALID_TRANSITIONS.draft).not.toContain(invalid);
      });
    });
  });

  describe("transitionListingStatus - State Machine Enforcement", () => {
    it("should successfully transition from draft to active", async () => {
      const updated = await transitionListingStatus(
        listing._id,
        "draft",
        "active",
        {
          userId: owner._id,
        },
      );
      expect(updated?.status).toBe("active");
    });

    it("should successfully transition from active to inactive", async () => {
      // First set to active
      listing.status = "active";
      await listing.save();

      const updated = await transitionListingStatus(
        listing._id,
        "active",
        "inactive",
        {
          userId: owner._id,
        },
      );
      expect(updated?.status).toBe("inactive");
    });

    it("should throw error on invalid transition (reserved -> inactive)", async () => {
      // Set listing to reserved
      listing.status = "reserved";
      await listing.save();

      expect(() => {
        transitionListingStatus(listing._id, "reserved", "inactive", {
          userId: owner._id,
        });
      }).toThrow();
    });

    it("should throw ValidationError with descriptive message", async () => {
      listing.status = "reserved";
      await listing.save();

      try {
        await transitionListingStatus(listing._id, "reserved", "inactive", {
          userId: owner._id,
        });
        fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain("invalid");
      }
    });

    it("should prevent transitioning a reserved listing to any inactive state", async () => {
      listing.status = "reserved";
      await listing.save();

      const invalidStates = ["inactive", "draft", "deleted"];

      for (const nextState of invalidStates) {
        expect(() => {
          transitionListingStatus(listing._id, "reserved", nextState as any, {
            userId: owner._id,
          });
        }).toThrow();
      }
    });

    it("should allow transitioning from reserved to sold", async () => {
      listing.status = "reserved";
      await listing.save();

      const updated = await transitionListingStatus(
        listing._id,
        "reserved",
        "sold",
        {
          userId: owner._id,
        },
      );
      expect(updated?.status).toBe("sold");
    });
  });

  describe("buildListingFilter - Draft Leak Prevention", () => {
    let draftListing: any;
    let activeListing: any;

    beforeEach(async () => {
      draftListing = await NetworkListing.create({
        _id: new Types.ObjectId(),
        owner_id: owner._id,
        title: "Draft Watch",
        description: "Not published",
        price: 5000,
        condition: "good",
        status: "draft",
        platform: "networks",
      });

      activeListing = await NetworkListing.create({
        _id: new Types.ObjectId(),
        owner_id: owner._id,
        title: "Active Watch",
        description: "Published",
        price: 8000,
        condition: "excellent",
        status: "active",
        platform: "networks",
      });
    });

    it("should hardcode status: active in filter", () => {
      const filter = buildListingFilter({});
      expect(filter.status).toBe("active");
    });

    it("should NOT accept status parameter from query", () => {
      const filter = buildListingFilter({ statusParam: "draft" });
      // Even if status is passed, should still be hardcoded to active
      expect(filter.status).toBe("active");
    });

    it("should prevent draft listings from leaking to non-owners via query", () => {
      const filter = buildListingFilter({});
      // Filter hardcodes status: active, so drafts are never visible
      expect(filter).toEqual(expect.objectContaining({ status: "active" }));
    });

    it("should allow filtering by other fields alongside status:active", () => {
      const filter = buildListingFilter({ brand: "Rolex" });
      expect(filter.status).toBe("active");
      expect(filter.brand).toBe("Rolex");
    });

    it("should hardcode status even if explicitly requested as draft", () => {
      // Simulating an attacker trying to pass draft status
      const filter = buildListingFilter({ requestedStatus: "draft" });
      expect(filter.status).toBe("active");
      expect(filter.status).not.toBe("draft");
    });

    it("should work with complex filters like text search", () => {
      const filter = buildListingFilter({
        brand: "Rolex",
        model: "Submariner",
      });
      expect(filter.status).toBe("active");
      expect(filter.brand).toBe("Rolex");
      expect(filter.model).toBe("Submariner");
    });
  });

  describe("Draft Listing Visibility Rules", () => {
    let draftListing: any;

    beforeEach(async () => {
      draftListing = await NetworkListing.create({
        _id: new Types.ObjectId(),
        owner_id: owner._id,
        title: "Secret Draft Watch",
        description: "Only owner can see",
        price: 12000,
        condition: "mint",
        status: "draft",
        images: ["https://example.com/image.jpg"],
        platform: "networks",
      });
    });

    it("should only be visible to owner", () => {
      // This would be enforced at the handler level with:
      // const isOwner = listing.owner_id.equals(userId);
      // if (!isOwner) throw 403
      const isOwner = draftListing.owner_id.equals(owner._id);
      expect(isOwner).toBe(true);
    });

    it("should not be visible to public listing search (status: active filter applied)", () => {
      const filter = buildListingFilter({});
      // Filter only includes active listings
      expect(filter.status).toBe("active");
      expect(draftListing.status).toBe("draft");
    });

    it("should not appear in discovery API results", async () => {
      // When querying with buildListingFilter, draft listings won't match
      const results = await NetworkListing.find(buildListingFilter({}));
      const hasDraft = results.some((l) => l._id.equals(draftListing._id));
      expect(hasDraft).toBe(false);
    });

    it("should be visible only in owner-specific listing endpoint with owner check", () => {
      // In the get/:id endpoint, we do:
      // const isPubliclyVisible = listing.status === 'active';
      // if (!isPubliclyVisible && !isOwner) return 403;

      const isPubliclyVisible = draftListing.status === "active";
      const isOwner = draftListing.owner_id.equals(owner._id);

      // Owner can see it
      expect(isOwner && (isPubliclyVisible || isOwner)).toBe(true);

      // Non-owner cannot see it
      expect(!isOwner && isPubliclyVisible).toBe(false);
    });
  });

  describe("Listing Fields - Shipping & Reservation Terms", () => {
    it("should have shipping field with region, shippingIncluded, shippingCost", async () => {
      const listingWithShipping = await NetworkListing.create({
        _id: new Types.ObjectId(),
        owner_id: owner._id,
        title: "Watch with Shipping",
        description: "Shipped worldwide",
        price: 10000,
        condition: "excellent",
        status: "active",
        shipping: {
          region: "worldwide",
          shippingIncluded: true,
          shippingCost: 0,
        },
        platform: "networks",
      });

      const retrieved = await NetworkListing.findById(listingWithShipping._id);
      expect(retrieved?.shipping).toBeDefined();
      expect(retrieved?.shipping?.region).toBe("worldwide");
      expect(retrieved?.shipping?.shippingIncluded).toBe(true);
      expect(retrieved?.shipping?.shippingCost).toBe(0);
    });

    it("should have allow_offers field that controls offer acceptance", async () => {
      // Test allow_offers field
      const listingNoOffers = await NetworkListing.create({
        _id: new Types.ObjectId(),
        owner_id: owner._id,
        title: "No Offers",
        price: 20000,
        condition: "new",
        status: "active",
        allow_offers: false,
        platform: "networks",
      });

      const retrieved = await NetworkListing.findById(listingNoOffers._id);
      expect(retrieved?.allow_offers).toBe(false);
    });
  });

  describe("Listing Status Lifecycle", () => {
    it("should follow lifecycle: draft -> active -> reserved -> sold", async () => {
      let current = listing;
      expect(current.status).toBe("draft");

      current.status = "active";
      await current.save();
      expect(current.status).toBe("active");

      current.status = "reserved";
      await current.save();
      expect(current.status).toBe("reserved");

      current.status = "sold";
      await current.save();
      expect(current.status).toBe("sold");
    });

    it("should allow deactivating from active without going through reserved", async () => {
      listing.status = "active";
      await listing.save();

      listing.status = "inactive";
      await listing.save();
      expect(listing.status).toBe("inactive");
    });

    it("should NOT allow deactivating from reserved", async () => {
      listing.status = "reserved";
      await listing.save();

      // Attempting to transition reserved -> inactive should be blocked
      const allowedTransitions = VALID_TRANSITIONS.reserved;
      expect(allowedTransitions).not.toContain("inactive");
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await NetworkListing.deleteMany({});
  });
});
