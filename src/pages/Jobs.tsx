import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Briefcase, UserPlus, ExternalLink, Search, Send, Loader2, Star, RefreshCw, Trash2, DollarSign, ThumbsDown, Sparkles } from "lucide-react";

type SortKey = "recent" | "relevance" | "quality";

export default function Jobs() {
  const utils = trpc.useUtils();
  const [qualityFilter, setQualityFilter] = useState(true);
  const [sort, setSort] = useState<SortKey>("recent");
  const [withComp, setWithComp] = useState(false);
  const [statusTab, setStatusTab] = useState<"all" | "new" | "saved" | "applied">("all");

  const profiles = trpc.profiles.list.useQuery();
  const jobs = trpc.jobs.list.useQuery({
    qualityFilter,
    sort,
    withCompensationOnly: withComp,
    status: statusTab === "all" ? undefined : statusTab,
  });
  const search = trpc.jobs.search.useMutation();
  const setStatus = trpc.jobs.setStatus.useMutation();
  const rate = trpc.jobs.rate.useMutation();
  const removeJob = trpc.jobs.remove.useMutation();
  const clear = trpc.jobs.clear.useMutation();
  const logApp = trpc.applications.create.useMutation();
  const prepare = trpc.applications.prepare.useMutation();
  const autoApply = trpc.applications.autoApply.useMutation();
  const access = trpc.auth.myAccess.useQuery();
  const canAutoApply = !!(access.data?.plan as any)?.autoApply;

  const runAutoApply = async () => {
    const t = toast.loading("Auto-preparing applications for your top matches…");
    try {
      const res = await autoApply.mutateAsync({ count: 5 });
      await utils.applications.list.invalidate();
      await utils.jobs.list.invalidate();
      toast.success(res.prepared > 0 ? `Prepared ${res.prepared} draft(s) — review them on Applications` : "No eligible jobs (search first, or daily cap reached)", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { id: t });
    }
  };

  const prepareApplication = async (j: any) => {
    if (!j.description) return toast.error("This job has no description to tailor from");
    const t = toast.loading("Drafting tailored resume & cover letter…");
    try {
      await prepare.mutateAsync({
        jobId: j.id,
        companyName: j.title,
        jobTitle: j.title,
        jobUrl: j.sourceUrl ?? undefined,
        jobDescription: j.description,
      });
      await utils.applications.list.invalidate();
      toast.success("Draft ready — review it on the Applications page", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { id: t });
    }
  };

  const hasActiveProfile = !!profiles.data?.some((p) => p.isActive);

  const [location, setLocation] = useState("");
  const [company, setCompany] = useState("");
  const [keywords, setKeywords] = useState("");
  const [minRelevance, setMinRelevance] = useState(45);
  const [maxDaysOld, setMaxDaysOld] = useState(0); // 0 = any time
  const [minSalary, setMinSalary] = useState(0);
  const [contractType, setContractType] = useState<"" | "full_time" | "part_time" | "contract" | "permanent">("");

  const runSearch = async () => {
    try {
      const res = await search.mutateAsync({
        qualityFilter, location: location || undefined, company: company || undefined,
        keywords: keywords || undefined, minRelevance,
        maxDaysOld: maxDaysOld > 0 ? maxDaysOld : undefined,
        sortByDate: maxDaysOld > 0,
        minSalary: minSalary > 0 ? minSalary : undefined,
        contractType: contractType || undefined,
      });
      const parts = [`${res.saved} new`];
      if (res.duplicates) parts.push(`${res.duplicates} already saved`);
      if (res.discarded) parts.push(`${res.discarded} filtered out`);
      toast.success(`Search complete — ${parts.join(", ")}`);
      await utils.jobs.list.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    }
  };

  const refresh = async () => {
    // Clear existing jobs then re-search for the latest.
    await clear.mutateAsync();
    await utils.jobs.list.invalidate();
    await runSearch();
  };

  const mark = async (id: number, status: "saved" | "applied") => {
    await setStatus.mutateAsync({ id, status });
    if (status === "applied") {
      const j = jobs.data?.find((x) => x.id === id);
      await logApp.mutateAsync({ jobId: id, companyName: j?.title ?? "Application", status: "applied" });
      await utils.applications.list.invalidate();
    }
    await utils.jobs.list.invalidate();
    toast.success(status === "saved" ? "Saved" : "Logged to Applications");
  };

  const rateJob = async (id: number, score: number) => {
    await rate.mutateAsync({ id, score });
    await utils.jobs.list.invalidate();
    toast.success("Rated");
  };

  const notInterested = async (id: number) => {
    await removeJob.mutateAsync({ id });
    await utils.jobs.list.invalidate();
    toast.success("Removed");
  };

  const fmtComp = (c: any) => {
    if (!c) return null;
    const cur = c.currency ?? "USD";
    if (c.min && c.max) return `${cur} ${Math.round(c.min / 1000)}k–${Math.round(c.max / 1000)}k`;
    if (c.max) return `${cur} up to ${Math.round(c.max / 1000)}k`;
    return null;
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="page-title">Jobs</h1>
        {hasActiveProfile && (
          <div className="flex gap-2">
            {canAutoApply && (
              <button onClick={runAutoApply} disabled={autoApply.isPending} className="btn-ghost h-10" title="Bulk-prepare drafts for your top matches">
                {autoApply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Auto-apply
              </button>
            )}
            <button onClick={refresh} disabled={search.isPending || clear.isPending} className="btn-ghost h-10" title="Clear and fetch the latest">
              {clear.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
            </button>
            <button onClick={runSearch} disabled={search.isPending} className="btn-primary h-10">
              {search.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</> : <><Search className="w-4 h-4" /> Search</>}
            </button>
          </div>
        )}
      </div>
      <p className="page-subtitle mb-5">Pulls from compliant job sources based on your active profile.</p>

      {!profiles.isLoading && !hasActiveProfile ? (
        <div className="card p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-3">
            <UserPlus className="w-6 h-6 text-brand" />
          </div>
          <h2 className="font-bold text-slate-800">Set up a profile to start finding jobs</h2>
          <p className="text-sm text-slate-500 mt-1 mb-4 max-w-md mx-auto">
            A profile tells us which industry and role to search for. Create one and mark it active, then search.
          </p>
          <Link to="/profiles" className="btn-primary mx-auto"><UserPlus className="w-4 h-4" /> Create a profile</Link>
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="card p-4 mb-4 space-y-3">
            <div className="grid sm:grid-cols-3 gap-2">
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Keywords / role" className="input" />
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (remote, Ohio…)" className="input" />
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className="input" />
            </div>
            <div className="flex items-center gap-4 flex-wrap text-sm text-slate-600">
              <label className="flex items-center gap-2"><input type="checkbox" checked={qualityFilter} onChange={(e) => setQualityFilter(e.target.checked)} /> Prioritize pay &amp; culture</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={withComp} onChange={(e) => setWithComp(e.target.checked)} /> Only with compensation</label>
              <div className="flex items-center gap-2">
                <span>Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-8 px-2 rounded-lg border border-[var(--border)] text-xs">
                  <option value="recent">Most recent</option>
                  <option value="relevance">Best match</option>
                  <option value="quality">Highest quality</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span>Min match</span>
                <input type="range" min={0} max={90} step={5} value={minRelevance} onChange={(e) => setMinRelevance(Number(e.target.value))} />
                <span className="chip bg-slate-100 text-slate-600 w-10 justify-center">{minRelevance}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Posted</span>
                <select value={maxDaysOld} onChange={(e) => setMaxDaysOld(Number(e.target.value))} className="h-8 px-2 rounded-lg border border-[var(--border)] text-xs">
                  <option value={0}>Any time</option>
                  <option value={1}>Last 24 hours</option>
                  <option value={3}>Last 3 days</option>
                  <option value={7}>Last week</option>
                  <option value={30}>Last month</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span>Min salary</span>
                <select value={minSalary} onChange={(e) => setMinSalary(Number(e.target.value))} className="h-8 px-2 rounded-lg border border-[var(--border)] text-xs">
                  <option value={0}>Any</option>
                  <option value={50000}>$50k+</option>
                  <option value={75000}>$75k+</option>
                  <option value={100000}>$100k+</option>
                  <option value={150000}>$150k+</option>
                  <option value={200000}>$200k+</option>
                </select>
                {minSalary > 0 && <span className="text-[10px] text-slate-400 normal-case">keeps unlisted-salary jobs</span>}
              </div>
              <div className="flex items-center gap-2">
                <span>Type</span>
                <select value={contractType} onChange={(e) => setContractType(e.target.value as never)} className="h-8 px-2 rounded-lg border border-[var(--border)] text-xs">
                  <option value="">Any</option>
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="permanent">Permanent</option>
                </select>
              </div>
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1.5 mb-4">
            {(["all", "new", "saved", "applied"] as const).map((t) => (
              <button key={t} onClick={() => setStatusTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${statusTab === t ? "bg-brand text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                {t}
              </button>
            ))}
            {(jobs.data?.length ?? 0) > 0 && (
              <button onClick={async () => { if (confirm("Clear all jobs for this profile?")) { await clear.mutateAsync(); await utils.jobs.list.invalidate(); toast.success("Cleared"); } }}
                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-500 flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          <div className="space-y-2">
            {jobs.data?.map((j) => {
              const comp = fmtComp(j.compensation);
              return (
                <div key={j.id} className="card p-4 card-hover">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
                      <Briefcase className="w-4 h-4 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-sm text-slate-800 flex-1 min-w-0">{j.title}</div>
                        {j.relevanceScore != null && <span className="chip bg-blue-100 text-blue-700">{j.relevanceScore}% match</span>}
                        {/* Rating: shows quality if set, else a clickable star rater */}
                        {j.qualityScore != null ? (
                          <span className="chip bg-emerald-100 text-emerald-700">★ {j.qualityScore}</span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5" title="Rate this job">
                            {[20, 40, 60, 80, 100].map((v, i) => (
                              <button key={v} onClick={() => rateJob(j.id, v)} className="text-slate-300 hover:text-amber-400 transition-colors">
                                <Star className="w-3.5 h-3.5" />
                              </button>
                            ))}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 capitalize flex items-center gap-2 flex-wrap">
                        <span>{j.sourceName} · {j.status}</span>
                        {j.postedDate && <span className="normal-case">· posted {new Date(j.postedDate).toLocaleDateString()}</span>}
                        {comp ? (
                          <span className="chip bg-amber-100 text-amber-700"><DollarSign className="w-3 h-3" />{comp}</span>
                        ) : (
                          <span className="chip bg-slate-100 text-slate-400 normal-case">Salary not listed</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {j.sourceUrl && <a href={j.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-brand font-semibold inline-flex items-center gap-1">View posting <ExternalLink className="w-3 h-3" /></a>}
                        <button onClick={() => prepareApplication(j)} disabled={prepare.isPending} className="text-xs text-brand font-semibold inline-flex items-center gap-1 hover:underline"><Sparkles className="w-3 h-3" /> Prepare application</button>
                        {j.status !== "saved" && <button onClick={() => mark(j.id, "saved")} className="text-xs text-slate-500 font-semibold inline-flex items-center gap-1 hover:text-brand"><Star className="w-3 h-3" /> Save</button>}
                        {j.status !== "applied" && <button onClick={() => mark(j.id, "applied")} className="text-xs text-slate-500 font-semibold inline-flex items-center gap-1 hover:text-brand"><Send className="w-3 h-3" /> Mark applied</button>}
                        <button onClick={() => notInterested(j.id)} className="text-xs text-slate-400 font-semibold inline-flex items-center gap-1 hover:text-rose-500"><ThumbsDown className="w-3 h-3" /> Not interested</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {jobs.data?.length === 0 && (
              <div className="card p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3"><Briefcase className="w-6 h-6 text-slate-300" /></div>
                <p className="text-sm text-slate-500 mb-4">{statusTab === "all" ? "No jobs yet. Run a search to pull listings for your active profile." : `No ${statusTab} jobs.`}</p>
                {statusTab === "all" && <button onClick={runSearch} disabled={search.isPending} className="btn-primary mx-auto">{search.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</> : <><Search className="w-4 h-4" /> Search jobs now</>}</button>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
