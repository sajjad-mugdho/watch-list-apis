import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

// Add colors to winston
winston.addColors(colors);

// Define the format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define which transports the logger must use
const transports = [
  // Console transport for development
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || "debug",
    format,
  }),

  // Error log file
  new DailyRotateFile({
    filename: path.join(process.cwd(), "logs", "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    level: "error",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    maxSize: "20m",
    maxFiles: "14d",
  }),

  // Combined log file
  new DailyRotateFile({
    filename: path.join(process.cwd(), "logs", "combined-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxSize: "20m",
    maxFiles: "14d",
  }),

  // Finix-specific log file
  new DailyRotateFile({
    filename: path.join(process.cwd(), "logs", "finix-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxSize: "20m",
    maxFiles: "14d",
  }),

  // Webhook-specific log file
  new DailyRotateFile({
    filename: path.join(process.cwd(), "logs", "webhooks-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxSize: "20m",
    maxFiles: "14d",
  }),
];

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  levels,
  format,
  transports,
});

// Create child loggers for specific modules
export const finixLogger = logger.child({ module: "finix" });
export const webhookLogger = logger.child({ module: "webhook" });
export const merchantLogger = logger.child({ module: "merchant" });
export const userLogger = logger.child({ module: "user" });
export const dbLogger = logger.child({ module: "database" });
export const apiLogger = logger.child({ module: "api" });

// Export the main logger
export default logger;

// Helper functions for structured logging
export const logRequest = (req: any, res: any, next: any) => {
  const start = Date.now();

  // Log request
  apiLogger.info(`📨 ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
    userId: req.user?.dialist_id,
    requestId: req.headers["x-request-id"],
  });

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? "warn" : "info";
    const emoji = res.statusCode >= 400 ? "❌" : "✅";

    apiLogger.log(
      level,
      `${emoji} ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
      {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        userId: req.user?.dialist_id,
        requestId: req.headers["x-request-id"],
      }
    );
  });

  next();
};

// Helper for logging webhook events
export const logWebhookEvent = (
  eventType: string,
  eventId: string,
  data: any,
  userId?: string
) => {
  webhookLogger.info(`📥 Webhook received: ${eventType}`, {
    eventType,
    eventId,
    userId,
    data,
    timestamp: new Date().toISOString(),
  });
};

// Helper for logging Finix API calls
export const logFinixApiCall = (
  method: string,
  endpoint: string,
  statusCode?: number,
  error?: any
) => {
  const level = error || (statusCode && statusCode >= 400) ? "error" : "info";
  const emoji = error || (statusCode && statusCode >= 400) ? "❌" : "✅";

  finixLogger.log(level, `${emoji} Finix API: ${method} ${endpoint}`, {
    method,
    endpoint,
    statusCode,
    error: error?.message,
    timestamp: new Date().toISOString(),
  });
};

// Helper for logging merchant operations
export const logMerchantOperation = (
  operation: string,
  userId: string,
  merchantId?: string,
  data?: any
) => {
  merchantLogger.info(`🏪 Merchant ${operation}`, {
    operation,
    userId,
    merchantId,
    data,
    timestamp: new Date().toISOString(),
  });
};

// Helper for logging user operations
export const logUserOperation = (
  operation: string,
  userId: string,
  data?: any
) => {
  userLogger.info(`👤 User ${operation}`, {
    operation,
    userId,
    data,
    timestamp: new Date().toISOString(),
  });
};

// Helper for logging database operations
export const logDatabaseOperation = (
  operation: string,
  collection: string,
  query?: any,
  error?: any
) => {
  const level = error ? "error" : "debug";
  dbLogger.log(level, `🗄️ DB ${operation}: ${collection}`, {
    operation,
    collection,
    query,
    error: error?.message,
    timestamp: new Date().toISOString(),
  });
};
