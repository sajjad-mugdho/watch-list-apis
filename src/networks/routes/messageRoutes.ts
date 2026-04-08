import { Router } from "express";
import * as messageHandlers from "../handlers/NetworksMessageHandlers";
import * as conversationHandlers from "../handlers/NetworksConversationHandlers";

const router = Router();

const getNetworkChannelMessages = messageHandlers.getChannelMessages(
  "networks",
) as any;

// Compatibility aliases for docs/frontend taxonomy
router.get("/chats", conversationHandlers.getConversations as any);
router.get("/chats/search", conversationHandlers.searchConversations as any);
router.get("/:chatId/history", (req, res, next) => {
  (req.params as any).channelId = (req.params as any).chatId;
  getNetworkChannelMessages(req, res, next);
});

router.post("/send", messageHandlers.sendMessage("networks") as any);
router.get(
  "/channel/:channelId",
  messageHandlers.getChannelMessages("networks") as any,
);
router.put("/:id", messageHandlers.updateMessage("networks") as any);
router.delete("/:id", messageHandlers.deleteMessage("networks") as any);
router.post("/:id/read", messageHandlers.markAsRead("networks") as any);
router.post(
  "/channel/:channelId/read-all",
  messageHandlers.markAllAsRead("networks") as any,
);
router.post("/:id/react", messageHandlers.reactToMessage("networks") as any);
router.post(
  "/channel/:channelId/archive",
  messageHandlers.archiveChannel("networks") as any,
);

export default router;
