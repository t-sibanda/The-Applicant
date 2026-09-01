import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus, Send, Loader2, Download, Copy, ExternalLink, X, CheckCircle,
  ScanSearch, Bot, Save, FileText, PenTool, Sparkles, ChevronRight, Check,
} from "lucide-react";

const STATUSES = ["draft", "ready", "saved", "applied", "phone_screen", "interview", "offer", "rejected"] as const;
type Status = (typeof STATUSES)[number];

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

function scoreColor(s: number) {
  return s >= 75 ? "text-emerald-600" : s >= 50 ? "text-amber-600" : "text-rose-500";
}

type ChatMsg = { role: "user" | "assistant"; content: string; revisedDoc?: string | null };

export default function Applications() {
  const utils = trpc.useUtils();
  const apps = trpc.applications.list.useQuery();
  const create = trpc.applications.create.useMutation();
  const updateStatus = trpc.applications.updateStatus.useMutation();
  const updateDraft = trpc.applications.updateDraft.useMutation();
  const analyze = trpc.applications.analyze.useMutation();
  const editChat = trpc.applications.editChat.useMutation();

  const [showForm, setShowForm] = useState(false);
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<Status>("applied");

  // Workspace: the open application and its editable documents.
  const [openId, setOpenId] = useState<number | null>(null);
  const openApp = apps.data?.find((a) => a.id === openId);
  const [tab, setTab] = useState<"resume" | "cover">("resume");
  const [resumeDoc, setResumeDoc] = useState("");
  const [coverDoc, setCoverDoc] = useState("");
  const [dirty, setDirty] = useState(false);

  // ATS analysis result for the open application.
  const [ats, setAts] = useState<null | {
    score: number; matched: string[]; missing: string[]; coverage: number;
    formatScore: number; formatIssues: string[];
  }>(null);

  // Continuous editing chat.
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (openApp) {
      setResumeDoc(openApp.draftResume ?? "");
      setCoverDoc(openApp.draftCoverLetter ?? "");
      setDirty(false);
      setAts(null);
      setChat([]);
      setTab("resume");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const currentDoc = tab === "resume" ? resumeDoc : coverDoc;
  const setCurrentDoc = (v: string) => {
    if (tab === "resume") setResumeDoc(v);
    else setCoverDoc(v);
    setDirty(true);
  };

  const dl = (text: string, name: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
  };

  const saveDocs = async () => {
    if (openId == null) return;
    await updateDraft.mutateAsync({ id: openId, draftResume: resumeDoc, draftCoverLetter: coverDoc });
    await utils.applications.list.invalidate();
    setDirty(false);
    toast.success("Saved");
  };

  const runAnalyze = async () => {
    if (openId == null) return;
    // Persist current edits first so the analysis reflects what you see.
    if (dirty) await saveDocs();
    const res = await analyze.mutateAsync({ id: openId }).catch((e) => { toast.error(e.message); return null; });
    if (!res) return;
    if (!res.ok) return toast.error(res.reason);
    setAts({ score: res.score, matched: res.matched, missing: res.missing, coverage: res.coverage, formatScore: res.formatScore, formatIssues: res.formatIssues });
    await utils.applications.list.invalidate();
  };

  const send = async () => {
    if (openId == null) return;
    const q = chatInput.trim();
    if (!q) return;
    setChatInput("");
    const history = chat.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    setChat((c) => [...c, { role: "user", content: q }]);
    try {
      const res = await editChat.mutateAsync({
        id: openId, docType: tab, currentDoc, message: q, history,
      });
      if (!res.success) { toast.error(res.error ?? "The assistant could not answer that."); return; }
      setChat((c) => [...c, { role: "assistant", content: res.reply || "(no reply)", revisedDoc: res.revisedDoc }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const applyRevision = (revised: string) => {
    setCurrentDoc(revised);
    toast.success(`Applied to your ${tab === "resume" ? "resume" : "cover letter"}. Save to keep it.`);
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
        <button onClick={() => setShowForm((v) => !v)} className="btn-ghost h-10">
          <Plus className="w-4 h-4" /> Log manually
        </button>
      </div>
      <p className="page-subtitle mb-5">Every job you add lands here. Open one to scan, analyze, and refine your documents.</p>

      {/* Pipeline summary */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-5">
        {STATUSES.map((s) => (
          <div key={s} className="card p-2.5 text-center">
            <div className="text-lg font-extrabold text-slate-800">{counts[s]}</div>
            <div className="text-[10px] font-semibold text-slate-400 capitalize mt-0.5">{s.replace("_", " ")}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card p-4 mb-4 grid sm:grid-cols-[1fr_auto_auto] gap-2 animate-fade-in">
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company / role" className="input" />
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="input">
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <button onClick={add} disabled={create.isPending} className="btn-primary">
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {apps.data?.map((a) => {
          const hasDocs = !!(a.draftResume || a.draftCoverLetter);
          return (
            <div key={a.id} className="card p-4 flex items-center gap-3 card-hover">
              <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-slate-800 truncate">{a.jobTitle || a.companyName || "Application"}</div>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>{new Date(a.createdAt ?? Date.now()).toLocaleDateString()}</span>
                  {a.atsScore != null && <span className={`font-semibold ${scoreColor(a.atsScore)}`}>ATS {a.atsScore}%</span>}
                  {hasDocs && <span className="chip bg-slate-100 text-slate-500">Docs ready</span>}
                </div>
              </div>
              <button onClick={() => setOpenId(a.id)} className="btn-primary h-8 px-3 text-xs">
                Open <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <select
                value={a.status}
                onChange={async (e) => { await updateStatus.mutateAsync({ id: a.id, status: e.target.value as never }); await utils.applications.list.invalidate(); }}
                className={`h-8 px-2 rounded-lg text-xs font-semibold border-0 cursor-pointer ${STATUS_STYLE[a.status] ?? "bg-slate-100 text-slate-600"}`}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
          );
        })}
        {apps.data?.length === 0 && (
          <div className="card p-8 text-center">
            <Send className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 mb-4">No applications yet. Add jobs from the Jobs page with one click, or log one manually.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary mx-auto"><Plus className="w-4 h-4" /> Log application</button>
          </div>
        )}
      </div>

      {/* Workspace modal: scan, analyze, edit, and refine with the assistant */}
      {openApp && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 backdrop-blur-sm" onClick={() => setOpenId(null)}>
          <div className="card m-3 sm:m-6 w-full max-w-6xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-slate-800 truncate">{openApp.jobTitle || openApp.companyName || "Application"}</h3>
                <p className="text-xs text-slate-400 truncate">{openApp.companyName}{openApp.atsScore != null && <span className={`ml-2 font-semibold ${scoreColor(openApp.atsScore)}`}>ATS {openApp.atsScore}%</span>}</p>
              </div>
              <button onClick={() => setOpenId(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 grid lg:grid-cols-[1fr_380px] overflow-hidden">
              {/* Left: document editor + analysis */}
              <div className="flex flex-col overflow-hidden border-r border-[var(--border)]">
                <div className="flex items-center gap-2 px-4 pt-3 flex-wrap">
                  <button onClick={() => setTab("resume")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${tab === "resume" ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`}><FileText className="w-3.5 h-3.5" /> Resume</button>
                  <button onClick={() => setTab("cover")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${tab === "cover" ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`}><PenTool className="w-3.5 h-3.5" /> Cover letter</button>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button onClick={runAnalyze} disabled={analyze.isPending} className="btn-ghost h-8 px-3 text-xs">{analyze.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />} Analyze fit</button>
                    <button onClick={saveDocs} disabled={updateDraft.isPending || !dirty} className="btn-ghost h-8 px-3 text-xs">{updateDraft.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save</button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <textarea
                    value={currentDoc}
                    onChange={(e) => setCurrentDoc(e.target.value)}
                    className={`textarea w-full min-h-[300px] ${tab === "resume" ? "font-mono text-xs" : "text-sm"}`}
                    placeholder={tab === "resume" ? "Your tailored resume. Edit freely, or ask the assistant to improve it." : "Your cover letter. Edit freely, or ask the assistant to improve it."}
                  />

                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => { navigator.clipboard.writeText(currentDoc); toast.success("Copied"); }} className="btn-ghost h-8 px-3 text-xs"><Copy className="w-3.5 h-3.5" /> Copy</button>
                    <button onClick={() => dl(currentDoc, `${(openApp.jobTitle || "document").replace(/\s+/g, "_")}_${tab === "resume" ? "Resume" : "Cover_Letter"}.txt`)} className="btn-ghost h-8 px-3 text-xs"><Download className="w-3.5 h-3.5" /> Download</button>
                    {openApp.jobUrl && <a href={openApp.jobUrl} target="_blank" rel="noreferrer" className="btn-ghost h-8 px-3 text-xs"><ExternalLink className="w-3.5 h-3.5" /> Posting</a>}
                    <button
                      onClick={async () => { if (dirty) await saveDocs(); await updateStatus.mutateAsync({ id: openApp.id, status: "ready" as never }); await utils.applications.list.invalidate(); toast.success("Marked ready to apply"); }}
                      className="btn-ghost h-8 px-3 text-xs ml-auto"
                    ><CheckCircle className="w-3.5 h-3.5" /> Mark ready</button>
                  </div>

                  {/* ATS analysis */}
                  {ats && (
                    <div className="rounded-xl border border-[var(--border)] p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2"><ScanSearch className="w-4 h-4 text-brand" /><h4 className="font-bold text-xs text-slate-700">ATS fit</h4></div>
                        <div className={`text-2xl font-extrabold ${scoreColor(ats.score)}`}>{ats.score}%</div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg bg-emerald-50 p-2">
                          <div className="text-[11px] font-bold text-emerald-700 mb-1">Covered ({ats.coverage}%)</div>
                          <div className="flex flex-wrap gap-1">{ats.matched.slice(0, 14).map((k) => <span key={k} className="chip bg-white text-emerald-700">{k}</span>)}</div>
                        </div>
                        <div className="rounded-lg bg-rose-50 p-2">
                          <div className="text-[11px] font-bold text-rose-600 mb-1">Worth adding</div>
                          <div className="flex flex-wrap gap-1">{ats.missing.length ? ats.missing.slice(0, 14).map((k) => <span key={k} className="chip bg-white text-rose-600">{k}</span>) : <span className="text-xs text-slate-400">Nothing major</span>}</div>
                        </div>
                      </div>
                      {ats.formatIssues.length > 0 && (
                        <ul className="list-disc pl-5 text-xs text-slate-500 mt-2 space-y-0.5">
                          {ats.formatIssues.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      )}
                      <p className="text-[11px] text-slate-400 mt-2">Ask the assistant to add the missing keywords honestly, then analyze again.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: continuous editing assistant */}
              <div className="flex flex-col overflow-hidden bg-slate-50/60">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
                  <Bot className="w-4 h-4 text-brand" />
                  <h4 className="font-bold text-xs text-slate-700">Editing assistant</h4>
                  <span className="text-[11px] text-slate-400 ml-auto">Editing your {tab === "resume" ? "resume" : "cover letter"}</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chat.length === 0 && (
                    <div className="text-xs text-slate-500 rounded-xl bg-white border border-[var(--border)] p-3">
                      Ask for objective feedback or edits. Examples:
                      <ul className="list-disc pl-4 mt-1.5 space-y-1">
                        <li>How well does this match the job?</li>
                        <li>Add the missing keywords without inventing experience.</li>
                        <li>Tighten my summary and lead with impact.</li>
                        <li>Rewrite the third bullet to sound more senior.</li>
                      </ul>
                    </div>
                  )}
                  {chat.map((m, i) => (
                    <div key={i} className={`text-sm rounded-xl px-3 py-2 ${m.role === "user" ? "bg-brand text-white ml-6" : "bg-white text-slate-700 mr-6 border border-[var(--border)]"}`}>
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      {m.role === "assistant" && m.revisedDoc && (
                        <button onClick={() => applyRevision(m.revisedDoc!)} className="mt-2 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-brand text-white text-[11px] font-semibold hover:brightness-110">
                          <Check className="w-3.5 h-3.5" /> Apply this edit
                        </button>
                      )}
                    </div>
                  ))}
                  {editChat.isPending && (
                    <div className="text-sm rounded-xl px-3 py-2 bg-white text-slate-500 mr-6 border border-[var(--border)] inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-3 border-t border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !editChat.isPending) send(); }}
                      placeholder={`Ask about your ${tab === "resume" ? "resume" : "cover letter"}…`}
                      className="input flex-1"
                    />
                    <button onClick={send} disabled={editChat.isPending || !chatInput.trim()} className="btn-primary h-10">
                      {editChat.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">Suggested edits arrive with an "Apply this edit" button. Nothing changes until you apply and save.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
