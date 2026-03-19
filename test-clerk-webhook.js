#!/usr/bin/env node

/**
 * Generate and send a valid Clerk webhook for testing
 * 
 * Usage:
 *   npm install -g svix   # if not already installed
 *   node test-clerk-webhook.js
 */

const crypto = require("crypto");
const axios = require("axios");

// Get webhook secret from .env
const path = require("path");
const fs = require("fs");
const envPath = path.join(__dirname, ".env");
const envContent = fs.readFileSync(envPath, "utf-8");

// Match only active lines (not commented with #)
const secretMatch = envContent.match(
  /^CLERK_WEBHOOK_SIGNING_SECRET=(.+)$/m
);

if (!secretMatch) {
  console.error("❌ CLERK_WEBHOOK_SIGNING_SECRET not found in .env");
  process.exit(1);
}

const secret = secretMatch[1].trim();
console.log(`📋 Using secret: ${secret.substring(0, 30)}...`);

// Create a test payload
const payload = {
  type: "user.created",
  data: {
    id: "user_test_webhook_" + Date.now(),
    email_addresses: [
      {
        email_address: "test-webhook@example.com",
        id: "idn_test",
        verification: { status: "verified" },
      },
    ],
    first_name: "Webhook",
    last_name: "Test",
    created_at: Date.now(),
    updated_at: Date.now(),
    object: "user",
  },
  type: "user.created",
};

const bodyStr = JSON.stringify(payload);

// Generate Svix-compatible signature
const now = Math.floor(Date.now() / 1000);
const msgId = "msg_" + crypto.randomBytes(8).toString("hex");

// Svix format: {id}.{timestamp}.{body}
const toSign = `${msgId}.${now}.${bodyStr}`;

// Decode secret (remove whsec_ prefix and decode base64)
let secret_key = secret;
if (secret_key.startsWith("whsec_")) {
  secret_key = secret_key.substring(6);
}

const secretBytes = Buffer.from(secret_key, "base64");
const signature = crypto
  .createHmac("sha256", secretBytes)
  .update(toSign)
  .digest("base64");

const svixSignature = `v1,${signature}`;

console.log(`\n🔏 Generated Signature Test:`);
console.log(`  ID: ${msgId}`);
console.log(`  Timestamp: ${now}`);
console.log(`  Signature: ${svixSignature.substring(0, 40)}...`);

// Send webhook
const url = "http://localhost:5050/api/v1/webhooks/clerk";
const headers = {
  "Content-Type": "application/json",
  "svix-id": msgId,
  "svix-timestamp": now.toString(),
  "svix-signature": svixSignature,
};

console.log(`\n📤 Sending webhook to ${url}...\n`);

axios
  .post(url, payload, { headers })
  .then((response) => {
    console.log(`✅ Success (${response.status}):`);
    console.log(JSON.stringify(response.data, null, 2));
  })
  .catch((error) => {
    if (error.response) {
      console.log(`❌ Error (${error.response.status}):`);
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(`❌ Request failed:`, error.message);
    }
  });
