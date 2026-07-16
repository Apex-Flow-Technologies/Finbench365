/**
 * ==============================================================================
 * FinBench365 — Generic Cloud Firestore Service Layer (Sprint 3)
 * ==============================================================================
 * Reusable data access wrapper enforcing strict TypeScript typing, ISO timestamps,
 * and robust error boundary mapping across all institutional database operations.
 *
 * All domain repositories (`course.service.ts`, `payment.service.ts`, etc.) MUST
 * delegate their raw Firestore reads and writes through this generic service.
 * No direct Firebase calls are permitted inside React pages or hooks.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  runTransaction,
  type DocumentReference,
  type QueryConstraint,
  type WhereFilterOp,
  type OrderByDirection,
  type DocumentData,
  type WriteBatch,
  type Transaction,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { firestore } from '../lib/firebase/client';
import type { BaseDocument } from '../types/firestore';

export interface QueryFilter {
  field: string;
  operator: WhereFilterOp;
  value: unknown;
}

export interface QueryOrder {
  field: string;
  direction?: OrderByDirection;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  orders?: QueryOrder[];
  limitCount?: number;
  startAfterDoc?: QueryDocumentSnapshot<DocumentData>;
}

export class FirestoreService {
  /**
   * Retrieves a single document by its ID from a specified collection.
   */
  async getDocument<T extends BaseDocument>(collectionPath: string, docId: string): Promise<T | null> {
    try {
      const docRef = doc(firestore, collectionPath, docId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return null;
      }
      return { id: docSnap.id, ...docSnap.data() } as T;
    } catch (error) {
      console.error(`[FirestoreService] getDocument error (${collectionPath}/${docId}):`, error);
      throw error;
    }
  }

  /**
   * Creates or overwrites a document with the provided data and ID.
   * Automatically injects `id`, `createdAt`, and `updatedAt` timestamps if missing.
   */
  async createDocument<T extends BaseDocument>(
    collectionPath: string,
    docId: string,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<T, 'createdAt' | 'updatedAt'>>
  ): Promise<T> {
    try {
      const docRef = doc(firestore, collectionPath, docId);
      const now = new Date().toISOString();
      const payload = {
        ...data,
        id: docId,
        createdAt: data.createdAt || now,
        updatedAt: now,
      } as unknown as Record<string, unknown>;

      await setDoc(docRef, payload, { merge: true });
      return payload as unknown as T;
    } catch (error) {
      console.error(`[FirestoreService] createDocument error (${collectionPath}/${docId}):`, error);
      throw error;
    }
  }

  /**
   * Updates specific fields of an existing document.
   * Automatically updates `updatedAt` to the current ISO timestamp.
   */
  async updateDocument<T extends BaseDocument>(
    collectionPath: string,
    docId: string,
    data: Partial<Omit<T, 'id' | 'createdAt'>>
  ): Promise<void> {
    try {
      const docRef = doc(firestore, collectionPath, docId);
      const now = new Date().toISOString();
      const updatePayload = {
        ...data,
        updatedAt: now,
      } as Record<string, unknown>;

      await updateDoc(docRef, updatePayload);
    } catch (error) {
      console.error(`[FirestoreService] updateDocument error (${collectionPath}/${docId}):`, error);
      throw error;
    }
  }

  /**
   * Deletes a document by ID from a specified collection.
   */
  async deleteDocument(collectionPath: string, docId: string): Promise<void> {
    try {
      const docRef = doc(firestore, collectionPath, docId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`[FirestoreService] deleteDocument error (${collectionPath}/${docId}):`, error);
      throw error;
    }
  }

  /**
   * Queries documents within a collection using filtering, ordering, and pagination constraints.
   */
  async queryDocuments<T extends BaseDocument>(
    collectionPath: string,
    options: QueryOptions = {}
  ): Promise<{ items: T[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
    try {
      const collRef = collection(firestore, collectionPath);
      const constraints: QueryConstraint[] = [];

      if (options.filters) {
        options.filters.forEach((f) => {
          constraints.push(where(f.field, f.operator, f.value));
        });
      }

      if (options.orders) {
        options.orders.forEach((o) => {
          constraints.push(orderBy(o.field, o.direction || 'asc'));
        });
      }

      if (options.startAfterDoc) {
        constraints.push(startAfter(options.startAfterDoc));
      }

      if (options.limitCount && options.limitCount > 0) {
        constraints.push(limit(options.limitCount));
      }

      const q = query(collRef, ...constraints);
      const querySnap = await getDocs(q);

      const items: T[] = [];
      querySnap.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as T);
      });

      const lastDoc = querySnap.docs.length > 0 ? querySnap.docs[querySnap.docs.length - 1] : null;
      return { items, lastDoc };
    } catch (error) {
      console.error(`[FirestoreService] queryDocuments error (${collectionPath}):`, error);
      throw error;
    }
  }

  /**
   * Executes multiple atomic write operations (`set`, `update`, `delete`) in a single batch.
   */
  async batchWrite(operations: (batch: WriteBatch) => void): Promise<void> {
    try {
      const batch = writeBatch(firestore);
      operations(batch);
      await batch.commit();
    } catch (error) {
      console.error('[FirestoreService] batchWrite error:', error);
      throw error;
    }
  }

  /**
   * Executes atomic transactional read and write operations.
   */
  async transaction<R>(updateFunction: (transaction: Transaction) => Promise<R>): Promise<R> {
    try {
      return await runTransaction(firestore, updateFunction);
    } catch (error) {
      console.error('[FirestoreService] transaction error:', error);
      throw error;
    }
  }

  /**
   * Returns a typed DocumentReference helper for batch/transaction operations.
   */
  getDocRef(collectionPath: string, docId: string): DocumentReference<DocumentData> {
    return doc(firestore, collectionPath, docId);
  }
}

export const firestoreService = new FirestoreService();
