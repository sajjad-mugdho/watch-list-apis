/**
 * Migration script to add watch_snapshot to existing marketplace listings
 * Run this script once after deploying the new schema changes
 *
 * Usage: npx ts-node src/scripts/migrate-marketplace-listings.ts
 */

import mongoose from "mongoose";
import { MarketplaceListing } from "../models/Listings";


const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/dialist";

async function migrateMarketplaceListings() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully\n");

    // Find all marketplace listings without watch_snapshot
    const listingsToMigrate = await MarketplaceListing.find({
      watch_snapshot: { $exists: false },
    });

    console.log(`Found ${listingsToMigrate.length} listings to migrate\n`);

    if (listingsToMigrate.length === 0) {
      console.log("No listings need migration. Exiting.");
      await mongoose.disconnect();
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ listingId: string; error: string }> = [];

    for (const listing of listingsToMigrate) {
      try {
        // Create watch_snapshot from existing embedded watch data
        const watchSnapshot = {
          brand: listing.brand,
          model: listing.model,
          reference: listing.reference,
          diameter: listing.diameter,
          bezel: listing.bezel,
          materials: listing.materials,
          bracelet: listing.bracelet,
          color: listing.color,
        };

        // Validate that required fields exist
        if (
          !watchSnapshot.brand ||
          !watchSnapshot.model ||
          !watchSnapshot.reference ||
          !watchSnapshot.diameter ||
          !watchSnapshot.bezel ||
          !watchSnapshot.materials ||
          !watchSnapshot.bracelet
        ) {
          throw new Error("Missing required watch fields");
        }

        // Update listing with watch_snapshot
        await MarketplaceListing.updateOne(
          { _id: listing._id },
          { $set: { watch_snapshot: watchSnapshot } }
        );

        successCount++;
        console.log(`✓ Migrated listing ${listing._id}`);
      } catch (error: any) {
        errorCount++;
        errors.push({
          listingId: String(listing._id),
          error: error.message,
        });
        console.error(
          `✗ Failed to migrate listing ${listing._id}: ${error.message}`
        );
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("Migration Summary:");
    console.log("=".repeat(60));
    console.log(`Total listings: ${listingsToMigrate.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log("=".repeat(60) + "\n");

    if (errors.length > 0) {
      console.log("Errors:");
      errors.forEach(({ listingId, error }) => {
        console.log(`  - Listing ${listingId}: ${error}`);
      });
      console.log();
    }

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");

    process.exit(errorCount > 0 ? 1 : 0);
  } catch (error) {
    console.error("Migration failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateMarketplaceListings();
}

export { migrateMarketplaceListings };
