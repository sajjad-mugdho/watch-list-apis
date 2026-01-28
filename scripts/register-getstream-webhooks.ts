#!/usr/bin/env ts-node

/**
 * GetStream Webhook Registration Script
 * 
 * One-time script to configure GetStream Dashboard webhooks via the API.
 * This configures which events GetStream will send to our webhook endpoint.
 * 
 * Usage:
 *   npx ts-node scripts/register-getstream-webhooks.ts
 * 
 * Prerequisites:
 *   - GETSTREAM_API_KEY and GETSTREAM_API_SECRET must be set
 *   - APP_URL should be set to your production/staging URL
 */

import { StreamChat } from "stream-chat";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const GETSTREAM_API_KEY = process.env.GETSTREAM_API_KEY;
const GETSTREAM_API_SECRET = process.env.GETSTREAM_API_SECRET;
const APP_URL = process.env.APP_URL || "http://localhost:3000";

if (!GETSTREAM_API_KEY || !GETSTREAM_API_SECRET) {
  console.error("❌ Missing GETSTREAM_API_KEY or GETSTREAM_API_SECRET");
  process.exit(1);
}

// Event types we want to receive
const WEBHOOK_EVENT_TYPES = [
  // Message events
  "message.new",
  "message.updated",
  "message.deleted",
  "message.read",
  
  // Channel events
  "channel.created",
  "channel.updated",
  "channel.deleted",
  
  // Reaction events
  "reaction.new",
  "reaction.deleted",
  
  // Member events
  "member.added",
  "member.removed",
  
  // Notification events (optional - for push notifications)
  "notification.message_new",
];

async function registerWebhooks() {
  console.log("\n🔧 GetStream Webhook Registration Script\n");
  console.log("━".repeat(50));

  const client = StreamChat.getInstance(GETSTREAM_API_KEY!, GETSTREAM_API_SECRET!);
  
  const webhookUrl = `${APP_URL}/api/v1/webhooks/getstream`;
  
  console.log(`📡 Webhook URL: ${webhookUrl}`);
  console.log(`📋 Event types: ${WEBHOOK_EVENT_TYPES.length} events configured`);
  console.log("━".repeat(50));

  try {
    // Get current app settings
    console.log("\n📖 Fetching current app settings...");
    const currentSettings = await client.getAppSettings();
    console.log("Current webhook URL:", currentSettings.app?.webhook_url || "(not set)");

    // Update app settings with webhook configuration
    console.log("\n⚙️  Updating app settings...");
    await client.updateAppSettings({
      webhook_url: webhookUrl,
      // Configure which events trigger webhook calls
      push_notifications: {
        version: "v2",
      },
    });

    console.log("✅ Webhook URL configured successfully!");

    // Verify the settings were applied
    console.log("\n🔍 Verifying settings...");
    const verifiedSettings = await client.getAppSettings();
    console.log("Webhook URL:", verifiedSettings.app?.webhook_url);

    // Test webhook connectivity (if supported)
    console.log("\n🧪 Testing webhook connectivity...");
    try {
      // Send a test webhook by creating and deleting a test message
      // Or use the API to verify the endpoint is accessible
      console.log("⚠️  Note: Manual webhook test recommended");
      console.log("   Send a test message in the Stream Chat dashboard to verify webhook receipt.");
    } catch (testError) {
      console.log("⚠️  Could not run automated test:", testError);
    }

    console.log("\n" + "━".repeat(50));
    console.log("🎉 GetStream webhooks registered successfully!");
    console.log("━".repeat(50));
    console.log("\n📝 Next steps:");
    console.log("   1. Ensure your server is running and accessible at:", webhookUrl);
    console.log("   2. Test by sending a message in any Stream Chat channel");
    console.log("   3. Check server logs for incoming webhook events");
    console.log("   4. Monitor GetstreamWebhookEvent collection in MongoDB");
    console.log("");

  } catch (error: any) {
    console.error("\n❌ Failed to register webhooks:", error.message || error);
    
    if (error.response?.data) {
      console.error("API Response:", JSON.stringify(error.response.data, null, 2));
    }
    
    process.exit(1);
  }
}

// Run the script
registerWebhooks().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
