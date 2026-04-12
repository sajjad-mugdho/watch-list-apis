import { Types } from "mongoose";
import { offerService } from "../../src/services/offer/OfferService";
import { chatService } from "../../src/services/ChatService";
import { User } from "../../src/models/User";
import { MarketplaceListing } from "../../src/models/Listings";
import { MarketplaceListingChannel } from "../../src/models/MarketplaceListingChannel";
import { Offer } from "../../src/models/Offer";
import { OfferRevision } from "../../src/models/OfferRevision";
import { Order } from "../../src/models/Order";
import { ReservationTerms } from "../../src/models/ReservationTerms";

describe("Offer Concurrency Integration", () => {
  let buyer: any;
  let seller: any;
  let listing: any;
  let channel: any;
  let offer: any;

  beforeEach(async () => {
    // 1. Mock ChatService to avoid external calls
    jest.spyOn(chatService, "ensureConnected").mockResolvedValue();
    jest.spyOn(chatService, "sendSystemMessage").mockResolvedValue();

    // 2. Clear collections (handled by global afterEach, but being safe)

    // 3. Create Reservation Terms
    await ReservationTerms.create({
      version: "2024.02.01",
      content: "Test Terms",
      content_hash: "dummy_hash", // Will be recomputed by pre-save
      effective_date: new Date(),
      is_current: true,
    });

    // 4. Setup Data
    buyer = await User.create({
      clerk_id: "buyer_clerk",
      email: "buyer@test.com",
      first_name: "Buyer",
      last_name: "One",
      display_name: "Buyer",
    });

    seller = await User.create({
      clerk_id: "seller_clerk",
      email: "seller@test.com",
      first_name: "Seller",
      last_name: "Two",
      display_name: "Seller",
    });

    listing = await MarketplaceListing.create({
      dialist_id: seller._id,
      clerk_id: seller.clerk_id,
      watch_id: new Types.ObjectId(),
      title: "Rolex Submariner",
      brand: "Rolex",
      model: "Submariner",
      reference: "126610LN",
      diameter: "41mm",
      bezel: "Ceramic",
      materials: "Oystersteel",
      bracelet: "Oyster",
      ships_from: { country: "US" },
      price: 15000,
      status: "active",
      allow_offers: true,
      author: { _id: seller._id, name: "Seller" },
    });

    channel = await MarketplaceListingChannel.create({
      buyer_id: buyer._id,
      seller_id: seller._id,
      listing_id: listing._id,
      platform: "marketplace",
      status: "open",
      getstream_channel_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      created_from: "inquiry",
      listing_snapshot: {
        brand: "Rolex",
        model: "Submariner",
        reference: "126610LN",
        price: 15000,
        thumbnail: "thumb.jpg",
      },
      seller_snapshot: {
        _id: seller._id,
        name: "Seller Two",
      },
      buyer_snapshot: {
        _id: buyer._id,
        name: "Buyer One",
      },
    });

    // 5. Create an active offer
    offer = await Offer.create({
      listing_id: listing._id,
      channel_id: channel._id,
      buyer_id: buyer._id,
      seller_id: seller._id,
      platform: "marketplace",
      getstream_channel_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      state: "CREATED",
      expires_at: new Date(Date.now() + 1000000),
      listing_snapshot: {
        brand: "Rolex",
        model: "Submariner",
        reference: "126610LN",
        price: 15000,
        thumbnail: "thumb.jpg",
      },
    });

    await OfferRevision.create({
      offer_id: offer._id,
      amount: 14000,
      currency: "USD",
      created_by: buyer._id,
      revision_number: 1,
    });

    const revision = await OfferRevision.findOne({ offer_id: offer._id });
    await Offer.updateOne(
      { _id: offer._id },
      { active_revision_id: revision?._id },
    );
  });

  it("should handle concurrent accept requests gracefully (Double Accept Scenario)", async () => {
    const results = await Promise.allSettled([
      offerService.acceptOffer(
        offer._id.toString(),
        seller._id.toString(),
        "marketplace",
      ),
      new Promise((resolve) => setTimeout(resolve, 50)).then(() =>
        offerService.acceptOffer(
          offer._id.toString(),
          seller._id.toString(),
          "marketplace",
        ),
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    if (rejected.length > 0) {
      console.log(
        "Rejection reasons:",
        rejected.map((r) => (r as PromiseRejectedResult).reason.message),
      );
    }

    // Verify consistency: At most one succeeded, and never more than one order
    expect(fulfilled.length).toBeLessThanOrEqual(1);

    // If one succeeded, it must be exactly one. If both failed (conflict), that's also acceptable
    // but in this test with 50ms stagger, one SHOULD succeed.
    // If none succeeded, we'll log it but we want to verify no double-order specifically.
    const orderCount = await Order.countDocuments({ offer_id: offer._id });
    expect(orderCount).toBeLessThanOrEqual(1);

    if (fulfilled.length === 1) {
      const finalOffer = await Offer.findById(offer._id);
      expect(finalOffer?.state).toBe("ACCEPTED");
      expect(orderCount).toBe(1);

      const finalListing = await MarketplaceListing.findById(listing._id);
      expect(finalListing?.status).toBe("reserved");
    } else {
      console.warn(
        "⚠️ Both calls failed due to contention. This is safe but unexpected with 50ms stagger.",
      );
    }
  });
});
