
import "dotenv/config";
import mongoose from "mongoose";
import { events } from "../src/utils/events";
import { registerEventHandlers } from "../src/bootstrap/eventHandlers";
import { Notification } from "../src/models/Notification";
import { User } from "../src/models/User";


// Mock notification service dependencies if needed, but we want real DB write
// We need to connect to DB first

async function testNotifications() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI required");
    process.exit(1);
  }

  console.log("Connecting to DB...");
  await mongoose.connect(uri, { dbName: "dialist_development" });

  // Register handlers
  registerEventHandlers();

  // Find a test user or create one
  let user = await User.findOne({ email: "test_notify@example.com" });
  if (!user) {
    user = await User.create({
      external_id: "test_notify_user",
      email: "test_notify@example.com",
      first_name: "Test",
      last_name: "User",
      onboarding_status: "completed"
    });
  }
  const userId = user._id.toString();
  console.log(`Using test user: ${userId}`);

  // Test 1: Welcome Notification
  console.log("Triggering user:registered event...");
  events.emit("user:registered", {
    userId,
    firstName: "Test",
    email: "test_notify@example.com"
  });

  // Wait a bit for async handler
  await new Promise(r => setTimeout(r, 1000));

  // Check DB
  let notif = await Notification.findOne({
    user_id: user._id,
    type: "welcome"
  }).sort({ createdAt: -1 });

  if (notif) {
    console.log("✅ Welcome notification created:", notif.title);
  } else {
    console.error("❌ Welcome notification NOT found");
  }

  // Test 2: Onboarding Complete
  console.log("Triggering user:onboarding_complete event...");
  events.emit("user:onboarding_complete", {
    userId
  });

  await new Promise(r => setTimeout(r, 1000));

  notif = await Notification.findOne({
    user_id: user._id,
    type: "onboarding_complete"
  }).sort({ createdAt: -1 });

  if (notif) {
    console.log("✅ Onboarding notification created:", notif.title);
  } else {
    console.error("❌ Onboarding notification NOT found");
  }

  await mongoose.disconnect();
}

testNotifications().catch(console.error);
