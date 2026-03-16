import { Router } from "express";
import listingRoutes from "./routes/listingRoutes";
import offerRoutes from "./routes/offerRoutes";
import chatRoutes from "./routes/chatRoutes";
import messageRoutes from "./routes/messageRoutes";
import conversationRoutes from "./routes/conversationRoutes";
import referenceCheckRoutes from "./routes/referenceCheckRoutes";
import userRoutes from "./routes/userRoutes";
import searchRoutes from "./routes/searchRoutes";
import connectionRoutes from "./routes/connectionRoutes";
import socialRoutes from "./routes/socialRoutes";
import orderRoutes from "./routes/orderRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import { usersRoutes } from "./routes/usersRoutes";

import { registerNetworksEventHandlers } from "./events";

// Initialize networks specific domain listeners
registerNetworksEventHandlers();

const router = Router();

router.use("/user", userRoutes);
router.use("/users", usersRoutes);
router.use("/listings", listingRoutes);
router.use("/offers", offerRoutes);
router.use("/chat", chatRoutes);
router.use("/messages", messageRoutes);
router.use("/conversations", conversationRoutes);
router.use("/reference-checks", referenceCheckRoutes);

router.use("/search", searchRoutes);
router.use("/connections", connectionRoutes);
router.use("/social", socialRoutes);
router.use("/orders", orderRoutes);
router.use("/notifications", notificationRoutes);

export default router;
