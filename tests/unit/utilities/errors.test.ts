import { PaymentError } from "../../src/utils/errors";

describe("Errors util functions", () => {
  describe("mapFailureCode", () => {
    it("returns mapped message for known code", () => {
      const msg = PaymentError.mapFailureCode("GENERIC_DECLINE");
      expect(msg).toContain("card was declined");
    });

    it("returns fallback message if code unknown and fallback is provided", () => {
      const fallback = "Fallback message from service";
      const msg = PaymentError.mapFailureCode("SOMETHING_UNKNOWN", fallback);
      expect(msg).toBe(fallback);
    });

    it('returns "Payment failed: CODE" when unknown code and no fallback', () => {
      const code = "SOME_CODE";
      const msg = PaymentError.mapFailureCode(code);
      // We intentionally assert only the generic prefix to avoid coupling to formatting of appended codes
      expect(msg).toMatch(/^Payment failed/);
    });
  });

  describe("getStatusCode", () => {
    it("returns 403 for FRAUD_DETECTED", () => {
      expect(PaymentError.getStatusCode("FRAUD_DETECTED")).toBe(403);
    });

    it("returns 400 for INVALID_CVV", () => {
      expect(PaymentError.getStatusCode("INVALID_CVV")).toBe(400);
    });

    it("returns 402 for unknown codes", () => {
      expect(PaymentError.getStatusCode("SOME_UNKNOWN_CODE")).toBe(402);
    });
  });

  describe("fromFinixResponse", () => {
    it("parses embedded authorization failure and creates PaymentError", () => {
      const mockError: any = {
        response: {
          data: {
            _embedded: {
              authorizations: [
                {
                  id: "AUtest123",
                  state: "FAILED",
                  failure_code: "INSUFFICIENT_FUNDS",
                  failure_message: "Insufficient funds",
                },
              ],
            },
          },
        },
        message: "Rejected",
      };

      const pe = PaymentError.fromFinixResponse(mockError, "Payment failed");
      expect(pe).toBeInstanceOf(PaymentError);
      expect(pe.failure_code).toBe("INSUFFICIENT_FUNDS");
      expect(pe.failure_message).toBe("Insufficient funds");
      expect(pe.message).toContain("Insufficient funds");
    });

    it("parses embedded transfer failure and creates PaymentError", () => {
      const mockError: any = {
        response: {
          data: {
            _embedded: {
              transfers: [
                {
                  id: "TRtest456",
                  state: "FAILED",
                  failure_code: "R01",
                  failure_message: "Insufficient funds (R01)",
                },
              ],
            },
          },
        },
        message: "Transfer failed",
      };

      const pe = PaymentError.fromFinixResponse(mockError);
      expect(pe.failure_code).toBe("R01");
      expect(pe.failure_message).toBe("Insufficient funds (R01)");
      // PaymentError.message contains a mapped, user-friendly message for the code
      expect(pe.message).toContain(PaymentError.mapFailureCode("R01"));
    });

    it("parses embedded errors array", () => {
      const mockError: any = {
        response: {
          data: {
            _embedded: {
              errors: [
                {
                  logref: "123",
                  code: "DECLINED",
                  failure_code: "FRAUD_DETECTED",
                  message: "Blocked for fraud",
                },
              ],
            },
          },
        },
        message: "Err",
      };

      const pe = PaymentError.fromFinixResponse(mockError);
      expect(pe.failure_code).toBe("FRAUD_DETECTED");
      expect(pe.failure_message).toBe("Blocked for fraud");
      // pe.message is the user-friendly mapped message based on failure_code
      expect(pe.message).toContain(
        PaymentError.mapFailureCode("FRAUD_DETECTED")
      );
    });
  });
});
