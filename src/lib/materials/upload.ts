import { auth } from '@/lib/firebase/config';

/**
 * Uploads a study-note file from the admin's browser.
 *
 * The server decides whether this is allowed and hands back a signed URL; the
 * browser then sends the bytes straight to Google. Two reasons for the detour:
 * a serverless request body is capped at a few megabytes and study notes are
 * exactly the PDFs and spreadsheets that exceed it, and permission is settled
 * by the same admin check every other admin route uses rather than by a storage
 * rule that has to reach into another service to answer.
 *
 * Nothing here makes the file readable. Storage denies every client; candidates
 * receive a separate short-lived link from /api/materials/download.
 */

/** Mirrors the server's ceiling, so the browser can refuse before uploading. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export interface UploadedFile {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function authHeader(): Promise<string> {
  if (!auth.currentUser) throw new Error('Please sign in again.');
  return `Bearer ${await auth.currentUser.getIdToken()}`;
}

export async function uploadMaterialFile(
  courseId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
  }

  const contentType = file.type || 'application/octet-stream';

  const res = await fetch('/api/materials/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
    body: JSON.stringify({ courseId, fileName: file.name, contentType, sizeBytes: file.size }),
  });
  const signed = await res.json();
  if (!res.ok) throw new Error(signed.error || 'Could not prepare the upload.');

  // XHR rather than fetch: fetch still cannot report upload progress, and a
  // large file with no progress bar looks indistinguishable from a hang.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signed.url, true);
    // Must match exactly what the URL was signed for.
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload rejected by storage (${xhr.status}). Please try again.`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(file);
  });

  return {
    storagePath: signed.storagePath,
    fileName: file.name,
    contentType,
    sizeBytes: file.size,
  };
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
    await fetch(`/api/materials/upload-url?storagePath=${encodeURIComponent(storagePath)}`, {
      method: 'DELETE',
      headers: { Authorization: await authHeader() },
    });
  } catch (err) {
    console.warn('Could not delete stored file', storagePath, err);
  }
}
