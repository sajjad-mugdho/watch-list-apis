import pushNotificationQueue from "../queues/pushNotificationQueue";
import { DeviceToken } from "../models/DeviceToken";
import { Notification } from "../models/Notification";
import logger from "../utils/logger";
// import admin from "firebase-admin"; // TODO: Install firebase-admin
// import apn from "@parse/node-apn"; // TODO: Install @parse/node-apn

pushNotificationQueue.process(async (job) => {
  const { userId, notificationId, title, body } = job.data;
  
  logger.info("Processing push notification", { jobId: job.id, userId });
  
  // Get active tokens for user
  const tokens = await DeviceToken.find({ user_id: userId, is_active: true });
  
  if (tokens.length === 0) {
    logger.debug("No active push tokens for user", { userId });
    return { sent: 0, skipped: true };
  }
  
  const results = { fcm: 0, apns: 0, failed: 0 };
  
  for (const deviceToken of tokens) {
    try {
      if (deviceToken.platform === "android" || deviceToken.platform === "web") {
        // Send via FCM (Placeholder)
        // await sendFCM(deviceToken.token, { title, body, data });
        logger.debug("[MOCK] Sending FCM", { tokenPrefix: deviceToken.token?.slice(0, 8), hasTitle: !!title, hasBody: !!body });
        results.fcm++;
      } else if (deviceToken.platform === "ios") {
        // Send via APNs (Placeholder)
        // await sendAPNs(deviceToken.token, { title, body, data });
        logger.debug("[MOCK] Sending APNs", { tokenPrefix: deviceToken.token?.slice(0, 8), hasTitle: !!title, hasBody: !!body });
        results.apns++;
      }
      
      // Update last_used_at
      await DeviceToken.updateOne(
        { _id: deviceToken._id },
        { last_used_at: new Date() }
      );
    } catch (error: any) {
      results.failed++;
      
      // Handle invalid token
      if (error.code === "messaging/invalid-registration-token" || error.message?.includes("BadDeviceToken")) {
        await DeviceToken.updateOne({ _id: deviceToken._id }, { is_active: false });
        logger.warn("Deactivated invalid push token", { tokenId: deviceToken._id });
      } else {
        logger.error("Push delivery failed", { error: error.message, tokenId: deviceToken._id });
      }
    }
  }
  
  // Mark notification as push_sent in the main Notification collection
  if (results.fcm > 0 || results.apns > 0) {
    await Notification.updateOne(
        { _id: notificationId },
        { push_sent: true, push_sent_at: new Date() }
    );
  }
  
  logger.info("Push notification processing complete", { userId, results });
  return results;
});

export function startPushNotificationWorker(): void {
  logger.info("🔔 Push notification worker started");
}
