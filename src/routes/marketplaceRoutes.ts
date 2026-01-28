import { Router } from "express";
import { marketplaceUser } from "./user/marketplaceUser";
import { marketplaceListings } from "./listings/marketplaceListings";
import { marketplaceOfferRoutes } from "./offers/marketplaceOffers";
import { marketplacePublicUsers } from "./users/marketplaceUsers";
import { marketplaceMerchantRoutes } from "./merchant/marketplaceMerchant";
import { marketplaceChannelRoutes } from "./channels/marketplaceChannels";
import { orderRoutes } from "./orderRoutes";
import { refundRequestRoutes } from "./refundRequestRoutes";
const router: Router = Router();

router
  .use("/user", marketplaceUser)
  .use("/listings", marketplaceListings)
  .use("/offers", marketplaceOfferRoutes)
  .use("/channels", marketplaceChannelRoutes)  // NEW: Platform-explicit channels
  .use("/users", marketplacePublicUsers)
  .use("/merchant", marketplaceMerchantRoutes)
  .use("/orders", orderRoutes)
  .use("/refund-requests", refundRequestRoutes);

export { router as marketplaceRoutes };
