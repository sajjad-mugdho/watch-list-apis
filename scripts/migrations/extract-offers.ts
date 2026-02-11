/**
 * Migration: Extract Embedded Offers to Standalone Collections
 *
 * Extracts embedded offers from MarketplaceListingChannel.last_offer / offer_history
 * and NetworkListingChannel.last_offer / offer_history into standalone Offer +
 * OfferRevision documents.
 *
 * Run:  npx ts-node scripts/migrations/extract-offers.ts
 * Flags:
 *   --dry-run     Preview without writing (default)
 *   --execute     Actually write to DB
 *   --batch=500   Batch size (default 500)
 *
 * Status mapping (embedded → standalone):
 *   sent       → CREATED
 *   accepted   → ACCEPTED
 *   declined   → DECLINED
 *   superseded → COUNTERED  (previous revision)
 *   expired    → EXPIRED
 */

import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
// CLI Flags
// ============================================================
const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--execute");
const BATCH_SIZE = parseInt(
  args.find((a) => a.startsWith("--batch="))?.split("=")[1] || "500",
  10
);

console.log(`\n=== Extract Offers Migration ===`);
console.log(`Mode: ${DRY_RUN ? "DRY RUN (use --execute to write)" : "EXECUTE"}`);
console.log(`Batch size: ${BATCH_SIZE}\n`);

// ============================================================
// Minimal Schema Definitions (avoid importing full app models)
// ============================================================

// Embedded offer shape from channels
interface EmbeddedOffer {
  _id?: Types.ObjectId;
  sender_id: Types.ObjectId;
  amount: number;
  message?: string | null;
  offer_type: "initial" | "counter";
  status: "sent" | "accepted" | "declined" | "superseded" | "expired";
  expiresAt?: Date;
  createdAt: Date;
}

interface ChannelDoc {
  _id: Types.ObjectId;
  listing_id: Types.ObjectId;
  buyer_id: Types.ObjectId;
  seller_id: Types.ObjectId;
  getstream_channel_id?: string;
  last_offer: EmbeddedOffer | null;
  offer_history: EmbeddedOffer[];
}

// Status mapping: embedded → standalone
const STATUS_MAP: Record<string, string> = {
  sent: "CREATED",
  accepted: "ACCEPTED",
  declined: "DECLINED",
  superseded: "COUNTERED",
  expired: "EXPIRED",
};

// ============================================================
// Migration Logic
// ============================================================
async function migrate() {
  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    console.error("ERROR: MONGODB_URI or DATABASE_URL env var required");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  if (!db) {
    console.error("ERROR: MongoDB connection DB object is undefined. Ensure connect() succeeded.");
    await mongoose.disconnect();
    process.exit(1);
  }
  const offersCol = db.collection("offers");
  const revisionsCol = db.collection("offer_revisions");

  const stats = {
    channelsProcessed: 0,
    offersCreated: 0,
    revisionsCreated: 0,
    skipped: 0,
    errors: 0,
  };

  // Process both channel collections
  for (const collectionName of [
    "marketplace_listing_channels",
    "network_listing_channels",
  ]) {
    const platform = collectionName.includes("marketplace")
      ? "marketplace"
      : "networks";

    console.log(`\nProcessing ${collectionName} (${platform})...`);

    const channelCol = db.collection(collectionName);
    const totalCount = await channelCol.countDocuments({
      $or: [
        { last_offer: { $ne: null } },
        { "offer_history.0": { $exists: true } },
      ],
    });

    console.log(`  Found ${totalCount} channels with offers`);

    let processed = 0;
    const cursor = channelCol
      .find({
        $or: [
          { last_offer: { $ne: null } },
          { "offer_history.0": { $exists: true } },
        ],
      })
      .batchSize(BATCH_SIZE);

    while (await cursor.hasNext()) {
      const channel = (await cursor.next()) as unknown as ChannelDoc;
      if (!channel) continue;

      try {
        // Collect all embedded offers: offer_history + last_offer
        const allEmbedded: EmbeddedOffer[] = [
          ...(channel.offer_history || []),
        ];
        if (channel.last_offer) {
          allEmbedded.push(channel.last_offer);
        }

        if (allEmbedded.length === 0) {
          stats.skipped++;
          continue;
        }

        // Sort chronologically
        allEmbedded.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // Determine buyer/seller: the first "initial" offer sender is the buyer
        const firstInitial = allEmbedded.find(
          (o) => o.offer_type === "initial"
        );
        const buyerId = firstInitial?.sender_id || channel.buyer_id;
        const sellerId = channel.seller_id;

        // Create one standalone Offer per channel
        const lastEmbedded = allEmbedded[allEmbedded.length - 1];
        const standaloneState = STATUS_MAP[lastEmbedded.status] || "CREATED";

        const offerId = new Types.ObjectId();
        const offerDoc = {
          _id: offerId,
          listing_id: channel.listing_id,
          channel_id: channel._id,
          buyer_id: buyerId,
          seller_id: sellerId,
          platform,
          getstream_channel_id: channel.getstream_channel_id || "",
          state: standaloneState,
          active_revision_id: null as Types.ObjectId | null,
          expires_at:
            lastEmbedded.expiresAt ||
            new Date(
              new Date(lastEmbedded.createdAt).getTime() + 48 * 60 * 60 * 1000
            ),
          listing_snapshot: {}, // Will be populated if listing exists
          version: 1,
          createdAt: new Date(allEmbedded[0].createdAt),
          updatedAt: new Date(lastEmbedded.createdAt),
          _migrated_from: collectionName, // Track migration origin
        };

        // Create one OfferRevision per embedded offer
        const revisionDocs = allEmbedded.map((embedded, idx) => {
          const revId = new Types.ObjectId();
          if (idx === allEmbedded.length - 1) {
            offerDoc.active_revision_id = revId;
          }
          return {
            _id: revId,
            offer_id: offerId,
            amount: embedded.amount,
            currency: "USD",
            note: embedded.message || undefined,
            created_by: embedded.sender_id,
            revision_number: idx + 1,
            createdAt: new Date(embedded.createdAt),
            _migrated: true,
          };
        });

        if (!DRY_RUN) {
          await offersCol.insertOne(offerDoc as any);
          if (revisionDocs.length > 0) {
            await revisionsCol.insertMany(revisionDocs as any[]);
          }
        }

        stats.offersCreated++;
        stats.revisionsCreated += revisionDocs.length;
        stats.channelsProcessed++;

        processed++;
        if (processed % 100 === 0) {
          console.log(`  Processed ${processed}/${totalCount} channels...`);
        }
      } catch (error: any) {
        // Skip duplicates (if offer already migrated)
        if (error.code === 11000) {
          stats.skipped++;
          continue;
        }
        stats.errors++;
        console.error(`  Error processing channel ${channel._id}:`, error.message);
      }
    }

    await cursor.close();
    console.log(`  Done processing ${collectionName}: ${processed} channels`);
  }

  // ============================================================
  // Summary
  // ============================================================
  console.log("\n=== Migration Summary ===");
  console.log(`Mode:                ${DRY_RUN ? "DRY RUN" : "EXECUTED"}`);
  console.log(`Channels processed:  ${stats.channelsProcessed}`);
  console.log(`Offers created:      ${stats.offersCreated}`);
  console.log(`Revisions created:   ${stats.revisionsCreated}`);
  console.log(`Skipped:             ${stats.skipped}`);
  console.log(`Errors:              ${stats.errors}`);

  if (DRY_RUN) {
    console.log("\nRun with --execute to perform the actual migration.");
  }

  await mongoose.disconnect();
  console.log("\nDisconnected from MongoDB.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
