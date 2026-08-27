import type { RawJob } from "./job-sources";

/**
 * Deterministic relevance scoring: how well a job matches the user's profile
 * targeting + optional filters. Returns 0-100. Used to filter out irrelevant
 * jobs so they are not saved.
 */

export interface RelevanceInputs {
  targetRole?: string | null;
  targetIndustry?: string | null;
  keywords?: string[]; // extra keywords the user cares about
  company?: string; // filter: only this company (substring)
  location?: string; // filter: only jobs mentioning this location
}

function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function overlapScore(needle: string[], haystack: Set<string>): number {
  if (needle.length === 0) return 0;
  const hits = needle.filter((w) => haystack.has(w)).length;
  return hits / needle.length;
}

export function scoreRelevance(job: RawJob, inputs: RelevanceInputs): number {
  const hay = new Set([
    ...tokenize(job.title),
    ...tokenize(job.description),
    ...tokenize(job.companyName),
  ]);

  let score = 0;
  let weightUsed = 0;

  // Role match is the strongest signal (weight 50).
  if (inputs.targetRole) {
    const roleTokens = tokenize(inputs.targetRole);
    // Title match counts double.
    const titleSet = new Set(tokenize(job.title));
    const titleHit = overlapScore(roleTokens, titleSet);
    const bodyHit = overlapScore(roleTokens, hay);
    score += 50 * (0.7 * titleHit + 0.3 * bodyHit);
    weightUsed += 50;
  }

  // Industry match (weight 25).
  if (inputs.targetIndustry) {
    score += 25 * overlapScore(tokenize(inputs.targetIndustry), hay);
    weightUsed += 25;
  }

  // Extra keywords (weight 25).
  if (inputs.keywords && inputs.keywords.length) {
    const kw = inputs.keywords.flatMap(tokenize);
    score += 25 * overlapScore(kw, hay);
    weightUsed += 25;
  }

  // If no targeting at all, treat everything as neutral-relevant.
  if (weightUsed === 0) return 60;

  return Math.round((score / weightUsed) * 100);
}

/** Hard filters: exclude jobs that fail an explicit company/location filter. */
export function passesFilters(job: RawJob, inputs: RelevanceInputs): boolean {
  if (inputs.company) {
    if (!job.companyName.toLowerCase().includes(inputs.company.toLowerCase()))
      return false;
  }
  if (inputs.location) {
    const loc = inputs.location.toLowerCase();
    const text = `${job.title} ${job.description}`.toLowerCase();
    // "remote" always passes a remote filter; otherwise require a mention.
    if (!text.includes(loc) && !(loc === "remote" && text.includes("remote")))
      return false;
  }
  return true;
}
