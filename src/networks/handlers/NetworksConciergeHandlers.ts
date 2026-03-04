// src/networks/handlers/NetworksConciergeHandlers.ts
import { Request, Response, NextFunction } from "express";
import { NetworkListing } from "../../models/Listings";
import { ConciergeRequest } from "../../models/ConciergeRequest";
import { ApiResponse } from "../../types";
import {
  NotFoundError,
  ValidationError,
  MissingUserContextError,
  DatabaseError,
} from "../../utils/errors";
import { ConciergeRequestInput } from "../../validation/schemas";
import logger from "../../utils/logger";
import { Notification } from "../../models/Notification";

/**
 * Request concierge service for a listing
 * POST /api/v1/networks/listings/:id/concierge
 */
export const networks_concierge_request_create = async (
  req: Request<ConciergeRequestInput["params"], {}, ConciergeRequestInput["body"]>,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!(req as any).user) {
      throw new MissingUserContextError();
    }

    const { id: listingId } = req.params;
    const { message } = req.body;
    const buyerId = (req as any).user.dialist_id;

    const listing = await NetworkListing.findById(listingId);
    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    // Basic requirements: listing must be active and not owned by buyer
    if (listing.status !== "active") {
      throw new ValidationError("Concierge service only available for active listings");
    }

    if (String(listing.dialist_id) === String(buyerId)) {
      throw new ValidationError("Cannot request concierge for your own listing");
    }

    // Check for existing pending request
    const existing = await ConciergeRequest.findOne({
      listing_id: listingId,
      buyer_id: buyerId,
      status: "pending",
    });

    if (existing) {
      throw new ValidationError("A concierge request is already pending for this listing");
    }

    const conciergeRequest = await ConciergeRequest.create({
      listing_id: listingId,
      buyer_id: buyerId,
      message,
    });

    // Notify seller that a buyer is interested in concierge service (optional, but good for UX)
    // Actually, usually concierge is between Buyer and Platform.
    // However, the seller should know if their item is being authenticated.
    
    logger.info("Concierge request created", {
      requestId: conciergeRequest._id,
      listingId,
      buyerId,
    });

    res.status(201).json({
      data: conciergeRequest.toJSON(),
      requestId: req.headers["x-request-id"] as string,
      message: "Concierge request submitted successfully",
    });
  } catch (err: any) {
    console.error("Error creating concierge request:", err);
    if (
      err instanceof NotFoundError ||
      err instanceof ValidationError ||
      err instanceof MissingUserContextError
    ) {
      next(err);
    } else {
      next(new DatabaseError("Failed to create concierge request", err));
    }
  }
};
