import request from "supertest";
import { MarketplaceListing } from "../../src/models/Listings";
import { User } from "../../src/models/User";
import { Watch } from "../../src/models/Watches";

// Mock the image service BEFORE importing app
jest.mock("../../src/services/ImageService", () => ({
  imageService: {
    uploadImages: jest.fn(),
    deleteImage: jest.fn(),
    deleteImages: jest.fn(),
  },
  ImageContext: {
    LISTING: "listings",
    AVATAR: "avatars",
    CERTIFICATE: "certificates",
    DOCUMENT: "documents",
  },
  IMAGE_CONSTRAINTS: {
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    MAX_TOTAL_SIZE: 50 * 1024 * 1024,
    MIN_LISTING_IMAGES: 3,
    MAX_LISTING_IMAGES: 10,
  },
}));

// Import app and imageService AFTER mocks
import { app } from "../../src/app";
import { imageService } from "../../src/services/ImageService";

describe("Image Upload Endpoints", () => {
  let authToken: string;
  let userId: string;
  let listingId: string;

  beforeEach(async () => {
    // Create test user
    const user = await User.create({
      external_id: "merchant_approved", // Use valid mock user ID
      email: "test@example.com",
      first_name: "Test",
      last_name: "User",
      onboarding_step: 4,
    });
    userId = user.external_id!;

    // Mock auth token
    authToken = "mock-jwt-token";

    // Create test watch
    const watch = await Watch.create({
      brand: "Rolex",
      model: "Submariner",
      reference: "116610LN",
      diameter: "40mm",
      bezel: "Ceramic",
      materials: "Stainless Steel",
      bracelet: "Oyster",
      color: "Black",
    });

    // Create test listing
    const listing = await MarketplaceListing.create({
      clerk_id: userId,
      dialist_id: user._id,
      watch_id: watch._id,
      status: "draft",
      brand: watch.brand,
      model: watch.model,
      reference: watch.reference,
      diameter: watch.diameter,
      bezel: watch.bezel,
      materials: watch.materials,
      bracelet: watch.bracelet,
      price: 15000,
      condition: "like-new",
      author: {
        _id: user._id,
        name: `${user.first_name} ${user.last_name}`,
      },
      ships_from: {
        country: "US",
      },
      watch_snapshot: {
        brand: "Rolex",
        model: "Submariner",
        reference: "116610LN",
        diameter: "40mm",
        bezel: "Ceramic",
        materials: "Stainless Steel",
        bracelet: "Oyster",
        color: "Black",
      },
    });
    listingId = listing._id.toString();

    jest.clearAllMocks();
  });

  describe("POST /api/v1/marketplace/listings/:id/images", () => {
    it("should upload images successfully", async () => {
      const mockImageMetadata = [
        {
          key: "listings/123/abc-image1.webp",
          url: "https://s3.amazonaws.com/bucket/listings/123/abc-image1.webp",
          thumbnailKey: "listings/123/thumb_abc-image1.webp",
          thumbnailUrl:
            "https://s3.amazonaws.com/bucket/listings/123/thumb_abc-image1.webp",
          size: 245678,
          width: 2048,
          height: 1536,
          mimeType: "image/webp",
          uploadedAt: new Date(),
        },
        {
          key: "listings/123/def-image2.webp",
          url: "https://s3.amazonaws.com/bucket/listings/123/def-image2.webp",
          thumbnailKey: "listings/123/thumb_def-image2.webp",
          thumbnailUrl:
            "https://s3.amazonaws.com/bucket/listings/123/thumb_def-image2.webp",
          size: 198234,
          width: 1920,
          height: 1440,
          mimeType: "image/webp",
          uploadedAt: new Date(),
        },
        {
          key: "listings/123/ghi-image3.webp",
          url: "https://s3.amazonaws.com/bucket/listings/123/ghi-image3.webp",
          thumbnailKey: "listings/123/thumb_ghi-image3.webp",
          thumbnailUrl:
            "https://s3.amazonaws.com/bucket/listings/123/thumb_ghi-image3.webp",
          size: 212456,
          width: 2560,
          height: 1920,
          mimeType: "image/webp",
          uploadedAt: new Date(),
        },
      ];

      (imageService.uploadImages as jest.Mock).mockResolvedValue(
        mockImageMetadata
      );

      const response = await request(app)
        .post(`/api/v1/marketplace/listings/${listingId}/images`)
        .set("x-test-user", userId)
        .attach("images", Buffer.from("fake-image-1"), "image1.jpg")
        .attach("images", Buffer.from("fake-image-2"), "image2.jpg")
        .attach("images", Buffer.from("fake-image-3"), "image3.jpg")
        .expect(200);

      expect(response.body.data.images).toHaveLength(3);
      expect(response.body.data.count).toBe(3);
      expect(response.body.data.images[0]).toHaveProperty("url");
      expect(response.body.data.images[0]).toHaveProperty("thumbnailUrl");
    });

    it("should return 400 if no files uploaded", async () => {
      const response = await request(app)
        .post(`/api/v1/marketplace/listings/${listingId}/images`)
        .set("x-test-user", userId)
        .expect(400);

      expect(response.body.error.message).toContain("No images uploaded");
    });

    it("should return 401 if not authenticated", async () => {
      await request(app)
        .post(`/api/v1/marketplace/listings/${listingId}/images`)
        .attach("images", Buffer.from("fake-image"), "image.jpg")
        .expect(401);
    });

    it("should return 404 if listing not found", async () => {
      const fakeListingId = "507f1f77bcf86cd799439011";

      await request(app)
        .post(`/api/v1/marketplace/listings/${fakeListingId}/images`)
        .set("x-test-user", userId)
        .attach("images", Buffer.from("fake-image"), "image.jpg")
        .expect(404);
    });

    it("should return 403 if not listing owner", async () => {
      // Create another user's listing
      const otherUser = await User.create({
        external_id: "other-user-123",
        email: "other@example.com",
        first_name: "Other",
        last_name: "User",
        onboarding_step: 4,
      });

      const watch = await Watch.findOne();
      const otherListing = await MarketplaceListing.create({
        clerk_id: otherUser.external_id,
        dialist_id: otherUser._id,
        watch_id: watch!._id,
        status: "draft",
        brand: "Omega",
        model: "Seamaster",
        reference: "210.30.42.20.01.001",
        diameter: "42mm",
        bezel: "Ceramic",
        materials: "Stainless Steel",
        bracelet: "Bracelet",
        price: 8000,
        author: {
          _id: otherUser._id,
          name: "Other User",
        },
        ships_from: {
          country: "US",
        },
        watch_snapshot: {
          brand: "Omega",
          model: "Seamaster",
          reference: "210.30.42.20.01.001",
          diameter: "42mm",
          bezel: "Ceramic",
          materials: "Stainless Steel",
          bracelet: "Bracelet",
          color: "Blue",
        },
      });

      await request(app)
        .post(`/api/v1/marketplace/listings/${otherListing._id}/images`)
        .set("x-test-user", userId)
        .attach("images", Buffer.from("fake-image"), "image.jpg")
        .expect(403);

      await MarketplaceListing.findByIdAndDelete(otherListing._id);
      await User.findByIdAndDelete(otherUser._id);
    });

    it("should return 400 if listing is not in draft status", async () => {
      const listing = await MarketplaceListing.findById(listingId);
      listing!.status = "active";
      await listing!.save();

      await request(app)
        .post(`/api/v1/marketplace/listings/${listingId}/images`)
        .set("x-test-user", userId)
        .attach("images", Buffer.from("fake-image"), "image.jpg")
        .expect(400);

      // Reset status
      listing!.status = "draft";
      await listing!.save();
    });
  });

  describe("DELETE /api/v1/marketplace/listings/:id/images/:imageKey", () => {
    beforeEach(async () => {
      // Add images to listing
      const listing = await MarketplaceListing.findById(listingId);
      listing!.images = [
        "https://s3.amazonaws.com/bucket/listings/123/image1.webp",
        "https://s3.amazonaws.com/bucket/listings/123/image2.webp",
        "https://s3.amazonaws.com/bucket/listings/123/image3.webp",
      ];
      listing!.thumbnail = listing!.images[0];
      await listing!.save();
    });

    it("should delete image successfully", async () => {
      (imageService.deleteImage as jest.Mock).mockResolvedValue(undefined);

      const imageKey = encodeURIComponent("listings/123/image2.webp");

      const response = await request(app)
        .delete(`/api/v1/marketplace/listings/${listingId}/images/${imageKey}`)
        .set("x-test-user", userId)
        .expect(200);

      expect(response.body.data.remainingImages).toBe(2);
    });

    it("should return 404 if image not found", async () => {
      const imageKey = encodeURIComponent("listings/123/nonexistent.webp");

      await request(app)
        .delete(`/api/v1/marketplace/listings/${listingId}/images/${imageKey}`)
        .set("x-test-user", userId)
        .expect(404);
    });
  });

  describe("PATCH /api/v1/marketplace/listings/:id/thumbnail", () => {
    beforeEach(async () => {
      const listing = await MarketplaceListing.findById(listingId);
      listing!.images = [
        "https://s3.amazonaws.com/bucket/listings/123/image1.webp",
        "https://s3.amazonaws.com/bucket/listings/123/image2.webp",
        "https://s3.amazonaws.com/bucket/listings/123/image3.webp",
      ];
      listing!.thumbnail = listing!.images[0];
      await listing!.save();
    });

    it("should set thumbnail successfully", async () => {
      const newThumbnail =
        "https://s3.amazonaws.com/bucket/listings/123/image2.webp";

      const response = await request(app)
        .patch(`/api/v1/marketplace/listings/${listingId}/thumbnail`)
        .set("x-test-user", userId)
        .send({ imageUrl: newThumbnail })
        .expect(200);

      expect(response.body.data.thumbnail).toBe(newThumbnail);
    });

    it("should return 400 if imageUrl not provided", async () => {
      await request(app)
        .patch(`/api/v1/marketplace/listings/${listingId}/thumbnail`)
        .set("x-test-user", userId)
        .send({})
        .expect(400);
    });

    it("should return 404 if image not in listing", async () => {
      await request(app)
        .patch(`/api/v1/marketplace/listings/${listingId}/thumbnail`)
        .set("x-test-user", userId)
        .send({
          imageUrl: "https://s3.amazonaws.com/bucket/listings/456/other.webp",
        })
        .expect(404);
    });
  });

  describe("PATCH /api/v1/marketplace/listings/:id/images/reorder", () => {
    beforeEach(async () => {
      const listing = await MarketplaceListing.findById(listingId);
      listing!.images = [
        "https://s3.amazonaws.com/bucket/listings/123/image1.webp",
        "https://s3.amazonaws.com/bucket/listings/123/image2.webp",
        "https://s3.amazonaws.com/bucket/listings/123/image3.webp",
      ];
      await listing!.save();
    });

    it("should reorder images successfully", async () => {
      const newOrder = [
        "https://s3.amazonaws.com/bucket/listings/123/image3.webp",
        "https://s3.amazonaws.com/bucket/listings/123/image1.webp",
        "https://s3.amazonaws.com/bucket/listings/123/image2.webp",
      ];

      const response = await request(app)
        .patch(`/api/v1/marketplace/listings/${listingId}/images/reorder`)
        .set("x-test-user", userId)
        .send({ imageUrls: newOrder })
        .expect(200);

      expect(response.body.data.images).toEqual(newOrder);
    });

    it("should return 400 if imageUrls not array", async () => {
      await request(app)
        .patch(`/api/v1/marketplace/listings/${listingId}/images/reorder`)
        .set("x-test-user", userId)
        .send({ imageUrls: "not-an-array" })
        .expect(400);
    });

    it("should return 400 if count mismatch", async () => {
      await request(app)
        .patch(`/api/v1/marketplace/listings/${listingId}/images/reorder`)
        .set("x-test-user", userId)
        .send({
          imageUrls: [
            "https://s3.amazonaws.com/bucket/listings/123/image1.webp",
            "https://s3.amazonaws.com/bucket/listings/123/image2.webp",
          ],
        })
        .expect(400);
    });

    it("should return 400 if URL not found", async () => {
      await request(app)
        .patch(`/api/v1/marketplace/listings/${listingId}/images/reorder`)
        .set("x-test-user", userId)
        .send({
          imageUrls: [
            "https://s3.amazonaws.com/bucket/listings/123/image1.webp",
            "https://s3.amazonaws.com/bucket/listings/123/image2.webp",
            "https://s3.amazonaws.com/bucket/listings/456/other.webp",
          ],
        })
        .expect(400);
    });
  });
});
