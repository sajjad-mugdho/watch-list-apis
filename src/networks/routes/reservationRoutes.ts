import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middleware/validation";
import { networks_reservation_get } from "../handlers/NetworksReservationHandlers";

const router = Router();

const reservationIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid reservation ID"),
  }),
});

router.get(
  "/:id",
  validateRequest(reservationIdParamSchema),
  networks_reservation_get as any,
);

export default router;
