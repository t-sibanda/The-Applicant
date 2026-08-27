import { Link } from "react-router";
import { trpc } from "@/lib/trpc";
import { User, FileText, Briefcase, ArrowRight } from "lucide-react";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

const steps = [
  { to: "/profiles", icon: User, title: "1. Create a profile", desc: "Set your target industry and role." },
  { to: "/resume", icon: FileText, title: "2. Add your resume", desc: "Paste your base resume to tailor from." },
  { to: "/jobs", icon: Briefcase, title: "3. Search jobs", desc: "Pull listings that match your profile." },
];

export default function Dashboard() {
  const stats = trpc.dashboard.stats.useQuery();
  const profiles = trpc.profiles.list.useQuery();
  const s = stats.data;
  const isNew = !profiles.isLoading && (profiles.data?.length ?? 0) === 0;

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold mb-1">Dashboard</h1>
      <p className="text-sm text-slate-500 mb-5">Your job hunt at a glance</p>

      {isNew && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Get started</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {steps.map((st) => (
              <Link
                key={st.to}
                to={st.to}
                className="bg-white rounded-xl border border-slate-100 p-4 hover:border-brand/40 transition-colors group"
              >
                <st.icon className="w-5 h-5 text-brand mb-2" />
                <div className="font-semibold text-sm text-slate-800">{st.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{st.desc}</div>
                <div className="text-xs text-brand font-semibold mt-2 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                  Go <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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
