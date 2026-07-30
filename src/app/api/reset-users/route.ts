import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function GET() {
  try {
    // 1. Get all users from Auth
    const listUsersResult = await adminAuth.listUsers(1000);
    const uids = listUsersResult.users.map((userRecord) => userRecord.uid);
    
    // 2. Delete all users from Auth
    if (uids.length > 0) {
      await adminAuth.deleteUsers(uids);
      console.log(`Successfully deleted ${uids.length} users from Firebase Auth.`);
    }

    // 3. Delete all user documents from Firestore
    const usersSnapshot = await adminDb.collection('users').get();
    const batch = adminDb.batch();
    let deletedCount = 0;
    
    usersSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    
    if (deletedCount > 0) {
      await batch.commit();
      console.log(`Successfully deleted ${deletedCount} user documents from Firestore.`);
    }

    // 4. Create new Admin user in Auth
    const adminEmail = 'admin@myexams365.com';
    const adminRecord = await adminAuth.createUser({
      email: adminEmail,
      emailVerified: true,
      password: 'admin123',
      displayName: 'Admin',
    });

    // 5. Create Admin document in Firestore
    await adminDb.collection('users').doc(adminRecord.uid).set({
      email: adminEmail,
      displayName: 'Admin',
      role: 'admin',
      createdAt: new Date(),
    });

    return NextResponse.json({ 
      success: true, 
      message: 'All users wiped successfully. Admin user created.',
      admin: {
        email: adminEmail,
        password: 'admin123'
      }
    });

  } catch (error: any) {
    console.error('Error resetting users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
