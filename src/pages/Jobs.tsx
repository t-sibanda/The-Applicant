import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Briefcase, UserPlus, ExternalLink } from "lucide-react";

export default function Jobs() {
  const utils = trpc.useUtils();
  const [qualityFilter, setQualityFilter] = useState(true);
  const profiles = trpc.profiles.list.useQuery();
  const jobs = trpc.jobs.list.useQuery({ qualityFilter });
  const search = trpc.jobs.search.useMutation();

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

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">Jobs</h1>
        {hasActiveProfile && (
          <button
            onClick={runSearch}
            disabled={search.isPending}
            className="h-9 px-4 rounded-lg bg-brand text-white text-sm font-semibold"
          >
            {search.isPending ? "Searching…" : "Search jobs"}
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Pulls from compliant job sources based on your active profile.
      </p>

      {/* No active profile → guide the user to create one. */}
      {!profiles.isLoading && !hasActiveProfile ? (
        <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
          <UserPlus className="w-10 h-10 mx-auto text-brand mb-3" />
          <h2 className="font-semibold text-slate-800">
            Set up a profile to start finding jobs
          </h2>
          <p className="text-sm text-slate-500 mt-1 mb-4 max-w-md mx-auto">
            A profile tells us which industry and role to search for. Create one
            and mark it active, then come back and search.
          </p>
          <Link
            to="/profiles"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-brand text-white text-sm font-semibold"
          >
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
              <div
                key={j.id}
                className="bg-white rounded-xl border border-slate-100 p-4"
              >
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-sm flex-1">{j.title}</div>
                  {j.qualityScore != null ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                      Quality {j.qualityScore}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      Unrated
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {j.sourceName} · {j.status}
                </div>
                {j.sourceUrl && (
                  <a
                    href={j.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand font-semibold mt-1 inline-flex items-center gap-1"
                  >
                    View posting <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
            {jobs.data?.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
                <Briefcase className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <p className="text-sm text-slate-500 mb-4">
                  No jobs yet. Run your first search to pull listings for your
                  active profile.
                </p>
                <button
                  onClick={runSearch}
                  disabled={search.isPending}
                  className="h-10 px-5 rounded-lg bg-brand text-white text-sm font-semibold"
                >
                  {search.isPending ? "Searching…" : "Search jobs now"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
