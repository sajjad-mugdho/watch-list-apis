import { Router } from "express";
import * as messageHandlers from "../handlers/NetworksMessageHandlers";

const router = Router();

router.post("/send", messageHandlers.sendMessage("networks") as any);
router.get("/channel/:channelId", messageHandlers.getChannelMessages("networks") as any);
router.put("/:id", messageHandlers.updateMessage("networks") as any);
router.delete("/:id", messageHandlers.deleteMessage("networks") as any);
router.post("/:id/read", messageHandlers.markAsRead("networks") as any);
router.post("/channel/:channelId/read-all", messageHandlers.markAllAsRead("networks") as any);
router.post("/:id/react", messageHandlers.reactToMessage("networks") as any);
router.post("/channel/:channelId/archive", messageHandlers.archiveChannel("networks") as any);

export default router;
