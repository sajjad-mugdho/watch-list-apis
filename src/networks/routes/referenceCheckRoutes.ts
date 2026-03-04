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
} from "../handlers/NetworksReferenceCheckHandlers";
import { rateLimiters } from "../../middleware/operational";

const router = Router();

/**
 * Reference Check Routes
 */
router.post(
  "/",
  rateLimiters.referenceCheckCreate,
  networks_reference_check_create as any
);

router.get(
  "/",
  networks_reference_checks_get as any
);

router.get(
  "/:id",
  networks_reference_check_get as any
);

router.post(
  "/:id/respond",
  networks_reference_check_respond as any
);

router.post(
  "/:id/complete",
  networks_reference_check_complete as any
);

router.delete(
  "/:id",
  networks_reference_check_delete as any
);

router.post(
  "/:id/vouch",
  rateLimiters.vouchCreate,
  networks_reference_check_vouch as any
);

router.get(
  "/:id/vouches",
  networks_reference_check_vouches_get as any
);

router.post(
  "/:id/suspend",
  networks_reference_check_suspend as any
);

export default router;
