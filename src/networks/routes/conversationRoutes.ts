import { Router, Request, Response, NextFunction } from "express";
import * as conversationHandlers from "../handlers/NetworksConversationHandlers";

const router = Router();

router.get("/", conversationHandlers.getConversations);
router.get("/search", conversationHandlers.searchConversations);
router.get("/:id", conversationHandlers.getConversationContext);
router.get("/:id/media", conversationHandlers.getConversationMedia);

// Convenience aliases for shared content by type
router.get(
  "/:id/shared/media",
  (req: Request, res: Response, next: NextFunction) => {
    req.query.type = "media";
    conversationHandlers.getConversationMedia(req, res, next);
  },
);
router.get(
  "/:id/shared/files",
  (req: Request, res: Response, next: NextFunction) => {
    req.query.type = "files";
    conversationHandlers.getConversationMedia(req, res, next);
  },
);
router.get(
  "/:id/shared/links",
  (req: Request, res: Response, next: NextFunction) => {
    req.query.type = "links";
    conversationHandlers.getConversationMedia(req, res, next);
  },
);

export default router;
