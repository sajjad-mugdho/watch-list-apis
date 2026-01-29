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

  let exitCode = 0;

  try {
    logger.info("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    logger.info("Connected.");

    const limit = 100;
    let totalProcessed = 0;
    let lastId: string | null = null;

    const totalUsers = await User.countDocuments();
    logger.info(`Starting drift correction for ${totalUsers} users...`);

    while (true) {
      // Use cursor-based pagination for O(n) performance instead of skip() O(n²)
      const userQuery = lastId 
        ? User.find({ _id: { $gt: lastId } })
        : User.find();
      
      const users: Array<{ _id: mongoose.Types.ObjectId }> = await userQuery
        .select("_id")
        .sort({ _id: 1 })
        .limit(limit)
        .lean();

      if (users.length === 0) {
        break;
      }

      for (const user of users) {
        try {
          await reviewService.recomputeUserStats(String(user._id));
        } catch (err) {
          logger.error(`Failed to recompute stats for user ${user._id}`, { err });
        }
      }

      totalProcessed += users.length;
      lastId = String(users[users.length - 1]._id);
      logger.info(`Processed ${totalProcessed}/${totalUsers} users...`);
    }

    logger.info("Drift correction complete.");
  } catch (err) {
    logger.error("Job failed", { err });
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(exitCode);
  }
}

if (require.main === module) {
  run();
}
