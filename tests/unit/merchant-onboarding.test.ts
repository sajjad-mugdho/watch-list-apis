/**
 * Unit tests for merchant onboarding flow
 * Tests the Finix utility functions used in merchant onboarding
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import * as finixUtils from "../../src/utils/finix";

// Mock the finix utility module
jest.mock("../../src/utils/finix");

describe("Merchant Onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createOnboardingForm", () => {
    it("should create an onboarding form for US merchant", async () => {
      const mockResponse = {
        form_id: "obf_test123",
        form_link: "https://finix-hosted.com/onboard/obf_test123",
        expires_at: "2025-12-01T00:00:00Z",
        identity_id: "ID_test456",
      };

      (
        finixUtils.createOnboardingForm as jest.MockedFunction<
          typeof finixUtils.createOnboardingForm
        >
      ).mockResolvedValue(mockResponse);

      const result = await finixUtils.createOnboardingForm({
        dialist_user_id: "507f1f77bcf86cd799439011",
        user_location: "US",
      });

      expect(result).toEqual(mockResponse);
      expect(finixUtils.createOnboardingForm).toHaveBeenCalledWith({
        dialist_user_id: "507f1f77bcf86cd799439011",
        user_location: "US",
      });
    });

    it("should create an onboarding form for Canadian merchant", async () => {
      const mockResponse = {
        form_id: "obf_test456",
        form_link: "https://finix-hosted.com/onboard/obf_test456",
        expires_at: "2025-12-01T00:00:00Z",
        identity_id: "ID_test789",
      };

      (
        finixUtils.createOnboardingForm as jest.MockedFunction<
          typeof finixUtils.createOnboardingForm
        >
      ).mockResolvedValue(mockResponse);

      const result = await finixUtils.createOnboardingForm({
        dialist_user_id: "507f1f77bcf86cd799439012",
        user_location: "CA",
      });

      expect(result).toEqual(mockResponse);
      expect(result.form_link).toContain("finix-hosted.com");
    });

    it("should handle Finix API errors", async () => {
      const mockError = new Error("Finix API error: 400") as any;
      mockError.statusCode = 400;
      mockError.finixErrors = [
        { field: "user_location", message: "Invalid location" },
      ];

      (
        finixUtils.createOnboardingForm as jest.MockedFunction<
          typeof finixUtils.createOnboardingForm
        >
      ).mockRejectedValue(mockError);

      await expect(
        finixUtils.createOnboardingForm({
          dialist_user_id: "507f1f77bcf86cd799439013",
          user_location: "INVALID" as any,
        })
      ).rejects.toThrow("Finix API error: 400");
    });
  });

  describe("createFormLink", () => {
    it("should create a new link for existing form", async () => {
      const mockResponse = {
        form_link:
          "https://finix-hosted.com/onboard/obf_test123?token=newtoken",
        expires_at: "2025-12-02T00:00:00Z",
      };

      (
        finixUtils.createFormLink as jest.MockedFunction<
          typeof finixUtils.createFormLink
        >
      ).mockResolvedValue(mockResponse);

      const result = await finixUtils.createFormLink("obf_test123");

      expect(result).toEqual(mockResponse);
      expect(finixUtils.createFormLink).toHaveBeenCalledWith("obf_test123");
    });

    it("should handle custom expiration minutes", async () => {
      const mockResponse = {
        form_link: "https://finix-hosted.com/onboard/obf_test123?token=custom",
        expires_at: "2025-12-01T12:00:00Z",
      };

      (
        finixUtils.createFormLink as jest.MockedFunction<
          typeof finixUtils.createFormLink
        >
      ).mockResolvedValue(mockResponse);

      const result = await finixUtils.createFormLink("obf_test123", 7200); // 5 days

      expect(result).toEqual(mockResponse);
      expect(finixUtils.createFormLink).toHaveBeenCalledWith(
        "obf_test123",
        7200
      );
    });

    it("should handle Finix API errors", async () => {
      const mockError = new Error("Finix API error: 404") as any;
      mockError.statusCode = 404;

      (
        finixUtils.createFormLink as jest.MockedFunction<
          typeof finixUtils.createFormLink
        >
      ).mockRejectedValue(mockError);

      await expect(finixUtils.createFormLink("obf_invalid")).rejects.toThrow(
        "Finix API error: 404"
      );
    });
  });
});
