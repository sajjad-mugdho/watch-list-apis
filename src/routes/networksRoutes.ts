// networksRoutes.ts
import { Router } from "express";
import { networksUser } from "./user/networksUser";
import { networksListings } from "./listings/networksListings";
import { networksOfferRoutes } from "./offers/networksOffers";
import { networksPublicUsers } from "./users/networksUsers";
import { networksChannelRoutes } from "./channels/networksChannels";

const router: Router = Router();

router
  .use("/user", networksUser)
  .use("/listings", networksListings)
  .use("/offers", networksOfferRoutes)
  .use("/channels", networksChannelRoutes)  // NEW: Platform-explicit channels
  .use("/users", networksPublicUsers);

export { router as networksRoutes };
