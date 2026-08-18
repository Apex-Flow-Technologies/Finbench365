import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getStorage } from 'firebase-admin/storage';
import { requireAdmin } from '@/lib/api/requireAdmin';

/**
 * Issues a short-lived signed URL the admin's browser can upload straight to.
 *
 * The first attempt let the browser write to storage directly and had the
 * storage rules decide, by looking the caller's role up in Firestore. That is a
 * cross-service dependency, and it refused every upload in practice — an admin
 * whose role was correct saw "Storage refused the upload" with no way forward.
 *
 * Signing here removes the guesswork. Whether someone may upload is decided by
 * the same requireAdmin() check every other admin route uses, against a
 * verified token, on the server. Storage can then deny every client outright:
 * no reads, no writes, no rule that has to be right for the feature to work.
 *
 * The bytes still go from the browser straight to Google, so a large PDF never
 * has to fit through a serverless request body.
 */

const UPLOAD_TTL_MS = 15 * 60 * 1000;
const MAX_BYTES = 50 * 1024 * 1024;

/** Keeps a filename recognisable while making it safe to put in a path. */
function safeName(name: string): string {
  const cleaned = (name || '')
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(-120);
  return cleaned || 'study-note';
}

export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await req.json().catch(() => ({}));
  const courseId = String(body?.courseId ?? '');
  const fileName = String(body?.fileName ?? '');
  const contentType = String(body?.contentType || 'application/octet-stream');
  const sizeBytes = Number(body?.sizeBytes);

  if (!courseId || !fileName) {
    return NextResponse.json({ error: 'Missing courseId or fileName.' }, { status: 400 });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
    return NextResponse.json({
      error: `Files must be under ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`,
    }, { status: 400 });
  }

  // Confirms the course is real before scattering objects under invented ids.
  const courseSnap = await adminDb.collection('courses').doc(courseId).get();
  if (!courseSnap.exists) {
    return NextResponse.json({ error: 'That course no longer exists.' }, { status: 404 });
  }

  // Timestamped so re-uploading a file of the same name creates a new object
  // rather than silently replacing one a saved note still points at.
  const storagePath = `course-materials/${courseId}/${Date.now()}-${safeName(fileName)}`;

  try {
    const [url] = await getStorage().bucket().file(storagePath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + UPLOAD_TTL_MS,
      // Must match the header the browser sends, or the signature is rejected.
      contentType,
    });
    return NextResponse.json({ url, storagePath, contentType });
  } catch (error: any) {
    console.error('Could not sign upload URL:', error);
    return NextResponse.json({ error: 'Could not prepare the upload.' }, { status: 500 });
  }
}

/** Removes an uploaded file. Used when a note is deleted or its file replaced. */
export async function DELETE(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { searchParams } = new URL(req.url);
  const storagePath = searchParams.get('storagePath') ?? '';

  // Confined to the study-note area so a crafted path cannot reach anything
  // else in the bucket.
  if (!storagePath.startsWith('course-materials/')) {
    return NextResponse.json({ error: 'Not a study-note file.' }, { status: 400 });
  }

  try {
    await getStorage().bucket().file(storagePath).delete({ ignoreNotFound: true });
    return NextResponse.json({ deleted: true });
  } catch (error: any) {
    // An orphaned object costs a little storage; a thrown error would stop the
    // admin removing the note at all. Report it and move on.
    console.warn('Could not delete stored file', storagePath, error?.message);
    return NextResponse.json({ deleted: false });
  }
}
