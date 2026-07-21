'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCourses, createCourse } from '@/lib/firebase/db';
import { Plus, BookOpen, Clock, Settings, Search } from 'lucide-react';

export default function EditorDashboard() {
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getCourses();
        setCourses(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCreateCourse = async () => {
    const title = prompt("Enter Course Title:");
    if (!title) return;
    
    try {
      const id = await createCourse({ title, description: 'New Course', tier: 'Foundation' });
      alert("Course created!");
      // We would normally route to /editor/courses/[id] here
      window.location.reload(); 
    } catch (err) {
      alert("Failed to create course");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Content Manager</h1>
          <p className="text-slate-400">Manage courses, mock tests, and curriculum.</p>
        </div>
        <button 
          onClick={handleCreateCourse}
          className="flex items-center gap-2 bg-amber-500 text-[#121419] font-bold px-6 py-3 rounded-xl hover:bg-amber-400 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create New Course
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-500">Loading courses...</div>
        ) : courses.length === 0 ? (
          <div className="col-span-full p-12 text-center border border-dashed border-[#282C36] rounded-2xl text-slate-500">
            No courses found. Create your first course to get started.
          </div>
        ) : (
          courses.map(course => (
            <div key={course.id} className="bg-[#181A1F] border border-[#282C36] rounded-2xl p-6 hover:border-amber-500/50 transition-colors group cursor-pointer" onClick={() => router.push(`/editor/courses/${course.id}`)}>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${course.isPublished ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[#272B33] text-slate-400'}`}>
                  {course.isPublished ? 'Published' : 'Draft'}
                </div>
              </div>
              <h3 className="font-bold text-lg text-white mb-1 group-hover:text-amber-500 transition-colors">{course.title}</h3>
              <p className="text-sm text-slate-400 mb-6 line-clamp-2">{course.description}</p>
              
              <div className="flex gap-2 mt-auto">
                <button 
                  onClick={(e) => { e.stopPropagation(); router.push(`/editor/tests/new`); }}
                  className="flex-1 py-2 rounded-lg border border-[#282C36] text-xs font-bold hover:bg-[#272B33] transition-colors"
                >
                  Create Mock Test
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
