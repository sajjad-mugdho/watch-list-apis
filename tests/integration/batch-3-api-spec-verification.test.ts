import fs from "fs";
import path from "path";
import request from "supertest";
import { describe, expect, it } from "@jest/globals";

import { app } from "../../src/app";
import { TestFactory } from "../helpers/TestFactory";

interface EndpointResult {
  id: number;
  method: string;
  path: string;
  status: number;
  ok: boolean;
  note: string;
}

describe("Batch 3 API Spec Verification (29 endpoints)", () => {
  it("verifies all Batch 3 spec endpoints without 5xx regressions", async () => {
    const results: EndpointResult[] = [];

    const seller = await TestFactory.createMockUser({
      display_name: "batch3_seller",
      email: "batch3_seller@example.com",
    });
    const buyer = await TestFactory.createMockUser({
      display_name: "batch3_buyer",
      email: "batch3_buyer@example.com",
    });
    const target = await TestFactory.createMockUser({
      display_name: "batch3_target",
      email: "batch3_target@example.com",
    });
    const rejectBuyer = await TestFactory.createMockUser({
      display_name: "batch3_reject_buyer",
      email: "batch3_reject_buyer@example.com",
    });

    const sellerExternal = String(seller.external_id || "batch3_seller_ext");
    const buyerExternal = String(buyer.external_id || "batch3_buyer_ext");
    const rejectBuyerExternal = String(
      rejectBuyer.external_id || "batch3_reject_buyer_ext",
    );
    const sellerName = String(seller.display_name || "batch3_seller");

    const watch = await TestFactory.createWatch({
      brand: "Rolex",
      model: "Submariner",
      reference: "126610LN",
      color: "Black",
    });

    const asUser = (externalId: string) => ({
      get: (url: string) =>
        request(app)
          .get(url)
          .set("x-platform", "networks")
          .set("x-test-user", externalId),
      post: (url: string) =>
        request(app)
          .post(url)
          .set("x-platform", "networks")
          .set("x-test-user", externalId),
      patch: (url: string) =>
        request(app)
          .patch(url)
          .set("x-platform", "networks")
          .set("x-test-user", externalId),
      delete: (url: string) =>
        request(app)
          .delete(url)
          .set("x-platform", "networks")
          .set("x-test-user", externalId),
    });

    const record = (
      id: number,
      method: string,
      endpointPath: string,
      status: number,
      allowed: number[],
      note: string,
    ) => {
      const ok = allowed.includes(status) && status < 500;
      results.push({ id, method, path: endpointPath, status, ok, note });
    };

    // 1) GET /networks/listings
    const r1 = await asUser(sellerExternal).get("/api/v1/networks/listings");
    record(1, "GET", "/networks/listings", r1.status, [200], "listings feed");

    // 5) GET /watches
    const r5 = await asUser(sellerExternal).get("/api/v1/watches");
    record(5, "GET", "/watches", r5.status, [200], "watch search catalog");

    // 6) POST /networks/listings (create draft)
    const r6 = await asUser(sellerExternal)
      .post("/api/v1/networks/listings")
      .send({ watch: String((watch as any)._id), type: "for_sale" });
    record(
      6,
      "POST",
      "/networks/listings",
      r6.status,
      [201],
      "create draft listing",
    );
    const draftListingId = r6.body?.data?._id;
    expect(draftListingId).toBeDefined();

    // 2) GET /networks/listings/:id/preview
    const r2 = await asUser(sellerExternal).get(
      `/api/v1/networks/listings/${draftListingId}/preview`,
    );
    record(
      2,
      "GET",
      "/networks/listings/:id/preview",
      r2.status,
      [200],
      "preview draft",
    );

    // 7) PATCH /networks/listings/:id
    const r7 = await asUser(sellerExternal)
      .patch(`/api/v1/networks/listings/${draftListingId}`)
      .send({
        subtitle: "Mint condition",
        description: "Full set and warranty card. Purchased new in 2024.",
        price: 14500,
        condition: "Used - Very Good",
        contents: "Box & Papers",
        images: [
          "https://cdn.example.com/listings/1.jpg",
          "https://cdn.example.com/listings/2.jpg",
          "https://cdn.example.com/listings/3.jpg",
        ],
        thumbnail: "https://cdn.example.com/listings/1.jpg",
        allow_offers: true,
        shipping: [
          { region: "US", shippingIncluded: false, shippingCost: 50 },
          {
            region: "International",
            shippingIncluded: false,
            shippingCost: 150,
          },
        ],
        reservation_terms: "Verified buyers only",
      });
    record(
      7,
      "PATCH",
      "/networks/listings/:id",
      r7.status,
      [200],
      "update draft details",
    );

    // 8) POST /networks/listings/:id/publish
    const r8 = await asUser(sellerExternal).post(
      `/api/v1/networks/listings/${draftListingId}/publish`,
    );
    record(
      8,
      "POST",
      "/networks/listings/:id/publish",
      r8.status,
      [200],
      "publish listing",
    );

    // 3) PATCH /networks/listings/:id/status
    const r3 = await asUser(sellerExternal)
      .patch(`/api/v1/networks/listings/${draftListingId}/status`)
      .send({ status: "active" });
    record(
      3,
      "PATCH",
      "/networks/listings/:id/status",
      r3.status,
      [200],
      "status patch",
    );

    // 9) GET /networks/listings/:id
    const r9 = await asUser(buyerExternal).get(
      `/api/v1/networks/listings/${draftListingId}`,
    );
    record(
      9,
      "GET",
      "/networks/listings/:id",
      r9.status,
      [200],
      "listing detail",
    );

    // 10) GET /networks/users/:id/profile
    const r10 = await asUser(buyerExternal).get(
      `/api/v1/networks/users/${(seller as any)._id}/profile`,
    );
    record(
      10,
      "GET",
      "/networks/users/:id/profile",
      r10.status,
      [200],
      "public profile",
    );

    // 11) GET /networks/users/:id/reviews
    const r11 = await asUser(buyerExternal).get(
      `/api/v1/networks/users/${(seller as any)._id}/reviews?role=seller&limit=20&offset=0`,
    );
    record(
      11,
      "GET",
      "/networks/users/:id/reviews",
      r11.status,
      [200],
      "reviews list",
    );

    // 12) GET /networks/users/:id/references
    const r12 = await asUser(buyerExternal).get(
      `/api/v1/networks/users/${(seller as any)._id}/references?role=requester&limit=20&offset=0`,
    );
    record(
      12,
      "GET",
      "/networks/users/:id/references",
      r12.status,
      [200],
      "references list",
    );

    // 13) POST /networks/listings/:id/concierge
    const r13 = await asUser(buyerExternal)
      .post(`/api/v1/networks/listings/${draftListingId}/concierge`)
      .send({ message: "Need authentication support for this piece." });
    record(
      13,
      "POST",
      "/networks/listings/:id/concierge",
      r13.status,
      [201],
      "concierge create",
    );

    // 14) POST /networks/listings/:id/reserve
    const r14 = await asUser(buyerExternal)
      .post(`/api/v1/networks/listings/${draftListingId}/reserve`)
      .send({ shipping_region: "US" });
    record(
      14,
      "POST",
      "/networks/listings/:id/reserve",
      r14.status,
      [201],
      "reserve listing",
    );
    const orderId = r14.body?.data?._id;
    expect(orderId).toBeDefined();

    // 15) GET /networks/reservations/:id
    const r15 = await asUser(buyerExternal).get(
      `/api/v1/networks/reservations/${orderId}`,
    );
    record(
      15,
      "GET",
      "/networks/reservations/:id",
      r15.status,
      [200],
      "reservation detail",
    );

    // 16) GET /networks/orders/:id
    const r16 = await asUser(buyerExternal).get(
      `/api/v1/networks/orders/${orderId}`,
    );
    record(
      16,
      "GET",
      "/networks/orders/:id",
      r16.status,
      [200],
      "order detail",
    );

    // 17) POST /networks/orders/:id/complete
    const r17 = await asUser(buyerExternal).post(
      `/api/v1/networks/orders/${orderId}/complete`,
    );
    record(
      17,
      "POST",
      "/networks/orders/:id/complete",
      r17.status,
      [200],
      "order completion confirm",
    );

    // Separate active listing for offer lifecycle
    const offerListing = await TestFactory.createNetworkListing(
      (seller as any)._id,
      {
        status: "active",
        allow_offers: true,
        price: 20000,
        author: { _id: (seller as any)._id, name: sellerName },
        ships_from: { country: "US" },
      },
    );

    // 18) POST /networks/listings/:id/offers
    const r18 = await asUser(buyerExternal)
      .post(`/api/v1/networks/listings/${(offerListing as any)._id}/offers`)
      .send({
        amount: 13000,
        shipping_region: "US",
        request_free_shipping: false,
        reservation_terms_snapshot: "Verified buyers only",
        message: "Can you do 13k?",
      });
    record(
      18,
      "POST",
      "/networks/listings/:id/offers",
      r18.status,
      [201],
      "send initial offer",
    );
    const channelId = r18.body?.data?._id;
    expect(channelId).toBeDefined();

    // 19) GET /networks/offers
    const r19 = await asUser(sellerExternal).get(
      "/api/v1/networks/offers?type=received&limit=20&offset=0",
    );
    record(19, "GET", "/networks/offers", r19.status, [200], "offers list");

    // 20) GET /networks/offers/:id
    const r20 = await asUser(buyerExternal).get(
      `/api/v1/networks/offers/${channelId}`,
    );
    record(
      20,
      "GET",
      "/networks/offers/:id",
      r20.status,
      [200],
      "offer channel detail",
    );

    // 21) POST /networks/offers/:id/counter
    const r21 = await asUser(sellerExternal)
      .post(`/api/v1/networks/offers/${channelId}/counter`)
      .send({
        amount: 13800,
        message: "Counter at 13.8k",
        reservation_terms: "Verified buyers only",
      });
    record(
      21,
      "POST",
      "/networks/offers/:id/counter",
      r21.status,
      [201],
      "counter offer",
    );

    // 22) POST /networks/offers/:id/accept
    const r22 = await asUser(buyerExternal).post(
      `/api/v1/networks/offers/${channelId}/accept`,
    );
    record(
      22,
      "POST",
      "/networks/offers/:id/accept",
      r22.status,
      [200],
      "accept offer",
    );

    // Create a second channel to validate reject path independently
    const rejectListing = await TestFactory.createNetworkListing(
      (seller as any)._id,
      {
        status: "active",
        allow_offers: true,
        price: 18000,
        author: { _id: (seller as any)._id, name: sellerName },
        ships_from: { country: "US" },
      },
    );

    const rOfferRejectSeed = await asUser(rejectBuyerExternal)
      .post(`/api/v1/networks/listings/${(rejectListing as any)._id}/offers`)
      .send({
        amount: 12000,
        shipping_region: "US",
        request_free_shipping: false,
        message: "Initial offer for reject flow",
      });
    record(
      23,
      "POST",
      "/networks/offers/:id/reject",
      (
        await asUser(sellerExternal).post(
          `/api/v1/networks/offers/${rOfferRejectSeed.body?.data?._id}/reject`,
        )
      ).status,
      [200],
      "reject offer",
    );

    // 24) GET /networks/users/:id/listings
    const r24 = await asUser(buyerExternal).get(
      `/api/v1/networks/users/${(seller as any)._id}/listings?status=active&type=for_sale&page=1&limit=10`,
    );
    record(
      24,
      "GET",
      "/networks/users/:id/listings",
      r24.status,
      [200],
      "public user listings",
    );

    // 25) POST /networks/users/:id/connections
    const r25 = await asUser(buyerExternal).post(
      `/api/v1/networks/users/${(target as any)._id}/connections`,
    );
    record(
      25,
      "POST",
      "/networks/users/:id/connections",
      r25.status,
      [201],
      "send connection request",
    );

    // 26) DELETE /networks/users/:id/connections
    const r26 = await asUser(buyerExternal).delete(
      `/api/v1/networks/users/${(target as any)._id}/connections`,
    );
    record(
      26,
      "DELETE",
      "/networks/users/:id/connections",
      r26.status,
      [200],
      "remove connection",
    );

    // 27) POST /networks/users/:id/report
    const r27 = await asUser(buyerExternal)
      .post(`/api/v1/networks/users/${(target as any)._id}/report`)
      .send({
        reason: "fraud",
        description: "Suspicious behavior during transaction.",
      });
    record(
      27,
      "POST",
      "/networks/users/:id/report",
      r27.status,
      [201],
      "report user",
    );

    // 28) POST /networks/users/:id/block
    const r28 = await asUser(buyerExternal)
      .post(`/api/v1/networks/users/${(target as any)._id}/block`)
      .send({ reason: "safety" });
    record(
      28,
      "POST",
      "/networks/users/:id/block",
      r28.status,
      [200],
      "block user",
    );

    // 29) DELETE /networks/users/:id/block
    const r29 = await asUser(buyerExternal).delete(
      `/api/v1/networks/users/${(target as any)._id}/block`,
    );
    record(
      29,
      "DELETE",
      "/networks/users/:id/block",
      r29.status,
      [200],
      "unblock user",
    );

    // 4) DELETE /networks/listings/:id (use standalone draft listing)
    const deleteCandidate = await TestFactory.createNetworkListing(
      (seller as any)._id,
      {
        status: "draft",
        author: { _id: (seller as any)._id, name: sellerName },
        ships_from: { country: "US" },
      },
    );

    const r4 = await asUser(sellerExternal).delete(
      `/api/v1/networks/listings/${(deleteCandidate as any)._id}`,
    );
    record(
      4,
      "DELETE",
      "/networks/listings/:id",
      r4.status,
      [200],
      "delete listing",
    );

    const passCount = results.filter((r) => r.ok).length;
    const failCount = results.length - passCount;

    const report = {
      generatedAt: new Date().toISOString(),
      scope: "Batch 3 API Spec (29 endpoints)",
      totals: {
        total: results.length,
        pass: passCount,
        fail: failCount,
      },
      results,
    };

    fs.writeFileSync(
      path.join(process.cwd(), "logs", "batch3-api-spec-verification.json"),
      JSON.stringify(report, null, 2),
      "utf-8",
    );

    expect(results).toHaveLength(29);
    expect(failCount).toBe(0);
  });
});
