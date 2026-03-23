import request from "supertest";
import { app } from "../../src/app";
import { User } from "../../src/models/User";
import { MerchantOnboarding } from "../../src/models/MerchantOnboarding";
import * as finixUtils from "../../src/utils/finix";

describe("Platform onboarding integration", () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await Promise.all([User.deleteMany({}), MerchantOnboarding.deleteMany({})]);
  });

  it("allows Networks-first flow and pre-fills Marketplace status", async () => {
    await User.create({
      _id: "aaa111111111111111111111",
      external_id: "new_user_us",
      email: "networks-first@test.com",
      first_name: "Initial",
      last_name: "User",
      onboarding: {
        status: "incomplete",
        version: "2.0",
        steps: {},
      },
      marketplace_onboarding: {
        status: "incomplete",
        version: "1.0",
        steps: {},
      },
    });

    const networksComplete = await request(app)
      .patch("/api/v1/networks/onboarding/complete")
      .set("x-test-user", "new_user_us")
      .send({
        profile: {
          first_name: "Nadia",
          last_name: "Network",
        },
        location: {
          country: "US",
          region: "California",
          postal_code: "94102",
          city: "San Francisco",
          line1: "1 Market St",
        },
        avatar: {
          type: "upload",
          url: "https://example.com/networks-avatar.jpg",
        },
      });

    expect(networksComplete.status).toBe(200);
    expect(networksComplete.body.data.onboarding.status).toBe("completed");

    const marketplaceStatus = await request(app)
      .get("/api/v1/marketplace/onboarding/status")
      .set("x-test-user", "new_user_us");

    expect(marketplaceStatus.status).toBe(200);
    expect(marketplaceStatus.body.data.status).toBe("incomplete");
    expect(marketplaceStatus.body.data.pre_populated).toBeDefined();
    expect(marketplaceStatus.body.data.pre_populated.source).toBe("networks");
    expect(marketplaceStatus.body.data.pre_populated.first_name).toBe("Nadia");
    expect(marketplaceStatus.body.data.pre_populated.last_name).toBe("Network");
    expect(marketplaceStatus.body.data.requires).toEqual(
      expect.arrayContaining([
        "marketplace_avatar",
        "marketplace_tos",
        "intent",
      ]),
    );
    expect(marketplaceStatus.body.data.requires).not.toContain("profile");
    expect(marketplaceStatus.body.data.requires).not.toContain("location");
  });

  it("allows Marketplace-first flow and pre-fills Networks status", async () => {
    await User.create({
      _id: "aaa222222222222222222222",
      external_id: "new_user_ca",
      email: "marketplace-first@test.com",
      first_name: "Initial",
      last_name: "User",
      onboarding: {
        status: "incomplete",
        version: "2.0",
        steps: {},
      },
      marketplace_onboarding: {
        status: "incomplete",
        version: "1.0",
        steps: {},
      },
    });

    const marketplaceComplete = await request(app)
      .patch("/api/v1/marketplace/onboarding/complete")
      .set("x-test-user", "new_user_ca")
      .send({
        intent: "buyer",
        profile: {
          first_name: "Mira",
          last_name: "Market",
        },
        location: {
          country: "CA",
          region: "Ontario",
          postal_code: "M5H2N2",
          city: "Toronto",
          line1: "100 King St W",
        },
        avatar: {
          type: "upload",
          url: "https://example.com/marketplace-avatar.jpg",
        },
        acknowledgements: {
          marketplace_tos: true,
        },
      });

    expect(marketplaceComplete.status).toBe(200);
    expect(marketplaceComplete.body.data.marketplace_onboarding.status).toBe(
      "completed",
    );

    const networksStatus = await request(app)
      .get("/api/v1/networks/onboarding/status")
      .set("x-test-user", "new_user_ca");

    expect(networksStatus.status).toBe(200);
    expect(networksStatus.body.data.status).toBe("incomplete");
    expect(networksStatus.body.data.pre_populated).toBeDefined();
    expect(networksStatus.body.data.pre_populated.source).toBe("marketplace");
    expect(networksStatus.body.data.pre_populated.first_name).toBe("Mira");
    expect(networksStatus.body.data.pre_populated.last_name).toBe("Market");
    expect(networksStatus.body.data.requires).toEqual(["avatar"]);
  });

  it("does not prefill when source onboarding is incomplete", async () => {
    await User.create({
      _id: "bbb111111111111111111111",
      external_id: "onboarding_step1_location",
      email: "incomplete@test.com",
      first_name: "Partial",
      last_name: "User",
      onboarding: {
        status: "incomplete",
        version: "2.0",
        steps: {},
      },
      marketplace_onboarding: {
        status: "incomplete",
        version: "1.0",
        steps: {},
      },
    });

    const marketplaceStatus = await request(app)
      .get("/api/v1/marketplace/onboarding/status")
      .set("x-test-user", "onboarding_step1_location");

    expect(marketplaceStatus.status).toBe(200);
    expect(marketplaceStatus.body.data.pre_populated).toBeUndefined();
    expect(marketplaceStatus.body.data.requires).toEqual(
      expect.arrayContaining([
        "profile",
        "location",
        "marketplace_avatar",
        "marketplace_tos",
        "intent",
      ]),
    );

    const networksStatus = await request(app)
      .get("/api/v1/networks/onboarding/status")
      .set("x-test-user", "onboarding_step1_location");

    expect(networksStatus.status).toBe(200);
    expect(networksStatus.body.data.pre_populated).toBeUndefined();
    expect(networksStatus.body.data.requires).toEqual(
      expect.arrayContaining(["profile", "location", "avatar"]),
    );
  });

  it("allows merchant onboarding after marketplace completion without Networks completion", async () => {
    jest.spyOn(finixUtils, "createOnboardingForm").mockResolvedValue({
      form_id: "form_test_123",
      form_link: "https://finix.example.com/onboarding/form_test_123",
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      identity_id: null,
    });

    await User.create({
      _id: "ccc111111111111111111111",
      external_id: "buyer_us_complete",
      email: "merchant-path@test.com",
      first_name: "Buyer",
      last_name: "User",
      location: {
        country: "US",
        region: "New York",
        postal_code: "10001",
        city: "New York",
        line1: "5th Avenue",
      },
      onboarding: {
        status: "incomplete",
        version: "2.0",
        steps: {},
      },
      marketplace_onboarding: {
        status: "completed",
        version: "1.0",
        intent: "dealer",
        completed_at: new Date(),
        steps: {
          profile: {
            first_name: "Buyer",
            last_name: "User",
            confirmed: true,
            updated_at: new Date(),
          },
          location: {
            country: "US",
            region: "New York",
            postal_code: "10001",
            city: "New York",
            line1: "5th Avenue",
            confirmed: true,
            updated_at: new Date(),
          },
          avatar: {
            url: "https://example.com/avatar.jpg",
            confirmed: true,
            updated_at: new Date(),
          },
          acknowledgements: {
            marketplace_tos: true,
            updated_at: new Date(),
          },
        },
      },
      marketplace_display_name: "Buyer User",
    });

    const onboardResponse = await request(app)
      .post("/api/v1/marketplace/merchant/onboard")
      .set("x-test-user", "buyer_us_complete")
      .send({
        idempotency_id: "merchant-onboard-test-1",
      });

    expect([200, 201]).toContain(onboardResponse.status);
    expect(onboardResponse.body.data.form_id).toBe("form_test_123");
    expect(onboardResponse.body.data.onboarding_url).toContain(
      "finix.example.com",
    );

    const merchantRecord = await MerchantOnboarding.findOne({
      dialist_user_id: "ccc111111111111111111111",
    });
    expect(merchantRecord).toBeTruthy();
    expect(merchantRecord?.form_id).toBe("form_test_123");
  });
});
