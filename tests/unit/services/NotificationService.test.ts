import { notificationService } from '../../../src/services/notification/NotificationService';
import { notificationRepository } from '../../../src/repositories';
import { events } from '../../../src/utils/events';
import cache from '../../../src/utils/cache';
import { Types } from 'mongoose';

describe('NotificationService', () => {
  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    await notificationRepository.deleteMany({});
    await cache.delete(`notifications:unread_count:${userId}`);
  });

  describe('create', () => {
    it('should create a notification, emit event, and invalidate cache', async () => {
      const emitSpy = jest.spyOn(events, 'emit');
      const cacheSpy = jest.spyOn(cache, 'delete');

      // Execute
      const notification = await notificationService.create({
        userId,
        type: 'offer_received',
        title: 'New Offer',
        body: 'You received an offer of $14,000',
        actionUrl: '/offers/123'
      });

      // Verify response
      expect(notification.title).toBe('New Offer');
      expect(notification.read).toBe(false);

      // Verify DB
      const count = await notificationRepository.getUnreadCount(userId);
      expect(count).toBe(1);

      // Verify side effects
      expect(emitSpy).toHaveBeenCalledWith('notification:created', expect.objectContaining({
        userId,
        type: 'offer_received'
      }));
      expect(cacheSpy).toHaveBeenCalledWith(`notifications:unread_count:${userId}`);
    });
  });

  describe('getNotifications', () => {
    it('should fetch notifications with pagination', async () => {
      // Setup: Create 3 notifications
      await notificationService.create({ userId, type: 'system', title: 'N1', body: 'B1' });
      await notificationService.create({ userId, type: 'system', title: 'N2', body: 'B2' });
      await notificationService.create({ userId, type: 'system', title: 'N3', body: 'B3' });

      // Execute
      const result = await notificationService.getNotifications(userId, { limit: 2 });

      // Verify
      expect(result.notifications.length).toBe(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read and invalidate cache', async () => {
      // 1. Create
      const n = await notificationService.create({ userId, type: 'system', title: 'N1', body: 'B1' });
      const cacheSpy = jest.spyOn(cache, 'delete');

      // 2. Mark read
      await notificationService.markAsRead(n.id, userId);

      // 3. Verify
      const unreadCount = await notificationService.getUnreadCount(userId);
      expect(unreadCount).toBe(0);
      expect(cacheSpy).toHaveBeenCalledWith(`notifications:unread_count:${userId}`);
    });

    it('should throw error if marking another user\'s notification', async () => {
      const n = await notificationService.create({ userId, type: 'system', title: 'N1', body: 'B1' });
      const otherUser = new Types.ObjectId().toString();

      await expect(notificationService.markAsRead(n.id, otherUser))
        .rejects.toThrow('Not authorized');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      await notificationService.create({ userId, type: 'system', title: 'N1', body: 'B1' });
      await notificationService.create({ userId, type: 'system', title: 'N2', body: 'B2' });

      const count = await notificationService.markAllAsRead(userId);
      expect(count).toBe(2);

      const unreadCount = await notificationService.getUnreadCount(userId);
      expect(unreadCount).toBe(0);
    });
  });
});
