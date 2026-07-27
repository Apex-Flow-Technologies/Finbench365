'use client';

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { updateUserRole } from '@/lib/firebase/db';
import { Shield, ShieldAlert, User as UserIcon, Loader2 } from 'lucide-react';

export default function UsersManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    // Real-time Users Query
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = new Date();
        if (data.createdAt) {
          if (typeof data.createdAt.toDate === 'function') {
            createdAt = data.createdAt.toDate();
          } else {
            createdAt = new Date(data.createdAt);
          }
        }
        return {
          id: doc.id,
          ...data,
          createdAt
        };
      });
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (userId: string, newRole: 'student' | 'editor' | 'admin') => {
    if (window.confirm(`Are you sure you want to change this user's role to ${newRole.toUpperCase()}?`)) {
      setUpdatingId(userId);
      try {
        await updateUserRole(userId, newRole);
      } catch (err) {
        console.error(err);
        alert('Failed to update role. Ensure you have sufficient permissions.');
      } finally {
        setUpdatingId(null);
      }
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">User Management</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8">Manage registered users and assign administrative roles.</p>

      <div className="bg-white border-slate-200 dark:bg-[#181A1F] dark:border-[#282C36] border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-amber-500" />
            <p className="text-sm font-mono">Fetching user records...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#282C36] bg-slate-50 dark:bg-[#121419]/50">
                  <th className="py-4 px-6 text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">User Details</th>
                  <th className="py-4 px-6 text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Registered Date</th>
                  <th className="py-4 px-6 text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Current Role</th>
                  <th className="py-4 px-6 text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 dark:border-[#282C36] last:border-0 hover:bg-slate-50 dark:hover:bg-[#20232B] transition-colors">
                    
                    {/* User Info */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#272B33] flex items-center justify-center text-slate-500 dark:text-slate-300 shrink-0">
                          {user.role === 'admin' ? <Shield className="w-5 h-5 text-emerald-500" /> : <UserIcon className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white mb-0.5">{user.name || 'Unknown Name'}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{user.email}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-1">ID: {user.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-4 px-6 text-slate-600 dark:text-slate-400 text-sm">
                      {user.createdAt.toLocaleDateString()}
                    </td>

                    {/* Role Badge */}
                    <td className="py-4 px-6">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-md text-xs font-bold uppercase tracking-wider">
                          <Shield className="w-3 h-3" /> Admin
                        </span>
                      ) : user.role === 'editor' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-md text-xs font-bold uppercase tracking-wider">
                          <ShieldAlert className="w-3 h-3" /> Editor
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-md text-xs font-bold uppercase tracking-wider">
                          <UserIcon className="w-3 h-3" /> Student
                        </span>
                      )}
                    </td>

                    {/* Actions — Revoke only */}
                    <td className="py-4 px-6 text-right">
                      {updatingId === user.id ? (
                        <div className="flex justify-end pr-4">
                          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                        </div>
                      ) : user.role !== 'student' ? (
                        <button
                          onClick={() => handleRoleChange(user.id, 'student')}
                          className="px-4 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 dark:bg-[#272B33] dark:hover:bg-red-500/10 dark:text-slate-300 dark:hover:text-red-400 dark:border-[#323842] dark:hover:border-red-500/30 rounded-lg text-xs font-semibold transition-all"
                        >
                          Revoke Access
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-600 font-mono pr-4">—</span>
                      )}
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
