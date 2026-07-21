'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  { levelColor: 'border border-amber-500/15 hover:border-amber-500/35', badgeBg: 'bg-amber-500/10 border-amber-500/30', badgeText: 'text-amber-400 font-bold' },
  { levelColor: 'border border-blue-500/15 hover:border-blue-500/35', badgeBg: 'bg-blue-500/10 border-blue-500/30', badgeText: 'text-blue-400 font-bold' },
  { levelColor: 'border border-purple-500/15 hover:border-purple-500/35', badgeBg: 'bg-purple-500/10 border-purple-500/30', badgeText: 'text-purple-400 font-bold' },
  { levelColor: 'border border-emerald-500/15 hover:border-emerald-500/35', badgeBg: 'bg-emerald-500/10 border-emerald-500/30', badgeText: 'text-emerald-400 font-bold' },
];

export default function ExamsPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  
  const [coursesData, setCoursesData] = useState<CoursePackage[]>([]);
  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      const matchesSearch =
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.trackBadge.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'All' || course.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [coursesData, searchQuery, selectedCategory]);

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
    <div className="min-h-screen bg-[#121419] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#121419] text-[#FBFBF9] pt-20">
      {/* Dark Institutional Hero Banner */}
      <section className="relative py-16 md:py-24 bg-[#181A1F] border-b border-[#282C36] overflow-hidden px-6 md:px-8">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, #FFFFFF 1px, transparent 1px),
              linear-gradient(to bottom, #FFFFFF 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        <div className="max-w-[1240px] mx-auto relative z-10">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-[1.12] font-sans">
              Explore Examination Curricula & <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-slate-100 to-slate-400">
                Algorithmic Study Tracks.
              </span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
              Select your targeted certification track below. Every package includes full-length CBT mock exams, comprehensive topic-wise notes, and dynamic algorithmic question banks engineered for high-stakes candidates.
            </p>
          </div>
        </div>
      </section>

      {/* Sticky Control Toolbar with Search Bar and View Switcher */}
      <div className="sticky top-[64px] z-30 bg-[#16181D]/95 backdrop-blur-md border-b border-[#282C36] shadow-md py-4 px-6 md:px-8">
        <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${selectedCategory === cat
                    ? 'bg-amber-500 text-[#121419] font-bold shadow-sm'
                    : 'bg-[#181A1F] text-slate-300 hover:text-white border border-[#282C36] hover:border-slate-600'
                  }`}
              >
                {cat === 'All' ? 'All Tracks' : cat}
              </button>
            ))}
          </div>

          {/* Right Controls: Small Search Bar + Card/Horizontal View Switcher */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            {/* Small Search Bar */}
            <div className="relative flex-1 sm:w-64 md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tracks, modules, notes..."
                className="w-full pl-9 pr-4 py-2 bg-[#121419] text-white placeholder-slate-500 text-xs sm:text-sm rounded-lg border border-[#282C36] focus:border-amber-400 focus:outline-none transition-colors font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* View Switcher Button (Cards vs Horizontal Bar) */}
            <div className="flex items-center bg-[#121419] border border-[#282C36] rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                title="Switch to Card Form"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${viewMode === 'grid'
                    ? 'bg-[#272B33] text-amber-400 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="Switch to Horizontal Bar Form"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${viewMode === 'list'
                    ? 'bg-[#272B33] text-amber-400 shadow-sm'
                    : 'text-slate-400 hover:text-white'
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
          <div className="text-center py-20 bg-[#181A1F] border border-[#282C36] rounded-2xl p-8 max-w-xl mx-auto space-y-4">
            <Layers className="w-12 h-12 text-slate-500 mx-auto" />
            <h3 className="text-xl font-semibold text-white">No Examination Tracks Found</h3>
            <p className="text-slate-400 text-sm">
              No curricula matched your search query &quot;{searchQuery}&quot;. Try clearing your filter or searching for &quot;Quantitative&quot;, &quot;Level&quot;, or &quot;Risk&quot;.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
              className="px-5 py-2.5 rounded-lg bg-amber-500 text-[#121419] font-bold text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'grid' ? (
              /* CARD FORM LAYOUT */
              <motion.div
                key="grid-view"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className={`bg-[#181A1F] rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 relative group ${course.levelColor}`}
                  >
                    <div>
                      {/* Top Track Badge */}
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <span className={`px-3 py-1 rounded-full border font-mono text-[11px] font-semibold tracking-wide ${course.badgeBg} ${course.badgeText}`}>
                          {course.trackBadge}
                        </span>
                        <BookOpen className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                      </div>

                      {/* Course Title */}
                      <h3 className="text-xl font-bold text-white leading-snug mb-3">
                        {course.title}
                      </h3>

                      {/* Course Description */}
                      <p className="text-slate-300 text-sm leading-relaxed mb-6">
                        {course.description}
                      </p>

                      {/* Key Study Resources Grid */}
                      <div className="grid grid-cols-2 gap-2 py-3 px-3.5 rounded-xl bg-[#121419] border border-[#282C36] text-center text-xs mb-6">
                        <div>
                          <span className="block font-mono font-bold text-amber-500 text-sm">{course.mockCount.split(' ')[0]}</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Full Mocks</span>
                        </div>
                        <div className="border-l border-[#282C36]">
                          <span className="block font-mono font-bold text-slate-200 text-sm">{course.notesCount.split(' ')[0]}</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-tighter">PDF Notes</span>
                        </div>
                      </div>

                      {/* Key Features Bullet Points */}
                      <div className="space-y-2.5 mb-8 border-t border-[#282C36] pt-5">
                        {course.features.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                            <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Action Button (Buy Now with NO price listed) */}
                    {(() => {
                      const courseStatus = getCourseStatus(course.id);
                      if (courseStatus?.status === 'active') {
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push('/dashboard');
                            }}
                            className="w-full py-3.5 px-6 rounded-xl bg-[#272B33] hover:bg-[#2c303a] text-white font-bold text-sm tracking-wide shadow-md transition-all duration-300 flex items-center justify-center gap-2 group/btn focus:outline-none"
                          >
                            <span>Resume Course</span>
                            <span className="text-amber-500 font-mono text-[10px] uppercase ml-1">({courseStatus.daysLeft} days left)</span>
                          </button>
                        );
                      }
                      
                      const isExpired = courseStatus?.status === 'expired';
                      return (
                        <button
                          onClick={(e) => handleBuyNow(course.id, e)}
                          disabled={purchasingId === course.id}
                          className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#121419] font-bold text-sm tracking-wide shadow-md transition-all duration-300 flex items-center justify-center gap-2 group/btn focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#181A1F]"
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
                ))}
              </motion.div>
            ) : (
              /* HORIZONTAL BAR TYPE LAYOUT */
              <motion.div
                key="list-view"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="flex flex-col gap-5"
              >
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className={`bg-[#181A1F] rounded-2xl p-6 sm:p-7 transition-all duration-300 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative group ${course.levelColor}`}
                  >
                    {/* Left: Title, Badge, Description */}
                    <div className="flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded border font-mono text-[10px] font-semibold tracking-wide ${course.badgeBg} ${course.badgeText}`}>
                          {course.trackBadge}
                        </span>
                        <h3 className="text-xl font-bold text-white leading-tight">
                          {course.title}
                        </h3>
                      </div>
                      <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
                        {course.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-400 font-mono">
                        <span className="flex items-center gap-1.5 text-amber-500 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {course.mockCount}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
                          <FileText className="w-3.5 h-3.5 text-slate-400" /> {course.notesCount}
                        </span>
                      </div>
                    </div>

                    {/* Right: Action Button */}
                    <div className="w-full lg:w-auto flex-shrink-0">
                      {(() => {
                        const courseStatus = getCourseStatus(course.id);
                        if (courseStatus?.status === 'active') {
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push('/dashboard');
                              }}
                              className="w-full lg:w-48 py-3.5 px-6 rounded-xl bg-[#272B33] hover:bg-[#2c303a] text-white font-bold text-sm tracking-wide shadow-md transition-all duration-300 flex items-center justify-center gap-2 group/btn focus:outline-none"
                            >
                              <span>Resume Course</span>
                              <span className="text-amber-500 font-mono text-[10px] uppercase ml-1">({courseStatus.daysLeft}d)</span>
                            </button>
                          );
                        }
                        
                        const isExpired = courseStatus?.status === 'expired';
                        return (
                          <button
                            onClick={(e) => handleBuyNow(course.id, e)}
                            disabled={purchasingId === course.id}
                            className="w-full lg:w-48 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#121419] font-bold text-sm tracking-wide shadow-md transition-all duration-300 flex items-center justify-center gap-2 group/btn focus:outline-none"
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
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
