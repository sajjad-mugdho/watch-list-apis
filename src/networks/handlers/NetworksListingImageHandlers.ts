import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../../types";
import { NetworkListing } from "../models/NetworkListing";
import {
  imageService,
  ImageContext,
  ImageMetadata,
} from "../../services/ImageService";
import logger from "../../utils/logger";
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
  MissingUserContextError,
} from "../../utils/errors";

/**
 * Upload images for a networks listing
 *
 * Route: POST /api/v1/networks/listings/:id/images
 * Body: multipart/form-data with 'images' field (1-10 files)
 * Auth: Required (Bearer token or mock user)
 *
 * @param req - Express request with files
 * @param res - Express response
 * @param next - Express next function
 */
export async function networks_listing_upload_images(
  req: Request,
  res: Response<ApiResponse<{ images: ImageMetadata[]; count: number }>>,
  next: NextFunction,
) {
  try {
    const { id: listingId } = req.params;

    if (!req.user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "req.user missing in networks_listing_upload_images",
      });
    }

    const userId = req.user.userId;

    // Validate files uploaded
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw new ValidationError(
        "No images uploaded. Please upload 1-10 images.",
      );
    }

    // Find listing
    const listing = await NetworkListing.findById(listingId);
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Verify ownership - check both _id (dialist_id) and clerk_id matching
    if (
      listing.clerk_id !== userId &&
      listing.dialist_id?.toString() !== userId
    ) {
      throw new AuthorizationError(
        "You can only upload images to your own listings",
        undefined,
      );
    }

    // Verify listing is in draft status
    if (listing.status !== "draft") {
      throw new ValidationError(
        "Images can only be uploaded to draft listings",
      );
    }

    logger.info("📸 Networks: Starting image upload", {
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
      minImages: 1, // Networks listings allow 1-10 images (vs Marketplace requiring 3-10)
    });

    // Update listing with image URLs
    listing.images = imageMetadata.map((img) => img.url);

    // Set first image thumbnail as primary thumbnail if not already set
    if (!listing.thumbnail && imageMetadata.length > 0) {
      listing.thumbnail = imageMetadata[0].thumbnailUrl || imageMetadata[0].url;
    }

    await listing.save();

    logger.info("📸 Networks: Images uploaded successfully", {
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

    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
}

/**
 * Delete a specific image from a networks listing
 *
 * Route: DELETE /api/v1/networks/listings/:id/images/:imageKey
 * Auth: Required (Bearer token or mock user)
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export async function networks_listing_delete_image(
  req: Request,
  res: Response<ApiResponse<{ count: number }>>,
  next: NextFunction,
) {
  try {
    const { id: listingId, imageKey } = req.params;

    if (!req.user) {
      throw new MissingUserContextError({
        route: req.path,
        note: "req.user missing in networks_listing_delete_image",
      });
    }

    const userId = req.user.userId;

    // Find listing
    const listing = await NetworkListing.findById(listingId);
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Verify ownership
    if (
      listing.clerk_id !== userId &&
      listing.dialist_id?.toString() !== userId
    ) {
      throw new AuthorizationError(
        "You can only delete images from your own listings",
        undefined,
      );
    }

    // Decode the imageKey (it comes URL encoded)
    const decodedKey = decodeURIComponent(imageKey);

    // Check if image exists in listing
    const imageExists = listing.images.some((url) => url.includes(decodedKey));
    if (!imageExists) {
      throw new NotFoundError("Image not found in this listing");
    }

    // Delete from S3
    await imageService.deleteImage(decodedKey);

    // Remove from listing images array
    listing.images = listing.images.filter((url) => !url.includes(decodedKey));

    // If primary thumbnail was deleted, set new one
    if (listing.thumbnail?.includes(decodedKey)) {
      listing.thumbnail = listing.images[0];
    }

    await listing.save();

    logger.info("🗑️ Networks: Image deleted successfully", {
      listingId,
      userId,
      imageKey,
    });

    const response: ApiResponse<{ count: number }> = {
      data: {
        count: listing.images.length,
      },
      requestId: req.headers["x-request-id"] as string,
    };

    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
}
