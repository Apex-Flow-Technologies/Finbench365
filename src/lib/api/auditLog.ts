import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Records what an admin actually did.
 *
 * Admins can now move access and money — grant courses, revoke them, suspend
 * accounts, create and disable discount codes. Those actions need to be
 * attributable after the fact, especially where a dispute or a refund is
 * involved.
 *
 * This replaces the fake audit modal that used to sit unreachable in the old
 * editor settings page, whose entries were hardcoded fiction.
 *
 * Writes are best-effort: an audit failure must never roll back or block the
 * action it describes, but it is logged loudly so a silent gap is noticeable.
 */

export type AuditAction =
  | 'grant-access'
  | 'extend-access'
  | 'revoke-access'
  | 'suspend-user'
  | 'activate-user'
  | 'set-role'
  | 'create-coupon'
  | 'update-coupon'
  | 'run-backfill'
  | 'reconcile-orders';

export interface AuditEntry {
  action: AuditAction;
  /** uid of the admin performing the action. */
  actorUid: string;
  actorEmail?: string;
  /** uid of the affected user, where the action targets one. */
  targetUserId?: string;
  /** Free-form detail — course, plan, coupon code, counts, reason. */
  details?: Record<string, any>;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await adminDb.collection('admin_audit').add({
      ...entry,
      details: entry.details ?? {},
      at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('AUDIT WRITE FAILED (action still performed):', entry.action, err);
  }
}
