import { Router } from "express";
import listingRoutes from "./routes/listingRoutes";
import offerRoutes from "./routes/offerRoutes";
import chatRoutes from "./routes/chatRoutes";
import messageRoutes from "./routes/messageRoutes";
import conversationRoutes from "./routes/conversationRoutes";
import referenceCheckRoutes from "./routes/referenceCheckRoutes";
import reservationRoutes from "./routes/reservationRoutes";
import userRoutes from "./routes/userRoutes";
import searchRoutes from "./routes/searchRoutes";
import connectionRoutes from "./routes/connectionRoutes";
import socialRoutes from "./routes/socialRoutes";
import orderRoutes from "./routes/orderRoutes";

const router = Router();

router.use("/user", userRoutes);
router.use("/listings", listingRoutes);
router.use("/offers", offerRoutes);
router.use("/chat", chatRoutes);
router.use("/messages", messageRoutes);
router.use("/conversations", conversationRoutes);
router.use("/reference-checks", referenceCheckRoutes);
router.use("/reservations", reservationRoutes);
router.use("/search", searchRoutes);
router.use("/connections", connectionRoutes);
router.use("/social", socialRoutes);
router.use("/orders", orderRoutes);

export default router;
