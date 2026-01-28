import { app } from "./app";
import { config } from "./config";
import { connectDatabase, disconnectDatabase } from "./database/connection";
import { startWebhookWorker } from "./workers/webhookProcessor";
import { startOfferExpiryWorker } from "./workers/offerExpiryProcessor";
import { startPushNotificationWorker } from "./workers/pushNotificationWorker";
import { registerEventHandlers } from "./bootstrap/eventHandlers";
import { closeWebhookQueue } from "./queues/webhookQueue";
import { closeOfferExpiryQueue } from "./queues/offerExpiryQueue";
import { closePushNotificationQueue } from "./queues/pushNotificationQueue";

const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();

    // Register event handlers
    registerEventHandlers();

    // Start workers
    startWebhookWorker();
    startOfferExpiryWorker();
    startPushNotificationWorker();

    // Start server
    const server = app.listen(config.port, () => {
      console.log(
        `Server running on port ${config.port} in ${config.nodeEnv} mode`
      );
      console.log(
        `API Documentation: http://localhost:${config.port}/api-docs`
      );
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      // Set a timeout to force shutdown if graceful shutdown takes too long
      const forceShutdownTimeout = setTimeout(() => {
        console.error("Graceful shutdown timed out, forcing exit...");
        process.exit(1);
      }, 30000); // 30 seconds timeout

      try {
        // Close server and wait for all connections to finish
        await new Promise<void>((resolve, reject) => {
          server.close((err) => {
            if (err) {
              reject(err);
            } else {
              console.log("HTTP server closed");
              resolve();
            }
          });
        });

        // Close queues
        await Promise.all([
          closeWebhookQueue(),
          closeOfferExpiryQueue(),
          closePushNotificationQueue()
        ]);

        // Disconnect from database
        await disconnectDatabase();
        console.log("Graceful shutdown completed");

        clearTimeout(forceShutdownTimeout);
        process.exit(0);
      } catch (error) {
        console.error("Error during shutdown:", error);
        clearTimeout(forceShutdownTimeout);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
