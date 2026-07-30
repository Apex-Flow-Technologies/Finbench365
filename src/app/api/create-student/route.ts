import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function GET() {
  try {
    const studentEmail = 'student@myexams365.com';
    const studentPassword = 'student123';
    
    try {
      const existingUser = await adminAuth.getUserByEmail(studentEmail);
      if (existingUser) {
        await adminAuth.deleteUser(existingUser.uid);
        await adminDb.collection('users').doc(existingUser.uid).delete();
      }
    } catch (e) {}

    const studentRecord = await adminAuth.createUser({
      email: studentEmail,
      emailVerified: true,
      password: studentPassword,
      displayName: 'Test Student',
    });

    await adminDb.collection('users').doc(studentRecord.uid).set({
      email: studentEmail,
      displayName: 'Test Student',
      role: 'student',
      createdAt: new Date(),
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Student user created successfully.',
      student: {
        email: studentEmail,
        password: studentPassword
      }
    });

  } catch (error: any) {
    console.error('Error creating student:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
