import { ref, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';

/**
 * Uploads a study-note file straight from the admin's browser to storage.
 *
 * Deliberately not routed through an API endpoint. A serverless request body is
 * capped at a few megabytes, and study notes are PDFs and spreadsheets that
 * routinely exceed that — pushing them through the server would fail on exactly
 * the files this feature exists for. Storage rules allow the write for admins
 * only and cap the size, so going direct is not going unchecked.
 *
 * Nothing here makes the file readable. Storage denies reads to every client;
 * candidates receive a short-lived signed link from /api/materials/download.
 */

/** Mirrors the ceiling in storage.rules, so the browser can refuse first. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export interface UploadedFile {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Strips anything from a filename that would be awkward in a storage path,
 * while keeping it recognisable to the admin who uploaded it.
 */
function safeName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(-120);
  return cleaned || 'study-note';
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function uploadMaterialFile(
  courseId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return Promise.reject(new Error(
      `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
    ));
  }

  // Prefixed with a timestamp so re-uploading a file of the same name creates a
  // new object rather than silently replacing the old one, which would swap the
  // file under any note still pointing at it.
  const storagePath = `course-materials/${courseId}/${Date.now()}-${safeName(file.name)}`;
  const task = uploadBytesResumable(ref(storage, storagePath), file, {
    contentType: file.type || 'application/octet-stream',
    // Kept on the object itself so the original name survives even if the
    // Firestore record is later lost or rewritten.
    customMetadata: { originalName: file.name, courseId },
  });

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err: any) => {
        reject(new Error(
          err?.code === 'storage/unauthorized'
            ? 'Storage refused the upload. Deploy the storage rules and check you are signed in as an admin.'
            : err?.message || 'Upload failed.',
        ));
      },
      () => resolve({
        storagePath,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      }),
    );
  });
}

/**
 * Removes an uploaded file.
 *
 * Failure is swallowed on purpose: this runs when a note is deleted, and an
 * orphaned file costs a little storage whereas a thrown error would block the
 * admin from removing the note at all.
 */
export async function deleteMaterialFile(storagePath: string): Promise<void> {
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (err) {
    console.warn('Could not delete stored file', storagePath, err);
  }
}
