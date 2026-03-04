// src/networks/routes/reservationRoutes.ts
import { Router } from "express";
import {
  networks_reservation_create,
  networks_reservation_get,
} from "../handlers/NetworksReservationHandlers";
import { validateRequest } from "../../middleware/validation";
import { createReservationSchema } from "../../validation/schemas";

const router = Router();

router.post(
  "/",
  validateRequest(createReservationSchema),
  networks_reservation_create as any
);

router.get("/:id", networks_reservation_get as any);

export default router;
