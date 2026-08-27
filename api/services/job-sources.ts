import { createHash } from "crypto";
import { env } from "../lib/env";

/**
 * Provider-agnostic job sourcing. Only ToS-compliant sources are included —
 * sources that publish an API or explicitly allow programmatic access. No
 * source that prohibits automated access is queried.
 *
 * Currently included:
 *  - Remotive: public jobs API (https://remotive.com/api/remote-jobs)
 *  - Adzuna: official API (requires app id + key)
 *  - USAJOBS: official US government API (requires API key)
 *
 * Additional compliant sources can be added as new adapters implementing
 * the JobSource interface without touching the rest of the app.
 */

export interface JobQuery {
  industry?: string;
  role?: string;
  location?: string;
  limit?: number;
  maxDaysOld?: number; // recency filter (supported by Adzuna)
  sortByDate?: boolean;
  minSalary?: number; // minimum annual salary (Adzuna native)
  contractType?: "full_time" | "part_time" | "contract" | "permanent";
}

export interface RawJob {
  title: string;
  companyName: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
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

// ── Remotive (public API, no key required) ──
const remotiveSource: JobSource = {
  name: "remotive",
  isEnabled: () => env.jobs.remotiveEnabled,
  async search(query) {
    const params = new URLSearchParams();
    if (query.role) params.set("search", query.role);
    else if (query.industry) params.set("search", query.industry);
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
      }>;
    };
    return (data.jobs ?? []).map((j) => ({
      title: j.title,
      companyName: j.company_name,
      description: (j.description ?? "").replace(/<[^>]*>/g, "").slice(0, 4000),
      sourceName: "remotive",
      sourceUrl: j.url,
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
    const term = (query.role || query.industry || "").toLowerCase();
    return (data.data ?? [])
      .filter((j) => !term || `${j.title} ${j.description}`.toLowerCase().includes(term))
      .slice(0, query.limit ?? 25)
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
const theMuseSource: JobSource = {
  name: "themuse",
  isEnabled: () => true,
  async search(query) {
    const params = new URLSearchParams({ page: "0" });
    if (query.location) params.set("location", query.location);
    const res = await fetch(`https://www.themuse.com/api/public/jobs?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`The Muse error ${res.status}`);
    const data = (await res.json()) as {
      results?: Array<{
        name: string;
        company?: { name?: string };
        contents?: string;
        refs?: { landing_page?: string };
        publication_date?: string;
      }>;
    };
    const term = (query.role || query.industry || "").toLowerCase();
    return (data.results ?? [])
      .filter((j) => !term || j.name.toLowerCase().includes(term))
      .slice(0, query.limit ?? 25)
      .map((j) => {
        const company = j.company?.name ?? "Unknown";
        const url = j.refs?.landing_page ?? "";
        return {
          title: j.name,
          companyName: company,
          description: (j.contents ?? "").replace(/<[^>]*>/g, "").slice(0, 4000),
          sourceName: "themuse",
          sourceUrl: url,
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
      Keyword: query.role || query.industry || "",
      ResultsPerPage: String(query.limit ?? 25),
    });
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
        compensation: rem?.MinimumRange
          ? { min: Number(rem.MinimumRange), max: Number(rem.MaximumRange), currency: "USD" }
          : null,
        postedDate: d.PublicationStartDate ?? null,
        dedupeHash: hashJob(title, company, url),
      };
    });
  },
};

const registry: JobSource[] = [
  remotiveSource,
  adzunaSource,
  arbeitnowSource,
  theMuseSource,
  usaJobsSource,
];

export function enabledSources(): JobSource[] {
  return registry.filter((s) => s.isEnabled());
}

export interface SearchOutcome {
  jobs: RawJob[];
  logs: Array<{ source: string; count: number; status: string; error?: string }>;
}

/** Query all enabled sources; degrade gracefully; de-duplicate by hash. */
export async function searchAllSources(query: JobQuery): Promise<SearchOutcome> {
  const logs: SearchOutcome["logs"] = [];
  const seen = new Set<string>();
  const jobs: RawJob[] = [];

  for (const source of enabledSources()) {
    try {
      const results = await source.search(query);
      let added = 0;
      for (const j of results) {
        if (seen.has(j.dedupeHash)) continue;
        seen.add(j.dedupeHash);
        jobs.push(j);
        added++;
      }
      logs.push({ source: source.name, count: added, status: "ok" });
    } catch (err) {
      logs.push({
        source: source.name,
        count: 0,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { jobs, logs };
}
