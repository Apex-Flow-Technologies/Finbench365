import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getStorage } from 'firebase-admin/storage';
import { planTier, BASE_PLAN_TIER } from '@/constants/pricing';

/**
 * Hands a candidate the file for one study note.
 *
 * This is the only way to reach an uploaded file. Storage rules deny reads to
 * every client, so a candidate cannot fetch one directly even while signed in,
 * and there is no long-lived public URL to forward. The checks below run on the
 * server, and only then is a signed link minted that expires in minutes.
 *
 * Three things must all hold: the caller is who they say they are, their
 * access to the course has not run out, and their plan is high enough for this
 * particular note. The last one is what keeps the Excel workbook on the 60-day
 * plan — enforced here rather than by hiding a button.
 */

/** How long a signed link stays good. Long enough to click, short enough to be useless if shared. */
const LINK_TTL_MS = 5 * 60 * 1000;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');
    const materialId = searchParams.get('materialId');

    if (!courseId || !materialId) {
      return NextResponse.json({ error: 'Missing courseId or materialId' }, { status: 400 });
    }

    // ---- who is asking ----------------------------------------------------
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Sign in to download this.' }, { status: 401 });

    let uid: string;
    try {
      uid = (await adminAuth.verifyIdToken(token)).uid;
    } catch {
      return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 });
    }

    const userSnap = await adminDb.collection('users').doc(uid).get();
    const user = userSnap.data();
    if (!userSnap.exists || user?.suspended) {
      return NextResponse.json({ error: 'This account cannot download study notes.' }, { status: 403 });
    }

    // ---- do they still have access ----------------------------------------
    const isAdmin = user?.role === 'admin';
    const entitlement = user?.enrolledCourses?.[courseId];

    if (!isAdmin) {
      if (!entitlement) {
        return NextResponse.json({ error: 'You do not have access to this course.' }, { status: 403 });
      }
      const expiresAt = entitlement.expiresAt?.toDate?.()
        ?? (entitlement.expiresAt ? new Date(entitlement.expiresAt) : null);
      if (!expiresAt || expiresAt.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'Your access to this course has expired.' }, { status: 403 });
      }
    }

    // ---- is their plan high enough for THIS note --------------------------
    const materialSnap = await adminDb
      .collection('courses').doc(courseId)
      .collection('materials').doc(materialId).get();

    if (!materialSnap.exists) {
      return NextResponse.json({ error: 'That study note no longer exists.' }, { status: 404 });
    }
    const material = materialSnap.data()!;

    if (!isAdmin) {
      // A tier stored on the entitlement wins; falling back to the plan id
      // covers purchases made before tiers were recorded.
      const tier = entitlement.planTier ?? planTier(entitlement.planId) ?? BASE_PLAN_TIER;
      const required = material.minPlanTier ?? BASE_PLAN_TIER;
      if (tier < required) {
        return NextResponse.json({
          error: 'This study note is included with the 60-day plan.',
          reason: 'plan-tier',
        }, { status: 403 });
      }
    }

    // ---- legacy links -----------------------------------------------------
    // Notes added before uploading existed are still Google Drive links. Send
    // the candidate there; nothing here can protect a file we do not hold.
    if (!material.storagePath) {
      if (material.url) return NextResponse.json({ url: material.url, external: true });
      return NextResponse.json({ error: 'That study note has no file attached.' }, { status: 404 });
    }

    // ---- signed link ------------------------------------------------------
    const [url] = await getStorage()
      .bucket()
      .file(material.storagePath)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + LINK_TTL_MS,
        // Makes the browser save the file under its original name rather than
        // the storage path, and stops a PDF opening in a tab when the
        // candidate asked to download it.
        responseDisposition: `attachment; filename="${(material.fileName ?? 'study-note').replace(/"/g, '')}"`,
      });

    return NextResponse.json({ url, external: false, fileName: material.fileName ?? null });
  } catch (error: any) {
    console.error('Material download error:', error);
    return NextResponse.json({ error: 'Could not prepare the download.' }, { status: 500 });
  }
}
