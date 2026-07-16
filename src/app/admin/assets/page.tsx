/**
 * ==============================================================================
 * FinBench365 — Administration Platform: Digital Asset Management Module (Sprint 4.3)
 * ==============================================================================
 * Strictly adheres to `Component -> Hook -> Service -> Firebase` hierarchy.
 * Never accesses Firebase SDK directly from this client component.
 *
 * Scope: ONLY Digital Asset Management (`Upload Assets`, `Replace Assets`,
 * `View Asset List`, `Search Assets`, `Filter by Course`, `Filter by Type`,
 * `Preview Assets`, `Soft Delete Assets`).
 * Serves as the foundational storage repository for all future educational content.
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  Upload,
  Search,
  FileText,
  FileCode,
  Image as ImageIcon,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  Eye,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowLeft,
  ShieldAlert,
  HardDrive,
  User,
  Tag,
} from 'lucide-react';
import { useAdminAssets } from '../../../hooks/useAdminAssets';
import { useAdminCourses } from '../../../hooks/useAdminCourses';
import type { DigitalAssetDocument, AssetMimeType } from '../../../types/firestore';

export default function DigitalAssetManagementPage() {
  const {
    assets,
    loading: assetsLoading,
    error: assetsError,
    setFilters,
    uploadAsset,
    replaceAsset,
    softDeleteAsset,
    refresh: refreshAssets,
    isAdmin,
  } = useAdminAssets();

  const { courses, loading: coursesLoading } = useAdminCourses();

  // Search & Filter state
  const [searchInput, setSearchInput] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [showDeleted, setShowDeleted] = useState<boolean>(false);

  // Modal states (`UPLOAD`, `REPLACE`, `PREVIEW`)
  const [modalMode, setModalMode] = useState<'UPLOAD' | 'REPLACE' | 'PREVIEW' | null>(null);
  const [activeAsset, setActiveAsset] = useState<DigitalAssetDocument | null>(null);

  // Upload/Replace Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCourseId, setUploadCourseId] = useState<string>('');
  const [uploadModuleId, setUploadModuleId] = useState<string>('');
  const [customFileName, setCustomFileName] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Copied URL feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Soft Delete Dialog
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [deletingFileName, setDeletingFileName] = useState<string>('');

  /**
   * Sync search and filter states into hook filters
   */
  const applyFilters = (course: string, type: string, search: string, deleted: boolean) => {
    setFilters({
      courseId: course === 'ALL' ? undefined : course,
      mimeType: type === 'ALL' ? undefined : type,
      searchQuery: search.trim() ? search.trim() : undefined,
      includeDeleted: deleted,
    });
  };

  /**
   * Handle Search input changes
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    applyFilters(selectedCourse, selectedType, val, showDeleted);
  };

  /**
   * Handle Course filter changes
   */
  const handleCourseFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedCourse(val);
    applyFilters(val, selectedType, searchInput, showDeleted);
  };

  /**
   * Handle MIME Type filter changes
   */
  const handleTypeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedType(val);
    applyFilters(selectedCourse, val, searchInput, showDeleted);
  };

  /**
   * Handle Show Deleted toggle
   */
  const handleToggleShowDeleted = () => {
    const nextVal = !showDeleted;
    setShowDeleted(nextVal);
    applyFilters(selectedCourse, selectedType, searchInput, nextVal);
  };

  /**
   * Open modal to upload new asset
   */
  const handleOpenUploadModal = () => {
    setModalMode('UPLOAD');
    setActiveAsset(null);
    setSelectedFile(null);
    setUploadCourseId(courses[0]?.id || '');
    setUploadModuleId('');
    setCustomFileName('');
    setFormError(null);
  };

  /**
   * Open modal to replace existing asset
   */
  const handleOpenReplaceModal = (asset: DigitalAssetDocument) => {
    setModalMode('REPLACE');
    setActiveAsset(asset);
    setSelectedFile(null);
    setFormError(null);
  };

  /**
   * Open modal to preview asset details
   */
  const handleOpenPreviewModal = (asset: DigitalAssetDocument) => {
    setModalMode('PREVIEW');
    setActiveAsset(asset);
  };

  /**
   * Handle File input change with MIME check
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/svg+xml',
      ];
      if (!validTypes.includes(file.type.toLowerCase())) {
        setFormError(
          `Unsupported file format (${file.type || 'unknown'}). Allowed formats: PDF, DOCX, PNG, JPG/JPEG, and SVG.`
        );
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      if (modalMode === 'UPLOAD' && !customFileName) {
        setCustomFileName(file.name);
      }
      setFormError(null);
    }
  };

  /**
   * Submit Upload or Replace form
   */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFormError('Please select a valid digital asset file.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (modalMode === 'UPLOAD') {
        if (!uploadCourseId.trim()) {
          setFormError('Institutional Course selection is strictly required.');
          setIsSubmitting(false);
          return;
        }
        await uploadAsset(selectedFile, {
          courseId: uploadCourseId,
          moduleId: uploadModuleId.trim() || undefined,
          customFileName: customFileName.trim() || selectedFile.name,
        });
      } else if (modalMode === 'REPLACE' && activeAsset) {
        await replaceAsset(activeAsset.id, selectedFile);
      }
      setModalMode(null);
      setSelectedFile(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to persist digital asset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Copy download URL to clipboard
   */
  const handleCopyUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      console.error('Failed to copy download URL to clipboard.');
    }
  };

  /**
   * Confirm Soft Delete
   */
  const handleConfirmDelete = async () => {
    if (!deletingAssetId) return;
    try {
      await softDeleteAsset(deletingAssetId);
      setDeletingAssetId(null);
    } catch (err: unknown) {
      console.error('Failed to soft delete asset:', err);
    }
  };

  /**
   * Format file size (`bytes` to `KB` / `MB`)
   */
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  /**
   * Format ISO timestamp
   */
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  /**
   * Get appropriate icon for asset type
   */
  const getAssetTypeBadge = (mime: AssetMimeType | string) => {
    switch (mime) {
      case 'application/pdf':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-bold text-xs border border-red-200">
            <FileText className="w-3.5 h-3.5 text-red-600" />
            PDF Document
          </span>
        );
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
            <FileCode className="w-3.5 h-3.5 text-blue-600" />
            DOCX File
          </span>
        );
      case 'image/png':
      case 'image/jpeg':
      case 'image/svg+xml':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-bold text-xs border border-purple-200">
            <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
            {mime.includes('svg') ? 'SVG Vector' : mime.includes('png') ? 'PNG Image' : 'JPG Image'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200">
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            Binary File
          </span>
        );
    }
  };

  // RBAC Guard
  if (!assetsLoading && !isAdmin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16 bg-[#FAFAF8]">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-xl text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Institutional administrative privileges (`ADMIN` or `SUPER_ADMIN`) are strictly required to access the Fintelyx Digital Asset Management Module.
          </p>
          <Link
            href="/admin/courses"
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition shadow-lg block"
          >
            Return to Course Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-800 pb-24">
      {/* Top Header */}
      <div className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-inner">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-mono font-black text-[10px] uppercase tracking-wider">
                  Sprint 4.3 Foundation
                </span>
                <span className="text-xs text-slate-400 font-mono">Firebase Storage + Firestore Repository</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mt-0.5">Digital Asset Management</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/courses"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs transition flex items-center gap-2 border border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Course Management
            </Link>

            <button
              onClick={handleOpenUploadModal}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-black text-xs transition shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Upload New Asset
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Search, Filter & Toggle Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 md:space-y-0 md:flex items-center justify-between gap-4">
          <div className="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={handleSearchChange}
                placeholder="Search across file names, original names, course IDs, or asset IDs..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-amber-500 focus:bg-white transition"
              />
            </div>

            {/* Course Filter Dropdown */}
            <div className="flex items-center gap-2 min-w-[180px]">
              <select
                value={selectedCourse}
                onChange={handleCourseFilterChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-amber-500 transition cursor-pointer"
              >
                <option value="ALL">All Courses ({courses.length})</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* MIME Type Filter Dropdown */}
            <div className="flex items-center gap-2 min-w-[160px]">
              <select
                value={selectedType}
                onChange={handleTypeFilterChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-amber-500 transition cursor-pointer"
              >
                <option value="ALL">All Asset Types</option>
                <option value="application/pdf">PDF Documents (.pdf)</option>
                <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                  DOCX Word Files (.docx)
                </option>
                <option value="image/png">PNG Images (.png)</option>
                <option value="image/jpeg">JPG/JPEG Images (.jpg)</option>
                <option value="image/svg+xml">SVG Vectors (.svg)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t border-slate-100 md:border-t-0">
            <button
              onClick={handleToggleShowDeleted}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                showDeleted
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
              title="Show or hide soft-deleted assets"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {showDeleted ? 'Hide Soft Deleted' : 'Show Soft Deleted'}
            </button>

            <button
              onClick={refreshAssets}
              disabled={assetsLoading}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer disabled:opacity-50"
              title="Refresh Asset Catalog"
            >
              <RefreshCw className={`w-4 h-4 ${assetsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Assets List Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Asset Preview & Name</th>
                  <th className="py-3.5 px-4">Type & Size</th>
                  <th className="py-3.5 px-4">Course & Module Linkage</th>
                  <th className="py-3.5 px-4">Uploaded By / Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {assetsLoading || coursesLoading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-600 mx-auto mb-2" />
                      Hydrating institutional digital assets from Firestore & Storage...
                    </td>
                  </tr>
                ) : assetsError ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-red-600 font-bold">
                      <AlertCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
                      {assetsError}
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-500">
                      <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="font-bold text-slate-700 text-base">No matching educational assets found</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Try adjusting your search criteria or click &ldquo;Upload New Asset&rdquo; above to store PDF, DOCX, or image files.
                      </p>
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => {
                    const isSoftDeleted = asset.status === 'DELETED';
                    const isImage = asset.mimeType.startsWith('image/');

                    return (
                      <tr
                        key={asset.id}
                        className={`hover:bg-slate-50/60 transition ${isSoftDeleted ? 'bg-red-50/20 opacity-75' : ''}`}
                      >
                        {/* Preview & File Name */}
                        <td className="py-4 px-4 max-w-xs">
                          <div className="flex items-start gap-3">
                            {isImage && asset.publicUrl ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={asset.publicUrl}
                                  alt={asset.fileName}
                                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100 shadow-2xs"
                                />
                              </>
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0 border border-slate-800 font-black text-xs">
                                {asset.mimeType.includes('pdf')
                                  ? 'PDF'
                                  : asset.mimeType.includes('word')
                                  ? 'DOC'
                                  : 'FILE'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate text-sm" title={asset.fileName}>
                                {asset.fileName}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5" title={asset.originalFileName}>
                                Orig: {asset.originalFileName}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 mt-1 truncate" title={asset.id}>
                                ID: {asset.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Type & Size */}
                        <td className="py-4 px-4">
                          {getAssetTypeBadge(asset.mimeType)}
                          <div className="text-xs font-mono font-bold text-slate-600 mt-1">
                            {formatFileSize(asset.fileSize)}
                          </div>
                        </td>

                        {/* Course & Module */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 font-mono text-xs font-bold border border-amber-200">
                            <Tag className="w-3 h-3 text-amber-600" />
                            {asset.courseId}
                          </span>
                          {asset.moduleId ? (
                            <div className="text-[11px] font-mono text-slate-500 mt-1">Mod: {asset.moduleId}</div>
                          ) : (
                            <div className="text-[11px] text-slate-400 italic mt-1">Global Course Asset</div>
                          )}
                        </td>

                        {/* Uploaded By & Timestamps */}
                        <td className="py-4 px-4 text-xs font-mono text-slate-600">
                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[140px]">{asset.uploadedBy}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(asset.uploadedAt)}</div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black tracking-wide border ${
                              asset.status === 'ACTIVE' || !asset.status
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : asset.status === 'ARCHIVED'
                                ? 'bg-slate-100 text-slate-600 border-slate-300'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {(asset.status === 'ACTIVE' || !asset.status) && <CheckCircle2 className="w-3 h-3" />}
                            {asset.status === 'DELETED' && <Trash2 className="w-3 h-3" />}
                            {asset.status || 'ACTIVE'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Preview details */}
                            <button
                              onClick={() => handleOpenPreviewModal(asset)}
                              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                              title="Preview Asset & Inspect 13 Metadata Fields"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Replace file button */}
                            {!isSoftDeleted && (
                              <button
                                onClick={() => handleOpenReplaceModal(asset)}
                                className="p-2 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800 rounded-xl transition cursor-pointer"
                                title="Replace Asset File (Preserves Asset ID)"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}

                            {/* Copy Public Download URL */}
                            <button
                              onClick={() => handleCopyUrl(asset.publicUrl, asset.id)}
                              className={`p-2 rounded-xl transition cursor-pointer border ${
                                copiedId === asset.id
                                  ? 'bg-green-500/10 text-green-700 border-green-300'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent'
                              }`}
                              title={copiedId === asset.id ? 'Copied Download URL!' : 'Copy Download URL'}
                            >
                              {copiedId === asset.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                            </button>

                            {/* Open in New Tab */}
                            <a
                              href={asset.publicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                              title="Open/Download in New Window"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>

                            {/* Soft Delete */}
                            {!isSoftDeleted && (
                              <button
                                onClick={() => {
                                  setDeletingAssetId(asset.id);
                                  setDeletingFileName(asset.fileName);
                                }}
                                className="p-2 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-700 rounded-xl transition cursor-pointer"
                                title="Soft Delete Asset"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: UPLOAD / REPLACE ASSET DRAWER                                      */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {(modalMode === 'UPLOAD' || modalMode === 'REPLACE') && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Upload className="w-5 h-5 text-amber-400" />
                  <h3 className="font-black text-base">
                    {modalMode === 'UPLOAD' ? 'Upload New Digital Asset' : `Replace Asset: ${activeAsset?.id}`}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setModalMode(null);
                    setSelectedFile(null);
                  }}
                  className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
                  type="button"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {modalMode === 'REPLACE' && activeAsset && (
                  <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                      Preserving Asset Identity & Linkages
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Uploading a replacement file will update the storage object (`storagePath`) and generate a fresh download URL (`publicUrl`) while strictly retaining the institutional ID <code className="font-mono bg-white px-1.5 py-0.5 rounded text-amber-950 font-bold">{activeAsset.id}</code>.
                    </p>
                  </div>
                )}

                {/* Course Selection (Only for UPLOAD) */}
                {modalMode === 'UPLOAD' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Target Institutional Course <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={uploadCourseId}
                      onChange={(e) => setUploadCourseId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-500 transition cursor-pointer"
                    >
                      <option value="">-- Select Course --</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Module ID (Optional for UPLOAD) */}
                {modalMode === 'UPLOAD' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Module ID (Optional Linkage)
                    </label>
                    <input
                      type="text"
                      value={uploadModuleId}
                      onChange={(e) => setUploadModuleId(e.target.value)}
                      placeholder="e.g. mod_178375_quant"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Leave blank if this asset is shared globally across all course lectures.
                    </span>
                  </div>
                )}

                {/* Custom File Name (Optional for UPLOAD) */}
                {modalMode === 'UPLOAD' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Custom File Display Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      placeholder="e.g. CFA Level 1 Quantitative Formula Sheet.pdf"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                )}

                {/* File Input Box */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Digital Asset File <span className="text-red-500">*</span>
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 hover:bg-slate-100/80 transition relative cursor-pointer">
                    <input
                      type="file"
                      required={modalMode === 'UPLOAD'}
                      onChange={handleFileChange}
                      accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/svg+xml"
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                    {selectedFile ? (
                      <div>
                        <div className="font-bold text-slate-900 text-sm truncate max-w-sm mx-auto">
                          {selectedFile.name}
                        </div>
                        <div className="text-xs font-mono text-slate-500 mt-0.5">
                          {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Binary'}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">Click or Drag & Drop file here</span>
                        <span className="text-[11px] text-slate-500 mt-1 block">
                          Supported formats: PDF, DOCX, PNG, JPG/JPEG, and SVG
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setModalMode(null);
                      setSelectedFile(null);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedFile}
                    className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {modalMode === 'UPLOAD' ? 'Start Storage Upload' : 'Confirm & Replace File'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: ASSET PREVIEW & 13 METADATA FIELDS INSPECTION DRAWER               */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {modalMode === 'PREVIEW' && activeAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <Eye className="w-5 h-5 text-amber-400" />
                  <h3 className="font-black text-base truncate max-w-md">Asset Inspection: {activeAsset.fileName}</h3>
                </div>
                <button
                  onClick={() => setModalMode(null)}
                  className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
                  type="button"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Visual Preview Banner */}
                {activeAsset.mimeType.startsWith('image/') && activeAsset.publicUrl ? (
                  <div className="bg-slate-100 rounded-2xl border border-slate-200 p-4 flex items-center justify-center max-h-[280px] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeAsset.publicUrl}
                      alt={activeAsset.fileName}
                      className="max-h-[260px] w-auto object-contain rounded-lg shadow-sm"
                    />
                  </div>
                ) : (
                  <div className="bg-slate-900 text-white rounded-2xl p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-base shrink-0">
                        {activeAsset.mimeType.includes('pdf') ? 'PDF' : 'DOCX'}
                      </div>
                      <div>
                        <h4 className="font-black text-lg text-white">{activeAsset.fileName}</h4>
                        <p className="text-xs text-slate-300 font-mono mt-0.5">
                          {activeAsset.mimeType} • {formatFileSize(activeAsset.fileSize)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={activeAsset.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-black text-xs transition flex items-center gap-2 shadow shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open File
                    </a>
                  </div>
                )}

                {/* 13 Complete Asset Metadata Fields Table */}
                <div>
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">
                    Institutional Asset Metadata (13 Core Properties)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-400 font-bold block">1. Asset ID</span>
                      <span className="font-mono font-bold text-slate-900">{activeAsset.id}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-400 font-bold block">2. File Name</span>
                      <span className="font-bold text-slate-900 truncate block" title={activeAsset.fileName}>
                        {activeAsset.fileName}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-400 font-bold block">3. Original File Name</span>
                      <span className="font-bold text-slate-800 truncate block" title={activeAsset.originalFileName}>
                        {activeAsset.originalFileName}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-400 font-bold block">4. MIME Type</span>
                      <span className="font-mono text-slate-900">{activeAsset.mimeType}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-400 font-bold block">5. File Size</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatFileSize(activeAsset.fileSize)} ({activeAsset.fileSize.toLocaleString()} bytes)
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-400 font-bold block">6. Course ID</span>
                      <span className="font-mono font-bold text-amber-800">{activeAsset.courseId}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-400 font-bold block">7. Module ID (Optional)</span>
                      <span className="font-mono text-slate-800">{activeAsset.moduleId || 'N/A (Global Course Asset)'}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-400 font-bold block">8. Uploaded By</span>
                      <span className="font-bold text-slate-900 truncate block">{activeAsset.uploadedBy}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-400 font-bold block">9. Uploaded At</span>
                      <span className="font-mono text-slate-800">{formatDate(activeAsset.uploadedAt)}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-400 font-bold block">10. Updated At</span>
                      <span className="font-mono text-slate-800">{formatDate(activeAsset.updatedAt)}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-400 font-bold block">11. Status</span>
                      <span className="font-bold text-green-700">{activeAsset.status}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 md:col-span-2">
                      <span className="text-slate-400 font-bold block">12. Storage Path</span>
                      <span className="font-mono text-[11px] text-slate-700 break-all">{activeAsset.storagePath}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 md:col-span-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-slate-400 font-bold">13. Public Download URL (`publicUrl`)</span>
                        <button
                          onClick={() => handleCopyUrl(activeAsset.publicUrl, activeAsset.id)}
                          className="text-amber-700 hover:text-amber-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> Copy URL
                        </button>
                      </div>
                      <span className="font-mono text-[11px] text-blue-600 break-all line-clamp-2">
                        {activeAsset.publicUrl}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-500">All 13 properties verified per Sprint 4.3 specification.</span>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: SOFT DELETE CONFIRMATION DIALOG                                    */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {deletingAssetId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">Soft Delete Digital Asset?</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Are you sure you want to soft-delete <span className="font-bold text-slate-900">&ldquo;{deletingFileName}&rdquo;</span>? This will mark its lifecycle status as <code className="bg-slate-100 px-1 py-0.5 rounded text-red-600 font-mono">DELETED</code> in Firestore without purging the physical object from Firebase Storage right away.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingAssetId(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition shadow-md cursor-pointer"
                >
                  Confirm Soft Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
