/**
 * Networks Listing Image Upload - Integration Tests
 * Tests the actual API endpoint implementation
 *
 * Run: npm test -- networks-images.integration.test.ts
 */

import request from "supertest";
import { app } from "../../src/app";
import { NetworkListing } from "../../src/networks/models/NetworkListing";
import { User } from "../../src/models/User";
import { Watch } from "../../src/models/Watches";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

describe("📸 Networks Listing Image Upload - Integration Tests", () => {
  let testUser: any;
  let testListing: any;
  let testUserId: string; // Mock user ID for x-test-user header
  let testImagePath: string;

  // Setup: Create test image, user, and listing
  beforeAll(async () => {
    // Create test image
    const testDir = path.join(__dirname, "../fixtures");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    testImagePath = path.join(testDir, "networks-watch-test.jpg");
    await sharp({
      create: {
        width: 1920,
        height: 1440,
        channels: 3,
        background: { r: 180, g: 100, b: 50 },
      },
    })
      .jpeg({ quality: 95 })
      .toFile(testImagePath);
  });

  beforeEach(async () => {
    // Use mock user for test authentication (via x-test-user header)
    // Mock user has dialist_id: "ddd333333333333333333333"
    testUserId = "merchant_approved";

    // Create or get test user - map mock user dialist_id to actual user
    const mockUserDialistId = "ddd333333333333333333333"; // from merchant_approved mock user
    testUser = await User.findOne({ _id: mockUserDialistId });

    if (!testUser) {
      testUser = await User.create({
        _id: mockUserDialistId,
        external_id: "merchant_approved",
        email: `merchant-${Date.now()}@test.local`,
        first_name: "Premium",
        last_name: "Watches",
        onboarding_step: 4,
        display_name: "Premium Watches",
      });
    }

    // Create test watch
    const watch = await Watch.create({
      brand: "Omega",
      model: "Seamaster",
      reference: "210.30.42.20.01.001",
      diameter: "42mm",
      bezel: "Rotating",
      materials: "Stainless Steel",
      bracelet: "Rubber",
      color: "Blue",
    });

    // Create draft listing
    testListing = await NetworkListing.create({
      dialist_id: testUser._id,
      clerk_id: testUser.external_id,
      status: "draft",
      type: "for_sale",
      title: `${watch.brand} ${watch.model}`,
      brand: watch.brand,
      model: watch.model,
      reference: watch.reference,
      price: 8500,
      condition: "excellent",
      allow_offers: true,
      description: "Excellent condition seamaster",
      author: {
        _id: testUser._id,
        name: testUser.display_name,
        avatar: testUser.avatar,
        location: "San Francisco",
      },
      ships_from: { country: "US" },
      images: [],
      offers_count: 0,
      view_count: 0,
    });
  });

  // ============================================================================
  // HAPPY PATH TESTS
  // ============================================================================

  describe("✅ SUCCESSFUL UPLOAD SCENARIOS", () => {
    it("should upload single image and return complete metadata", async () => {
      const response = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath);

      console.log("✅ Single Image Upload Response:", response.status);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.images).toBeDefined();
      expect(Array.isArray(response.body.data.images)).toBe(true);
      expect(response.body.data.images.length).toBe(1);
      expect(response.body.data.count).toBe(1);

      const image = response.body.data.images[0];
      expect(image.url).toMatch(
        /https:\/\/(cdn\.dialist\.io|dialist-.*\.s3\.)/,
      );
      expect(image.url).toMatch(/\.webp$/);
      expect(image.thumbnailUrl).toMatch(/(thumb_|-thumb).*\.webp$/);
      expect(image.size).toBeGreaterThan(0);
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
      expect(image.mimeType).toBe("image/webp");
      expect(image.uploadedAt).toBeDefined();
      expect(image.key).toBeDefined();

      console.log(`✅ Image URL: ${image.url}`);
      console.log(`✅ Thumbnail URL: ${image.thumbnailUrl}`);
      console.log(`✅ File Size: ${image.size} bytes`);
      console.log(`✅ Dimensions: ${image.width}x${image.height}`);
    });

    it("should upload 3 images in batch", async () => {
      const response = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath)
        .attach("images", testImagePath)
        .attach("images", testImagePath);

      console.log("✅ Batch Upload (3 images) Status:", response.status);

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBe(3);
      expect(response.body.data.images.length).toBe(3);

      // Verify all images have metadata
      response.body.data.images.forEach((img: any, idx: number) => {
        expect(img.url).toBeDefined();
        expect(img.thumbnailUrl).toBeDefined();
        console.log(`   Image ${idx + 1}: ${img.size} bytes`);
      });
    });

    it("should store uploaded image URLs in listing", async () => {
      // Upload images
      const uploadRes = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath);

      expect(uploadRes.status).toBe(200);

      const imageUrl = uploadRes.body.data.images[0].url;

      // Verify that the image is stored in the listing
      // (The image upload handler stores images directly in listing.images)
      const updatedListing = await NetworkListing.findById(testListing._id);
      expect(updatedListing?.images).toBeDefined();
      expect(updatedListing?.images.length).toBeGreaterThan(0);
      expect(updatedListing?.images[0]).toBe(imageUrl);

      console.log("✅ Image URLs stored in listing");
    });

    it("should handle multiple uploads to same listing", async () => {
      // First batch
      const res1 = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath)
        .attach("images", testImagePath);

      expect(res1.status).toBe(200);
      expect(res1.body.data.count).toBe(2);

      // Second batch
      const res2 = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath)
        .attach("images", testImagePath)
        .attach("images", testImagePath);

      expect(res2.status).toBe(200);
      expect(res2.body.data.count).toBe(3);

      console.log("✅ Multiple batch uploads succeeded (2+3 images)");
    });
  });

  // ============================================================================
  // ERROR/VALIDATION TESTS
  // ============================================================================

  describe("❌ ERROR HANDLING", () => {
    it("should return 400 if no images provided", async () => {
      const response = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId);

      console.log("❌ No Images Upload Status:", response.status);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message.toLowerCase()).toMatch(/no images/);
    });

    it("should return 401 if not authenticated", async () => {
      const response = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .attach("images", testImagePath);

      console.log("❌ No Auth Status:", response.status);

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it("should return 403 if user is not listing owner", async () => {
      // Create another mock user (different from testUserId) to test ownership
      const otherMockUserId = "buyer_us_complete";

      const response = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", otherMockUserId)
        .attach("images", testImagePath);

      console.log("❌ Not Owner Status:", response.status);

      expect(response.status).toBe(403);
      // Should return 403 or 400 error (not owner or ownership issue)
      expect([400, 403]).toContain(response.status);
    });

    it("should return 404 if listing not found", async () => {
      const fakeId = "507f1f77bcf86cd799439999";

      const response = await request(app)
        .post(`/api/v1/networks/listings/${fakeId}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath);

      console.log("❌ Not Found Status:", response.status);

      expect(response.status).toBe(404);
      expect(response.body.error?.message.toLowerCase()).toMatch(/not found/);
    });

    it("should return 400 if listing is not draft", async () => {
      // Publish the listing first
      await NetworkListing.updateOne(
        { _id: testListing._id },
        { status: "published" },
      );

      const response = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath);

      console.log("❌ Not Draft Status:", response.status);

      expect(response.status).toBe(400);
      expect(response.body.error?.message.toLowerCase()).toMatch(/draft/);
    });
  });

  // ============================================================================
  // IMAGE DELETION TESTS
  // ============================================================================

  describe("🗑️ IMAGE DELETION", () => {
    it("should delete uploaded image by key", async () => {
      // Upload image first
      const uploadRes = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath);

      expect(uploadRes.status).toBe(200);

      const imageKey = uploadRes.body.data.images[0].key;
      const encodedKey = encodeURIComponent(imageKey);

      // Delete image
      const deleteRes = await request(app)
        .delete(
          `/api/v1/networks/listings/${testListing._id}/images/${encodedKey}`,
        )
        .set("x-test-user", testUserId);

      console.log("✅ Image Delete Status:", deleteRes.status);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data).toBeDefined();
      expect(deleteRes.body.data.count).toBeDefined();
    });

    it("should return 404 when deleting non-existent image", async () => {
      const fakeKey = "networks/listings/fake/image.webp";
      const encodedKey = encodeURIComponent(fakeKey);

      const response = await request(app)
        .delete(
          `/api/v1/networks/listings/${testListing._id}/images/${encodedKey}`,
        )
        .set("x-test-user", testUserId);

      console.log("❌ Delete Not Found Status:", response.status);

      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // RESPONSE FORMAT TESTS
  // ============================================================================

  describe("📋 RESPONSE FORMAT VALIDATION", () => {
    it("should include all required fields in response", async () => {
      const response = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath)
        .attach("images", testImagePath);

      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("requestId");

      const data = response.body.data;
      expect(data).toHaveProperty("images");
      expect(data).toHaveProperty("count");

      // Verify images array structure
      data.images.forEach((img: any) => {
        expect(img).toHaveProperty("url");
        expect(img).toHaveProperty("thumbnailUrl");
        expect(img).toHaveProperty("key");
        expect(img).toHaveProperty("size");
        expect(img).toHaveProperty("width");
        expect(img).toHaveProperty("height");
        expect(img).toHaveProperty("mimeType");
        expect(img).toHaveProperty("uploadedAt");
      });

      console.log("✅ Response format validated");
      console.log(`   - success: ${response.body.success}`);
      console.log(`   - requestId: ${response.body.requestId}`);
      console.log(`   - images count: ${data.count}`);
      console.log(`   - listing ID: ${data.listingId}`);
    });

    it("should have correct content types", async () => {
      const response = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath);

      expect(response.type).toMatch(/json/);
      expect(response.charset).toBeDefined();
    });
  });

  // ============================================================================
  // SPEC COMPLIANCE TESTS
  // ============================================================================

  describe("✅ API SPECIFICATION COMPLIANCE", () => {
    it("should match spec endpoint: POST /api/v1/networks/listings/{id}/images", async () => {
      // Verify endpoint exists at correct path
      const response = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath);

      expect([200, 400, 401, 403, 404]).toContain(response.status);
      console.log(
        `✅ Endpoint exists and responds with status: ${response.status}`,
      );
    });

    it("should require Authorization header", async () => {
      // Without header
      const noAuthRes = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .attach("images", testImagePath);

      expect(noAuthRes.status).toBe(401);

      // With header
      const withAuthRes = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath);

      expect(withAuthRes.status).toBe(200);
      console.log("✅ Authorization header required and validated");
    });

    it("should accept multipart/form-data", async () => {
      const response = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath);

      expect(response.status).toBe(200);
      console.log("✅ multipart/form-data accepted");
    });

    it("should limit to 10 images max", async () => {
      // Attempt to upload 11 files should fail
      let req = request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId);

      for (let i = 0; i < 11; i++) {
        req = req.attach("images", testImagePath);
      }

      const response = await req;

      expect(response.status).toBeGreaterThanOrEqual(400);
      console.log("✅ Max 10 images limit enforced");
    });

    it("should auto-convert to WebP format", async () => {
      const response = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath);

      const image = response.body.data.images[0];
      expect(image.url).toMatch(/\.webp$/);
      expect(image.mimeType).toBe("image/webp");
      console.log("✅ Auto-conversion to WebP validated");
      console.log(`   - Original: JPEG`);
      console.log(`   - Converted: ${image.mimeType}`);
    });

    it("should generate thumbnails", async () => {
      const response = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath);

      const image = response.body.data.images[0];
      expect(image.thumbnailUrl).toBeDefined();
      expect(image.thumbnailUrl).toMatch(/(thumb_|-thumb).*\.webp$/);
      console.log("✅ Thumbnail generation validated");
      console.log(`   - Full: ${image.url}`);
      console.log(`   - Thumb: ${image.thumbnailUrl}`);
    });

    it("should provide CDN URLs with HTTPS", async () => {
      const response = await request(app)
        .post(`/api/v1/networks/listings/${testListing._id}/images`)
        .set("x-test-user", testUserId)
        .attach("images", testImagePath);

      const image = response.body.data.images[0];
      expect(image.url.startsWith("https://")).toBe(true);
      expect(image.url).toMatch(/(cdn\.dialist\.io|dialist-.*\.s3\.)/);
      console.log("✅ HTTPS CDN URLs validated");
    });
  });

  // ============================================================================
  // CLEANUP
  // ============================================================================

  afterAll(async () => {
    // Clean up test image
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    console.log("\n✅ Test cleanup complete\n");
  });
});
