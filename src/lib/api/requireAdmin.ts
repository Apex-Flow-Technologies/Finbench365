import { adminAuth, adminDb } from '@/lib/firebase/admin';

export interface AdminCheckResult {
  ok: true;
  uid: string;
}

export interface AdminCheckFailure {
  ok: false;
  status: number;
  error: string;
}

/**
 * Verifies the request's bearer token and confirms the caller's Firestore
 * user doc has role === 'admin'. There are only two roles — student and
 * admin — so this is the single gate for every privileged server action.
 */
export async function requireAdmin(req: Request): Promise<AdminCheckResult | AdminCheckFailure> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const idToken = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const callerDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
    return { ok: false, status: 403, error: 'Forbidden — admin role required' };
  }

  return { ok: true, uid: decodedToken.uid };
}
