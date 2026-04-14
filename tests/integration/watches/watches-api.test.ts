import request from "supertest";
import { app } from "../../../src/app";
import { Watch } from "../../../src/models/Watches";

/**
 * Comprehensive Watch API Tests
 * Tests for:
 * - Response validation
 * - Schema consistency
 * - Search and filters
 * - Platform-specific features
 * - Caching behavior
 */

describe("Watches API Integration Tests", () => {
  beforeAll(async () => {
    // Seed test data
    await Watch.deleteMany({});
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
  });

  describe("Public Watches Endpoint - GET /api/v1/watches", () => {
    beforeEach(async () => {
      await Watch.deleteMany({});
      // Create test watches
      await Watch.create([
        {
          brand: "Rolex",
          model: "Datejust",
          reference: "126200",
          diameter: "36",
          bezel: "Fluted",
          bracelet: "Oyster",
          materials: "Stainless Steel",
          color: "White",
          category: "Luxury",
          images: {
            watch: "img1",
            dial: "dial1",
          },
        },
        {
          brand: "Omega",
          model: "Seamaster",
          reference: "210.30.42.20.01.001",
          diameter: "42",
          bezel: "Uni-directional",
          bracelet: "Mesh",
          materials: "Stainless Steel",
          color: "Blue",
          category: "Sport",
          images: {
            watch: "img2",
            dial: "dial2",
          },
        },
        {
          brand: "Seiko",
          model: "Prospex",
          reference: "SPB143",
          diameter: "42.8",
          bezel: "Rotating",
          bracelet: "Metal",
          materials: "Stainless Steel",
          color: "Black",
          category: "Dive",
          images: {
            watch: "img3",
            dial: "dial3",
          },
        },
      ]);
    });

    describe("Response Format Validation", () => {
      it("should return proper response structure", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ limit: 10 });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("data");
        expect(response.body).toHaveProperty("requestId");
        expect(response.body).toHaveProperty("_metadata");
      });

      it("should validate data array returns watch objects", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ limit: 10 });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);

        // Validate watch object structure
        const watch = response.body.data[0];
        expect(watch).toHaveProperty("_id");
        expect(watch).toHaveProperty("brand");
        expect(watch).toHaveProperty("model");
        expect(watch).toHaveProperty("reference");
        expect(watch).toHaveProperty("diameter");
        expect(watch).toHaveProperty("bezel");
        expect(watch).toHaveProperty("bracelet");
        expect(watch).toHaveProperty("materials");
        expect(watch).toHaveProperty("color");
        expect(watch).toHaveProperty("category");
        expect(watch).toHaveProperty("images");
      });

      it("should return metadata with pagination info", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ limit: 2, offset: 0 });

        expect(response.status).toBe(200);
        const metadata = response.body._metadata;

        expect(metadata).toHaveProperty("q");
        expect(metadata).toHaveProperty("count");
        expect(metadata).toHaveProperty("total");
        expect(metadata).toHaveProperty("pagination");
        expect(metadata.pagination).toHaveProperty("limit");
        expect(metadata.pagination).toHaveProperty("offset");
        expect(metadata.pagination).toHaveProperty("hasMore");

        // Validate pagination values
        expect(metadata.pagination.limit).toBe(2);
        expect(metadata.pagination.offset).toBe(0);
        expect(metadata.count).toBeLessThanOrEqual(metadata.pagination.limit);
        expect(metadata.total).toBeGreaterThanOrEqual(metadata.count);
      });

      it("should include cache metadata on responses", async () => {
        // First request - cache miss
        const firstResponse = await request(app)
          .get("/api/v1/watches")
          .query({ limit: 5 });

        expect(firstResponse.status).toBe(200);
        const firstMetadata = firstResponse.body._metadata;
        expect(firstMetadata).toHaveProperty("platform");
        expect(firstMetadata.platform).toBe("public");

        // Second request - cache hit
        const secondResponse = await request(app)
          .get("/api/v1/watches")
          .query({ limit: 5 });

        expect(secondResponse.status).toBe(200);
        const secondMetadata = secondResponse.body._metadata;
        expect(secondMetadata.cached).toBe(true);
        expect(secondMetadata).toHaveProperty("cacheAge");
        expect(secondMetadata).toHaveProperty("hitCount");
        expect(secondMetadata.cacheAge).toBeGreaterThanOrEqual(0);
        expect(secondMetadata.hitCount).toBeGreaterThanOrEqual(0);
      });
    });

    describe("Search Functionality", () => {
      it("should search by brand", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ q: "Rolex" });

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0].brand).toBe("Rolex");
      });

      it("should search by model", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ q: "Datejust" });

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0].model).toBe("Datejust");
      });

      it("should handle empty search", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ q: "" });

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);
      });

      it("should return empty results for non-matching search", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ q: "NonExistentBrand123" });

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBe(0);
        expect(response.body._metadata.total).toBe(0);
      });
    });

    describe("Filter Functionality", () => {
      it("should filter by category", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ category: "Luxury" });

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);
        response.body.data.forEach((watch: any) => {
          expect(watch.category).toBe("Luxury");
        });
      });

      it("should filter by category and validate metadata filters", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ category: "Sport" });

        expect(response.status).toBe(200);
        expect(response.body._metadata).toHaveProperty("q");
        response.body.data.forEach((watch: any) => {
          expect(watch.category).toBe("Sport");
        });
      });

      it("should handle pagination correctly", async () => {
        const page1 = await request(app)
          .get("/api/v1/watches")
          .query({ limit: 2, offset: 0 });

        expect(page1.status).toBe(200);
        expect(page1.body.data.length).toBeLessThanOrEqual(2);
        expect(page1.body._metadata.pagination.offset).toBe(0);
        expect(page1.body._metadata.pagination.limit).toBe(2);

        const page2 = await request(app)
          .get("/api/v1/watches")
          .query({ limit: 2, offset: 2 });

        expect(page2.status).toBe(200);
        if (page1.body._metadata.total > 2) {
          // Should have different data if more items exist
          const id1 = page1.body.data[0]?._id;
          const id2 = page2.body.data[0]?._id;
          expect(id1).not.toBe(id2);
        }
      });

      it("should validate limit constraints", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ limit: 100 }); // Should be capped at 50

        expect(response.status).toBe(200);
        expect(response.body._metadata.pagination.limit).toBeLessThanOrEqual(
          50,
        );
      });
    });

    describe("Sorting Functionality", () => {
      it("should sort by recent (default)", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ sort: "recent" });

        expect(response.status).toBe(200);
        // Most recent should be last in database order
        if (response.body.data.length > 1) {
          const first = new Date(response.body.data[0].createdAt || 0);
          const second = new Date(response.body.data[1].createdAt || 0);
          expect(first.getTime()).toBeGreaterThanOrEqual(second.getTime());
        }
      });

      it("should handle invalid sort parameter gracefully", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ sort: "invalid_sort" });

        // Should default to recent sorting
        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);
      });
    });

    describe("Schema Validation", () => {
      it("should validate required fields in watch objects", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ limit: 1 });

        expect(response.status).toBe(200);
        const watch = response.body.data[0];

        // Required fields
        expect(watch._id).toBeDefined();
        expect(watch.brand).toBeDefined();
        expect(watch.model).toBeDefined();
        expect(watch.diameter).toBeDefined();
        expect(typeof watch.brand).toBe("string");
        expect(typeof watch.model).toBe("string");
      });

      it("should have proper type for images field", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ limit: 1 });

        expect(response.status).toBe(200);
        const watch = response.body.data[0];
        expect(typeof watch.images).toBe("object");
        expect(watch.images).not.toBeNull();
      });

      it("should validate category enum values", async () => {
        const validCategories = [
          "Luxury",
          "Sport",
          "Dress",
          "Vintage",
          "Casual",
          "Dive",
          "Pilot",
          "Uncategorized",
        ];

        const response = await request(app)
          .get("/api/v1/watches")
          .query({ limit: 50 });

        expect(response.status).toBe(200);
        response.body.data.forEach((watch: any) => {
          expect(validCategories).toContain(watch.category);
        });
      });
    });

    describe("Error Handling", () => {
      it("should handle invalid query parameters gracefully", async () => {
        const response = await request(app)
          .get("/api/v1/watches")
          .query({ limit: "notanumber" });

        // Should either parse it or use default
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("data");
      });

      it("should return valid response for server errors", async () => {
        const response = await request(app).get("/api/v1/watches");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("requestId");
      });
    });
  });

  describe("Networks Watches Endpoint - GET /api/v1/networks/watches", () => {
    beforeEach(async () => {
      await Watch.deleteMany({});
      // Create test watches
      await Watch.create([
        {
          brand: "Rolex",
          model: "Datejust",
          reference: "126200",
          diameter: "36",
          bezel: "Fluted",
          bracelet: "Oyster",
          materials: "Stainless Steel",
          color: "White",
          category: "Luxury",
          condition: "excellent",
          images: { watch: "img1", dial: "dial1" },
        },
        {
          brand: "Omega",
          model: "Seamaster",
          reference: "210.30.42.20.01.001",
          diameter: "42",
          bezel: "Uni-directional",
          bracelet: "Mesh",
          materials: "Stainless Steel",
          color: "Blue",
          category: "Sport",
          condition: "very_good",
          images: { watch: "img2", dial: "dial2" },
        },
      ]);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .get("/api/v1/networks/watches")
        .query({ limit: 5 });

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty("message");
      expect(response.body.error.message).toBe("Unauthorized");
    });

    it("should return proper response structure when authenticated", async () => {
      const response = await request(app)
        .get("/api/v1/networks/watches")
        .set("x-test-user", "test-user")
        .query({ limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("_metadata");
      const metadata = response.body._metadata;
      expect(metadata.platform).toBe("networks");
    });

    it("should include engagement metrics in response", async () => {
      const response = await request(app)
        .get("/api/v1/networks/watches")
        .set("x-test-user", "test-user")
        .query({ limit: 5 });

      expect(response.status).toBe(200);
      if (response.body.data.length > 0) {
        const watch = response.body.data[0];
        // Metrics may be undefined if no listings
        if (watch.usageCount !== undefined) {
          expect(typeof watch.usageCount).toBe("number");
        }
        if (watch.trustedSellersCount !== undefined) {
          expect(typeof watch.trustedSellersCount).toBe("number");
        }
        if (watch.watchersCount !== undefined) {
          expect(typeof watch.watchersCount).toBe("number");
        }
      }
    });

    it("should support condition filtering", async () => {
      const response = await request(app)
        .get("/api/v1/networks/watches")
        .set("x-test-user", "test-user")
        .query({ condition: "excellent" });

      expect(response.status).toBe(200);
      response.body.data.forEach((watch: any) => {
        expect(watch.condition).toBe("excellent");
      });
    });

    it("should support sorting by trending", async () => {
      const response = await request(app)
        .get("/api/v1/networks/watches")
        .set("x-test-user", "test-user")
        .query({ sort: "trending" });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it("should validate networks-specific sort options", async () => {
      const validSorts = ["recent", "trending", "popular", "most_trusted"];

      for (const sort of validSorts) {
        const response = await request(app)
          .get("/api/v1/networks/watches")
          .set("x-test-user", "test-user")
          .query({ sort });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it("should include platform identifier in metadata", async () => {
      const response = await request(app)
        .get("/api/v1/networks/watches")
        .set("x-test-user", "test-user")
        .query({ limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body._metadata.platform).toBe("networks");
    });

    it("should include cache metadata", async () => {
      // First request
      const first = await request(app)
        .get("/api/v1/networks/watches")
        .set("x-test-user", "test-user")
        .query({ limit: 5 });

      expect(first.status).toBe(200);

      // Second request - should be cached
      const second = await request(app)
        .get("/api/v1/networks/watches")
        .set("x-test-user", "test-user")
        .query({ limit: 5 });

      expect(second.status).toBe(200);
      expect(second.body._metadata.cached).toBe(true);
      expect(second.body._metadata.cacheAge).toBeDefined();
    });
  });

  describe("Marketplace Watches Endpoint - GET /api/v1/marketplace/watches", () => {
    beforeEach(async () => {
      await Watch.deleteMany({});
      // Create test watches
      await Watch.create([
        {
          brand: "Rolex",
          model: "Datejust",
          reference: "126200",
          diameter: "36",
          bezel: "Fluted",
          bracelet: "Oyster",
          materials: "Stainless Steel",
          color: "White",
          category: "Luxury",
          condition: "excellent",
          images: { watch: "img1", dial: "dial1" },
        },
        {
          brand: "Omega",
          model: "Seamaster",
          reference: "210.30.42.20.01.001",
          diameter: "42",
          bezel: "Uni-directional",
          bracelet: "Mesh",
          materials: "Stainless Steel",
          color: "Blue",
          category: "Sport",
          condition: "very_good",
          images: { watch: "img2", dial: "dial2" },
        },
        {
          brand: "Seiko",
          model: "Prospex",
          reference: "SPB143",
          diameter: "42.8",
          bezel: "Rotating",
          bracelet: "Metal",
          materials: "Stainless Steel",
          color: "Black",
          category: "Dive",
          condition: "good",
          images: { watch: "img3", dial: "dial3" },
        },
      ]);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .get("/api/v1/marketplace/watches")
        .query({ limit: 5 });

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty("message");
    });

    it("should return proper response structure when authenticated", async () => {
      const response = await request(app)
        .get("/api/v1/marketplace/watches")
        .set("x-test-user", "merchant-user")
        .query({ limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("_metadata");
      const metadata = response.body._metadata;
      expect(metadata.platform).toBe("marketplace");
    });

    it("should include pricing metrics in response", async () => {
      const response = await request(app)
        .get("/api/v1/marketplace/watches")
        .set("x-test-user", "merchant-user")
        .query({ limit: 5 });

      expect(response.status).toBe(200);
      if (response.body.data.length > 0) {
        const watch = response.body.data[0];
        // Metrics may be undefined/null if no listings
        if (watch.priceRange !== null && watch.priceRange !== undefined) {
          expect(typeof watch.priceRange).toBe("object");
        }
        if (watch.inventoryLevel !== undefined) {
          expect(typeof watch.inventoryLevel).toBe("number");
        }
      }
    });

    it("should support price range filtering", async () => {
      const response = await request(app)
        .get("/api/v1/marketplace/watches")
        .set("x-test-user", "merchant-user")
        .query({ min_price: 1000, max_price: 50000 });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should support condition filtering", async () => {
      const response = await request(app)
        .get("/api/v1/marketplace/watches")
        .set("x-test-user", "merchant-user")
        .query({ condition: "excellent" });

      expect(response.status).toBe(200);
      response.body.data.forEach((watch: any) => {
        expect(watch.condition).toBe("excellent");
      });
    });

    it("should validate marketplace-specific sort options", async () => {
      const validSorts = [
        "recent",
        "price_low_to_high",
        "price_high_to_low",
        "most_available",
        "highest_rated",
      ];

      for (const sort of validSorts) {
        const response = await request(app)
          .get("/api/v1/marketplace/watches")
          .set("x-test-user", "merchant-user")
          .query({ sort });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it("should include platform identifier in metadata", async () => {
      const response = await request(app)
        .get("/api/v1/marketplace/watches")
        .set("x-test-user", "merchant-user")
        .query({ limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body._metadata.platform).toBe("marketplace");
    });

    it("should include price filter in metadata", async () => {
      const response = await request(app)
        .get("/api/v1/marketplace/watches")
        .set("x-test-user", "merchant-user")
        .query({ min_price: 1000, max_price: 50000 });

      expect(response.status).toBe(200);
      expect(response.body._metadata.filters).toHaveProperty("price");
      expect(response.body._metadata.filters.price).toEqual({
        min: 1000,
        max: 50000,
      });
    });

    it("should include cache metadata", async () => {
      // First request
      const first = await request(app)
        .get("/api/v1/marketplace/watches")
        .set("x-test-user", "merchant-user")
        .query({ limit: 5 });

      expect(first.status).toBe(200);

      // Second request - should be cached
      const second = await request(app)
        .get("/api/v1/marketplace/watches")
        .set("x-test-user", "merchant-user")
        .query({ limit: 5 });

      expect(second.status).toBe(200);
      expect(second.body._metadata.cached).toBe(true);
      expect(second.body._metadata.cacheAge).toBeDefined();
    });
  });

  describe("Cross-Platform Consistency Tests", () => {
    beforeEach(async () => {
      await Watch.deleteMany({});
      // Create identical test data across platforms
      await Watch.create([
        {
          brand: "Rolex",
          model: "Datejust",
          reference: "126200",
          diameter: "36",
          bezel: "Fluted",
          bracelet: "Oyster",
          materials: "Stainless Steel",
          color: "White",
          category: "Luxury",
          condition: "excellent",
          images: { watch: "img1", dial: "dial1" },
        },
        {
          brand: "Omega",
          model: "Seamaster",
          reference: "210.30.42.20.01.001",
          diameter: "42",
          bezel: "Uni-directional",
          bracelet: "Mesh",
          materials: "Stainless Steel",
          color: "Blue",
          category: "Sport",
          condition: "very_good",
          images: { watch: "img2", dial: "dial2" },
        },
      ]);
    });

    it("should return consistent watch data across all platforms", async () => {
      const publicRes = await request(app)
        .get("/api/v1/watches")
        .query({ limit: 10 });

      const networksRes = await request(app)
        .get("/api/v1/networks/watches")
        .set("x-test-user", "test-user")
        .query({ limit: 10 });

      const marketplaceRes = await request(app)
        .get("/api/v1/marketplace/watches")
        .set("x-test-user", "merchant-user")
        .query({ limit: 10 });

      // All should return same watch data
      expect(publicRes.body.data.length).toBe(networksRes.body.data.length);
      expect(publicRes.body.data.length).toBe(marketplaceRes.body.data.length);

      // Core watch properties should be identical
      const publicWatch = publicRes.body.data[0];
      const networksWatch = networksRes.body.data[0];
      const marketplaceWatch = marketplaceRes.body.data[0];

      expect(publicWatch._id).toBe(networksWatch._id);
      expect(publicWatch._id).toBe(marketplaceWatch._id);
      expect(publicWatch.brand).toBe(networksWatch.brand);
      expect(publicWatch.brand).toBe(marketplaceWatch.brand);
      expect(publicWatch.model).toBe(networksWatch.model);
      expect(publicWatch.model).toBe(marketplaceWatch.model);
    });

    it("should differentiate platform metadata", async () => {
      const publicRes = await request(app)
        .get("/api/v1/watches")
        .query({ limit: 10 });

      const networksRes = await request(app)
        .get("/api/v1/networks/watches")
        .set("x-test-user", "test-user")
        .query({ limit: 10 });

      const marketplaceRes = await request(app)
        .get("/api/v1/marketplace/watches")
        .set("x-test-user", "merchant-user")
        .query({ limit: 10 });

      // Platform identifiers should differ
      expect(publicRes.body._metadata.platform).toBe("public");
      expect(networksRes.body._metadata.platform).toBe("networks");
      expect(marketplaceRes.body._metadata.platform).toBe("marketplace");
    });

    it("should support same category filter across all platforms", async () => {
      const publicRes = await request(app)
        .get("/api/v1/watches")
        .query({ category: "Luxury" });

      const networksRes = await request(app)
        .get("/api/v1/networks/watches")
        .set("x-test-user", "test-user")
        .query({ category: "Luxury" });

      const marketplaceRes = await request(app)
        .get("/api/v1/marketplace/watches")
        .set("x-test-user", "merchant-user")
        .query({ category: "Luxury" });

      // All should return consistent data for same filter
      expect(publicRes.body.data.length).toBe(networksRes.body.data.length);
      expect(publicRes.body.data.length).toBe(marketplaceRes.body.data.length);

      publicRes.body.data.forEach((watch: any) => {
        expect(watch.category).toBe("Luxury");
      });
    });
  });

  describe("Caching Tests", () => {
    beforeEach(async () => {
      await Watch.deleteMany({});
      await Watch.create({
        brand: "Rolex",
        model: "Datejust",
        reference: "126200",
        diameter: "36",
        bezel: "Fluted",
        bracelet: "Oyster",
        materials: "Stainless Steel",
        color: "White",
        category: "Luxury",
        images: { watch: "img1", dial: "dial1" },
      });
    });

    it("should cache public endpoint results", async () => {
      // First request
      const first = await request(app)
        .get("/api/v1/watches")
        .query({ q: "Rolex", limit: 5 });

      expect(first.status).toBe(200);

      // Second request should be cached
      const second = await request(app)
        .get("/api/v1/watches")
        .query({ q: "Rolex", limit: 5 });

      expect(second.status).toBe(200);
      expect(second.body._metadata.cached).toBe(true);
      expect(second.body._metadata.cacheAge).toBeGreaterThanOrEqual(0);
    });

    it("should create separate cache entries for different query parameters", async () => {
      // Request 1: limit 5
      const req1 = await request(app)
        .get("/api/v1/watches")
        .query({ limit: 5 });

      // Request 2: limit 10 (different cache key)
      const req2 = await request(app)
        .get("/api/v1/watches")
        .query({ limit: 10 });

      // Request 1 again
      const req3 = await request(app)
        .get("/api/v1/watches")
        .query({ limit: 5 });

      expect(req1.status).toBe(200);
      expect(req2.status).toBe(200);
      expect(req3.status).toBe(200);

      // Both should eventually be cached
      expect(req3.body._metadata.cached).toBe(true);
    });

    it("should validate cache age increases over time", async () => {
      await request(app).get("/api/v1/watches").query({ limit: 5 });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const cached = await request(app)
        .get("/api/v1/watches")
        .query({ limit: 5 });

      expect(cached.body._metadata.cached).toBe(true);
      expect(cached.body._metadata.cacheAge).toBeGreaterThan(0);
    });
  });
});
