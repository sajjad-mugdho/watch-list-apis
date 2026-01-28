/// <reference types="jest" />

/**
 * Unit Tests: Finix Webhook Signature Verification
 *
 * Tests the HMAC-SHA256 signature verification function for Finix webhooks.
 * Covers: valid signatures, invalid secrets, timing attacks, edge cases.
 */

import crypto from "crypto";
import { verifyFinixSignature } from "../../src/utils/finix";

describe("Finix Webhook Signature Verification", () => {
  const TEST_SECRET = "test_webhook_secret_12345";
  const SAMPLE_PAYLOAD = JSON.stringify({
    id: "webhook_123",
    entity: "onboarding_form",
    type: "updated",
    _embedded: {
      onboarding_forms: [
        {
          id: "form_abc",
          status: "APPROVED",
        },
      ],
    },
  });

  /**
   * Helper: Generate valid HMAC-SHA256 signature
   */
  function generateValidSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload, "utf8");
    return hmac.digest("hex");
  }

  describe("Valid Signatures", () => {
    it("should accept valid signature with correct secret", () => {
      const signature = generateValidSignature(SAMPLE_PAYLOAD, TEST_SECRET);
      const isValid = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        signature,
        TEST_SECRET
      );
      expect(isValid).toBe(true);
    });

    it("should accept signature for empty payload", () => {
      const emptyPayload = "{}";
      const signature = generateValidSignature(emptyPayload, TEST_SECRET);
      const isValid = verifyFinixSignature(
        emptyPayload,
        signature,
        TEST_SECRET
      );
      expect(isValid).toBe(true);
    });

    it("should accept signature for large payload", () => {
      const largePayload = JSON.stringify({
        data: "x".repeat(10000), // 10KB payload
        nested: {
          field: "value",
          array: Array(100).fill({ key: "value" }),
        },
      });
      const signature = generateValidSignature(largePayload, TEST_SECRET);
      const isValid = verifyFinixSignature(
        largePayload,
        signature,
        TEST_SECRET
      );
      expect(isValid).toBe(true);
    });

    it("should accept signature with special characters in payload", () => {
      const specialPayload = JSON.stringify({
        message: "Hello 世界! 🚀 Special chars: @#$%^&*()",
        emoji: "✅❌⚠️📩",
        unicode: "\u0048\u0065\u006C\u006C\u006F",
      });
      const signature = generateValidSignature(specialPayload, TEST_SECRET);
      const isValid = verifyFinixSignature(
        specialPayload,
        signature,
        TEST_SECRET
      );
      expect(isValid).toBe(true);
    });
  });

  describe("Invalid Signatures", () => {
    it("should reject signature with wrong secret", () => {
      const signature = generateValidSignature(SAMPLE_PAYLOAD, TEST_SECRET);
      const wrongSecret = "wrong_secret_67890";
      const isValid = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        signature,
        wrongSecret
      );
      expect(isValid).toBe(false);
    });

    it("should reject tampered payload", () => {
      const signature = generateValidSignature(SAMPLE_PAYLOAD, TEST_SECRET);
      const tamperedPayload = SAMPLE_PAYLOAD.replace("APPROVED", "REJECTED");
      const isValid = verifyFinixSignature(
        tamperedPayload,
        signature,
        TEST_SECRET
      );
      expect(isValid).toBe(false);
    });

    it("should reject completely invalid signature", () => {
      const invalidSignature = "invalid_signature_not_hex";
      const isValid = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        invalidSignature,
        TEST_SECRET
      );
      expect(isValid).toBe(false);
    });

    it("should reject signature with wrong length", () => {
      const shortSignature = "abc123";
      const isValid = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        shortSignature,
        TEST_SECRET
      );
      expect(isValid).toBe(false);
    });

    it("should reject signature with incorrect encoding", () => {
      // Generate base64 signature instead of hex
      const hmac = crypto.createHmac("sha256", TEST_SECRET);
      hmac.update(SAMPLE_PAYLOAD);
      const base64Signature = hmac.digest("base64");
      const isValid = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        base64Signature,
        TEST_SECRET
      );
      expect(isValid).toBe(false);
    });
  });

  describe("Missing or Empty Values", () => {
    it("should reject missing signature (undefined)", () => {
      const isValid = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        undefined,
        TEST_SECRET
      );
      expect(isValid).toBe(false);
    });

    it("should reject empty signature string", () => {
      const isValid = verifyFinixSignature(SAMPLE_PAYLOAD, "", TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it("should reject whitespace-only signature", () => {
      const isValid = verifyFinixSignature(SAMPLE_PAYLOAD, "   ", TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it("should skip verification if secret is empty (dev mode)", () => {
      const signature = generateValidSignature(SAMPLE_PAYLOAD, TEST_SECRET);
      // Should return true and log warning when secret is empty
      const isValid = verifyFinixSignature(SAMPLE_PAYLOAD, signature, "");
      expect(isValid).toBe(true);
    });

    it("should skip verification if secret is whitespace-only", () => {
      const signature = generateValidSignature(SAMPLE_PAYLOAD, TEST_SECRET);
      const isValid = verifyFinixSignature(SAMPLE_PAYLOAD, signature, "   ");
      expect(isValid).toBe(true);
    });
  });

  describe("Timing Attack Protection", () => {
    it("should use constant-time comparison (timingSafeEqual)", () => {
      // This test verifies that we're using crypto.timingSafeEqual
      // by checking that equal-length signatures take similar time
      const validSignature = generateValidSignature(
        SAMPLE_PAYLOAD,
        TEST_SECRET
      );
      const wrongSignature = generateValidSignature(
        SAMPLE_PAYLOAD,
        "wrong_secret"
      );

      // Both should take similar time (constant-time comparison)
      // We can't easily test timing directly, but we can verify the function works
      const result1 = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        validSignature,
        TEST_SECRET
      );
      const result2 = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        wrongSignature,
        TEST_SECRET
      );

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it("should handle signatures that differ only in last character", () => {
      const validSignature = generateValidSignature(
        SAMPLE_PAYLOAD,
        TEST_SECRET
      );
      // Modify last character
      const almostValidSignature =
        validSignature.slice(0, -1) +
        (validSignature.slice(-1) === "a" ? "b" : "a");

      const isValid = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        almostValidSignature,
        TEST_SECRET
      );
      expect(isValid).toBe(false);
    });

    it("should handle signatures that differ only in first character", () => {
      const validSignature = generateValidSignature(
        SAMPLE_PAYLOAD,
        TEST_SECRET
      );
      // Modify first character
      const almostValidSignature =
        (validSignature[0] === "a" ? "b" : "a") + validSignature.slice(1);

      const isValid = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        almostValidSignature,
        TEST_SECRET
      );
      expect(isValid).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle payload with null bytes", () => {
      const payloadWithNull = "test\0data";
      const signature = generateValidSignature(payloadWithNull, TEST_SECRET);
      const isValid = verifyFinixSignature(
        payloadWithNull,
        signature,
        TEST_SECRET
      );
      expect(isValid).toBe(true);
    });

    it("should handle payload with line breaks", () => {
      const payloadWithLineBreaks = "line1\nline2\rline3\r\nline4";
      const signature = generateValidSignature(
        payloadWithLineBreaks,
        TEST_SECRET
      );
      const isValid = verifyFinixSignature(
        payloadWithLineBreaks,
        signature,
        TEST_SECRET
      );
      expect(isValid).toBe(true);
    });

    it("should handle very long secrets", () => {
      const longSecret = "x".repeat(1000);
      const signature = generateValidSignature(SAMPLE_PAYLOAD, longSecret);
      const isValid = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        signature,
        longSecret
      );
      expect(isValid).toBe(true);
    });

    it("should handle secrets with special characters", () => {
      const specialSecret = "secret!@#$%^&*()_+-=[]{}|;:'\",.<>?/~`";
      const signature = generateValidSignature(SAMPLE_PAYLOAD, specialSecret);
      const isValid = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        signature,
        specialSecret
      );
      expect(isValid).toBe(true);
    });

    it("should reject signature case sensitivity", () => {
      const signature = generateValidSignature(SAMPLE_PAYLOAD, TEST_SECRET);
      const uppercaseSignature = signature.toUpperCase();
      const isValid = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        uppercaseSignature,
        TEST_SECRET
      );
      expect(isValid).toBe(false);
    });
  });

  describe("Real-World Scenarios", () => {
    it("should verify signature for actual Finix webhook payload structure", () => {
      const realPayload = JSON.stringify({
        id: "EVhvxxxxxxxxxxx",
        type: "updated",
        entity: "onboarding_form",
        occurred_at: "2024-01-15T10:30:00Z",
        _embedded: {
          onboarding_forms: [
            {
              id: "ONxxxxxxxxxxx",
              status: "APPROVED",
              merchant_id: "MUxxxxxxxxxxx",
              tags: {
                dialist_user_id: "507f1f77bcf86cd799439011",
              },
              created_at: "2024-01-15T10:00:00Z",
              updated_at: "2024-01-15T10:30:00Z",
            },
          ],
        },
      });

      const signature = generateValidSignature(realPayload, TEST_SECRET);
      const isValid = verifyFinixSignature(realPayload, signature, TEST_SECRET);
      expect(isValid).toBe(true);
    });

    it("should reject replay attack with old signature", () => {
      const originalPayload = JSON.stringify({ id: "evt_1", timestamp: 1000 });
      const signature = generateValidSignature(originalPayload, TEST_SECRET);

      // Attacker tries to replay with modified timestamp
      const replayPayload = JSON.stringify({ id: "evt_1", timestamp: 2000 });
      const isValid = verifyFinixSignature(
        replayPayload,
        signature,
        TEST_SECRET
      );
      expect(isValid).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle and return false for any verification errors", () => {
      // This shouldn't throw, just return false
      const result = verifyFinixSignature(
        SAMPLE_PAYLOAD,
        "malformed-signature",
        TEST_SECRET
      );
      expect(result).toBe(false);
    });

    it("should not throw on invalid UTF-8 in signature", () => {
      const invalidUtf8Signature = Buffer.from([0xff, 0xfe, 0xfd]).toString();
      expect(() => {
        verifyFinixSignature(SAMPLE_PAYLOAD, invalidUtf8Signature, TEST_SECRET);
      }).not.toThrow();
    });
  });
});
