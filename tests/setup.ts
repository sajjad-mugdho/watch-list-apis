/// <reference types="jest" />

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
// Mock uuid before importing anything else
jest.mock("uuid", () => ({
  v4: jest.fn(() => "test-uuid-123"),
}));

// Mock Bull library globally to avoid Redis connection errors
jest.mock("bull", () => {
  return jest.fn().mockImplementation(() => {
    let processor: any = null;

    return {
      on: jest.fn(),
      add: jest.fn().mockImplementation(async (data) => {
        const job = {
          id: `job-${Date.now()}-${Math.random()}`,
          data,
          attemptsMade: 0,
          opts: { attempts: 3 },
          finished: jest.fn().mockResolvedValue(undefined),
        };
        
        // Execute processor if registered
        if (processor) {
          try {
            await processor(job);
          } catch (e) {
            console.error("Job processing failed in mock:", e);
            throw e; 
          }
        }
        return job;
      }),
      process: jest.fn().mockImplementation((fn) => {
        processor = fn;
      }),
      getJob: jest.fn().mockResolvedValue({ finished: jest.fn().mockResolvedValue(undefined) }),
      getJobCounts: jest.fn().mockResolvedValue({}),
      close: jest.fn().mockResolvedValue(undefined),
    };
  });
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
jest.mock("@clerk/express", () => {
  return {
    clerkMiddleware: jest.fn().mockImplementation(() => (req: any, res: any, next: any) => {
      req.auth = {
        userId: req.headers["x-test-user"] || null,
        sessionClaims: {},
      };
      next();
    }),
    requireAuth: jest.fn().mockImplementation(() => (req: any, res: any, next: any) => next()),
    getAuth: jest.fn().mockImplementation((req: any) => {
      const auth = { 
        userId: req.headers["x-test-user"] || null,
        sessionClaims: {} 
      };
      if (!req.auth) req.auth = auth;
      return auth;
    }),
    clerkClient: {
      users: {
        getUser: jest.fn().mockResolvedValue({}),
        updateUserMetadata: jest.fn().mockResolvedValue({}),
        updateUser: jest.fn().mockResolvedValue({}),
      },
    },
  };
});

// Mock GetStream (Feeds)
jest.mock("getstream", () => {
  return {
    connect: jest.fn().mockImplementation(() => ({
      feed: jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({ results: [] }),
        addActivity: jest.fn().mockResolvedValue({ id: "activity-id" }),
        follow: jest.fn().mockResolvedValue({}),
        unfollow: jest.fn().mockResolvedValue({}),
        following: jest.fn().mockResolvedValue({ results: [] }),
        followers: jest.fn().mockResolvedValue({ results: [] }),
        removeActivity: jest.fn().mockResolvedValue({}),
      })),
      createUserToken: jest.fn().mockReturnValue("mock-feed-token"),
    })),
  };
});

// Mock Stream Chat
jest.mock("stream-chat", () => {
  return {
    StreamChat: {
      getInstance: jest.fn().mockImplementation(() => ({
        createToken: jest.fn().mockReturnValue("mock-chat-token"),
        upsertUser: jest.fn().mockResolvedValue({}),
        channel: jest.fn().mockImplementation(() => ({
          create: jest.fn().mockResolvedValue({}),
          updatePartial: jest.fn().mockResolvedValue({}),
          sendMessage: jest.fn().mockResolvedValue({}),
          watch: jest.fn().mockResolvedValue({}),
          addMembers: jest.fn().mockResolvedValue({}),
        })),
        verifyWebhook: jest.fn().mockReturnValue(true),
        queryChannels: jest.fn().mockResolvedValue([]),
      })),
    },
  };
});

// Mock user utils to avoid Clerk sync hangs
jest.mock("../src/utils/user", () => {
  const actual = jest.requireActual("../src/utils/user");
  return {
    ...actual,
    fetchAndSyncLocalUser: jest.fn().mockImplementation(async (input: any) => {
      const { external_id } = input;
      
      // Attempt to find user in database
      try {
        const mongoose = require("mongoose");
        const User = mongoose.model("User");
        const user = await User.findOne({ external_id }).select('+external_id +location +onboarding +first_name +last_name +email +phone');
        
        if (user) {
          return {
            dialist_id: user._id.toString(),
            external_id: user.external_id,
            userId: user.external_id,
            onboarding_status: user.onboarding.status,
            display_name: user.display_name,
            display_avatar: user.avatar,
            location_country: user.location?.country || undefined,
            location_region: user.location?.region || undefined,
            location: user.location,
            isMerchant: false,
            networks_accessed: false,
            networks_application_id: null,
          };
        }
      } catch (err) {
        // Model might not be registered yet or other mongo error
      }

      // Fallback to legacy hardcoded mocks for existing tests
      let dialist_id = "677a2222222222222222bbb2"; // Default
      let external_id_fallback = "clerk_123";

      if (external_id === "buyer_us_complete") {
        dialist_id = "ccc111111111111111111111";
      } else if (external_id === "merchant_approved") {
        dialist_id = "ddd333333333333333333333";
      } else if (external_id === "user_onboarded_buyer") {
        dialist_id = "677a2222222222222222bbb2"; 
      } else if (external_id === "user_new_incomplete") {
        dialist_id = "677a1111111111111111aaa1";
      }

      let display_name = "Mock User";
      if (external_id === "user_onboarded_buyer") {
        display_name = "John Buyer";
      } else if (external_id === "user_new_incomplete") {
        display_name = "TestUserCustom";
      }


      return {
        dialist_id,
        external_id: external_id || external_id_fallback,
        userId: external_id || external_id_fallback,
        onboarding_status: "completed",
        display_name,
        display_avatar: "https://example.com/avatar.jpg",
        location_country: "US",
        location_region: "California",
        isMerchant: external_id === "merchant_approved",
        onboarding_state: external_id === "merchant_approved" ? "APPROVED" : undefined,
        networks_accessed: false,
        networks_application_id: null,
      };
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
