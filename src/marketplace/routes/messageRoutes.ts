import { Router } from "express";
import * as messageHandlers from "../handlers/MarketplaceMessageHandlers";

const router = Router();

router.post("/send", messageHandlers.sendMessage("marketplace") as any);
router.get("/channel/:channelId", messageHandlers.getChannelMessages("marketplace") as any);
router.put("/:id", messageHandlers.updateMessage("marketplace") as any);
router.delete("/:id", messageHandlers.deleteMessage("marketplace") as any);
router.post("/:id/read", messageHandlers.markAsRead("marketplace") as any);
router.post("/channel/:channelId/read-all", messageHandlers.markAllAsRead("marketplace") as any);
router.post("/:id/react", messageHandlers.reactToMessage("marketplace") as any);
router.post("/channel/:channelId/archive", messageHandlers.archiveChannel("marketplace") as any);

export default router;
