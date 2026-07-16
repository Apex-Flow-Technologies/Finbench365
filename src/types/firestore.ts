/**
 * ==============================================================================
 * FinBench365 — Complete Firestore Database Models & Interfaces (Sprint 3)
 * ==============================================================================
 * Strictly typed interfaces for all 15 institutional Firestore collections.
 * Every document interface extends `BaseDocument` (`id`, `createdAt`, `updatedAt`, `status`).
 * No `any` types permitted.
 */

import type { Role, SubscriptionStatus } from './auth';

/**
 * Common document status across institutional entities
 */
export type DocumentStatus = 
  | 'ACTIVE' 
  | 'ARCHIVED' 
  | 'DELETED' 
  | 'DRAFT' 
  | 'PUBLISHED' 
  | 'SUSPENDED' 
  | 'PENDING';

/**
 * 2. Base Firestore Document Interface
 * Every collection document supports id, createdAt, updatedAt, and status.
 */
export interface BaseDocument {
  id: string;
  createdAt: string; // ISO 8601 string timestamp
  updatedAt: string; // ISO 8601 string timestamp
  status: DocumentStatus;
}

/**
 * 1. Collection: `users`
 * Candidate profile, roles, tracks, and subscription states.
 */
export interface UserPreferences {
  theme?: 'dark' | 'light' | 'system';
  emailNotifications: boolean;
  examReminders: boolean;
  defaultTimezone?: string;
}

export interface UserProfileDocument extends BaseDocument {
  email: string;
  displayName: string;
  photoURL?: string;
  role: Role;
  userStatus: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  activeTrackIds: string[];
  subscriptionStatus: SubscriptionStatus;
  emailVerified: boolean;
  preferences?: UserPreferences;
}

/**
 * 2. Collection: `courses`
 * Educational curriculum tracks and certification modules.
 */
export interface CourseSyllabusModule {
  moduleId: string;
  moduleIndex: number;
  title: string;
  description: string;
  lectureCount: number;
  estimatedMinutes: number;
  status?: DocumentStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseInstructor {
  name: string;
  credentials: string;
  bio?: string;
  avatarUrl?: string;
}

export interface CourseDocument extends BaseDocument {
  title: string;
  slug: string;
  categoryId: string;
  trackId: string;
  description: string;
  level: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'INSTITUTIONAL';
  durationDays: number;
  priceINR: number;
  discountedPriceINR?: number;
  thumbnailUrl?: string;
  syllabus: CourseSyllabusModule[];
  totalLectures: number;
  totalQuestions: number;
  totalMockTests: number;
  isFeatured: boolean;
  isPublished?: boolean;
  availablePlans?: string[];
  instructor: CourseInstructor;
}

/**
 * 3. Collection: `courseCategories`
 * High-level grouping of certification tracks (e.g., Quantitative Finance, Risk, CFA).
 */
export interface CourseCategoryDocument extends BaseDocument {
  name: string;
  slug: string;
  description: string;
  iconName: string;
  displayOrder: number;
  parentCategoryId?: string;
  isActive: boolean;
}

/**
 * 4. Collection: `notes`
 * Downloadable or viewable study notes, formula cheatsheets, and summaries.
 */
export interface NoteDocument extends BaseDocument {
  courseId: string;
  trackId: string;
  moduleIndex: number;
  title: string;
  summary: string;
  contentMarkdown?: string;
  storagePathUrl?: string;
  fileSizeBytes?: number;
  pageCount?: number;
  isDownloadable: boolean;
}

/**
 * 5. Collection: `mockTests`
 * Institutional CBT simulation mock exams.
 */
export interface MockTestDocument extends BaseDocument {
  courseId: string;
  trackId: string;
  title: string;
  description: string;
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  passingScorePercentage: number;
  negativeMarkingRatio: number; // e.g. 0.25 for 1/4th negative marking
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'INSTITUTIONAL';
  isFreeSample: boolean;
  instructions: string[];
}

/**
 * 6. Collection: `questions`
 * Item-Response Theory (IRT) diagnostic examination items.
 */
export interface QuestionOption {
  optionId: string;
  optionText: string;
}

export interface IRTParameters {
  difficulty: number;     // b parameter (-3.0 to +3.0)
  discrimination: number; // a parameter (0.5 to 2.5)
  guessing: number;       // c parameter (0.0 to 0.3)
}

export interface QuestionDocument extends BaseDocument {
  mockTestId: string;
  courseId: string;
  trackId: string;
  orderIndex: number;
  questionText: string;
  questionType: 'MCQ_SINGLE' | 'MCQ_MULTIPLE' | 'NUMERICAL';
  options: QuestionOption[];
  correctOptionIds: string[];
  correctNumericalAnswer?: number;
  numericalTolerance?: number;
  explanationText: string;
  explanationFormula?: string;
  irtParameters?: IRTParameters;
}

/**
 * 7. Collection: `attempts`
 * Student examination attempts, response logs, and evaluation metrics.
 */
export interface QuestionResponse {
  questionId: string;
  selectedOptionIds: string[];
  numericalAnswerSubmitted?: number;
  timeSpentSeconds: number;
  isCorrect: boolean;
  marksAwarded: number;
}

export interface AttemptAnalyticsSnapshot {
  percentileRank?: number;
  accuracyRate: number;
  averageSecondsPerQuestion: number;
  weakTopicModuleIds: string[];
  strongTopicModuleIds: string[];
}

export interface AttemptDocument extends BaseDocument {
  userId: string;
  mockTestId: string;
  courseId: string;
  startedAt: string;
  completedAt?: string;
  durationSpentSeconds: number;
  totalScore: number;
  maxPossibleScore: number;
  percentageScore: number;
  isPassed: boolean;
  attemptStatus: 'IN_PROGRESS' | 'SUBMITTED' | 'TIMED_OUT' | 'EVALUATED';
  responses: Record<string, QuestionResponse>;
  analyticsSnapshot?: AttemptAnalyticsSnapshot;
}

/**
 * 8. Collection: `subscriptions`
 * Active and historical student course access licenses.
 */
export interface SubscriptionDocument extends BaseDocument {
  userId: string;
  courseId: string;
  trackId: string;
  planName: string;
  paymentId: string;
  subscriptionState: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING';
  activatedAt: string;
  expiresAt: string;
  autoRenew: boolean;
  pricePaidINR: number;
}

/**
 * 9. Collection: `payments`
 * Immutable institutional payment gateway transaction records.
 */
export interface PaymentBillingDetails {
  name: string;
  email: string;
  phone?: string;
  org?: string;
}

export interface PaymentDocument extends BaseDocument {
  userId: string;
  courseId: string;
  subscriptionId?: string;
  orderIdRazorpay: string;
  paymentIdRazorpay?: string;
  signatureRazorpay?: string;
  amountINR: number;
  currency: 'INR';
  paymentStatus: 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
  couponCodeUsed?: string;
  discountAmountINR?: number;
  gstAmountINR?: number;
  billingDetails: PaymentBillingDetails;
  errorMessage?: string;
}

/**
 * 10. Collection: `couponCodes`
 * Promotional discount vouchers and institutional tier coupons.
 */
export interface CouponCodeDocument extends BaseDocument {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxDiscountINR?: number;
  minOrderValueINR?: number;
  validFrom: string;
  validUntil: string;
  usageLimitTotal: number;
  usageCountCurrent: number;
  applicableCourseIds: string[]; // empty array means applicable to all courses
  isActive: boolean;
}

/**
 * 11. Collection: `admins`
 * Institutional administrators and curriculum moderators.
 */
export interface AdminDocument extends BaseDocument {
  userId: string;
  email: string;
  fullName: string;
  adminRole: 'ADMIN' | 'SUPER_ADMIN';
  assignedCategories: string[];
  permissions: string[];
  lastActiveAt: string;
}

/**
 * 12. Collection: `roles`
 * RBAC permission matrices and granular resource capabilities.
 */
export interface RolePermissionRule {
  resource: string;
  actions: ('CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'MANAGE')[];
}

export interface RoleDefinitionDocument extends BaseDocument {
  roleName: Role;
  description: string;
  permissions: RolePermissionRule[];
  isSystemRole: boolean;
}

/**
 * 13. Collection: `notifications`
 * System alerts, subscription renewals, and exam result notices.
 */
export interface NotificationDocument extends BaseDocument {
  userId: string; // specific user UID or 'ALL'
  title: string;
  message: string;
  notificationType: 'SYSTEM' | 'SUBSCRIPTION' | 'EXAM_RESULT' | 'PROMOTIONAL';
  isRead: boolean;
  readAt?: string;
  actionUrl?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * 14. Collection: `analytics`
 * Daily institutional telemetry, active users, and aggregate exam metrics.
 */
export interface AnalyticsSnapshotDocument extends BaseDocument {
  metricType: 'DAILY_ACTIVE_USERS' | 'EXAM_COMPLETIONS' | 'REVENUE_DAILY' | 'COURSE_ENROLLMENTS';
  dateKey: string; // YYYY-MM-DD
  metricValueNumeric: number;
  breakdown: Record<string, number>;
  computedAt: string;
}

/**
 * 15. Collection: `activityLogs`
 * Immutable compliance audit logs for tracking actions across the portal.
 */
export type ActivityLogActionType = 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'START_EXAM' 
  | 'SUBMIT_EXAM' 
  | 'PURCHASE_COURSE' 
  | 'ADMIN_UPDATE_COURSE' 
  | 'ADMIN_DELETE_QUESTION';

export interface ActivityLogDocument extends BaseDocument {
  userId: string;
  userEmail: string;
  actionType: ActivityLogActionType;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ============================================================================
// Sprint 4.3 — Digital Asset Management (`assets`)
// ============================================================================

export type AssetMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'image/png'
  | 'image/jpeg'
  | 'image/svg+xml'
  | 'application/octet-stream';

export interface DigitalAssetDocument extends BaseDocument {
  fileName: string;
  originalFileName: string;
  mimeType: AssetMimeType;
  fileSize: number; // in bytes
  storagePath: string; // full path in Firebase Storage
  publicUrl: string; // accessible public download URL
  courseId: string;
  moduleId?: string;
  uploadedBy: string; // identity (email or name) of administrator
  uploadedAt: string; // ISO 8601 string timestamp
}
