import { createHash } from "crypto";
import { env } from "../lib/env";
import { GREENHOUSE_BOARDS, LEVER_BOARDS, parseBoardEnv } from "./ats-boards";

/**
 * Provider-agnostic job sourcing. Only ToS-compliant sources are included —
 * sources that publish an API or explicitly allow programmatic access. No
 * source that prohibits automated access is queried.
 *
 * Currently included:
 *  - Remotive: public jobs API (https://remotive.com/api/remote-jobs)
 *  - Adzuna: official API (requires app id + key)
 *  - Arbeitnow: free public job-board API
 *  - The Muse: free public jobs API (multi-page)
 *  - USAJOBS: official US government API (requires API key)
 *  - Greenhouse: public per-company board API, aggregated across curated boards
 *  - Lever: public per-company postings API, aggregated across curated boards
 *
 * Additional compliant sources can be added as new adapters implementing
 * the JobSource interface without touching the rest of the app.
 */

export interface JobQuery {
  industry?: string;
  role?: string;
  company?: string; // when set, sources search for this employer's postings
  location?: string;
  limit?: number;
  maxDaysOld?: number; // recency filter (supported by Adzuna)
  sortByDate?: boolean;
  minSalary?: number; // minimum annual salary (Adzuna native)
  contractType?: "full_time" | "part_time" | "contract" | "permanent";
}

/**
 * Build the free-text search term a source should query with. When a company
 * is specified we lead with it (and add the role/industry as extra context) so
 * APIs return that employer's postings instead of a generic batch we'd then
 * have to filter down to nothing.
 */
function searchTerm(query: JobQuery): string {
  const role = query.role || query.industry || "";
  if (query.company) return `${query.company} ${role}`.trim();
  return role;
}

/**
 * Loose relevance for sources that don't support server-side keyword search.
 * A job matches if the full phrase appears, OR if most meaningful words of the
 * role appear somewhere in the haystack. This keeps results exhaustive without
 * demanding an exact title match.
 */
function matchesLoosely(role: string, haystack: string): boolean {
  const r = role.toLowerCase().trim();
  const hay = haystack.toLowerCase();
  if (!r) return true;
  if (hay.includes(r)) return true;
  const words = r.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return true;
  const hits = words.filter((w) => hay.includes(w)).length;
  // Match if at least half the role's words are present.
  return hits >= Math.ceil(words.length / 2);
}

export interface RawJob {
  title: string;
  companyName: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
  location?: string | null; // structured location from the source when available
  compensation?: { min?: number; max?: number; currency?: string } | null;
  postedDate?: string | null; // ISO date when available (Adzuna)
  dedupeHash: string;
}

export interface JobSource {
  name: string;
  isEnabled(): boolean;
  search(query: JobQuery): Promise<RawJob[]>;
}

function hashJob(title: string, company: string, url: string): string {
  return createHash("sha256")
    .update(`${title.toLowerCase()}|${company.toLowerCase()}|${url}`)
    .digest("hex")
    .slice(0, 64);
}

/** Fetch with a hard timeout so one slow board can't stall a whole search. */
async function fetchWithTimeout(url: string, ms = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── Remotive (public API, no key required) ──
const remotiveSource: JobSource = {
  name: "remotive",
  isEnabled: () => env.jobs.remotiveEnabled,
  async search(query) {
    const params = new URLSearchParams();
    const term = searchTerm(query);
    if (term) params.set("search", term);
    params.set("limit", String(query.limit ?? 25));

    const res = await fetch(
      `https://remotive.com/api/remote-jobs?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`Remotive error ${res.status}`);
    const data = (await res.json()) as {
      jobs?: Array<{
        title: string;
        company_name: string;
        description: string;
        url: string;
        salary?: string;
        candidate_required_location?: string;
      }>;
    };
    return (data.jobs ?? []).map((j) => ({
      title: j.title,
      companyName: j.company_name,
      description: (j.description ?? "").replace(/<[^>]*>/g, "").slice(0, 4000),
      sourceName: "remotive",
      sourceUrl: j.url,
      location: j.candidate_required_location || "Remote",
      compensation: null,
      dedupeHash: hashJob(j.title, j.company_name, j.url),
    }));
  },
};

// ── Adzuna (official API, requires app id + key) ──
const adzunaSource: JobSource = {
  name: "adzuna",
  isEnabled: () => !!(env.jobs.adzunaAppId && env.jobs.adzunaAppKey),
  async search(query) {
    const country = "us";
    const params = new URLSearchParams({
      app_id: env.jobs.adzunaAppId,
      app_key: env.jobs.adzunaAppKey,
      results_per_page: String(query.limit ?? 25),
      what: query.role || query.industry || "",
      where: query.location || "",
      "content-type": "application/json",
    });
    // Company: Adzuna supports filtering by employer name.
    if (query.company) params.set("company", query.company);
    // Recency: Adzuna supports max_days_old and sort_by=date.
    if (query.maxDaysOld) params.set("max_days_old", String(query.maxDaysOld));
    if (query.sortByDate) params.set("sort_by", "date");
    // Salary + contract (Adzuna native filters).
    if (query.minSalary) params.set("salary_min", String(query.minSalary));
    if (query.contractType === "full_time") params.set("full_time", "1");
    if (query.contractType === "part_time") params.set("part_time", "1");
    if (query.contractType === "contract") params.set("contract", "1");
    if (query.contractType === "permanent") params.set("permanent", "1");

    const res = await fetch(
      `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`,
    );
    if (!res.ok) throw new Error(`Adzuna error ${res.status}`);
    const data = (await res.json()) as {
      results?: Array<{
        title: string;
        company?: { display_name?: string };
        description: string;
        redirect_url: string;
        location?: { display_name?: string };
        salary_min?: number;
        salary_max?: number;
        created?: string;
      }>;
    };
    return (data.results ?? []).map((j) => {
      const company = j.company?.display_name ?? "Unknown";
      return {
        title: j.title,
        companyName: company,
        description: (j.description ?? "").slice(0, 4000),
        sourceName: "adzuna",
        sourceUrl: j.redirect_url,
        location: j.location?.display_name ?? null,
        compensation:
          j.salary_min || j.salary_max
            ? { min: j.salary_min, max: j.salary_max, currency: "USD" }
            : null,
        postedDate: j.created ?? null,
        dedupeHash: hashJob(j.title, company, j.redirect_url),
      };
    });
  },
};

// ── Arbeitnow (free public API, no key) ──
const arbeitnowSource: JobSource = {
  name: "arbeitnow",
  isEnabled: () => true,
  async search(query) {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Arbeitnow error ${res.status}`);
    const data = (await res.json()) as {
      data?: Array<{
        title: string;
        company_name: string;
        description: string;
        url: string;
        created_at?: number;
      }>;
    };
    const role = (query.role || query.industry || "").toLowerCase();
    const company = (query.company ?? "").toLowerCase();
    return (data.data ?? [])
      .filter((j) => {
        const hay = `${j.title} ${j.company_name} ${j.description}`.toLowerCase();
        if (company && !hay.includes(company)) return false;
        return matchesLoosely(role, hay);
      })
      .slice(0, query.limit ?? 40)
      .map((j) => ({
        title: j.title,
        companyName: j.company_name,
        description: (j.description ?? "").replace(/<[^>]*>/g, "").slice(0, 4000),
        sourceName: "arbeitnow",
        sourceUrl: j.url,
        compensation: null,
        postedDate: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
        dedupeHash: hashJob(j.title, j.company_name, j.url),
      }));
  },
};

// ── The Muse (free public API, no key) ──
type MuseJob = {
  name: string;
  company?: { name?: string };
  contents?: string;
  refs?: { landing_page?: string };
  locations?: Array<{ name?: string }>;
  publication_date?: string;
};

const theMuseSource: JobSource = {
  name: "themuse",
  isEnabled: () => true,
  async search(query) {
    const limit = query.limit ?? 40;
    const role = (query.role || query.industry || "").toLowerCase();
    const company = (query.company ?? "").toLowerCase();

    // The Muse paginates ~20 results per page. Pull several pages so a single
    // search is exhaustive rather than capped at one page.
    const collected: MuseJob[] = [];
    for (let page = 0; page < 5 && collected.length < limit * 3; page++) {
      const params = new URLSearchParams({ page: String(page) });
      if (query.location) params.set("location", query.location);
      let res: Response;
      try {
        res = await fetch(`https://www.themuse.com/api/public/jobs?${params.toString()}`, {
          headers: { Accept: "application/json" },
        });
      } catch {
        break;
      }
      if (!res.ok) {
        if (page === 0) throw new Error(`The Muse error ${res.status}`);
        break;
      }
      const data = (await res.json()) as { results?: MuseJob[] };
      const results = data.results ?? [];
      if (results.length === 0) break;
      collected.push(...results);
    }

    return collected
      .filter((j) => {
        if (company && !(j.company?.name ?? "").toLowerCase().includes(company)) return false;
        // Loose role match: any meaningful word of the role appears in title/body.
        if (!role) return true;
        const hay = `${j.name} ${j.contents ?? ""}`.toLowerCase();
        return matchesLoosely(role, hay);
      })
      .slice(0, limit)
      .map((j) => {
        const company = j.company?.name ?? "Unknown";
        const url = j.refs?.landing_page ?? "";
        return {
          title: j.name,
          companyName: company,
          description: (j.contents ?? "").replace(/<[^>]*>/g, "").slice(0, 4000),
          sourceName: "themuse",
          sourceUrl: url,
          location: (j.locations ?? []).map((l) => l.name).filter(Boolean).join(", ") || null,
          compensation: null,
          postedDate: j.publication_date ?? null,
          dedupeHash: hashJob(j.name, company, url),
        };
      });
  },
};

// ── USAJOBS (official US government API, requires a free API key + email) ──
const usaJobsSource: JobSource = {
  name: "usajobs",
  isEnabled: () => !!env.jobs.usaJobsApiKey,
  async search(query) {
    const params = new URLSearchParams({
      Keyword: searchTerm(query) || "",
      ResultsPerPage: String(query.limit ?? 25),
    });
    if (query.company) params.set("Organization", query.company);
    if (query.location) params.set("LocationName", query.location);
    const res = await fetch(`https://data.usajobs.gov/api/search?${params.toString()}`, {
      headers: {
        Host: "data.usajobs.gov",
        "User-Agent": "the-applicant@theapplicant.local",
        "Authorization-Key": env.jobs.usaJobsApiKey,
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`USAJOBS error ${res.status}`);
    const data = (await res.json()) as {
      SearchResult?: {
        SearchResultItems?: Array<{
          MatchedObjectDescriptor?: {
            PositionTitle?: string;
            OrganizationName?: string;
            PositionURI?: string;
            PositionLocationDisplay?: string;
            UserArea?: { Details?: { JobSummary?: string } };
            PositionRemuneration?: Array<{ MinimumRange?: string; MaximumRange?: string }>;
            PublicationStartDate?: string;
          };
        }>;
      };
    };
    const items = data.SearchResult?.SearchResultItems ?? [];
    return items.map((it) => {
      const d = it.MatchedObjectDescriptor ?? {};
      const title = d.PositionTitle ?? "Position";
      const company = d.OrganizationName ?? "US Government";
      const url = d.PositionURI ?? "";
      const rem = d.PositionRemuneration?.[0];
      return {
        title,
        companyName: company,
        description: (d.UserArea?.Details?.JobSummary ?? "").slice(0, 4000),
        sourceName: "usajobs",
        sourceUrl: url,
        location: d.PositionLocationDisplay ?? null,
        compensation: rem?.MinimumRange
          ? { min: Number(rem.MinimumRange), max: Number(rem.MaximumRange), currency: "USD" }
          : null,
        postedDate: d.PublicationStartDate ?? null,
        dedupeHash: hashJob(title, company, url),
      };
    });
  },
};

// ── Greenhouse (public per-company board API, no key) ──
// Aggregated across a curated set of employer boards, filtered by role/keywords.
const greenhouseSource: JobSource = {
  name: "greenhouse",
  isEnabled: () => env.jobs.greenhouseEnabled,
  async search(query) {
    const boards =
      parseBoardEnv(env.jobs.greenhouseBoards) ?? GREENHOUSE_BOARDS;
    const role = (query.role || query.industry || "").toLowerCase();
    const company = (query.company ?? "").toLowerCase();

    // If a company filter is set and it matches a known board token, query only
    // that board (fast + exact). Otherwise fan out across the curated set.
    const targets = company
      ? boards.filter((b) => b.includes(company) || company.includes(b))
      : boards;
    const toQuery = (targets.length ? targets : boards).slice(0, 40);

    const results = await Promise.allSettled(
      toQuery.map(async (token) => {
        const res = await fetchWithTimeout(
          `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`,
        );
        if (!res.ok) return [] as RawJob[];
        const data = (await res.json()) as {
          jobs?: Array<{
            id: number;
            title: string;
            absolute_url: string;
            company_name?: string;
            location?: { name?: string };
            content?: string;
            updated_at?: string;
          }>;
        };
        return (data.jobs ?? []).map((j) => {
          const companyName = j.company_name || token;
          const desc = (j.content ?? "")
            .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
            .replace(/<[^>]*>/g, " ")
            .slice(0, 4000);
          return {
            title: j.title,
            companyName,
            description: desc,
            sourceName: "greenhouse",
            sourceUrl: j.absolute_url,
            location: j.location?.name ?? null,
            compensation: null,
            postedDate: j.updated_at ?? null,
            dedupeHash: hashJob(j.title, companyName, j.absolute_url),
          } as RawJob;
        });
      }),
    );

    const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    return all
      .filter((j) => matchesLoosely(role, `${j.title} ${j.description}`))
      .slice(0, (query.limit ?? 40) * 2);
  },
};

// ── Lever (public per-company postings API, no key) ──
const leverSource: JobSource = {
  name: "lever",
  isEnabled: () => env.jobs.leverEnabled,
  async search(query) {
    const boards = parseBoardEnv(env.jobs.leverBoards) ?? LEVER_BOARDS;
    const role = (query.role || query.industry || "").toLowerCase();
    const company = (query.company ?? "").toLowerCase();

    const targets = company
      ? boards.filter((b) => b.includes(company) || company.includes(b))
      : boards;
    const toQuery = (targets.length ? targets : boards).slice(0, 40);

    const results = await Promise.allSettled(
      toQuery.map(async (token) => {
        const res = await fetchWithTimeout(
          `https://api.lever.co/v0/postings/${token}?mode=json`,
        );
        if (!res.ok) return [] as RawJob[];
        const data = (await res.json()) as Array<{
          id: string;
          text: string;
          hostedUrl: string;
          descriptionPlain?: string;
          categories?: { location?: string; team?: string; commitment?: string };
          createdAt?: number;
        }>;
        return (data ?? []).map((j) => {
          const companyName = token;
          return {
            title: j.text,
            companyName,
            description: (j.descriptionPlain ?? "").slice(0, 4000),
            sourceName: "lever",
            sourceUrl: j.hostedUrl,
            location: j.categories?.location ?? null,
            compensation: null,
            postedDate: j.createdAt ? new Date(j.createdAt).toISOString() : null,
            dedupeHash: hashJob(j.text, companyName, j.hostedUrl),
          } as RawJob;
        });
      }),
    );

    const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    return all
      .filter((j) => matchesLoosely(role, `${j.title} ${j.description}`))
      .slice(0, (query.limit ?? 40) * 2);
  },
};

const registry: JobSource[] = [
  remotiveSource,
  adzunaSource,
  arbeitnowSource,
  theMuseSource,
  usaJobsSource,
  greenhouseSource,
  leverSource,
];

export function enabledSources(): JobSource[] {
  return registry.filter((s) => s.isEnabled());
}

export interface SearchOutcome {
  jobs: RawJob[];
  logs: Array<{ source: string; count: number; status: string; error?: string }>;
}

/** Query all enabled sources in parallel; degrade gracefully; de-dup by hash. */
export async function searchAllSources(query: JobQuery): Promise<SearchOutcome> {
  const logs: SearchOutcome["logs"] = [];
  const seen = new Set<string>();
  const jobs: RawJob[] = [];

  const perSource = await Promise.all(
    enabledSources().map(async (source) => {
      try {
        const results = await source.search(query);
        return { source: source.name, results, error: undefined as string | undefined };
      } catch (err) {
        return {
          source: source.name,
          results: [] as RawJob[],
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  for (const outcome of perSource) {
    if (outcome.error) {
      logs.push({ source: outcome.source, count: 0, status: "failed", error: outcome.error });
      continue;
    }
    let added = 0;
    for (const j of outcome.results) {
      if (!j.sourceUrl || seen.has(j.dedupeHash)) continue;
      seen.add(j.dedupeHash);
      jobs.push(j);
      added++;
    }
    logs.push({ source: outcome.source, count: added, status: "ok" });
  }

  return { jobs, logs };
}
