import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireEntitlement } from '@/lib/api/requireEntitlement';
import { finaliseAttempt, lastSeenAt, DISCONNECT_GRACE_MS } from '@/lib/exams/finalise';

/**
 * Decides whether an in-progress attempt has been abandoned, and closes it.
 *
 * The 15-minute disconnect rule used to be a screen and nothing more. The
 * runner read a timestamp out of localStorage, showed "this attempt has been
 * finalized and recorded as 1 attempt", and wrote nothing anywhere — the
 * attempt stayed in_progress, no score existed, and it counted towards nothing.
 * The message was simply untrue. It was also bypassed by clearing browser
 * storage, and did not exist at all on a second device.
 *
 * The decision now happens here, against `lastHeartbeatAt`, which the runner
 * writes to Firestore every ten seconds. A candidate who reopens an exam they
 * walked away from finds it genuinely closed and marked on whatever they had
 * answered — which is what "finalized" was always claiming.
 */
export async function POST(req: Request) {
  try {
    const { attemptId } = await req.json().catch(() => ({}));
    if (!attemptId) {
      return NextResponse.json({ error: 'Missing attemptId' }, { status: 400 });
    }

    const attemptRef = adminDb.collection('test_attempts').doc(attemptId);
    const attemptSnap = await attemptRef.get();
    if (!attemptSnap.exists) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }
    const attempt = attemptSnap.data()!;

    // Entitlement is checked against the attempt's own test, so a caller cannot
    // pass someone else's attempt id and learn anything about it.
    const check = await requireEntitlement(req, attempt.testId);
    if (!check.ok) {
      return NextResponse.json({ error: check.error, reason: check.reason }, { status: check.status });
    }
    if (attempt.userId !== check.uid) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    if (attempt.status === 'completed') {
      return NextResponse.json({
        expired: Boolean(attempt.expiredDueToDisconnect),
        alreadyCompleted: true,
      });
    }

    const seen = lastSeenAt(attempt);
    const awayMs = seen ? Date.now() - seen.getTime() : 0;

    if (!seen || awayMs <= DISCONNECT_GRACE_MS) {
      return NextResponse.json({
        expired: false,
        awayMs,
        graceMs: DISCONNECT_GRACE_MS,
      });
    }

    // Gone too long. Mark what they had actually answered — those were saved as
    // they worked, so this is their real paper, not a blank one.
    const startedAt = (attempt.startedAt ?? attempt.startTime)?.toDate?.() ?? null;
    const result = await finaliseAttempt({
      attemptId,
      testId: attempt.testId,
      testData: check.testData,
      answers: attempt.answers ?? {},
      startedAt,
      reason: 'disconnected',
    });

    console.log(
      `Attempt ${attemptId} closed after disconnection: user=${check.uid} away=${Math.round(awayMs / 60000)}min`,
    );

    return NextResponse.json({
      expired: true,
      awayMinutes: Math.round(awayMs / 60000),
      ...result,
    });
  } catch (error: any) {
    console.error('attempt-status error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
