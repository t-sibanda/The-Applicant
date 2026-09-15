/**
 * Client-side document export with proper fonts and formatting.
 *
 * No heavy dependencies: we render the text into clean, styled HTML and either
 * hand it to Word (as a .doc that Word and Google Docs open natively) or to the
 * browser's print dialog for a real PDF. Plain text stays available too.
 *
 * Why not PPTX: resumes and cover letters are not slide decks, and no ATS or
 * recruiter accepts .pptx for an application. We export the formats that get
 * you hired: Word, PDF, and text.
 */

export type DocKind = "resume" | "cover" | "generic";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Turn plain resume/letter text into structured HTML.
 * - Lines in ALL CAPS (or Title Case headers) become section headings.
 * - Lines starting with -, *, or • become bullet list items.
 * - Blank lines separate paragraphs.
 */
function textToHtml(text: string, kind: DocKind): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) { out.push("</ul>"); inList = false; }
  };

  const isHeading = (line: string) => {
    const t = line.trim();
    if (t.length < 2 || t.length > 48) return false;
    // ALL CAPS headings (SUMMARY, EXPERIENCE) are the resume convention.
    const letters = t.replace(/[^A-Za-z]/g, "");
    return letters.length > 0 && letters === letters.toUpperCase();
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const t = line.trim();
    if (t === "") { closeList(); return; }

    const bullet = /^[-*•]\s+/.test(t);
    if (bullet) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${escapeHtml(t.replace(/^[-*•]\s+/, ""))}</li>`);
      return;
    }
    closeList();

    // The first non-empty line of a resume is usually the name: make it a title.
    if (i === 0 && kind === "resume") {
      out.push(`<h1 class="name">${escapeHtml(t)}</h1>`);
      return;
    }
    if (isHeading(t)) {
      out.push(`<h2>${escapeHtml(t)}</h2>`);
      return;
    }
    out.push(`<p>${escapeHtml(t)}</p>`);
  });
  closeList();
  return out.join("\n");
}

function docStyles(): string {
  return `
    @page { size: Letter; margin: 0.75in; }
    * { box-sizing: border-box; }
    body {
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 11pt; line-height: 1.4; color: #1a1a1a; margin: 0;
    }
    h1.name { font-size: 20pt; font-weight: 700; margin: 0 0 2pt; letter-spacing: 0.3px; }
    h2 {
      font-size: 11.5pt; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.6px; color: #0f2a43; margin: 14pt 0 4pt;
      border-bottom: 1px solid #c9d3dd; padding-bottom: 2pt;
    }
    p { margin: 3pt 0; }
    ul { margin: 3pt 0 3pt 0; padding-left: 18pt; }
    li { margin: 2pt 0; }
  `;
}

function fullHtml(text: string, kind: DocKind, title: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${docStyles()}</style></head>
<body>${textToHtml(text, kind)}</body></html>`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download as plain text. */
export function downloadTxt(text: string, filename: string) {
  triggerDownload(new Blob([text], { type: "text/plain;charset=utf-8" }), `${filename}.txt`);
}

/**
 * Download as a Word document. We use the Word-compatible HTML (.doc) container,
 * which Word, Google Docs, and Pages all open with real fonts and headings.
 * It is far more robust than hand-writing raw OOXML and needs no dependency.
 */
export function downloadDocx(text: string, kind: DocKind, filename: string) {
  const html = fullHtml(text, kind, filename);
  const withWordMeta = html.replace(
    "<head>",
    `<head><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->`,
  );
  triggerDownload(
    new Blob(["\ufeff", withWordMeta], { type: "application/msword" }),
    `${filename}.doc`,
  );
}

/**
 * Open a print window styled for the document so the user can save as PDF via
 * the native print dialog (real fonts, selectable text, correct page size).
 */
export function printPdf(text: string, kind: DocKind, title: string) {
  const html = fullHtml(text, kind, title);
  const w = window.open("", "_blank", "width=800,height=1000");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  // Give the window a tick to lay out fonts before invoking print.
  setTimeout(() => { w.focus(); w.print(); }, 300);
  return true;
}

/** Copy plain text to the clipboard. */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
