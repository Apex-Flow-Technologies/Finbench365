'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  LayoutGrid,
  List,
  BookOpen,
  FileText,
  CheckCircle2,
  ArrowRight,
  Layers,
  Loader2
} from 'lucide-react';
import { getCourses, getUserEntitlements } from '@/lib/firebase/db';
import { useAuth } from '@/context/AuthContext';

interface CoursePackage {
  id: string;
  title: string;
  trackBadge: string;
  category: 'Foundation' | 'Advanced' | 'Quantitative' | 'Comprehensive';
  description: string;
  mockCount: string;
  notesCount: string;
  features: string[];
  levelColor: string;
  badgeBg: string;
  badgeText: string;
}

const COLORS = [
  { levelColor: 'border-amber-200 dark:border-amber-500/15 hover:border-amber-300 dark:hover:border-amber-500/35', badgeBg: 'bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30', badgeText: 'text-amber-700 dark:text-amber-400 font-bold' },
  { levelColor: 'border-blue-200 dark:border-blue-500/15 hover:border-blue-300 dark:hover:border-blue-500/35', badgeBg: 'bg-blue-100 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30', badgeText: 'text-blue-700 dark:text-blue-400 font-bold' },
  { levelColor: 'border-purple-200 dark:border-purple-500/15 hover:border-purple-300 dark:hover:border-purple-500/35', badgeBg: 'bg-purple-100 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30', badgeText: 'text-purple-700 dark:text-purple-400 font-bold' },
  { levelColor: 'border-emerald-200 dark:border-emerald-500/15 hover:border-emerald-300 dark:hover:border-emerald-500/35', badgeBg: 'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30', badgeText: 'text-emerald-700 dark:text-emerald-400 font-bold' },
];

export default function ExamsPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  
  const [coursesData, setCoursesData] = useState<CoursePackage[]>([]);
  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Debounce the search input by 300ms to avoid filtering on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (user?.uid) {
      getUserEntitlements(user.uid).then(data => {
        setEntitlements(data);
      }).catch(err => console.error(err));
    } else {
      setEntitlements([]);
    }
  }, [user?.uid]);

  useEffect(() => {
    async function load() {
      try {
        const data = await getCourses();
        const published = data.filter((c: any) => c.isPublished);
        
        const mapped = published.map((course: any) => {
          let colorIndex = 0;
          if (course.track === 'Track B') colorIndex = 1;
          else if (course.track === 'Track C') colorIndex = 2;
          else if (course.track === 'Track D') colorIndex = 3;
          
          const color = COLORS[colorIndex];
          return {
            id: course.id,
            title: course.title || 'Untitled Course',
            description: course.description || '',
            trackBadge: `${course.track || 'Track A'} • ${course.tier || 'Foundation Tier'}`,
            category: course.tier || 'Foundation',
            mockCount: `${course.mockCount || 0} Full Mocks`,
            notesCount: `${course.notesCount || 0} PDF Notes`,
            features: [
              'Exact CBT terminal simulation with flag & review',
              'Step-by-step matrix derivation walkthroughs',
              'Instant diagnostic score tracking & item analysis'
            ],
            ...color
          } as CoursePackage;
        });
        
        setCoursesData(mapped);
      } catch (err) {
        console.error("Failed to load courses", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const categories = ['All', 'Foundation', 'Advanced', 'Quantitative', 'Comprehensive'];

  const filteredCourses = useMemo(() => {
    return coursesData.filter((course) => {
      const q = debouncedSearch.toLowerCase();
      const matchesSearch =
        course.title.toLowerCase().includes(q) ||
        course.description.toLowerCase().includes(q) ||
        course.trackBadge.toLowerCase().includes(q);

      const matchesCategory = selectedCategory === 'All' || course.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [coursesData, debouncedSearch, selectedCategory]);

  const getCourseStatus = (courseId: string) => {
    const entitlement = entitlements.find(e => e.courseId === courseId);
    if (!entitlement) return null;

    const diffDays = Math.ceil((entitlement.expiresAt.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    if (diffDays <= 0) return { status: 'expired', daysLeft: 0 };
    return { status: 'active', daysLeft: diffDays };
  };

  const handleBuyNow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPurchasingId(id);
    setTimeout(() => {
      setPurchasingId(null);
      if (!user) {
        router.push(`/login?redirect=/pricing?courseId=${id}&track=${encodeURIComponent(coursesData.find(c => c.id === id)?.title || '')}`);
      } else {
        router.push(`/pricing?courseId=${id}&track=${encodeURIComponent(coursesData.find(c => c.id === id)?.title || '')}`);
      }
    }, 400);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121419] flex items-center justify-center transition-colors duration-300">
      <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121419] text-[#111B35] dark:text-[#FBFBF9] pt-20 transition-colors duration-300">
      {/* Dark Institutional Hero Banner - We keep this somewhat dark in light mode too, or make it light. Let's make it responsive. */}
      <section className="relative py-16 md:py-24 bg-white border-b border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] overflow-hidden px-6 md:px-8 transition-colors duration-300">
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        <div className="max-w-[1240px] mx-auto relative z-10">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#111B35] dark:text-white leading-[1.12] font-sans">
              Explore Examination Curricula & <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-slate-600 to-slate-900 dark:from-amber-200 dark:via-slate-100 dark:to-slate-400">
                Algorithmic Study Tracks.
              </span>
            </h1>
            <p className="text-[#334155] dark:text-[#E2E8F0] text-base sm:text-lg leading-relaxed max-w-2xl">
              Select your targeted certification track below. Every package includes full-length CBT mock exams, comprehensive topic-wise notes, and dynamic algorithmic question banks engineered for high-stakes candidates.
            </p>
          </div>
        </div>
      </section>

      {/* Sticky Control Toolbar with Search Bar and View Switcher */}
      <div className="sticky top-[64px] z-30 bg-white/95 dark:bg-[#16181D]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#282C36] shadow-sm py-4 px-6 md:px-8 transition-colors duration-300">
        <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-4">          {/* Right Controls: Small Search Bar + Card/Horizontal View Switcher */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            {/* Small Search Bar */}
            <div className="relative flex-1 sm:w-64 md:w-72">
              <Search className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tracks, modules, notes..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 text-[#111B35] placeholder-slate-500 border border-slate-200 focus:border-amber-500 dark:bg-[#121419] dark:text-white dark:border-[#282C36] dark:focus:border-amber-400 text-xs sm:text-sm rounded-lg focus:outline-none transition-colors font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-slate-600 dark:text-[#94A3B8] dark:hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* View Switcher Button (Cards vs Horizontal Bar) */}
            <div className="flex items-center bg-slate-100 border border-slate-200 dark:bg-[#121419] dark:border-[#282C36] rounded-lg p-1 transition-colors duration-300">
              <button
                onClick={() => setViewMode('grid')}
                title="Switch to Card Form"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${viewMode === 'grid'
                    ? 'bg-white text-amber-600 shadow-sm dark:bg-[#272B33] dark:text-amber-400'
                    : 'text-[#475569] hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-white'
                  }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="Switch to Horizontal Bar Form"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${viewMode === 'list'
                    ? 'bg-white text-amber-600 shadow-sm dark:bg-[#272B33] dark:text-amber-400'
                    : 'text-[#475569] hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-white'
                  }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Horizontal</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid/List */}
      <div className="max-w-[1240px] mx-auto px-6 md:px-8 py-12 md:py-16">
        {filteredCourses.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="text-center py-20 bg-white border border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] rounded-2xl p-8 max-w-xl mx-auto space-y-4 shadow-sm transition-colors duration-300"
          >
            <Layers className="w-12 h-12 text-[#475569] dark:text-[#94A3B8] mx-auto" />
            <h3 className="text-xl font-semibold text-[#111B35] dark:text-white">No Examination Tracks Found</h3>
            <p className="text-[#475569] dark:text-[#94A3B8] text-sm">
              No curricula matched your search query &quot;{searchQuery}&quot;. Try clearing your filter or searching for &quot;Quantitative&quot;, &quot;Level&quot;, or &quot;Risk&quot;.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
              className="px-5 py-2.5 rounded-lg bg-amber-500 text-[#111B35] dark:text-[#121419] font-bold text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors"
            >
              Reset Filters
            </button>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'grid' ? (
              /* CARD FORM LAYOUT */
              <motion.div
                key="grid-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {filteredCourses.map((course, i) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.26, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -4, transition: { duration: 0.18 } }}
                    whileTap={{ scale: 0.98 }}
                    className={`bg-white border dark:bg-[#181A1F] rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-colors duration-300 relative group shadow-sm hover:shadow-lg dark:hover:shadow-black/40 ${course.levelColor}`}
                  >
                    <div>
                      {/* Top Icon */}
                      <div className="flex justify-end mb-4">
                        <BookOpen className="w-4 h-4 text-[#475569] group-hover:text-amber-500 dark:text-[#94A3B8] dark:group-hover:text-amber-400 transition-colors" />
                      </div>

                      {/* Course Title */}
                      <h3 className="text-xl font-bold text-[#111B35] dark:text-white leading-snug mb-3 transition-colors">
                        {course.title}
                      </h3>

                      {/* Course Description */}
                      <p className="text-[#334155] dark:text-[#E2E8F0] text-sm leading-relaxed mb-6 transition-colors">
                        {course.description}
                      </p>

                      {/* Key Study Resources Grid */}
                      <div className="grid grid-cols-2 gap-2 py-3 px-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-[#121419] dark:border-[#282C36] text-center text-xs mb-6 transition-colors">
                        <div>
                          <span className="block tabular-nums font-bold text-amber-600 dark:text-amber-500 text-sm">{course.mockCount.split(' ')[0]}</span>
                          <span className="text-[10px] text-[#475569] dark:text-[#94A3B8] uppercase tracking-tighter">Full Mocks</span>
                        </div>
                        <div className="border-l border-slate-200 dark:border-[#282C36]">
                          <span className="block tabular-nums font-bold text-[#334155] dark:text-[#E2E8F0] text-sm">{course.notesCount.split(' ')[0]}</span>
                          <span className="text-[10px] text-[#475569] dark:text-[#94A3B8] uppercase tracking-tighter">PDF Notes</span>
                        </div>
                      </div>

                      {/* Key Features Bullet Points */}
                      <div className="space-y-2.5 mb-8 border-t border-slate-100 dark:border-[#282C36] pt-5 transition-colors">
                        {course.features.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs text-[#334155] dark:text-[#E2E8F0]">
                            <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Action Button */}
                    {(() => {
                      // Admins/editors cannot buy — redirect to editor
                      if (user?.role === 'admin' || user?.role === 'editor') {
                        return (
                          <button
                            onClick={() => router.push('/editor')}
                            className="w-full py-3.5 px-6 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 dark:bg-[#272B33] dark:hover:bg-[#2c303a] dark:border-[#323842] text-[#334155] dark:text-[#E2E8F0] font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 group/btn focus:outline-none"
                          >
                            <span>Manage in Editor</span>
                            <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                          </button>
                        );
                      }

                      const courseStatus = getCourseStatus(course.id);
                      if (courseStatus?.status === 'active') {
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push('/dashboard');
                            }}
                            className="w-full py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white dark:bg-[#272B33] dark:hover:bg-[#2c303a] font-bold text-sm tracking-wide shadow-md transition-all duration-300 flex items-center justify-center gap-2 group/btn focus:outline-none"
                          >
                            <span>Resume Course</span>
                            <span className="text-amber-400 dark:text-amber-500 tabular-nums text-[10px] uppercase ml-1">({courseStatus.daysLeft} days left)</span>
                          </button>
                        );
                      }
                      
                      const isExpired = courseStatus?.status === 'expired';
                      return (
                        <button
                          onClick={(e) => handleBuyNow(course.id, e)}
                          disabled={purchasingId === course.id}
                          className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#111B35] dark:text-[#121419] font-bold text-sm tracking-wide shadow-[0_4px_14px_rgba(245,158,11,0.25)] transition-all duration-300 flex items-center justify-center gap-2 group/btn focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#181A1F]"
                        >
                          {purchasingId === course.id ? (
                            <span className="animate-pulse">Processing...</span>
                          ) : (
                            <>
                              <span>{isExpired ? 'Renew Access' : 'Buy Now'}</span>
                              <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                            </>
                          )}
                        </button>
                      );
                    })()}
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              /* HORIZONTAL BAR TYPE LAYOUT */
              <motion.div
                key="list-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-5"
              >
                {filteredCourses.map((course, i) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.24, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ x: 4, transition: { duration: 0.15 } }}
                    whileTap={{ scale: 0.99 }}
                    className={`bg-white border dark:bg-[#181A1F] rounded-2xl p-6 sm:p-7 transition-colors duration-300 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative group shadow-sm hover:shadow-lg dark:hover:shadow-black/40 ${course.levelColor}`}
                  >
                    {/* Left: Title, Badge, Description */}
                    <div className="flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-bold text-[#111B35] dark:text-white leading-tight transition-colors">
                          {course.title}
                        </h3>
                      </div>
                      <p className="text-[#334155] dark:text-[#E2E8F0] text-sm max-w-3xl leading-relaxed transition-colors">
                        {course.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#475569] dark:text-[#94A3B8] tabular-nums transition-colors">
                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {course.mockCount}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5 text-[#334155] dark:text-[#E2E8F0] font-semibold">
                          <FileText className="w-3.5 h-3.5 text-[#475569]" /> {course.notesCount}
                        </span>
                      </div>
                    </div>

                      {/* Right: Action Button */}
                      <div className="w-full lg:w-auto flex-shrink-0">
                        {(() => {
                          // Admins/editors cannot buy — redirect to editor
                          if (user?.role === 'admin' || user?.role === 'editor') {
                            return (
                              <button
                                onClick={() => router.push('/editor')}
                                className="w-full lg:w-48 py-3.5 px-6 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 dark:bg-[#272B33] dark:hover:bg-[#2c303a] dark:border-[#323842] text-[#334155] dark:text-[#E2E8F0] font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 group/btn focus:outline-none"
                              >
                                <span>Manage in Editor</span>
                                <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                              </button>
                            );
                          }

                          const courseStatus = getCourseStatus(course.id);
                          if (courseStatus?.status === 'active') {
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push('/dashboard');
                                }}
                                className="w-full lg:w-48 py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white dark:bg-[#272B33] dark:hover:bg-[#2c303a] font-bold text-sm tracking-wide shadow-md transition-all duration-300 flex items-center justify-center gap-2 group/btn focus:outline-none"
                              >
                                <span>Resume Course</span>
                                <span className="text-amber-400 dark:text-amber-500 tabular-nums text-[10px] uppercase ml-1">({courseStatus.daysLeft}d)</span>
                              </button>
                            );
                          }
                          
                          const isExpired = courseStatus?.status === 'expired';
                          return (
                            <button
                              onClick={(e) => handleBuyNow(course.id, e)}
                              disabled={purchasingId === course.id}
                              className="w-full lg:w-48 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#111B35] dark:text-[#121419] font-bold text-sm tracking-wide shadow-[0_4px_14px_rgba(245,158,11,0.25)] transition-all duration-300 flex items-center justify-center gap-2 group/btn focus:outline-none"
                            >
                              {purchasingId === course.id ? (
                                <span className="animate-pulse">Processing...</span>
                              ) : (
                                <>
                                  <span>{isExpired ? 'Renew Access' : 'Buy Now'}</span>
                                  <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                                </>
                              )}
                            </button>
                          );
                        })()}
                      </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
