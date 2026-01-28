import multer from "multer";
import { Request } from "express";
import { IMAGE_CONSTRAINTS } from "../services/ImageService";

/**
 * Multer configuration for image uploads
 *
 * Uses memory storage to process images in-memory before uploading to S3
 * This allows for validation and optimization before final upload
 */

// Memory storage - files are stored in memory as Buffer objects
const storage = multer.memoryStorage();

// File filter to accept only images
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Accept images only
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

/**
 * Single image upload middleware
 */
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: IMAGE_CONSTRAINTS.MAX_FILE_SIZE,
  },
}).single("image");

/**
 * Multiple images upload middleware (for listings)
 */
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: IMAGE_CONSTRAINTS.MAX_FILE_SIZE,
    files: IMAGE_CONSTRAINTS.MAX_LISTING_IMAGES,
  },
}).array("images", IMAGE_CONSTRAINTS.MAX_LISTING_IMAGES);

/**
 * Avatar upload middleware
 */
export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: IMAGE_CONSTRAINTS.MAX_FILE_SIZE,
  },
}).single("avatar");

/**
 * Handle multer errors and convert to user-friendly messages
 */
export const handleMulterError = (error: any) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return `File size exceeds the maximum limit of ${
          IMAGE_CONSTRAINTS.MAX_FILE_SIZE / 1024 / 1024
        }MB`;
      case "LIMIT_FILE_COUNT":
        return `Too many files. Maximum ${IMAGE_CONSTRAINTS.MAX_LISTING_IMAGES} files allowed`;
      case "LIMIT_UNEXPECTED_FILE":
        return "Unexpected field in file upload";
      default:
        return `Upload error: ${error.message}`;
    }
  }
  return error.message || "Unknown upload error";
};
