'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { format } from 'date-fns';
import { CreditCard, CheckCircle2, ShieldCheck, Download, Search } from 'lucide-react';
import { PLAN_PRICING } from '@/constants/pricing';

interface Order {
  id: string;
  userId: string;
  userEmail?: string;
  courseId: string;
  planId: string;
  paymentId: string;
  orderId: string;
  amount: number;
  status: string;
  createdAt: any;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchOrders() {
      try {
        const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const fetchedOrders: Order[] = [];
        const userCache = new Map<string, string>(); // userId -> email

        for (const document of querySnapshot.docs) {
          const data = document.data() as Omit<Order, 'id'>;
          
          let userEmail = userCache.get(data.userId);
          if (!userEmail && data.userId) {
            try {
              const userDoc = await getDoc(doc(db, 'users', data.userId));
              if (userDoc.exists() && userDoc.data().email) {
                userEmail = userDoc.data().email;
                userCache.set(data.userId, userEmail!);
              } else {
                userEmail = 'Unknown User';
              }
            } catch (err) {
              userEmail = 'Unknown User';
            }
          }

          fetchedOrders.push({
            id: document.id,
            ...data,
            userEmail
          });
        }
        
        setOrders(fetchedOrders);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(order => 
    order.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.paymentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (order.userEmail && order.userEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
    order.courseId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-amber-500" />
            Orders & Revenue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor all transactions including real payments and developer bypasses.
          </p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, email, course..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#121419] border border-slate-200 dark:border-[#282C36] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#282C36] bg-slate-50 dark:bg-[#1A1C23]">
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Order ID</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Candidate</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Plan / Course</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#282C36]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"></div>
                      Loading orders...
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const planData = PLAN_PRICING[order.planId as keyof typeof PLAN_PRICING];
                  const isBypass = order.status === 'bypassed';
                  
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-[#1A1C23] transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-mono font-medium text-slate-900 dark:text-white">
                            {order.orderId}
                          </span>
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            {order.paymentId}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {order.userEmail}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-900 dark:text-white">
                            {planData ? planData.name : order.planId}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {order.courseId}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm font-mono font-medium text-slate-900 dark:text-white">
                          ₹{order.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {isBypass ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-500/20">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Bypassed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'MMM dd, yyyy HH:mm') : 'Unknown'}
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
  );
}
