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
  "stripe", "databricks", "figma", "airbnb", "coinbase", "robinhood",
  "instacart", "doordash", "dropbox", "gitlab", "reddit", "twitch",
  "cloudflare", "hashicorp", "datadog", "asana", "brex", "ramp",
  "notion", "airtable", "retool", "vercel", "openai", "anthropic",
  "scaleai", "samsara", "affirm", "chime", "gusto", "flexport",
  "benchling", "rippling", "sofi", "carta", "webflow", "zapier",
  "discord", "faire", "nuro", "verkada", "wealthsimple",
];

// Lever board tokens (the slug in jobs.lever.co/{token}).
export const LEVER_BOARDS: string[] = [
  "netflix", "spotify", "plaid", "brex", "ramp", "attentive",
  "leverdemo", "voleon", "cohere", "huggingface", "kraken",
  "eventbrite", "quora", "match", "shopify",
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
