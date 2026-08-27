import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Send, Loader2 } from "lucide-react";

const STATUSES = ["saved", "applied", "phone_screen", "interview", "offer", "rejected"] as const;

const STATUS_STYLE: Record<string, string> = {
  saved: "bg-slate-100 text-slate-600",
  applied: "bg-blue-100 text-blue-700",
  phone_screen: "bg-cyan-100 text-cyan-700",
  interview: "bg-violet-100 text-violet-700",
  offer: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

export default function Applications() {
  const utils = trpc.useUtils();
  const apps = trpc.applications.list.useQuery();
  const create = trpc.applications.create.useMutation();
  const updateStatus = trpc.applications.updateStatus.useMutation();

  const [showForm, setShowForm] = useState(false);
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("applied");

  const add = async () => {
    if (!company.trim()) return toast.error("Enter a company or role");
    await create.mutateAsync({ companyName: company, status });
    await utils.applications.list.invalidate();
    setCompany(""); setStatus("applied"); setShowForm(false);
    toast.success("Application logged");
  };

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = apps.data?.filter((a) => a.status === s).length ?? 0;
    return acc;
  }, {});

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="page-title">Applications</h1>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary h-10">
          <Plus className="w-4 h-4" /> Log application
        </button>
      </div>
      <p className="page-subtitle mb-5">Track every application through your pipeline.</p>

      {/* Pipeline summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        {STATUSES.map((s) => (
          <div key={s} className="card p-3 text-center">
            <div className="text-xl font-extrabold text-slate-800">{counts[s]}</div>
            <div className="text-[10px] font-semibold text-slate-400 capitalize mt-0.5">{s.replace("_", " ")}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card p-4 mb-4 grid sm:grid-cols-[1fr_auto_auto] gap-2 animate-fade-in">
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company / role" className="input" />
          <select value={status} onChange={(e) => setStatus(e.target.value as never)} className="input">
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <button onClick={add} disabled={create.isPending} className="btn-primary">
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {apps.data?.map((a) => (
          <div key={a.id} className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 text-brand" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm text-slate-800">{a.companyName ?? "Application"}</div>
              <div className="text-xs text-slate-400">{new Date(a.createdAt ?? Date.now()).toLocaleDateString()}</div>
            </div>
            <select
              value={a.status}
              onChange={async (e) => { await updateStatus.mutateAsync({ id: a.id, status: e.target.value as never }); await utils.applications.list.invalidate(); }}
              className={`h-8 px-2 rounded-lg text-xs font-semibold border-0 cursor-pointer ${STATUS_STYLE[a.status] ?? "bg-slate-100 text-slate-600"}`}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </div>
        ))}
        {apps.data?.length === 0 && (
          <div className="card p-8 text-center">
            <Send className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 mb-4">No applications yet. Log your first one to start tracking.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary mx-auto"><Plus className="w-4 h-4" /> Log application</button>
          </div>
        )}
      </div>
    </div>
  );
}
