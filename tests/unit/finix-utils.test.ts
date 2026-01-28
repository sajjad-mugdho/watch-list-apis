/**
 * Unit tests for Finix utility functions
 * Tests tokenization, payment instrument creation, authorization, and capture
 */

import {
  createBuyerIdentity,
  createPaymentInstrument,

  authorizePayment,
  capturePayment,
  createTransfer,
  finix,
} from "../../src/utils/finix";
import { config } from "../../src/config";

describe("Finix Utility Functions - Unit Tests", () => {
  const mockFinixAuth = {
    username: config.finixUsername,
    password: config.finixPassword,
  };

  const mockFinixBaseUrl = config.finixBaseUrl;

  // Spy on finix methods
  let postSpy: jest.SpyInstance;
  let getSpy: jest.SpyInstance;
  let putSpy: jest.SpyInstance;

  beforeEach(() => {
    // Create spies on the finix instance methods
    postSpy = jest.spyOn(finix, "post");
    getSpy = jest.spyOn(finix, "get");
    putSpy = jest.spyOn(finix, "put");
  });

  afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    // Restore original implementations
    postSpy.mockRestore();
    getSpy.mockRestore();
    putSpy.mockRestore();
  });

  describe("createBuyerIdentity", () => {
    it("should create a buyer identity with full details", async () => {
      const mockResponse = {
        data: {
          id: "IDmockBuyerIdentity123",
          created_at: "2024-08-09T09:34:36.87Z",
          entity: {
            email: "buyer@test.com",
            first_name: "John",
            last_name: "Smith",
          },
          type: "PERSONAL",
        },
      };

      postSpy.mockResolvedValue(mockResponse);

      const result = await createBuyerIdentity({
        email: "buyer@test.com",
        first_name: "John",
        last_name: "Smith",
      });

      expect(result).toEqual({
        identity_id: "IDmockBuyerIdentity123",
      });

      expect(postSpy).toHaveBeenCalled();
      const headers = postSpy.mock.calls[0][2]?.headers || {};
      expect(headers["Finix-Idempotency-Key"]).toBeDefined();
    });

    it("should create a blank buyer identity", async () => {
      const mockResponse = {
        data: {
          id: "IDblankIdentity123",
          created_at: "2024-08-09T09:34:36.87Z",
          entity: {},
          type: "PERSONAL",
        },
      };

      postSpy.mockResolvedValue(mockResponse);

      const result = await createBuyerIdentity({});

      expect(result).toEqual({
        identity_id: "IDblankIdentity123",
      });

      expect(postSpy).toHaveBeenCalled();
    });

    it("should handle Finix API errors", async () => {
      postSpy.mockRejectedValue({
        response: {
          status: 400,
          data: {
            message: "Invalid email format",
          },
        },
      });

      await expect(
        createBuyerIdentity({
          email: "invalid-email",
        })
      ).rejects.toThrow();
    });
  });

  describe("createOnboardingForm", () => {
    it("should include idempotency header when creating onboarding form", async () => {
      const mockResponse = {
        data: {
          id: "obf_test",
          onboarding_link: {
            link_url: "https://finix-hosted.com/onboard/obf_test",
            expires_at: "2025-12-01T00:00:00Z",
          },
        },
      };
      postSpy.mockResolvedValue(mockResponse as any);
      const result = await (
        require("../../src/utils/finix").createOnboardingForm as any
      )({
        dialist_user_id: "507f1f77bcf86cd799439011",
        user_location: "US",
      });
      expect(postSpy).toHaveBeenCalled();
      const headers = postSpy.mock.calls[0][2]?.headers || {};
      expect(headers["Finix-Idempotency-Key"]).toBeDefined();
    });
  });

  describe("provisionMerchant", () => {
    it("should include idempotency headers on payment_instruments and merchant creation", async () => {
      // Mock the GET onboarding form response containing payment instrument
      const mockFormResponse = {
        data: {
          onboarding_data: {
            payment_instruments: {
              name: "Sandbox Bank",
              account_number: "0000000016",
              bank_code: "122105278",
              account_type: "CHECKING",
              country: "USA",
              currency: "USD",
            },
          },
        },
      };

      const mockPiResponse = {
        data: { id: "PIbank123", type: "BANK_ACCOUNT" },
      };
      const mockMerchantResponse = {
        data: { id: "MU123", onboarding_state: "PROVISIONING" },
      };

      getSpy.mockResolvedValue(mockFormResponse as any);

      // postSpy called twice: for payment_instruments and for identity merchants
      postSpy
        .mockResolvedValueOnce(mockPiResponse as any)
        .mockResolvedValueOnce(mockMerchantResponse as any);

      const { provisionMerchant } = require("../../src/utils/finix") as any;
      const result = await provisionMerchant("IDidentity123", "obf_form123");

      expect(postSpy).toHaveBeenCalled();
      // First post should be creating payment instrument
      const headersPI = postSpy.mock.calls[0][2]?.headers || {};
      expect(headersPI["Finix-Idempotency-Key"]).toBeDefined();
      // Second post should be creating merchant
      const headersMerchant = postSpy.mock.calls[1][2]?.headers || {};
      expect(headersMerchant["Finix-Idempotency-Key"]).toBeDefined();
      expect(result).toEqual({
        merchant_id: "MU123",
        verification_id: null,
        onboarding_state: "PROVISIONING",
      });
    });
  });

  describe("createFormLink", () => {
    it("should include idempotency header when creating form links", async () => {
      const mockResponse = {
        data: {
          link_url: "https://finix-hosted.com/onboard/obf_test?token=123",
          expires_at: "2025-12-01T00:00:00Z",
        },
      };
      postSpy.mockResolvedValue(mockResponse as any);
      const createFormLink = require("../../src/utils/finix")
        .createFormLink as any;
      const result = await createFormLink("obf_test123");
      expect(postSpy).toHaveBeenCalled();
      const headers = postSpy.mock.calls[0][2]?.headers || {};
      expect(headers["Finix-Idempotency-Key"]).toBeDefined();
    });
  });

  describe("createPaymentInstrument - Token", () => {
    it("should create payment instrument from token", async () => {
      const mockResponse = {
        data: {
          id: "PImockPaymentInstrument123",
          created_at: "2022-10-10T05:32:17.78Z",
          instrument_type: "PAYMENT_CARD",
          identity: "IDmockBuyerIdentity123",
          bin: "489514",
          brand: "VISA",
          card_type: "DEBIT",
          last_four: "0006",
          name: "Test Buyer",
        },
      };

      postSpy.mockResolvedValue(mockResponse);

      const result = await createPaymentInstrument({
        token: "TKmockToken123",
        identity_id: "IDmockBuyerIdentity123",
        postal_code: "94114",
        address_line1: "123 Market St",
        address_city: "San Francisco",
        address_region: "CA",
      });

      expect(result).toEqual({
        payment_instrument_id: "PImockPaymentInstrument123",
        card_type: "DEBIT",
        last_four: "0006",
        brand: "VISA",
      });

      expect(postSpy).toHaveBeenCalled();
      // Should include tags pointing to the token
      const payload = postSpy.mock.calls[0][1];
      expect(payload.tags).toEqual(
        expect.objectContaining({
          source_type: "tokenized",
          token_id: "TKmockToken123",
        })
      );
    });

    it("should include fraud_session_id when provided for tokenized payment instrument", async () => {
      const mockResponse = { data: { id: "PImockPaymentInstrument123" } };
      postSpy.mockResolvedValue(mockResponse);
      await createPaymentInstrument({
        token: "TKmockToken123",
        identity_id: "IDmockBuyerIdentity123",
        postal_code: "94114",
        address_line1: "123 Market St",
        address_city: "San Francisco",
        address_region: "CA",
        fraud_session_id: "FS_test_001",
      });
      const payload = postSpy.mock.calls[0][1];
      expect(payload.fraud_session_id).toBe("FS_test_001");
    });

    it("should include postal_code in request when provided", async () => {
      const mockResponse = {
        data: {
          id: "PImockPaymentInstrumentPostal123",
          created_at: "2022-10-10T05:32:17.78Z",
          instrument_type: "PAYMENT_CARD",
          identity: "IDmockBuyerIdentity123",
          bin: "489514",
          brand: "VISA",
          card_type: "DEBIT",
          last_four: "0006",
          name: "Test Buyer",
        },
      };

      postSpy.mockResolvedValue(mockResponse);

      const result = await createPaymentInstrument({
        token: "TKmockToken123",
        identity_id: "IDmockBuyerIdentity123",
        postal_code: "94114",
        address_line1: "123 Market St",
        address_city: "San Francisco",
        address_region: "CA",
      });

      expect(result).toEqual({
        payment_instrument_id: "PImockPaymentInstrumentPostal123",
        card_type: "DEBIT",
        last_four: "0006",
        brand: "VISA",
      });

      expect(postSpy).toHaveBeenCalled();
      // Ensure payload contains address with postal_code
      const payload = postSpy.mock.calls[0][1];
      expect(payload).toEqual(
        expect.objectContaining({
          address: expect.objectContaining({ postal_code: "94114" }),
        })
      );
    });

    it("should use provided idempotency key when creating a tokenized payment instrument", async () => {
      const mockResponse = { data: { id: "PImockPaymentInstrument123" } };
      postSpy.mockResolvedValue(mockResponse);
      const idKey = "pi-idempotency-test-123";
      await createPaymentInstrument({
        token: "TKmockToken123",
        identity_id: "IDmockBuyerIdentity123",
        idempotencyKey: idKey,
        postal_code: "94114",
        address_line1: "123 Market St",
        address_city: "San Francisco",
        address_region: "CA",
      });
      expect(postSpy).toHaveBeenCalled();
      const headers = postSpy.mock.calls[0][2]?.headers || {};
      expect(headers["Finix-Idempotency-Key"]).toBe(idKey);
    });

    it("should handle token expiration error", async () => {
      postSpy.mockRejectedValue({
        response: {
          status: 400,
          data: {
            message: "Token has expired",
          },
        },
      });

      await expect(
        createPaymentInstrument({
          token: "TKexpiredToken123",
          identity_id: "IDmockBuyerIdentity123",
          postal_code: "94114",
          address_line1: "123 Market St",
          address_city: "San Francisco",
          address_region: "CA",
        })
      ).rejects.toThrow();
    });

    it("should handle invalid token error", async () => {
      postSpy.mockRejectedValue({
        response: {
          status: 404,
          data: {
            message: "Token not found",
          },
        },
      });

      await expect(
        createPaymentInstrument({
          token: "TKinvalidToken123",
          identity_id: "IDmockBuyerIdentity123",
          postal_code: "94114",
          address_line1: "123 Market St",
          address_city: "San Francisco",
          address_region: "CA",
        })
      ).rejects.toThrow();
    });
  });



  describe("authorizePayment", () => {
    it("should successfully authorize payment", async () => {
      const mockResponse = {
        data: {
          id: "AUmockAuthorization123",
          created_at: "2025-10-27T15:50:16.97Z",
          amount: 5000,
          state: "SUCCEEDED",
          merchant: "MUmockMerchantId123",
          source: "PImockPaymentInstrument123",
          currency: "USD",
          expires_at: "2025-11-03T15:50:16.97Z",
          trace_id: "mock-trace-id-123",
        },
      };

      postSpy.mockResolvedValue(mockResponse);

      const result = await authorizePayment({
        amount: 5000,
        merchant_id: "MUmockMerchantId123",
        payment_instrument_id: "PImockPaymentInstrument123",
        fraud_session_id: "fs_test123",
        currency: "USD",
      });

      expect(result).toEqual({
        authorization_id: "AUmockAuthorization123",
        state: "SUCCEEDED",
        amount: 5000,
      });

      expect(postSpy).toHaveBeenCalled();
      // Confirm tags (merge) exist on authorization payload
      const payload = postSpy.mock.calls[0][1];
      expect(payload.tags).toBeDefined();
      expect(payload.tags.order_type).toBe("marketplace_listing");
    });

    it("should pass provided idempotency key as header on authorization", async () => {
      const mockResponse = {
        data: {
          id: "AUmockAuthorization123",
          state: "SUCCEEDED",
          amount: 5000,
        },
      };
      postSpy.mockResolvedValue(mockResponse);
      const idKey = "auth-idem-123";
      await authorizePayment({
        amount: 5000,
        merchant_id: "MUmockMerchantId123",
        payment_instrument_id: "PImockPaymentInstrument123",
        fraud_session_id: "fs_test123",
        idempotencyKey: idKey,
        currency: "USD",
      });
      expect(postSpy).toHaveBeenCalled();
      const headers = postSpy.mock.calls[0][2]?.headers || {};
      expect(headers["Finix-Idempotency-Key"]).toBe(idKey);
    });

    it("should handle card declined", async () => {
      postSpy.mockRejectedValue({
        response: {
          status: 402,
          data: {
            state: "FAILED",
            failure_code: "CARD_DECLINED",
            failure_message: "Insufficient funds",
          },
        },
      });

      await expect(
        authorizePayment({
          amount: 5000,
          merchant_id: "MUmockMerchantId123",
          payment_instrument_id: "PImockPaymentInstrument123",
          fraud_session_id: "fs_test123",
          currency: "USD",
        })
      ).rejects.toThrow();
    });

    it("should handle fraud detection failure", async () => {
      postSpy.mockRejectedValue({
        response: {
          status: 402,
          data: {
            state: "FAILED",
            failure_code: "FRAUD_DETECTED",
            failure_message: "Transaction flagged as fraudulent",
          },
        },
      });

      await expect(
        authorizePayment({
          amount: 5000,
          merchant_id: "MUmockMerchantId123",
          payment_instrument_id: "PImockPaymentInstrument123",
          fraud_session_id: "fs_test123",
          currency: "USD",
        })
      ).rejects.toThrow();
    });

    it("should handle invalid merchant", async () => {
      postSpy.mockRejectedValue({
        response: {
          status: 404,
          data: {
            message: "Merchant not found",
          },
        },
      });

      await expect(
        authorizePayment({
          amount: 5000,
          merchant_id: "MUinvalidMerchant",
          payment_instrument_id: "PImockPaymentInstrument123",
          fraud_session_id: "fs_test123",
          currency: "USD",
        })
      ).rejects.toThrow();
    });
  });

  describe("capturePayment", () => {
    let mockAuthResponse: any;
    beforeEach(() => {
      mockAuthResponse = {
        data: {
          id: "AUmockAuthorization123",
          amount: 5000,
          state: "SUCCEEDED",
          merchant: "MUmockMerchantId123",
        },
      };
    });
    it("should successfully capture authorized payment", async () => {
      getSpy.mockResolvedValue(mockAuthResponse);
      const mockResponse = {
        data: {
          id: "AUmockAuthorization123",
          created_at: "2025-10-27T15:55:16.97Z",
          amount: 5000,
          state: "SUCCEEDED",
          type: "DEBIT",
          currency: "USD",
          trace_id: "mock-trace-id-456",
          ready_to_settle_at: "2025-10-28T15:55:16.97Z",
          transfer: "TRmockTransfer123",
        },
      };

      putSpy.mockResolvedValue(mockResponse);

      const result = await capturePayment({
        authorization_id: "AUmockAuthorization123",
      });

      expect(result).toMatchObject({
        transfer_id: "TRmockTransfer123",
        state: "SUCCEEDED",
        amount: 5000,
      });

      expect(putSpy).toHaveBeenCalled();
    });

    it("should use provided idempotency key when capturing authorization", async () => {
      getSpy.mockResolvedValue(mockAuthResponse);
      const mockResponse = {
        data: {
          id: "AUmockAuthorization123",
          created_at: "2025-10-27T15:55:16.97Z",
          amount: 5000,
          state: "SUCCEEDED",
          type: "DEBIT",
          currency: "USD",
          trace_id: "mock-trace-id-456",
          ready_to_settle_at: "2025-10-28T15:55:16.97Z",
          transfer: "TRmockTransfer123",
        },
      };
      putSpy.mockResolvedValue(mockResponse);
      const idKey = "capture-idem-123";
      const result = await capturePayment({
        authorization_id: "AUmockAuthorization123",
        idempotencyKey: idKey,
      });
      expect(putSpy).toHaveBeenCalled();
      const headers = putSpy.mock.calls[0][2]?.headers || {};
      expect(headers["Finix-Idempotency-Key"]).toBe(idKey);
      expect(result.transfer_id).toBe("TRmockTransfer123");
    });

    it("should handle capture of expired authorization", async () => {
      getSpy.mockResolvedValue({
        data: {
          id: "AUexpiredAuthorization",
          amount: 5000,
          state: "EXPIRED",
        },
      });
      putSpy.mockRejectedValue({
        response: {
          status: 400,
          data: {
            message: "Authorization has expired",
          },
        },
      });

      await expect(
        capturePayment({
          authorization_id: "AUexpiredAuthorization",
        })
      ).rejects.toThrow();
    });

    it("should handle capture of already captured authorization", async () => {
      getSpy.mockResolvedValue(mockAuthResponse);
      putSpy.mockRejectedValue({
        response: {
          status: 400,
          data: {
            message: "Authorization already captured",
          },
        },
      });

      await expect(
        capturePayment({
          authorization_id: "AUalreadyCaptured",
        })
      ).rejects.toThrow();
    });

    it("should handle invalid authorization ID", async () => {
      // Simulate getAuthorization failing with 404
      getSpy.mockRejectedValue({
        response: { status: 404, data: { message: "Authorization not found" } },
      });
      putSpy.mockRejectedValue({
        response: {
          status: 404,
          data: {
            message: "Authorization not found",
          },
        },
      });

      await expect(
        capturePayment({
          authorization_id: "AUinvalidAuth",
        })
      ).rejects.toThrow();
    });

    it("should capture with partial amount", async () => {
      getSpy.mockResolvedValue(mockAuthResponse);
      const mockResponse = {
        data: {
          id: "AUmockAuthorization123",
          created_at: "2025-10-27T15:55:16.97Z",
          amount: 3000,
          state: "SUCCEEDED",
          type: "DEBIT",
          currency: "USD",
          transfer: "TRmockPartialTransfer123",
        },
      };

      putSpy.mockResolvedValue(mockResponse);

      const result = await capturePayment({
        authorization_id: "AUmockAuthorization123",
        capture_amount: 3000,
      });

      expect(result.transfer_id).toBe("TRmockPartialTransfer123");
      expect(putSpy).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors", async () => {
      postSpy.mockRejectedValue(new Error("Network error"));

      await expect(
        createBuyerIdentity({
          email: "buyer@test.com",
        })
      ).rejects.toThrow("Network error");
    });

    it("should handle timeout errors", async () => {
      postSpy.mockRejectedValue({
        code: "ECONNABORTED",
        message: "timeout of 30000ms exceeded",
      });

      await expect(
        authorizePayment({
          amount: 5000,
          merchant_id: "MUmockMerchantId123",
          payment_instrument_id: "PImockPaymentInstrument123",
          fraud_session_id: "fs_test123",
          currency: "USD",
        })
      ).rejects.toThrow();
    });

    it("should handle 500 server errors", async () => {
      putSpy.mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: "Internal server error",
          },
        },
      });

      await expect(
        capturePayment({
          authorization_id: "AUmockAuthorization123",
        })
      ).rejects.toThrow();
    });

    it("should handle 401 authentication errors", async () => {
      postSpy.mockRejectedValue({
        response: {
          status: 401,
          data: {
            message: "Invalid credentials",
          },
        },
      });

      await expect(
        createPaymentInstrument({
          token: "TKmockToken123",
          identity_id: "IDmockBuyerIdentity123",
          postal_code: "94114",
          address_line1: "123 Market St",
          address_city: "San Francisco",
          address_region: "CA",
        })
      ).rejects.toThrow();
    });
  });

  describe("createTransfer idempotency", () => {
    it("should use provided idempotency key when creating transfer", async () => {
      const mockResponse = {
        data: { id: "TRtest111", state: "SUCCEEDED", amount: 1200 },
      };
      postSpy.mockResolvedValue(mockResponse);
      const idKey = "transfer-idem-123";
      const r = await createTransfer({
        amount: 1200,
        merchant_id: "MUmockMerchantId123",
        source: "PItest1",
        idempotencyKey: idKey,
      } as any);
      expect(postSpy).toHaveBeenCalled();
      const headers = postSpy.mock.calls[0][2]?.headers || {};
      expect(headers["Finix-Idempotency-Key"]).toBe(idKey);
      expect(r.transfer_id).toBe("TRtest111");
    });

    it("should include tags and fraud_session_id when creating transfer", async () => {
      const mockResponse = {
        data: { id: "TRtest222", state: "SUCCEEDED", amount: 1200 },
      };
      postSpy.mockResolvedValue(mockResponse);
      await createTransfer({
        amount: 1200,
        merchant_id: "MUmockMerchantId123",
        source: "PItest1",
        idempotencyKey: "transfer-idem-123",
        tags: { order_id: "order_123" },
        fraud_session_id: "FS_test_002",
      } as any);
      expect(postSpy).toHaveBeenCalled();
      const payload = postSpy.mock.calls[0][1];
      expect(payload.fraud_session_id).toBe("FS_test_002");
      expect(payload.tags).toEqual(
        expect.objectContaining({ order_id: "order_123" })
      );
    });
  });
});
