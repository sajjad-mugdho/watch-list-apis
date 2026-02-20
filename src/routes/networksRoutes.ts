// networksRoutes.ts
import { Router } from "express";
import { networksUser } from "./user/networksUser";
import { networksListings } from "./listings/networksListings";
import { networksOfferRoutes } from "./offers/networksOffers";
import { networksPublicUsers } from "./users/networksUsers";
import { networksChannelRoutes } from "./channels/networksChannels";
import { networksConversationRoutes } from "./conversations/networksConversationRoutes";
import { networksChatRoutes } from "./chat/networksChatRoutes";
import { networksMessageRoutes } from "./messages/networksMessageRoutes";

const router: Router = Router();

router
  .use("/user", networksUser)
  .use("/listings", networksListings)
  .use("/offers", networksOfferRoutes)
  .use("/channels", networksChannelRoutes)  // NEW: Platform-explicit channels
  .use("/users", networksPublicUsers)
  .use("/conversations", networksConversationRoutes)
  .use("/chat", networksChatRoutes)
  .use("/messages", networksMessageRoutes);

export { router as networksRoutes };
