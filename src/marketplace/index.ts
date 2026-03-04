import { Router } from "express";
import listingRoutes from "./routes/listingRoutes";
import offerRoutes from "./routes/offerRoutes";
import orderRoutes from "./routes/orderRoutes";
import merchantRoutes from "./routes/merchantRoutes";
import chatRoutes from "./routes/chatRoutes";
import messageRoutes from "./routes/messageRoutes";
import conversationRoutes from "./routes/conversationRoutes";
import userRoutes from "./routes/userRoutes";

import { registerMarketplaceEventHandlers } from "./events";

// Initialize marketplace specific domain listeners
registerMarketplaceEventHandlers();

const router = Router();

router.use("/user", userRoutes);
router.use("/merchant", merchantRoutes);
router.use("/listings", listingRoutes);
router.use("/offers", offerRoutes);
router.use("/orders", orderRoutes);
router.use("/chat", chatRoutes);
router.use("/messages", messageRoutes);
router.use("/conversations", conversationRoutes);

export default router;
