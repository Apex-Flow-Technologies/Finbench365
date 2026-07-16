/**
 * ==============================================================================
 * FinBench365 — Notification & Alert Domain Service (Sprint 3)
 * ==============================================================================
 * Domain repository responsible for retrieving candidate notifications, system alerts,
 * subscription reminders, and managing read receipt states.
 */

import { firestoreService, type QueryFilter } from './firestore.service';
import { FIRESTORE_COLLECTIONS } from '../constants/firestore';
import type { NotificationDocument } from '../types/firestore';

export class NotificationService {
  /**
   * Retrieve all notifications targeted to a specific candidate or broadcasted to 'ALL'.
   */
  async listCandidateNotifications(userId: string, unreadOnly = false): Promise<NotificationDocument[]> {
    const filters: QueryFilter[] = [
      { field: 'userId', operator: 'in' as const, value: [userId, 'ALL'] },
      ...(unreadOnly ? [{ field: 'isRead', operator: '==' as const, value: false }] : []),
    ];

    const { items } = await firestoreService.queryDocuments<NotificationDocument>(FIRESTORE_COLLECTIONS.NOTIFICATIONS, {
      filters,
      orders: [{ field: 'createdAt', direction: 'desc' }],
    });
    return items;
  }

  /**
   * Mark a specific notification document as read.
   */
  async markAsRead(notificationId: string): Promise<void> {
    const now = new Date().toISOString();
    return firestoreService.updateDocument<NotificationDocument>(FIRESTORE_COLLECTIONS.NOTIFICATIONS, notificationId, {
      isRead: true,
      readAt: now,
    });
  }
}

export const notificationService = new NotificationService();
