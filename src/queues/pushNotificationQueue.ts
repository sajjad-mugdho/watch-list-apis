import Queue from "bull";
import { config } from "../config";

export interface PushNotificationJob {
  userId: string;
  notificationId: string;
  title: string;
  body?: string;
  data?: Record<string, any>;
  actionUrl?: string;
}

const pushNotificationQueue = new Queue<PushNotificationJob>(
  "push-notifications",
  config.redisUrl,
  {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  }
);

export default pushNotificationQueue;

export const closePushNotificationQueue = async () => {
    await pushNotificationQueue.close();
    console.log("✅ [Queue] Push notification queue closed successfully");
};
