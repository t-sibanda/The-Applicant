import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Send, Loader2, FileEdit, Download, Copy, ExternalLink, X, CheckCircle } from "lucide-react";

const STATUSES = ["draft", "ready", "saved", "applied", "phone_screen", "interview", "offer", "rejected"] as const;

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700",
  ready: "bg-indigo-100 text-indigo-700",
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
  const updateDraft = trpc.applications.updateDraft.useMutation();

  const [showForm, setShowForm] = useState(false);
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("applied");

  // Review-mode: edit drafted materials.
  const [reviewId, setReviewId] = useState<number | null>(null);
  const reviewApp = apps.data?.find((a) => a.id === reviewId);
  const [rTab, setRTab] = useState<"resume" | "cover">("resume");
  const [rResume, setRResume] = useState("");
  const [rCover, setRCover] = useState("");

  useEffect(() => {
    if (reviewApp) {
      setRResume(reviewApp.draftResume ?? "");
      setRCover(reviewApp.draftCoverLetter ?? "");
    }
  }, [reviewId]);

  const saveDraft = async () => {
    if (reviewId == null) return;
    await updateDraft.mutateAsync({ id: reviewId, draftResume: rResume, draftCoverLetter: rCover });
    await utils.applications.list.invalidate();
    toast.success("Draft saved");
  };

  const markReady = async () => {
    if (reviewId == null) return;
    await saveDraft();
    await updateStatus.mutateAsync({ id: reviewId, status: "ready" as never });
    await utils.applications.list.invalidate();
    toast.success("Marked ready to apply");
  };

  const dl = (text: string, name: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
  };

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
              <div className="font-semibold text-sm text-slate-800">{a.jobTitle || a.companyName || "Application"}</div>
              <div className="text-xs text-slate-400">{new Date(a.createdAt ?? Date.now()).toLocaleDateString()}</div>
            </div>
            {(a.status === "draft" || a.status === "ready") && (a.draftResume || a.draftCoverLetter) && (
              <button onClick={() => { setReviewId(a.id); setRTab("resume"); }} className="btn-ghost h-8 px-3 text-xs"><FileEdit className="w-3.5 h-3.5" /> Review</button>
            )}
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
            <p className="text-sm text-slate-500 mb-4">No applications yet. Log your first one, or "Prepare application" from the Jobs page.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary mx-auto"><Plus className="w-4 h-4" /> Log application</button>
          </div>
        )}
      </div>

      {/* Review-mode modal: edit AI-drafted materials, then guided apply */}
      {reviewApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setReviewId(null)}>
          <div className="card max-w-3xl w-full max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Review application</h3>
                <p className="text-xs text-slate-400">{reviewApp.jobTitle || reviewApp.companyName}</p>
              </div>
              <button onClick={() => setReviewId(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex gap-2 px-4 pt-3">
              <button onClick={() => setRTab("resume")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${rTab === "resume" ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`}>Tailored Resume</button>
              <button onClick={() => setRTab("cover")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${rTab === "cover" ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`}>Cover Letter</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {rTab === "resume" ? (
                <textarea value={rResume} onChange={(e) => setRResume(e.target.value)} className="textarea w-full min-h-[340px] font-mono text-xs" placeholder="Tailored resume…" />
              ) : (
                <textarea value={rCover} onChange={(e) => setRCover(e.target.value)} className="textarea w-full min-h-[340px] text-sm" placeholder="Cover letter…" />
              )}
            </div>

            <div className="p-4 border-t border-[var(--border)] flex items-center gap-2 flex-wrap">
              <button onClick={saveDraft} disabled={updateDraft.isPending} className="btn-ghost">{updateDraft.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save edits</button>
              <button onClick={() => { const t = rTab === "resume" ? rResume : rCover; navigator.clipboard.writeText(t); toast.success("Copied"); }} className="btn-ghost"><Copy className="w-4 h-4" /> Copy</button>
              <button onClick={() => dl(rTab === "resume" ? rResume : rCover, `${rTab === "resume" ? "Resume" : "Cover_Letter"}.txt`)} className="btn-ghost"><Download className="w-4 h-4" /> Download</button>
              <div className="ml-auto flex gap-2">
                <button onClick={markReady} className="btn-ghost"><CheckCircle className="w-4 h-4" /> Mark ready</button>
                {reviewApp.jobUrl && (
                  <button
                    onClick={async () => {
                      // Apply kit (ToS-safe): save edits, copy the current tab's
                      // material to clipboard, open the posting, and mark applied
                      // after the user confirms they submitted.
                      await saveDraft();
                      const material = rTab === "resume" ? rResume : rCover;
                      try { await navigator.clipboard.writeText(material); } catch { /* clipboard may be blocked */ }
                      window.open(reviewApp.jobUrl!, "_blank", "noopener");
                      toast.success(`${rTab === "resume" ? "Resume" : "Cover letter"} copied — paste it on the site`);
                      // Confirm submission to move the pipeline forward.
                      setTimeout(async () => {
                        if (confirm("Did you submit your application on the site?")) {
                          await updateStatus.mutateAsync({ id: reviewApp.id, status: "applied" as never });
                          await utils.applications.list.invalidate();
                          setReviewId(null);
                        }
                      }, 800);
                    }}
                    className="btn-primary"
                  >
                    <ExternalLink className="w-4 h-4" /> Apply kit (open + copy)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
