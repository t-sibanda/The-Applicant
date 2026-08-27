// Generates a client-facing pitch deck (.pptx) for The Applicant.
import pptxgen from "pptxgenjs";

const p = new pptxgen();
p.author = "The Applicant";
p.company = "The Applicant";
p.title = "The Applicant — Pitch Deck";
p.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in

// ── Palette ──
const INK = "0B0B12";
const INK2 = "17131F";
const GOLD = "F5B800";
const BRAND = "FF6B35";
const WHITE = "FFFFFF";
const MUTED = "B9B3C9";
const CARD = "1F1B2B";
const GREEN = "34D399";
const RED = "F87171";

const W = 13.33, H = 7.5;

// Helper: dark gradient-ish background (solid dark + gold accent bar).
function bg(slide, dark = true) {
  slide.background = { color: dark ? INK : "F6F7FB" };
}
function accentGlow(slide) {
  slide.addShape("ellipse", { x: 9.7, y: -1.2, w: 5, h: 5, fill: { color: GOLD, transparency: 82 }, line: { type: "none" } });
}
function kicker(slide, text) {
  slide.addText(text.toUpperCase(), { x: 0.7, y: 0.5, w: 8, h: 0.3, color: GOLD, fontSize: 12, bold: true, charSpacing: 3, fontFace: "Arial" });
}
function footer(slide, n) {
  slide.addText("The Applicant", { x: 0.7, y: 7.0, w: 4, h: 0.3, color: MUTED, fontSize: 9 });
  slide.addText(String(n), { x: 12.4, y: 7.0, w: 0.5, h: 0.3, color: MUTED, fontSize: 9, align: "right" });
}

// ── Slide 1: Title ──
{
  const s = p.addSlide(); bg(s); accentGlow(s);
  s.addText([
    { text: "The ", options: { color: WHITE } },
    { text: "Applicant", options: { color: GOLD } },
  ], { x: 0.7, y: 2.4, w: 11, h: 1.2, fontSize: 54, bold: true, fontFace: "Georgia" });
  s.addText("The AI job-hunt platform that applies in your voice — not spray-and-pray.", { x: 0.7, y: 3.7, w: 10.5, h: 0.8, color: MUTED, fontSize: 20 });
  s.addText("Find better jobs · Tailor every application · Build a standout profile", { x: 0.7, y: 4.5, w: 11, h: 0.5, color: GOLD, fontSize: 14, bold: true });
  s.addText("Client Pitch", { x: 0.7, y: 6.4, w: 6, h: 0.4, color: MUTED, fontSize: 12 });
}

// ── Slide 2: The problem ──
{
  const s = p.addSlide(); bg(s); kicker(s, "The problem");
  s.addText("Job seekers are drowning — and today's AI tools make it worse.", { x: 0.7, y: 1.0, w: 12, h: 1, color: WHITE, fontSize: 30, bold: true, fontFace: "Georgia" });
  const pains = [
    ["Generic output", "Every volume tool spits out cookie-cutter resumes. The applicant's personality is lost."],
    ["Off-target matches", "Bots surface irrelevant roles and apply to jobs outside the filters."],
    ["Ban risk", "Blind auto-apply violates job-site terms — getting users suspended."],
    ["Paywalled help", "The best features are locked behind $40/mo plans."],
  ];
  pains.forEach((pn, i) => {
    const x = 0.7 + (i % 2) * 6.1, y = 2.3 + Math.floor(i / 2) * 2.1;
    s.addShape("roundRect", { x, y, w: 5.7, h: 1.8, fill: { color: CARD }, line: { color: RED, width: 0.5 }, rectRadius: 0.1 });
    s.addText(pn[0], { x: x + 0.3, y: y + 0.2, w: 5.1, h: 0.5, color: RED, fontSize: 16, bold: true });
    s.addText(pn[1], { x: x + 0.3, y: y + 0.75, w: 5.1, h: 1, color: MUTED, fontSize: 13 });
  });
  footer(s, 2);
}

// ── Slide 3: The solution ──
{
  const s = p.addSlide(); bg(s); accentGlow(s); kicker(s, "Our approach");
  s.addText("Quality over volume. Personalized, human-in-the-loop, all in one place.", { x: 0.7, y: 1.0, w: 12, h: 1.2, color: WHITE, fontSize: 30, bold: true, fontFace: "Georgia" });
  s.addText("The Applicant is a complete, AI-powered career command center — it finds the right jobs, tailors every application in the user's own voice, and helps them apply with confidence, safely.", { x: 0.7, y: 2.4, w: 11.5, h: 1.2, color: MUTED, fontSize: 18 });
  const pillars = [["Personal", "Writes in your voice"], ["Precise", "Relevance-scored matches"], ["Complete", "Resume → apply → track → grow"], ["Safe", "ToS-compliant, no ban risk"]];
  pillars.forEach((pl, i) => {
    const x = 0.7 + i * 3.05;
    s.addShape("roundRect", { x, y: 4.0, w: 2.8, h: 2.3, fill: { color: CARD }, line: { color: GOLD, width: 0.75 }, rectRadius: 0.1 });
    s.addText(pl[0], { x, y: 4.4, w: 2.8, h: 0.5, color: GOLD, fontSize: 20, bold: true, align: "center" });
    s.addText(pl[1], { x: x + 0.2, y: 5.0, w: 2.4, h: 1, color: WHITE, fontSize: 14, align: "center" });
  });
  footer(s, 3);
}

// ── Slide 4: Key features ──
{
  const s = p.addSlide(); bg(s); kicker(s, "What's inside");
  s.addText("A full-stack toolkit — not a single trick.", { x: 0.7, y: 1.0, w: 12, h: 0.8, color: WHITE, fontSize: 30, bold: true, fontFace: "Georgia" });
  const feats = [
    ["AI Optimizer", "Tailor resumes, cover letters, ATS scoring, skill-gap analysis, career coach."],
    ["Voice Profiles", "The AI learns your tone so every document sounds authentically like you."],
    ["Smart Job Search", "Multiple compliant sources, relevance ranking, salary & recency filters."],
    ["Portfolio Builder", "Interactive, templated self-marketing page you can share with interviewers."],
    ["Career Builder", "Simulate your path, milestones, and the certifications that make you competitive."],
    ["Learning Center", "Turn saved articles & tips into a personalized action plan."],
    ["Assisted Apply", "AI drafts tailored materials; you review and submit — safe one-click autofill."],
    ["Application Tracker", "Full pipeline from draft to offer, with live dashboard metrics."],
  ];
  feats.forEach((f, i) => {
    const x = 0.7 + (i % 2) * 6.1, y = 1.9 + Math.floor(i / 2) * 1.25;
    s.addText([{ text: f[0] + "  ", options: { color: GOLD, bold: true } }, { text: f[1], options: { color: MUTED } }], { x, y, w: 5.9, h: 1.1, fontSize: 13, valign: "top" });
  });
  footer(s, 4);
}

// ── Slide 5: Competitive comparison ──
{
  const s = p.addSlide(); bg(s); kicker(s, "How we compare");
  s.addText("What the others miss — and we deliver.", { x: 0.7, y: 0.95, w: 12, h: 0.7, color: WHITE, fontSize: 28, bold: true, fontFace: "Georgia" });
  const rows = [
    ["Capability", "The Applicant", "Typical rivals"],
    ["Writes in your voice", "Yes — voice profiles", "Generic templates"],
    ["Relevance-scored matches", "Yes", "Often off-target"],
    ["ATS scoring", "Multi-factor, live", "Rare or paywalled"],
    ["Portfolio + Career builder", "Yes", "None"],
    ["Auto-apply safety", "Human-in-the-loop", "Ban-risk automation"],
    ["All features accessible", "Generous tiers", "Best locked at ~$40/mo"],
  ];
  const rowsData = rows.map((r, ri) => r.map((c) => ({
    text: c,
    options: {
      color: ri === 0 ? WHITE : (r === rows[ri] && c === "None" ? RED : undefined) || (ri === 0 ? WHITE : MUTED),
      bold: ri === 0,
      fill: { color: ri === 0 ? CARD : INK2 },
      valign: "middle",
    },
  })));
  // Color the "The Applicant" column green, rivals column muted/red.
  for (let ri = 1; ri < rowsData.length; ri++) {
    rowsData[ri][1].options.color = GREEN;
    rowsData[ri][1].options.bold = true;
    rowsData[ri][2].options.color = MUTED;
  }
  s.addTable(rowsData, {
    x: 0.7, y: 1.85, w: 11.9, colW: [4.3, 3.8, 3.8],
    border: { type: "solid", color: "2A2440", pt: 1 },
    fontSize: 14, rowH: 0.62, align: "left", valign: "middle",
  });
  footer(s, 5);
}

// ── Slide 6: Value / outcomes ──
{
  const s = p.addSlide(); bg(s); accentGlow(s); kicker(s, "The value");
  s.addText("Fewer applications. Better results. Less burnout.", { x: 0.7, y: 1.0, w: 12, h: 1, color: WHITE, fontSize: 30, bold: true, fontFace: "Georgia" });
  const stats = [
    ["Every doc, tailored", "Applications that actually match the job — and sound like you."],
    ["Higher signal", "Relevance + quality filters put strong, well-paid roles first."],
    ["Time back", "AI does the drafting; you keep control and credibility."],
  ];
  stats.forEach((st, i) => {
    const x = 0.7 + i * 4.05;
    s.addShape("roundRect", { x, y: 2.5, w: 3.8, h: 2.6, fill: { color: CARD }, line: { color: GOLD, width: 0.75 }, rectRadius: 0.1 });
    s.addText(st[0], { x: x + 0.25, y: 2.8, w: 3.3, h: 0.9, color: GOLD, fontSize: 18, bold: true });
    s.addText(st[1], { x: x + 0.25, y: 3.7, w: 3.3, h: 1.2, color: WHITE, fontSize: 13 });
  });
  s.addText("Built for candidates who want to stand out — not blend into the pile.", { x: 0.7, y: 5.5, w: 11, h: 0.6, color: MUTED, fontSize: 16, italic: true });
  footer(s, 6);
}

// ── Slide 7: Trust & security ──
{
  const s = p.addSlide(); bg(s); kicker(s, "Trust & security");
  s.addText("Enterprise-grade care with your data.", { x: 0.7, y: 1.0, w: 12, h: 0.8, color: WHITE, fontSize: 30, bold: true, fontFace: "Georgia" });
  const items = [
    "Passwords hashed (scrypt); sessions in secure HttpOnly cookies",
    "Strict per-user data isolation; role-based admin controls",
    "Secrets server-side only — never in the browser or code repo",
    "TLS in transit, encryption at rest; PCI handled by Stripe",
    "ToS-compliant job sourcing; no scraping, no headless auto-submit",
    "Self-service data export & account deletion",
  ];
  items.forEach((it, i) => {
    const y = 2.1 + i * 0.72;
    s.addText("✓", { x: 0.8, y, w: 0.4, h: 0.5, color: GREEN, fontSize: 18, bold: true });
    s.addText(it, { x: 1.25, y, w: 11, h: 0.5, color: WHITE, fontSize: 15 });
  });
  footer(s, 7);
}

// ── Slide 8: Pricing model ──
{
  const s = p.addSlide(); bg(s); kicker(s, "Plans");
  s.addText("Simple tiers. Real value at every level.", { x: 0.7, y: 1.0, w: 12, h: 0.8, color: WHITE, fontSize: 30, bold: true, fontFace: "Georgia" });
  const plans = [
    ["Free", "Get started", ["Job search", "Learning Center", "1 profile"], "2A2440"],
    ["Basic", "Serious search", ["Everything in Free", "AI Optimizer", "Assisted apply", "Portfolio & Career", "Up to 3 profiles"], BRAND],
    ["Pro", "Full power", ["Everything in Basic", "Auto-apply (guided)", "Up to 25 profiles", "Priority AI"], GOLD],
  ];
  plans.forEach((pl, i) => {
    const x = 0.9 + i * 4.0;
    s.addShape("roundRect", { x, y: 2.0, w: 3.7, h: 4.4, fill: { color: CARD }, line: { color: pl[3], width: 1.25 }, rectRadius: 0.1 });
    s.addText(pl[0], { x, y: 2.3, w: 3.7, h: 0.6, color: pl[3], fontSize: 24, bold: true, align: "center" });
    s.addText(pl[1], { x, y: 2.9, w: 3.7, h: 0.4, color: MUTED, fontSize: 13, align: "center" });
    s.addText(pl[2].map((t) => ({ text: t, options: { bullet: { code: "2022" }, color: WHITE, fontSize: 13 } })), { x: x + 0.35, y: 3.5, w: 3.1, h: 2.7 });
  });
  footer(s, 8);
}

// ── Slide 9: Close / CTA ──
{
  const s = p.addSlide(); bg(s); accentGlow(s);
  s.addText("Apply smarter. Stand out. Get hired.", { x: 0.7, y: 2.6, w: 11.5, h: 1.2, color: WHITE, fontSize: 40, bold: true, fontFace: "Georgia" });
  s.addText("The Applicant — the job-hunt platform that markets you, in your voice.", { x: 0.7, y: 3.9, w: 11, h: 0.6, color: GOLD, fontSize: 18, bold: true });
  s.addText("Let's get your candidates hired faster.", { x: 0.7, y: 4.7, w: 11, h: 0.5, color: MUTED, fontSize: 16 });
}

await p.writeFile({ fileName: "The-Applicant-Pitch-Deck.pptx" });
console.log("Wrote The-Applicant-Pitch-Deck.pptx");
