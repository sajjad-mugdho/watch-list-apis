module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/tests/e2e/"],
  // Run tests serially to avoid MongoMemoryReplSet catalog-changes errors when
  // afterEach deleteMany runs concurrently with open multi-document transactions
  maxWorkers: 1,
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!(uuid)/)"],
  moduleNameMapper: {
    "^uuid$": "uuid",
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/types/**",
    "!src/index.ts", // Entry point, tested via E2E
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 30000, // 30s for integration tests with DB
  verbose: true,
};
