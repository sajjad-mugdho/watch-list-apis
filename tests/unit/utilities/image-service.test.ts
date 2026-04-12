import {
  imageService,
  ImageContext,
  IMAGE_CONSTRAINTS,
} from "../../src/services/ImageService";
import { S3ClientManager } from "../../src/config/s3";

// Mock AWS S3 Client
jest.mock("@aws-sdk/client-s3", () => {
  const mockSend = jest.fn().mockResolvedValue({});
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
      destroy: jest.fn(),
    })),
    PutObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    DeleteObjectsCommand: jest.fn(),
    HeadObjectCommand: jest.fn(),
  };
});

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue("https://presigned-url.example.com"),
}));

jest.mock("sharp", () => {
  const mockSharp = jest.fn(() => ({
    metadata: jest.fn().mockResolvedValue({
      format: "jpeg",
      width: 1920,
      height: 1080,
    }),
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from("optimized-image")),
  }));
  return mockSharp;
});

describe("ImageService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Image Constraints", () => {
    it("should have correct constraint values", () => {
      expect(IMAGE_CONSTRAINTS.MAX_FILE_SIZE).toBe(10 * 1024 * 1024); // 10MB
      expect(IMAGE_CONSTRAINTS.MAX_TOTAL_SIZE).toBe(50 * 1024 * 1024); // 50MB
      expect(IMAGE_CONSTRAINTS.MIN_LISTING_IMAGES).toBe(3);
      expect(IMAGE_CONSTRAINTS.MAX_LISTING_IMAGES).toBe(10);
      expect(IMAGE_CONSTRAINTS.MAX_WIDTH).toBe(4096);
      expect(IMAGE_CONSTRAINTS.MAX_HEIGHT).toBe(4096);
      expect(IMAGE_CONSTRAINTS.THUMBNAIL_WIDTH).toBe(400);
      expect(IMAGE_CONSTRAINTS.THUMBNAIL_HEIGHT).toBe(400);
    });
  });

  describe("uploadImage", () => {
    const mockFile: Express.Multer.File = {
      fieldname: "images",
      originalname: "test-image.jpg",
      encoding: "7bit",
      mimetype: "image/jpeg",
      buffer: Buffer.from("fake-image-data"),
      size: 1024 * 1024, // 1MB
      stream: null as any,
      destination: "",
      filename: "",
      path: "",
    };

    it("should upload a single image successfully", async () => {
      const result = await imageService.uploadImage(mockFile, {
        context: ImageContext.LISTING,
        entityId: "test-listing-123",
        generateThumbnail: true,
        optimize: true,
      });

      expect(result).toHaveProperty("key");
      expect(result).toHaveProperty("url");
      expect(result).toHaveProperty("thumbnailKey");
      expect(result).toHaveProperty("thumbnailUrl");
      expect(result).toHaveProperty("size");
      expect(result).toHaveProperty("width");
      expect(result).toHaveProperty("height");
      expect(result).toHaveProperty("mimeType");
      expect(result.key).toContain("listings/test-listing-123");
    });

    it("should reject files exceeding max size", async () => {
      const largeFile = {
        ...mockFile,
        size: IMAGE_CONSTRAINTS.MAX_FILE_SIZE + 1,
      };

      await expect(
        imageService.uploadImage(largeFile, {
          context: ImageContext.LISTING,
          entityId: "test-listing-123",
        })
      ).rejects.toThrow("exceeds maximum size");
    });

    it("should generate thumbnail when requested", async () => {
      const result = await imageService.uploadImage(mockFile, {
        context: ImageContext.LISTING,
        entityId: "test-listing-123",
        generateThumbnail: true,
      });

      expect(result.thumbnailKey).toBeDefined();
      expect(result.thumbnailUrl).toBeDefined();
      expect(result.thumbnailKey).toContain("thumb_");
    });

    it("should not generate thumbnail when not requested", async () => {
      const result = await imageService.uploadImage(mockFile, {
        context: ImageContext.LISTING,
        entityId: "test-listing-123",
        generateThumbnail: false,
      });

      expect(result.thumbnailKey).toBeUndefined();
      expect(result.thumbnailUrl).toBeUndefined();
    });

    it("should upload to correct context path", async () => {
      const contexts = [
        ImageContext.LISTING,
        ImageContext.AVATAR,
        ImageContext.CERTIFICATE,
        ImageContext.DOCUMENT,
      ];

      for (const context of contexts) {
        const result = await imageService.uploadImage(mockFile, {
          context,
          entityId: "test-123",
        });

        expect(result.key).toContain(context);
      }
    });
  });

  describe("uploadImages", () => {
    const createMockFile = (
      name: string,
      size: number = 1024 * 1024
    ): Express.Multer.File => ({
      fieldname: "images",
      originalname: name,
      encoding: "7bit",
      mimetype: "image/jpeg",
      buffer: Buffer.from("fake-image-data"),
      size,
      stream: null as any,
      destination: "",
      filename: "",
      path: "",
    });

    it("should upload multiple images successfully", async () => {
      const files = [
        createMockFile("image1.jpg"),
        createMockFile("image2.jpg"),
        createMockFile("image3.jpg"),
      ];

      const results = await imageService.uploadImages(files, {
        context: ImageContext.LISTING,
        entityId: "test-listing-123",
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty("key");
      expect(results[1]).toHaveProperty("url");
      expect(results[2]).toHaveProperty("size");
    });

    it("should reject if total size exceeds limit", async () => {
      const files = [
        createMockFile("image1.jpg", 20 * 1024 * 1024),
        createMockFile("image2.jpg", 20 * 1024 * 1024),
        createMockFile("image3.jpg", 20 * 1024 * 1024),
      ];

      await expect(
        imageService.uploadImages(files, {
          context: ImageContext.LISTING,
          entityId: "test-listing-123",
        })
      ).rejects.toThrow("Total upload size exceeds");
    });

    it("should enforce minimum images for listings", async () => {
      const files = [
        createMockFile("image1.jpg"),
        createMockFile("image2.jpg"),
      ];

      await expect(
        imageService.uploadImages(files, {
          context: ImageContext.LISTING,
          entityId: "test-listing-123",
        })
      ).rejects.toThrow("Listings require at least 3 images");
    });

    it("should enforce maximum images for listings", async () => {
      const files = Array.from({ length: 11 }, (_, i) =>
        createMockFile(`image${i + 1}.jpg`)
      );

      await expect(
        imageService.uploadImages(files, {
          context: ImageContext.LISTING,
          entityId: "test-listing-123",
        })
      ).rejects.toThrow("Listings cannot have more than 10 images");
    });

    it("should allow any count for non-listing contexts", async () => {
      const files = [createMockFile("avatar.jpg")];

      const results = await imageService.uploadImages(files, {
        context: ImageContext.AVATAR,
        entityId: "test-user-123",
      });

      expect(results).toHaveLength(1);
    });
  });

  describe("deleteImage", () => {
    it("should delete a single image", async () => {
      await expect(
        imageService.deleteImage("listings/test-123/image.jpg")
      ).resolves.not.toThrow();
    });
  });

  describe("deleteImages", () => {
    it("should delete multiple images", async () => {
      const keys = [
        "listings/test-123/image1.jpg",
        "listings/test-123/image2.jpg",
        "listings/test-123/image3.jpg",
      ];

      await expect(imageService.deleteImages(keys)).resolves.not.toThrow();
    });

    it("should handle empty array", async () => {
      await expect(imageService.deleteImages([])).resolves.not.toThrow();
    });

    it("should handle large batches (>1000)", async () => {
      const keys = Array.from(
        { length: 1500 },
        (_, i) => `listings/test/image${i}.jpg`
      );

      await expect(imageService.deleteImages(keys)).resolves.not.toThrow();
    });
  });

  describe("imageExists", () => {
    it("should return true for existing image", async () => {
      const result = await imageService.imageExists(
        "listings/test-123/image.jpg"
      );
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getPresignedUrl", () => {
    it("should generate presigned URL", async () => {
      const url = await imageService.getPresignedUrl(
        "listings/test-123/image.jpg"
      );

      expect(url).toBe("https://presigned-url.example.com");
    });

    it("should accept custom expiration", async () => {
      const url = await imageService.getPresignedUrl(
        "listings/test-123/image.jpg",
        600 // 10 minutes
      );

      expect(url).toBeDefined();
    });
  });

  describe("getImageMetadata", () => {
    it("should return image metadata", async () => {
      // Mock HeadObjectCommand response
      const { S3Client } = jest.requireMock("@aws-sdk/client-s3");
      const mockClient = new S3Client({});
      const mockSend = mockClient.send as jest.Mock;

      mockSend.mockResolvedValueOnce({
        ContentLength: 1024 * 1024,
        ContentType: "image/jpeg",
        LastModified: new Date(),
      });

      const metadata = await imageService.getImageMetadata(
        "listings/test-123/image.jpg"
      );

      expect(metadata).toHaveProperty("size");
      expect(metadata).toHaveProperty("contentType");
      expect(metadata).toHaveProperty("lastModified");
    });
  });

  describe("S3ClientManager", () => {
    it("should create singleton instance", () => {
      const client1 = S3ClientManager.getClient();
      const client2 = S3ClientManager.getClient();

      expect(client1).toBe(client2);
    });

    it("should destroy client instance", () => {
      S3ClientManager.destroyClient();
      const newClient = S3ClientManager.getClient();

      expect(newClient).toBeDefined();
    });
  });
});
