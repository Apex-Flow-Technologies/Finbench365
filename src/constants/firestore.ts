/**
 * ==============================================================================
 * FinBench365 — Firestore Collection Constants & Identifiers (Sprint 3)
 * ==============================================================================
 * Centralized repository of Firestore collection names to eliminate magic strings
 * across service repositories and security configurations.
 */

export const FIRESTORE_COLLECTIONS = {
  USERS: 'users',
  COURSES: 'courses',
  COURSE_CATEGORIES: 'courseCategories',
  NOTES: 'notes',
  MOCK_TESTS: 'mockTests',
  QUESTIONS: 'questions',
  ATTEMPTS: 'attempts',
  SUBSCRIPTIONS: 'subscriptions',
  PAYMENTS: 'payments',
  COUPON_CODES: 'couponCodes',
  ADMINS: 'admins',
  ROLES: 'roles',
  NOTIFICATIONS: 'notifications',
  ANALYTICS: 'analytics',
  ACTIVITY_LOGS: 'activityLogs',
} as const;

export type FirestoreCollectionName = (typeof FIRESTORE_COLLECTIONS)[keyof typeof FIRESTORE_COLLECTIONS];
