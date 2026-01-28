/**
 * Migration: Categorize Existing Watches
 * 
 * This script categorizes the existing 2k+ watch entries based on brand/model patterns.
 * Run with: npx ts-node scripts/migrations/categorize-watches.ts
 * 
 * Categories: Luxury, Sport, Dress, Vintage, Casual, Dive, Pilot, Uncategorized
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Brand/model patterns for categorization
const CATEGORY_PATTERNS: Record<string, { brands: string[]; models: string[] }> = {
  Luxury: {
    brands: [
      "patek philippe", "audemars piguet", "vacheron constantin", "a. lange & söhne",
      "jaeger-lecoultre", "blancpain", "breguet", "cartier", "piaget", "harry winston",
      "richard mille", "roger dubuis", "fp journe", "mb&f", "greubel forsey"
    ],
    models: ["royal oak", "nautilus", "overseas", "calatrava", "grand complication"]
  },
  Sport: {
    brands: ["hublot", "tag heuer", "zenith", "chopard"],
    models: [
      "daytona", "submariner", "gmt-master", "speedmaster", "seamaster", "aquanaut",
      "big bang", "monaco", "carrera", "formula 1", "el primero", "chronomat"
    ]
  },
  Dive: {
    brands: [],
    models: [
      "submariner", "sea-dweller", "seamaster", "superocean", "pelagos", "fifty fathoms",
      "aquis", "promaster", "skx", "turtle", "heritage diver"
    ]
  },
  Pilot: {
    brands: ["iwc", "breitling", "zenith", "bell & ross"],
    models: [
      "pilot", "flieger", "navitimer", "avenger", "mark", "top gun", "big pilot",
      "type xx", "khaki aviation", "cockpit"
    ]
  },
  Dress: {
    brands: ["jaeger-lecoultre", "blancpain", "piaget", "lange", "baume & mercier"],
    models: [
      "reverso", "master", "patrimony", "saxonia", "portofino", "classique",
      "calatrava", "altiplano", "villeret", "tradition"
    ]
  },
  Vintage: {
    brands: [],
    models: [
      "vintage", "heritage", "tribute", "reissue", "1969", "1970", "1960",
      "gilt", "tropical", "patina"
    ]
  },
  Casual: {
    brands: ["seiko", "citizen", "orient", "tissot", "hamilton", "swatch", "casio", "timex"],
    models: ["presage", "cocktail", "bambino", "prx", "khaki field", "system51"]
  }
};

interface WatchDoc {
  _id: mongoose.Types.ObjectId;
  brand?: string;
  model?: string;
  category?: string;
}

async function categorizeWatch(watch: WatchDoc): Promise<string> {
  const brand = (watch.brand || "").toLowerCase();
  const model = (watch.model || "").toLowerCase();
  const combined = `${brand} ${model}`;

  // Check each category's patterns
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    // Check brand matches
    if (patterns.brands.some((b) => brand.includes(b))) {
      return category;
    }
    // Check model matches
    if (patterns.models.some((m) => combined.includes(m))) {
      return category;
    }
  }

  return "Uncategorized";
}

async function run(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("Connected.");

  const Watch = mongoose.connection.collection("watches");

  // Count total
  const total = await Watch.countDocuments();
  console.log(`Found ${total} watches to process.`);

  // Get watches without category or with Uncategorized
  const cursor = Watch.find({
    $or: [
      { category: { $exists: false } },
      { category: null },
      { category: "Uncategorized" }
    ]
  });

  const stats: Record<string, number> = {};
  let processed = 0;
  let updated = 0;

  for await (const watch of cursor) {
    const category = await categorizeWatch(watch as WatchDoc);
    
    if (category !== "Uncategorized") {
      await Watch.updateOne(
        { _id: watch._id },
        { $set: { category } }
      );
      updated++;
    }

    stats[category] = (stats[category] || 0) + 1;
    processed++;

    if (processed % 100 === 0) {
      console.log(`Processed ${processed}/${total} watches...`);
    }
  }

  console.log("\n=== Migration Complete ===");
  console.log(`Total processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log("\nCategory distribution:");
  for (const [cat, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
