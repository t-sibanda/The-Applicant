/**
 * Curated lists of public ATS job-board tokens for aggregation.
 *
 * Greenhouse and Lever both publish free, unauthenticated, ToS-friendly public
 * job-board APIs, but only on a PER-COMPANY basis (there is no global keyword
 * search). To offer broad discovery we query across a curated set of well-known
 * employer boards and filter the combined results by the user's role/keywords.
 *
 * These lists are safe to extend over time. Unknown or migrated tokens simply
 * 404 and are skipped gracefully, so a stale entry never breaks a search.
 *
 * Env overrides (comma-separated tokens) let you tune coverage without a deploy:
 *   JOBS_GREENHOUSE_BOARDS="stripe,figma,databricks"
 *   JOBS_LEVER_BOARDS="netflix,plaid"
 */

// Greenhouse board tokens (the slug in job-boards.greenhouse.io/{token}).
export const GREENHOUSE_BOARDS: string[] = [
  // Frontier AI / ML
  "anthropic", "xai", "scaleai", "databricks", "cerebras", "runwayml",
  "figureai", "adept",
  // Big tech-adjacent & high-growth
  "stripe", "figma", "airbnb", "coinbase", "robinhood", "instacart",
  "doordash", "dropbox", "gitlab", "reddit", "twitch", "cloudflare",
  "hashicorp", "datadog", "asana", "brex", "ramp", "notion", "airtable",
  "retool", "vercel", "samsara", "affirm", "chime", "gusto", "flexport",
  "benchling", "rippling", "sofi", "carta", "webflow", "zapier",
  "discord", "faire", "nuro", "verkada", "wealthsimple", "gemini",
  "lyft", "pinterest", "snowflakecomputing", "elastic", "confluent",
];

// Lever board tokens (the slug in jobs.lever.co/{token}).
export const LEVER_BOARDS: string[] = [
  "netflix", "spotify", "plaid", "attentive", "voleon",
  "kraken", "eventbrite", "quora", "match", "palantir", "nubank",
];

// Ashby board tokens (the slug in jobs.ashbyhq.com/{token}).
export const ASHBY_BOARDS: string[] = [
  "openai", "ramp", "notion", "linear", "vanta", "clay", "mercury",
  "cursor", "runway", "sardine", "posthog", "replit", "hex", "modal",
  "together", "deel",
];

/** Split a comma-separated env override into a clean token list. */
export function parseBoardEnv(value: string | undefined): string[] | null {
  if (!value) return null;
  const list = value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.length ? list : null;
}

/**
 * A curated directory of well-known employers used to power company
 * SUGGESTIONS on the Jobs page. Each entry carries lightweight tags so we can
 * rank companies against a user's profile (industry, role, keywords).
 *
 * `ats` + `token` tell the search which board to query when the user picks a
 * suggested company. Companies without a public board (e.g. Meta, Alphabet,
 * NVIDIA, Apple) are still suggested with a careers link so the user isn't
 * misled into thinking we can pull their listings directly.
 */
export type Ats = "greenhouse" | "lever" | "ashby" | "external";

export interface CompanyEntry {
  name: string;
  ats: Ats;
  token?: string; // board slug when ats !== "external"
  careersUrl?: string; // used for "external" companies
  tags: string[]; // industry / domain keywords for matching
}

export const COMPANY_DIRECTORY: CompanyEntry[] = [
  // ── Frontier AI labs ──
  { name: "Anthropic", ats: "greenhouse", token: "anthropic", tags: ["ai", "ml", "research", "llm", "safety", "software"] },
  { name: "OpenAI", ats: "ashby", token: "openai", tags: ["ai", "ml", "research", "llm", "software"] },
  { name: "xAI", ats: "greenhouse", token: "xai", tags: ["ai", "ml", "research", "llm", "software"] },
  { name: "Scale AI", ats: "greenhouse", token: "scaleai", tags: ["ai", "ml", "data", "software"] },
  { name: "Cerebras", ats: "greenhouse", token: "cerebras", tags: ["ai", "ml", "hardware", "chips", "semiconductor"] },
  { name: "Together AI", ats: "ashby", token: "together", tags: ["ai", "ml", "infrastructure", "software"] },
  { name: "Modal", ats: "ashby", token: "modal", tags: ["ai", "ml", "infrastructure", "cloud", "software"] },
  { name: "Runway", ats: "ashby", token: "runway", tags: ["ai", "ml", "media", "video", "software"] },

  // ── Companies without a public board (careers link only) ──
  { name: "NVIDIA", ats: "external", careersUrl: "https://www.nvidia.com/en-us/about-nvidia/careers/", tags: ["ai", "ml", "hardware", "chips", "semiconductor", "graphics", "software"] },
  { name: "Alphabet (Google)", ats: "external", careersUrl: "https://www.google.com/about/careers/applications/jobs/results/", tags: ["ai", "ml", "software", "cloud", "search", "big tech"] },
  { name: "Meta", ats: "external", careersUrl: "https://www.metacareers.com/jobs", tags: ["ai", "ml", "software", "social", "vr", "big tech"] },
  { name: "Apple", ats: "external", careersUrl: "https://jobs.apple.com/en-us/search", tags: ["software", "hardware", "consumer", "big tech", "design"] },
  { name: "Microsoft", ats: "external", careersUrl: "https://jobs.careers.microsoft.com/global/en/search", tags: ["software", "cloud", "ai", "ml", "big tech"] },
  { name: "Amazon", ats: "external", careersUrl: "https://www.amazon.jobs/en/search", tags: ["software", "cloud", "retail", "logistics", "big tech"] },
  { name: "Tesla", ats: "external", careersUrl: "https://www.tesla.com/careers/search/", tags: ["hardware", "automotive", "energy", "manufacturing", "ai", "software"] },

  // ── High-growth / infra / fintech ──
  { name: "Stripe", ats: "greenhouse", token: "stripe", tags: ["fintech", "payments", "software", "infrastructure"] },
  { name: "Databricks", ats: "greenhouse", token: "databricks", tags: ["data", "ai", "ml", "software", "analytics", "cloud"] },
  { name: "Snowflake", ats: "greenhouse", token: "snowflakecomputing", tags: ["data", "cloud", "analytics", "software"] },
  { name: "Figma", ats: "greenhouse", token: "figma", tags: ["software", "design", "product"] },
  { name: "Coinbase", ats: "greenhouse", token: "coinbase", tags: ["fintech", "crypto", "software"] },
  { name: "Cloudflare", ats: "greenhouse", token: "cloudflare", tags: ["infrastructure", "security", "software", "networking"] },
  { name: "Datadog", ats: "greenhouse", token: "datadog", tags: ["software", "observability", "infrastructure"] },
  { name: "HashiCorp", ats: "greenhouse", token: "hashicorp", tags: ["infrastructure", "devops", "cloud", "software"] },
  { name: "Ramp", ats: "ashby", token: "ramp", tags: ["fintech", "payments", "software"] },
  { name: "Notion", ats: "ashby", token: "notion", tags: ["software", "productivity", "product"] },
  { name: "Linear", ats: "ashby", token: "linear", tags: ["software", "product", "developer tools"] },
  { name: "Mercury", ats: "ashby", token: "mercury", tags: ["fintech", "banking", "software"] },
  { name: "Vercel", ats: "greenhouse", token: "vercel", tags: ["software", "developer tools", "web", "infrastructure"] },
  { name: "Vanta", ats: "ashby", token: "vanta", tags: ["software", "security", "compliance"] },
  { name: "Cursor", ats: "ashby", token: "cursor", tags: ["ai", "software", "developer tools"] },
  { name: "Replit", ats: "ashby", token: "replit", tags: ["ai", "software", "developer tools", "education"] },
  { name: "PostHog", ats: "ashby", token: "posthog", tags: ["software", "analytics", "developer tools"] },
  { name: "Netflix", ats: "lever", token: "netflix", tags: ["media", "streaming", "software", "entertainment"] },
  { name: "Spotify", ats: "lever", token: "spotify", tags: ["media", "music", "software", "streaming"] },
  { name: "Palantir", ats: "lever", token: "palantir", tags: ["software", "data", "analytics", "defense", "government"] },
  { name: "Plaid", ats: "lever", token: "plaid", tags: ["fintech", "payments", "software", "infrastructure"] },
  { name: "Robinhood", ats: "greenhouse", token: "robinhood", tags: ["fintech", "investing", "software"] },
  { name: "DoorDash", ats: "greenhouse", token: "doordash", tags: ["software", "logistics", "marketplace"] },
  { name: "Reddit", ats: "greenhouse", token: "reddit", tags: ["software", "social", "media"] },
  { name: "Discord", ats: "greenhouse", token: "discord", tags: ["software", "social", "gaming"] },
  { name: "Pinterest", ats: "greenhouse", token: "pinterest", tags: ["software", "social", "media"] },
  { name: "Lyft", ats: "greenhouse", token: "lyft", tags: ["software", "logistics", "transportation"] },
  { name: "Affirm", ats: "greenhouse", token: "affirm", tags: ["fintech", "payments", "software"] },
  { name: "Rippling", ats: "greenhouse", token: "rippling", tags: ["software", "hr", "fintech"] },
  { name: "Benchling", ats: "greenhouse", token: "benchling", tags: ["software", "biotech", "life sciences", "healthcare"] },
];
