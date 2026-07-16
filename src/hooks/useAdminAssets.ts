/**
 * ==============================================================================
 * FinBench365 — Digital Asset Management Hook (Sprint 4.3)
 * ==============================================================================
 * Enforces `Component -> Hook -> Service -> Firebase` hierarchy.
 * Encapsulates asset uploading, file replacement, filtering, soft-deletion, and
 * institutional RBAC verification.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { assetService } from '../services/asset.service';
import { useAuth } from './useAuth';
import type { DigitalAssetDocument } from '../types/firestore';

export interface AdminAssetFilterOptions {
  courseId?: string;
  mimeType?: string;
  searchQuery?: string;
  includeDeleted?: boolean;
}

export function useAdminAssets(initialFilters: AdminAssetFilterOptions = {}) {
  const { user, authenticated } = useAuth();
  const [assets, setAssets] = useState<DigitalAssetDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<AdminAssetFilterOptions>(initialFilters);

  /**
   * Fetch asset list from Firestore via `AssetService`
   */
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await assetService.listAssets(filters);
      setAssets(result);
    } catch (err: unknown) {
      console.error('[useAdminAssets] Error fetching institutional assets:', err);
      setError(err instanceof Error ? err.message : 'Failed to synchronize digital assets from Firestore.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  /**
   * Upload a new file asset
   */
  const uploadAsset = useCallback(
    async (
      file: File,
      options: { courseId: string; moduleId?: string; customFileName?: string }
    ): Promise<DigitalAssetDocument> => {
      if (!user) throw new Error('You must be authenticated to upload institutional assets.');
      setError(null);
      try {
        const uploaderIdentity = user.email || user.displayName || user.uid || 'Institutional Admin';
        const created = await assetService.uploadAsset(file, {
          ...options,
          uploadedBy: uploaderIdentity,
        });
        setAssets((prev) => [created, ...prev]);
        return created;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to upload asset to Firebase Storage.';
        setError(msg);
        throw new Error(msg);
      }
    },
    [user]
  );

  /**
   * Replace an existing asset file
   */
  const replaceAsset = useCallback(
    async (assetId: string, newFile: File): Promise<DigitalAssetDocument> => {
      if (!user) throw new Error('You must be authenticated to replace institutional assets.');
      setError(null);
      try {
        const uploaderIdentity = user.email || user.displayName || user.uid || 'Institutional Admin';
        const updated = await assetService.replaceAsset(assetId, newFile, uploaderIdentity);
        setAssets((prev) => prev.map((a) => (a.id === assetId ? updated : a)));
        return updated;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to replace asset in Firebase Storage.';
        setError(msg);
        throw new Error(msg);
      }
    },
    [user]
  );

  /**
   * Soft delete an existing asset (`status: 'DELETED'`)
   */
  const softDeleteAsset = useCallback(
    async (assetId: string): Promise<void> => {
      setError(null);
      try {
        await assetService.softDeleteAsset(assetId);
        setAssets((prev) =>
          prev
            .map((a) => (a.id === assetId ? { ...a, status: 'DELETED' as const } : a))
            .filter((a) => (filters.includeDeleted ? true : a.status !== 'DELETED'))
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to soft delete asset.';
        setError(msg);
        throw new Error(msg);
      }
    },
    [filters.includeDeleted]
  );

  return {
    assets,
    loading,
    error,
    filters,
    setFilters,
    uploadAsset,
    replaceAsset,
    softDeleteAsset,
    refresh: fetchAssets,
    isAdmin: authenticated && (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'),
  };
}
