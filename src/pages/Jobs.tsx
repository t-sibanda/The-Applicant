import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Briefcase, UserPlus, ExternalLink, Search, Send, Loader2 } from "lucide-react";

export default function Jobs() {
  const utils = trpc.useUtils();
  const [qualityFilter, setQualityFilter] = useState(true);
  const profiles = trpc.profiles.list.useQuery();
  const jobs = trpc.jobs.list.useQuery({ qualityFilter });
  const search = trpc.jobs.search.useMutation();
  const setStatus = trpc.jobs.setStatus.useMutation();
  const logApp = trpc.applications.create.useMutation();

  const hasActiveProfile = !!profiles.data?.some((p) => p.isActive);

  const runSearch = async () => {
    try {
      const res = await search.mutateAsync({ qualityFilter });
      toast.success(`Found ${res.found}, saved ${res.saved} new`);
      await utils.jobs.list.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    }
  };

  const apply = async (jobId: number, title: string) => {
    await setStatus.mutateAsync({ id: jobId, status: "applied" });
    await logApp.mutateAsync({ jobId, companyName: title, status: "applied" });
    await Promise.all([utils.jobs.list.invalidate(), utils.applications.list.invalidate()]);
    toast.success("Logged to Applications");
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="page-title">Jobs</h1>
        {hasActiveProfile && (
          <button onClick={runSearch} disabled={search.isPending} className="btn-primary h-10">
            {search.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</> : <><Search className="w-4 h-4" /> Search jobs</>}
          </button>
        )}
      </div>
      <p className="page-subtitle mb-5">
        Pulls from compliant job sources based on your active profile.
      </p>

      {/* No active profile → guide the user to create one. */}
      {!profiles.isLoading && !hasActiveProfile ? (
        <div className="card p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-3">
            <UserPlus className="w-6 h-6 text-brand" />
          </div>
          <h2 className="font-bold text-slate-800">
            Set up a profile to start finding jobs
          </h2>
          <p className="text-sm text-slate-500 mt-1 mb-4 max-w-md mx-auto">
            A profile tells us which industry and role to search for. Create one
            and mark it active, then come back and search.
          </p>
          <Link to="/profiles" className="btn-primary mx-auto">
            <UserPlus className="w-4 h-4" /> Create a profile
          </Link>
        </div>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm text-slate-600 mb-4">
            <input
              type="checkbox"
              checked={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.checked)}
            />
            Prioritize above-average compensation &amp; culture
          </label>

          <div className="space-y-2">
            {jobs.data?.map((j) => (
              <div key={j.id} className="card p-4">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-sm flex-1 text-slate-800">{j.title}</div>
                  {j.qualityScore != null ? (
                    <span className="chip bg-emerald-100 text-emerald-700">Quality {j.qualityScore}</span>
                  ) : (
                    <span className="chip bg-slate-100 text-slate-500">Unrated</span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 capitalize">
                  {j.sourceName} · {j.status}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  {j.sourceUrl && (
                    <a href={j.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-brand font-semibold inline-flex items-center gap-1">
                      View posting <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {j.status !== "applied" && (
                    <button onClick={() => apply(j.id, j.title)} className="text-xs text-slate-500 font-semibold inline-flex items-center gap-1 hover:text-brand">
                      <Send className="w-3 h-3" /> Mark applied
                    </button>
                  )}
                </div>
              </div>
            ))}
            {jobs.data?.length === 0 && (
              <div className="card p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Briefcase className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  No jobs yet. Run your first search to pull listings for your active profile.
                </p>
                <button onClick={runSearch} disabled={search.isPending} className="btn-primary mx-auto">
                  {search.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</> : <><Search className="w-4 h-4" /> Search jobs now</>}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
