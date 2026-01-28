import express from "express";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import path from "path";
import { apiRoutes } from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import {
  requestId,
  requestLogger,
  notFoundHandler,
  rateLimit,
} from "./middleware/operational";
import { customClerkMw } from "./middleware/customClerkMw";
import { webhooksRoutes } from "./routes/webhooksRoutes";
import { swaggerSpec } from "./config/swagger";
import logger from "./utils/logger";

const app = express();

// Log application startup
logger.info("🚀 Starting Dialist API server", {
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT || 3000,
  timestamp: new Date().toISOString(),
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'", // Required for Tailwind CDN
          "https://cdn.tailwindcss.com",
          "https://js.finix.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"], // Allow inline event handlers
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://js.finix.com",
          "https://*.finixpayments.com",
        ],
        frameSrc: ["'self'", "https://js.finix.com"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// API Documentation (before other middleware to avoid authentication on docs)
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Dialist API Documentation",
    swaggerOptions: {
      persistAuthorization: true,
    },
  })
);

// CORS - Conditional based on environment
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "development"
        ? true // Allow all origins in development
        : process.env.ALLOWED_ORIGINS &&
          process.env.ALLOWED_ORIGINS.trim().length > 0
        ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
        : [
            "http://localhost:3000",
            "http://localhost:3001",
            "https://localhost:3000",
            "https://localhost:3001",
            "http://mackerel-needed-frequently.ngrok-free.app",
            "https://mackerel-needed-frequently.ngrok-free.app",
            "http://unappliable-darcey-projectively.ngrok-free.dev",
            "https://unappliable-darcey-projectively.ngrok-free.dev",
          ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id", "x-refresh-session"],
  })
);

// Operational middleware
app.use(requestId);
app.use(requestLogger);
app.use(rateLimit);

// Webhook routes: preserve raw body for signature verification
app.use(
  "/api/v1/webhooks",
  express.json({
    verify: (req: any, _res, buf) => {
      // Attach raw body for signature verification
      req.rawBody = buf.toString("utf8");
    },
  }),
  webhooksRoutes
);

app.use(
  express.json({
    limit: "1mb",
    strict: true,
    type: "application/json",
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
    parameterLimit: 20,
  })
);

app.disable("x-powered-by");

//app.use(clerkMiddleware());

// Wraps clerkMiddleware so we can conditionally mock
app.use(customClerkMw());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
