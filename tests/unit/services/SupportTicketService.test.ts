/**
 * SupportTicketService Unit Tests
 * Gap Fill Phase 7
 */

import { SupportTicketService } from '../../../src/services/support/SupportTicketService';
import { SupportTicket } from '../../../src/models/SupportTicket';
import { Types } from 'mongoose';

// Mock the dependencies
jest.mock('../../../src/models/SupportTicket');
jest.mock('../../../src/services/notification/NotificationService');

describe('SupportTicketService', () => {
  let supportService: SupportTicketService;
  const mockNotificationService = {
    create: jest.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    supportService = new SupportTicketService(mockNotificationService as any);
  });

  describe('createTicket', () => {
    const validInput = {
      user_id: new Types.ObjectId().toString(),
      subject: 'Payment Issue',
      category: 'payment_issue' as const,
      priority: 'high' as const,
      message: 'I was charged twice for my order.',
    };

    it('should create a ticket with initial message', async () => {
      const mockTicket = {
        _id: new Types.ObjectId(),
        ...validInput,
        status: 'open',
        messages: [{
          sender_id: new Types.ObjectId(validInput.user_id),
          sender_type: 'user',
          message: validInput.message,
          attachments: [],
          created_at: new Date(),
        }],
        toJSON: jest.fn().mockReturnThis(),
      };
      (SupportTicket.create as jest.Mock).mockResolvedValue(mockTicket);

      const result = await supportService.createTicket(validInput);

      expect(SupportTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: validInput.subject,
          category: validInput.category,
          priority: validInput.priority,
          status: 'open',
        })
      );
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ticket_created',
        })
      );
      expect(result.status).toBe('open');
    });
  });

  describe('getTicket', () => {
    it('should return ticket for owner', async () => {
      const userId = new Types.ObjectId().toString();
      const ticketId = new Types.ObjectId().toString();
      
      const mockTicket = {
        _id: new Types.ObjectId(ticketId),
        user_id: new Types.ObjectId(userId),
        subject: 'Test',
        toJSON: jest.fn().mockReturnThis(),
      };
      
      (SupportTicket.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockTicket),
      });

      const result = await supportService.getTicket(ticketId, userId);

      expect(result.subject).toBe('Test');
    });

    it('should throw error for non-owner', async () => {
      const ownerId = new Types.ObjectId().toString();
      const otherUserId = new Types.ObjectId().toString();
      const ticketId = new Types.ObjectId().toString();
      
      const mockTicket = {
        _id: new Types.ObjectId(ticketId),
        user_id: new Types.ObjectId(ownerId),
        toString: () => ownerId,
      };
      
      (SupportTicket.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockTicket),
      });

      await expect(supportService.getTicket(ticketId, otherUserId))
        .rejects.toThrow('Not authorized to view this ticket');
    });

    it('should allow support to view any ticket', async () => {
      const ownerId = new Types.ObjectId().toString();
      const supportUserId = new Types.ObjectId().toString();
      const ticketId = new Types.ObjectId().toString();
      
      const mockTicket = {
        _id: new Types.ObjectId(ticketId),
        user_id: new Types.ObjectId(ownerId),
        subject: 'Test',
      };
      
      (SupportTicket.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockTicket),
      });

      const result = await supportService.getTicket(ticketId, supportUserId, true);

      expect(result.subject).toBe('Test');
    });
  });

  describe('getUserTickets', () => {
    it('should return paginated tickets', async () => {
      const userId = new Types.ObjectId().toString();
      const mockTickets = [
        { _id: new Types.ObjectId(), subject: 'Ticket 1' },
        { _id: new Types.ObjectId(), subject: 'Ticket 2' },
      ];

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTickets),
      };
      (SupportTicket.find as jest.Mock).mockReturnValue(mockFind);
      (SupportTicket.countDocuments as jest.Mock).mockResolvedValue(5);

      const result = await supportService.getUserTickets(userId, { limit: 2 });

      expect(result.tickets).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('should filter by status', async () => {
      const userId = new Types.ObjectId().toString();
      
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      (SupportTicket.find as jest.Mock).mockReturnValue(mockFind);
      (SupportTicket.countDocuments as jest.Mock).mockResolvedValue(0);

      await supportService.getUserTickets(userId, { status: 'open' });

      expect(SupportTicket.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'open' })
      );
    });
  });

  describe('addMessage', () => {
    it('should add message to ticket', async () => {
      const userId = new Types.ObjectId().toString();
      const ticketId = new Types.ObjectId().toString();
      
      const mockTicket = {
        _id: new Types.ObjectId(ticketId),
        user_id: new Types.ObjectId(userId),
        status: 'awaiting_user',
        messages: [],
        save: jest.fn().mockResolvedValue(true),
        toJSON: jest.fn().mockReturnThis(),
      };
      (SupportTicket.findById as jest.Mock).mockResolvedValue(mockTicket);

      await supportService.addMessage({
        ticket_id: ticketId,
        sender_id: userId,
        sender_type: 'user',
        message: 'Here is my response',
      });

      expect(mockTicket.messages).toHaveLength(1);
      expect(mockTicket.status).toBe('in_progress'); // Status changes from awaiting_user
    });

    it('should throw error for closed ticket', async () => {
      const userId = new Types.ObjectId().toString();
      const ticketId = new Types.ObjectId().toString();
      
      const mockTicket = {
        _id: new Types.ObjectId(ticketId),
        user_id: new Types.ObjectId(userId),
        status: 'closed',
      };
      (SupportTicket.findById as jest.Mock).mockResolvedValue(mockTicket);

      await expect(supportService.addMessage({
        ticket_id: ticketId,
        sender_id: userId,
        sender_type: 'user',
        message: 'Test',
      })).rejects.toThrow('Cannot reply to a closed ticket');
    });
  });

  describe('updateStatus', () => {
    it('should update status and set resolution', async () => {
      const ticketId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      
      const mockTicket: any = {
        _id: new Types.ObjectId(ticketId),
        user_id: new Types.ObjectId(userId),
        status: 'in_progress',
        resolution_notes: null,
        resolved_at: null,
        save: jest.fn().mockResolvedValue(true),
      };
      (SupportTicket.findById as jest.Mock).mockResolvedValue(mockTicket);

      await supportService.updateStatus(ticketId, 'resolved', 'Issue fixed');

      expect(mockTicket.status).toBe('resolved');
      expect(mockTicket.resolution_notes).toBe('Issue fixed');
      expect(mockTicket.resolved_at).toBeDefined();
    });
  });

  describe('reopenTicket', () => {
    it('should reopen resolved ticket', async () => {
      const userId = new Types.ObjectId().toString();
      const ticketId = new Types.ObjectId().toString();
      
      const mockTicket = {
        _id: new Types.ObjectId(ticketId),
        user_id: new Types.ObjectId(userId),
        status: 'resolved',
        resolved_at: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };
      (SupportTicket.findById as jest.Mock).mockResolvedValue(mockTicket);

      await supportService.reopenTicket(ticketId, userId);

      expect(mockTicket.status).toBe('open');
      expect(mockTicket.resolved_at).toBeNull();
    });

    it('should throw error for active ticket', async () => {
      const userId = new Types.ObjectId().toString();
      const ticketId = new Types.ObjectId().toString();
      
      const mockTicket = {
        _id: new Types.ObjectId(ticketId),
        user_id: new Types.ObjectId(userId),
        status: 'in_progress',
      };
      (SupportTicket.findById as jest.Mock).mockResolvedValue(mockTicket);

      await expect(supportService.reopenTicket(ticketId, userId))
        .rejects.toThrow('Can only reopen resolved or closed tickets');
    });
  });
});
