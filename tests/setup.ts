/// <reference types="jest" />

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
// Mock uuid before importing anything else
jest.mock("uuid", () => ({
  v4: jest.fn(() => "test-uuid-123"),
}));

// Mock Bull library globally to avoid Redis connection errors
jest.mock("bull", () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    add: jest.fn(),
    process: jest.fn(),
    getJobCounts: jest.fn().mockResolvedValue({}),
    close: jest.fn().mockResolvedValue(undefined),
  }));
});

const mockIoredis: any = {
  on: jest.fn((event: string, cb: any) => {
    if (event === "connect" || event === "ready") {
      setTimeout(cb, 0);
    }
    return mockIoredis;
  }),
  set: jest.fn().mockResolvedValue("OK"),
  setex: jest.fn().mockResolvedValue("OK"),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  scan: jest.fn().mockResolvedValue(["0", []]),
  quit: jest.fn().mockResolvedValue("OK"),
  disconnect: jest.fn().mockResolvedValue(undefined),
};

// Mock ioredis globally
jest.mock("ioredis", () => {
  return jest.fn(() => mockIoredis);
});

// Mock Clerk globally to avoid initialization hangs/network calls
// Mock Clerk globally to avoid initialization hangs/network calls
jest.mock("@clerk/express", () => {
  return {
    clerkMiddleware: jest.fn().mockImplementation(() => (req: any, res: any, next: any) => next()),
    requireAuth: jest.fn().mockImplementation(() => (req: any, res: any, next: any) => next()),
    getAuth: jest.fn().mockImplementation((req: any) => ({ 
      userId: req.headers["x-test-user"] || "mock_user",
      sessionClaims: {} // Will be populated by customClerkMw if x-test-user is present
    })),
    clerkClient: {
      users: {
        getUser: jest.fn().mockResolvedValue({}),
        updateUserMetadata: jest.fn().mockResolvedValue({}),
        updateUser: jest.fn().mockResolvedValue({}),
      },
    },
  };
});

// Mock user utils to avoid Clerk sync hangs
jest.mock("../src/utils/user", () => {
  const actual = jest.requireActual("../src/utils/user");
  return {
    ...actual,
    fetchAndSyncLocalUser: jest.fn().mockImplementation((input: any) => {
      const { external_id } = input;
      let dialist_id = "677a2222222222222222bbb2"; // Default
      
      if (external_id === "buyer_us_complete") {
        dialist_id = "ccc111111111111111111111";
      } else if (external_id === "merchant_approved") {
        dialist_id = "ddd333333333333333333333";
      }

      return Promise.resolve({
        dialist_id,
        onboarding_status: "completed",
        display_name: "Mock User",
        isMerchant: external_id === "merchant_approved",
        networks_accessed: false,
        networks_application_id: null,
      });
    }),
    syncUserToClerk: jest.fn().mockResolvedValue(true),
  };
});

let mongoServer: MongoMemoryServer;

// Setup: Start in-memory MongoDB before all tests
beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      dbName: "dialist_test",
    });

    console.log("✅ Test database connected");
  } catch (error) {
    console.error("❌ Failed to setup test database:", error);
    throw error;
  }
});

// Teardown: Stop in-memory MongoDB after all tests
afterAll(async () => {
  try {
    await mongoose.disconnect();
    await mongoServer.stop();
    console.log("✅ Test database disconnected");
  } catch (error) {
    console.error("❌ Failed to teardown test database:", error);
  }
});

// Clean up: Clear all collections after each test
afterEach(async () => {
  try {
    const collections = mongoose.connection.collections;

    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } catch (error) {
    console.error("❌ Failed to clear test data:", error);
  }
});

// Suppress console output during tests (optional)
if (process.env.SILENT_TESTS === "true") {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}
