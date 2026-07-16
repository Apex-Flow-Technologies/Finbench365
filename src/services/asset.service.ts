/**
 * ==============================================================================
 * FinBench365 — Digital Asset Management Domain Service (Sprint 4.3)
 * ==============================================================================
 * Responsible for educational content storage operations and metadata persistence.
 * Delegates file uploading/downloading to Firebase Cloud Storage (`storage`) and
 * metadata storage to Cloud Firestore via `FirestoreService`.
 *
 * Supported MIME Types:
 * - PDF (`application/pdf`)
 * - DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
 * - PNG (`image/png`)
 * - JPG / JPEG (`image/jpeg`)
 * - SVG (`image/svg+xml`)
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase/client';
import { firestoreService, type QueryFilter } from './firestore.service';
import { FIRESTORE_COLLECTIONS } from '../constants/firestore';
import type { DigitalAssetDocument, AssetMimeType } from '../types/firestore';

const ALLOWED_MIME_TYPES: Record<string, AssetMimeType> = {
  'application/pdf': 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/svg+xml': 'image/svg+xml',
};

export class AssetService {
  /**
   * Validate if a file type is permitted for institutional assets
   */
  validateFileMimeType(file: File): AssetMimeType {
    const matched = ALLOWED_MIME_TYPES[file.type.toLowerCase()];
    if (!matched) {
      throw new Error(
        `Unsupported asset file type (${file.type || 'unknown'}). Allowed formats: PDF, DOCX, PNG, JPG/JPEG, and SVG.`
      );
    }
    return matched;
  }

  /**
   * Upload a new digital asset to Firebase Storage and persist metadata in Firestore
   */
  async uploadAsset(
    file: File,
    options: {
      courseId: string;
      moduleId?: string;
      uploadedBy: string;
      customFileName?: string;
    }
  ): Promise<DigitalAssetDocument> {
    const validatedMime = this.validateFileMimeType(file);
    const id = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const sanitizedName = (options.customFileName || file.name).replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `assets/courses/${options.courseId}/${id}_${sanitizedName}`;

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, {
      contentType: validatedMime,
      customMetadata: {
        courseId: options.courseId,
        moduleId: options.moduleId || '',
        uploadedBy: options.uploadedBy,
      },
    });

    const publicUrl = await getDownloadURL(storageRef);
    const now = new Date().toISOString();

    const assetData: Omit<DigitalAssetDocument, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<DigitalAssetDocument, 'createdAt' | 'updatedAt'>> = {
      fileName: options.customFileName || file.name,
      originalFileName: file.name,
      mimeType: validatedMime,
      fileSize: file.size,
      storagePath,
      publicUrl,
      courseId: options.courseId,
      moduleId: options.moduleId || undefined,
      uploadedBy: options.uploadedBy,
      uploadedAt: now,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    return firestoreService.createDocument<DigitalAssetDocument>(FIRESTORE_COLLECTIONS.ASSETS, id, assetData);
  }

  /**
   * Replace an existing asset's file with a new file while retaining its ID and linkages
   */
  async replaceAsset(assetId: string, newFile: File, uploadedBy: string): Promise<DigitalAssetDocument> {
    const existing = await this.getAssetById(assetId);
    if (!existing) {
      throw new Error(`Asset record [${assetId}] not found.`);
    }

    const validatedMime = this.validateFileMimeType(newFile);
    const sanitizedName = newFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const newStoragePath = `assets/courses/${existing.courseId}/${assetId}_replaced_${Date.now()}_${sanitizedName}`;

    const storageRef = ref(storage, newStoragePath);
    await uploadBytes(storageRef, newFile, {
      contentType: validatedMime,
      customMetadata: {
        courseId: existing.courseId,
        moduleId: existing.moduleId || '',
        uploadedBy,
      },
    });

    const publicUrl = await getDownloadURL(storageRef);
    const now = new Date().toISOString();

    const updates: Partial<DigitalAssetDocument> = {
      fileName: newFile.name,
      originalFileName: newFile.name,
      mimeType: validatedMime,
      fileSize: newFile.size,
      storagePath: newStoragePath,
      publicUrl,
      uploadedBy,
      updatedAt: now,
    };

    await firestoreService.updateDocument<DigitalAssetDocument>(FIRESTORE_COLLECTIONS.ASSETS, assetId, updates);

    return {
      ...existing,
      ...updates,
    };
  }

  /**
   * Fetch a single asset document by ID
   */
  async getAssetById(assetId: string): Promise<DigitalAssetDocument | null> {
    return firestoreService.getDocument<DigitalAssetDocument>(FIRESTORE_COLLECTIONS.ASSETS, assetId);
  }

  /**
   * List digital assets with optional institutional filters
   */
  async listAssets(options?: {
    courseId?: string;
    mimeType?: string;
    searchQuery?: string;
    includeDeleted?: boolean;
  }): Promise<DigitalAssetDocument[]> {
    const filters: QueryFilter[] = [];

    if (options?.courseId && options.courseId !== 'ALL') {
      filters.push({ field: 'courseId', operator: '==', value: options.courseId });
    }

    if (options?.mimeType && options.mimeType !== 'ALL') {
      filters.push({ field: 'mimeType', operator: '==', value: options.mimeType });
    }

    const { items } = await firestoreService.queryDocuments<DigitalAssetDocument>(FIRESTORE_COLLECTIONS.ASSETS, {
      filters,
    });
    let assets = [...items];

    // Sort by uploadedAt / createdAt descending
    assets.sort((a, b) => {
      const timeA = new Date(a.uploadedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.uploadedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    // Filter out soft deleted records unless requested
    if (!options?.includeDeleted) {
      assets = assets.filter((a) => a.status !== 'DELETED');
    }

    // Client-side text search across fileName / originalFileName / ID
    if (options?.searchQuery) {
      const query = options.searchQuery.toLowerCase().trim();
      assets = assets.filter(
        (a) =>
          a.fileName.toLowerCase().includes(query) ||
          a.originalFileName.toLowerCase().includes(query) ||
          a.id.toLowerCase().includes(query) ||
          a.courseId.toLowerCase().includes(query)
      );
    }

    return assets;
  }

  /**
   * Soft delete a digital asset (sets status to `DELETED`)
   */
  async softDeleteAsset(assetId: string): Promise<void> {
    await firestoreService.updateDocument<DigitalAssetDocument>(FIRESTORE_COLLECTIONS.ASSETS, assetId, {
      status: 'DELETED',
    });
  }
}

export const assetService = new AssetService();
