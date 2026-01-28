import {
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import mime from "mime-types";
import { s3Client } from "../config/s3";
import { config } from "../config";
import logger from "../utils/logger";

/**
 * Supported image formats
 */
const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/**
 * Image upload configuration constants
 */
export const IMAGE_CONSTRAINTS = {
  // File size limits (bytes)
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB per file
  MAX_TOTAL_SIZE: 50 * 1024 * 1024, // 50MB total per request

  // Listing image constraints
  MIN_LISTING_IMAGES: 3,
  MAX_LISTING_IMAGES: 10,

  // Dimensions
  MAX_WIDTH: 4096,
  MAX_HEIGHT: 4096,
  THUMBNAIL_WIDTH: 400,
  THUMBNAIL_HEIGHT: 400,

  // Quality
  JPEG_QUALITY: 85,
  WEBP_QUALITY: 85,

  // Presigned URL expiration (seconds)
  PRESIGNED_URL_EXPIRY: 3600, // 1 hour
} as const;

/**
 * Image upload context types
 */
export enum ImageContext {
  LISTING = "listings",
  AVATAR = "avatars",
  CERTIFICATE = "certificates",
  DOCUMENT = "documents",
}

/**
 * Image metadata
 */
export interface ImageMetadata {
  key: string;
  url: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
  size: number;
  width: number;
  height: number;
  mimeType: string;
  uploadedAt: Date;
}

/**
 * Upload options
 */
export interface UploadOptions {
  context: ImageContext;
  entityId: string;
  generateThumbnail?: boolean;
  optimize?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Validation result
 */
interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Enterprise-grade Image Service
 *
 * Features:
 * - Multi-file uploads with size validation
 * - Automatic image optimization (resize, compress, format conversion)
 * - Thumbnail generation
 * - Presigned URL generation for secure access
 * - Comprehensive error handling and logging
 * - File type validation (magic bytes, not just extension)
 * - Support for listings, avatars, certificates, documents
 */
class ImageService {
  private readonly bucket: string;
  private readonly cloudFrontDomain?: string;

  constructor() {
    this.bucket = config.aws.s3Bucket;
    if (config.aws.cloudFrontDomain) {
      this.cloudFrontDomain = config.aws.cloudFrontDomain;
    }
  }

  /**
   * Validate file size
   */
  private validateFileSize(file: Express.Multer.File): ValidationResult {
    if (file.size > IMAGE_CONSTRAINTS.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File ${file.originalname} exceeds maximum size of ${
          IMAGE_CONSTRAINTS.MAX_FILE_SIZE / 1024 / 1024
        }MB`,
      };
    }
    return { valid: true };
  }

  /**
   * Validate total upload size
   */
  private validateTotalSize(files: Express.Multer.File[]): ValidationResult {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > IMAGE_CONSTRAINTS.MAX_TOTAL_SIZE) {
      return {
        valid: false,
        error: `Total upload size exceeds ${
          IMAGE_CONSTRAINTS.MAX_TOTAL_SIZE / 1024 / 1024
        }MB`,
      };
    }
    return { valid: true };
  }

  /**
   * Validate MIME type using magic bytes
   */
  private async validateMimeType(buffer: Buffer): Promise<ValidationResult> {
    try {
      const metadata = await sharp(buffer).metadata();
      const format = metadata.format;

      // Map sharp format to MIME type
      const mimeType = format ? `image/${format}` : null;

      if (!mimeType || !SUPPORTED_MIME_TYPES.includes(mimeType as any)) {
        return {
          valid: false,
          error: `Unsupported image format. Supported: ${SUPPORTED_MIME_TYPES.join(
            ", "
          )}`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: "Invalid image file - unable to read image data",
      };
    }
  }

  /**
   * Validate image dimensions
   */
  private async validateDimensions(buffer: Buffer): Promise<ValidationResult> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        return {
          valid: false,
          error: "Unable to determine image dimensions",
        };
      }

      if (
        metadata.width > IMAGE_CONSTRAINTS.MAX_WIDTH ||
        metadata.height > IMAGE_CONSTRAINTS.MAX_HEIGHT
      ) {
        return {
          valid: false,
          error: `Image dimensions exceed maximum ${IMAGE_CONSTRAINTS.MAX_WIDTH}x${IMAGE_CONSTRAINTS.MAX_HEIGHT}`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: "Unable to process image metadata",
      };
    }
  }

  /**
   * Optimize image (resize, compress, convert to WebP if beneficial)
   */
  private async optimizeImage(
    buffer: Buffer,
    options: { maxWidth?: number; maxHeight?: number } = {}
  ): Promise<{ buffer: Buffer; format: string }> {
    const maxWidth = options.maxWidth || IMAGE_CONSTRAINTS.MAX_WIDTH;
    const maxHeight = options.maxHeight || IMAGE_CONSTRAINTS.MAX_HEIGHT;

    let pipeline = sharp(buffer);

    // Get original metadata
    const metadata = await pipeline.metadata();

    // Resize if needed
    if (
      (metadata.width && metadata.width > maxWidth) ||
      (metadata.height && metadata.height > maxHeight)
    ) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Convert to WebP for better compression (except GIFs to preserve animation)
    if (metadata.format !== "gif") {
      pipeline = pipeline.webp({ quality: IMAGE_CONSTRAINTS.WEBP_QUALITY });
      return {
        buffer: await pipeline.toBuffer(),
        format: "webp",
      };
    }

    // Keep GIF as is (or compress if needed)
    return {
      buffer: await pipeline.toBuffer(),
      format: metadata.format || "jpeg",
    };
  }

  /**
   * Generate thumbnail
   */
  private async generateThumbnail(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(
        IMAGE_CONSTRAINTS.THUMBNAIL_WIDTH,
        IMAGE_CONSTRAINTS.THUMBNAIL_HEIGHT,
        {
          fit: "cover",
          position: "center",
        }
      )
      .webp({ quality: IMAGE_CONSTRAINTS.WEBP_QUALITY })
      .toBuffer();
  }

  /**
   * Generate S3 key for file
   */
  private generateKey(
    context: ImageContext,
    entityId: string,
    filename: string,
    isThumbnail = false
  ): string {
    const uuid = uuidv4();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const prefix = isThumbnail ? "thumb_" : "";
    return `${context}/${entityId}/${prefix}${uuid}-${sanitizedFilename}`;
  }

  /**
   * Get public URL for S3 object
   */
  private getPublicUrl(key: string): string {
    if (this.cloudFrontDomain) {
      return `https://${this.cloudFrontDomain}/${key}`;
    }
    return `https://${this.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
  }

  /**
   * Upload single file to S3
   */
  private async uploadToS3(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "max-age=31536000", // 1 year cache
      Metadata: {
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);
  }

  /**
   * Upload single image with full validation and optimization
   */
  async uploadImage(
    file: Express.Multer.File,
    options: UploadOptions
  ): Promise<ImageMetadata> {
    const startTime = Date.now();

    try {
      // Step 1: Validate file size
      const sizeValidation = this.validateFileSize(file);
      if (!sizeValidation.valid) {
        throw new Error(sizeValidation.error);
      }

      // Step 2: Validate MIME type using magic bytes
      const mimeValidation = await this.validateMimeType(file.buffer);
      if (!mimeValidation.valid) {
        throw new Error(mimeValidation.error);
      }

      // Step 3: Validate dimensions
      const dimensionsValidation = await this.validateDimensions(file.buffer);
      if (!dimensionsValidation.valid) {
        throw new Error(dimensionsValidation.error);
      }

      // Step 4: Optimize image if requested
      let processedBuffer = file.buffer;
      let format = mime.extension(file.mimetype) || "jpg";

      if (options.optimize !== false) {
        const optimized = await this.optimizeImage(file.buffer, {
          ...(options.maxWidth !== undefined && { maxWidth: options.maxWidth }),
          ...(options.maxHeight !== undefined && {
            maxHeight: options.maxHeight,
          }),
        });
        processedBuffer = optimized.buffer;
        format = optimized.format;
      }

      // Step 5: Generate S3 key and upload main image
      const key = this.generateKey(
        options.context,
        options.entityId,
        `${file.originalname}.${format}`
      );
      const contentType = mime.lookup(format) || "image/jpeg";

      await this.uploadToS3(key, processedBuffer, contentType);

      // Step 6: Get metadata for response
      const metadata = await sharp(processedBuffer).metadata();
      const imageMetadata: ImageMetadata = {
        key,
        url: this.getPublicUrl(key),
        size: processedBuffer.length,
        width: metadata.width || 0,
        height: metadata.height || 0,
        mimeType: contentType,
        uploadedAt: new Date(),
      };

      // Step 7: Generate and upload thumbnail if requested
      if (options.generateThumbnail) {
        const thumbnailBuffer = await this.generateThumbnail(processedBuffer);
        const thumbnailKey = this.generateKey(
          options.context,
          options.entityId,
          `${file.originalname}.webp`,
          true
        );

        await this.uploadToS3(thumbnailKey, thumbnailBuffer, "image/webp");

        imageMetadata.thumbnailKey = thumbnailKey;
        imageMetadata.thumbnailUrl = this.getPublicUrl(thumbnailKey);
      }

      const duration = Date.now() - startTime;
      logger.info("Image uploaded successfully", {
        key,
        context: options.context,
        entityId: options.entityId,
        size: processedBuffer.length,
        duration,
      });

      return imageMetadata;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Image upload failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        context: options.context,
        entityId: options.entityId,
        filename: file.originalname,
        duration,
      });
      throw error;
    }
  }

  /**
   * Upload multiple images with validation
   */
  async uploadImages(
    files: Express.Multer.File[],
    options: UploadOptions
  ): Promise<ImageMetadata[]> {
    // Validate total size
    const totalSizeValidation = this.validateTotalSize(files);
    if (!totalSizeValidation.valid) {
      throw new Error(totalSizeValidation.error);
    }

    // Validate listing image count for listing context
    if (options.context === ImageContext.LISTING) {
      if (files.length < IMAGE_CONSTRAINTS.MIN_LISTING_IMAGES) {
        throw new Error(
          `Listings require at least ${IMAGE_CONSTRAINTS.MIN_LISTING_IMAGES} images`
        );
      }
      if (files.length > IMAGE_CONSTRAINTS.MAX_LISTING_IMAGES) {
        throw new Error(
          `Listings cannot have more than ${IMAGE_CONSTRAINTS.MAX_LISTING_IMAGES} images`
        );
      }
    }

    // Upload all files sequentially to avoid overwhelming S3
    const results: ImageMetadata[] = [];
    const errors: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      try {
        const metadata = await this.uploadImage(file, options);
        results.push(metadata);
      } catch (error) {
        errors.push({
          filename: file.originalname,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // If any uploads failed, log them
    if (errors.length > 0) {
      logger.warn("Some images failed to upload", {
        context: options.context,
        entityId: options.entityId,
        totalFiles: files.length,
        successful: results.length,
        failed: errors.length,
        errors,
      });
    }

    // For listing context, ensure minimum images uploaded
    if (
      options.context === ImageContext.LISTING &&
      results.length < IMAGE_CONSTRAINTS.MIN_LISTING_IMAGES
    ) {
      // Clean up successfully uploaded images
      await this.deleteImages(results.map((r) => r.key));
      throw new Error(
        `Failed to upload minimum required images. ${errors.length} uploads failed.`
      );
    }

    return results;
  }

  /**
   * Delete single image from S3
   */
  async deleteImage(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await s3Client.send(command);

      logger.info("Image deleted successfully", { key });
    } catch (error) {
      logger.error("Image deletion failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        key,
      });
      throw error;
    }
  }

  /**
   * Delete multiple images from S3 (batch operation)
   */
  async deleteImages(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      // S3 batch delete supports up to 1000 objects
      const batches: string[][] = [];
      for (let i = 0; i < keys.length; i += 1000) {
        batches.push(keys.slice(i, i + 1000));
      }

      for (const batch of batches) {
        const command = new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: batch.map((key) => ({ Key: key })),
            Quiet: true,
          },
        });

        await s3Client.send(command);
      }

      logger.info("Images deleted successfully", { count: keys.length });
    } catch (error) {
      logger.error("Batch image deletion failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        count: keys.length,
      });
      throw error;
    }
  }

  /**
   * Check if image exists in S3
   */
  async imageExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error: any) {
      if (
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generate presigned URL for secure temporary access
   */
  async getPresignedUrl(
    key: string,
    expiresIn: number = IMAGE_CONSTRAINTS.PRESIGNED_URL_EXPIRY
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn,
      });

      return presignedUrl;
    } catch (error) {
      logger.error("Failed to generate presigned URL", {
        error: error instanceof Error ? error.message : "Unknown error",
        key,
      });
      throw error;
    }
  }

  /**
   * Get image metadata without downloading
   */
  async getImageMetadata(
    key: string
  ): Promise<{ size: number; contentType: string; lastModified: Date }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await s3Client.send(command);

      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || "application/octet-stream",
        lastModified: response.LastModified || new Date(),
      };
    } catch (error) {
      logger.error("Failed to get image metadata", {
        error: error instanceof Error ? error.message : "Unknown error",
        key,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const imageService = new ImageService();
export default imageService;
