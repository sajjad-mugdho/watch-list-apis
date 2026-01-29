/**
 * Support Ticket Routes (Gap Fill Phase 7)
 * 
 * User-facing endpoints for support ticket management
 * 
 * Mounted at: /api/v1/user/support
 */

import { Router, Request, Response, NextFunction } from "express";
import { getUserId } from "../../middleware/attachUser";
import { validateRequest } from "../../middleware/validation";
import {
  createSupportTicketSchema,
  getTicketSchema,
  addTicketMessageSchema,
  getUserTicketsSchema,
} from "../../validation/schemas";
import { supportTicketService } from "../../services/support/SupportTicketService";
import { TicketStatus, TicketCategory, TicketPriority } from "../../models/SupportTicket";
import { createdResponse, paginatedResponse, successResponse, errorResponse } from "../../utils/apiResponse";

const router = Router();

// ----------------------------------------------------------
// Create Ticket
// ----------------------------------------------------------

/**
 * @route POST /api/v1/user/support/tickets
 * @desc Create a new support ticket
 */
router.post(
  "/tickets",
  validateRequest(createSupportTicketSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user_id = getUserId(req);
      const { subject, category, priority, message, related_order_id, related_listing_id } = req.body;

      const ticket = await supportTicketService.createTicket({
        user_id,
        subject,
        category: category as TicketCategory,
        priority: priority as TicketPriority | undefined,
        message,
        related_order_id,
        related_listing_id,
      });

      res.status(201).json(createdResponse(req, ticket.toJSON(), "Support ticket created successfully"));
    } catch (err) {
      next(err);
    }
  }
);

// ----------------------------------------------------------
// Get Tickets
// ----------------------------------------------------------

/**
 * @route GET /api/v1/user/support/tickets
 * @desc Get current user's support tickets
 */
router.get(
  "/tickets",
  validateRequest(getUserTicketsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user_id = getUserId(req);
      const { status, limit = 20, offset = 0 } = req.query;

      const { tickets, total } = await supportTicketService.getUserTickets(
        user_id,
        {
          status: status as TicketStatus | undefined,
          limit: Number(limit),
          offset: Number(offset),
        }
      );

      res.json(paginatedResponse(req, tickets, {
        total,
        limit: Number(limit),
        offset: Number(offset),
        ...(status ? { filters: { status } } : {}),
      }));
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route GET /api/v1/user/support/tickets/:ticket_id
 * @desc Get a specific ticket
 */
router.get(
  "/tickets/:ticket_id",
  validateRequest(getTicketSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user_id = getUserId(req);
      const { ticket_id } = req.params;

      const ticket = await supportTicketService.getTicket(ticket_id, user_id);

      res.json(successResponse(req, ticket.toJSON()));
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("not found") || err.message.includes("Not authorized")) {
          res.status(404).json(errorResponse(req, err.message, "NOT_FOUND"));
          return;
        }
      }
      next(err);
    }
  }
);

// ----------------------------------------------------------
// Reply to Ticket
// ----------------------------------------------------------

/**
 * @route POST /api/v1/user/support/tickets/:ticket_id/messages
 * @desc Add a message to a ticket
 */
router.post(
  "/tickets/:ticket_id/messages",
  validateRequest(addTicketMessageSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user_id = getUserId(req);
      const { ticket_id } = req.params;
      const { message, attachments } = req.body;

      const ticket = await supportTicketService.addMessage({
        ticket_id,
        sender_id: user_id,
        sender_type: "user",
        message,
        attachments,
      });

      res.json({
        data: ticket.toJSON(),
        message: "Message added successfully",
      });
    } catch (err) {
      if (err instanceof Error) {
        if (
          err.message.includes("not found") ||
          err.message.includes("Not authorized") ||
          err.message.includes("Cannot reply")
        ) {
          res.status(400).json({ error: err.message });
          return;
        }
      }
      next(err);
    }
  }
);

// ----------------------------------------------------------
// Reopen Ticket
// ----------------------------------------------------------

/**
 * @route POST /api/v1/user/support/tickets/:ticket_id/reopen
 * @desc Reopen a resolved or closed ticket
 */
router.post(
  "/tickets/:ticket_id/reopen",
  validateRequest(getTicketSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user_id = getUserId(req);
      const { ticket_id } = req.params;

      const ticket = await supportTicketService.reopenTicket(ticket_id, user_id);

      res.json({
        data: ticket.toJSON(),
        message: "Ticket reopened successfully",
      });
    } catch (err) {
      if (err instanceof Error) {
        if (
          err.message.includes("not found") ||
          err.message.includes("Not authorized") ||
          err.message.includes("Can only reopen")
        ) {
          res.status(400).json({ error: err.message });
          return;
        }
      }
      next(err);
    }
  }
);

// ----------------------------------------------------------
// Get Open Tickets Count
// ----------------------------------------------------------

/**
 * @route GET /api/v1/user/support/tickets/count/open
 * @desc Get count of open tickets
 */
router.get(
  "/tickets/count/open",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user_id = getUserId(req);
      const count = await supportTicketService.getOpenTicketsCount(user_id);

      res.json({
        data: { count },
      });
    } catch (err) {
      next(err);
    }
  }
);

export { router as userSupportRoutes };
