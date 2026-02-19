import { Router } from "express";
import * as messageHandlers from "../../handlers/messageHandlers";

const router = Router();

router.post("/send", messageHandlers.sendMessage("marketplace"));
router.get("/channel/:channelId", messageHandlers.getChannelMessages("marketplace"));
router.put("/:id", messageHandlers.updateMessage("marketplace"));
router.delete("/:id", messageHandlers.deleteMessage("marketplace"));
router.post("/:id/read", messageHandlers.markAsRead("marketplace"));
router.post("/channel/:channelId/read-all", messageHandlers.markAllAsRead("marketplace"));
router.post("/:id/react", messageHandlers.reactToMessage("marketplace"));
router.post("/channel/:channelId/archive", messageHandlers.archiveChannel("marketplace"));

export { router as marketplaceMessageRoutes };
