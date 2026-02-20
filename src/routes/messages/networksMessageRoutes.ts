import { Router } from "express";
import * as messageHandlers from "../../handlers/messageHandlers";

const router = Router();

router.post("/send", messageHandlers.sendMessage("networks"));
router.get("/channel/:channelId", messageHandlers.getChannelMessages("networks"));
router.put("/:id", messageHandlers.updateMessage("networks"));
router.delete("/:id", messageHandlers.deleteMessage("networks"));
router.post("/:id/read", messageHandlers.markAsRead("networks"));
router.post("/channel/:channelId/read-all", messageHandlers.markAllAsRead("networks"));
router.post("/:id/react", messageHandlers.reactToMessage("networks"));
router.post("/channel/:channelId/archive", messageHandlers.archiveChannel("networks"));

export { router as networksMessageRoutes };
