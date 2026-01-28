#!/usr/bin/env node

/**
 * ⚠️ DEV UTILITY - Clear All Reservations
 *
 * This script calls the temporary dev endpoint to clear all active reservations.
 * Useful when testing the order flow repeatedly.
 */

const http = require("http");

const API_URL = process.env.API_URL || "http://localhost:5050";
const endpoint = "/api/v1/marketplace/orders/dev/clear-reservations";

console.log("🧹 Clearing all reservations...");
console.log(`API: ${API_URL}${endpoint}`);
console.log("");

const url = new URL(endpoint, API_URL);

const options = {
  hostname: url.hostname,
  port: url.port || 80,
  path: url.pathname,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
};

const req = http.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log(`Status: ${res.statusCode}`);
    console.log("");

    try {
      const json = JSON.parse(data);
      console.log("Response:");
      console.log(JSON.stringify(json, null, 2));

      if (json.success) {
        console.log("");
        console.log("✅ Success!");
        console.log(`   • ${json.data.listings_cleared} listings cleared`);
        console.log(`   • ${json.data.orders_cancelled} orders cancelled`);
      } else {
        console.log("");
        console.log("❌ Failed!");
      }
    } catch (err) {
      console.log("Response:");
      console.log(data);
    }

    console.log("");
  });
});

req.on("error", (error) => {
  console.error("❌ Error:", error.message);
  console.log("");
  console.log("Make sure the backend is running:");
  console.log("  cd ~/Downloads/dialist-api-main");
  console.log("  npm run dev");
  process.exit(1);
});

req.end();
