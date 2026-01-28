import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types";
import { MarketplaceListing } from "../models/Listings";
import {
  imageService,
  ImageContext,
  ImageMetadata,
} from "../services/ImageService";
import { handleMulterError } from "../middleware/upload";
import logger from "../utils/logger";
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
  MissingUserContextError,
} from "../utils/errors";

/**
 * Upload images for a marketplace listing
 *
 * Route: POST /api/marketplace/listings/:id/images
 * Body: multipart/form-data with 'images' field (3-10 files)
 * Auth: Required
 *
 * @param req - Express request with files
 * @param res - Express response
 * @param next - Express next function
 */
export async function uploadListingImages(
  req: Request,
  res: Response<ApiResponse<{ images: ImageMetadata[]; count: number }>>,
  next: NextFunction
) {
  try {
    const { id: listingId } = req.params;

    if (!req.user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "req.user missing in uploadListingImages",
      });
    }

    const userId = req.user.userId;

    // Validate files uploaded
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw new ValidationError(
        "No images uploaded. Please upload 3-10 images."
      );
    }

    // Find listing
    const listing = await MarketplaceListing.findById(listingId);
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Verify ownership
    if (listing.clerk_id !== userId) {
      throw new AuthorizationError(
        "You can only upload images to your own listings",
        undefined
      );
    }

    // Verify listing is in draft status
    if (listing.status !== "draft") {
      throw new ValidationError(
        "Images can only be uploaded to draft listings"
      );
    }

    logger.info("Starting image upload", {
      listingId,
      userId,
      fileCount: req.files.length,
    });

    // Upload images to S3
    const imageMetadata = await imageService.uploadImages(req.files, {
      context: ImageContext.LISTING,
      entityId: listingId,
      generateThumbnail: true,
      optimize: true,
    });

    // Update listing with image URLs (simple string array for now)
    listing.images = imageMetadata.map((img) => img.url);

    // Set first image thumbnail as primary thumbnail if not already set
    if (!listing.thumbnail && imageMetadata.length > 0) {
      listing.thumbnail = imageMetadata[0].thumbnailUrl || imageMetadata[0].url;
    }

    await listing.save();

    logger.info("Images uploaded successfully", {
      listingId,
      userId,
      imageCount: imageMetadata.length,
    });

    const response: ApiResponse<{ images: ImageMetadata[]; count: number }> = {
      data: {
        images: imageMetadata,
        count: imageMetadata.length,
      },
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(200).json(response);
  } catch (error) {
    // Handle multer-specific errors
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as any).code === "string"
    ) {
      const multerErrorCodes = [
        "LIMIT_FILE_SIZE",
        "LIMIT_FILE_COUNT",
        "LIMIT_UNEXPECTED_FILE",
        "LIMIT_FIELD_KEY",
      ];
      if (multerErrorCodes.includes((error as any).code)) {
        const friendlyError = handleMulterError(error);
        return next(new ValidationError(friendlyError));
      }
    }
    next(error);
  }
}

/**
 * Delete a specific image from a listing
 *
 * Route: DELETE /api/marketplace/listings/:id/images/:imageIndex
 * Auth: Required
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export async function deleteListingImage(
  req: Request,
  res: Response<ApiResponse<{ remainingImages: number }>>,
  next: NextFunction
) {
  try {
    const { id: listingId, imageKey } = req.params;

    if (!req.user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "req.user missing in deleteListingImage",
      });
    }

    const userId = req.user.userId;

    // Decode imageKey (may be URL encoded)
    const decodedKey = decodeURIComponent(imageKey);

    // Find listing
    const listing = await MarketplaceListing.findById(listingId);
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Verify ownership
    if (listing.clerk_id !== userId) {
      throw new AuthorizationError(
        "You can only delete images from your own listings",
        undefined
      );
    }

    // Find the image URL by checking if decodedKey is in the URL
    const imageIndex = (listing.images || []).findIndex((url) =>
      url.includes(decodedKey)
    );
    if (imageIndex === -1) {
      throw new NotFoundError("Image not found in listing");
    }

    const imageUrl = listing.images![imageIndex];

    // Extract key from URL for deletion
    const urlParts = new URL(imageUrl);
    const keyToDelete = urlParts.pathname.slice(1); // Remove leading slash

    // Delete from S3
    await imageService.deleteImage(keyToDelete);

    // Also try to delete thumbnail (if exists)
    const thumbnailKey = keyToDelete.replace(/([^/]+)$/, "thumb_$1");
    try {
      await imageService.deleteImage(thumbnailKey);
    } catch {
      // Thumbnail might not exist, ignore
    }

    // Remove from listing
    listing.images!.splice(imageIndex, 1);

    // If this was the thumbnail, set a new one
    if (
      listing.thumbnail === imageUrl ||
      listing.thumbnail?.includes(decodedKey)
    ) {
      listing.thumbnail =
        (listing.images || []).length > 0 ? listing.images![0] : "";
    }

    await listing.save();

    logger.info("Image deleted from listing", {
      listingId,
      userId,
      imageKey: decodedKey,
      remainingImages: listing.images?.length || 0,
    });

    const response: ApiResponse<{ remainingImages: number }> = {
      data: {
        remainingImages: listing.images?.length || 0,
      },
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Set primary thumbnail for a listing
 *
 * Route: PATCH /api/marketplace/listings/:id/thumbnail
 * Body: { imageUrl: string }
 * Auth: Required
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export async function setListingThumbnail(
  req: Request,
  res: Response<ApiResponse<{ thumbnail: string }>>,
  next: NextFunction
) {
  try {
    const { id: listingId } = req.params;
    const { imageUrl } = req.body;

    if (!req.user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "req.user missing in setListingThumbnail",
      });
    }

    const userId = req.user.userId;

    if (!imageUrl) {
      throw new ValidationError("imageUrl is required");
    }

    // Find listing
    const listing = await MarketplaceListing.findById(listingId);
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Verify ownership
    if (listing.clerk_id !== userId) {
      throw new AuthorizationError(
        "You can only modify your own listings",
        undefined
      );
    }

    // Verify image exists in listing
    if (!(listing.images || []).includes(imageUrl)) {
      throw new NotFoundError("Image not found in listing");
    }

    // Set as primary thumbnail
    listing.thumbnail = imageUrl;
    await listing.save();

    logger.info("Listing thumbnail updated", {
      listingId,
      userId,
      imageUrl,
    });

    const response: ApiResponse<{ thumbnail: string }> = {
      data: {
        thumbnail: listing.thumbnail!,
      },
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Reorder listing images
 *
 * Route: PATCH /api/marketplace/listings/:id/images/reorder
 * Body: { imageUrls: string[] } - Array of image URLs in desired order
 * Auth: Required
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export async function reorderListingImages(
  req: Request,
  res: Response<ApiResponse<{ images: string[] }>>,
  next: NextFunction
) {
  try {
    const { id: listingId } = req.params;
    const { imageUrls } = req.body;

    if (!req.user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "req.user missing in reorderListingImages",
      });
    }

    const userId = req.user.userId;

    if (!Array.isArray(imageUrls)) {
      throw new ValidationError("imageUrls must be an array");
    }

    // Find listing
    const listing = await MarketplaceListing.findById(listingId);
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Verify ownership
    if (listing.clerk_id !== userId) {
      throw new AuthorizationError(
        "You can only modify your own listings",
        undefined
      );
    }

    // Validate all URLs exist
    const currentImages = listing.images || [];
    if (imageUrls.length !== currentImages.length) {
      throw new ValidationError(
        "imageUrls count must match existing images count"
      );
    }

    const existingUrls = new Set(currentImages);
    for (const url of imageUrls) {
      if (!existingUrls.has(url)) {
        throw new ValidationError(`Image URL not found: ${url}`);
      }
    }

    // Reorder images
    listing.images = imageUrls;
    await listing.save();

    logger.info("Listing images reordered", {
      listingId,
      userId,
      imageCount: imageUrls.length,
    });

    const response: ApiResponse<{ images: string[] }> = {
      data: {
        images: listing.images,
      },
      requestId: req.headers["x-request-id"] as string,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
