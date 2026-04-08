import { Router } from "express";
import {
  networks_reference_check_create,
  networks_reference_checks_get,
  networks_reference_check_get,
  networks_reference_check_respond,
  networks_reference_check_complete,
  networks_reference_check_delete,
  networks_reference_check_vouch,
  networks_reference_check_vouches_get,
  networks_reference_check_suspend,
  networks_reference_check_trust_safety_status_get,
  networks_reference_check_trust_safety_appeal,
  networks_reference_check_summary_get,
  networks_reference_check_context_get,
  networks_reference_check_progress_get,
  networks_reference_check_vouch_policy_get,
  networks_reference_check_feedback_create,
  networks_reference_check_feedback_get,
  networks_reference_check_audit_get,
  networks_reference_check_share_link_create,
} from "../handlers/NetworksReferenceCheckHandlers";
import { rateLimiters } from "../../middleware/operational";
import { validateRequest } from "../../middleware/validation";
import { getReferenceChecksSchema } from "../../validation/schemas";

const router = Router();

/**
 * Reference Check Routes
 */
router.post(
  "/",
  rateLimiters.referenceCheckCreate,
  networks_reference_check_create as any,
);

router.get(
  "/",
  validateRequest(getReferenceChecksSchema),
  networks_reference_checks_get as any,
);

router.get("/:id", networks_reference_check_get as any);

router.post("/:id/respond", networks_reference_check_respond as any);

router.post("/:id/complete", networks_reference_check_complete as any);

router.delete("/:id", networks_reference_check_delete as any);

router.post(
  "/:id/vouch",
  rateLimiters.vouchCreate,
  networks_reference_check_vouch as any,
);

router.get("/:id/vouches", networks_reference_check_vouches_get as any);

router.get("/:id/summary", networks_reference_check_summary_get as any);

router.get("/:id/context", networks_reference_check_context_get as any);

router.get("/:id/progress", networks_reference_check_progress_get as any);

router.get(
  "/:id/vouch-policy",
  networks_reference_check_vouch_policy_get as any,
);

router.post("/:id/feedback", networks_reference_check_feedback_create as any);

router.get("/:id/feedback", networks_reference_check_feedback_get as any);

router.get("/:id/audit", networks_reference_check_audit_get as any);

router.post(
  "/:id/share-link",
  networks_reference_check_share_link_create as any,
);

router.post("/:id/suspend", networks_reference_check_suspend as any);

router.get(
  "/:id/trust-safety/status",
  networks_reference_check_trust_safety_status_get as any,
);

router.post(
  "/:id/trust-safety/appeal",
  networks_reference_check_trust_safety_appeal as any,
);

export default router;
