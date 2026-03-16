import { User } from "../models/User";
import { verifyWebhook } from "@clerk/express/webhooks";
import { clerkClient } from "@clerk/express";
import { DatabaseError, ValidationError } from "../utils/errors";
import { NextFunction, Request, Response } from "express";
import logger from "../utils/logger";
import { config } from "../config";
import { webhookLogger } from "../utils/logger";
import { events } from "../utils/events";

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
 * Handle Clerk webhook events
 * POST /api/v1/webhooks/clerk
 */
export const webhook_clerk_post = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const evt = await verifyWebhook(req as any, {
      signingSecret: config.clerkWebhookSigningSecret,
    });

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
          const deletedUser = await User.findOneAndDelete({
            external_id: userId,
          });
          if (!deletedUser) {
            webhookLogger.warn("Received user.deleted for unknown user", {
              clerkId: userId,
            });
          } else {
            webhookLogger.info("[webhooks/clerk] User deleted", {
              userId: deletedUser._id,
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
