#!/usr/bin/env node
/*
  Init script for MongoDB: connects, imports models and syncs indexes.
  Usage:
    # via npx (recommended, ts-node-dev is in devDependencies):
    npx ts-node-dev --respawn scripts/init-db.ts

    # or provide MONGODB_URI in .env and run the same command
*/
import "dotenv/config";
import mongoose from "mongoose";

// Import models so mongoose registers them. These files are TypeScript, so run via ts-node.
import "../src/models/User";
import "../src/models/Listings";
import "../src/models/Watches";
import "../src/models/ListingChannel";

// After importing the modules, fetch the models from mongoose
const NetworkListing = mongoose.model("NetworkListing");
const MarketplaceListing = mongoose.model("MarketplaceListing");
const User = mongoose.model("User");
const Watch = mongoose.model("Watch");
const NetworkListingChannel = mongoose.model("NetworkListingChannel");

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI || process.argv[2];
  if (!uri) {
    console.error(
      "MONGODB_URI is required. Set it in .env or pass as first arg"
    );
    process.exit(1);
  }

  console.log("Connecting to MongoDB:", uri);
  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DBNAME || "dialist_development",
  });
  console.log("Connected. Syncing indexes for models...");

  const models = [
    { name: "users", m: User },
    { name: "network_listings", m: NetworkListing },
    { name: "marketplace_listings", m: MarketplaceListing },
    { name: "network_listing_channels", m: NetworkListingChannel },
    { name: "watches", m: Watch },
  ];

  for (const entry of models) {
    try {
      // syncIndexes will create any missing indexes and remove those that are not defined in the schema
      const res = await entry.m.syncIndexes();
      console.log(`- ${entry.name}:`, res);
    } catch (err) {
      console.error(`Error syncing indexes for ${entry.name}:`, err);
    }
  }

  console.log("Index sync complete. Closing connection.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Init DB script failed:", err);
  process.exit(1);
});
