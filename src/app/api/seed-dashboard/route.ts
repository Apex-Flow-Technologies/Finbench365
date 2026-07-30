import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const batch = adminDb.batch();
    const names = ['Aarav', 'Vihaan', 'Aditya', 'Sai', 'Arjun', 'Siddharth', 'Rohan', 'Rahul', 'Ananya', 'Diya', 'Ishita', 'Sneha', 'Priya', 'Kavya', 'Neha', 'Pooja', 'Vikram', 'Karan', 'Tarun', 'Nitin', 'Divya', 'Riya', 'Kriti', 'Meera', 'Anjali'];
    const lastNames = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Verma', 'Reddy', 'Rao', 'Nair', 'Menon'];

    for (let i = 0; i < 25; i++) {
      const userRef = adminDb.collection('users').doc();
      const firstName = names[Math.floor(Math.random() * names.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const numCourses = Math.floor(Math.random() * 4) + 1; // 1 to 4 courses
      const totalSpent = numCourses * (Math.floor(Math.random() * 3000) + 999);
      
      const enrolledCourses: any = {};
      for (let j = 0; j < numCourses; j++) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30 + Math.floor(Math.random() * 60));
        enrolledCourses['course_' + j] = {
          expiresAt: expiresAt,
          enrolledAt: new Date(),
          durationDays: 90,
          planId: 'dummy_plan',
          paymentId: 'pay_' + Math.random().toString(36).substring(7)
        };
      }

      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 60));

      batch.set(userRef, {
        name: firstName + ' ' + lastName,
        email: firstName.toLowerCase() + '.' + lastName.toLowerCase() + Math.floor(Math.random() * 100) + '@example.com',
        displayName: firstName + ' ' + lastName,
        role: 'student',
        enrolledCourses,
        totalSpent,
        createdAt,
      });
    }

    await batch.commit();
    return NextResponse.json({ success: true, message: 'Dashboard seeded successfully' });
  } catch (error: any) {
    console.error('Error seeding dashboard:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
