import { events } from "../../utils/events";
import { MarketplaceListing } from "../../models/Listings";
import logger from "../../utils/logger";

export function registerMarketplaceEventHandlers(): void {
  logger.info("Registering Marketplace event handlers...");

  events.on("getstream:message.new", async ({ listingId }) => {
    try {
      await MarketplaceListing.findByIdAndUpdate(listingId, {
        $inc: { engagement_count: 1 },
        $set: { last_engagement: new Date() },
      });
      logger.debug("Marketplace updated listing engagement", { listingId });
    } catch (error) {
      logger.error("Failed to update listing engagement in Marketplace", { error, listingId });
    }
  });

  logger.info("Marketplace event handlers registered successfully.");
}
