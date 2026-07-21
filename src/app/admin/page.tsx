'use client';

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Users, FileText, Activity, IndianRupee } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SuperAdminDashboard() {
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [totalEnrollments, setTotalEnrollments] = useState<number | null>(null);
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  useEffect(() => {
    // Real-time Users Query
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      setTotalUsers(snapshot.size);
      
      let enrollmentsCount = 0;
      let revenueSum = 0;

      const usersList = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = new Date();
        if (data.createdAt) {
          if (typeof data.createdAt.toDate === 'function') {
            createdAt = data.createdAt.toDate();
          } else {
            createdAt = new Date(data.createdAt);
          }
        }
        
        // Calculate enrollments and revenue
        const enrolledCourses = data.enrolledCourses || {};
        const userCoursesCount = Object.keys(enrolledCourses).length;
        enrollmentsCount += userCoursesCount;
        
        // Sum revenue if stored on user (e.g., from Razorpay webhook)
        const userRevenue = data.totalSpent || 0;
        revenueSum += userRevenue;
        
        let pendingStatus = 'None';
        if (userCoursesCount > 0) {
           const activeCourses = Object.values(enrolledCourses).filter((course: any) => {
              if (course.expiresAt && typeof course.expiresAt.toDate === 'function') {
                 return course.expiresAt.toDate() > new Date();
              }
              return true;
           }).length;
           pendingStatus = `${activeCourses} Active`;
        }

        return {
          id: doc.id,
          name: data.name || 'Unknown',
          email: data.email,
          createdAt,
          coursesCount: userCoursesCount,
          pendingStatus,
          revenue: userRevenue
        };
      });

      setTotalEnrollments(enrollmentsCount);
      setTotalRevenue(revenueSum);
      setRecentUsers(usersList.slice(0, 10)); // Top 10 most recent
    });

    return () => unsubscribeUsers();
  }, []);

  const stats = [
    { label: 'Total Registered Users', value: totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Total Active Enrollments', value: totalEnrollments, icon: FileText, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Total Revenue Generated', value: totalRevenue !== null ? `₹${totalRevenue.toLocaleString('en-IN')}` : null, icon: IndianRupee, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Overview Dashboard</h1>
      <p className="text-slate-400 mb-8">Real-time metrics and platform health.</p>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {stats.map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-[#181A1F] border border-[#282C36] rounded-2xl p-6 flex items-center gap-4 shadow-sm"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-mono mb-1">{stat.label}</div>
              <div className="text-2xl font-bold text-white">
                {stat.value === null ? (
                  <span className="animate-pulse">Loading...</span>
                ) : (
                  stat.value
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Users List */}
      <div className="bg-[#181A1F] border border-[#282C36] rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-6">Registered Users</h2>
        
        {recentUsers.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            No users found on the platform yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#282C36] text-xs font-mono text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 px-4 font-medium">Name</th>
                  <th className="pb-3 px-4 font-medium">Email</th>
                  <th className="pb-3 px-4 font-medium text-center">Courses Enrolled</th>
                  <th className="pb-3 px-4 font-medium">Status</th>
                  <th className="pb-3 px-4 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {recentUsers.map((user) => (
                  <tr key={user.id} className="border-b border-[#282C36] last:border-0 hover:bg-[#20232B] transition-colors">
                    <td className="py-4 px-4 text-white font-bold text-sm">{user.name}</td>
                    <td className="py-4 px-4 text-slate-300 text-xs">{user.email}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="px-2 py-1 bg-[#272B33] rounded-md font-mono text-amber-400 font-bold">
                        {user.coursesCount}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {user.coursesCount > 0 ? (
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-xs font-semibold">{user.pendingStatus}</span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-500/10 text-slate-400 rounded text-xs">No Courses</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right text-emerald-400 font-mono font-bold text-sm">
                      ₹{user.revenue.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
