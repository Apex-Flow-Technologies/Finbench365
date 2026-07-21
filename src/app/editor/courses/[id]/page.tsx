'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getCourse, getCourseChapters, updateCourse, createChapter, updateChapter } from '@/lib/firebase/db';
import { ChevronLeft, Plus, Save, Settings, Layers, GripVertical, FileText, UploadCloud, BookOpen, CheckCircle2 } from 'lucide-react';

export default function CourseBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const courseId = unwrappedParams.id;
  const router = useRouter();

  const [course, setCourse] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const cData = await getCourse(courseId);
        setCourse(cData);
        
        const chData = await getCourseChapters(courseId);
        setChapters(chData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  const handleUpdateCourse = async () => {
    setIsSaving(true);
    try {
      // 1. Save Course Details
      await updateCourse(courseId, {
        title: course.title,
        description: course.description,
        isPublished: course.isPublished,
        tier: course.tier
      });

      // 2. Save all chapter updates
      for (const chapter of chapters) {
        await updateChapter(chapter.id, {
          title: chapter.title,
          materialLink: chapter.materialLink || '',
          order: chapter.order
        });
      }

      alert('Course and chapters published successfully!');
    } catch (err) {
      alert('Failed to publish course.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddChapter = async () => {
    try {
      const id = await createChapter(courseId, {
        title: `Chapter ${chapters.length + 1}`,
        order: chapters.length,
        materialLink: ''
      });
      setChapters([...chapters, { id, title: `Chapter ${chapters.length + 1}`, order: chapters.length, isPublished: false, courseId, materialLink: '' }]);
    } catch (err) {
      alert('Failed to create chapter.');
    }
  };

  const updateChapterLocal = (index: number, field: string, value: string) => {
    const updated = [...chapters];
    updated[index] = { ...updated[index], [field]: value };
    setChapters(updated);
  };

  if (loading) return <div className="p-8 text-white">Loading Course...</div>;
  if (!course) return <div className="p-8 text-white">Course not found.</div>;

  return (
    <div className="flex flex-col h-full bg-[#0B0C10] text-[#FBFBF9]">
      {/* Header */}
      <header className="shrink-0 bg-[#121419] border-b border-[#282C36] p-4 flex justify-between items-center z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/editor')} className="p-2 hover:bg-[#282C36] rounded-lg transition-colors text-slate-400">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{course.title} <span className="text-amber-500 font-mono text-sm ml-2">COURSE BUILDER</span></h1>
            <p className="text-slate-400 text-sm">Linear Pipeline</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full space-y-12 pb-32">
        
        {/* Course Settings */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-xl font-bold text-white border-b border-[#282C36] pb-2">
            <Settings className="w-5 h-5 text-amber-500" />
            1. Course Settings
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#121419] border border-[#282C36] p-6 rounded-2xl">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Course Title</label>
              <input
                type="text"
                value={course.title}
                onChange={(e) => setCourse({...course, title: e.target.value})}
                className="w-full bg-[#181A1F] border border-[#282C36] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pricing Tier</label>
              <select 
                value={course.tier || 'Foundation'}
                onChange={(e) => setCourse({...course, tier: e.target.value})}
                className="w-full bg-[#181A1F] border border-[#282C36] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="Sprint">Sprint Revision (10 Days)</option>
                <option value="Comprehensive">Comprehensive (30 Days)</option>
                <option value="Foundation">Foundation (60 Days)</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
              <textarea
                value={course.description}
                onChange={(e) => setCourse({...course, description: e.target.value})}
                className="w-full bg-[#181A1F] border border-[#282C36] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 h-24 resize-y"
              />
            </div>
          </div>
        </section>

        {/* Curriculum Stream */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-[#282C36] pb-2">
            <div className="flex items-center gap-2 text-xl font-bold text-white">
              <Layers className="w-5 h-5 text-amber-500" />
              2. Curriculum Stream
            </div>
            <button 
              onClick={handleAddChapter}
              className="flex items-center gap-1 text-sm font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg"
            >
              <Plus className="w-4 h-4" /> Add Chapter Block
            </button>
          </div>

          <div className="space-y-6">
            {chapters.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-[#282C36] rounded-2xl text-slate-500">
                Click "Add Chapter Block" to start building your curriculum.
              </div>
            ) : (
              chapters.map((chapter, index) => (
                <div key={chapter.id} className="bg-[#121419] border border-[#282C36] rounded-2xl p-6 relative group">
                  <div className="absolute left-[-16px] top-8 cursor-grab text-slate-600 hover:text-slate-400 p-1 bg-[#0B0C10] rounded-full border border-[#282C36]">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  
                  <div className="flex items-center gap-3 mb-6">
                     <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex justify-center items-center font-mono text-sm font-bold shrink-0">
                      {index + 1}
                     </div>
                     <input
                        type="text"
                        value={chapter.title}
                        onChange={(e) => updateChapterLocal(index, 'title', e.target.value)}
                        placeholder="Chapter Title (e.g. Quantitative Risk)"
                        className="flex-1 bg-transparent border-b border-transparent hover:border-[#282C36] focus:border-amber-500 text-lg font-bold text-white focus:outline-none transition-colors py-1"
                     />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Material Section */}
                    <div className="space-y-2 bg-[#181A1F] p-4 rounded-xl border border-[#282C36]">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Study Material Link
                      </label>
                      <input
                        type="text"
                        value={chapter.materialLink || ''}
                        onChange={(e) => updateChapterLocal(index, 'materialLink', e.target.value)}
                        placeholder="Paste Google Drive/AWS link here..."
                        className="w-full bg-[#121419] border border-[#282C36] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 mt-1"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Students will download the PDF/Docx from this link.</p>
                    </div>

                    {/* Mock Test Section */}
                    <div className="space-y-2 bg-[#181A1F] p-4 rounded-xl border border-[#282C36] flex flex-col justify-center items-center text-center">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <UploadCloud className="w-3.5 h-3.5" /> Mock Test Parser
                      </label>
                      {chapter.mockTestId ? (
                        <div className="flex flex-col items-center justify-center w-full h-full pb-2">
                          <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-1" />
                          <span className="text-sm font-bold text-emerald-500 mb-2">Test Attached successfully</span>
                          <button 
                            onClick={() => router.push(`/editor/tests/${chapter.mockTestId}`)}
                            className="text-xs font-bold text-amber-500 hover:text-amber-400 underline decoration-amber-500/30 underline-offset-4"
                          >
                            Edit Questions
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => router.push(`/editor/tests/new?chapterId=${chapter.id}`)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-[#121419] transition-colors text-sm font-bold mt-1"
                        >
                          <BookOpen className="w-4 h-4" />
                          Import Mock Test (.docx)
                        </button>
                      )}
                    </div>
                  </div>
                  
                </div>
              ))
            )}
          </div>
        </section>

        {/* 3. Publish */}
        <section className="space-y-6 pt-12 border-t border-[#282C36]">
          <div className="flex items-center gap-2 text-xl font-bold text-white mb-2">
            <UploadCloud className="w-5 h-5 text-emerald-500" />
            3. Storefront Status
          </div>
          <div className="bg-[#121419] border border-[#282C36] rounded-2xl p-6 flex items-center justify-between">
            <div>
               <h3 className="text-white font-bold text-lg mb-1">Make this course live</h3>
               <p className="text-slate-400 text-sm">Turning this on will make the course available for purchase immediately.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={course.isPublished}
                onChange={(e) => setCourse({...course, isPublished: e.target.checked})}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-[#282C36] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <button 
            onClick={handleUpdateCourse} 
            disabled={isSaving} 
            className="w-full flex justify-center items-center gap-2 py-4 rounded-xl bg-amber-500 text-[#121419] hover:bg-amber-400 transition-colors text-lg font-black shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-50 mt-8"
          >
            <Save className="w-5 h-5" />
            {isSaving ? 'Saving to Database...' : 'Save & Publish Course'}
          </button>
        </section>

      </div>
    </div>
  );
}
