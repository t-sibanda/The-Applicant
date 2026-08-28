import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Ring, Counter } from "@/components/ui";
import { GraduationCap, TrendingUp, Award, Zap, Loader2, Sparkles, MapPin } from "lucide-react";

const IMPACT_COLOR: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-500",
};

export default function Career({ embedded }: { embedded?: boolean } = {}) {
  const simulate = trpc.career.simulate.useMutation();
  const [target, setTarget] = useState("");
  const [horizon, setHorizon] = useState(5);
  const [plan, setPlan] = useState<any | null>(null);

  const run = async () => {
    const res = await simulate.mutateAsync({ targetRole: target || undefined, horizonYears: horizon });
    if (!res.success) return toast.error(res.error ?? "Failed");
    setPlan(res.plan);
    toast.success("Career plan ready");
  };

  return (
    <div className={embedded ? "" : "max-w-4xl"}>
      {!embedded && <h1 className="page-title">Career Builder</h1>}
      {!embedded && <p className="page-subtitle mb-5">Map out where you're headed, set the milestones, and see which certifications keep you competitive.</p>}

      <div className="card p-5 mb-5 grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <div>
          <label className="text-xs font-bold text-slate-500">Target role (optional)</label>
          <input value={target} onChange={(e) => setTarget(e.target.value)} className="input mt-1" placeholder="e.g. Director of Engineering" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">Horizon</label>
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="input mt-1">
            {[3, 5, 7, 10].map((y) => <option key={y} value={y}>{y} years</option>)}
          </select>
        </div>
        <button onClick={run} disabled={simulate.isPending} className="btn-primary">
          {simulate.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Simulating…</> : <><Sparkles className="w-4 h-4" /> Build plan</>}
        </button>
      </div>

      {!plan && !simulate.isPending && (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-7 h-7 text-brand" />
          </div>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            We'll build a plan around your resume and profile. Roles to aim for, a timeline of milestones,
            where the pay tends to go, and the certifications worth your time.
          </p>
        </div>
      )}

      {plan && (
        <div className="space-y-4 animate-fade-in">
          {/* Assessment + score */}
          <div className="card p-5 flex items-center gap-5">
            <div className="relative shrink-0">
              <Ring value={plan.competitivenessScore ?? 0} size={80} color="#7c3aed" />
              <div className="absolute inset-0 flex items-center justify-center font-extrabold text-slate-800">
                <Counter value={plan.competitivenessScore ?? 0} />
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Competitiveness</div>
              <p className="text-sm text-slate-600">{plan.currentAssessment}</p>
            </div>
          </div>

          {/* Milestone timeline */}
          {plan.milestones?.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">Milestone timeline</h3></div>
              <div className="relative pl-6 space-y-4">
                <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-slate-100" />
                {plan.milestones.map((m: any, i: number) => (
                  <div key={i} className="relative animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="absolute -left-[18px] top-1 w-3 h-3 rounded-full bg-brand ring-4 ring-brand-light" />
                    <div className="flex items-center gap-2">
                      <span className="chip bg-brand-light text-brand">Year {m.year}</span>
                      <span className="font-semibold text-sm text-slate-800">{m.role}</span>
                      {m.salaryBand && <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{m.salaryBand}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{m.focus}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {plan.certifications?.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4"><Award className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">Recommended certifications</h3></div>
              <div className="grid sm:grid-cols-2 gap-3">
                {plan.certifications.map((c: any, i: number) => (
                  <div key={i} className="rounded-xl border border-[var(--border)] p-4 card-hover">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-sm text-slate-800">{c.name}</div>
                      <span className={`chip ${IMPACT_COLOR[c.impact] ?? IMPACT_COLOR.low}`}>{c.impact}</span>
                    </div>
                    <p className="text-xs text-slate-500">{c.why}</p>
                    {c.effort && <div className="text-[11px] text-slate-400 mt-1">Effort: {c.effort}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills + quick wins */}
          <div className="grid sm:grid-cols-2 gap-4">
            {plan.skillsToBuild?.length > 0 && (
              <div className="card p-5">
                <h3 className="font-bold text-sm text-slate-800 mb-2">Skills to build</h3>
                <div className="flex flex-wrap gap-2">{plan.skillsToBuild.map((s: string, i: number) => <span key={i} className="chip bg-slate-100 text-slate-600">{s}</span>)}</div>
              </div>
            )}
            {plan.quickWins?.length > 0 && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-brand" /><h3 className="font-bold text-sm text-slate-800">Next 90 days</h3></div>
                <ul className="space-y-1.5">{plan.quickWins.map((q: string, i: number) => <li key={i} className="flex gap-2 text-sm text-slate-600"><span className="text-brand">▸</span>{q}</li>)}</ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
