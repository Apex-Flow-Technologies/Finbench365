/**
 * ==============================================================================
 * FinBench365 — Administration Platform: Course Workspace & Module Management (Sprint 4.2)
 * ==============================================================================
 * Strictly adheres to `Component -> Hook -> Service -> Firestore` hierarchy.
 * Never accesses Firebase directly from this client component.
 *
 * Scope:
 * - Dynamic Route: `/admin/courses/[courseId]`
 * - Course Header & Information Summary (Status, Publish Status, Created Date, Updated Date)
 * - Navigation Tabs: Overview (Active), Modules (Active), Notes/Question Bank/Mock Tests/Students/Settings (Disabled Placeholders)
 * - Overview Tab: Read-only course information display (No editing).
 * - Modules Tab: Complete Module Management (`Create Module`, `Edit Module`, `Archive Module`, `Soft Delete Module`, `Reorder Modules`).
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Archive,
  Trash2,
  Eye,
  EyeOff,
  Tag,
  IndianRupee,
  HelpCircle,
  XCircle,
  Layers,
  FileText,
  HelpCircle as QuestionIcon,
  Award,
  Users,
  Settings,
  Plus,
  Edit3,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  HardDrive,
  RefreshCw,
  ShieldAlert,
  Info,
  Check,
} from 'lucide-react';
import { useCourseWorkspace } from '../../../../hooks/useCourseWorkspace';
import type { CourseSyllabusModule, DocumentStatus } from '../../../../types/firestore';

type TabType = 'overview' | 'modules' | 'notes' | 'question_bank' | 'mock_tests' | 'students' | 'settings';

interface ModuleFormData {
  title: string;
  description: string;
  moduleIndex: number;
  estimatedMinutes: number;
  lectureCount: number;
  status: DocumentStatus;
}

export default function CourseWorkspacePage() {
  const params = useParams();
  const courseId = (params?.courseId as string) || '';

  const {
    course,
    modules,
    loading,
    error,
    showDeletedModules,
    setShowDeletedModules,
    addModule,
    updateModule,
    archiveModule,
    softDeleteModule,
    reorderModules,
    isAdmin,
  } = useCourseWorkspace(courseId);

  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Modal State for Module Management
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<ModuleFormData>({
    title: '',
    description: '',
    moduleIndex: 1,
    estimatedMinutes: 60,
    lectureCount: 4,
    status: 'ACTIVE',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Deletion/Archive confirmation states
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);
  const [deletingModuleTitle, setDeletingModuleTitle] = useState<string>('');

  /**
   * Open modal to create a new module
   */
  const handleOpenCreateModal = () => {
    setModalMode('CREATE');
    setEditingModuleId(null);
    setFormData({
      title: '',
      description: '',
      moduleIndex: modules.length + 1,
      estimatedMinutes: 60,
      lectureCount: 4,
      status: 'ACTIVE',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  /**
   * Open modal to edit an existing module
   */
  const handleOpenEditModal = (mod: CourseSyllabusModule) => {
    setModalMode('EDIT');
    setEditingModuleId(mod.moduleId);
    setFormData({
      title: mod.title || '',
      description: mod.description || '',
      moduleIndex: mod.moduleIndex || 1,
      estimatedMinutes: mod.estimatedMinutes || 60,
      lectureCount: mod.lectureCount || 1,
      status: mod.status || 'ACTIVE',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  /**
   * Validate form fields
   */
  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setFormError('Module Title is strictly required.');
      return false;
    }
    if (!formData.description.trim()) {
      setFormError('Module Description is required for curriculum clarity.');
      return false;
    }
    if (isNaN(formData.estimatedMinutes) || formData.estimatedMinutes <= 0) {
      setFormError('Estimated Duration (minutes) must be a positive number.');
      return false;
    }
    if (isNaN(formData.lectureCount) || formData.lectureCount < 0) {
      setFormError('Lecture Count must be a non-negative integer.');
      return false;
    }
    return true;
  };

  /**
   * Handle form submission (`CREATE` or `EDIT`)
   */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (modalMode === 'CREATE') {
        await addModule({
          title: formData.title.trim(),
          description: formData.description.trim(),
          moduleIndex: Number(formData.moduleIndex) || modules.length + 1,
          estimatedMinutes: Number(formData.estimatedMinutes),
          lectureCount: Number(formData.lectureCount),
          status: formData.status,
        });
      } else if (modalMode === 'EDIT' && editingModuleId) {
        await updateModule(editingModuleId, {
          title: formData.title.trim(),
          description: formData.description.trim(),
          moduleIndex: Number(formData.moduleIndex),
          estimatedMinutes: Number(formData.estimatedMinutes),
          lectureCount: Number(formData.lectureCount),
          status: formData.status,
        });
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'An unexpected error occurred during module persistence.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Move module up in display order
   */
  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const currentList = [...modules];
    const item = currentList[index];
    currentList.splice(index, 1);
    currentList.splice(index - 1, 0, item);
    await reorderModules(currentList.map((m) => m.moduleId));
  };

  /**
   * Move module down in display order
   */
  const handleMoveDown = async (index: number) => {
    if (index >= modules.length - 1) return;
    const currentList = [...modules];
    const item = currentList[index];
    currentList.splice(index, 1);
    currentList.splice(index + 1, 0, item);
    await reorderModules(currentList.map((m) => m.moduleId));
  };

  /**
   * Confirm soft delete module
   */
  const handleConfirmSoftDelete = async () => {
    if (!deletingModuleId) return;
    try {
      await softDeleteModule(deletingModuleId);
      setDeletingModuleId(null);
    } catch (err: unknown) {
      console.error('Failed to soft delete module:', err);
    }
  };

  /**
   * Format ISO date string nicely
   */
  const formatDate = (dateStr?: string) => {
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

  // RBAC Guard
  if (!loading && !isAdmin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16 bg-[#FAFAF8]">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-xl text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Institutional administrative privileges (`ADMIN` or `SUPER_ADMIN`) are strictly required to access the Fintelyx Course Workspace.
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-[#FAFAF8]">
        <RefreshCw className="w-10 h-10 animate-spin text-amber-600 mb-3" />
        <p className="font-bold text-slate-700 text-sm">Loading institutional course workspace...</p>
        <p className="text-xs text-slate-400 font-mono mt-1">ID: {courseId}</p>
      </div>
    );
  }

  // Error state or missing course
  if (error || !course) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16 bg-[#FAFAF8]">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-xl text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900 mb-2">Workspace Synchronisation Failed</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">{error || 'Course document not found.'}</p>
          <Link
            href="/admin/courses"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition shadow"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Course Management
          </Link>
        </div>
      </div>
    );
  }

  const isPublished = course.status === 'ACTIVE' || course.isPublished === true;

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-800 pb-20">
      {/* Top Breadcrumb & Navigation */}
      <div className="border-b border-slate-200/80 bg-white sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/courses"
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center gap-1.5 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              Course Catalog
            </Link>
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {course.trackId}
                </span>
                <h1 className="text-lg font-black text-slate-900 tracking-tight truncate max-w-md">{course.title}</h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <Link
              href="/admin/assets"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-amber-500/10 text-amber-800 border border-amber-500/30 hover:bg-amber-500/20 transition shadow-2xs"
            >
              <HardDrive className="w-3.5 h-3.5 text-amber-600" />
              Digital Assets
            </Link>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black tracking-wide border ${
                course.status === 'ACTIVE'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : course.status === 'ARCHIVED'
                  ? 'bg-slate-100 text-slate-600 border-slate-300'
                  : course.status === 'DELETED'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {course.status === 'ACTIVE' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {course.status === 'DRAFT' && <Clock className="w-3.5 h-3.5" />}
              {course.status === 'ARCHIVED' && <Archive className="w-3.5 h-3.5" />}
              {course.status === 'DELETED' && <Trash2 className="w-3.5 h-3.5" />}
              Status: {course.status}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold border ${
                isPublished
                  ? 'bg-green-500/10 text-green-800 border-green-500/30'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {isPublished ? <Eye className="w-3.5 h-3.5 text-green-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
              {isPublished ? 'Published' : 'Unpublished'}
            </span>
          </div>
        </div>
      </div>

      {/* Course Header & Information Summary Banner */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold uppercase tracking-wider">
                  Workspace
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">
                  Category: {course.categoryId}
                </span>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">{course.title}</h2>
              <p className="text-sm text-slate-300 leading-relaxed line-clamp-2">{course.description}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 shrink-0 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Duration</span>
                <span className="font-bold text-white text-sm flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {course.durationDays}d
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Modules</span>
                <span className="font-bold text-white text-sm flex items-center gap-1 font-mono">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  {modules.length}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Created Date</span>
                <span className="font-mono text-slate-300 text-[11px] block">{formatDate(course.createdAt)}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Updated Date</span>
                <span className="font-mono text-slate-300 text-[11px] block">{formatDate(course.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs bar */}
      <div className="bg-white border-b border-slate-200/80 sticky top-[65px] z-10 shadow-2xs">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex items-center gap-1 overflow-x-auto py-2 no-scrollbar">
            {/* Overview Tab */}
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Overview
              <span className="px-1.5 py-0.5 bg-amber-400/20 text-amber-700 rounded text-[10px] font-mono ml-1">Active</span>
            </button>

            {/* Modules Tab */}
            <button
              onClick={() => setActiveTab('modules')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap shrink-0 ${
                activeTab === 'modules'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              Modules
              <span className="px-1.5 py-0.5 bg-amber-400/20 text-amber-700 rounded text-[10px] font-mono ml-1">Active</span>
              <span className="ml-1 px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded-full font-mono text-[11px]">
                {modules.length}
              </span>
            </button>

            {/* Notes Tab (Disabled Placeholder) */}
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs transition whitespace-nowrap shrink-0 ${
                activeTab === 'notes'
                  ? 'bg-amber-50 text-amber-900 border border-amber-200 font-bold'
                  : 'text-slate-400 hover:bg-slate-50'
              }`}
              title="Notes Management — Available in a future sprint"
            >
              <FileText className="w-4 h-4 opacity-60" />
              Notes
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-mono">Future Sprint</span>
            </button>

            {/* Question Bank Tab (Disabled Placeholder) */}
            <button
              onClick={() => setActiveTab('question_bank')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs transition whitespace-nowrap shrink-0 ${
                activeTab === 'question_bank'
                  ? 'bg-amber-50 text-amber-900 border border-amber-200 font-bold'
                  : 'text-slate-400 hover:bg-slate-50'
              }`}
              title="Question Bank — Available in a future sprint"
            >
              <QuestionIcon className="w-4 h-4 opacity-60" />
              Question Bank
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-mono">Future Sprint</span>
            </button>

            {/* Mock Tests Tab (Disabled Placeholder) */}
            <button
              onClick={() => setActiveTab('mock_tests')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs transition whitespace-nowrap shrink-0 ${
                activeTab === 'mock_tests'
                  ? 'bg-amber-50 text-amber-900 border border-amber-200 font-bold'
                  : 'text-slate-400 hover:bg-slate-50'
              }`}
              title="Mock Tests — Available in a future sprint"
            >
              <Award className="w-4 h-4 opacity-60" />
              Mock Tests
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-mono">Future Sprint</span>
            </button>

            {/* Students Tab (Disabled Placeholder) */}
            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs transition whitespace-nowrap shrink-0 ${
                activeTab === 'students'
                  ? 'bg-amber-50 text-amber-900 border border-amber-200 font-bold'
                  : 'text-slate-400 hover:bg-slate-50'
              }`}
              title="Students Roster — Available in a future sprint"
            >
              <Users className="w-4 h-4 opacity-60" />
              Students
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-mono">Future Sprint</span>
            </button>

            {/* Settings Tab (Disabled Placeholder) */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs transition whitespace-nowrap shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-amber-50 text-amber-900 border border-amber-200 font-bold'
                  : 'text-slate-400 hover:bg-slate-50'
              }`}
              title="Advanced Settings — Available in a future sprint"
            >
              <Settings className="w-4 h-4 opacity-60" />
              Settings
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-mono">Future Sprint</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Workspace Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* TAB 1: OVERVIEW (READ ONLY) */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Course Information Summary (Read-Only)</h3>
                    <p className="text-xs text-slate-500">
                      Institutional core metadata for this track. No editing in this tab per Sprint 4.2 architecture.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-mono font-bold">
                  ID: {course.id}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Course Name */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Course Name</span>
                  <span className="text-base font-black text-slate-900">{course.title}</span>
                </div>

                {/* Category */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Category</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white text-slate-800 text-xs font-bold border border-slate-200">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    {course.categoryId}
                  </span>
                </div>

                {/* Track Badge */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Track Badge</span>
                  <span className="text-sm font-black text-amber-800 bg-amber-100/60 px-2.5 py-1 rounded-lg border border-amber-200 inline-block font-mono">
                    {course.trackId}
                  </span>
                </div>

                {/* Duration */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Duration</span>
                  <span className="text-base font-black text-slate-900 flex items-center gap-1.5 font-mono">
                    <Clock className="w-4 h-4 text-slate-500" />
                    {course.durationDays} Days ({course.durationDays * 24} Hours Track)
                  </span>
                </div>

                {/* Price */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Price (INR)</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-black text-slate-900 flex items-center font-mono">
                      <IndianRupee className="w-4 h-4 mr-0.5 text-amber-600" />
                      {course.priceINR.toLocaleString('en-IN')}
                    </span>
                    {course.discountedPriceINR && course.discountedPriceINR < course.priceINR && (
                      <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                        Promo: ₹{course.discountedPriceINR.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Total Questions */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Questions</span>
                  <span className="text-base font-black text-slate-900 flex items-center gap-1.5 font-mono">
                    <HelpCircle className="w-4 h-4 text-slate-500" />
                    {course.totalQuestions || 0} Questions Evaluated
                  </span>
                </div>

                {/* Publication Status */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Publication Status</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                      isPublished
                        ? 'bg-green-50 text-green-800 border-green-200'
                        : 'bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    {isPublished ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    {isPublished ? 'Published (Active Catalog)' : 'Unpublished (Draft / Hidden)'}
                  </span>
                </div>

                {/* Available Plans */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 md:col-span-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Available Plans</span>
                  <div className="flex flex-wrap gap-2">
                    {course.availablePlans && course.availablePlans.length > 0 ? (
                      course.availablePlans.map((plan, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs"
                        >
                          {plan}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 italic">Standard Institutional Enrollment Tier</span>
                    )}
                  </div>
                </div>

                {/* Description Full Width */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 md:col-span-2 lg:col-span-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Course Description</span>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{course.description}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: MODULES (COMPLETE MODULE MANAGEMENT) */}
        {activeTab === 'modules' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Curriculum Module Management</h3>
                  <p className="text-xs text-slate-500">
                    Organize structured educational modules, order sequence (`moduleIndex`), duration, and lifecycle status.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDeletedModules((prev) => !prev)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                    showDeletedModules
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {showDeletedModules ? 'Hide Soft Deleted Modules' : 'Show Soft Deleted Modules'}
                </button>

                <button
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  Create Module
                </button>
              </div>
            </div>

            {/* Modules Table List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 w-16 text-center">Order</th>
                      <th className="py-3 px-4">Module Name & Description</th>
                      <th className="py-3 px-4">Estimated Duration</th>
                      <th className="py-3 px-4">Lectures</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Timestamps</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {modules.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-slate-500">
                          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          <p className="font-bold text-slate-700 text-base">No curriculum modules configured</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Click &ldquo;Create Module&rdquo; above to add structured syllabus milestones to this track.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      modules.map((mod, idx) => {
                        const isSoftDeleted = mod.status === 'DELETED';
                        return (
                          <tr
                            key={mod.moduleId}
                            className={`hover:bg-slate-50/60 transition ${isSoftDeleted ? 'bg-red-50/20 opacity-75' : ''}`}
                          >
                            {/* Order Sequence & Reorder Controls */}
                            <td className="py-4 px-4 text-center font-mono">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className="w-7 h-7 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-black text-xs shadow-2xs">
                                  {mod.moduleIndex}
                                </span>
                                {!isSoftDeleted && modules.length > 1 && (
                                  <div className="flex items-center gap-0.5 mt-1">
                                    <button
                                      onClick={() => handleMoveUp(idx)}
                                      disabled={idx === 0}
                                      className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 transition"
                                      title="Move Up"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleMoveDown(idx)}
                                      disabled={idx === modules.length - 1}
                                      className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 transition"
                                      title="Move Down"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Module Name & Description */}
                            <td className="py-4 px-4 max-w-sm">
                              <div className="font-bold text-slate-900 text-sm truncate" title={mod.title}>
                                {mod.title}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5">ID: {mod.moduleId}</div>
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{mod.description}</p>
                            </td>

                            {/* Estimated Duration */}
                            <td className="py-4 px-4 font-mono text-xs text-slate-700">
                              <div className="flex items-center gap-1.5 font-bold">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                {mod.estimatedMinutes || 0} mins
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                ~{((mod.estimatedMinutes || 0) / 60).toFixed(1)} hours
                              </div>
                            </td>

                            {/* Lectures */}
                            <td className="py-4 px-4 font-mono text-xs text-slate-700">
                              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-bold inline-block">
                                {mod.lectureCount || 0} Lectures
                              </span>
                            </td>

                            {/* Status Badge */}
                            <td className="py-4 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black tracking-wide border ${
                                  mod.status === 'ACTIVE' || !mod.status
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : mod.status === 'ARCHIVED'
                                    ? 'bg-slate-100 text-slate-600 border-slate-300'
                                    : mod.status === 'DELETED'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {(mod.status === 'ACTIVE' || !mod.status) && <CheckCircle2 className="w-3 h-3" />}
                                {mod.status === 'DRAFT' && <Clock className="w-3 h-3" />}
                                {mod.status === 'ARCHIVED' && <Archive className="w-3 h-3" />}
                                {mod.status === 'DELETED' && <Trash2 className="w-3 h-3" />}
                                {mod.status || 'ACTIVE'}
                              </span>
                            </td>

                            {/* Timestamps */}
                            <td className="py-4 px-4 font-mono text-[11px] text-slate-500">
                              <div>Created: {formatDate(mod.createdAt)}</div>
                              <div className="text-slate-400 mt-0.5">Updated: {formatDate(mod.updatedAt)}</div>
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {!isSoftDeleted && (
                                  <button
                                    onClick={() => handleOpenEditModal(mod)}
                                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                                    title="Edit Module Properties"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                )}

                                {!isSoftDeleted && mod.status !== 'ARCHIVED' && (
                                  <button
                                    onClick={() => archiveModule(mod.moduleId)}
                                    className="p-2 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 rounded-xl transition"
                                    title="Archive Module"
                                  >
                                    <Archive className="w-4 h-4" />
                                  </button>
                                )}

                                {!isSoftDeleted ? (
                                  <button
                                    onClick={() => {
                                      setDeletingModuleId(mod.moduleId);
                                      setDeletingModuleTitle(mod.title);
                                    }}
                                    className="p-2 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-700 rounded-xl transition"
                                    title="Soft Delete Module"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <span className="text-xs font-mono text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                                    Deleted
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
            </div>
          </motion.div>
        )}

        {/* TAB PLACEHOLDERS (DISABLED / FUTURE SPRINT) */}
        {['notes', 'question_bank', 'mock_tests', 'students', 'settings'].includes(activeTab) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-12">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-amber-200 shadow-md text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5 text-amber-800">
                {activeTab === 'notes' && <FileText className="w-8 h-8" />}
                {activeTab === 'question_bank' && <QuestionIcon className="w-8 h-8" />}
                {activeTab === 'mock_tests' && <Award className="w-8 h-8" />}
                {activeTab === 'students' && <Users className="w-8 h-8" />}
                {activeTab === 'settings' && <Settings className="w-8 h-8" />}
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-800 text-xs font-mono font-bold uppercase tracking-wider inline-block mb-3 border border-amber-300">
                Roadmap Item — Future Sprint
              </span>
              <h3 className="text-2xl font-black text-slate-900 mb-3 capitalize">
                {activeTab.replace('_', ' ')} Management Module
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Available in a future sprint per Fintelyx institutional roadmap. In strict adherence to Sprint 4.2 boundaries,
                no functional logic or database schemas for this module are active during the Course Workspace & Module Management phase.
              </p>
              <button
                onClick={() => setActiveTab('modules')}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition shadow-xs"
              >
                Return to Active Module Management
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT MODULE FORM DRAWER                                   */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-5 h-5 text-amber-400" />
                  <h3 className="font-black text-base">
                    {modalMode === 'CREATE' ? 'Create New Syllabus Module' : 'Edit Syllabus Module'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white transition p-1"
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

                {/* Module Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Module Name / Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Quantitative Foundations & Probability Theory"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-amber-500 font-medium"
                  />
                </div>

                {/* Module Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Module Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide curriculum scope, core learning objectives, and candidate deliverables..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                {/* Display Order & Status Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Display Order (Sequence)
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formData.moduleIndex}
                      onChange={(e) => setFormData({ ...formData, moduleIndex: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Lifecycle Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as DocumentStatus })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="ACTIVE">ACTIVE (Published)</option>
                      <option value="DRAFT">DRAFT (Hidden)</option>
                      <option value="ARCHIVED">ARCHIVED</option>
                      <option value="DELETED">DELETED (Soft Delete)</option>
                    </select>
                  </div>
                </div>

                {/* Duration & Lectures Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Estimated Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formData.estimatedMinutes}
                      onChange={(e) => setFormData({ ...formData, estimatedMinutes: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                    <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                      ~{(formData.estimatedMinutes / 60).toFixed(1)} hours study time
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Lecture Count
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={formData.lectureCount}
                      onChange={(e) => setFormData({ ...formData, lectureCount: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {modalMode === 'CREATE' ? 'Confirm & Create Module' : 'Save Module Updates'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: SOFT DELETE CONFIRMATION DIALOG                                    */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {deletingModuleId && (
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
              <h3 className="text-lg font-black text-slate-900 mb-2">Soft Delete Curriculum Module?</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Are you sure you want to soft-delete <span className="font-bold text-slate-900">&ldquo;{deletingModuleTitle}&rdquo;</span>? This will transition its lifecycle status to <code className="bg-slate-100 px-1 py-0.5 rounded text-red-600 font-mono">DELETED</code> and exclude it from candidate view.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingModuleId(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSoftDelete}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition shadow-md"
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
