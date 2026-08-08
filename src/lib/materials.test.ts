import { describe, it, expect } from 'vitest';
import { detectMaterialType } from './materials';

describe('detectMaterialType', () => {
  it('identifies a Google Sheets link as Excel, not PDF', () => {
    // The reported bug, verbatim: "Excel sheet for practise" was labelled
    // "PDF Study Note" with a "Download PDF" button.
    const t = detectMaterialType('https://docs.google.com/spreadsheets/d/abc123/edit', 'Excel sheet for practise');
    expect(t.kind).toBe('excel');
    expect(t.label).toBe('Excel workbook');
    expect(t.action).toBe('Open');
  });

  it('identifies a Google Slides link as a presentation', () => {
    expect(detectMaterialType('https://docs.google.com/presentation/d/xyz/edit').kind).toBe('slides');
  });

  it('identifies a Google Docs link as a document', () => {
    expect(detectMaterialType('https://docs.google.com/document/d/xyz/edit').kind).toBe('doc');
  });

  it('identifies files by extension', () => {
    expect(detectMaterialType('https://cdn.example.com/notes.pdf').kind).toBe('pdf');
    expect(detectMaterialType('https://cdn.example.com/tracker.xlsx').kind).toBe('excel');
    expect(detectMaterialType('https://cdn.example.com/deck.pptx').kind).toBe('slides');
    expect(detectMaterialType('https://cdn.example.com/syllabus.docx').kind).toBe('doc');
    expect(detectMaterialType('https://cdn.example.com/walkthrough.mp4').kind).toBe('video');
    expect(detectMaterialType('https://cdn.example.com/bundle.zip').kind).toBe('zip');
  });

  it('handles a query string after the extension', () => {
    expect(detectMaterialType('https://cdn.example.com/notes.pdf?token=abc&v=2').kind).toBe('pdf');
  });

  it('prefers the editor path over a misleading extension in the query', () => {
    const t = detectMaterialType('https://docs.google.com/spreadsheets/d/x/edit?name=report.pdf');
    expect(t.kind).toBe('excel');
  });

  it('falls back to the material name for an extensionless Drive link', () => {
    // A Drive file link gives nothing away, so guessing "PDF" would be a lie.
    expect(detectMaterialType('https://drive.google.com/file/d/abc/view', 'Excel workbook').kind).toBe('excel');
    expect(detectMaterialType('https://drive.google.com/file/d/abc/view', 'Chapter 3 PDF').kind).toBe('pdf');
  });

  it('says "link" rather than guessing when nothing is identifiable', () => {
    expect(detectMaterialType('https://drive.google.com/file/d/abc/view').kind).toBe('link');
    expect(detectMaterialType('https://example.com/resource').kind).toBe('link');
  });

  it('does not throw on missing or empty input', () => {
    expect(detectMaterialType(undefined).kind).toBe('link');
    expect(detectMaterialType(null).kind).toBe('link');
    expect(detectMaterialType('').kind).toBe('link');
    expect(detectMaterialType('   ', 'Practice spreadsheet').kind).toBe('excel');
  });

  it('is case-insensitive', () => {
    expect(detectMaterialType('https://CDN.EXAMPLE.COM/NOTES.PDF').kind).toBe('pdf');
    expect(detectMaterialType('https://DOCS.GOOGLE.COM/SPREADSHEETS/d/x').kind).toBe('excel');
  });
});
