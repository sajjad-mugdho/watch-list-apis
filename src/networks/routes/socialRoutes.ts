// src/networks/routes/socialRoutes.ts
import { Router } from "express";
import * as hubHandlers from "../handlers/SocialHubHandlers";
import * as groupHandlers from "../handlers/SocialGroupHandlers";
import * as inviteHandlers from "../handlers/SocialInviteHandlers";

import {
  createGroupSchema,
  joinGroupSchema,
  getSocialInboxSchema,
  searchSocialSchema,
} from "../../validation/schemas";
import { validateRequest } from "../../middleware/validation";

const router = Router();

/**
 * @swagger
 * /api/v1/networks/social/status:
 *   get:
 *     summary: Get social hub status summary
 *     tags: [Social Hub]
 */
router.get("/status", hubHandlers.social_status_get as any);

/**
 * @swagger
 * /api/v1/networks/social/inbox:
 *   get:
 *     summary: Get unified social inbox
 *     tags: [Social Hub]
 */
router.get(
  "/inbox",
  validateRequest(getSocialInboxSchema),
  hubHandlers.social_inbox_get as any,
);

/**
 * @swagger
 * /api/v1/networks/social/search:
 *   get:
 *     summary: Multi-entity search
 *     tags: [Social Hub]
 */
router.get(
  "/search",
  validateRequest(searchSocialSchema),
  hubHandlers.social_search_get,
);

/**
 * @swagger
 * /api/v1/networks/social/discover:
 *   get:
 *     summary: Recommended people and groups
 *     tags: [Social Hub]
 */
router.get("/discover", hubHandlers.social_discover_get);
router.get("/conversations/:id/content", hubHandlers.social_shared_content_get);
router.get("/conversations/:id/search", hubHandlers.social_chat_search_get);
router.get(
  "/conversations/:id/events",
  hubHandlers.social_conversation_events_get,
);
router.get("/chat-profile/:userId", hubHandlers.social_chat_profile_get);

/**
 * @swagger
 * /api/v1/networks/social/groups:
 *   get:
 *     summary: List public groups and groups the current user belongs to
 *     tags: [Social Hub | Groups]
 */
router.get("/groups", groupHandlers.social_group_get_all);

/**
 * @swagger
 * /api/v1/networks/social/groups/{id}:
 *   get:
 *     summary: Get a single social group
 *     tags: [Social Hub | Groups]
 */
router.get("/groups/:id", groupHandlers.social_group_get);

/**
 * @swagger
 * /api/v1/networks/social/groups:
 *   post:
 *     summary: Create a social group
 *     tags: [Social Hub | Groups]
 */
router.post(
  "/groups",
  validateRequest(createGroupSchema),
  groupHandlers.social_group_create,
);

/**
 * @swagger
 * /api/v1/networks/social/groups/{group_id}/join:
 *   post:
 *     summary: Join a group
 *     tags: [Social Hub | Groups]
 */
router.post(
  "/groups/:group_id/join",
  validateRequest(joinGroupSchema),
  groupHandlers.social_group_join,
);

/**
 * @swagger
 * /api/v1/networks/social/groups/{group_id}/leave:
 *   delete:
 *     summary: Leave a group
 *     tags: [Social Hub | Groups]
 */
router.delete(
  "/groups/:group_id/leave",
  validateRequest(joinGroupSchema),
  groupHandlers.social_group_leave,
);
// Group member endpoints
router.get("/groups/:id/members", groupHandlers.social_group_members_list);
router.post("/groups/:id/members", groupHandlers.social_group_members_add);
router.delete(
  "/groups/:id/members/:userId",
  groupHandlers.social_group_members_remove,
);
router.patch(
  "/groups/:id/members/:userId/role",
  groupHandlers.social_group_member_role_update,
);
router.post("/groups/:id/mute", groupHandlers.social_group_mute);

// Group shared content endpoints
router.get(
  "/groups/:id/shared-links",
  groupHandlers.social_group_shared_links_get,
);
router.post(
  "/groups/:id/shared-links",
  groupHandlers.social_group_shared_links_post,
);
router.get(
  "/groups/:id/shared-media",
  groupHandlers.social_group_shared_media_get,
);
router.get(
  "/groups/:id/shared-files",
  groupHandlers.social_group_shared_files_get,
);

/**
 * @swagger
 * /api/v1/networks/social/invites:
 *   post:
 *     summary: Create a social invite link
 *     tags: [Social Hub | Invites]
 */
router.post("/invites", inviteHandlers.social_invite_create);

/**
 * @swagger
 * /api/v1/networks/social/invites/{token}:
 *   get:
 *     summary: Validate/Get an invite token
 *     tags: [Social Hub | Invites]
 */
router.get("/invites/:token", inviteHandlers.social_invite_get);

export default router;
