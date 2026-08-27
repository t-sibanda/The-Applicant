// Generates four audience-tailored pitch decks (.pptx) for The Applicant.
// No fabricated metrics — positioning and capability only.
import pptxgen from "pptxgenjs";

const INK = "0B0B12", GOLD = "F5B800", BRAND = "FF6B35", WHITE = "FFFFFF",
  MUTED = "B9B3C9", CARD = "1F1B2B", GREEN = "34D399", RED = "F87171";

function baseSlideHelpers(p) {
  const bg = (s) => (s.background = { color: INK });
  const glow = (s) => s.addShape("ellipse", { x: 9.7, y: -1.2, w: 5, h: 5, fill: { color: GOLD, transparency: 82 }, line: { type: "none" } });
  const kicker = (s, t) => s.addText(t.toUpperCase(), { x: 0.7, y: 0.5, w: 10, h: 0.3, color: GOLD, fontSize: 12, bold: true, charSpacing: 3 });
  const foot = (s, n) => { s.addText("The Applicant", { x: 0.7, y: 7.0, w: 4, h: 0.3, color: MUTED, fontSize: 9 }); s.addText(String(n), { x: 12.4, y: 7.0, w: 0.5, h: 0.3, color: MUTED, fontSize: 9, align: "right" }); };
  const title = (s, t) => s.addText(t, { x: 0.7, y: 1.0, w: 12, h: 1.1, color: WHITE, fontSize: 30, bold: true, fontFace: "Georgia" });
  return { bg, glow, kicker, foot, title };
}

function cover(p, h, subtitle, tag) {
  const { bg, glow } = baseSlideHelpers(p);
  const s = p.addSlide(); bg(s); glow(s);
  s.addText([{ text: "The ", options: { color: WHITE } }, { text: "Applicant", options: { color: GOLD } }], { x: 0.7, y: 2.2, w: 11, h: 1.2, fontSize: 54, bold: true, fontFace: "Georgia" });
  s.addText(h, { x: 0.7, y: 3.5, w: 11, h: 1, color: WHITE, fontSize: 24, bold: true });
  s.addText(subtitle, { x: 0.7, y: 4.5, w: 11, h: 0.8, color: MUTED, fontSize: 18 });
  s.addText(tag, { x: 0.7, y: 6.4, w: 8, h: 0.4, color: GOLD, fontSize: 13, bold: true });
}

function bullets(p, kickerText, titleText, items, n, opts = {}) {
  const { bg, glow, kicker, foot, title } = baseSlideHelpers(p);
  const s = p.addSlide(); bg(s); if (opts.glow) glow(s); kicker(s, kickerText); title(s, titleText);
  items.forEach((it, i) => {
    const y = 2.3 + i * 0.72;
    s.addText("▸", { x: 0.8, y, w: 0.4, h: 0.5, color: GOLD, fontSize: 16, bold: true });
    if (Array.isArray(it)) {
      s.addText([{ text: it[0] + " — ", options: { color: WHITE, bold: true } }, { text: it[1], options: { color: MUTED } }], { x: 1.25, y, w: 11, h: 0.6, fontSize: 15 });
    } else {
      s.addText(it, { x: 1.25, y, w: 11, h: 0.6, color: WHITE, fontSize: 15 });
    }
  });
  foot(s, n);
  return s;
}

function cardsSlide(p, kickerText, titleText, cards, n) {
  const { bg, glow, kicker, foot, title } = baseSlideHelpers(p);
  const s = p.addSlide(); bg(s); glow(s); kicker(s, kickerText); title(s, titleText);
  const perRow = cards.length <= 3 ? cards.length : 2;
  const cw = perRow === 3 ? 3.8 : 5.7, gap = 0.35;
  cards.forEach((c, i) => {
    const col = i % perRow, row = Math.floor(i / perRow);
    const x = 0.7 + col * (cw + gap), y = 2.3 + row * 2.0;
    s.addShape("roundRect", { x, y, w: cw, h: 1.75, fill: { color: CARD }, line: { color: GOLD, width: 0.75 }, rectRadius: 0.08 });
    s.addText(c[0], { x: x + 0.25, y: y + 0.2, w: cw - 0.5, h: 0.5, color: GOLD, fontSize: 16, bold: true });
    s.addText(c[1], { x: x + 0.25, y: y + 0.72, w: cw - 0.5, h: 0.9, color: WHITE, fontSize: 13 });
  });
  foot(s, n);
}

function comparisonSlide(p, n) {
  const { bg, kicker, foot, title } = baseSlideHelpers(p);
  const s = p.addSlide(); bg(s); kicker(s, "How we compare"); title(s, "What the others miss — and we deliver.");
  const rows = [
    ["Capability", "The Applicant", "Typical rivals"],
    ["Writes in your voice", "Voice Studio", "Generic templates"],
    ["Relevance-scored matches", "Yes", "Often off-target"],
    ["ATS scoring", "Multi-factor, live", "Rare / paywalled"],
    ["Portfolio + Career builder", "Yes", "None"],
    ["Auto-apply safety", "Human-in-the-loop", "Ban-risk automation"],
    ["All features accessible", "Generous tiers", "Best locked ~$40/mo"],
  ];
  const data = rows.map((r, ri) => r.map((c, ci) => ({
    text: c,
    options: {
      bold: ri === 0 || ci === 1,
      color: ri === 0 ? WHITE : ci === 1 ? GREEN : MUTED,
      fill: { color: ri === 0 ? CARD : "141020" }, valign: "middle",
    },
  })));
  s.addTable(data, { x: 0.7, y: 2.2, w: 11.9, colW: [4.3, 3.8, 3.8], border: { type: "solid", color: "2A2440", pt: 1 }, fontSize: 14, rowH: 0.58, valign: "middle" });
  foot(s, n);
}

function voiceSpotlight(p, n) {
  const { bg, glow, kicker, foot, title } = baseSlideHelpers(p);
  const s = p.addSlide(); bg(s); glow(s); kicker(s, "Flagship differentiator");
  title(s, "Voice Studio — the AI writes exactly like you.");
  s.addText("Most AI tools produce generic, cookie-cutter output. The Applicant learns each person's authentic voice — and lets them see, tune, and refine it.", { x: 0.7, y: 2.1, w: 11.5, h: 1, color: MUTED, fontSize: 16 });
  const steps = [
    ["1 · Analyze", "Paste a writing sample; AI extracts tone, verbs, and style."],
    ["2 · Summary", "A plain-English 'how your voice sounds' description."],
    ["3 · Tune", "Pick/blend tone tags, verbs, and formality/warmth/brevity sliders."],
    ["4 · Refine", "A feedback bot fixes anything the AI missed — in plain language."],
  ];
  steps.forEach((st, i) => {
    const x = 0.7 + i * 3.05;
    s.addShape("roundRect", { x, y: 3.4, w: 2.8, h: 2.4, fill: { color: CARD }, line: { color: GOLD, width: 0.75 }, rectRadius: 0.08 });
    s.addText(st[0], { x: x + 0.2, y: 3.6, w: 2.4, h: 0.5, color: GOLD, fontSize: 15, bold: true });
    s.addText(st[1], { x: x + 0.2, y: 4.15, w: 2.4, h: 1.4, color: WHITE, fontSize: 12 });
  });
  s.addText("Every resume, cover letter, and portfolio is then generated in that voice — authentic, never generic.", { x: 0.7, y: 6.0, w: 11.5, h: 0.5, color: GOLD, fontSize: 14, italic: true });
  foot(s, n);
}

function safeApplySlide(p, n) {
  const { bg, kicker, foot, title } = baseSlideHelpers(p);
  const s = p.addSlide(); bg(s); kicker(s, "Apply — the safe way");
  title(s, "One-click convenience without the ban risk.");
  const cards = [
    ["Assisted apply", "AI drafts a tailored resume + cover letter per job; you review, edit, approve."],
    ["Auto-apply (guided)", "Bulk-prepare review-ready drafts for your top matches, within a daily cap."],
    ["Autofill extension", "Fills application forms on click using your profile — you submit. Never headless."],
  ];
  cards.forEach((c, i) => {
    const x = 0.7 + i * 4.05;
    s.addShape("roundRect", { x, y: 2.4, w: 3.8, h: 2.6, fill: { color: CARD }, line: { color: GREEN, width: 0.75 }, rectRadius: 0.08 });
    s.addText(c[0], { x: x + 0.25, y: 2.7, w: 3.3, h: 0.6, color: GREEN, fontSize: 16, bold: true });
    s.addText(c[1], { x: x + 0.25, y: 3.4, w: 3.3, h: 1.5, color: WHITE, fontSize: 13 });
  });
  s.addText("Competitors' blind auto-apply violates job-site terms and gets users banned. Ours keeps a human in the loop — compliant, and higher quality.", { x: 0.7, y: 5.4, w: 11.5, h: 0.8, color: MUTED, fontSize: 15, italic: true });
  foot(s, n);
}

// Pricing — keep in sync with the app's Landing page PRICING.
const PRICES = { free: "$0", basic: "$12/mo", pro: "$29/mo", org: "Custom" };

function pricingSlide(p, n, includeOrg = false) {
  const { bg, kicker, foot, title } = baseSlideHelpers(p);
  const s = p.addSlide(); bg(s); kicker(s, "Pricing"); title(s, "Simple, honest pricing.");
  const plans = [
    ["Free", PRICES.free, ["Job search", "Learning Center", "1 profile"], "2A2440"],
    ["Basic", PRICES.basic, ["AI Optimizer + Voice Studio", "Assisted apply", "Portfolio & Career", "3 profiles"], BRAND],
    ["Pro", PRICES.pro, ["Everything in Basic", "Auto-apply (guided)", "25 profiles", "Priority AI"], GOLD],
  ];
  plans.forEach((pl, i) => {
    const x = 0.9 + i * 4.0;
    s.addShape("roundRect", { x, y: 2.2, w: 3.7, h: 3.8, fill: { color: CARD }, line: { color: pl[3], width: 1.25 }, rectRadius: 0.08 });
    s.addText(pl[0], { x, y: 2.5, w: 3.7, h: 0.5, color: pl[3], fontSize: 22, bold: true, align: "center" });
    s.addText(pl[1], { x, y: 3.05, w: 3.7, h: 0.5, color: WHITE, fontSize: 20, bold: true, align: "center" });
    s.addText(pl[2].map((t) => ({ text: t, options: { bullet: { code: "2022" }, color: MUTED, fontSize: 13 } })), { x: x + 0.35, y: 3.7, w: 3.1, h: 2.1 });
  });
  if (includeOrg) {
    s.addText([{ text: "Organizations: ", options: { color: GOLD, bold: true } }, { text: `${PRICES.org} — seats & admin controls for teams/cohorts (contact sales)`, options: { color: MUTED } }], { x: 0.9, y: 6.2, w: 11.5, h: 0.5, fontSize: 14 });
  }
  foot(s, n);
}

function closeSlide(p, line, sub) {
  const { bg, glow } = baseSlideHelpers(p);
  const s = p.addSlide(); bg(s); glow(s);
  s.addText(line, { x: 0.7, y: 2.7, w: 11.5, h: 1.4, color: WHITE, fontSize: 38, bold: true, fontFace: "Georgia" });
  s.addText(sub, { x: 0.7, y: 4.2, w: 11, h: 0.6, color: GOLD, fontSize: 18, bold: true });
  s.addText("The Applicant — applies in your voice, not spray-and-pray.", { x: 0.7, y: 5.0, w: 11, h: 0.5, color: MUTED, fontSize: 15 });
}

function newDeck() {
  const p = new pptxgen();
  p.author = "The Applicant"; p.company = "The Applicant"; p.layout = "LAYOUT_WIDE";
  return p;
}

const FEATURES = [
  ["Voice Studio", "AI learns, summarizes, and tunes your writing voice."],
  ["AI Optimizer", "Tailor resumes, cover letters, ATS scoring, skill-gap."],
  ["Smart Job Search", "Compliant sources, relevance ranking, salary/recency filters."],
  ["Assisted & auto-apply", "Human-in-the-loop drafting + autofill extension."],
  ["Portfolio Builder", "Interactive, shareable self-marketing page."],
  ["Career Builder", "Path simulation + certification roadmap."],
];

// ── Deck 1: Individual job seekers ──
{
  const p = newDeck();
  cover(p, "Land your next role — with applications that sound like you.", "Find better jobs, tailor every application, and stand out.", "For job seekers");
  bullets(p, "The problem", "Job hunting is exhausting — and generic AI makes it worse.", [
    ["Endless listings", "Scrolling job boards for hours, most irrelevant."],
    ["Generic AI output", "Cookie-cutter resumes that lose your personality."],
    ["ATS black holes", "Great candidates filtered out by keyword bots."],
    ["Ban risk", "Auto-apply tools that get you suspended from job sites."],
  ], 2);
  voiceSpotlight(p, 3);
  cardsSlide(p, "Your toolkit", "Everything you need, in one place.", FEATURES, 4);
  safeApplySlide(p, 5);
  comparisonSlide(p, 6);
  pricingSlide(p, 7);
  closeSlide(p, "Apply smarter. Stand out. Get hired.", "Your voice. Your edge.");
  p.writeFile({ fileName: "Pitch-1-Job-Seekers.pptx" });
}

// ── Deck 2: Organizations (career centers, universities, staffing) ──
{
  const p = newDeck();
  cover(p, "Help every client land roles — at scale, with real personalization.", "For career centers, universities, and staffing firms.", "For organizations");
  bullets(p, "Your challenge", "Serving many job seekers, individually, is hard.", [
    ["Limited advisor time", "Can't hand-craft materials for every client."],
    ["Generic tools don't help", "Volume AI produces the same output for everyone."],
    ["No oversight", "Hard to manage access, track usage, or support at scale."],
    ["Outcomes matter", "You're measured on placements, not activity."],
  ], 2);
  voiceSpotlight(p, 3);
  cardsSlide(p, "Admin & control", "Built for managing many users.", [
    ["Admin console", "Manage every account from one place."],
    ["Access control", "Grant or revoke features per user, with time limits."],
    ["Tiered plans", "Free/Basic/Pro, plus per-user overrides."],
    ["Support workflow", "In-app help requests routed to admins."],
    ["Data & privacy", "Per-user isolation; export & deletion built in."],
    ["Everyone personalized", "Voice Studio makes each client's output unique."],
  ], 4);
  comparisonSlide(p, 5);
  pricingSlide(p, 6, true);
  closeSlide(p, "Better outcomes for every client you serve.", "Personalization at scale, with full oversight.");
  p.writeFile({ fileName: "Pitch-2-Organizations.pptx" });
}

// ── Deck 3: Enterprise / employers (talent mobility, outplacement) ──
{
  const p = newDeck();
  cover(p, "Support your people's careers — internally and in transition.", "For employers: talent mobility, upskilling, and outplacement.", "For employers");
  bullets(p, "The context", "Careers are a workforce priority.", [
    ["Internal mobility", "Help employees find and win internal roles."],
    ["Outplacement", "Support departing staff with dignity and real tools."],
    ["Upskilling", "Career Builder maps certifications and growth paths."],
    ["Brand & retention", "Investing in careers strengthens your employer brand."],
  ], 2);
  voiceSpotlight(p, 3);
  cardsSlide(p, "What you get", "A complete, secure platform.", [
    ["Voice-personalized", "Authentic materials, not generic AI."],
    ["Career Builder", "Simulated paths + certification roadmaps."],
    ["Admin controls", "Provision, manage, and revoke access centrally."],
    ["Security", "Secrets server-side, encryption, per-user isolation."],
    ["Compliant sourcing", "Official/public job APIs; no scraping."],
    ["Human-in-the-loop", "No ban-risk automation."],
  ], 4);
  bullets(p, "Trust & security", "Enterprise-grade care with data.", [
    "Passwords hashed; sessions in secure HttpOnly cookies",
    "Strict per-user data isolation; role-based admin controls",
    "Secrets server-side only — never in the browser or repo",
    "TLS in transit, encryption at rest; PCI handled by Stripe",
    "ToS-compliant job sourcing; no headless auto-submit",
    "Self-service data export & account deletion",
  ], 5);
  closeSlide(p, "Invest in your people's next chapter.", "Careers, supported securely and at scale.");
  p.writeFile({ fileName: "Pitch-3-Employers.pptx" });
}

// ── Deck 4: Investors ──
{
  const p = newDeck();
  cover(p, "The job-hunt platform built on authentic personalization.", "A quality-first alternative in a crowded, commoditized market.", "For investors");
  bullets(p, "Market", "A large, recurring, pain-heavy market.", [
    ["Everyone job-hunts", "Job search is universal, repeated, and stressful."],
    ["AI-tool wave", "A crowded field of auto-apply tools — all similar."],
    ["Shared weakness", "They produce generic output and risk platform bans."],
    ["Opening", "No one owns 'authentic, personalized, safe, all-in-one'."],
  ], 2);
  bullets(p, "The wedge", "Our differentiation is defensible.", [
    ["Voice Studio", "Personalization competitors structurally lack."],
    ["Quality over volume", "Human-in-the-loop; compliant; higher intent."],
    ["All-in-one", "Search → tailor → apply → track → portfolio → career."],
    ["Data flywheel", "User feedback refines voice & relevance over time."],
  ], 3);
  voiceSpotlight(p, 4);
  cardsSlide(p, "Business model", "Recurring revenue, expandable.", [
    ["B2C subscriptions", "Free / Basic / Pro tiers via Stripe."],
    ["B2B / seats", "Career centers, universities, employers, staffing."],
    ["Entitlement engine", "Per-user access control enables flexible packaging."],
    ["Low infra cost", "Single-origin app; provider-agnostic AI/storage."],
    ["Expansion paths", "Extension, more sources, coaching marketplace."],
    ["Moat", "Voice data + all-in-one workflow lock-in."],
  ], 5);
  comparisonSlide(p, 6);
  bullets(p, "Status & ask", "Where we are.", [
    "Full product built and deployed (web app + browser extension)",
    "Compliant multi-source job data; Stripe billing; admin controls",
    "Security-audited: no secret exposure across repo/client/API",
    "Next: go-to-market, early users, and outcome data",
    "Seeking: partners/capital to scale acquisition and B2B sales",
  ], 7);
  closeSlide(p, "Personalization is the moat. Quality is the wedge.", "Let's build the category leader in authentic job search.");
  p.writeFile({ fileName: "Pitch-4-Investors.pptx" });
}

console.log("Decks written: Job-Seekers, Organizations, Employers, Investors");
