import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User";
import { reviewService } from "../services/review/ReviewService";
import logger from "../utils/logger";

dotenv.config();

/**
 * Job: Recalculate User Stats
 * Reason: Corrects drift from atomic incremental updates
 * Schedule: Weekly or Daily off-peak
 */
async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  logger.info("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  logger.info("Connected.");

  const limit = 100;
  let skip = 0;
  let totalProcessed = 0;
  let hasMore = true;

  try {
    const totalUsers = await User.countDocuments();
    logger.info(`Starting drift correction for ${totalUsers} users...`);

    while (hasMore) {
      const users = await User.find().select("_id").skip(skip).limit(limit);

      if (users.length === 0) {
        hasMore = false;
        break;
      }

      await Promise.all(
        users.map(async (user) => {
          try {
            await reviewService.recomputeUserStats(String(user._id));
            // Add a small delay/yield if necessary, but Promise.all is fine for batch of 100
          } catch (err) {
            logger.error(`Failed to recompute stats for user ${user._id}`, { err });
          }
        })
      );

      totalProcessed += users.length;
      skip += limit;
      logger.info(`Processed ${totalProcessed}/${totalUsers} users...`);
    }

    logger.info("Drift correction complete.");
  } catch (err) {
    logger.error("Job failed", { err });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

if (require.main === module) {
  run();
}
