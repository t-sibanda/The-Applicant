// Converts SECURITY.md into a formatted Word (.docx) document.
// Usage: node scripts/md-to-docx.mjs <input.md> <output.docx>
import fs from "fs";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
} from "docx";

const [, , inPath = "SECURITY.md", outPath = "SECURITY.docx"] = process.argv;
const md = fs.readFileSync(inPath, "utf8").replace(/\r\n/g, "\n");
const lines = md.split("\n");

const children = [];

// Parse inline **bold** / `code` into TextRuns.
function runs(text) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun(text.slice(last, m.index)));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(new TextRun({ text: tok.slice(2, -2), bold: true }));
    else out.push(new TextRun({ text: tok.slice(1, -1), font: "Consolas", size: 20 }));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun(text.slice(last)));
  return out.length ? out : [new TextRun(text)];
}

const cell = (text, bold = false) =>
  new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text: text.replace(/\*\*/g, ""), bold })] })],
  });

let i = 0;
while (i < lines.length) {
  let line = lines[i];

  // Skip code fences (render contents as monospace paragraphs)
  if (line.trim().startsWith("```")) {
    i++;
    const buf = [];
    while (i < lines.length && !lines[i].trim().startsWith("```")) { buf.push(lines[i]); i++; }
    i++;
    for (const c of buf) {
      children.push(new Paragraph({ children: [new TextRun({ text: c || " ", font: "Consolas", size: 18 })] }));
    }
    continue;
  }

  // Tables
  if (line.startsWith("|") && i + 1 < lines.length && /^\|[-\s|:]+\|/.test(lines[i + 1])) {
    const header = line.split("|").slice(1, -1).map((s) => s.trim());
    i += 2;
    const rows = [new TableRow({ children: header.map((h) => cell(h, true)) })];
    while (i < lines.length && lines[i].startsWith("|")) {
      const cols = lines[i].split("|").slice(1, -1).map((s) => s.trim());
      rows.push(new TableRow({ children: cols.map((cc) => cell(cc)) }));
      i++;
    }
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
      },
    }));
    children.push(new Paragraph({ text: "" }));
    continue;
  }

  if (line.startsWith("# ")) {
    children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.TITLE }));
  } else if (line.startsWith("## ")) {
    children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 80 } }));
  } else if (line.startsWith("### ")) {
    children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_2 }));
  } else if (line.trim() === "---") {
    children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "DDDDDD" } }, children: [] }));
  } else if (/^\d+\.\s/.test(line.trim())) {
    children.push(new Paragraph({ numbering: undefined, bullet: { level: 0 }, children: runs(line.trim().replace(/^\d+\.\s/, "")) }));
  } else if (line.trim().startsWith("- ")) {
    children.push(new Paragraph({ bullet: { level: 0 }, children: runs(line.trim().slice(2)) }));
  } else if (line.trim() === "") {
    children.push(new Paragraph({ text: "" }));
  } else if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")) {
    children.push(new Paragraph({ children: [new TextRun({ text: line.replace(/\*/g, ""), italics: true, color: "666666" })] }));
  } else {
    children.push(new Paragraph({ children: runs(line) }));
  }
  i++;
}

const doc = new Document({
  creator: "The Applicant",
  title: "The Applicant — Security Report",
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22 } },
    },
  },
  sections: [{ properties: {}, children }],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buffer);
console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
