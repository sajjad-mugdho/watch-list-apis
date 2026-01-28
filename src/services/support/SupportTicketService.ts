/**
 * SupportTicket Service (Gap Fill Phase 7)
 * 
 * Business logic for support ticket management
 */

import { Types } from "mongoose";
import { 
  SupportTicket, 
  ISupportTicket, 
  TicketStatus, 
  TicketCategory, 
  TicketPriority 
} from "../../models/SupportTicket";
import { NotificationService } from "../notification/NotificationService";
import logger from "../../utils/logger";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export interface CreateTicketInput {
  user_id: string;
  subject: string;
  category: TicketCategory;
  priority?: TicketPriority | undefined;
  message: string;
  related_order_id?: string | undefined;
  related_listing_id?: string | undefined;
}

export interface AddMessageInput {
  ticket_id: string;
  sender_id: string;
  sender_type: "user" | "support";
  message: string;
  attachments?: string[];
}

// ----------------------------------------------------------
// Service Class
// ----------------------------------------------------------

export class SupportTicketService {
  private notificationService: NotificationService;
  
  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }
  
  /**
   * Create a new support ticket
   */
  async createTicket(input: CreateTicketInput): Promise<ISupportTicket> {
    const {
      user_id,
      subject,
      category,
      priority = "medium",
      message,
      related_order_id,
      related_listing_id,
    } = input;
    
    // Create ticket with initial message
    const ticket = await SupportTicket.create({
      user_id: new Types.ObjectId(user_id),
      subject,
      category,
      priority,
      status: "open",
      messages: [{
        sender_id: new Types.ObjectId(user_id),
        sender_type: "user",
        message,
        attachments: [],
        created_at: new Date(),
      }],
      ...(related_order_id ? { related_order_id: new Types.ObjectId(related_order_id) } : {}),
      ...(related_listing_id ? { related_listing_id: new Types.ObjectId(related_listing_id) } : {}),
    });
    
    // Notify user of ticket creation
    try {
      await this.notificationService.create({
        userId: user_id,
        type: "ticket_created",
        title: "Support Ticket Created",
        body: `Your ticket #${ticket._id.toString().slice(-6).toUpperCase()} has been received`,
        data: {
          ticket_id: ticket._id.toString(),
          category,
        },
      });
    } catch (err) {
      logger.warn("Failed to send ticket created notification", { err, ticket_id: ticket._id });
    }
    
    logger.info("Support ticket created", {
      ticket_id: ticket._id,
      user_id,
      category,
      priority,
    });
    
    return ticket;
  }
  
  /**
   * Get a ticket by ID (with authorization check)
   */
  async getTicket(ticketId: string, userId: string, isSupport = false): Promise<ISupportTicket> {
    const ticket = await SupportTicket.findById(ticketId)
      .populate("user_id", "display_name email avatar");
    
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    
    // Authorization: only owner or support can view
    if (!isSupport && ticket.user_id.toString() !== userId) {
      throw new Error("Not authorized to view this ticket");
    }
    
    return ticket;
  }
  
  /**
   * Get user's tickets
   */
  async getUserTickets(
    userId: string,
    options: { status?: TicketStatus | undefined; limit?: number | undefined; offset?: number | undefined } = {}
  ): Promise<{ tickets: ISupportTicket[]; total: number }> {
    const { status, limit = 20, offset = 0 } = options;
    
    const query: Record<string, any> = {
      user_id: new Types.ObjectId(userId),
    };
    
    if (status) {
      query.status = status;
    }
    
    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(query),
    ]);
    
    return { tickets: tickets as unknown as ISupportTicket[], total };
  }
  
  /**
   * Add a message to a ticket
   */
  async addMessage(input: AddMessageInput): Promise<ISupportTicket> {
    const { ticket_id, sender_id, sender_type, message, attachments } = input;
    
    const ticket = await SupportTicket.findById(ticket_id);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    
    // Authorization check
    if (sender_type === "user" && ticket.user_id.toString() !== sender_id) {
      throw new Error("Not authorized to reply to this ticket");
    }
    
    // Check ticket is not closed
    if (ticket.status === "closed") {
      throw new Error("Cannot reply to a closed ticket");
    }
    
    // Add message (uses instance method)
    ticket.messages.push({
      sender_id: new Types.ObjectId(sender_id),
      sender_type,
      message,
      attachments: attachments || [],
      created_at: new Date(),
    });
    
    // Update status based on sender
    if (sender_type === "support" && ticket.status === "open") {
      ticket.status = "in_progress";
    } else if (sender_type === "user" && ticket.status === "awaiting_user") {
      ticket.status = "in_progress";
    }
    
    await ticket.save();
    
    // Send notification
    try {
      if (sender_type === "support") {
        // Notify user of support response
        await this.notificationService.create({
          userId: ticket.user_id.toString(),
          type: "ticket_response",
          title: "Support Response",
          body: "You have a new response on your support ticket",
          data: {
            ticket_id: ticket._id.toString(),
          },
        });
      }
    } catch (err) {
      logger.warn("Failed to send ticket response notification", { err, ticket_id });
    }
    
    logger.info("Message added to ticket", {
      ticket_id,
      sender_type,
      message_count: ticket.messages.length,
    });
    
    return ticket;
  }
  
  /**
   * Update ticket status
   */
  async updateStatus(
    ticketId: string,
    status: TicketStatus,
    resolutionNotes?: string
  ): Promise<ISupportTicket> {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    
    ticket.status = status;
    
    if (status === "resolved" && resolutionNotes) {
      ticket.resolution_notes = resolutionNotes;
      ticket.resolved_at = new Date();
    }
    
    await ticket.save();
    
    // Notify user of resolution
    if (status === "resolved") {
      try {
        await this.notificationService.create({
          userId: ticket.user_id.toString(),
          type: "ticket_resolved",
          title: "Ticket Resolved",
          body: "Your support ticket has been resolved",
          data: {
            ticket_id: ticket._id.toString(),
          },
        });
      } catch (err) {
        logger.warn("Failed to send ticket resolved notification", { err, ticketId });
      }
    }
    
    logger.info("Ticket status updated", { ticketId, status });
    
    return ticket;
  }
  
  /**
   * Assign ticket to support agent
   */
  async assignTicket(ticketId: string, agentId: string): Promise<ISupportTicket> {
    const ticket = await SupportTicket.findByIdAndUpdate(
      ticketId,
      { $set: { assigned_to: agentId } },
      { new: true }
    );
    
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    
    logger.info("Ticket assigned", { ticketId, agentId });
    
    return ticket;
  }
  
  /**
   * Get open tickets count for a user
   */
  async getOpenTicketsCount(userId: string): Promise<number> {
    return SupportTicket.countDocuments({
      user_id: new Types.ObjectId(userId),
      status: { $nin: ["resolved", "closed"] },
    });
  }
  
  /**
   * Reopen a resolved/closed ticket
   */
  async reopenTicket(ticketId: string, userId: string): Promise<ISupportTicket> {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    
    if (ticket.user_id.toString() !== userId) {
      throw new Error("Not authorized to reopen this ticket");
    }
    
    if (ticket.status !== "resolved" && ticket.status !== "closed") {
      throw new Error("Can only reopen resolved or closed tickets");
    }
    
    ticket.status = "open";
    ticket.resolved_at = null;
    await ticket.save();
    
    logger.info("Ticket reopened", { ticketId, userId });
    
    return ticket;
  }
}

// ----------------------------------------------------------
// Export singleton
// ----------------------------------------------------------

export const supportTicketService = new SupportTicketService();
