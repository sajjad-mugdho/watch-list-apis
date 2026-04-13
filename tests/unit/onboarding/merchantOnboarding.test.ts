import {
  MerchantOnboarding,
  IMerchantOnboarding,
} from "../../src/models/MerchantOnboarding";
import { User } from "../../src/models/User";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

describe("MerchantOnboarding Model", () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Disconnect if already connected
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await MerchantOnboarding.deleteMany({});
    await User.deleteMany({});
  });

  describe("Schema Validation", () => {
    it("should create a valid MerchantOnboarding record", async () => {
      const userId = new mongoose.Types.ObjectId();

      const merchantOnboarding = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test123",
        onboarding_state: "PENDING",
      });

      expect(merchantOnboarding).toBeDefined();
      expect(merchantOnboarding.form_id).toBe("obf_test123");
      expect(merchantOnboarding.dialist_user_id.toString()).toBe(
        userId.toString()
      );
      expect(merchantOnboarding.onboarding_state).toBe("PENDING");
      expect(merchantOnboarding.identity_id).toBeNull();
      expect(merchantOnboarding.merchant_id).toBeNull();
    });

    it("should require form_id and dialist_user_id", async () => {
      const invalidRecord = new MerchantOnboarding({
        onboarding_state: "PENDING",
      });

      await expect(invalidRecord.save()).rejects.toThrow();
    });

    it("should enforce unique form_id", async () => {
      const userId = new mongoose.Types.ObjectId();

      await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_duplicate",
        onboarding_state: "PENDING",
      });

      const duplicate = new MerchantOnboarding({
        dialist_user_id: userId,
        form_id: "obf_duplicate",
        onboarding_state: "PENDING",
      });

      await expect(duplicate.save()).rejects.toThrow();
    });

    it("should allow duplicate identity_id (multiple users can have same identity during race conditions)", async () => {
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();

      const record1 = await MerchantOnboarding.create({
        dialist_user_id: userId1,
        form_id: "obf_test1",
        identity_id: "ID_duplicate",
        onboarding_state: "PENDING",
      });

      // Should allow duplicate identity_id since we removed unique constraint
      const record2 = await MerchantOnboarding.create({
        dialist_user_id: userId2,
        form_id: "obf_test2",
        identity_id: "ID_duplicate",
        onboarding_state: "PENDING",
      });

      expect(record1.identity_id).toBe("ID_duplicate");
      expect(record2.identity_id).toBe("ID_duplicate");
    });

    it("should allow null identity_id (before form completion)", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        onboarding_state: "PENDING",
        identity_id: null,
      });

      expect(record.identity_id).toBeNull();
    });
  });

  describe("State Transitions", () => {
    it("should update from PENDING to PROVISIONING", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        onboarding_state: "PENDING",
      });

      record.identity_id = "ID_test123";
      record.onboarding_state = "PROVISIONING";
      record.onboarded_at = new Date();
      await record.save();

      expect(record.onboarding_state).toBe("PROVISIONING");
      expect(record.identity_id).toBe("ID_test123");
      expect(record.onboarded_at).toBeInstanceOf(Date);
    });

    it("should update to APPROVED with merchant_id", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        identity_id: "ID_test123",
        onboarding_state: "PROVISIONING",
      });

      record.merchant_id = "MU_merchant123";
      record.onboarding_state = "APPROVED";
      await record.save();

      expect(record.merchant_id).toBe("MU_merchant123");
      expect(record.onboarding_state).toBe("APPROVED");
    });

    it("should update verification state", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        identity_id: "ID_test123",
        merchant_id: "MU_merchant123",
        onboarding_state: "APPROVED",
        verification_state: "PENDING",
      });

      record.verification_state = "SUCCEEDED";
      record.verified_at = new Date();
      await record.save();

      expect(record.verification_state).toBe("SUCCEEDED");
      expect(record.verified_at).toBeInstanceOf(Date);
    });
  });

  describe("Queries", () => {
    it("should find by dialist_user_id", async () => {
      const userId = new mongoose.Types.ObjectId();

      await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        onboarding_state: "PENDING",
      });

      const found = await MerchantOnboarding.findOne({
        dialist_user_id: userId,
      });

      expect(found).toBeDefined();
      expect(found?.dialist_user_id.toString()).toBe(userId.toString());
    });

    it("should find by identity_id", async () => {
      const userId = new mongoose.Types.ObjectId();

      await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        identity_id: "ID_findme",
        onboarding_state: "PROVISIONING",
      });

      const found = await MerchantOnboarding.findOne({
        identity_id: "ID_findme",
      });

      expect(found).toBeDefined();
      expect(found?.identity_id).toBe("ID_findme");
    });

    it("should find by merchant_id", async () => {
      const userId = new mongoose.Types.ObjectId();

      await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        identity_id: "ID_test",
        merchant_id: "MU_findme",
        onboarding_state: "APPROVED",
      });

      const found = await MerchantOnboarding.findOne({
        merchant_id: "MU_findme",
      });

      expect(found).toBeDefined();
      expect(found?.merchant_id).toBe("MU_findme");
    });

    it("should find by onboarding_state", async () => {
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();

      await MerchantOnboarding.create({
        dialist_user_id: userId1,
        form_id: "obf_test1",
        onboarding_state: "PENDING",
      });

      await MerchantOnboarding.create({
        dialist_user_id: userId2,
        form_id: "obf_test2",
        identity_id: "ID_test",
        onboarding_state: "APPROVED",
      });

      const pending = await MerchantOnboarding.find({
        onboarding_state: "PENDING",
      });

      const approved = await MerchantOnboarding.find({
        onboarding_state: "APPROVED",
      });

      expect(pending).toHaveLength(1);
      expect(approved).toHaveLength(1);
    });
  });

  describe("Form Link Management", () => {
    it("should store and update form link", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        last_form_link: "https://finix.com/form/abc123",
        last_form_link_expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ),
        onboarding_state: "PENDING",
      });

      expect(record.last_form_link).toBe("https://finix.com/form/abc123");
      expect(record.last_form_link_expires_at).toBeInstanceOf(Date);

      // Update link
      record.last_form_link = "https://finix.com/form/xyz789";
      record.last_form_link_expires_at = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      );
      await record.save();

      expect(record.last_form_link).toBe("https://finix.com/form/xyz789");
    });

    it("should detect expired links", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        last_form_link: "https://finix.com/form/expired",
        last_form_link_expires_at: new Date(Date.now() - 1000), // Expired
        onboarding_state: "PENDING",
      });

      const isExpired = record.last_form_link_expires_at! < new Date();
      expect(isExpired).toBe(true);
    });
  });

  describe("Timestamps", () => {
    it("should auto-set createdAt and updatedAt", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        onboarding_state: "PENDING",
      });

      expect(record.createdAt).toBeInstanceOf(Date);
      expect(record.updatedAt).toBeInstanceOf(Date);
    });

    it("should update updatedAt on save", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        onboarding_state: "PENDING",
      });

      const originalUpdatedAt = record.updatedAt;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      record.onboarding_state = "PROVISIONING";
      await record.save();

      expect(record.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });

    it("should set onboarded_at when form completed", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        onboarding_state: "PENDING",
      });

      expect(record.onboarded_at).toBeNull();

      record.identity_id = "ID_test";
      record.onboarding_state = "PROVISIONING";
      record.onboarded_at = new Date();
      await record.save();

      expect(record.onboarded_at).toBeInstanceOf(Date);
    });

    it("should set verified_at when verification succeeds", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        identity_id: "ID_test",
        merchant_id: "MU_test",
        onboarding_state: "APPROVED",
        verification_state: "PENDING",
      });

      expect(record.verified_at).toBeNull();

      record.verification_state = "SUCCEEDED";
      record.verified_at = new Date();
      await record.save();

      expect(record.verified_at).toBeInstanceOf(Date);
    });
  });

  describe("Edge Cases", () => {
    it("should handle UPDATE_REQUESTED state", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        identity_id: "ID_test",
        merchant_id: "MU_test",
        onboarding_state: "UPDATE_REQUESTED",
      });

      expect(record.onboarding_state).toBe("UPDATE_REQUESTED");
    });

    it("should handle REJECTED state", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        identity_id: "ID_test",
        merchant_id: "MU_test",
        onboarding_state: "REJECTED",
      });

      expect(record.onboarding_state).toBe("REJECTED");
    });

    it("should handle FAILED verification", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        identity_id: "ID_test",
        merchant_id: "MU_test",
        onboarding_state: "APPROVED",
        verification_state: "FAILED",
      });

      expect(record.verification_state).toBe("FAILED");
      expect(record.verified_at).toBeNull();
    });
  });

  describe("JSON Serialization", () => {
    it("should convert _id to string in JSON", async () => {
      const userId = new mongoose.Types.ObjectId();

      const record = await MerchantOnboarding.create({
        dialist_user_id: userId,
        form_id: "obf_test",
        onboarding_state: "PENDING",
      });

      const json = record.toJSON();

      expect(typeof json._id).toBe("string");
      expect(typeof json.dialist_user_id).toBe("string");
    });
  });
});
