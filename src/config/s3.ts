import { S3Client } from "@aws-sdk/client-s3";
import { config } from "./index";

/**
 * AWS S3 Client Configuration
 *
 * Singleton pattern for S3 client to reuse connections
 * and improve performance across the application
 */
class S3ClientManager {
  private static instance: S3Client | null = null;

  /**
   * Get or create S3 client instance
   */
  static getClient(): S3Client {
    if (!this.instance) {
      if (
        !config.aws.region ||
        !config.aws.accessKeyId ||
        !config.aws.secretAccessKey
      ) {
        throw new Error(
          "AWS credentials not configured. Check AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
        );
      }

      this.instance = new S3Client({
        region: config.aws.region,
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey,
        },
        // Connection pooling and retry configuration
        maxAttempts: 3,
        requestHandler: {
          connectionTimeout: 5000,
          socketTimeout: 30000,
        },
      });
    }
    return this.instance;
  }

  /**
   * Destroy client instance (for testing or cleanup)
   */
  static destroyClient(): void {
    if (this.instance) {
      this.instance.destroy();
      this.instance = null;
    }
  }
}

export const s3Client = S3ClientManager.getClient();
export { S3ClientManager };
