import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Briefcase, UserPlus, ExternalLink, Search, Send, Loader2, Star, RefreshCw, Trash2, DollarSign, ThumbsDown, Sparkles, Building2, ClipboardPaste, Wand2, ScanSearch, Bot, Linkedin, X, BarChart3, TrendingUp, Gem } from "lucide-react";
import { INDUSTRIES } from "../../shared/constants";
import { startWorkingSession } from "@/lib/workingSession";

type SortKey = "recent" | "relevance" | "quality";

type ScanResult = {
  match: number;
  // The verdict from the backend; kept as a plain string on the client since
  // the panel only displays suggestionText and never switches on this value.
  suggestion: string;
  suggestionText: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  hasResume: boolean;
  jobText: string;
  // context we carry so curation reuses the same input
  company?: string;
  title?: string;
  url?: string;
};

function matchColor(m: number) {
  return m >= 70 ? "bg-emerald-100 text-emerald-700" : m >= 45 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-600";
}

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
  const [keywords, setKeywords] = useState("");
  const [industryId, setIndustryId] = useState<string>("");
  const suggestions = trpc.jobs.suggestCompanies.useQuery({
    keywords: keywords || undefined,
    industryId: industryId || undefined,
  });
  const prepareFromPaste = trpc.applications.prepareFromPaste.useMutation();
  const quickScan = trpc.jobs.quickScan.useMutation();
  const [insightsCompany, setInsightsCompany] = useState<string | null>(null);
  const insights = trpc.jobs.companyInsights.useQuery(
    { company: insightsCompany ?? "" },
    { enabled: !!insightsCompany },
  );
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasteDesc, setPasteDesc] = useState("");
  const [pasteCompany, setPasteCompany] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");

  // A single scan result shown in a panel. It carries the job text so curation
  // reuses the same input without re-fetching.
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanningId, setScanningId] = useState<number | "paste" | null>(null);

  // Match chat: ask follow-up questions about fit for the scanned job.
  const matchChat = trpc.jobs.matchChat.useMutation();
  const [chatLog, setChatLog] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");

  const askMatch = async () => {
    if (!scan) return;
    const q = chatInput.trim();
    if (!q) return;
    setChatInput("");
    const history = chatLog.slice(-12);
    setChatLog((l) => [...l, { role: "user", content: q }]);
    try {
      const res = await matchChat.mutateAsync({
        jobText: scan.jobText,
        jobTitle: scan.title,
        question: q,
        history,
      });
      if (res.success && res.content) {
        setChatLog((l) => [...l, { role: "assistant", content: res.content! }]);
      } else {
        toast.error(res.error ?? "The assistant could not answer that.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  // Scan a pasted link/description first, THEN offer to curate.
  const scanPaste = async () => {
    if (!pasteUrl.trim() && pasteDesc.trim().length < 40) {
      return toast.error("Paste a job link or the job description text");
    }
    setScanningId("paste");
    try {
      const res = await quickScan.mutateAsync({
        url: pasteUrl.trim() || undefined,
        description: pasteDesc.trim() || undefined,
        title: pasteTitle.trim() || undefined,
      });
      if (!res.ok) return toast.error(res.reason);
      const scanResult = { ...res, company: pasteCompany.trim() || undefined, title: pasteTitle.trim() || undefined, url: pasteUrl.trim() || undefined };
      setScan(scanResult);
      setChatLog([]);
      // Carry this job across pages so the Optimizer and Applications reuse it.
      startWorkingSession({
        jobUrl: scanResult.url,
        jobDescription: res.jobText,
        companyName: scanResult.company,
        jobTitle: scanResult.title,
        scan: { match: res.match, suggestionText: res.suggestionText, matchedKeywords: res.matchedKeywords, missingKeywords: res.missingKeywords },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanningId(null);
    }
  };

  // Scan an existing job card.
  const scanJob = async (j: any) => {
    if (!j.description) return toast.error("This job has no description to scan");
    setScanningId(j.id);
    try {
      const res = await quickScan.mutateAsync({ description: j.description, title: j.title });
      if (!res.ok) return toast.error(res.reason);
      const scanResult = { ...res, company: j.title, title: j.title, url: j.sourceUrl ?? undefined };
      setScan(scanResult);
      setChatLog([]);
      startWorkingSession({
        jobUrl: scanResult.url,
        jobDescription: res.jobText,
        companyName: scanResult.company,
        jobTitle: scanResult.title,
        scan: { match: res.match, suggestionText: res.suggestionText, matchedKeywords: res.matchedKeywords, missingKeywords: res.missingKeywords },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanningId(null);
    }
  };

  // Curate documents from the scanned job (reuses the fetched text).
  const curateFromScan = async () => {
    if (!scan) return;
    const t = toast.loading("Drafting your documents…");
    try {
      await prepareFromPaste.mutateAsync({
        description: scan.jobText,
        url: scan.url,
        companyName: scan.company,
        jobTitle: scan.title,
      });
      await utils.applications.list.invalidate();
      toast.success("Draft saved to Applications for this job.", { id: t });
      setScan(null);
      setPasteUrl(""); setPasteDesc(""); setPasteCompany(""); setPasteTitle(""); setPasteOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { id: t });
    }
  };

  const runAutoApply = async () => {
    const t = toast.loading("Auto-preparing applications for your top matches…");
    try {
      const res = await autoApply.mutateAsync({ count: 5 });
      await utils.applications.list.invalidate();
      await utils.jobs.list.invalidate();
      toast.success(res.prepared > 0 ? `Prepared ${res.prepared} draft(s). Review them on Applications.` : "No eligible jobs (search first, or daily cap reached)", { id: t });
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
      toast.success("Draft ready. Review it on the Applications page.", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { id: t });
    }
  };

  const hasActiveProfile = !!profiles.data?.some((p) => p.isActive);

  const [location, setLocation] = useState("");
  const [company, setCompany] = useState("");
  const [minRelevance, setMinRelevance] = useState(45);
  const [maxDaysOld, setMaxDaysOld] = useState(0); // 0 = any time
  const [minSalary, setMinSalary] = useState(0);
  const [contractType, setContractType] = useState<"" | "full_time" | "part_time" | "contract" | "permanent">("");

  const runSearch = async (companyOverride?: string) => {
    const companyValue = companyOverride ?? (company || undefined);
    try {
      const res = await search.mutateAsync({
        qualityFilter, location: location || undefined, company: companyValue,
        keywords: keywords || undefined, minRelevance,
        maxDaysOld: maxDaysOld > 0 ? maxDaysOld : undefined,
        sortByDate: maxDaysOld > 0,
        minSalary: minSalary > 0 ? minSalary : undefined,
        contractType: contractType || undefined,
      });
      const parts = [`${res.saved} new`];
      if (res.duplicates) parts.push(`${res.duplicates} already saved`);
      if (res.discarded) parts.push(`${res.discarded} filtered out`);
      // Per-source breakdown so it's clear where results came from (or failed).
      const srcParts = (res.logs ?? []).map((l: any) =>
        l.status === "ok" ? `${l.source}: ${l.count}` : `${l.source}: failed`,
      );
      toast.success(`Search done. ${parts.join(", ")}`, {
        description: srcParts.length ? `Sources — ${srcParts.join(" · ")}` : undefined,
        duration: 6000,
      });
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

  // Clicking a suggested company: searchable ones open a hiring-insights panel
  // (with a "search their roles" action inside); external ones open careers.
  const pickCompany = (s: { name: string; searchable: boolean; careersUrl?: string }) => {
    if (!s.searchable) {
      if (s.careersUrl) window.open(s.careersUrl, "_blank", "noopener");
      return;
    }
    setInsightsCompany(s.name);
  };

  const searchCompany = async (name: string) => {
    setInsightsCompany(null);
    setCompany(name);
    await runSearch(name);
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
            <button onClick={() => runSearch()} disabled={search.isPending} className="btn-primary h-10">
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

          {/* Search LinkedIn (deep-link) + import your LinkedIn profile */}
          <div className="card p-4 mb-4 flex items-center gap-3 flex-wrap">
            <Linkedin className="w-4 h-4 text-[#0a66c2] shrink-0" />
            <div className="text-sm text-slate-600 flex-1 min-w-[180px]">
              Search LinkedIn jobs tuned to your profile, then paste any you like below to scan and curate.
            </div>
            <button
              onClick={() => {
                const p = profiles.data?.find((x) => x.isActive);
                const kw = keywords || p?.targetRole || "";
                const loc = location || "";
                const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(kw)}${loc ? `&location=${encodeURIComponent(loc)}` : ""}`;
                window.open(url, "_blank", "noopener");
              }}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#0a66c2] text-white text-xs font-semibold hover:brightness-110"
            >
              <Search className="w-3.5 h-3.5" /> Search LinkedIn
            </button>
            <Link to="/resume" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200" title="Import your LinkedIn export on the Resume page">
              Import my LinkedIn
            </Link>
          </div>

          {/* Paste a job found elsewhere — scan first, then curate */}
          <div className="card p-4 mb-4">
            <button onClick={() => setPasteOpen((v) => !v)} className="flex items-center gap-2 w-full text-left">
              <ClipboardPaste className="w-4 h-4 text-brand" />
              <h3 className="font-bold text-sm text-slate-800">Found a job elsewhere?</h3>
              <span className="text-xs text-slate-400">Paste a link or description. We scan the match first, then curate.</span>
              <span className="ml-auto text-slate-300 text-lg leading-none">{pasteOpen ? "−" : "+"}</span>
            </button>
            {pasteOpen && (
              <div className="mt-3 space-y-2">
                <input value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} placeholder="Job link (optional)" className="input" />
                <div className="grid sm:grid-cols-2 gap-2">
                  <input value={pasteCompany} onChange={(e) => setPasteCompany(e.target.value)} placeholder="Company (optional)" className="input" />
                  <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="Role title (optional)" className="input" />
                </div>
                <textarea value={pasteDesc} onChange={(e) => setPasteDesc(e.target.value)} className="textarea min-h-[120px]" placeholder="Paste the job description here. If a link is blocked, this is the reliable way." />
                <div className="flex items-center gap-2">
                  <button onClick={scanPaste} disabled={scanningId === "paste"} className="btn-primary">
                    {scanningId === "paste" ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</> : <><ScanSearch className="w-4 h-4" /> Quick scan</>}
                  </button>
                  <Link to="/applications" className="text-xs text-brand font-semibold hover:underline">View drafts</Link>
                </div>
              </div>
            )}
          </div>

          {/* Scan result panel */}
          {scan && (
            <div className="card p-5 mb-4 animate-fade-in" style={{ background: "linear-gradient(135deg,#fff7ed,#fff)" }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className={`chip ${matchColor(scan.match)} text-sm font-bold px-3 py-1`}>{scan.match}% match</span>
                  <div>
                    <div className="font-bold text-sm text-slate-800">{scan.title || "This role"}</div>
                    <div className="text-xs text-slate-500">{scan.suggestionText}</div>
                  </div>
                </div>
                <button onClick={() => setScan(null)} className="text-slate-300 hover:text-slate-600"><X className="w-4 h-4" /></button>
              </div>

              {!scan.hasResume && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-3">
                  Add your resume for a sharper match and to tailor documents. <Link to="/resume" className="underline font-semibold">Add resume →</Link>
                </p>
              )}

              {scan.hasResume && (
                <div className="grid sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-[11px] font-bold text-emerald-600 mb-1">You already cover</div>
                    <div className="flex flex-wrap gap-1">
                      {scan.matchedKeywords.length ? scan.matchedKeywords.map((k) => <span key={k} className="chip bg-emerald-100 text-emerald-700">{k}</span>) : <span className="text-xs text-slate-400">–</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-rose-500 mb-1">Worth adding</div>
                    <div className="flex flex-wrap gap-1">
                      {scan.missingKeywords.length ? scan.missingKeywords.map((k) => <span key={k} className="chip bg-rose-100 text-rose-600">{k}</span>) : <span className="text-xs text-slate-400">Nothing major</span>}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={curateFromScan} disabled={prepareFromPaste.isPending} className="btn-primary">
                  {prepareFromPaste.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Drafting…</> : <><Wand2 className="w-4 h-4" /> Curate documents</>}
                </button>
                <Link to="/optimizer" className="btn-ghost"><Bot className="w-4 h-4" /> Open in AI Optimizer</Link>
                {scan.url && <a href={scan.url} target="_blank" rel="noreferrer" className="text-xs text-brand font-semibold inline-flex items-center gap-1">View posting <ExternalLink className="w-3 h-3" /></a>}
              </div>

              {/* Match chat: ask about your fit for this job */}
              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4 text-brand" />
                  <h4 className="font-bold text-xs text-slate-700">Ask about your fit</h4>
                </div>
                {chatLog.length > 0 && (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto mb-2">
                    {chatLog.map((m, i) => (
                      <div key={i} className={`text-sm rounded-xl px-3 py-2 ${m.role === "user" ? "bg-brand text-white ml-8" : "bg-white text-slate-700 mr-8 border border-[var(--border)]"}`}>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !matchChat.isPending) askMatch(); }}
                    placeholder="Am I a strong fit? What should I emphasize?"
                    className="input flex-1"
                  />
                  <button onClick={askMatch} disabled={matchChat.isPending || !chatInput.trim()} className="btn-primary h-10">
                    {matchChat.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Company hiring insights modal */}
          {insightsCompany && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setInsightsCompany(null)}>
              <div className="card max-w-2xl w-full max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-brand" />
                    <h3 className="font-bold text-sm text-slate-800">Hiring insights · {insightsCompany}</h3>
                  </div>
                  <button onClick={() => setInsightsCompany(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  {insights.isLoading && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" /> Reading their live openings…
                    </div>
                  )}

                  {insights.data && insights.data.ok === false && (
                    <div className="text-center py-6">
                      <p className="text-sm text-slate-600">{insights.data.reason}</p>
                      {insights.data.careersUrl && (
                        <a href={insights.data.careersUrl} target="_blank" rel="noreferrer" className="btn-ghost mx-auto mt-4 inline-flex"><ExternalLink className="w-4 h-4" /> Open careers page</a>
                      )}
                    </div>
                  )}

                  {insights.data && insights.data.ok && (
                    <div className="space-y-5">
                      {/* Summary + headline stats */}
                      <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg,#fff7ed,#fff)" }}>
                        <p className="text-sm text-slate-700 leading-relaxed">{insights.data.summary}</p>
                        <div className="flex gap-2 mt-3 flex-wrap">
                          <span className="chip bg-white text-slate-600">{insights.data.totalOpenings} open</span>
                          <span className="chip bg-white text-slate-600">{insights.data.postedLast7} new this week</span>
                          <span className="chip bg-white text-slate-600">{insights.data.postedLast30} this month</span>
                        </div>
                      </div>

                      {/* Departments hiring */}
                      {insights.data.departments.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-brand" /><h4 className="font-bold text-xs text-slate-700 uppercase tracking-wide">Departments hiring</h4></div>
                          <div className="space-y-1.5">
                            {insights.data.departments.slice(0, 8).map((d) => {
                              const max = insights.data!.ok ? insights.data!.departments[0].count : 1;
                              return (
                                <div key={d.name} className="flex items-center gap-2">
                                  <div className="w-40 shrink-0 text-xs text-slate-600 truncate">{d.name}</div>
                                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-full bg-brand rounded-full" style={{ width: `${Math.max(6, (d.count / max) * 100)}%` }} />
                                  </div>
                                  <div className="w-16 text-right text-[11px] text-slate-400">{d.count}{d.recent ? ` · ${d.recent} new` : ""}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* High-volume roles */}
                      {insights.data.hotTitles.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-brand" /><h4 className="font-bold text-xs text-slate-700 uppercase tracking-wide">Hiring in volume (more seats, more competition)</h4></div>
                          <div className="flex flex-wrap gap-1.5">
                            {insights.data.hotTitles.map((t) => (
                              <a key={t.title} href={t.sampleUrl} target="_blank" rel="noreferrer" className="chip bg-blue-100 text-blue-700 hover:brightness-95">{t.title} ×{t.count}</a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rare / niche openings */}
                      {insights.data.rareTitles.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2"><Gem className="w-4 h-4 text-violet-500" /><h4 className="font-bold text-xs text-slate-700 uppercase tracking-wide">Niche openings (often less contested)</h4></div>
                          <div className="flex flex-wrap gap-1.5">
                            {insights.data.rareTitles.map((t) => (
                              <a key={t.title} href={t.sampleUrl} target="_blank" rel="noreferrer" className="chip bg-violet-100 text-violet-700 hover:brightness-95">{t.title}</a>
                            ))}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-2">Single postings for a distinct role. Fewer applicants tend to compete for these.</p>
                        </div>
                      )}

                      {/* Locations */}
                      {insights.data.topLocations.length > 0 && (
                        <div>
                          <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wide mb-2">Where they're hiring</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {insights.data.topLocations.map((l) => <span key={l.name} className="chip bg-slate-100 text-slate-600">{l.name} · {l.count}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-[var(--border)] flex items-center gap-2">
                  <button onClick={() => searchCompany(insightsCompany)} className="btn-primary"><Search className="w-4 h-4" /> Search their roles</button>
                  {insights.data && insights.data.ok && insights.data.careersUrl && (
                    <a href={insights.data.careersUrl} target="_blank" rel="noreferrer" className="btn-ghost"><ExternalLink className="w-4 h-4" /> Careers page</a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Suggested companies */}
          {(suggestions.data?.length ?? 0) > 0 && (
            <div className="card p-4 mb-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Building2 className="w-4 h-4 text-brand" />
                <h3 className="font-bold text-sm text-slate-800">Companies for you</h3>
                <span className="text-xs text-slate-400">
                  {industryId ? `in ${INDUSTRIES.find((i) => i.id === industryId)?.label}` : `based on your profile${keywords ? " & keywords" : ""}`}
                </span>
              </div>
              {/* Industry filter */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  onClick={() => setIndustryId("")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${industryId === "" ? "bg-brand text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  For me
                </button>
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => setIndustryId(ind.id === industryId ? "" : ind.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${industryId === ind.id ? "bg-brand text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >
                    {ind.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.data!.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => pickCompany(s)}
                    disabled={search.isPending}
                    title={s.searchable ? `Hiring insights for ${s.name}` : `Open ${s.name} careers page`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50 ${
                      s.searchable
                        ? "bg-brand-light text-brand hover:brightness-95"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    {s.name}
                    {s.searchable ? <BarChart3 className="w-3 h-3 opacity-70" /> : <ExternalLink className="w-3 h-3 opacity-60" />}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Highlighted companies open hiring insights (departments, in-demand and niche roles) with a search action. Plain ones open the employer's own careers page.
              </p>
            </div>
          )}

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
                        <button onClick={() => scanJob(j)} disabled={scanningId === j.id} className="text-xs text-brand font-semibold inline-flex items-center gap-1 hover:underline">{scanningId === j.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanSearch className="w-3 h-3" />} Quick scan</button>
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
                {statusTab === "all" && <button onClick={() => runSearch()} disabled={search.isPending} className="btn-primary mx-auto">{search.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</> : <><Search className="w-4 h-4" /> Search jobs now</>}</button>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
