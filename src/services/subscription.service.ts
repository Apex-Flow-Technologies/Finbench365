/**
 * ==============================================================================
 * FinBench365 — Subscription & Access Domain Service (Sprint 3)
 * ==============================================================================
 * Domain repository responsible for candidate access licenses, enrollment verification,
 * and subscription lifecycle state management.
 */

import { firestoreService, type QueryFilter } from './firestore.service';
import { FIRESTORE_COLLECTIONS } from '../constants/firestore';
import type { SubscriptionDocument } from '../types/firestore';

export class SubscriptionService {
  /**
   * Retrieve all subscriptions associated with a candidate UID.
   */
  async getUserSubscriptions(userId: string, activeOnly = true): Promise<SubscriptionDocument[]> {
    const filters: QueryFilter[] = [
      { field: 'userId', operator: '==' as const, value: userId },
      ...(activeOnly ? [{ field: 'subscriptionState', operator: '==' as const, value: 'ACTIVE' }] : []),
    ];

    const { items } = await firestoreService.queryDocuments<SubscriptionDocument>(FIRESTORE_COLLECTIONS.SUBSCRIPTIONS, {
      filters,
      orders: [{ field: 'activatedAt', direction: 'desc' }],
    });
    return items;
  }

  /**
   * Verify if a candidate possesses an active subscription license for a specific course ID.
   */
  async checkCourseAccess(userId: string, courseId: string): Promise<boolean> {
    const { items } = await firestoreService.queryDocuments<SubscriptionDocument>(FIRESTORE_COLLECTIONS.SUBSCRIPTIONS, {
      filters: [
        { field: 'userId', operator: '==', value: userId },
        { field: 'courseId', operator: '==', value: courseId },
        { field: 'subscriptionState', operator: '==', value: 'ACTIVE' },
      ],
      limitCount: 1,
    });
    return items.length > 0;
  }

  /**
   * Create or update a subscription record.
   */
  async saveSubscription(
    subscriptionId: string,
    data: Omit<SubscriptionDocument, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<SubscriptionDocument, 'createdAt' | 'updatedAt'>>
  ): Promise<SubscriptionDocument> {
    return firestoreService.createDocument<SubscriptionDocument>(FIRESTORE_COLLECTIONS.SUBSCRIPTIONS, subscriptionId, data);
  }

  /**
   * Mark an active subscription as cancelled.
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    return firestoreService.updateDocument<SubscriptionDocument>(FIRESTORE_COLLECTIONS.SUBSCRIPTIONS, subscriptionId, {
      subscriptionState: 'CANCELLED',
      autoRenew: false,
    });
  }
}

export const subscriptionService = new SubscriptionService();
