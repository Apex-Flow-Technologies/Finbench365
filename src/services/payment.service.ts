/**
 * ==============================================================================
 * FinBench365 — Payment & Coupon Domain Service (Sprint 3)
 * ==============================================================================
 * Domain repository responsible for retrieving and logging institutional payment
 * transactions and verifying promotional coupon codes.
 *
 * Note: Per RBAC security rules, financial transactions are immutable and verified
 * exclusively via backend Cloud Functions / Razorpay Webhooks.
 */

import { firestoreService } from './firestore.service';
import { FIRESTORE_COLLECTIONS } from '../constants/firestore';
import type { PaymentDocument, CouponCodeDocument } from '../types/firestore';

export class PaymentService {
  /**
   * Fetch a transaction record by its unique document ID.
   */
  async getPaymentById(paymentId: string): Promise<PaymentDocument | null> {
    return firestoreService.getDocument<PaymentDocument>(FIRESTORE_COLLECTIONS.PAYMENTS, paymentId);
  }

  /**
   * List all historical payment records for a candidate.
   */
  async listUserPayments(userId: string): Promise<PaymentDocument[]> {
    const { items } = await firestoreService.queryDocuments<PaymentDocument>(FIRESTORE_COLLECTIONS.PAYMENTS, {
      filters: [{ field: 'userId', operator: '==', value: userId }],
      orders: [{ field: 'createdAt', direction: 'desc' }],
    });
    return items;
  }

  /**
   * Verify a coupon voucher code against eligibility rules and limits.
   */
  async verifyCouponCode(code: string, courseId: string, orderAmountINR: number): Promise<{ isValid: boolean; coupon?: CouponCodeDocument; reason?: string }> {
    const normalizedCode = code.trim().toUpperCase();
    const { items } = await firestoreService.queryDocuments<CouponCodeDocument>(FIRESTORE_COLLECTIONS.COUPON_CODES, {
      filters: [
        { field: 'code', operator: '==', value: normalizedCode },
        { field: 'isActive', operator: '==', value: true },
      ],
      limitCount: 1,
    });

    if (items.length === 0) {
      return { isValid: false, reason: 'Invalid or expired institutional voucher code.' };
    }

    const coupon = items[0];
    const now = new Date().toISOString();

    if (now < coupon.validFrom || now > coupon.validUntil) {
      return { isValid: false, reason: 'Voucher code is outside its valid promotional window.' };
    }

    if (coupon.usageLimitTotal > 0 && coupon.usageCountCurrent >= coupon.usageLimitTotal) {
      return { isValid: false, reason: 'Promotional voucher has reached its maximum redemptions.' };
    }

    if (coupon.minOrderValueINR && orderAmountINR < coupon.minOrderValueINR) {
      return { isValid: false, reason: `Minimum order value of ₹${coupon.minOrderValueINR} required.` };
    }

    if (coupon.applicableCourseIds && coupon.applicableCourseIds.length > 0) {
      if (!coupon.applicableCourseIds.includes(courseId)) {
        return { isValid: false, reason: 'Voucher code is not applicable to this certification track.' };
      }
    }

    return { isValid: true, coupon };
  }
}

export const paymentService = new PaymentService();
