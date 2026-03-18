import { User } from "../models/User";
import { clerkClient } from "@clerk/express";
import { DatabaseError, ValidationError } from "../utils/errors";
import { NextFunction, Request, Response } from "express";
import logger from "../utils/logger";
import { config } from "../config";
import { webhookLogger } from "../utils/logger";
import { events } from "../utils/events";
import { Connection } from "../networks/models/Connection";
import { Block } from "../networks/models/Block";
import { Webhook } from "svix";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export interface ClerkUserData {
  email: string;
  id: string;
  first_name: string;
  last_name: string;
}

// ----------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------

export function ExtractClerkUserData(data: any): ClerkUserData | null {
  try {
    if (!data || !data.id || !data.email_addresses?.[0]?.email_address)
      return null;

    return {
      id: data.id,
      email: data.email_addresses[0].email_address,
      first_name: data.first_name || "",
      last_name: data.last_name || "",
    };
  } catch (e) {
    return null;
  }
}

/**
 * Create user in database and optionally sync metadata back to Clerk
 * Returns the created user for downstream event emission
 */
async function createUserFromClerkData(
  clerkUser: ClerkUserData,
): Promise<{ userId: string; firstName: string }> {
  let newUser;
  try {
    newUser = await User.findOneAndUpdate(
      { external_id: clerkUser.id },
      {
        email: clerkUser.email,
        first_name: clerkUser.first_name,
        last_name: clerkUser.last_name,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    // TypeScript check
    if (!newUser) {
      throw new Error("Upsert failed to return a user document");
    }
  } catch (err) {
    throw new DatabaseError("Failed to create user", err);
  }

  // FEATURE_FLAG
  if (config.featureClerkMutations) {
    try {
      await clerkClient.users.updateUserMetadata(clerkUser.id, {
        publicMetadata: { dialist_id: newUser._id },
      });
    } catch (err) {
      throw new DatabaseError("Failed to update Clerk user metadata", err);
    }
  } else {
    webhookLogger.info(
      "[webhooks/clerk] Mutations disabled; skipped updateUserMetadata.",
      { userId: clerkUser.id, dialistId: newUser._id },
    );
  }

  return {
    userId: newUser._id.toString(),
    firstName: clerkUser.first_name,
  };
}

// ----------------------------------------------------------
// Handler Functions
// ----------------------------------------------------------

/**
 * Verify Clerk webhook signature using Svix
 */
function verifyClerkWebhookSignature(req: Request): any {
  const signature = req.headers["svix-signature"] as string;
  const rawBody = (req as any).rawBody as string;

  if (!signature || !rawBody) {
    webhookLogger.warn("[Clerk] Missing webhook signature or body", {
      hasSignature: !!signature,
      hasRawBody: !!rawBody,
    });
    return null;
  }

  try {
    const wh = new Webhook(config.clerkWebhookSigningSecret);
    const evt = wh.verify(rawBody, {
      "svix-id": req.headers["svix-id"] as string,
      "svix-signature": signature,
      "svix-timestamp": req.headers["svix-timestamp"] as string,
    }) as any;

    webhookLogger.info("[Clerk] Webhook signature verified successfully", {
      eventType: evt.type,
      msgId: req.headers["svix-id"],
    });

    return evt;
  } catch (err) {
    webhookLogger.warn("[Clerk] Webhook signature verification failed", {
      error: (err as Error).message,
      signature: signature.substring(0, 30),
    });
    return null;
  }
}

/**
 * Handle Clerk webhook events
 * POST /api/v1/webhooks/clerk
 */
export const webhook_clerk_post = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Verify signature and get event
    const evt = verifyClerkWebhookSignature(req);
    if (!evt) {
      throw new ValidationError("Invalid webhook signature");
    }

    const eventType = evt.type as string;

    switch (eventType) {
      case "user.created": {
        const user = ExtractClerkUserData(evt.data);
        if (!user) {
          throw new ValidationError(
            "Invalid Clerk user data in webhook payload",
          );
        }

        // Create user and get their ID for notifications
        const newUserData = await createUserFromClerkData(user);

        // Emit welcome event to trigger notification
        events.emit("user:registered", {
          userId: newUserData.userId,
          email: user.email,
          firstName: newUserData.firstName,
        });

        webhookLogger.info(
          "[webhooks/clerk] User created and welcome event emitted",
          {
            userId: newUserData.userId,
          },
        );
        break;
      }

      case "user.updated": {
        const user = ExtractClerkUserData(evt.data);
        if (!user) {
          throw new ValidationError(
            "Invalid Clerk user data in webhook payload",
          );
        }

        try {
          const updatedUser = await User.findOneAndUpdate(
            { external_id: user.id },
            {
              email: user.email,
              first_name: user.first_name,
              last_name: user.last_name,
            },
            { new: true },
          );

          if (!updatedUser) {
            webhookLogger.warn("Received user.updated for unknown user", {
              clerkId: user.id,
            });
          } else {
            webhookLogger.info("[webhooks/clerk] User updated", {
              userId: updatedUser._id,
            });
          }
        } catch (err) {
          throw new DatabaseError("Failed to update user", err);
        }
        break;
      }

      case "user.deleted": {
        const userId = evt.data.id as string;
        if (!userId) {
          throw new ValidationError("Missing user id in user.deleted payload");
        }

        try {
          const user = await User.findOne({ external_id: userId }).select(
            "_id",
          );

          if (!user) {
            webhookLogger.warn("Received user.deleted for unknown user", {
              clerkId: userId,
            });
          } else {
            const [removedConnections, removedBlocks] = await Promise.all([
              Connection.deleteMany({
                $or: [{ follower_id: user._id }, { following_id: user._id }],
              }),
              Block.deleteMany({
                $or: [{ blocker_id: user._id }, { blocked_id: user._id }],
              }),
            ]);

            await User.findByIdAndDelete(user._id);

            webhookLogger.info("[webhooks/clerk] User deleted", {
              userId: user._id,
              deletedConnectionRecords: removedConnections.deletedCount,
              deletedBlockRecords: removedBlocks.deletedCount,
            });
          }
        } catch (err) {
          throw new DatabaseError("Failed to delete user", err);
        }
        break;
      }

      default: {
        logger.warn(`Unhandled Clerk webhook event type: ${eventType}`);
        // Not an error, we just acknowledge
        break;
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    // Match listings style: convert to typed errors and bubble to centralized error middleware
    if (err instanceof ValidationError || err instanceof DatabaseError) {
      return next(err);
    }

    // If verifyWebhook failed or anything else unexpected:
    logger.error("Clerk webhook handler error", { error: err });
    return next(new ValidationError("Invalid webhook", err));
  }
};
