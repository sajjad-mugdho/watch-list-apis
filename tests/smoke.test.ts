/// <reference types="jest" />

/**
 * Smoke test to validate Jest and test infrastructure setup
 */

describe("Test Infrastructure", () => {
  it("should run tests successfully", () => {
    expect(true).toBe(true);
  });

  it("should support async/await", async () => {
    const promise = Promise.resolve(42);
    const result = await promise;
    expect(result).toBe(42);
  });

  it("should have access to Node.js environment", () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});
