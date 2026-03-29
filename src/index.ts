import { app } from "./app";
import { connectDatabase } from "./database/connection";
import {
  registerEventHandlers,
  startOutboxPublisherOnce,
} from "./bootstrap/eventHandlers";
import { startOfferExpiryJob } from "./jobs/offerExpiryJob";
import { startWebhookWorker } from "./workers/webhookProcessor";
import logger from "./utils/logger";
import { config } from "./config";

const PORT = config.port || 3000;

async function bootstrap() {
  try {
    // 1. Connect to Database
    await connectDatabase();

    // 2. Register Event Handlers
    registerEventHandlers();

    // 3. Start Outbox Publisher (Guarded)
    await startOutboxPublisherOnce();

    // 4. Start Offer Expiry Job
    startOfferExpiryJob();

    // 5. Start Webhook Worker (Bull queue consumer)
    startWebhookWorker();

    // 6. Start HTTP Server
    app.listen(PORT, () => {
      logger.info(`Dialist API Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to bootstrap application", { error });
    process.exit(1);
  }
}

bootstrap();
