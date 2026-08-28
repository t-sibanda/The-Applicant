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

// US state name <-> abbreviation, so a "California" filter also matches "CA".
const US_STATES: Record<string, string> = {
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca",
  colorado: "co", connecticut: "ct", delaware: "de", florida: "fl", georgia: "ga",
  hawaii: "hi", idaho: "id", illinois: "il", indiana: "in", iowa: "ia",
  kansas: "ks", kentucky: "ky", louisiana: "la", maine: "me", maryland: "md",
  massachusetts: "ma", michigan: "mi", minnesota: "mn", mississippi: "ms",
  missouri: "mo", montana: "mt", nebraska: "ne", nevada: "nv",
  "new hampshire": "nh", "new jersey": "nj", "new mexico": "nm", "new york": "ny",
  "north carolina": "nc", "north dakota": "nd", ohio: "oh", oklahoma: "ok",
  oregon: "or", pennsylvania: "pa", "rhode island": "ri", "south carolina": "sc",
  "south dakota": "sd", tennessee: "tn", texas: "tx", utah: "ut", vermont: "vt",
  virginia: "va", washington: "wa", "west virginia": "wv", wisconsin: "wi",
  wyoming: "wy", "district of columbia": "dc",
};

/**
 * Does a job plausibly match a user's location filter?
 * Forgiving by design: matches the structured location field or the text,
 * handles US state names/abbreviations, and treats "remote"/"anywhere" broadly.
 * Jobs with NO location info at all are NOT rejected (they may still qualify).
 */
function locationMatches(job: RawJob, filter: string): boolean {
  const loc = filter.trim().toLowerCase();
  if (!loc) return true;

  const jobLoc = (job.location ?? "").toLowerCase();
  const text = `${jobLoc} ${job.title} ${job.description}`.toLowerCase();

  // Remote / anywhere: match remote-friendly listings.
  const remoteWords = ["remote", "anywhere", "worldwide", "work from home"];
  if (remoteWords.some((w) => loc.includes(w))) {
    return remoteWords.some((w) => text.includes(w));
  }
  const jobIsRemote = remoteWords.some((w) => text.includes(w));

  // Build the set of terms that should count as a location hit.
  const terms = new Set<string>([loc]);
  if (US_STATES[loc]) terms.add(US_STATES[loc]); // full name -> abbrev
  const abbrevToName = Object.entries(US_STATES).find(([, ab]) => ab === loc);
  if (abbrevToName) terms.add(abbrevToName[0]); // abbrev -> full name
  // Also match individual words of a multi-word location (e.g. "new york").
  for (const w of loc.split(/[\s,]+/).filter((x) => x.length > 2)) terms.add(w);

  // Match against the structured location first, then any text.
  const hit = [...terms].some((t) => {
    if (!t) return false;
    // Word-boundary match for short state abbreviations to avoid false hits.
    if (t.length <= 3) return new RegExp(`\\b${t}\\b`).test(text);
    return text.includes(t);
  });

  // Remote jobs are location-flexible, so they pass most location filters.
  return hit || jobIsRemote;
}

/** Hard filters: exclude jobs that fail an explicit company/location filter. */
export function passesFilters(job: RawJob, inputs: RelevanceInputs): boolean {
  if (inputs.company) {
    if (!job.companyName.toLowerCase().includes(inputs.company.toLowerCase()))
      return false;
  }
  if (inputs.location) {
    // If the job carries no location signal anywhere, keep it rather than
    // discard on missing data. Otherwise require a plausible match.
    const hasAnyLocationSignal =
      !!(job.location && job.location.trim()) ||
      /\b(remote|anywhere|worldwide|onsite|hybrid|,\s*[a-z]{2}\b)/i.test(
        `${job.title} ${job.description}`,
      );
    if (hasAnyLocationSignal && !locationMatches(job, inputs.location)) {
      return false;
    }
  }
  return true;
}
