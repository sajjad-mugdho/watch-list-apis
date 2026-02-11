/**
 * SqsWebhookConsumer - Polling worker for GetStream webhooks via SQS
 */

import { 
  SQSClient, 
  ReceiveMessageCommand, 
  DeleteMessageCommand,
  Message
} from "@aws-sdk/client-sqs";
import { config } from "../config";
import logger from "../utils/logger";
import { processGetstreamWebhook } from "./webhookProcessor";
import { GetstreamWebhookEvent } from "../models/GetstreamWebhookEvent";
import { WebhookEvent } from "../models/WebhookEvent";

class SqsWebhookConsumer {
  private sqs: SQSClient;
  private queueUrl: string;
  private isRunning: boolean = false;

  constructor() {
    this.sqs = new SQSClient({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    });
    this.queueUrl = config.aws.sqsWebhookUrl;
  }

  /**
   * Start polling SQS
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info("🚀 [Worker] SQS Webhook Consumer started", { queueUrl: this.queueUrl });

    while (this.isRunning) {
      try {
        const response = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20, // Long polling
            AttributeNames: ["All"],
            MessageAttributeNames: ["All"],
          })
        );

        if (response.Messages && response.Messages.length > 0) {
          logger.debug(`📥 Received ${response.Messages.length} messages from SQS`);
          await Promise.all(response.Messages.map(msg => this.handleMessage(msg)));
        }
      } catch (error) {
        logger.error("SQS Polling error", { error });
        // Wait a bit before retrying to avoid tight loop on persistent errors
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.isRunning = false;
    logger.info("🛑 [Worker] SQS Webhook Consumer stopped");
  }

  /**
   * Handle an individual SQS message
   */
  private async handleMessage(message: Message): Promise<void> {
    if (!message.Body) return;

    let event: any;
    let eventId: string;

    try {
      // GetStream webhook payload in SQS
      event = JSON.parse(message.Body);
      
      // GetStream events usually have a unique ID in headers, 
      // but in SQS we might want to use SQS MessageId or GetStream's ID if present.
      // GetStream sends the whole payload.
      eventId = event.id || message.MessageId || `sqs-${Date.now()}`;

      logger.info(`🔄 Processing event ${event.type} from SQS`, { eventId, type: event.type });

      // 1. Idempotency Check (MongoDB/Redis)
      const existing = await GetstreamWebhookEvent.findOne({ eventId });
      if (existing && existing.status === "processed") {
        logger.info("Event already processed, deleting from SQS", { eventId });
        await this.deleteMessage(message);
        return;
      }

      // 2. Track Event
      if (!existing) {
        await GetstreamWebhookEvent.create({
          eventId,
          eventType: event.type,
          payload: event,
          status: "pending",
          receivedAt: new Date(),
          attemptCount: 0,
        });

        await WebhookEvent.create({
          eventId,
          provider: "getstream",
          status: "pending",
        });
      }

      // 3. Process Event
      const result = await processGetstreamWebhook(event.type, event, eventId);
      logger.info("Event processed successfully", { eventId, result });

      // 4. Update status and Delete from SQS
      await GetstreamWebhookEvent.updateOne({ eventId }, { status: "processed", processedAt: new Date() });
      await WebhookEvent.updateOne({ eventId }, { status: "processed" });
      await this.deleteMessage(message);

    } catch (error) {
      logger.error("Failed to handle message from SQS", { 
        messageId: message.MessageId, 
        error 
      });
      // Message will remain in SQS and eventually return to visibility if not deleted
    }
  }

  /**
   * Delete message from SQS after success
   */
  private async deleteMessage(message: Message): Promise<void> {
    try {
      await this.sqs.send(
        new DeleteMessageCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: message.ReceiptHandle!,
        })
      );
    } catch (error) {
      logger.error("Failed to delete message from SQS", { messageId: message.MessageId, error });
    }
  }
}

// Singleton instance
export const sqsWebhookConsumer = new SqsWebhookConsumer();
