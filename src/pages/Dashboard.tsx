import { trpc } from "@/lib/trpc";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const stats = trpc.dashboard.stats.useQuery();
  const s = stats.data;

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold mb-1">Dashboard</h1>
      <p className="text-sm text-slate-500 mb-5">Your job hunt at a glance</p>

      {stats.isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Jobs found" value={s?.totalJobs ?? 0} />
          <Stat label="Applications" value={s?.totalApplications ?? 0} />
          <Stat label="Interviews" value={s?.interviews ?? 0} />
          <Stat label="Match rate" value={`${s?.matchRate ?? 0}%`} />
        </div>
      )}
    </div>
  );
}
