/**
 * Works out what a study-note actually is from its URL.
 *
 * Every note was labelled "PDF Study Note" and offered a "Download PDF" button
 * regardless of what it was — so an Excel practice workbook and a slide deck
 * both claimed to be PDFs. The label was hardcoded; nothing ever looked at the
 * file.
 *
 * Detection covers both real file URLs and the Google Docs editors, since
 * material is currently shared as Drive links (a Sheets link has no `.xlsx` in
 * it — it is identifiable only by the `/spreadsheets/` path).
 */

export type MaterialKind = 'pdf' | 'excel' | 'slides' | 'doc' | 'video' | 'image' | 'zip' | 'link';

export interface MaterialType {
  kind: MaterialKind;
  /** Shown under the material name, e.g. "Excel workbook". */
  label: string;
  /** Call to action, e.g. "Download" vs "Open". */
  action: string;
  /** Lucide icon name the UI maps to a component. */
  icon: 'FileText' | 'Sheet' | 'Presentation' | 'FileType' | 'Video' | 'Image' | 'Archive' | 'ExternalLink';
}

const TYPES: Record<MaterialKind, Omit<MaterialType, 'kind'>> = {
  pdf:    { label: 'PDF document',    action: 'Download', icon: 'FileText' },
  excel:  { label: 'Excel workbook',  action: 'Open',     icon: 'Sheet' },
  slides: { label: 'Presentation',    action: 'Open',     icon: 'Presentation' },
  doc:    { label: 'Word document',   action: 'Open',     icon: 'FileType' },
  video:  { label: 'Video',           action: 'Watch',    icon: 'Video' },
  image:  { label: 'Image',           action: 'View',     icon: 'Image' },
  zip:    { label: 'Archive',         action: 'Download', icon: 'Archive' },
  link:   { label: 'Web link',        action: 'Open',     icon: 'ExternalLink' },
};

const EXTENSIONS: [RegExp, MaterialKind][] = [
  [/\.pdf(\?|#|$)/i, 'pdf'],
  [/\.(xlsx?|xlsm|csv)(\?|#|$)/i, 'excel'],
  [/\.(pptx?|key)(\?|#|$)/i, 'slides'],
  [/\.(docx?|rtf|odt)(\?|#|$)/i, 'doc'],
  [/\.(mp4|mov|webm|avi|mkv)(\?|#|$)/i, 'video'],
  [/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i, 'image'],
  [/\.(zip|rar|7z|tar|gz)(\?|#|$)/i, 'zip'],
];

/**
 * Google Docs editors, matched on path.
 *
 * Checked BEFORE file extensions: a Drive URL can carry an unrelated extension
 * in a query parameter, and the editor path is the more reliable signal.
 */
const GOOGLE_PATHS: [RegExp, MaterialKind][] = [
  [/docs\.google\.com\/spreadsheets/i, 'excel'],
  [/docs\.google\.com\/presentation/i, 'slides'],
  [/docs\.google\.com\/document/i, 'doc'],
  [/docs\.google\.com\/forms/i, 'link'],
];

export function detectMaterialType(url: string | undefined | null, name?: string): MaterialType {
  const u = (url ?? '').trim();

  if (u) {
    for (const [re, kind] of GOOGLE_PATHS) {
      if (re.test(u)) return { kind, ...TYPES[kind] };
    }
    for (const [re, kind] of EXTENSIONS) {
      if (re.test(u)) return { kind, ...TYPES[kind] };
    }
    // A Drive *file* link carries no extension and no editor path. Fall through
    // to the name rather than claiming it is a PDF.
    if (/drive\.google\.com/i.test(u)) {
      const fromName = kindFromName(name);
      if (fromName) return { kind: fromName, ...TYPES[fromName] };
      return { kind: 'link', ...TYPES.link };
    }
  }

  const fromName = kindFromName(name);
  if (fromName) return { kind: fromName, ...TYPES[fromName] };

  return { kind: 'link', ...TYPES.link };
}

/** Last resort: the author often says what it is — "Excel sheet for practise". */
function kindFromName(name?: string): MaterialKind | null {
  const n = (name ?? '').toLowerCase();
  if (!n) return null;
  if (/\bexcel\b|\bspreadsheet\b|\bworkbook\b|\bxls\b|\bsheet\b/.test(n)) return 'excel';
  if (/\bppt\b|\bslide|\bpresentation\b|\bdeck\b/.test(n)) return 'slides';
  if (/\bpdf\b/.test(n)) return 'pdf';
  if (/\bword\b|\bdocx?\b/.test(n)) return 'doc';
  if (/\bvideo\b|\brecording\b/.test(n)) return 'video';
  return null;
}
