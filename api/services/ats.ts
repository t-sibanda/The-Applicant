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
  // Generic job posting filler that carries no skill signal.
  "responsibilities", "responsibility", "requirements", "required", "requirement",
  "candidate", "candidates", "opportunity", "opportunities", "company",
  "benefits", "benefit", "position", "positions", "duties", "duty",
  "qualifications", "qualification", "preferred", "description", "summary",
  "about", "join", "looking", "seeking", "ideal", "strong", "excellent",
  "ensure", "help", "support", "across", "within", "using", "used", "use",
  "well", "also", "into", "their", "them", "they", "these", "those", "such",
  "other", "more", "most", "than", "then", "here", "there", "which", "while",
  "per", "via", "each", "both", "some", "many", "make", "made", "new",
  "day", "days", "week", "weeks", "month", "months", "hour", "hours",
  "please", "apply", "applicant", "applicants", "hiring", "hire", "hired",
  "we're", "you'll", "we'll", "our", "us", "its", "it's",
  "environment", "culture", "world", "global", "leading", "leader",
]);

/**
 * A guidance set of common skills, tools, languages, frameworks, and
 * methodologies. It is not exhaustive; it is used to boost recognized skills
 * so they rank above generic terms, and to protect them from proper noun
 * filtering. Unknown but clearly technical tokens still survive on their own.
 */
const SKILL_TERMS = new Set([
  // Languages
  "python", "java", "javascript", "typescript", "golang", "rust", "kotlin",
  "swift", "scala", "ruby", "php", "perl", "sql", "html", "css", "bash",
  "matlab", "r", "dart", "elixir", "haskell", "clojure",
  // Frameworks / libs
  "react", "angular", "vue", "svelte", "node", "nodejs", "express", "django",
  "flask", "fastapi", "spring", "rails", "laravel", "next", "nextjs", "nuxt",
  "tensorflow", "pytorch", "keras", "pandas", "numpy", "sklearn", "spark",
  "hadoop", "kafka", "graphql", "rest", "grpc", "redux", "jquery",
  // Cloud / infra / devops
  "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ansible",
  "jenkins", "gitlab", "github", "circleci", "helm", "lambda", "ec2", "s3",
  "cloudformation", "prometheus", "grafana", "datadog", "nginx", "linux",
  // Data / db
  "postgres", "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
  "snowflake", "redshift", "bigquery", "dynamodb", "cassandra", "kafka",
  "airflow", "dbt", "tableau", "powerbi", "looker", "etl", "elt",
  // Practices / methods
  "agile", "scrum", "kanban", "devops", "cicd", "tdd", "microservices",
  "mlops", "seo", "sem", "saas", "b2b", "b2c", "crm", "erp", "api", "apis",
  // Business / PM
  "roadmap", "roadmaps", "stakeholder", "stakeholders", "kpi", "kpis",
  "okr", "okrs", "budgeting", "forecasting", "analytics", "reporting",
  "salesforce", "hubspot", "jira", "confluence", "asana", "figma", "sketch",
  // Domains
  "machine", "learning", "ai", "nlp", "llm", "llms", "cybersecurity",
  "compliance", "governance", "accounting", "finance", "marketing", "sales",
  "recruiting", "onboarding", "logistics", "procurement", "supply", "chain",
]);

/** True when a token contains technical symbols we always keep (c++, c#). */
function hasTechSymbol(token: string): boolean {
  return token.includes("+") || token.includes("#");
}

/** A skill weight applied to frequency so recognized skills rank higher. */
function skillWeight(token: string): number {
  if (SKILL_TERMS.has(token)) return 3;
  if (hasTechSymbol(token)) return 3;
  return 1;
}

/**
 * Detect proper nouns (company/product/person names) from the raw text so they
 * can be excluded from the keyword set. A token is flagged when it is
 * capitalized in the original text, is not the first word of a sentence, and
 * is not a recognized skill. These typically are organization or product
 * names (for example "Anthropic"), which are not ATS keywords.
 */
function detectProperNouns(rawText: string): Set<string> {
  const proper = new Set<string>();
  // Split into rough sentences to know which words start a sentence.
  const sentences = (rawText || "").split(/(?<=[.!?\n])\s+/);
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    words.forEach((w, i) => {
      const cleaned = w.replace(/[^A-Za-z0-9+#]/g, "");
      if (cleaned.length < 3) return;
      const lower = cleaned.toLowerCase();
      if (SKILL_TERMS.has(lower) || hasTechSymbol(lower)) return;
      const isCapitalized = /^[A-Z][a-z]+$/.test(cleaned) || /^[A-Z]{2,}$/.test(cleaned);
      // First word of a sentence is capitalized by grammar, not because it is
      // a proper noun, so we do not flag it on position alone.
      if (isCapitalized && i > 0) proper.add(lower);
    });
  }
  return proper;
}

/** Build the set of tokens derived from a company hint, to always exclude. */
function companyExclusions(companyHint?: string): Set<string> {
  const out = new Set<string>();
  if (!companyHint) return out;
  for (const t of tokens(companyHint)) out.add(t);
  return out;
}

function tokens(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    // Strip trailing dots so "kubernetes." matches "kubernetes", but keep
    // internal dots (for example "node.js") and tech symbols.
    .map((w) => w.replace(/\.+$/g, ""))
    // Keep tokens longer than 2 chars, or short tokens that carry a tech
    // symbol (c#, c++, go). Drop stopwords either way.
    .filter((w) => (w.length > 2 || hasTechSymbol(w)) && !STOPWORDS.has(w));
}

export interface ExtractOptions {
  companyHint?: string;
  max?: number;
}

/**
 * Extract candidate keywords from a job description.
 *
 * Objectivity: excludes stopwords and generic filler, drops detected proper
 * nouns (company/product names) unless they are recognized skills, and never
 * emits any token derived from the company hint. Recognized skills are weighted
 * above generic terms of equal frequency. Deterministic: ties break
 * alphabetically so identical input always yields identical output.
 */
export function extractKeywords(jd: string, opts: ExtractOptions = {}): string[] {
  const max = opts.max ?? 30;
  const proper = detectProperNouns(jd);
  const excluded = companyExclusions(opts.companyHint);

  const freq = new Map<string, number>();
  for (const t of tokens(jd)) {
    if (excluded.has(t)) continue;
    // Drop proper nouns unless they are recognized skills or tech tokens.
    if (proper.has(t) && !SKILL_TERMS.has(t) && !hasTechSymbol(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }

  return [...freq.entries()]
    .map(([w, count]) => ({ w, score: count * skillWeight(w) }))
    .sort((a, b) => (b.score - a.score) || a.w.localeCompare(b.w))
    .slice(0, max)
    .map((e) => e.w);
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

export function keywordCoverage(resume: string, jd: string, companyHint?: string): KeywordCoverage {
  const keywords = extractKeywords(jd, { companyHint, max: 30 });
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
export function analyzeAts(resume: string, jd: string, companyHint?: string): DeterministicAts {
  const keyword = keywordCoverage(resume, jd, companyHint);
  const format = formatCheck(resume);
  const seniority = seniorityAlignment(resume, jd);
  const hardRequirements = detectHardRequirements(jd);

  // Weights: keywords 45, format 20, seniority 15, (semantic 20 added by AI).
  const baseScore = Math.round(
    keyword.coverage * 0.45 + format.score * 0.2 + seniority.score * 0.15,
  );
  return { keyword, format, seniority, hardRequirements, baseScore };
}
