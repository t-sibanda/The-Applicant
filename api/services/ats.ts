/**
 * High-accuracy, transparent ATS scoring.
 *
 * Combines deterministic signals (keyword coverage, hard-requirement gaps,
 * title/seniority alignment, format/parseability) with an AI semantic pass.
 * This reflects how real ATS systems behave — keyword matching, requirement
 * gating, parseability — with a transparent, weighted breakdown. It is NOT a
 * replica of any specific proprietary vendor engine.
 */

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "our", "are", "will", "have",
  "this", "that", "from", "job", "role", "work", "team", "must", "should",
  "who", "what", "when", "where", "how", "all", "any", "can", "may", "not",
  "a", "an", "to", "of", "in", "on", "at", "as", "is", "be", "or", "we",
  "years", "year", "experience", "ability", "including", "etc", "plus",
]);

function tokens(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Extract candidate keywords from a job description by frequency. */
export function extractKeywords(jd: string, max = 30): string[] {
  const freq = new Map<string, number>();
  for (const t of tokens(jd)) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

export interface HardRequirements {
  yearsRequired: number | null;
  degreeRequired: string | null;
  certsRequired: string[];
}

/** Detect hard requirements from the JD via patterns. */
export function detectHardRequirements(jd: string): HardRequirements {
  const text = jd.toLowerCase();
  const yearsMatch = text.match(/(\d+)\+?\s*(?:years|yrs)/);
  const degreeMatch = text.match(
    /\b(ph\.?d|master'?s|bachelor'?s|b\.?s\.?|m\.?s\.?|mba|associate'?s|degree)\b/,
  );
  const certKeywords = [
    "pmp", "cpa", "cfa", "aws certified", "azure", "cissp", "pe license",
    "six sigma", "scrum", "comptia", "ccna", "leed",
  ];
  const certsRequired = certKeywords.filter((c) => text.includes(c));
  return {
    yearsRequired: yearsMatch ? parseInt(yearsMatch[1], 10) : null,
    degreeRequired: degreeMatch ? degreeMatch[1] : null,
    certsRequired,
  };
}

export interface KeywordCoverage {
  matched: string[];
  missing: string[];
  coverage: number; // 0-100
}

export function keywordCoverage(resume: string, jd: string): KeywordCoverage {
  const keywords = extractKeywords(jd, 30);
  const resumeTokens = new Set(tokens(resume));
  const resumeText = resume.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const kw of keywords) {
    // Match single tokens against token set, multi-word against raw text.
    const hit = kw.includes(" ")
      ? resumeText.includes(kw)
      : resumeTokens.has(kw);
    if (hit) matched.push(kw);
    else missing.push(kw);
  }
  const coverage = keywords.length
    ? Math.round((matched.length / keywords.length) * 100)
    : 0;
  return { matched, missing, coverage };
}

export interface FormatCheck {
  score: number; // 0-100
  issues: string[];
}

/** Parseability / format heuristics an ATS cares about. */
export function formatCheck(resume: string): FormatCheck {
  const issues: string[] = [];
  let score = 100;

  const hasEmail = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(resume);
  const hasPhone = /(\+?\d[\d\s().-]{7,})/.test(resume);
  const sections = ["experience", "education", "skills"];
  const lower = resume.toLowerCase();
  const missingSections = sections.filter((s) => !lower.includes(s));

  if (!hasEmail) { issues.push("No email address detected."); score -= 15; }
  if (!hasPhone) { issues.push("No phone number detected."); score -= 10; }
  for (const s of missingSections) {
    issues.push(`Missing a clear "${s}" section header.`);
    score -= 12;
  }
  if (resume.length < 400) {
    issues.push("Resume is very short; ATS may extract little signal.");
    score -= 15;
  }
  // Tables/columns often break ATS parsers; detect tab/pipe-heavy layouts.
  if ((resume.match(/\t|\|/g)?.length ?? 0) > 20) {
    issues.push("Possible tables/columns — use single-column plain text.");
    score -= 10;
  }
  return { score: Math.max(0, score), issues };
}

export interface SeniorityCheck {
  score: number; // 0-100
  note: string;
}

const SENIORITY = ["intern", "junior", "associate", "mid", "senior", "lead", "principal", "staff", "director", "vp", "head", "chief"];

export function seniorityAlignment(resume: string, jd: string): SeniorityCheck {
  const jdLevel = SENIORITY.findIndex((l) => jd.toLowerCase().includes(l));
  const resLevel = SENIORITY.findIndex((l) => resume.toLowerCase().includes(l));
  if (jdLevel === -1) return { score: 80, note: "No explicit seniority in the job." };
  if (resLevel === -1) return { score: 60, note: "Add seniority language matching the role." };
  const gap = Math.abs(jdLevel - resLevel);
  const score = Math.max(40, 100 - gap * 20);
  return {
    score,
    note: gap === 0 ? "Seniority aligns well." : "Seniority differs from the posting.",
  };
}

export interface DeterministicAts {
  keyword: KeywordCoverage;
  format: FormatCheck;
  seniority: SeniorityCheck;
  hardRequirements: HardRequirements;
  baseScore: number;
}

/** Weighted deterministic score before the AI semantic adjustment. */
export function analyzeAts(resume: string, jd: string): DeterministicAts {
  const keyword = keywordCoverage(resume, jd);
  const format = formatCheck(resume);
  const seniority = seniorityAlignment(resume, jd);
  const hardRequirements = detectHardRequirements(jd);

  // Weights: keywords 45, format 20, seniority 15, (semantic 20 added by AI).
  const baseScore = Math.round(
    keyword.coverage * 0.45 + format.score * 0.2 + seniority.score * 0.15,
  );
  return { keyword, format, seniority, hardRequirements, baseScore };
}
