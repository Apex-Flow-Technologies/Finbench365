'use client';

/**
 * ==============================================================================
 * FinBench365 — Administration Platform: Course Management Module (Sprint 4.1)
 * ==============================================================================
 * Strictly adheres to `Component -> Hook -> Service -> Firestore` hierarchy.
 * Never calls Firebase directly from this React component.
 *
 * Scope: ONLY Course Management (`Create Course`, `View Course List`, `Edit Course`,
 * `Publish Course`, `Unpublish Course`, `Archive Course`, `Soft Delete Course`).
 * Does NOT include Module Management, Notes Management, Question Bank, Mock Tests,
 * Coupons, Payments, Analytics, or CBT Engine per Sprint 4.1 strict rules.
 */

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Layers,
  Search,
  Plus,
  Edit3,
  Archive,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Filter,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  Tag,
  Clock,
  HelpCircle,
  IndianRupee,
} from 'lucide-react';
import { useAdminCourses } from '../../../hooks/useAdminCourses';
import { useAuth } from '../../../hooks/useAuth';
import type { CourseDocument, CourseInstructor } from '../../../types/firestore';

interface CourseFormData {
  id?: string;
  title: string;
  slug: string;
  categoryId: string;
  trackId: string;
  description: string;
  level: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'INSTITUTIONAL';
  durationDays: number;
  priceINR: number;
  discountedPriceINR: number;
  thumbnailUrl: string;
  totalLectures: number;
  totalQuestions: number;
  totalMockTests: number;
  isFeatured: boolean;
  instructorName: string;
  instructorCredentials: string;
  availablePlansInput: string; // Comma-separated plan names
}

const INITIAL_FORM_DATA: CourseFormData = {
  title: '',
  slug: '',
  categoryId: 'cat_quant',
  trackId: 'Track A • Foundation Tier',
  description: '',
  level: 'BASIC',
  durationDays: 90,
  priceINR: 14999,
  discountedPriceINR: 11999,
  thumbnailUrl: '',
  totalLectures: 24,
  totalQuestions: 500,
  totalMockTests: 5,
  isFeatured: false,
  instructorName: 'Dr. Alistair Vance',
  instructorCredentials: 'PhD Quantitative Finance, CFA Charterholder',
  availablePlansInput: '3-Month Intensive, 6-Month Comprehensive, Annual Institutional Access',
};

const ITEMS_PER_PAGE = 8;

export default function CourseManagementAdminPage() {
  const { user, authenticated } = useAuth();
  const {
    courses,
    categories,
    loading,
    error,
    createCourse,
    updateCourse,
    publishCourse,
    unpublishCourse,
    archiveCourse,
    softDeleteCourse,
    refresh,
    isAdmin,
  } = useAdminCourses();

  // Local UI state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showDeleteToggle, setShowDeleteToggle] = useState<boolean>(false);

  // Modal State (`CREATE` or `EDIT`)
  const [modalMode, setModalMode] = useState<'NONE' | 'CREATE' | 'EDIT'>('NONE');
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CourseFormData>(INITIAL_FORM_DATA);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Soft Delete Confirmation Dialog
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [deletingCourseTitle, setDeletingCourseTitle] = useState<string>('');

  /**
   * Filtered & Searched Course List Memoization
   */
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      // Soft-delete toggle filter
      if (!showDeleteToggle && course.status === 'DELETED') {
        return false;
      }
      if (showDeleteToggle && course.status !== 'DELETED') {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'ALL' && course.categoryId !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'ALL' && course.status !== selectedStatus) {
        return false;
      }
      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        return (
          course.title.toLowerCase().includes(q) ||
          course.description.toLowerCase().includes(q) ||
          course.slug.toLowerCase().includes(q) ||
          course.trackId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [courses, showDeleteToggle, selectedCategory, selectedStatus, searchQuery]);

  /**
   * Pagination computation
   */
  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / ITEMS_PER_PAGE));
  const paginatedCourses = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCourses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCourses, currentPage]);

  /**
   * Open modal to create a new course
   */
  const handleOpenCreateModal = () => {
    setFormData(INITIAL_FORM_DATA);
    setEditingCourseId(null);
    setFormError(null);
    setModalMode('CREATE');
  };

  /**
   * Open modal to edit existing course
   */
  const handleOpenEditModal = (course: CourseDocument) => {
    setFormData({
      id: course.id,
      title: course.title,
      slug: course.slug,
      categoryId: course.categoryId,
      trackId: course.trackId,
      description: course.description,
      level: course.level || 'BASIC',
      durationDays: course.durationDays,
      priceINR: course.priceINR,
      discountedPriceINR: course.discountedPriceINR || course.priceINR,
      thumbnailUrl: course.thumbnailUrl || '',
      totalLectures: course.totalLectures || 0,
      totalQuestions: course.totalQuestions || 0,
      totalMockTests: course.totalMockTests || 0,
      isFeatured: Boolean(course.isFeatured),
      instructorName: course.instructor?.name || 'Institutional Faculty',
      instructorCredentials: course.instructor?.credentials || 'Quantitative Lead',
      availablePlansInput: course.availablePlans ? course.availablePlans.join(', ') : 'Standard Institutional Access',
    });
    setEditingCourseId(course.id);
    setFormError(null);
    setModalMode('EDIT');
  };

  /**
   * Auto-slugify helper when typing title
   */
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      title: value,
      slug:
        modalMode === 'CREATE' && !prev.id
          ? value
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
          : prev.slug,
    }));
  };

  /**
   * Validate form inputs before submission
   */
  const validateForm = (): boolean => {
    setFormError(null);

    // Required fields check
    if (!formData.title.trim()) {
      setFormError('Course Name (Title) is required.');
      return false;
    }
    if (!formData.slug.trim()) {
      setFormError('Course Slug (URL identifier) is required.');
      return false;
    }
    if (!formData.categoryId.trim()) {
      setFormError('Course Category is required.');
      return false;
    }
    if (!formData.trackId.trim()) {
      setFormError('Track Badge identifier is required.');
      return false;
    }
    if (!formData.description.trim()) {
      setFormError('Course Description cannot be empty.');
      return false;
    }

    // Duplicate course name validation
    const normalizedTitle = formData.title.trim().toLowerCase();
    const isDuplicate = courses.some(
      (c) =>
        c.title.trim().toLowerCase() === normalizedTitle &&
        (modalMode === 'CREATE' || c.id !== editingCourseId)
    );
    if (isDuplicate) {
      setFormError(`A course with the title "${formData.title.trim()}" already exists. Course titles must be unique.`);
      return false;
    }

    // Numeric validation
    if (isNaN(formData.priceINR) || formData.priceINR < 0) {
      setFormError('Base Price must be a valid positive number in INR.');
      return false;
    }
    if (isNaN(formData.durationDays) || formData.durationDays <= 0) {
      setFormError('Course Duration must be a positive number of days (e.g., 30, 90, 180).');
      return false;
    }
    if (isNaN(formData.totalQuestions) || formData.totalQuestions < 0) {
      setFormError('Total Questions must be a valid non-negative integer.');
      return false;
    }

    return true;
  };

  /**
   * Submit course creation or update
   */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setFormError(null);

    const instructor: CourseInstructor = {
      name: formData.instructorName.trim() || 'Institutional Faculty',
      credentials: formData.instructorCredentials.trim() || 'Quantitative Specialist',
    };

    const availablePlans = formData.availablePlansInput
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    try {
      if (modalMode === 'CREATE') {
        await createCourse({
          id: formData.slug || undefined,
          title: formData.title.trim(),
          slug: formData.slug.trim(),
          categoryId: formData.categoryId,
          trackId: formData.trackId.trim(),
          description: formData.description.trim(),
          level: formData.level,
          durationDays: Number(formData.durationDays),
          priceINR: Number(formData.priceINR),
          discountedPriceINR: Number(formData.discountedPriceINR) || Number(formData.priceINR),
          thumbnailUrl: formData.thumbnailUrl.trim() || undefined,
          syllabus: [],
          totalLectures: Number(formData.totalLectures) || 0,
          totalQuestions: Number(formData.totalQuestions) || 0,
          totalMockTests: Number(formData.totalMockTests) || 0,
          isFeatured: formData.isFeatured,
          instructor,
          availablePlans: availablePlans.length > 0 ? availablePlans : ['Standard Institutional Tier'],
          status: 'DRAFT',
          isPublished: false,
        });
      } else if (modalMode === 'EDIT' && editingCourseId) {
        await updateCourse(editingCourseId, {
          title: formData.title.trim(),
          slug: formData.slug.trim(),
          categoryId: formData.categoryId,
          trackId: formData.trackId.trim(),
          description: formData.description.trim(),
          level: formData.level,
          durationDays: Number(formData.durationDays),
          priceINR: Number(formData.priceINR),
          discountedPriceINR: Number(formData.discountedPriceINR) || Number(formData.priceINR),
          thumbnailUrl: formData.thumbnailUrl.trim() || undefined,
          totalLectures: Number(formData.totalLectures) || 0,
          totalQuestions: Number(formData.totalQuestions) || 0,
          totalMockTests: Number(formData.totalMockTests) || 0,
          isFeatured: formData.isFeatured,
          instructor,
          availablePlans: availablePlans.length > 0 ? availablePlans : ['Standard Institutional Tier'],
        });
      }
      setModalMode('NONE');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'An unexpected error occurred during persistence.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Toggle publish state of a course
   */
  const handleTogglePublish = async (course: CourseDocument) => {
    try {
      if (course.status === 'ACTIVE' || course.isPublished) {
        await unpublishCourse(course.id);
      } else {
        await publishCourse(course.id);
      }
    } catch (err: unknown) {
      console.error('Failed to toggle publish status:', err);
    }
  };

  /**
   * Execute soft delete on confirmation
   */
  const handleConfirmSoftDelete = async () => {
    if (!deletingCourseId) return;
    try {
      await softDeleteCourse(deletingCourseId);
      setDeletingCourseId(null);
      setDeletingCourseTitle('');
    } catch (err: unknown) {
      console.error('Failed to soft delete course:', err);
    }
  };

  // Render unauthorized institutional guard if not admin
  if (!authenticated || !isAdmin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16 bg-[#FAFAF8]">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-xl text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Institutional administrative privileges (`ADMIN` or `SUPER_ADMIN`) are strictly required to access the Fintelyx Course Management Module.
          </p>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 font-mono mb-6">
            Current Role: {user?.role || 'STUDENT / GUEST'}
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition shadow-md"
          >
            Return to Candidate Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-10 px-4 sm:px-6 lg:px-8">
      {/* Module Header Bar */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-0.5 bg-amber-500/10 text-amber-700 border border-amber-500/30 rounded-full">
                Administration Platform • Sprint 4.1
              </span>
              <span className="text-xs font-mono text-slate-400">Locked Scope: Course Management Only</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-amber-600" />
              Course Management Hub
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Create, publish, inspect, and soft-delete institutional curriculum courses across Quantitative Finance & Risk tracks.
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowDeleteToggle(!showDeleteToggle);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition border ${
                showDeleteToggle
                  ? 'bg-red-50 text-red-700 border-red-200 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {showDeleteToggle ? 'Viewing Soft Deleted' : 'View Soft Deleted'}
            </button>

            <button
              onClick={() => refresh()}
              disabled={loading}
              className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition disabled:opacity-50 shadow-sm"
              title="Refresh course data from Firestore"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition shadow-md hover:shadow-lg"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              Create Course
            </button>
          </div>
        </div>

        {/* Sprint 4.1 Strict Scope Notice */}
        <div className="mt-4 p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Sprint 4.1 Active:</strong> Module Management, Notes, CBT Question Bank, and Mock Test editors are strictly isolated until Sprint 4.2+ approval.
            </span>
          </div>
          <span className="font-mono bg-white px-2 py-0.5 rounded border border-amber-200 text-amber-700 font-bold">
            0% Scope Creep
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <strong className="font-bold block">Firestore Communication Error</strong>
              <span>{error}</span>
            </div>
            <button onClick={() => refresh()} className="text-xs font-bold underline text-red-700 hover:text-red-900">
              Retry
            </button>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Course Title, Slug, or Track Badge..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
            />
          </div>

          {/* Category & Status Selectors */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
                <option value="cat_quant">Quantitative Finance</option>
                <option value="cat_risk">Institutional Risk (FRM Prep)</option>
                <option value="cat_cfa">Chartered Financial Analyst (CFA)</option>
              </select>
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Published (ACTIVE)</option>
              <option value="DRAFT">Draft (Unpublished)</option>
              <option value="ARCHIVED">Archived</option>
              {showDeleteToggle && <option value="DELETED">Soft Deleted</option>}
            </select>

            <div className="text-xs font-mono text-slate-500 px-2">
              Showing <strong className="text-slate-900">{filteredCourses.length}</strong> courses
            </div>
          </div>
        </div>

        {/* Course Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Course Info & ID</th>
                  <th className="py-3.5 px-4">Category / Track</th>
                  <th className="py-3.5 px-4">Pricing (INR)</th>
                  <th className="py-3.5 px-4">Syllabus Metrics</th>
                  <th className="py-3.5 px-4">Status & Visibility</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-600 mx-auto mb-2" />
                      Loading institutional course catalog from Firestore...
                    </td>
                  </tr>
                ) : paginatedCourses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-500">
                      <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="font-bold text-slate-700 text-base">No matching courses found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try adjusting your search filters or click &ldquo;Create Course&rdquo; to add a new curriculum track.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedCourses.map((course) => {
                    const isPublished = course.status === 'ACTIVE' || course.isPublished === true;
                    const isSoftDeleted = course.status === 'DELETED';

                    return (
                      <tr
                        key={course.id}
                        className={`hover:bg-slate-50/60 transition ${
                          isSoftDeleted ? 'bg-red-50/20 opacity-75' : ''
                        }`}
                      >
                        {/* Course Info & ID */}
                        <td className="py-4 px-4 max-w-xs">
                          <div className="flex items-start gap-3">
                            {course.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={course.thumbnailUrl}
                                alt={course.title}
                                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-black text-xs shrink-0 border border-slate-800">
                                {course.level?.substring(0, 3) || 'FIN'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <Link
                                href={`/admin/courses/${course.id}`}
                                className="font-bold text-slate-900 truncate hover:text-amber-600 transition block"
                                title="Open Course Workspace"
                              >
                                {course.title}
                              </Link>
                              <div className="text-xs font-mono text-slate-400 mt-0.5 truncate">
                                ID: {course.id} • Slug: /{course.slug}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                {course.description || 'No detailed syllabus description provided.'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category & Track */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 mb-1">
                            <Tag className="w-3 h-3 text-amber-600" />
                            {course.categoryId}
                          </span>
                          <div className="text-xs font-bold text-slate-600 flex items-center gap-1">
                            {course.trackId}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">Level: {course.level || 'BASIC'}</div>
                        </td>

                        {/* Pricing */}
                        <td className="py-4 px-4">
                          <div className="font-black text-slate-900 flex items-center text-sm">
                            <IndianRupee className="w-3.5 h-3.5 mr-0.5 text-amber-600" />
                            {course.priceINR.toLocaleString('en-IN')}
                          </div>
                          {course.discountedPriceINR && course.discountedPriceINR < course.priceINR && (
                            <div className="text-xs text-green-700 font-semibold mt-0.5">
                              Promo: ₹{course.discountedPriceINR.toLocaleString('en-IN')}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-400 mt-1">
                            {course.availablePlans ? `${course.availablePlans.length} Tier(s)` : 'Standard'}
                          </div>
                        </td>

                        {/* Syllabus Metrics */}
                        <td className="py-4 px-4 font-mono text-xs text-slate-600">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{course.durationDays} Days</span>
                          </div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                            <span>{course.totalQuestions || 0} Questions</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {course.totalLectures || 0} Lectures • {course.totalMockTests || 0} Mocks
                          </div>
                        </td>

                        {/* Status & Visibility Badge */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black tracking-wide border ${
                                course.status === 'ACTIVE'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : course.status === 'ARCHIVED'
                                  ? 'bg-slate-100 text-slate-600 border-slate-300'
                                  : course.status === 'DELETED'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {course.status === 'ACTIVE' && <CheckCircle2 className="w-3 h-3" />}
                              {course.status === 'DRAFT' && <Clock className="w-3 h-3" />}
                              {course.status === 'ARCHIVED' && <Archive className="w-3 h-3" />}
                              {course.status === 'DELETED' && <Trash2 className="w-3 h-3" />}
                              {course.status}
                            </span>

                            {/* Quick Publish/Unpublish Toggle Switch */}
                            {!isSoftDeleted && (
                              <button
                                onClick={() => handleTogglePublish(course)}
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold transition border ${
                                  isPublished
                                    ? 'bg-green-500/10 text-green-800 border-green-500/30 hover:bg-green-500/20'
                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                }`}
                                title={isPublished ? 'Click to Unpublish (Draft)' : 'Click to Publish (Make Active)'}
                              >
                                {isPublished ? <Eye className="w-3 h-3 text-green-600" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
                                {isPublished ? 'Published' : 'Unpublished'}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Workspace Button */}
                            {!isSoftDeleted && (
                              <Link
                                href={`/admin/courses/${course.id}`}
                                className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl transition border border-amber-200/60"
                                title="Open Course Workspace"
                              >
                                <Layers className="w-4 h-4" />
                              </Link>
                            )}

                            {/* Edit Button */}
                            {!isSoftDeleted && (
                              <button
                                onClick={() => handleOpenEditModal(course)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                                title="Edit Course Properties"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Archive Button */}
                            {!isSoftDeleted && course.status !== 'ARCHIVED' && (
                              <button
                                onClick={() => archiveCourse(course.id)}
                                className="p-2 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 rounded-xl transition"
                                title="Archive Course"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            )}

                            {/* Soft Delete Button */}
                            {!isSoftDeleted ? (
                              <button
                                onClick={() => {
                                  setDeletingCourseId(course.id);
                                  setDeletingCourseTitle(course.title);
                                }}
                                className="p-2 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-700 rounded-xl transition"
                                title="Soft Delete Course"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-xs font-mono text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                                Soft Deleted
                              </span>
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="bg-slate-50/80 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500 font-medium">
                Page <strong className="text-slate-900 font-bold">{currentPage}</strong> of{' '}
                <strong className="text-slate-900 font-bold">{totalPages}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition disabled:opacity-40 disabled:pointer-events-none shadow-sm flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition disabled:opacity-40 disabled:pointer-events-none shadow-sm flex items-center gap-1"
                >
                  Next <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================== */}
      {/* Soft Delete Confirmation Modal */}
      {/* ====================================================================== */}
      <AnimatePresence>
        {deletingCourseId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl"
            >
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Soft Delete Course?</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Are you sure you want to soft-delete <strong className="text-slate-900">&ldquo;{deletingCourseTitle}&rdquo;</strong>?
                The course status will be transitioned to <code className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-mono font-bold">DELETED</code> and hidden from candidate enrollment portals.
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 mb-6">
                <strong>Institutional Compliance Note:</strong> Soft deleted records remain in Firestore for audit recovery (`status: &apos;DELETED&apos;`).
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeletingCourseId(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSoftDelete}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition shadow-md"
                >
                  Yes, Soft Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================================================================== */}
      {/* Create / Edit Course Modal Drawer */}
      {/* ====================================================================== */}
      <AnimatePresence>
        {modalMode !== 'NONE' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8 my-8"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    {modalMode === 'CREATE' ? 'New Curriculum Track' : 'Administrative Edit'}
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    {modalMode === 'CREATE' ? 'Create Institutional Course' : 'Edit Course Specification'}
                  </h3>
                </div>
                <button
                  onClick={() => setModalMode('NONE')}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Validation Alert */}
              {formError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-sm">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block">Validation Check Failed</strong>
                    <span>{formError}</span>
                  </div>
                </div>
              )}

              {/* Course Specification Form */}
              <form onSubmit={handleFormSubmit} className="space-y-6 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Course Title */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Course Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Quantitative Risk Mastery — Level I"
                      value={formData.title}
                      onChange={handleTitleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  {/* Course Slug (URL Identifier) */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Course Slug / ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., quant-risk-mastery-level-1"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  {/* Category Identifier */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                      <option value="cat_quant">Quantitative Finance</option>
                      <option value="cat_risk">Institutional Risk (FRM Prep)</option>
                      <option value="cat_cfa">Chartered Financial Analyst (CFA)</option>
                    </select>
                  </div>

                  {/* Track Badge */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Track Badge Label <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Track A • Foundation Tier"
                      value={formData.trackId}
                      onChange={(e) => setFormData({ ...formData, trackId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  {/* Course Level */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Academic Level
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          level: e.target.value as 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'INSTITUTIONAL',
                        })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    >
                      <option value="BASIC">Basic / Foundation Tier</option>
                      <option value="INTERMEDIATE">Intermediate Level</option>
                      <option value="ADVANCED">Advanced Quantitative</option>
                      <option value="INSTITUTIONAL">Institutional Corporate Tier</option>
                    </select>
                  </div>

                  {/* Course Description */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Syllabus Overview / Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Enter detailed institutional syllabus description covering mathematical derivations, CBT features, and target audience..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  {/* Base Price (INR) */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Base Price (₹ INR) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.priceINR}
                      onChange={(e) => setFormData({ ...formData, priceINR: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  {/* Discounted Price (INR) */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Discounted / Promo Price (₹ INR)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.discountedPriceINR}
                      onChange={(e) => setFormData({ ...formData, discountedPriceINR: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  {/* Duration (Days) */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Duration (Days) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={formData.durationDays}
                      onChange={(e) => setFormData({ ...formData, durationDays: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  {/* Total Questions */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Total Questions <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.totalQuestions}
                      onChange={(e) => setFormData({ ...formData, totalQuestions: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  {/* Total Lectures & Mock Tests */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Total Lectures
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.totalLectures}
                      onChange={(e) => setFormData({ ...formData, totalLectures: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Total Mock Tests
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.totalMockTests}
                      onChange={(e) => setFormData({ ...formData, totalMockTests: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  {/* Thumbnail URL */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Thumbnail Image URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://storage.googleapis.com/finbench365/thumbnails/quant-1.png"
                      value={formData.thumbnailUrl}
                      onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  {/* Available Plans String Input */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Available Plans (Comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="3-Month Intensive, 6-Month Comprehensive, Annual Institutional Access"
                      value={formData.availablePlansInput}
                      onChange={(e) => setFormData({ ...formData, availablePlansInput: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  {/* Instructor Specification */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Instructor Name
                    </label>
                    <input
                      type="text"
                      placeholder="Dr. Alistair Vance"
                      value={formData.instructorName}
                      onChange={(e) => setFormData({ ...formData, instructorName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                      Instructor Credentials
                    </label>
                    <input
                      type="text"
                      placeholder="PhD Quantitative Finance, CFA Charterholder"
                      value={formData.instructorCredentials}
                      onChange={(e) => setFormData({ ...formData, instructorCredentials: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Form Actions */}
                <div className="pt-6 border-t border-slate-200 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalMode('NONE')}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-2 shadow-md"
                  >
                    {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />}
                    {modalMode === 'CREATE' ? 'Create Institutional Course' : 'Save Course Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
