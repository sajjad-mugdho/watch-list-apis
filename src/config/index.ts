import dotenv from "dotenv";
dotenv.config();

interface Config {
  port: number;
  mongoUri: string;
  nodeEnv: string;

  finixWebhookPassword: string;
  finixWebhookUsername: string;
  finixWebhookSecret: string;

  finixVersion: string;

  finixUsername: string;
  finixPassword: string;
  finixBaseUrl: string;
  finixUsApplicationId: string; // US application ID
  finixCaApplicationId: string; // Canada application ID

  clerkPublishableKey: string;
  clerkSecretKey: string;
  clerkWebhookSigningSecret: string;

  featureClerkMutations: boolean; // parsed strictly from 0|1

  // Optional with defaults
  redisUrl: string;
  sentryDsn?: string;
  logLevel: string;
  appUrl: string; // For Finix callbacks

  getstreamApiKey: string;
  getstreamApiSecret: string;
  getstreamAppId: string;

  // AWS S3 Configuration
  aws: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    s3Bucket: string;
    cloudFrontDomain?: string; // Optional CDN domain
  };
}

const requiredEnvVars = [
  "MONGODB_URI",
  "FINIX_WEBHOOK_USERNAME",
  "FINIX_WEBHOOK_PASSWORD",

  "FINIX_USERNAME",
  "FINIX_PASSWORD",
  "FINIX_BASE_URL",
  "FINIX_US_APPLICATION_ID", // US Finix application
  "FINIX_CA_APPLICATION_ID", // Canada Finix application
  "FINIX_VERSION",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",

  "FEATURE_CLERK_MUTATIONS",
  "GETSTREAM_API_KEY",
  "GETSTREAM_API_SECRET",
  "GETSTREAM_APP_ID",

  // AWS S3 Required Variables
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_S3_BUCKET",
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Validate and parse PORT
const port = parseInt(process.env.PORT || "3000", 10);
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(
    `Invalid PORT value: ${process.env.PORT}. Must be a number between 1 and 65535.`
  );
  process.exit(1);
}

function parseFeatureFlag(value: string | undefined, key: string): boolean {
  if (value !== "0" && value !== "1") {
    console.error(
      `Invalid ${key} value: "${value}". Must be either "0" or "1".`
    );
    process.exit(1);
  }
  const enabled = value === "1";
  console.log(
    `🔧 Feature flag: ${key} = ${enabled ? "ENABLED ✅" : "DISABLED 🚫"}`
  );
  return enabled;
}

export const config: Config = {
  port,
  mongoUri: process.env.MONGODB_URI!,
  nodeEnv: process.env.NODE_ENV || "development",

  finixWebhookPassword: process.env.FINIX_WEBHOOK_PASSWORD!,
  finixWebhookUsername: process.env.FINIX_WEBHOOK_USERNAME!,
  finixWebhookSecret: process.env.FINIX_WEBHOOK_SECRET || "",

  finixVersion: process.env.FINIX_VERSION!,
  finixUsername: process.env.FINIX_USERNAME!,
  finixPassword: process.env.FINIX_PASSWORD!,
  finixBaseUrl: process.env.FINIX_BASE_URL!,
  finixUsApplicationId: process.env.FINIX_US_APPLICATION_ID!,
  finixCaApplicationId: process.env.FINIX_CA_APPLICATION_ID!,

  clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
  clerkSecretKey: process.env.CLERK_SECRET_KEY!,
  clerkWebhookSigningSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET!,

  featureClerkMutations: parseFeatureFlag(
    process.env.FEATURE_CLERK_MUTATIONS,
    "FEATURE_CLERK_MUTATIONS"
  ),

  // Optional with defaults
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  ...(process.env.SENTRY_DSN ? { sentryDsn: process.env.SENTRY_DSN } : {}),
  logLevel: process.env.LOG_LEVEL || "info",
  appUrl: process.env.APP_URL || "http://localhost:3000",

  getstreamApiKey: process.env.GETSTREAM_API_KEY!,
  getstreamApiSecret: process.env.GETSTREAM_API_SECRET!,
  getstreamAppId: process.env.GETSTREAM_APP_ID!,

  // AWS S3 Configuration
  aws: {
    region: process.env.AWS_REGION!,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    s3Bucket: process.env.AWS_S3_BUCKET!,
    ...(process.env.AWS_CLOUDFRONT_DOMAIN
      ? { cloudFrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN }
      : {}),
  },
};

console.log("Configuration validated successfully");
