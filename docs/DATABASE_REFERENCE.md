# FinBench365 — Cloud Firestore Database Reference (Sprint 3)

This document provides the definitive architectural blueprint, schema contracts, collection relationships, domain service responsibilities, and Role-Based Access Control (RBAC) security assumptions for the **FinBench365 Institutional Financial CBT & SaaS Platform**.

---

## 1. Architectural Overview & Base Contracts

Every Firestore document in the FinBench365 data layer adheres to a strict base contract to ensure temporal auditing, status lifecycle consistency, and zero magic strings.

### Base Document (`BaseDocument`)
```typescript
export type DocumentStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED' | 'DRAFT' | 'PUBLISHED' | 'SUSPENDED' | 'PENDING';

export interface BaseDocument {
  id: string;        // Primary document key matching the Firestore doc ID
  createdAt: string; // ISO 8601 string timestamp
  updatedAt: string; // ISO 8601 string timestamp
  status: DocumentStatus;
}
```

---

## 2. Collection Directory & Relationships

| Collection (`FIRESTORE_COLLECTIONS`) | Primary Model Interface | Parent / Relationships | Description |
| :--- | :--- | :--- | :--- |
| `users` | `UserProfileDocument` | Root / `auth.uid` | Candidate profile, roles (`STUDENT`, `ADMIN`, `SUPER_ADMIN`), active track entitlements, and subscription status. |
| `courseCategories` | `CourseCategoryDocument` | Root | Top-level certification taxonomy (`Quantitative Finance`, `Risk Management`, `CFA Prep`). |
| `courses` | `CourseDocument` | `categoryId` -> `courseCategories.id` | Certification courses with structured syllabus modules, pricing (`priceINR`), and instructor profiles. |
| `notes` | `NoteDocument` | `courseId` -> `courses.id` | Study notes, formula cheat sheets, and downloadable PDFs. |
| `mockTests` | `MockTestDocument` | `courseId` -> `courses.id` | Institutional CBT mock exams (`durationMinutes`, `negativeMarkingRatio`, `isFreeSample`). |
| `questions` | `QuestionDocument` | `mockTestId` -> `mockTests.id` | Item-Response Theory (IRT) calibrated questions (`difficulty`, `discrimination`, `guessing`), options, and explanations. |
| `attempts` | `AttemptDocument` | `userId` -> `users.id`<br>`mockTestId` -> `mockTests.id` | Candidate CBT attempt sessions, per-question responses, duration tracking, and score evaluation. |
| `subscriptions` | `SubscriptionDocument` | `userId` -> `users.id`<br>`courseId` -> `courses.id` | Active or historical candidate access licenses (`subscriptionState: ACTIVE`). |
| `payments` | `PaymentDocument` | `userId` -> `users.id`<br>`courseId` -> `courses.id` | Immutable institutional payment logs (`orderIdRazorpay`, `paymentStatus`, `billingDetails`). |
| `couponCodes` | `CouponCodeDocument` | Root | Promotional discount vouchers with redemption caps and date eligibility windows. |
| `admins` | `AdminDocument` | `userId` -> `users.id` | Institutional administrator profiles with specific category management assignments. |
| `roles` | `RoleDefinitionDocument` | Root | Granular RBAC permission matrices specifying allowable actions (`CREATE`, `READ`, `UPDATE`, `DELETE`, `MANAGE`) across platform resources. |
| `notifications` | `NotificationDocument` | `userId` -> `users.id` (or `'ALL'`) | Candidate alerts, exam evaluation notices, and promotional messages. |
| `analytics` | `AnalyticsSnapshotDocument` | Root | Aggregated daily institutional telemetry (`DAILY_ACTIVE_USERS`, `EXAM_COMPLETIONS`, `REVENUE_DAILY`). |
| `activityLogs` | `ActivityLogDocument` | `userId` -> `users.id` | Immutable compliance audit trail tracking high-privilege candidate and administrator actions. |

---

## 3. Domain Service Layer (`src/services/`)

To prevent tight coupling between Next.js React UI pages and raw Firebase SDK calls, all data access is strictly abstracted behind specialized domain repositories inheriting from `FirestoreService` (`src/services/firestore.service.ts`).

### Domain Repository Responsibilities
1. **`FirestoreService` (`firestore.service.ts`)**: Generic data access engine supporting `getDocument<T>`, `createDocument<T>`, `updateDocument<T>`, `deleteDocument`, `queryDocuments<T>`, atomic `batchWrite()`, and `transaction()`.
2. **`CourseService` (`course.service.ts`)**: Manages `courses` and `courseCategories`. Supports `getCourseById`, `getCourseBySlug`, `listCoursesByTrack`, and `listCategories`.
3. **`SubscriptionService` (`subscription.service.ts`)**: Manages `subscriptions`. Supports `getUserSubscriptions`, `checkCourseAccess(userId, courseId)`, `saveSubscription`, and `cancelSubscription`.
4. **`PaymentService` (`payment.service.ts`)**: Manages `payments` and `couponCodes`. Supports `getPaymentById`, `listUserPayments`, and `verifyCouponCode`.
5. **`QuestionService` (`question.service.ts`)**: Manages `mockTests`, `questions`, and `notes`. Supports `getMockTestById`, `listMockTestsByCourse`, `listQuestionsByMockTest`, and `listNotesByCourse`.
6. **`AttemptService` (`attempt.service.ts`)**: Manages `attempts`. Supports `startAttempt`, `saveResponseProgress`, and `submitAttempt` with IRT diagnostic snapshot calculation.
7. **`NotificationService` (`notification.service.ts`)**: Manages `notifications`. Supports `listCandidateNotifications` and `markAsRead`.
8. **`AuthService` (`auth.service.ts`)**: Manages candidate authentication state and hydrates `UserProfileDocument` directly from `/users/{uid}` via `fetchOrHydrateProfile`.

---

## 4. Security & Role-Based Access Assumptions (`firestore.rules`)

The `firestore.rules` configuration enforces strict server-side boundaries:

- **Guests (Unauthenticated)**:
  - Can read public `courses` and `courseCategories` where `status == 'ACTIVE'`.
  - Can verify active `couponCodes` during checkout pre-validation.
  - Zero access to candidate profiles, attempts, subscriptions, or examination questions.
- **Students (`role == 'STUDENT'`)**:
  - Can read their own `users/{uid}` profile, `attempts`, `subscriptions`, `payments`, `notifications`, and `activityLogs`.
  - Can create and update their own `attempts` during active examination (`attemptStatus == 'IN_PROGRESS'`).
  - Can read `notes`, `mockTests`, and `questions` only if `mockTests.isFreeSample == true` or they possess an active entitlement (`hasPurchasedAccess`).
  - Cannot self-elevate roles (`role`), tamper with `activeTrackIds`, or create verified `payments` directly.
- **Admins (`role == 'ADMIN'`)**:
  - Read/write access to educational content (`courses`, `courseCategories`, `notes`, `mockTests`, `questions`, `couponCodes`, `notifications`).
  - Read-only access to candidate `attempts`, `subscriptions`, `payments`, and `analytics`.
- **Super Admins (`role == 'SUPER_ADMIN'`)**:
  - Unrestricted read/write access across all 15 institutional collections, including administrative roles (`admins`, `roles`).
- **Payments & Telemetry Boundaries**:
  - `payments` and `analytics` are **write-restricted to `false` for all clients**. Only secure backend Cloud Functions (`firebase-admin`) and Razorpay webhooks can verify and create transactional receipts.
  - `activityLogs` are **append-only** (`allow create: if isOwner(...)`) and cannot be modified or deleted.

---

## 5. Local Emulator Suite Setup (`firebase.json` & `.firebaserc`)

To test database workflows safely without impacting production data:
1. Ensure `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` is set in `.env.local`.
2. Start the Firebase Local Emulator Suite:
   ```bash
   npx firebase emulators:start
   ```
   - **Firestore Emulator**: Port `8080`
   - **Auth Emulator**: Port `9099`
   - **Storage Emulator**: Port `9199`
   - **Emulator UI**: Port `4000` (`http://localhost:4000`)
