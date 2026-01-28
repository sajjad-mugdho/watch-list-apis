import mongoose from "mongoose";
import { User } from "../../src/models/User";
import { MarketplaceListing } from "../../src/models/Listings";
import { Order } from "../../src/models/Order";
import { MerchantOnboarding } from "../../src/models/MerchantOnboarding";

describe("Finix Debug Endpoint", () => {
  it("should return simulated Finix payloads with tags and fraud_session_id", async () => {
    const buyer = await User.create({
      external_id: `clerk_buyer_debug_${Date.now()}`,
      email: `buyer_debug_${Date.now()}@test.com`,
      first_name: "Debug",
      last_name: "Buyer",
    });

    const seller = await User.create({
      external_id: `clerk_seller_debug_${Date.now()}`,
      email: `seller_debug_${Date.now()}@test.com`,
      first_name: "Debug",
      last_name: "Seller",
    });

    await MerchantOnboarding.create({
      dialist_user_id: seller._id,
      form_id: `obf_test_${Date.now()}`,
      merchant_id: "MUmockMerchantIdDebug",
      onboarding_state: "APPROVED",
    });

    const { createTestMarketplaceListing } = require("../helpers/fixtures");
    const listing = await createTestMarketplaceListing({
      dialist_id: seller._id,
      clerk_id: seller.external_id,
      status: "reserved",
      price: 12500,
      reserved_until: new Date(Date.now() + 15 * 60 * 1000),
    });

    const order = await Order.create({
      listing_id: listing._id,
      buyer_id: buyer._id,
      seller_id: seller._id,
      amount: listing.price,
      status: "reserved",
      finix_buyer_identity_id: "IDmockBuyerIdentity123",
      fraud_session_id: "fs_debug_123",
      listing_snapshot: {
        brand: listing.brand,
        model: listing.model,
        reference: listing.reference,
        condition: listing.condition,
        price: listing.price,
      },
    });

    const req: any = {
      params: { id: order._id.toString() },
      query: { method: "all" },
      user: { dialist_id: buyer._id.toString() },
    };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await require("../../src/handlers/debugHandlers").getFinixDebugPayloads(
      req,
      res,
      (err: any) => {
        if (err) throw err;
      }
    );

    expect(res.json).toHaveBeenCalled();
    const response = (res.json as jest.Mock).mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data.payloads).toBeDefined();
    // Assert the tokenized payload includes tags and fraud_session_id
    expect(
      response.data.payloads.createPaymentInstrumentFromToken.tags
    ).toEqual(expect.objectContaining({ source_type: "tokenized" }));
    expect(
      response.data.payloads.createPaymentInstrumentFromToken.fraud_session_id
    ).toBe("fs_debug_123");
  });
});
