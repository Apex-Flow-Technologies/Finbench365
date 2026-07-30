import { adminDb } from '../src/lib/firebase/admin';

async function updateNames() {
  const usersSnapshot = await adminDb.collection('users').get();
  let updated = 0;

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    if (data.email === 'admin@myexams365.com') {
      await doc.ref.update({ name: 'Super Admin' });
      updated++;
    } else if (data.email === 'student@myexams365.com') {
      await doc.ref.update({ name: 'Test Student' });
      updated++;
    }
  }

  console.log(`Updated ${updated} users with missing names.`);
  process.exit(0);
}

updateNames().catch(console.error);
