import { fetchBoardText } from "./job-sources";
import { COMPANY_DIRECTORY, type CompanyEntry } from "./ats-boards";

/**
 * Company Hiring Insights.
 *
 * For a company on a public ATS (Greenhouse / Lever / Ashby), pull their live
 * job board and compute a hiring-pattern analysis to guide applications toward
 * less-contested openings:
 *  - departments frequently hiring
 *  - positions posted in volume (many near-identical titles = lots of seats)
 *  - rare / niche openings (a single posting for a distinct title)
 *  - recent momentum (posted in the last 7 / 30 days)
 *  - location spread
 *
 * This uses each company's OWN published careers API, not scraping. Companies
 * without a public board return a "not readable" result with their careers URL.
 */

export interface JobLite {
  title: string;
  department: string | null;
  location: string | null;
  url: string;
  postedAt: string | null; // ISO
}

export interface DeptCount {
  name: string;
  count: number;
  recent: number; // posted in the last 30 days
}

export interface TitleCluster {
  title: string;
  count: number;
  department: string | null;
  sampleUrl: string;
}

export interface CompanyInsights {
  ok: true;
  company: string;
  ats: CompanyEntry["ats"];
  totalOpenings: number;
  postedLast7: number;
  postedLast30: number;
  departments: DeptCount[]; // sorted desc by count
  hotTitles: TitleCluster[]; // titles with multiple openings (high demand)
  rareTitles: TitleCluster[]; // single, distinct openings (often less contested)
  topLocations: { name: string; count: number }[];
  summary: string; // plain-English guidance, deterministic
  careersUrl?: string;
}

export interface CompanyInsightsUnavailable {
  ok: false;
  company: string;
  reason: string;
  careersUrl?: string;
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 86_400_000;
}

/** Normalize a title for clustering (drop location/level noise, lowercase). */
function normTitle(title: string): string {
  let t = title
    .toLowerCase()
    .replace(/[,–—(].*$/, "") // cut trailing qualifiers after a comma/paren/dash
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Strip a LEADING seniority word only (so "Chief of Staff" keeps "staff").
  t = t.replace(/^(senior|sr|staff|principal|lead|junior|jr|associate)\s+/, "");
  return t.trim();
}

// ── Board fetchers that KEEP department metadata (search connectors drop it) ──

type GhJob = {
  title: string;
  absolute_url: string;
  location?: { name?: string };
  updated_at?: string;
  first_published?: string;
};

async function greenhouseJobs(token: string): Promise<JobLite[]> {
  // The /departments endpoint groups jobs under real department names, which is
  // exactly what the analysis wants. Fall back to the flat /jobs list if needed.
  const grouped = await fetchBoardText(
    `https://boards-api.greenhouse.io/v1/boards/${token}/departments`,
  );
  if (grouped) {
    const data = JSON.parse(grouped) as {
      departments?: Array<{ name?: string; jobs?: GhJob[] }>;
    };
    const out: JobLite[] = [];
    for (const d of data.departments ?? []) {
      const deptName = (d.name ?? "").trim() || null;
      for (const j of d.jobs ?? []) {
        out.push({
          title: j.title,
          department: deptName,
          location: j.location?.name ?? null,
          url: j.absolute_url,
          postedAt: j.first_published ?? j.updated_at ?? null,
        });
      }
    }
    if (out.length) return out;
  }

  const flat = await fetchBoardText(
    `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`,
  );
  if (!flat) return [];
  const data = JSON.parse(flat) as { jobs?: GhJob[] };
  return (data.jobs ?? []).map((j) => ({
    title: j.title,
    department: null,
    location: j.location?.name ?? null,
    url: j.absolute_url,
    postedAt: j.first_published ?? j.updated_at ?? null,
  }));
}

async function leverJobs(token: string): Promise<JobLite[]> {
  const text = await fetchBoardText(`https://api.lever.co/v0/postings/${token}?mode=json`);
  if (!text) return [];
  const data = JSON.parse(text) as Array<{
    text: string;
    hostedUrl: string;
    categories?: { location?: string; team?: string; department?: string };
    createdAt?: number;
  }>;
  return (data ?? []).map((j) => ({
    title: j.text,
    department: j.categories?.department ?? j.categories?.team ?? null,
    location: j.categories?.location ?? null,
    url: j.hostedUrl,
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
  }));
}

async function ashbyJobs(token: string): Promise<JobLite[]> {
  const text = await fetchBoardText(`https://api.ashbyhq.com/posting-api/job-board/${token}`);
  if (!text) return [];
  const data = JSON.parse(text) as {
    jobs?: Array<{
      title: string;
      department?: string;
      team?: string;
      location?: string;
      jobUrl?: string;
      applyUrl?: string;
      publishedAt?: string;
    }>;
  };
  return (data.jobs ?? []).map((j) => ({
    title: j.title,
    department: j.department ?? j.team ?? null,
    location: j.location ?? null,
    url: j.jobUrl || j.applyUrl || "",
    postedAt: j.publishedAt ?? null,
  }));
}

/** Look up a directory entry by company name (case-insensitive, loose). */
export function findCompany(name: string): CompanyEntry | undefined {
  const n = name.trim().toLowerCase();
  return (
    COMPANY_DIRECTORY.find((c) => c.name.toLowerCase() === n) ??
    COMPANY_DIRECTORY.find((c) => c.name.toLowerCase().includes(n) || n.includes(c.token ?? "\0")) ??
    COMPANY_DIRECTORY.find((c) => (c.token ?? "") === n)
  );
}

function buildSummary(i: Omit<CompanyInsights, "summary">): string {
  const parts: string[] = [];
  parts.push(`${i.company} has ${i.totalOpenings} open role(s), ${i.postedLast30} added in the last month.`);
  if (i.departments[0]) {
    parts.push(`Hiring is concentrated in ${i.departments[0].name}${i.departments[1] ? ` and ${i.departments[1].name}` : ""}.`);
  }
  if (i.hotTitles[0]) {
    parts.push(`They're filling several ${i.hotTitles[0].title} seats, so those roles have volume but more competition.`);
  }
  if (i.rareTitles.length) {
    parts.push(`${i.rareTitles.length} niche opening(s) have just one posting each. These are often less contested and worth a targeted application.`);
  }
  return parts.join(" ");
}

export async function companyInsights(
  companyName: string,
): Promise<CompanyInsights | CompanyInsightsUnavailable> {
  const entry = findCompany(companyName);
  if (!entry) {
    return { ok: false, company: companyName, reason: "That company isn't in our directory yet." };
  }
  if (entry.ats === "external" || !entry.token) {
    return {
      ok: false,
      company: entry.name,
      reason: `${entry.name} runs its own careers system, so we can't read its listings directly. Open their careers page to browse openings.`,
      careersUrl: entry.careersUrl,
    };
  }

  let jobs: JobLite[] = [];
  try {
    if (entry.ats === "greenhouse") jobs = await greenhouseJobs(entry.token);
    else if (entry.ats === "lever") jobs = await leverJobs(entry.token);
    else if (entry.ats === "ashby") jobs = await ashbyJobs(entry.token);
  } catch {
    jobs = [];
  }

  if (!jobs.length) {
    return {
      ok: false,
      company: entry.name,
      reason: "We couldn't read any current openings for this company right now. Try again shortly.",
      careersUrl: entry.careersUrl,
    };
  }

  return analyzeJobs(entry.name, entry.ats, jobs, entry.careersUrl);
}

/** Pure analysis over a company's job list. Exported for testing. */
export function analyzeJobs(
  companyName: string,
  ats: CompanyEntry["ats"],
  jobs: JobLite[],
  careersUrl?: string,
): CompanyInsights {
  // Departments.
  const deptMap = new Map<string, { count: number; recent: number }>();
  for (const j of jobs) {
    const name = (j.department || "Other").trim() || "Other";
    const cur = deptMap.get(name) ?? { count: 0, recent: 0 };
    cur.count++;
    const d = daysAgo(j.postedAt);
    if (d != null && d <= 30) cur.recent++;
    deptMap.set(name, cur);
  }
  const departments: DeptCount[] = [...deptMap.entries()]
    .map(([name, v]) => ({ name, count: v.count, recent: v.recent }))
    .sort((a, b) => b.count - a.count);

  // Title clusters.
  const titleMap = new Map<string, { count: number; department: string | null; url: string; display: string }>();
  for (const j of jobs) {
    const key = normTitle(j.title) || j.title.toLowerCase();
    const cur = titleMap.get(key);
    if (cur) cur.count++;
    else titleMap.set(key, { count: 1, department: j.department, url: j.url, display: j.title });
  }
  const clusters = [...titleMap.values()];
  const hotTitles: TitleCluster[] = clusters
    .filter((c) => c.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((c) => ({ title: c.display, count: c.count, department: c.department, sampleUrl: c.url }));
  const rareTitles: TitleCluster[] = clusters
    .filter((c) => c.count === 1)
    .slice(0, 12)
    .map((c) => ({ title: c.display, count: 1, department: c.department, sampleUrl: c.url }));

  // Locations.
  const locMap = new Map<string, number>();
  for (const j of jobs) {
    const name = (j.location || "Unspecified").split(";")[0].trim() || "Unspecified";
    locMap.set(name, (locMap.get(name) ?? 0) + 1);
  }
  const topLocations = [...locMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const postedLast7 = jobs.filter((j) => { const d = daysAgo(j.postedAt); return d != null && d <= 7; }).length;
  const postedLast30 = jobs.filter((j) => { const d = daysAgo(j.postedAt); return d != null && d <= 30; }).length;

  const base = {
    ok: true as const,
    company: companyName,
    ats,
    totalOpenings: jobs.length,
    postedLast7,
    postedLast30,
    departments,
    hotTitles,
    rareTitles,
    topLocations,
    careersUrl,
  };
  return { ...base, summary: buildSummary(base) };
}
