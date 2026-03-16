import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function run(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  const isDryRun = process.argv.includes("--dry-run");

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("Database connection is not available");
  }

  const collections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();
  const names = new Set(collections.map((c) => c.name));

  const hasFollows = names.has("follows");
  const hasConnections = names.has("connections");

  console.log(
    `Found collections: follows=${hasFollows}, connections=${hasConnections}`,
  );

  if (!hasFollows && !hasConnections) {
    console.log(
      "Nothing to migrate: neither follows nor connections collection exists.",
    );
    await mongoose.disconnect();
    return;
  }

  if (hasFollows && hasConnections) {
    throw new Error(
      "Both follows and connections collections exist. Resolve manually before migration.",
    );
  }

  if (!hasFollows && hasConnections) {
    console.log("Migration already applied: using connections collection.");
    await mongoose.disconnect();
    return;
  }

  const followsCount = await db.collection("follows").countDocuments();
  console.log(`follows document count: ${followsCount}`);

  if (isDryRun) {
    console.log("Dry run complete. No changes applied.");
    await mongoose.disconnect();
    return;
  }

  console.log("Renaming follows -> connections...");
  await db.collection("follows").rename("connections");

  const connectionsCount = await db.collection("connections").countDocuments();
  console.log(`connections document count after rename: ${connectionsCount}`);

  if (connectionsCount !== followsCount) {
    throw new Error("Document count mismatch after collection rename.");
  }

  // Ensure expected indexes exist after rename.
  await db
    .collection("connections")
    .createIndex(
      { follower_id: 1, following_id: 1 },
      { unique: true, name: "follower_id_1_following_id_1" },
    );
  await db
    .collection("connections")
    .createIndex({ follower_id: 1 }, { name: "follower_id_1" });
  await db
    .collection("connections")
    .createIndex({ following_id: 1 }, { name: "following_id_1" });
  await db
    .collection("connections")
    .createIndex({ status: 1 }, { name: "status_1" });

  console.log("Migration complete.");
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
